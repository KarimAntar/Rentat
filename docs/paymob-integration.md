# Paymob Integration Guide

## Overview

This document describes the Paymob payment integration that replaces Stripe for the Rentat application. Paymob is an Egyptian payment gateway that supports multiple payment methods including cards, wallets, installments, and BNPL options.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Configuration](#configuration)
3. [API Structure](#api-structure)
4. [Payment Flow](#payment-flow)
5. [Webhooks](#webhooks)
6. [Testing](#testing)
7. [Migration from Stripe](#migration-from-stripe)

## Getting Started

### 1. Create a Paymob Account

1. Visit [Paymob Accept Portal](https://accept.paymob.com/portal2/en/login)
2. Sign up for a new account
3. Complete your business verification
4. Your account will start in TEST mode - contact support to activate LIVE mode

### 2. Get Your API Credentials

From your Paymob dashboard, navigate to:
- **Settings** → **Account Info** → **API Keys**

You'll need:
- **API Key**: Used for authentication
- **Secret Key**: For server-side operations
- **Integration ID**: Your payment integration identifier (can be multiple for different payment methods)
- **HMAC Secret**: For webhook verification
- **iFrame ID**: For embedded checkout (optional)

### 3. Environment Variables

Update your `.env` file with your Paymob credentials:

```bash
# Paymob Configuration
EXPO_PUBLIC_PAYMOB_API_KEY=your_api_key_here
EXPO_PUBLIC_PAYMOB_PUBLIC_KEY=your_public_key_here
EXPO_PUBLIC_PAYMOB_SECRET_KEY=your_secret_key_here
EXPO_PUBLIC_PAYMOB_INTEGRATION_ID=your_integration_id_here
EXPO_PUBLIC_PAYMOB_IFRAME_ID=your_iframe_id_here
EXPO_PUBLIC_PAYMOB_HMAC_SECRET=your_hmac_secret_here
```

For Firebase Functions, set these environment variables:

```bash
firebase functions:config:set \
  paymob.api_key="your_api_key_here" \
  paymob.secret_key="your_secret_key_here" \
  paymob.integration_id="your_integration_id_here" \
  paymob.hmac_secret="your_hmac_secret_here"
```

## Configuration

### Client-Side Configuration

The Paymob service is configured in `src/config/paymob.ts` and provides:

- **Authentication**: Token-based authentication with auto-refresh
- **Order Creation**: Create payment orders
- **Payment Keys**: Generate payment keys for checkout
- **Transaction Management**: Retrieve, refund, void, and capture transactions
- **HMAC Verification**: Verify webhook signatures

### Server-Side Configuration (Firebase Functions)

The server-side implementation is in `functions/src/services/paymob.ts` and includes:

- Secure API key handling
- Transaction processing
- Webhook verification
- Refund and void operations

## API Structure

### Authentication Flow

```typescript
// Authenticate and get token
const paymobService = PaymobService.getInstance();
const token = await paymobService.authenticate();
```

### Create Payment for Rental

```typescript
const { paymentKey, orderId } = await paymobService.createRentalPaymentKey(
  rentalId,
  amount, // in EGP
  'EGP',
  {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    phone: '+201234567890',
    city: 'Cairo',
    country: 'EG'
  }
);
```

### Process Payment

```typescript
// Redirect user to Paymob iframe with payment key
const iframeUrl = `https://accept.paymob.com/api/acceptance/iframes/${IFRAME_ID}?payment_token=${paymentKey}`;
```

### Retrieve Transaction

```typescript
const transaction = await paymobService.retrieveTransaction(transactionId);
```

### Refund Transaction

```typescript
const result = await paymobService.refundTransaction(
  transactionId,
  refundAmount // optional, full refund if not specified
);
```

### Void Transaction

```typescript
const result = await paymobService.voidTransaction(transactionId);
```

### Capture Authorized Transaction

```typescript
const result = await paymobService.captureTransaction(
  transactionId,
  captureAmount // optional
);
```

## Payment Flow

### 1. Standard Payment Flow

```
User initiates payment
    ↓
Create Paymob Order (amount, currency, rental ID)
    ↓
Create Payment Key (order ID, billing data)
    ↓
Redirect to Paymob iFrame (payment key)
    ↓
User completes payment (3DS, card details)
    ↓
Paymob sends webhook (transaction callback)
    ↓
Verify HMAC signature
    ↓
Update rental status
    ↓
Send confirmation to user
```

### 2. Escrow Payment Flow (for Rentals)

```
Rental approved
    ↓
Create payment intent (hold funds)
    ↓
User pays (funds held in escrow)
    ↓
Rental starts
    ↓
Rental ends
    ↓
Both parties confirm completion
    ↓
Check for damage claims
    ↓
Release funds to owner / Refund to renter
```

## Webhooks

### Setup Webhook URL

In your Paymob dashboard:
1. Go to **Settings** → **Payment Integrations**
2. Select your integration
3. Set the webhook URL: `https://your-domain.com/webhooks/paymob-webhook`

### Webhook Payload

Paymob sends two types of callbacks:

#### 1. Transaction Processed Callback

Sent when a transaction is processed (success or failure).

#### 2. Transaction Response Callback

Sent after the user is redirected back to your site.

### HMAC Verification

Always verify the HMAC signature to ensure the webhook is from Paymob:

```typescript
const isValid = paymobService.verifyHMAC(webhookData, receivedHMAC);

if (!isValid) {
  throw new Error('Invalid webhook signature');
}
```

### Webhook Handler Example

```typescript
app.post('/paymob-webhook', express.json(), async (req, res) => {
  try {
    const payload = req.body;
    const hmac = req.query.hmac as string;
    
    // Verify HMAC
    if (!paymobService.verifyHMAC(payload, hmac)) {
      return res.status(400).send('Invalid signature');
    }
    
    // Process transaction
    const transactionId = payload.id;
    const success = payload.success === 'true' || payload.success === true;
    const orderId = payload.order?.merchant_order_id;
    
    if (success) {
      // Payment succeeded
      await handlePaymentSuccess(orderId, transactionId);
    } else {
      // Payment failed
      await handlePaymentFailure(orderId, transactionId, payload.data?.message);
    }
    
    return res.json({ received: true });
  } catch (error) {
    console.error('Error handling webhook:', error);
    return res.status(500).send('Webhook handler failed');
  }
});
```

## Testing

### Test Credentials

Paymob provides test cards for development:

#### Mastercard (Test)
- **Card Number**: 5123456789012346
- **Cardholder Name**: Test Account
- **Expiry**: 12/25
- **CVV**: 123

#### Visa (for simulation)
- **Card Number**: 4111111111111111
- **Cardholder Name**: Test Account
- **Expiry**: 12/25
- **CVV**: 123

#### Wallet Test Credentials
- **Wallet Number**: 01010101010
- **MPin**: 123456
- **OTP**: 123456

### Testing Scenarios

You can simulate various scenarios using the test credentials:
- Successful payment
- Declined card
- Expired card
- Insufficient funds
- 3DS authentication flow

## Migration from Stripe

### Key Differences

| Feature | Stripe | Paymob |
|---------|--------|--------|
| **Currency** | USD (global) | EGP (Egypt) |
| **Payment Intent** | `PaymentIntent` | Order + Payment Key |
| **Amount Format** | Cents (multiply by 100) | Cents (multiply by 100) |
| **3D Secure** | Built-in | Built-in |
| **Webhooks** | Event-based | Transaction callbacks |
| **Signature** | Webhook secret | HMAC SHA512 |

### Code Changes Required

1. **Replace imports**:
   ```typescript
   // Old
   import { stripeService } from '../config/stripe';
   
   // New
   import { paymobService } from '../config/paymob';
   ```

2. **Update payment creation**:
   ```typescript
   // Old (Stripe)
   const { clientSecret } = await stripeService.createRentalPaymentIntent(
     rentalId,
     amount,
     'usd'
   );
   
   // New (Paymob)
   const { paymentKey, orderId } = await paymobService.createRentalPaymentKey(
     rentalId,
     amount,
     'EGP',
     billingData
   );
   ```

3. **Update transaction retrieval**:
   ```typescript
   // Old (Stripe)
   const { paymentIntent } = await stripeService.retrievePaymentIntent(clientSecret);
   
   // New (Paymob)
   const { transaction } = await paymobService.retrieveTransaction(transactionId);
   ```

4. **Update refunds**:
   ```typescript
   // Old (Stripe) - handled via API
   await stripe.refunds.create({ payment_intent: paymentIntentId });
   
   // New (Paymob)
   await paymobService.refundTransaction(transactionId, amount);
   ```

### Database Schema Changes

Update your rental documents to store Paymob-specific fields:

```typescript
interface Rental {
  // ...existing fields
  payment: {
    provider: 'paymob'; // Changed from 'stripe'
    paymobOrderId: string; // Instead of stripePaymentIntentId
    paymobTransactionId?: string;
    paymentKey?: string;
    paymentStatus: 'pending' | 'succeeded' | 'failed';
  };
}
```

## Supported Payment Methods

Paymob supports multiple payment methods in Egypt:

- **Cards**: Visa, Mastercard
- **Digital Wallets**: Vodafone Cash, Etisalat Cash, Orange Cash, Fawry
- **Bank Installments**: Various Egyptian banks
- **BNPL/Consumer Finance**: ValU, Souhoola, Forsa, Sympl, Contact, Premium, Halan, MOGO, TRU, Seven, Klivvr
- **Kiosk**: Aman, Masary
- **InstaPay**: Coming soon

## Best Practices

1. **Always verify webhooks**: Use HMAC verification for all webhook callbacks
2. **Store transaction IDs**: Keep both order ID and transaction ID in your database
3. **Handle errors gracefully**: Paymob errors include specific codes - show user-friendly messages
4. **Use idempotency**: Use unique merchant_order_id for each payment
5. **Test thoroughly**: Test all payment scenarios in TEST mode before going live
6. **Currency**: Always use EGP for Egypt operations
7. **Amount validation**: Ensure amounts are positive and in cents (multiply by 100)
8. **Security**: Never expose API keys or secrets in client-side code

## Troubleshooting

### Common Issues

1. **Authentication Failed**
   - Check API key is correct
   - Ensure token hasn't expired
   - Verify you're using the correct environment (test vs live)

2. **Payment Key Creation Failed**
   - Verify integration ID is correct
   - Check billing data is complete
   - Ensure order was created successfully first

3. **Webhook Not Received**
   - Check webhook URL is publicly accessible
   - Verify HTTPS is enabled
   - Check firewall settings
   - Review Paymob dashboard for webhook logs

4. **HMAC Verification Failed**
   - Ensure HMAC secret matches dashboard
   - Verify field order in concatenation
   - Check for null/undefined values

## Support

For Paymob-specific issues:
- Email: [support@paymob.com](mailto:support@paymob.com)
- Documentation: [https://developers.paymob.com/hub/egypt](https://developers.paymob.com/hub/egypt)
- Dashboard: [https://accept.paymob.com/portal2/en/login](https://accept.paymob.com/portal2/en/login)

For integration issues in this project:
- Check the code in `src/config/paymob.ts`
- Review Firebase Functions in `functions/src/services/paymob.ts`
- Examine webhook handler in `functions/src/index.ts`

## Next Steps

1. ✅ Create Paymob account
2. ✅ Get API credentials
3. ✅ Update environment variables
4. ⏳ Test payment flow in TEST mode
5. ⏳ Implement webhook handler
6. ⏳ Update UI components to use Paymob
7. ⏳ Test all payment scenarios
8. ⏳ Request account activation for LIVE mode
9. ⏳ Deploy to production
10. ⏳ Monitor transactions

---

**Last Updated**: November 2025
**Integration Status**: In Progress - Stripe to Paymob migration
