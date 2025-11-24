import * as admin from 'firebase-admin';
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { setGlobalOptions } from 'firebase-functions/v2';
import express from 'express';
import cors from 'cors';
import { initializeFirebaseAdmin, getFirestore, config } from './config';
import { diditKycService } from './services/diditKyc';
import PaymobFunctionsService from './services/paymob';
import {
  confirmHandoverByRenter,
  confirmHandoverByOwner,
  raiseDispute,
  resolveDispute,
  getWalletBalance,
} from './services/rentalFlow';


const paymob = PaymobFunctionsService.initialize({
  apiKey: config.paymob.apiKey,
  integrationId: config.paymob.integrationId,
  hmacSecret: config.paymob.hmacSecret,
});

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

// Express app for webhook endpoints
const app = express();
app.use(cors({ origin: true }));

/* Paymob webhook handler
   - Verifies HMAC when provided
   - Locates rental by payment.paymobOrderId
   - Marks rental payment status succeeded/failed and updates timeline
   - Creates wallet transaction on success & sends notifications
*/
app.post('/paymob-webhook', express.json(), async (req, res) => {
  try {
    const payload = req.body || {};
    // Try common header names used by Paymob callbacks
    const receivedHmac =
      (req.headers['x-paymob-hmac'] as string) ||
      (req.headers['x-callback-hmac'] as string) ||
      (req.headers['x-paymob-signature'] as string) ||
      (req.headers['x-hmac'] as string) ||
      (payload.hmac as string) ||
      '';

    // If an HMAC was provided, verify it
    if (receivedHmac) {
      const valid = paymob.verifyHMAC(payload, receivedHmac);
      if (!valid) {
        console.error('Paymob webhook: invalid HMAC signature');
        return res.status(401).send('Invalid signature');
      }
    }

    console.log('Received Paymob webhook payload:', JSON.stringify(payload));

    // Paymob webhook payload structure: { type: "TRANSACTION", obj: { ...transactionData... } }
    const tx = payload.obj || payload.transaction || payload || {};
    const orderId = tx.order?.id || tx.order;

    if (!orderId) {
      console.warn('Paymob webhook: missing order id in payload');
      return res.status(400).send('Missing order id');
    }

    // Find the rental that references this Paymob order id
    const rentalsSnap = await db.collection('rentals').where('payment.paymobOrderId', '==', orderId).limit(1).get();

    if (rentalsSnap.empty) {
      console.warn('Paymob webhook: no rental found for order', orderId);
      return res.json({ received: true });
    }

    const rentalDoc = rentalsSnap.docs[0];
    const rentalRef = rentalDoc.ref;
    const rental = rentalDoc.data() as any;

    // Normalize transaction fields
    const transactionId = tx.id || tx.transaction_id || tx._id;
    const success = !!tx.success;
    const pending = !!tx.pending;

    if (success && !pending) {
      // Payment succeeded
      // CRITICAL BUG: If ownerId == renterId, they're renting their own item!
      const isSelfRent = rental.ownerId === rental.renterId;
      console.log('PAYMENT SUCCESS: Processing successful payment', {
        rentalId: rentalRef.id,
        paymobOrderId: orderId,
        transactionId,
        ownerId: rental.ownerId,
        renterId: rental.renterId,
        isSelfRent,
        ISSUE_FOUND: isSelfRent ? 'OWNER AND RENTER ARE THE SAME PERSON - SELF-RENTAL!' : 'OWNER AND RENTER ARE DIFFERENT - CORRECT',
        ACTION: isSelfRent ? 'Wallet will correctly credit the renter (who is also owner)' : 'Wallet will credit the owner'
      });

      if (isSelfRent) {
        console.log('⚠️ SELF-RENTAL DETECTED: User rented their own item. Wallet credit is correct.');
      }

      await rentalRef.update({
        'payment.paymentStatus': 'succeeded',
        status: 'awaiting_handover', // ← Changed from 'active'
        'handover.renterConfirmed': false,
        'handover.ownerConfirmed': false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        timeline: admin.firestore.FieldValue.arrayUnion({
          event: 'payment_completed',
          timestamp: admin.firestore.Timestamp.now(),
          actor: 'system',
          details: { paymobTransactionId: transactionId, orderId },
        }),
      });

      // Create wallet transactions: renter payment (negative) + owner credit
      try {
        const batch = db.batch();

        // Renter transaction (debit)
        const renterTxRef = db.collection('wallet_transactions').doc();
        batch.set(renterTxRef, {
          userId: rental.renterId,
          type: 'rental_payment',
          amount: -rental.pricing.total,
          currency: rental.pricing.currency,
          status: 'completed',
          relatedRentalId: rentalRef.id,
          relatedItemId: rental.itemId,
          payment: {
            paymobTransactionId: transactionId,
            description: 'Payment for rental',
          },
          metadata: {
            platformFee: rental.pricing.platformFee,
            netAmount: -rental.pricing.total,
          },
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Owner transaction (credit to wallet but PENDING until rental completes)
        const ownerTxRef = db.collection('wallet_transactions').doc();
        const ownerAmount = (rental.pricing.subtotal || 0) - (rental.pricing.platformFee || 0);
        batch.set(ownerTxRef, {
          userId: rental.ownerId,
          type: 'rental_income',
          amount: ownerAmount,
          currency: rental.pricing.currency,
          status: 'completed',
          availabilityStatus: 'PENDING', // ← Added: Funds held in escrow
          relatedRentalId: rentalRef.id,
          relatedItemId: rental.itemId,
          payment: {
            paymobTransactionId: transactionId,
            description: 'Rental income (held in escrow until completion)',
          },
          metadata: {
            platformFee: rental.pricing.platformFee,
            netAmount: ownerAmount,
          },
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        await batch.commit();

        // CHECK BEFORE UPDATING - LOG OLD BALANCES
        console.log('💰 WALLET BALANCE CHECK BEFORE PAYMENT PROCESSING:');

        const [ownerBeforeDoc, renterBeforeDoc] = await Promise.all([
          db.collection('users').doc(rental.ownerId).get(),
          db.collection('users').doc(rental.renterId).get()
        ]);

        const ownerBeforeBalance = ownerBeforeDoc.data()?.wallet?.balance || 0;
        const renterBeforeBalance = renterBeforeDoc.data()?.wallet?.balance || 0;

        console.log('BALANCE BEFORE PAYMENT:', {
          ownerId: rental.ownerId,
          ownerBalanceBefore: ownerBeforeBalance,
          renterId: rental.renterId,
          renterBalanceBefore: renterBeforeBalance,
          amountToCreditOwner: ownerAmount
        });

        // DOUBLE-CHECK WE'RE NOT CREDITING THE WRONG PERSON
        if (rental.ownerId === rental.renterId) {
          console.log('🤯 ERROR: ownerId equals renterId - this should not happen!');
          console.log('Both owner and renter are the same user:', rental.ownerId);
        } else {
          console.log('✅ GOOD: Owner and renter are different users');
        }

        console.log('🚀 ATTEMPTING TO CREDIT OWNER WALLET:', {
          updatingUserId: rental.ownerId,
          addingAmount: ownerAmount,
          rentalId: rentalRef.id,
        });

        // Update owner wallet balance (credit). Admin handles withdrawals later.
        await db.collection('users').doc(rental.ownerId).update({
          'wallet.balance': admin.firestore.FieldValue.increment(ownerAmount),
          'wallet.totalEarnings': admin.firestore.FieldValue.increment(ownerAmount),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // VERIFY the wallet balance was updated (debug)
        const ownerDocAfter = await db.collection('users').doc(rental.ownerId).get();
        const ownerDataAfter = ownerDocAfter.data();

        console.log('✅ OWNER WALLET SHOULD BE UPDATED:', {
          ownerId: rental.ownerId,
          balanceBefore: ownerBeforeBalance,
          balanceAfterExpected: ownerBeforeBalance + ownerAmount,
          balanceAfterActual: ownerDataAfter?.wallet?.balance,
          earningsAfter: ownerDataAfter?.wallet?.totalEarnings,
        });

        // CRITICAL: Also check RENTER balance again to ensure it wasn't incorrectly modified
        const renterDocAfterFinal = await db.collection('users').doc(rental.renterId).get();
        const renterBalanceAfterFinal = renterDocAfterFinal.data()?.wallet?.balance || 0;

        console.log('🚨 FINAL RENTER WALLET CHECK (should not have changed):', {
          renterId: rental.renterId,
          renterBalanceBefore: renterBeforeBalance,
          renterBalanceAfter: renterBalanceAfterFinal,
          renterBalanceChange: renterBalanceAfterFinal - renterBeforeBalance,
          PROBLEM_DETECTED: renterBalanceAfterFinal !== renterBeforeBalance,
          balanceDifference: renterBalanceAfterFinal - renterBeforeBalance
        });

        // Check if there are any other wallet updates happening concurrently
        if (renterBalanceAfterFinal !== renterBeforeBalance) {
          console.error('🚨 CRITICAL BUG: Renter balance changed when it should not have!');
          console.log('This indicates there is another process incorrectly crediting the renter');

          // Try to find the transaction that caused this
          const recentRenterTransactions = await db.collection('wallet_transactions')
            .where('userId', '==', rental.renterId)
            .orderBy('createdAt', 'desc')
            .limit(5)
            .get();

          console.log('Recent renter transactions (investigating the unexpected balance change):',
            recentRenterTransactions.docs.map(doc => ({
              id: doc.id,
              type: doc.data().type,
              amount: doc.data().amount,
              createdAt: doc.data().createdAt
            }))
          );
        }

        // CHECK RENTER BALANCE DIDN'T CHANGE INCORRECTLY
        const renterAfterDoc = await db.collection('users').doc(rental.renterId).get();
        const renterAfterBalance = renterAfterDoc.data()?.wallet?.balance || 0;

        console.log('🔍 RENTER WALLET VERIFICATION (should be unchanged):', {
          renterId: rental.renterId,
          balanceBefore: renterBeforeBalance,
          balanceAfter: renterAfterBalance,
          balanceChange: renterAfterBalance - renterBeforeBalance,
          shouldBeZero: renterAfterBalance === renterBeforeBalance
        });
      } catch (err) {
        console.error('Error creating wallet transactions after Paymob success:', err);
      }

      // Send notifications about handover confirmation
      await sendNotification(rental.renterId, {
        type: 'payment',
        title: 'Payment Successful',
        body: 'Please confirm item handover to activate the rental',
        data: { rentalId: rentalRef.id, orderId },
      });

      await sendNotification(rental.ownerId, {
        type: 'rental_confirmed',
        title: 'Rental Payment Received',
        body: 'Please confirm item handover to activate the rental',
        data: { rentalId: rentalRef.id, orderId },
      });
    } else if (!success && !pending) {
      // Payment failed (final)
      await rentalRef.update({
        'payment.paymentStatus': 'failed',
        status: 'rejected',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        timeline: admin.firestore.FieldValue.arrayUnion({
          event: 'payment_failed',
          timestamp: admin.firestore.Timestamp.now(),
          actor: 'system',
          details: { paymobTransactionId: transactionId, orderId },
        }),
      });

      await sendNotification(rental.renterId, {
        type: 'payment',
        title: 'Payment Failed',
        body: 'Your rental payment could not be processed. Please try again.',
        data: { rentalId: rentalRef.id, orderId },
      });
    } else {
      // Pending or intermediate state — optionally log and return OK
      console.log('Paymob webhook: transaction pending or intermediate state', { orderId, transactionId, pending, success });
    }

    return res.json({ received: true });
  } catch (error) {
    console.error('Error handling Paymob webhook:', error);
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
        timestamp: admin.firestore.Timestamp.now(),
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
  console.log('=== PROCESS RENTAL RESPONSE STARTED ===');
  console.log('Function version with debug logging');

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
        timestamp: admin.firestore.Timestamp.now(),
        actor: auth.uid,
        ...(message ? { details: { message } } : {}),
      }),
    };

    if (action === 'approve') {
      updateData['dates.confirmedStart'] = rental.dates.requestedStart;
      updateData['dates.confirmedEnd'] = rental.dates.requestedEnd;

      // Validate rental pricing data
      if (!rental.pricing || !rental.pricing.total) {
        console.error('Invalid rental pricing data:', rental.pricing);
        throw new HttpsError('failed-precondition', 'Rental pricing data is invalid');
      }

      // Ensure currency is always EGP (fix for existing rentals with invalid currency)
      const currency = 'EGP';

      // Debug: Log environment variables
      console.log('Environment variables check:');
      console.log('PAYMOB_API_KEY:', process.env.PAYMOB_API_KEY ? 'SET' : 'NOT SET');
      console.log('PAYMOB_INTEGRATION_ID:', process.env.PAYMOB_INTEGRATION_ID ? 'SET' : 'NOT SET');
      console.log('PAYMOB_HMAC_SECRET:', process.env.PAYMOB_HMAC_SECRET ? 'SET' : 'NOT SET');

      // Create Paymob order and payment key
      try {
        console.log('Creating Paymob payment for rental:', rentalId, 'amount:', rental.pricing.total, 'currency:', currency);

        // Fetch renter details for billing info
        const renterDoc = await db.collection('users').doc(rental.renterId).get();
        const renter = renterDoc.exists ? renterDoc.data() : null;

        console.log('Renter data fetched:', renter ? 'exists' : 'not found');

        const order = await paymob.createOrder({
          amount: rental.pricing.total,
          currency: currency,
          merchantOrderId: `${rentalId}_${Date.now()}`,
        });

        console.log('Paymob order created:', order.orderId);

        const paymentKeyResult = await paymob.createPaymentKey({
          amount: rental.pricing.total,
          currency: currency,
          orderId: order.orderId,
          billingData: {
            email: (renter && (renter as any).email) || 'customer@example.com',
            first_name: (renter && (renter as any).displayName) || 'Guest',
            last_name: (renter && (renter as any).lastName) || '',
            phone_number: (renter && (renter as any).phoneNumber) || '+201000000000',
            city: (renter && (renter as any).location?.city) || 'Cairo',
            country: (renter && (renter as any).location?.country) || 'EG',
          },
        });

        console.log('Paymob payment key created');

        updateData['payment.paymobOrderId'] = order.orderId;
        updateData['payment.paymobPaymentKey'] = paymentKeyResult.paymentKey;
        updateData['payment.paymentStatus'] = 'pending';
      } catch (err) {
        console.error('Paymob payment creation failed:', err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        throw new HttpsError('internal', `Failed to create payment: ${errorMessage}`);
      }
    }

    await rentalRef.update(updateData);

    // Send notification to renter with payment link
    const notificationType = action === 'approve' ? 'rental_payment_required' : 'rental_rejected';
    const notificationTitle = action === 'approve' ? 'Rental Approved!' : 'Rental Declined';
    const notificationBody = action === 'approve' 
      ? 'Your rental request has been approved. Tap to complete payment.'
      : 'Your rental request has been declined.';

    await sendNotification(rental.renterId, {
      type: notificationType,
      title: notificationTitle,
      body: notificationBody,
      data: {
        rentalId,
        itemId: rental.itemId,
        deepLink: action === 'approve' ? `rentat://rental-payment/${rentalId}` : undefined,
        action: action === 'approve' ? 'pay_now' : undefined,
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

    return { success: true, paymentClientSecret: action === 'approve' ? updateData['payment.paymobPaymentKey'] : null };
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
        timestamp: admin.firestore.Timestamp.now(),
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

    console.log('Message created and notifications sent successfully');

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
  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  const days = Math.ceil((endDate.getTime() - startDate.getTime()) / millisecondsPerDay);
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
  
  // Ensure currency is always set to EGP (default for Egyptian market)
  const currency = item.pricing.currency === 'EGP' ? 'EGP' : 'EGP';
  
  return {
    dailyRate,
    totalDays: days,
    subtotal,
    platformFee,
    securityDeposit,
    deliveryFee,
    total,
    currency,
  };
}

async function sendNotification(userId: string, notification: any) {
  try {
    console.log('📤 Sending notification to user:', userId, 'type:', notification.type);

    // Get user's FCM tokens
    const userDoc = await db.collection('users').doc(userId).get();
    const user = userDoc.data();

    console.log('👤 User FCM tokens:', user?.fcmTokens?.length || 0);

    if (!user?.fcmTokens?.length) {
      console.warn('⚠️ No FCM tokens found for user:', userId);
      return;
    }

    // Create notification document
    const notificationRef = await db.collection('notifications').add({
      userId,
      ...notification,
      status: 'unread',
      delivery: {
        push: { sent: false },
      },
      priority: 'normal',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('✅ In-app notification created:', notificationRef.id);

    // Send push notification
    const message = {
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: {
        ...notification.data,
        notificationId: notificationRef.id,
      },
      tokens: user.fcmTokens,
    };

    console.log('📱 Sending push notification to', user.fcmTokens.length, 'tokens');

    const response = await admin.messaging().sendMulticast(message);
    console.log('📱 Push notification result:', {
      success: response.successCount,
      failure: response.failureCount,
    });

    // Update notification delivery status
    await notificationRef.update({
      'delivery.push.sent': true,
      'delivery.push.sentAt': admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

  } catch (error) {
    console.error('❌ Error sending notification:', error);
  }
}

/* Stripe payment handlers removed — payments now use Paymob.
   Server-side Paymob webhook handlers / post-payment processing can be
   implemented here if you need to mark payments succeeded/failed from Paymob webhooks.
*/

// Confirm item received by renter
export const confirmItemReceived = onCall(async (request) => {
  const { auth, data } = request;
  
  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { rentalId } = data;

  try {
    const rentalRef = db.collection('rentals').doc(rentalId);
    const rentalDoc = await rentalRef.get();
    
    if (!rentalDoc.exists) {
      throw new HttpsError('not-found', 'Rental not found');
    }

    const rental = rentalDoc.data()!;
    
    // Verify user is the renter
    if (rental.renterId !== auth.uid) {
      throw new HttpsError('permission-denied', 'Only the renter can confirm item received');
    }

    // Verify rental is active
    if (rental.status !== 'active') {
      throw new HttpsError('failed-precondition', 'Rental must be active');
    }

    // Check if already confirmed
    if (rental.completion?.itemReceived?.confirmed) {
      throw new HttpsError('already-exists', 'Item receipt already confirmed');
    }

    // Update rental with item received confirmation
    await rentalRef.update({
      'completion.itemReceived': {
        confirmed: true,
        confirmedAt: admin.firestore.FieldValue.serverTimestamp(),
        confirmedBy: auth.uid,
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      timeline: admin.firestore.FieldValue.arrayUnion({
        event: 'item_received',
        timestamp: admin.firestore.Timestamp.now(),
        actor: auth.uid,
        details: { message: 'Renter confirmed item received' },
      }),
    });

    // Send notification to owner
    await sendNotification(rental.ownerId, {
      type: 'rental_update',
      title: 'Item Picked Up',
      body: 'The renter has confirmed receiving the item',
      data: { rentalId, itemId: rental.itemId },
    });

    return { success: true };
  } catch (error) {
    console.error('Error confirming item received:', error);
    throw error instanceof HttpsError ? error : new HttpsError('internal', 'Failed to confirm item received');
  }
});

// Confirm item returned by owner with optional damage report
export const confirmItemReturned = onCall(async (request) => {
  const { auth, data } = request;
  
  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { rentalId, damageReport } = data;

  try {
    const rentalRef = db.collection('rentals').doc(rentalId);
    const rentalDoc = await rentalRef.get();
    
    if (!rentalDoc.exists) {
      throw new HttpsError('not-found', 'Rental not found');
    }

    const rental = rentalDoc.data()!;
    
    // Verify user is the owner
    if (rental.ownerId !== auth.uid) {
      throw new HttpsError('permission-denied', 'Only the owner can confirm item returned');
    }

    // Verify rental is active
    if (rental.status !== 'active') {
      throw new HttpsError('failed-precondition', 'Rental must be active');
    }

    // Check if already confirmed
    if (rental.completion?.itemReturned?.ownerConfirmed) {
      throw new HttpsError('already-exists', 'Item return already confirmed');
    }

    const updateData: any = {
      'completion.itemReturned.ownerConfirmed': true,
      'completion.itemReturned.ownerConfirmedAt': admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      timeline: admin.firestore.FieldValue.arrayUnion({
        event: 'item_returned_confirmed',
        timestamp: admin.firestore.Timestamp.now(),
        actor: auth.uid,
        details: damageReport ? { damageReport } : { message: 'Owner confirmed item returned in good condition' },
      }),
    };

    // Add damage report if provided
    if (damageReport) {
      updateData['completion.itemReturned.damageReport'] = {
        hasDamage: damageReport.hasDamage,
        description: damageReport.description || '',
        images: damageReport.images || [],
        deductionAmount: damageReport.deductionAmount || 0,
        reportedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
    }

    await rentalRef.update(updateData);

    // Process rental completion
    await processRentalCompletion({ rentalId });

    // Send notification to renter
    const notificationBody = damageReport?.hasDamage
      ? `Item returned with damage. Deposit deduction: ${rental.pricing.currency} ${damageReport.deductionAmount}`
      : 'Item returned successfully. Your deposit will be refunded.';

    await sendNotification(rental.renterId, {
      type: 'rental_update',
      title: 'Item Return Confirmed',
      body: notificationBody,
      data: { rentalId, itemId: rental.itemId, hasDamage: damageReport?.hasDamage || false },
    });

    return { success: true };
  } catch (error) {
    console.error('Error confirming item returned:', error);
    throw error instanceof HttpsError ? error : new HttpsError('internal', 'Failed to confirm item returned');
  }
});

// Process rental completion - calculate and process refunds/payouts
async function processRentalCompletion(data: { rentalId: string }) {
  const { rentalId } = data;

  try {
    const rentalRef = db.collection('rentals').doc(rentalId);
    const rentalDoc = await rentalRef.get();
    
    if (!rentalDoc.exists) {
      throw new Error('Rental not found');
    }

    const rental = rentalDoc.data()!;

    // Calculate amounts
    const damageDeduction = rental.completion?.itemReturned?.damageReport?.deductionAmount || 0;
    const depositRefund = Math.max(0, rental.pricing.securityDeposit - damageDeduction);
    const ownerPayout = rental.pricing.subtotal - rental.pricing.platformFee + damageDeduction;

    // Update rental with completion details
    await rentalRef.update({
      status: 'completed',
      'completion.completedAt': admin.firestore.FieldValue.serverTimestamp(),
      'completion.refund': {
        status: 'processed',
        amount: depositRefund,
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      'completion.payout': {
        status: 'processed',
        amount: ownerPayout,
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      'dates.actualEnd': admin.firestore.FieldValue.serverTimestamp(),
      'payment.depositStatus': 'refunded',
      'payment.payoutStatus': 'completed',
      'payment.refundAmount': depositRefund,
      'payment.escrow': {
        totalHeld: rental.pricing.total,
        depositAmount: rental.pricing.securityDeposit,
        ownerPayout,
        platformFee: rental.pricing.platformFee,
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      timeline: admin.firestore.FieldValue.arrayUnion({
        event: 'rental_completed',
        timestamp: admin.firestore.Timestamp.now(),
        actor: 'system',
        details: { depositRefund, ownerPayout, damageDeduction },
      }),
    });

    // Find and update the original rental_income transaction from PENDING to AVAILABLE
    const incomeTransactionsSnap = await db.collection('wallet_transactions')
      .where('relatedRentalId', '==', rentalId)
      .where('type', '==', 'rental_income')
      .where('userId', '==', rental.ownerId)
      .get();

    // Create wallet transactions
    const batch = db.batch();

    // Update the original PENDING transaction to AVAILABLE
    incomeTransactionsSnap.forEach((doc) => {
      batch.update(doc.ref, {
        availabilityStatus: 'AVAILABLE',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    // Deposit refund transaction for renter (if any)
    if (depositRefund > 0) {
      const renterTxRef = db.collection('wallet_transactions').doc();
      batch.set(renterTxRef, {
        userId: rental.renterId,
        type: 'deposit_refund',
        amount: depositRefund,
        currency: rental.pricing.currency,
        status: 'completed',
        availabilityStatus: 'AVAILABLE',
        relatedRentalId: rentalId,
        relatedItemId: rental.itemId,
        payment: {
          description: `Security deposit refund${damageDeduction > 0 ? ` (${rental.pricing.currency} ${damageDeduction} deducted for damages)` : ''}`,
        },
        metadata: {
          originalDeposit: rental.pricing.securityDeposit,
          damageDeduction,
          netAmount: depositRefund,
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();

    // Note: Wallet balances were already updated when payment was received
    // The availabilityStatus change from PENDING to AVAILABLE doesn't change the balance
    // Deposit refunds would typically go back to the original payment method

    // Send completion notifications
    await Promise.all([
      sendNotification(rental.ownerId, {
        type: 'rental_completed',
        title: 'Rental Completed',
        body: `You've earned ${rental.pricing.currency} ${ownerPayout.toFixed(2)} (credited to your wallet)`,
        data: { rentalId, itemId: rental.itemId },
      }),
      sendNotification(rental.renterId, {
        type: 'rental_completed',
        title: 'Rental Completed',
        body: depositRefund > 0 
          ? `Your deposit of ${rental.pricing.currency} ${depositRefund.toFixed(2)} will be refunded` 
          : 'Rental completed successfully',
        data: { rentalId, itemId: rental.itemId },
      }),
    ]);

    console.log(`Rental ${rentalId} completed successfully. Owner payout: ${ownerPayout}, Deposit refund: ${depositRefund}`);
  } catch (error) {
    console.error('Error processing rental completion:', error);
    throw error;
  }
}

// Refresh payment key for rental - creates fresh payment session
export const refreshPaymentKey = onCall(async (request) => {
  const { auth, data } = request;

  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { rentalId } = data;

  try {
    const rentalRef = db.collection('rentals').doc(rentalId);
    const rentalDoc = await rentalRef.get();

    if (!rentalDoc.exists) {
      throw new HttpsError('not-found', 'Rental not found');
    }

    const rental = rentalDoc.data()!;

    // Verify user is the renter
    if (rental.renterId !== auth.uid) {
      throw new HttpsError('permission-denied', 'Only the renter can refresh payment keys');
    }

    // Verify rental is in approved status and payment is pending or failed, or rejected with failed payment
    if (rental.status !== 'approved' && rental.status !== 'declined' && rental.status !== 'rejected') {
      throw new HttpsError('failed-precondition', 'Rental must be approved, declined, or rejected for retry');
    }

    // Check payment status - allow both pending (first attempt) and failed (retry)
    if (rental.payment?.paymentStatus !== 'pending' && rental.payment?.paymentStatus !== 'failed') {
      throw new HttpsError('failed-precondition', 'Payment must be in pending or failed status');
    }

    const renterDoc = await db.collection('users').doc(rental.renterId).get();
    const renter = renterDoc.exists ? renterDoc.data() : null;

    console.log('Renter data fetched:', renter ? 'exists' : 'not found');

    // Create new Paymob order and payment key
    const order = await paymob.createOrder({
      amount: rental.pricing.total,
      currency: rental.pricing.currency,
      merchantOrderId: `${rentalId}_${Date.now()}`,
    });

    console.log('Paymob order created:', order.orderId);

    const paymentKeyResult = await paymob.createPaymentKey({
      amount: rental.pricing.total,
      currency: rental.pricing.currency,
      orderId: order.orderId,
      billingData: {
        email: (renter && (renter as any).email) || 'customer@example.com',
        first_name: (renter && (renter as any).displayName) || 'Guest',
        last_name: (renter && (renter as any).lastName) || '',
        phone_number: (renter && (renter as any).phoneNumber) || '+201000000000',
        city: (renter && (renter as any).location?.city) || 'Cairo',
        country: (renter && (renter as any).location?.country) || 'EG',
      },
    });

    console.log('Paymob payment key created');

    // Update rental with new payment key and orderId
    await rentalRef.update({
      'payment.paymobOrderId': order.orderId,
      'payment.paymobPaymentKey': paymentKeyResult.paymentKey,
      'payment.paymentStatus': 'pending',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('Rental updated with new payment details');

    return {
      success: true,
      paymentKey: paymentKeyResult.paymentKey,
      orderId: order.orderId,
    };
  } catch (error) {
    console.error('Error refreshing payment key:', error);
    throw error instanceof HttpsError ? error : new HttpsError('internal', 'Failed to refresh payment key');
  }
});

// Request payout - Owner requests withdrawal from wallet
export const requestPayout = onCall(async (request) => {
  const { auth, data } = request;

  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { amount, method } = data; // method: 'bank_transfer' | 'mobile_wallet'

  try {
    // Get user wallet
    const userRef = db.collection('users').doc(auth.uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      throw new HttpsError('not-found', 'User not found');
    }

    const user = userDoc.data()!;
    const wallet = user.wallet || { balance: 0 };

    // Validate withdrawal amount
    if (!amount || amount <= 0) {
      throw new HttpsError('invalid-argument', 'Invalid withdrawal amount');
    }

    if (amount > wallet.balance) {
      throw new HttpsError('failed-precondition', 'Insufficient wallet balance');
    }

    // Create payout request
    const payoutRef = await db.collection('payout_requests').add({
      userId: auth.uid,
      amount,
      currency: 'EGP', // Default currency
      method,
      status: 'pending',
      requestedAt: admin.firestore.FieldValue.serverTimestamp(),
      metadata: {
        userName: user.displayName,
        userEmail: user.email,
        walletBalanceBefore: wallet.balance,
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Update user wallet - reserve the amount
    await userRef.update({
      'wallet.balance': admin.firestore.FieldValue.increment(-amount),
      'wallet.pendingWithdrawal': admin.firestore.FieldValue.increment(amount),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Create wallet transaction
    await db.collection('wallet_transactions').add({
      userId: auth.uid,
      type: 'withdrawal_request',
      amount: -amount,
      currency: 'EGP',
      status: 'pending',
      payment: {
        description: `Withdrawal request - ${method}`,
      },
      metadata: {
        payoutRequestId: payoutRef.id,
        method,
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Send notification to user
    await sendNotification(auth.uid, {
      type: 'payout',
      title: 'Withdrawal Request Submitted',
      body: `Your withdrawal request for EGP ${amount} is being processed`,
      data: { payoutRequestId: payoutRef.id },
    });

    return {
      success: true,
      payoutRequestId: payoutRef.id,
      estimatedProcessingTime: '1-3 business days',
    };
  } catch (error) {
    console.error('Error requesting payout:', error);
    throw error instanceof HttpsError ? error : new HttpsError('internal', 'Failed to request payout');
  }
});

// Callable to mark all notifications as read for the authenticated user
export const markAllNotificationsRead = onCall(async (request) => {
  const { auth } = request;
  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  try {
    const userId = auth.uid;
    const notifsSnap = await db.collection('notifications')
      .where('userId', '==', userId)
      .where('status', '==', 'unread')
      .get();

    if (notifsSnap.empty) {
      return { updated: 0 };
    }

    const commits: Promise<any>[] = [];
    let batch = db.batch();
    let ops = 0;
    let total = 0;

    notifsSnap.docs.forEach((doc) => {
      batch.update(doc.ref, {
        status: 'read',
        readAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      ops++;
      total++;
      if (ops === 500) {
        commits.push(batch.commit());
        batch = db.batch();
        ops = 0;
      }
    });

    if (ops > 0) commits.push(batch.commit());
    await Promise.all(commits);

    return { updated: total };
  } catch (error) {
    console.error('Error marking all notifications read:', error);
    throw new HttpsError('internal', 'Failed to mark notifications as read');
  }
});

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
        timestamp: admin.firestore.Timestamp.now(),
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

// ==================== NEW RENTAL FLOW FUNCTIONS ====================

// Phase 3: Handover confirmation endpoints
export const confirmHandoverRenter = onCall(async (request) => {
  const { auth, data } = request;
  
  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { rentalId } = data;

  try {
    const result = await confirmHandoverByRenter(rentalId, auth.uid);
    
    // Send notification to owner
    const rentalDoc = await db.collection('rentals').doc(rentalId).get();
    const rental = rentalDoc.data()!;
    
    await sendNotification(rental.ownerId, {
      type: 'rental_update',
      title: 'Handover Confirmed',
      body: result.bothConfirmed
        ? 'Both parties confirmed - rental is now active!'
        : 'Renter confirmed receiving the item',
      data: { rentalId, itemId: rental.itemId },
    });

    return result;
  } catch (error) {
    console.error('Error confirming handover by renter:', error);
    throw error instanceof HttpsError ? error : new HttpsError('internal', 'Failed to confirm handover');
  }
});

export const confirmHandoverOwner = onCall(async (request) => {
  const { auth, data } = request;
  
  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { rentalId } = data;

  try {
    const result = await confirmHandoverByOwner(rentalId, auth.uid);
    
    // Send notification to renter
    const rentalDoc = await db.collection('rentals').doc(rentalId).get();
    const rental = rentalDoc.data()!;
    
    await sendNotification(rental.renterId, {
      type: 'rental_update',
      title: 'Handover Confirmed',
      body: result.bothConfirmed
        ? 'Both parties confirmed - rental is now active!'
        : 'Owner confirmed handing over the item',
      data: { rentalId, itemId: rental.itemId },
    });

    return result;
  } catch (error) {
    console.error('Error confirming handover by owner:', error);
    throw error instanceof HttpsError ? error : new HttpsError('internal', 'Failed to confirm handover');
  }
});

// Phase 4: Dispute management endpoints
export const createDispute = onCall(async (request) => {
  const { auth, data } = request;
  
  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { rentalId, reason, evidence } = data;

  try {
    return await raiseDispute(rentalId, auth.uid, reason, evidence || []);
  } catch (error) {
    console.error('Error raising dispute:', error);
    throw error instanceof HttpsError ? error : new HttpsError('internal', 'Failed to raise dispute');
  }
});

export const resolveDisputeFunction = onCall(async (request) => {
  const { auth, data } = request;
  
  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { rentalId, decision, refundAmount, ownerCompensation } = data;

  try {
    // Verify user has moderator role
    const userDoc = await db.collection('users').doc(auth.uid).get();
    const user = userDoc.data();
    
    if (!user?.isModerator && !user?.isAdmin) {
      throw new HttpsError('permission-denied', 'Only moderators can resolve disputes');
    }

    return await resolveDispute(
      rentalId,
      auth.uid,
      decision,
      refundAmount || 0,
      ownerCompensation || 0
    );
  } catch (error) {
    console.error('Error resolving dispute:', error);
    throw error instanceof HttpsError ? error : new HttpsError('internal', 'Failed to resolve dispute');
  }
});

// Phase 5: Wallet balance endpoint
export const getWalletBalanceFunction = onCall(async (request) => {
  const { auth, data } = request;
  
  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const userId = data?.userId || auth.uid;

  // Users can only view their own wallet unless they're admin
  if (userId !== auth.uid) {
    const userDoc = await db.collection('users').doc(auth.uid).get();
    const user = userDoc.data();
    
    if (!user?.isAdmin) {
      throw new HttpsError('permission-denied', 'Cannot view other users wallets');
    }
  }

  try {
    return await getWalletBalance(userId);
  } catch (error) {
    console.error('Error getting wallet balance:', error);
    throw new HttpsError('internal', 'Failed to get wallet balance');
  }
});
