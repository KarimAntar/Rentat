#!/usr/bin/env node

// Debug script to test the webhook without making real payments
// Usage: node test_webhook_debug.js <paymobOrderId>

const admin = require('firebase-admin');
const serviceAccount = require('./functions/serviceAccountKey.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'rentat-2'
});

const db = admin.firestore();

async function testWebhookDebug(orderId) {
  try {
    console.log('🔍 Testing webhook with Paymob order ID:', orderId);

    // Find the rental
    const rentalsSnap = await db.collection('rentals')
      .where('payment.paymobOrderId', '==', orderId)
      .limit(1)
      .get();

    if (rentalsSnap.empty) {
      console.error('❌ No rental found for order:', orderId);
      return;
    }

    const rentalDoc = rentalsSnap.docs[0];
    const rentalRef = rentalDoc.ref;
    const rental = rentalDoc.data();

    console.log('📄 Rental found:', {
      id: rentalRef.id,
      ownerId: rental.ownerId,
      renterId: rental.renterId,
      status: rental.status,
      paymobOrderId: rental.payment?.paymobOrderId,
      paymentStatus: rental.payment?.paymentStatus
    });

    // Check current balances
    console.log('💰 Current balances BEFORE any changes:');

    const [ownerBeforeDoc, renterBeforeDoc] = await Promise.all([
      db.collection('users').doc(rental.ownerId).get(),
      db.collection('users').doc(rental.renterId).get()
    ]);

    const ownerBeforeBalance = ownerBeforeDoc.data()?.wallet?.balance || 0;
    const renterBeforeBalance = renterBeforeDoc.data()?.wallet?.balance || 0;

    console.log('Owner balance:', ownerBeforeBalance);
    console.log('Renter balance:', renterBeforeBalance);

    // Calculate the amount that should be credited
    const ownerAmount = (rental.pricing.subtotal || 0) - (rental.pricing.platformFee || 0) + (rental.completion?.damageReported?.amount || 0);

    console.log('📊 Amount to credit owner:', ownerAmount);

    // Simulate the webhook processing
    console.log('🚀 Simulating webhook processing...');

    // This would normally happen in the webhook:
    // 1. Create wallet transactions
    // 2. Update owner balance

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
        paymobTransactionId: 'test_tx_' + Date.now(),
        description: 'Payment for rental',
      },
      metadata: {
        platformFee: rental.pricing.platformFee,
        netAmount: -rental.pricing.total,
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Owner transaction (credit to wallet)
    const ownerTxRef = db.collection('wallet_transactions').doc();
    batch.set(ownerTxRef, {
      userId: rental.ownerId,
      type: 'rental_income',
      amount: ownerAmount,
      currency: rental.pricing.currency,
      status: 'completed',
      relatedRentalId: rentalRef.id,
      relatedItemId: rental.itemId,
      payment: {
        paymobTransactionId: 'test_tx_' + Date.now(),
        description: 'Owner payout (credited to wallet)',
      },
      metadata: {
        platformFee: rental.pricing.platformFee,
        netAmount: ownerAmount,
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('📝 Created wallet transactions (batch not committed yet)');

    // Check for any recent wallet transactions that might be interfering
    const recentTxQuery = db.collection('wallet_transactions')
      .orderBy('createdAt', 'desc')
      .limit(10);

    const recentTxs = await recentTxQuery.get();
    console.log('📋 Recent wallet transactions:');
    recentTxs.docs.forEach(doc => {
      const tx = doc.data();
      console.log(`  - ${tx.type}: ${tx.amount} for user ${tx.userId} (${doc.id})`);
    });

    // Now apply the owner's balance update
    console.log('💸 Applying owner balance update...');
    await db.collection('users').doc(rental.ownerId).update({
      'wallet.balance': admin.firestore.FieldValue.increment(ownerAmount),
      'wallet.totalEarnings': admin.firestore.FieldValue.increment(ownerAmount),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('✅ Owner balance updated');

    // Commit the batch
    await batch.commit();
    console.log('✅ Wallet transactions committed');

    // Final check
    const [ownerAfterDoc, renterAfterDoc] = await Promise.all([
      db.collection('users').doc(rental.ownerId).get(),
      db.collection('users').doc(rental.renterId).get()
    ]);

    const ownerAfterBalance = ownerAfterDoc.data()?.wallet?.balance || 0;
    const renterAfterBalance = renterAfterDoc.data()?.wallet?.balance || 0;

    console.log('\n💰 Final balances AFTER webhook processing:');
    console.log('Owner balance:', ownerAfterBalance, `(expected: ${ownerBeforeBalance + ownerAmount})`);
    console.log('Renter balance:', renterAfterBalance, `(expected: ${renterBeforeBalance})`);

    const ownerChange = ownerAfterBalance - ownerBeforeBalance;
    const renterChange = renterAfterBalance - renterBeforeBalance;

    console.log('\n📈 Balance changes:');
    console.log(`Owner: ${ownerChange} (expected: ${ownerAmount})`);
    console.log(`Renter: ${renterChange} (expected: 0)`);

    if (renterChange !== 0) {
      console.error('🚨 WARNING: Renter balance changed unexpectedly!');
      console.log('This suggests another process is modifying the renter\'s wallet');
    }

    if (ownerChange !== ownerAmount) {
      console.error('🚨 WARNING: Owner balance change doesn\'t match expected amount!');
      console.log('Expected:', ownerAmount, 'Actual change:', ownerChange);
    }

  } catch (error) {
    console.error('❌ Error in debug test:', error);
  } finally {
    process.exit(0);
  }
}

// Get order ID from command line
const orderId = process.argv[2];
if (!orderId) {
  console.error('Usage: node test_webhook_debug.js <paymobOrderId>');
  process.exit(1);
}

testWebhookDebug(orderId);
