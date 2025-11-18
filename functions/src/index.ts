import * as admin from 'firebase-admin';
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { setGlobalOptions } from 'firebase-functions/v2';
import express from 'express';
import cors from 'cors';
import Stripe from 'stripe';
import { initializeFirebaseAdmin, getFirestore, config } from './config';
import { diditKycService } from './services/diditKyc';

// Didit API Configuration
const DIDIT_API_BASE_URL = 'https://verification.didit.me/v2';
const DIDIT_API_KEY = config.didit.apiKey;

// Initialize Firebase Admin
initializeFirebaseAdmin();

// Set global options
setGlobalOptions({
  region: 'us-central1',
  maxInstances: 10,
});

// Initialize services
const db = getFirestore();
const stripe = new Stripe(config.stripe.secretKey, {
  apiVersion: '2023-10-16',
});

// Express app for webhook endpoints
const app = express();
app.use(cors({ origin: true }));

// Stripe webhook endpoint
app.post('/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'] as string;
  const endpointSecret = config.stripe.webhookSecret;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err: any) {
    console.log(`Webhook signature verification failed.`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    await handleStripeWebhook(event);
    return res.json({ received: true });
  } catch (error) {
    console.error('Error handling webhook:', error);
    return res.status(500).send('Webhook handler failed');
  }
});

// Didit KYC webhook endpoint
app.post('/didit-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const rawBody = req.body;
    const signature = req.headers['x-didit-signature'] as string;

    // Verify webhook signature for security
    if (signature && config.didit.webhookSecret) {
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', config.didit.webhookSecret)
        .update(rawBody, 'utf8')
        .digest('hex');

      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
        console.error('Invalid webhook signature');
        return res.status(401).send('Invalid signature');
      }
    }

    // Parse the JSON payload - handle both raw buffer and already parsed object
    let payload;
    try {
      if (Buffer.isBuffer(rawBody)) {
        payload = JSON.parse(rawBody.toString());
      } else if (typeof rawBody === 'string') {
        payload = JSON.parse(rawBody);
      } else {
        // Already parsed object
        payload = rawBody;
      }
    } catch (parseError) {
      console.error('Failed to parse webhook payload:', parseError);
      return res.status(400).send('Invalid JSON payload');
    }

    console.log('Received Didit webhook:', payload);

    // Basic validation - Didit uses webhook_type, not event_type
    const eventType = payload.event_type || payload.webhook_type;
    if (!eventType || !payload.session_id) {
      console.error('Invalid webhook payload - missing fields:', { eventType, session_id: payload.session_id });
      return res.status(400).send('Invalid webhook payload');
    }

    // Normalize payload to use event_type consistently
    const normalizedPayload = {
      ...payload,
      event_type: eventType,
    };

    await diditKycService.handleWebhook(normalizedPayload);
    return res.json({ success: true });
  } catch (error) {
    console.error('Error handling Didit webhook:', error);
    return res.status(500).send('Webhook handler failed');
  }
});

