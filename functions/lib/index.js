"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.onRentalUpdated = exports.onRentalCreated = exports.completeRental = exports.processRentalResponse = exports.processRentalRequest = exports.webhooks = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-functions/v2/firestore");
const v2_1 = require("firebase-functions/v2");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const stripe_1 = __importDefault(require("stripe"));
const config_1 = require("./config");
const diditKyc_1 = require("./services/diditKyc");
// Didit API Configuration
const DIDIT_API_BASE_URL = 'https://verification.didit.me/v2';
const DIDIT_API_KEY = config_1.config.didit.apiKey;
// Initialize Firebase Admin
(0, config_1.initializeFirebaseAdmin)();
// Set global options
(0, v2_1.setGlobalOptions)({
    region: 'us-central1',
    maxInstances: 10,
});
// Initialize services
const db = (0, config_1.getFirestore)();
const stripe = new stripe_1.default(config_1.config.stripe.secretKey, {
    apiVersion: '2023-10-16',
});
// Express app for webhook endpoints
const app = (0, express_1.default)();
app.use((0, cors_1.default)({ origin: true }));
// Stripe webhook endpoint
app.post('/stripe-webhook', express_1.default.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = config_1.config.stripe.webhookSecret;
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    }
    catch (err) {
        console.log(`Webhook signature verification failed.`, err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    try {
        await handleStripeWebhook(event);
        return res.json({ received: true });
    }
    catch (error) {
        console.error('Error handling webhook:', error);
        return res.status(500).send('Webhook handler failed');
    }
});
// Didit KYC webhook endpoint
app.post('/didit-webhook', express_1.default.raw({ type: 'application/json' }), async (req, res) => {
    try {
        const rawBody = req.body;
        const signature = req.headers['x-didit-signature'];
        // Verify webhook signature for security
        if (signature && config_1.config.didit.webhookSecret) {
            const crypto = require('crypto');
            const expectedSignature = crypto
                .createHmac('sha256', config_1.config.didit.webhookSecret)
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
            }
            else if (typeof rawBody === 'string') {
                payload = JSON.parse(rawBody);
            }
            else {
                // Already parsed object
                payload = rawBody;
            }
        }
        catch (parseError) {
            console.error('Failed to parse webhook payload:', parseError);
            return res.status(400).send('Invalid JSON payload');
        }
        console.log('Received Didit webhook:', payload);
        // Basic validation
        if (!payload.event_type || !payload.session_id) {
            return res.status(400).send('Invalid webhook payload');
        }
        await diditKyc_1.diditKycService.handleWebhook(payload);
        return res.json({ success: true });
    }
    catch (error) {
        console.error('Error handling Didit webhook:', error);
        return res.status(500).send('Webhook handler failed');
    }
});
// Didit KYC session creation endpoint
app.post('/create-kyc-session', express_1.default.json(), async (req, res) => {
    try {
        const { userId, workflowId } = req.body;
        if (!userId) {
            return res.status(400).send('User ID is required');
        }
        console.log(`Creating KYC session for user ${userId}`);
        // Create session via Didit API
        const response = await fetch(`${DIDIT_API_BASE_URL}/session/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': DIDIT_API_KEY,
            },
            body: JSON.stringify({
                workflow_id: workflowId || config_1.config.didit.workflowId,
                vendor_data: userId,
                callback: `${config_1.config.didit.callbackUrl}?userId=${userId}`,
                metadata: {
                    platform: 'rentat',
                    user_id: userId,
                    created_at: new Date().toISOString(),
                },
                language: 'en',
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
        const updateData = {
            'diditKyc.sessionId': data.session_id,
            'diditKyc.status': 'not_started',
            'diditKyc.workflowId': workflowId || config_1.config.didit.workflowId,
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
        }
        else {
            updateData['diditKyc.expiresAt'] = admin.firestore.Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000);
        }
        await userRef.update(updateData);
        return res.json({
            sessionId: data.session_id,
            verificationUrl: sessionDetails.url,
            qrCode: sessionDetails.qr_code,
            expiresAt: sessionDetails.expires_at,
        });
    }
    catch (error) {
        console.error('Error creating KYC session:', error);
        return res.status(500).send('Failed to create KYC session');
    }
});
// Export the webhook handler
exports.webhooks = (0, https_1.onRequest)(app);
// Rental request validation and processing
exports.processRentalRequest = (0, https_1.onCall)(async (request) => {
    var _a;
    const { auth, data } = request;
    if (!auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { itemId, startDate, endDate, deliveryMethod, deliveryLocation, message } = data;
    try {
        // Validate input
        if (!itemId || !startDate || !endDate) {
            throw new https_1.HttpsError('invalid-argument', 'Missing required fields');
        }
        // Get item details
        const itemDoc = await db.collection('items').doc(itemId).get();
        if (!itemDoc.exists) {
            throw new https_1.HttpsError('not-found', 'Item not found');
        }
        const item = itemDoc.data();
        // Check if user is trying to rent their own item
        if (item.ownerId === auth.uid) {
            throw new https_1.HttpsError('permission-denied', 'Cannot rent your own item');
        }
        // Verify user is verified
        const userDoc = await db.collection('users').doc(auth.uid).get();
        const user = userDoc.data();
        if (!((_a = user.verification) === null || _a === void 0 ? void 0 : _a.isVerified)) {
            throw new https_1.HttpsError('permission-denied', 'User must be verified to make rental requests');
        }
        // Check item availability
        const start = new Date(startDate);
        const end = new Date(endDate);
        const isAvailable = await checkItemAvailability(itemId, start, end);
        if (!isAvailable) {
            throw new https_1.HttpsError('failed-precondition', 'Item is not available for the selected dates');
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
        const chatData = {
            participants: [auth.uid, item.ownerId],
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
    }
    catch (error) {
        console.error('Error processing rental request:', error);
        throw error instanceof https_1.HttpsError ? error : new https_1.HttpsError('internal', 'Failed to process rental request');
    }
});
// Rental approval/rejection
exports.processRentalResponse = (0, https_1.onCall)(async (request) => {
    const { auth, data } = request;
    if (!auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { rentalId, action, message } = data; // action: 'approve' | 'reject'
    try {
        const rentalRef = db.collection('rentals').doc(rentalId);
        const rentalDoc = await rentalRef.get();
        if (!rentalDoc.exists) {
            throw new https_1.HttpsError('not-found', 'Rental not found');
        }
        const rental = rentalDoc.data();
        // Verify user is the owner
        if (rental.ownerId !== auth.uid) {
            throw new https_1.HttpsError('permission-denied', 'Only the item owner can approve/reject rentals');
        }
        // Verify rental is in pending state
        if (rental.status !== 'pending') {
            throw new https_1.HttpsError('failed-precondition', 'Rental is not in pending state');
        }
        const updateData = {
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
    }
    catch (error) {
        console.error('Error processing rental response:', error);
        throw error instanceof https_1.HttpsError ? error : new https_1.HttpsError('internal', 'Failed to process rental response');
    }
});
// Handle rental completion
exports.completeRental = (0, https_1.onCall)(async (request) => {
    var _a, _b;
    const { auth, data } = request;
    if (!auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { rentalId, confirmationType, damageReport } = data; // confirmationType: 'owner' | 'renter'
    try {
        const rentalRef = db.collection('rentals').doc(rentalId);
        const rentalDoc = await rentalRef.get();
        if (!rentalDoc.exists) {
            throw new https_1.HttpsError('not-found', 'Rental not found');
        }
        const rental = rentalDoc.data();
        // Verify user is participant
        const isOwner = rental.ownerId === auth.uid;
        const isRenter = rental.renterId === auth.uid;
        if (!isOwner && !isRenter) {
            throw new https_1.HttpsError('permission-denied', 'User is not a participant in this rental');
        }
        // Verify rental is active
        if (rental.status !== 'active') {
            throw new https_1.HttpsError('failed-precondition', 'Rental is not active');
        }
        const updateData = {
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
        const updatedData = updatedRental.data();
        if (((_a = updatedData.completion) === null || _a === void 0 ? void 0 : _a.ownerConfirmed) && ((_b = updatedData.completion) === null || _b === void 0 ? void 0 : _b.renterConfirmed)) {
            // Complete the rental
            await completeRentalTransaction(rentalId, updatedData);
        }
        return { success: true };
    }
    catch (error) {
        console.error('Error completing rental:', error);
        throw error instanceof https_1.HttpsError ? error : new https_1.HttpsError('internal', 'Failed to complete rental');
    }
});
// Trigger when a new rental is created
exports.onRentalCreated = (0, firestore_1.onDocumentCreated)('rentals/{rentalId}', async (event) => {
    var _a;
    const rental = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    if (!rental)
        return;
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
    }
    catch (error) {
        console.error('Error updating stats on rental creation:', error);
    }
});
// Trigger when a rental is updated
exports.onRentalUpdated = (0, firestore_1.onDocumentUpdated)('rentals/{rentalId}', async (event) => {
    var _a, _b;
    const before = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before.data();
    const after = (_b = event.data) === null || _b === void 0 ? void 0 : _b.after.data();
    if (!before || !after)
        return;
    try {
        // Handle status changes
        if (before.status !== after.status) {
            await handleRentalStatusChange(event.params.rentalId, before.status, after.status, after);
        }
    }
    catch (error) {
        console.error('Error handling rental update:', error);
    }
});
// Helper functions
async function checkItemAvailability(itemId, startDate, endDate) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    // Check if item exists and is available
    const itemDoc = await db.collection('items').doc(itemId).get();
    if (!itemDoc.exists)
        return false;
    const item = itemDoc.data();
    if (!((_a = item.availability) === null || _a === void 0 ? void 0 : _a.isAvailable))
        return false;
    // Check for conflicting rentals
    const rentalsQuery = await db.collection('rentals')
        .where('itemId', '==', itemId)
        .where('status', 'in', ['approved', 'active'])
        .get();
    for (const rentalDoc of rentalsQuery.docs) {
        const rental = rentalDoc.data();
        const existingStart = ((_c = (_b = rental.dates) === null || _b === void 0 ? void 0 : _b.confirmedStart) === null || _c === void 0 ? void 0 : _c.toDate()) || ((_e = (_d = rental.dates) === null || _d === void 0 ? void 0 : _d.requestedStart) === null || _e === void 0 ? void 0 : _e.toDate());
        const existingEnd = ((_g = (_f = rental.dates) === null || _f === void 0 ? void 0 : _f.confirmedEnd) === null || _g === void 0 ? void 0 : _g.toDate()) || ((_j = (_h = rental.dates) === null || _h === void 0 ? void 0 : _h.requestedEnd) === null || _j === void 0 ? void 0 : _j.toDate());
        if (existingStart && existingEnd) {
            // Check for overlap
            if (startDate < existingEnd && endDate > existingStart) {
                return false;
            }
        }
    }
    return true;
}
function calculateRentalPricing(item, startDate, endDate, deliveryMethod) {
    var _a, _b;
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const dailyRate = item.pricing.dailyRate;
    let subtotal = dailyRate * days;
    // Apply weekly/monthly discounts if applicable
    if (days >= 30 && item.pricing.monthlyRate) {
        const months = Math.floor(days / 30);
        const remainingDays = days % 30;
        subtotal = (months * item.pricing.monthlyRate) + (remainingDays * dailyRate);
    }
    else if (days >= 7 && item.pricing.weeklyRate) {
        const weeks = Math.floor(days / 7);
        const remainingDays = days % 7;
        subtotal = (weeks * item.pricing.weeklyRate) + (remainingDays * dailyRate);
    }
    const platformFee = Math.round(subtotal * 0.1); // 10% platform fee
    const deliveryFee = deliveryMethod === 'delivery' ? (((_b = (_a = item.location) === null || _a === void 0 ? void 0 : _a.deliveryOptions) === null || _b === void 0 ? void 0 : _b.deliveryFee) || 0) : 0;
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
async function sendNotification(userId, notification) {
    var _a;
    try {
        // Get user's FCM tokens
        const userDoc = await db.collection('users').doc(userId).get();
        const user = userDoc.data();
        if (!((_a = user === null || user === void 0 ? void 0 : user.fcmTokens) === null || _a === void 0 ? void 0 : _a.length))
            return;
        // Create notification document
        await db.collection('notifications').add(Object.assign(Object.assign({ userId }, notification), { status: 'unread', delivery: {
                push: { sent: false },
            }, priority: 'normal', createdAt: admin.firestore.FieldValue.serverTimestamp() }));
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
    }
    catch (error) {
        console.error('Error sending notification:', error);
    }
}
async function handleStripeWebhook(event) {
    switch (event.type) {
        case 'payment_intent.succeeded':
            await handlePaymentSuccess(event.data.object);
            break;
        case 'payment_intent.payment_failed':
            await handlePaymentFailure(event.data.object);
            break;
        default:
            console.log(`Unhandled event type: ${event.type}`);
    }
}
async function handlePaymentSuccess(paymentIntent) {
    const rentalId = paymentIntent.metadata.rentalId;
    if (!rentalId)
        return;
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
        const rental = rentalDoc.data();
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
    }
    catch (error) {
        console.error('Error handling payment success:', error);
    }
}
async function handlePaymentFailure(paymentIntent) {
    const rentalId = paymentIntent.metadata.rentalId;
    if (!rentalId)
        return;
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
        const rental = rentalDoc.data();
        await sendNotification(rental.renterId, {
            type: 'payment',
            title: 'Payment Failed',
            body: 'Your rental payment could not be processed. Please try again.',
            data: { rentalId },
        });
    }
    catch (error) {
        console.error('Error handling payment failure:', error);
    }
}
async function handleRentalStatusChange(rentalId, oldStatus, newStatus, rental) {
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
async function completeRentalTransaction(rentalId, rental) {
    var _a, _b;
    try {
        // Calculate final amounts
        const damageAmount = ((_b = (_a = rental.completion) === null || _a === void 0 ? void 0 : _a.damageReported) === null || _b === void 0 ? void 0 : _b.amount) || 0;
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
    }
    catch (error) {
        console.error('Error completing rental transaction:', error);
    }
}
//# sourceMappingURL=index.js.map