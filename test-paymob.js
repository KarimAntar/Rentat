// Paymob Integration Test Script
// Run with: node test-paymob.js

require('dotenv').config();

const testPaymobIntegration = async () => {
  console.log('🧪 Testing Paymob Integration...\n');

  // Load credentials from .env
  const apiKey = process.env.EXPO_PUBLIC_PAYMOB_API_KEY;
  const integrationId = process.env.EXPO_PUBLIC_PAYMOB_INTEGRATION_ID;
  const iframeId = process.env.EXPO_PUBLIC_PAYMOB_IFRAME_ID;

  console.log('📋 Configuration Check:');
  console.log(`API Key: ${apiKey ? '✅ Loaded' : '❌ Missing'}`);
  console.log(`Integration ID: ${integrationId ? '✅ Loaded' : '❌ Missing'}`);
  console.log(`iFrame ID: ${iframeId ? '✅ Loaded' : '❌ Missing'}\n`);

  if (!apiKey || !integrationId || !iframeId) {
    console.log('❌ Missing required environment variables. Check your .env file.');
    return;
  }

  try {
    // Step 1: Authenticate with Paymob
    console.log('🔐 Step 1: Authenticating with Paymob...');
    const authResponse = await fetch('https://accept.paymob.com/api/auth/tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey })
    });

    if (!authResponse.ok) {
      throw new Error(`Authentication failed: ${authResponse.status} ${authResponse.statusText}`);
    }

    const authData = await authResponse.json();
    console.log('✅ Authentication successful!');
    console.log(`Token: ${authData.token.substring(0, 30)}...\n`);

    // Step 2: Create Order
    console.log('📦 Step 2: Creating test order (100 EGP)...');
    const orderResponse = await fetch('https://accept.paymob.com/api/ecommerce/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth_token: authData.token,
        delivery_needed: 'false',
        amount_cents: 10000, // 100 EGP
        currency: 'EGP',
        merchant_order_id: `TEST_${Date.now()}`
      })
    });

    if (!orderResponse.ok) {
      throw new Error(`Order creation failed: ${orderResponse.status} ${orderResponse.statusText}`);
    }

    const orderData = await orderResponse.json();
    console.log('✅ Order created successfully!');
    console.log(`Order ID: ${orderData.id}`);
    console.log(`Amount: ${orderData.amount_cents / 100} EGP\n`);

    // Step 3: Create Payment Key
    console.log('🔑 Step 3: Creating payment key...');
    const paymentKeyResponse = await fetch('https://accept.paymob.com/api/acceptance/payment_keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth_token: authData.token,
        amount_cents: 10000,
        expiration: 3600,
        order_id: orderData.id,
        billing_data: {
          apartment: 'NA',
          email: 'test@example.com',
          floor: 'NA',
          first_name: 'Test',
          street: 'NA',
          building: 'NA',
          phone_number: '+201234567890',
          shipping_method: 'NA',
          postal_code: 'NA',
          city: 'Cairo',
          country: 'EG',
          last_name: 'User',
          state: 'NA'
        },
        currency: 'EGP',
        integration_id: parseInt(integrationId)
      })
    });

    if (!paymentKeyResponse.ok) {
      throw new Error(`Payment key creation failed: ${paymentKeyResponse.status} ${paymentKeyResponse.statusText}`);
    }

    const paymentKeyData = await paymentKeyResponse.json();
    console.log('✅ Payment key created successfully!');
    console.log(`Payment Token: ${paymentKeyData.token.substring(0, 30)}...\n`);

    // Step 4: Generate Payment URL
    const iframeUrl = `https://accept.paymob.com/api/acceptance/iframes/${iframeId}?payment_token=${paymentKeyData.token}`;

    console.log('🎉 SUCCESS! Paymob integration is working!');
    console.log('\n💳 To complete payment testing:');
    console.log('1. Open this URL in your browser:');
    console.log(iframeUrl);
    console.log('\n2. Use test card credentials:');
    console.log('   Card Number: 5123456789012346');
    console.log('   Cardholder Name: Test Account');
    console.log('   Expiry: 12/25');
    console.log('   CVV: 123');
    console.log('\n3. Complete the payment');
    console.log('\n4. Check Paymob dashboard for transaction:');
    console.log('   https://accept.paymob.com/portal2/en/login');

    console.log('\n📊 Test Results:');
    console.log('✅ Authentication: PASSED');
    console.log('✅ Order Creation: PASSED');
    console.log('✅ Payment Key: PASSED');
    console.log('✅ Integration Ready: YES');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Check your .env file has correct Paymob credentials');
    console.log('2. Verify you\'re using TEST mode credentials');
    console.log('3. Check your internet connection');
    console.log('4. Ensure Paymob account is in TEST mode');
  }
};

// Run the test
testPaymobIntegration();