// Didit KYC session creation endpoint
app.post('/create-kyc-session', express.json(), async (req, res) => {
  try {
    const { userId, workflowId } = req.body;

    if (!userId) {
      return res.status(400).send('User ID is required');
    }

    console.log(`Creating KYC session for user ${userId}`);

    // Create session via Didit API with redirect URLs
    const response = await fetch(`${DIDIT_API_BASE_URL}/session/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': DIDIT_API_KEY,
      },
      body: JSON.stringify({
        workflow_id: workflowId || config.didit.workflowId,
        vendor_data: userId,
        metadata: {
          platform: 'rentat',
          user_id: userId,
          created_at: new Date().toISOString(),
        },
        language: 'en',
        // Add redirect URLs for better UX
        success_url: `https://rentat.vercel.app/kyc-success?userId=${userId}`,
        failure_url: `https://rentat.vercel.app/kyc-failure?userId=${userId}`,
        cancel_url: `https://rentat.vercel.app/kyc-cancelled?userId=${userId}`,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Didit API error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      return res.status(response.status).json({
        error: 'Didit API error',
        status: response.status,
        details: errorText
      });
    }

    const data = await response.json();
    console.log('Didit session created:', data);

    // Get session details to retrieve session_url
    const sessionDetailsResponse = await fetch(`${DIDIT_API_BASE_URL}/session/${data.session_id}/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': DIDIT_API_KEY,
      },
    });

    let sessionDetails = data; // fallback to creation response
    if (sessionDetailsResponse.ok) {
      sessionDetails = await sessionDetailsResponse.json();
      console.log('Didit session details:', sessionDetails);
    }

    // Store session info in user document (handle undefined values)
    const userRef = db.collection('users').doc(userId);
    const updateData: any = {
      'diditKyc.sessionId': data.session_id,
      'diditKyc.status': 'not_started',
      'diditKyc.workflowId': workflowId || config.didit.workflowId,
      'diditKyc.createdAt': admin.firestore.FieldValue.serverTimestamp(),
      'diditKyc.lastUpdated': admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Only add fields that are not undefined
    if (sessionDetails.url) {
      updateData['diditKyc.verificationUrl'] = sessionDetails.url;
    }
    if (sessionDetails.qr_code) {
      updateData['diditKyc.qrCode'] = sessionDetails.qr_code;
    }
    if (sessionDetails.expires_at) {
      updateData['diditKyc.expiresAt'] = admin.firestore.Timestamp.fromDate(new Date(sessionDetails.expires_at));
    } else {
      updateData['diditKyc.expiresAt'] = admin.firestore.Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000);
    }

    await userRef.update(updateData);

    return res.json({
      sessionId: data.session_id,
      verificationUrl: sessionDetails.url,
      qrCode: sessionDetails.qr_code,
      expiresAt: sessionDetails.expires_at,
    });
  } catch (error) {
    console.error('Error creating KYC session:', error);
    return res.status(500).send('Failed to create KYC session');
  }
});

// Export the webhook handler
export const webhooks = onRequest(app);

// Rental request validation and processing
export const processRentalRequest = onCall(async (request) => {
  const { auth, data } = request;
  
  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { itemId, startDate, endDate, deliveryMethod, deliveryLocation, message } = data;

  try {
    // Validate input
    if (!itemId || !startDate || !endDate) {
      throw new HttpsError('invalid-argument', 'Missing required fields');
    }

    // Get item details
    const itemDoc = await db.collection('items').doc(itemId).get();
    if (!itemDoc.exists) {
      throw new HttpsError('not-found', 'Item not found');
    }

    const item = itemDoc.data()!;
    
    // Check if user is trying to rent their own item
    if (item.ownerId === auth.uid) {
      throw new HttpsError('permission-denied', 'Cannot rent your own item');
    }

    // Verify user is verified
    const userDoc = await db.collection('users').doc(auth.uid).get();
    const user = userDoc.data()!;
    
    if (!user.verification?.isVerified) {
      throw new HttpsError('permission-denied', 'User must be verified to make rental requests');
    }

    // Check item availability
    const start = new Date(startDate);
    const end = new Date(endDate);
    const isAvailable = await checkItemAvailability(itemId, start, end);
    
    if (!isAvailable) {
      throw new HttpsError('failed-precondition', 'Item is not available for the selected dates');
    }

    // Calculate pricing
    const pricing = calculateRentalPricing(item, start, end, deliveryMethod);

    // Create rental document
    const rentalData = {
      itemId,
      ownerId: item.ownerId,
      renterId: auth.uid,
      status: 'pending',
      dates: {
        requestedStart: admin.firestore.Timestamp.fromDate(start),
        requestedEnd: admin.firestore.Timestamp.fromDate(end),
      },
      pricing,
      delivery: {
        method: deliveryMethod,
        deliveryLocation,
      },
      communication: {
        lastMessage: message ? admin.firestore.Timestamp.now() : null,
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      timeline: [{
        event: 'rental_requested',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        actor: auth.uid,
        details: { message },
      }],
    };

    const rentalRef = await db.collection('rentals').add(rentalData);

    // Create chat for communication
    const participants = [auth.uid, item.ownerId];
    const participantsKey = participants.sort().join(':');
    const chatData = {
      participants,
      participantsKey,
      type: 'rental',
      rentalId: rentalRef.id,
      itemId,
      lastMessage: message ? {
        text: message,
        senderId: auth.uid,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        type: 'text',
      } : null,
      metadata: {
        unreadCount: {
          [auth.uid]: 0,
          [item.ownerId]: message ? 1 : 0,
        },
        isActive: true,
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const chatRef = await db.collection('chats').add(chatData);

    // Update rental with chat ID
    await rentalRef.update({ 'communication.chatId': chatRef.id });

    // Add initial message if provided
    if (message) {
      await chatRef.collection('messages').add({
        senderId: auth.uid,
        type: 'text',
        content: { text: message },
        status: {
          sent: admin.firestore.FieldValue.serverTimestamp(),
        },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // Send notification to owner
    await sendNotification(item.ownerId, {
      type: 'rental_request',
      title: 'New Rental Request',
      body: `${user.displayName} wants to rent your ${item.title}`,
      data: {
        rentalId: rentalRef.id,
        itemId,
        chatId: chatRef.id,
      },
    });

    return {
      rentalId: rentalRef.id,
      chatId: chatRef.id,
      pricing,
    };
  } catch (error) {
    console.error('Error processing rental request:', error);
    throw error instanceof HttpsError ? error : new HttpsError('internal', 'Failed to process rental request');
  }
});

// Rental approval/rejection
export const processRentalResponse = onCall(async (request) => {
  const { auth, data } = request;
  
  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { rentalId, action, message } = data; // action: 'approve' | 'reject'

  try {
    const rentalRef = db.collection('rentals').doc(rentalId);
    const rentalDoc = await rentalRef.get();
    
    if (!rentalDoc.exists) {
      throw new HttpsError('not-found', 'Rental not found');
    }

    const rental = rentalDoc.data()!;
    
    // Verify user is the owner
    if (rental.ownerId !== auth.uid) {
      throw new HttpsError('permission-denied', 'Only the item owner can approve/reject rentals');
    }

    // Verify rental is in pending state
    if (rental.status !== 'pending') {
      throw new HttpsError('failed-precondition', 'Rental is not in pending state');
    }

    const updateData: any = {
      status: action === 'approve' ? 'approved' : 'rejected',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      timeline: admin.firestore.FieldValue.arrayUnion({
        event: `rental_${action}d`,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        actor: auth.uid,
        details: { message },
      }),
    };

    if (action === 'approve') {
      updateData['dates.confirmedStart'] = rental.dates.requestedStart;
      updateData['dates.confirmedEnd'] = rental.dates.requestedEnd;
      
      // Create Stripe payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(rental.pricing.total * 100), // Convert to cents
        currency: rental.pricing.currency.toLowerCase(),
        metadata: {
          rentalId,
          type: 'rental_payment',
        },
      });

      updateData['payment.stripePaymentIntentId'] = paymentIntent.id;
      updateData['payment.paymentStatus'] = 'pending';
    }

    await rentalRef.update(updateData);

    // Send notification to renter
    const notificationType = action === 'approve' ? 'rental_approved' : 'rental_rejected';
    const notificationTitle = action === 'approve' ? 'Rental Approved!' : 'Rental Declined';
    const notificationBody = action === 'approve' 
      ? 'Your rental request has been approved. Complete payment to confirm.'
      : 'Your rental request has been declined.';

    await sendNotification(rental.renterId, {
      type: notificationType,
      title: notificationTitle,
      body: notificationBody,
      data: {
        rentalId,
        itemId: rental.itemId,
      },
    });

    // Add system message to chat
    if (message) {
      const chatRef = db.collection('chats').doc(rental.communication.chatId);
      await chatRef.collection('messages').add({
        senderId: auth.uid,
        type: 'system',
        content: {
          text: message,
          systemData: {
            action,
            rentalStatus: updateData.status,
          },
        },
        status: {
          sent: admin.firestore.FieldValue.serverTimestamp(),
        },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    return { success: true, paymentClientSecret: action === 'approve' ? updateData['payment.stripePaymentIntentId'] : null };
  } catch (error) {
    console.error('Error processing rental response:', error);
    throw error instanceof HttpsError ? error : new HttpsError('internal', 'Failed to process rental response');
  }
});

// Handle rental completion
export const completeRental = onCall(async (request) => {
  const { auth, data } = request;
  
  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { rentalId, confirmationType, damageReport } = data; // confirmationType: 'owner' | 'renter'

  try {
    const rentalRef = db.collection('rentals').doc(rentalId);
    const rentalDoc = await rentalRef.get();
    
    if (!rentalDoc.exists) {
      throw new HttpsError('not-found', 'Rental not found');
    }

    const rental = rentalDoc.data()!;
    
    // Verify user is participant
    const isOwner = rental.ownerId === auth.uid;
    const isRenter = rental.renterId === auth.uid;
    
    if (!isOwner && !isRenter) {
      throw new HttpsError('permission-denied', 'User is not a participant in this rental');
    }

    // Verify rental is active
    if (rental.status !== 'active') {
      throw new HttpsError('failed-precondition', 'Rental is not active');
    }

    const updateData: any = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      timeline: admin.firestore.FieldValue.arrayUnion({
        event: `${confirmationType}_confirmed_completion`,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        actor: auth.uid,
        details: damageReport ? { damageReport } : {},
      }),
    };

    // Update completion status
    updateData[`completion.${confirmationType}Confirmed`] = true;

    // Handle damage report
    if (damageReport && isOwner) {
      updateData['completion.damageReported'] = {
        by: 'owner',
        description: damageReport.description,
        images: damageReport.images || [],
        amount: damageReport.amount || 0,
      };
    }

    await rentalRef.update(updateData);

    // Check if both parties have confirmed
    const updatedRental = await rentalRef.get();
    const updatedData = updatedRental.data()!;
    
    if (updatedData.completion?.ownerConfirmed && updatedData.completion?.renterConfirmed) {
      // Complete the rental
      await completeRentalTransaction(rentalId, updatedData);
    }

    return { success: true };
  } catch (error) {
    console.error('Error completing rental:', error);
    throw error instanceof HttpsError ? error : new HttpsError('internal', 'Failed to complete rental');
  }
});

// Trigger when a new rental is created
export const onRentalCreated = onDocumentCreated('rentals/{rentalId}', async (event) => {
  const rental = event.data?.data();
  if (!rental) return;

  try {
    // Update item stats
    await db.collection('items').doc(rental.itemId).update({
      'stats.views': admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Update user stats
    await db.collection('users').doc(rental.renterId).update({
      'stats.itemsRented': admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating stats on rental creation:', error);
  }
});

// Trigger when a rental is updated
export const onRentalUpdated = onDocumentUpdated('rentals/{rentalId}', async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();

  if (!before || !after) return;

  try {
    // Handle status changes
    if (before.status !== after.status) {
      await handleRentalStatusChange(event.params.rentalId, before.status, after.status, after);
    }
  } catch (error) {
    console.error('Error handling rental update:', error);
  }
});

// Trigger when a notification campaign is created or updated
export const onNotificationCampaignCreated = onDocumentCreated('notification_campaigns/{campaignId}', async (event) => {
  const campaign = event.data?.data();
  if (!campaign) return;

  try {
    const campaignId = event.params.campaignId;

    // Only process if status is 'sending' (immediate campaigns)
    if (campaign.status !== 'sending') return;

    await processNotificationCampaign(campaignId, campaign);
  } catch (error) {
    console.error('Error processing notification campaign creation:', error);
  }
});

export const onNotificationCampaignUpdated = onDocumentUpdated('notification_campaigns/{campaignId}', async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();

  if (!before || !after) return;

  try {
    const campaignId = event.params.campaignId;

    // Only process if status changed to 'sending' or 'scheduled' campaigns become due
    if (before.status === after.status) return;

    if (after.status === 'sending') {
      await processNotificationCampaign(campaignId, after);
    }
  } catch (error) {
    console.error('Error processing notification campaign update:', error);
  }
});

// Scheduled function to check for due campaigns (runs every 5 minutes)
export const checkScheduledCampaigns = onCall(async () => {
  try {
    const now = admin.firestore.Timestamp.now();
    const campaignsRef = db.collection('notification_campaigns');

    // Find campaigns that are scheduled and due
    const dueCampaigns = await campaignsRef
      .where('status', '==', 'scheduled')
      .where('scheduling.scheduledAt', '<=', now)
      .get();

    const processingPromises = dueCampaigns.docs.map(async (doc: any) => {
      const campaign = doc.data();
      const campaignId = doc.id;

      // Update status to sending
      await doc.ref.update({
        status: 'sending',
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Process the campaign
      await processNotificationCampaign(campaignId, { ...campaign, status: 'sending' });
    });

    await Promise.all(processingPromises);

    return { processed: processingPromises.length };
  } catch (error) {
    console.error('Error checking scheduled campaigns:', error);
    throw new HttpsError('internal', 'Failed to check scheduled campaigns');
  }
});

// Function to process a notification campaign
async function processNotificationCampaign(campaignId: string, campaign: any) {
  try {
    console.log(`Processing notification campaign: ${campaignId}`);

    // Get target users based on audience criteria
    const targetUsers = await getTargetUsers(campaign.targetAudience);

    console.log(`Found ${targetUsers.length} target users for campaign ${campaignId}`);

    // Update campaign stats with target count
    await db.collection('notification_campaigns').doc(campaignId).update({
      'stats.targetUsers': targetUsers.length,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Send notifications in batches
    const batchSize = 500; // FCM limit
    let sent = 0;
    let failed = 0;

    for (let i = 0; i < targetUsers.length; i += batchSize) {
      const batch = targetUsers.slice(i, i + batchSize);
      const batchResults = await sendBatchNotifications(batch, campaign);

      sent += batchResults.sent;
      failed += batchResults.failed;

      // Update progress
      await db.collection('notification_campaigns').doc(campaignId).update({
        'stats.sent': sent,
        'stats.failed': failed,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // Mark campaign as completed
    await db.collection('notification_campaigns').doc(campaignId).update({
      status: 'sent',
      'stats.sent': sent,
      'stats.failed': failed,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Campaign ${campaignId} completed: ${sent} sent, ${failed} failed`);
  } catch (error) {
    console.error(`Error processing campaign ${campaignId}:`, error);

    // Mark campaign as failed
    await db.collection('notification_campaigns').doc(campaignId).update({
      status: 'cancelled',
      'stats.failed': admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
}

// Function to get target users based on audience criteria
async function getTargetUsers(audience: any): Promise<any[]> {
  let query: any = db.collection('users');

  if (audience.type === 'all') {
    // Get all users with FCM tokens
    query = query.where('fcmTokens', '!=', null);
  } else if (audience.type === 'custom' && audience.filters) {
    // Apply filters
    for (const filter of audience.filters) {
      switch (filter.field) {
        case 'verified':
          if (filter.operator === 'equals') {
            query = query.where('verification.isVerified', '==', filter.value);
          }
          break;
        case 'location':
          if (filter.operator === 'equals') {
            query = query.where('location.governorate', '==', filter.value);
          }
          break;
        // Add more filters as needed
      }
    }
  }

  const snapshot = await query.get();
  return snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
}

// Function to send batch notifications
async function sendBatchNotifications(users: any[], campaign: any) {
  const tokens: string[] = [];
  const notifications: any[] = [];

  // Collect all FCM tokens and prepare notifications
  for (const user of users) {
    if (user.fcmTokens && Array.isArray(user.fcmTokens)) {
      tokens.push(...user.fcmTokens);

      // Create notification document for each user
      notifications.push({
        userId: user.id,
        type: 'campaign',
        title: campaign.title,
        body: campaign.message,
        data: {
          campaignId: campaign.id,
          type: 'campaign',
        },
        status: 'unread',
        delivery: {
          push: { sent: false },
        },
        priority: 'normal',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }

  let sent = 0;
  let failed = 0;

  if (tokens.length > 0) {
    // Send FCM multicast message
    const message = {
      notification: {
        title: campaign.title,
        body: campaign.message,
        ...(campaign.imageUrl && { imageUrl: campaign.imageUrl }),
      },
      data: {
        campaignId: campaign.id,
        type: 'campaign',
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
      tokens: tokens,
    };

    try {
      const response = await admin.messaging().sendMulticast(message);
      sent = response.successCount;
      failed = response.failureCount;

      console.log(`FCM batch sent: ${sent} success, ${failed} failed`);

      // Log failures for debugging
      if (response.responses) {
        response.responses.forEach((resp, index) => {
          if (!resp.success) {
            console.error(`FCM failure for token ${index}:`, resp.error);
          }
        });
      }
    } catch (error) {
      console.error('FCM send error:', error);
      failed = tokens.length;
    }
  }

  // Create notification documents in batch
  if (notifications.length > 0) {
    const batch = db.batch();
    notifications.forEach(notification => {
      const ref = db.collection('notifications').doc();
      batch.set(ref, notification);
    });
    await batch.commit();
  }

  return { sent, failed };
}

// Trigger when a new chat message is created
export const onMessageCreated = onDocumentCreated('chats/{chatId}/messages/{messageId}', async (event) => {
  const message = event.data?.data();
  if (!message) return;

  try {
    const chatId = event.params.chatId;
    const messageId = event.params.messageId;

    // Get chat document to find participants
    const chatRef = db.collection('chats').doc(chatId);
    const chatDoc = await chatRef.get();

    if (!chatDoc.exists) return;

    const chat = chatDoc.data()!;
    const participants: string[] = chat.participants || [];

    // Get sender info
    const senderId = message.senderId;
    const senderDoc = await db.collection('users').doc(senderId).get();
    const sender = senderDoc.data();

    // Send notifications to all participants except sender
    const notifications = participants
      .filter(uid => uid !== senderId)
      .map(async (userId) => {
        const userDoc = await db.collection('users').doc(userId).get();
        const user = userDoc.data();

        if (!user?.fcmTokens?.length) return;

        // Create notification document
        await db.collection('notifications').add({
          userId,
          type: 'message',
          title: `${sender?.displayName || 'Someone'} sent a message`,
          body: message.content?.text || 'New message',
          data: {
            chatId,
            messageId,
            senderId,
            type: message.type,
          },
          status: 'unread',
          delivery: {
            push: { sent: false },
          },
          priority: 'normal',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Send push notification
        const pushMessage = {
          notification: {
            title: `${sender?.displayName || 'Someone'} sent a message`,
            body: message.content?.text || 'New message',
          },
          data: {
            chatId,
            messageId,
            senderId,
            type: message.type,
            click_action: 'FLUTTER_NOTIFICATION_CLICK',
          },
          tokens: user.fcmTokens,
        };

        try {
          await admin.messaging().sendMulticast(pushMessage);
          console.log(`Push notification sent to user ${userId} for message ${messageId}`);
        } catch (pushError) {
          console.error(`Failed to send push notification to user ${userId}:`, pushError);
        }
      });

    await Promise.all(notifications);

    // Update unread counts for participants
    const unreadUpdates = participants
      .filter(uid => uid !== senderId)
      .map(uid =>
        chatRef.update({
          [`metadata.unreadCount.${uid}`]: admin.firestore.FieldValue.increment(1),
        })
      );

    await Promise.all(unreadUpdates);

  } catch (error) {
    console.error('Error handling message creation:', error);
  }
});

// Helper functions
async function checkItemAvailability(itemId: string, startDate: Date, endDate: Date): Promise<boolean> {
  // Check if item exists and is available
  const itemDoc = await db.collection('items').doc(itemId).get();
  if (!itemDoc.exists) return false;
  
  const item = itemDoc.data()!;
  if (!item.availability?.isAvailable) return false;

  // Check for conflicting rentals
  const rentalsQuery = await db.collection('rentals')
    .where('itemId', '==', itemId)
    .where('status', 'in', ['approved', 'active'])
    .get();

  for (const rentalDoc of rentalsQuery.docs) {
    const rental = rentalDoc.data();
    const existingStart = rental.dates?.confirmedStart?.toDate() || rental.dates?.requestedStart?.toDate();
    const existingEnd = rental.dates?.confirmedEnd?.toDate() || rental.dates?.requestedEnd?.toDate();
    
    if (existingStart && existingEnd) {
      // Check for overlap
      if (startDate < existingEnd && endDate > existingStart) {
        return false;
      }
    }
  }

  return true;
}

function calculateRentalPricing(item: any, startDate: Date, endDate: Date, deliveryMethod: string) {
  const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const dailyRate = item.pricing.dailyRate;
  
  let subtotal = dailyRate * days;
  
  // Apply weekly/monthly discounts if applicable
  if (days >= 30 && item.pricing.monthlyRate) {
    const months = Math.floor(days / 30);
    const remainingDays = days % 30;
    subtotal = (months * item.pricing.monthlyRate) + (remainingDays * dailyRate);
  } else if (days >= 7 && item.pricing.weeklyRate) {
    const weeks = Math.floor(days / 7);
    const remainingDays = days % 7;
    subtotal = (weeks * item.pricing.weeklyRate) + (remainingDays * dailyRate);
  }
  
  const platformFee = Math.round(subtotal * 0.1); // 10% platform fee
  const deliveryFee = deliveryMethod === 'delivery' ? (item.location?.deliveryOptions?.deliveryFee || 0) : 0;
  const securityDeposit = item.pricing.securityDeposit;
  
  const total = subtotal + platformFee + deliveryFee + securityDeposit;
  
  return {
    dailyRate,
    totalDays: days,
    subtotal,
    platformFee,
    securityDeposit,
    deliveryFee,
    total,
    currency: item.pricing.currency,
  };
}

async function sendNotification(userId: string, notification: any) {
  try {
    // Get user's FCM tokens
    const userDoc = await db.collection('users').doc(userId).get();
    const user = userDoc.data();
    
    if (!user?.fcmTokens?.length) return;

    // Create notification document
    await db.collection('notifications').add({
      userId,
      ...notification,
      status: 'unread',
      delivery: {
        push: { sent: false },
      },
      priority: 'normal',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Send push notification
    const message = {
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: notification.data || {},
      tokens: user.fcmTokens,
    };

    await admin.messaging().sendMulticast(message);
  } catch (error) {
    console.error('Error sending notification:', error);
  }
}

async function handleStripeWebhook(event: Stripe.Event) {
  switch (event.type) {
    case 'payment_intent.succeeded':
      await handlePaymentSuccess(event.data.object as Stripe.PaymentIntent);
      break;
    case 'payment_intent.payment_failed':
      await handlePaymentFailure(event.data.object as Stripe.PaymentIntent);
      break;
    default:
      console.log(`Unhandled event type: ${event.type}`);
  }
}

async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  const rentalId = paymentIntent.metadata.rentalId;
  if (!rentalId) return;

  try {
    await db.collection('rentals').doc(rentalId).update({
      'payment.paymentStatus': 'succeeded',
      status: 'active',
      'dates.actualStart': admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      timeline: admin.firestore.FieldValue.arrayUnion({
        event: 'payment_completed',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        actor: 'system',
        details: { paymentIntentId: paymentIntent.id },
      }),
    });

    // Create wallet transaction
    const rentalDoc = await db.collection('rentals').doc(rentalId).get();
    const rental = rentalDoc.data()!;

    await db.collection('wallet_transactions').add({
      userId: rental.renterId,
      type: 'rental_payment',
      amount: -rental.pricing.total,
      currency: rental.pricing.currency,
      status: 'completed',
      relatedRentalId: rentalId,
      relatedItemId: rental.itemId,
      payment: {
        stripeTransactionId: paymentIntent.id,
        description: `Payment for rental`,
      },
      metadata: {
        platformFee: rental.pricing.platformFee,
        netAmount: -rental.pricing.total,
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Send notifications
    await sendNotification(rental.renterId, {
      type: 'payment',
      title: 'Payment Successful',
      body: 'Your rental payment has been processed successfully',
      data: { rentalId },
    });

    await sendNotification(rental.ownerId, {
      type: 'rental_confirmed',
      title: 'Rental Confirmed',
      body: 'Your item has been successfully rented',
      data: { rentalId },
    });
  } catch (error) {
    console.error('Error handling payment success:', error);
  }
}

async function handlePaymentFailure(paymentIntent: Stripe.PaymentIntent) {
  const rentalId = paymentIntent.metadata.rentalId;
  if (!rentalId) return;

  try {
    await db.collection('rentals').doc(rentalId).update({
      'payment.paymentStatus': 'failed',
      status: 'rejected',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      timeline: admin.firestore.FieldValue.arrayUnion({
        event: 'payment_failed',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        actor: 'system',
        details: { paymentIntentId: paymentIntent.id },
      }),
    });

    const rentalDoc = await db.collection('rentals').doc(rentalId).get();
    const rental = rentalDoc.data()!;

    await sendNotification(rental.renterId, {
      type: 'payment',
      title: 'Payment Failed',
      body: 'Your rental payment could not be processed. Please try again.',
      data: { rentalId },
    });
  } catch (error) {
    console.error('Error handling payment failure:', error);
  }
}

async function handleRentalStatusChange(rentalId: string, oldStatus: string, newStatus: string, rental: any) {
  // Handle various status transitions
  if (oldStatus === 'active' && newStatus === 'completed') {
    // Update user stats
    await Promise.all([
      db.collection('users').doc(rental.ownerId).update({
        'stats.successfulRentals': admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }),
      db.collection('users').doc(rental.renterId).update({
        'stats.successfulRentals': admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }),
    ]);

    // Update item stats
    await db.collection('items').doc(rental.itemId).update({
      'stats.totalRentals': admin.firestore.FieldValue.increment(1),
      'stats.revenue': admin.firestore.FieldValue.increment(rental.pricing.subtotal),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
}

async function completeRentalTransaction(rentalId: string, rental: any) {
  try {
    // Calculate final amounts
    const damageAmount = rental.completion?.damageReported?.amount || 0;
    const depositRefund = rental.pricing.securityDeposit - damageAmount;
    const ownerPayout = rental.pricing.subtotal - rental.pricing.platformFee + damageAmount;

    // Update rental status
    await db.collection('rentals').doc(rentalId).update({
      status: 'completed',
      'completion.completedAt': admin.firestore.FieldValue.serverTimestamp(),
      'dates.actualEnd': admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      timeline: admin.firestore.FieldValue.arrayUnion({
        event: 'rental_completed',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        actor: 'system',
        details: { depositRefund, ownerPayout, damageAmount },
      }),
    });

    // Process payouts and refunds via Stripe
    // This would involve creating transfers to the owner's Stripe Connect account
    // and refunding the appropriate amount to the renter

    // Create wallet transactions
    const transactions = [];

    // Deposit refund to renter
    if (depositRefund > 0) {
      transactions.push(db.collection('wallet_transactions').add({
        userId: rental.renterId,
        type: 'deposit_release',
        amount: depositRefund,
        currency: rental.pricing.currency,
        status: 'completed',
        relatedRentalId: rentalId,
        payment: {
          description: 'Security deposit refund',
        },
        metadata: {
          netAmount: depositRefund,
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
      }));
    }

    // Payout to owner
    transactions.push(db.collection('wallet_transactions').add({
      userId: rental.ownerId,
      type: 'rental_payout',
      amount: ownerPayout,
      currency: rental.pricing.currency,
      status: 'completed',
      relatedRentalId: rentalId,
      payment: {
        description: 'Rental payout',
      },
      metadata: {
        platformFee: rental.pricing.platformFee,
        netAmount: ownerPayout,
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
    }));

    await Promise.all(transactions);

    // Update user wallet balances
    await Promise.all([
      db.collection('users').doc(rental.ownerId).update({
        'wallet.balance': admin.firestore.FieldValue.increment(ownerPayout),
        'wallet.totalEarnings': admin.firestore.FieldValue.increment(ownerPayout),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }),
      // Renter balance would be updated if they had a deposit refund
    ]);

    // Send completion notifications
    await Promise.all([
      sendNotification(rental.ownerId, {
        type: 'rental_completed',
        title: 'Rental Completed',
        body: `You've earned $${ownerPayout} from your rental`,
        data: { rentalId },
      }),
      sendNotification(rental.renterId, {
        type: 'rental_completed',
        title: 'Rental Completed',
        body: depositRefund > 0 ? `Your deposit of $${depositRefund} has been refunded` : 'Rental completed successfully',
        data: { rentalId },
      }),
    ]);
  } catch (error) {
    console.error('Error completing rental transaction:', error);
  }
}
