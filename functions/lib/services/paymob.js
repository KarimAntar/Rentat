"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymobFunctionsService = void 0;
// Paymob service for Firebase Functions (server-side)
class PaymobFunctionsService {
    constructor(config) {
        this.authToken = null;
        this.tokenExpiry = null;
        this.baseUrl = 'https://accept.paymob.com/api';
        this.apiKey = config.apiKey;
        this.integrationId = config.integrationId;
        this.hmacSecret = config.hmacSecret;
        // Debug logging
        console.log('Paymob service initialized with:');
        console.log('API Key present:', !!this.apiKey);
        console.log('Integration ID present:', !!this.integrationId);
        console.log('HMAC Secret present:', !!this.hmacSecret);
    }
    static initialize(config) {
        if (!PaymobFunctionsService.instance) {
            PaymobFunctionsService.instance = new PaymobFunctionsService(config);
        }
        return PaymobFunctionsService.instance;
    }
    static getInstance() {
        if (!PaymobFunctionsService.instance) {
            throw new Error('PaymobFunctionsService not initialized. Call initialize() first.');
        }
        return PaymobFunctionsService.instance;
    }
    // Authenticate with Paymob
    async authenticate() {
        try {
            // Check if we have a valid token
            if (this.authToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
                return this.authToken;
            }
            console.log('Authenticating with Paymob...');
            // Try authentication with API key (same as client-side)
            const requestBody = {
                api_key: this.apiKey,
            };
            const response = await fetch(`${this.baseUrl}/auth/tokens`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Paymob authentication failed:', errorText);
                throw new Error(`Failed to authenticate with Paymob: ${errorText}`);
            }
            const authData = await response.json();
            console.log('Paymob authentication successful');
            this.authToken = authData.token;
            // Token expires in 1 hour, set expiry to 55 minutes for safety
            this.tokenExpiry = Date.now() + 55 * 60 * 1000;
            return this.authToken;
        }
        catch (error) {
            console.error('Error authenticating with Paymob:', error);
            throw error;
        }
    }
    // Create order
    async createOrder(data) {
        try {
            const authToken = await this.authenticate();
            const response = await fetch(`${this.baseUrl}/ecommerce/orders`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    auth_token: authToken,
                    delivery_needed: 'false',
                    amount_cents: Math.round(data.amount * 100),
                    currency: data.currency,
                    merchant_order_id: data.merchantOrderId,
                }),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to create order: ${errorText}`);
            }
            const result = await response.json();
            return { orderId: result.id };
        }
        catch (error) {
            console.error('Error creating order:', error);
            throw error;
        }
    }
    // Create payment key
    async createPaymentKey(data) {
        try {
            const authToken = await this.authenticate();
            const response = await fetch(`${this.baseUrl}/acceptance/payment_keys`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    auth_token: authToken,
                    amount_cents: Math.round(data.amount * 100),
                    expiration: 3600,
                    order_id: data.orderId,
                    billing_data: {
                        apartment: data.billingData.apartment || 'NA',
                        email: data.billingData.email || 'customer@example.com',
                        floor: data.billingData.floor || 'NA',
                        first_name: data.billingData.first_name || 'Guest',
                        street: data.billingData.street || 'NA',
                        building: data.billingData.building || 'NA',
                        phone_number: data.billingData.phone_number || '+201000000000',
                        shipping_method: 'NA',
                        postal_code: data.billingData.postal_code || 'NA',
                        city: data.billingData.city || 'Cairo',
                        country: data.billingData.country || 'EG',
                        last_name: data.billingData.last_name || 'User',
                        state: data.billingData.state || 'NA',
                    },
                    currency: data.currency,
                    integration_id: parseInt(this.integrationId),
                }),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to create payment key: ${errorText}`);
            }
            const result = await response.json();
            return { paymentKey: result.token };
        }
        catch (error) {
            console.error('Error creating payment key:', error);
            throw error;
        }
    }
    // Retrieve transaction
    async retrieveTransaction(transactionId) {
        try {
            const response = await fetch(`${this.baseUrl}/acceptance/transactions/${transactionId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to retrieve transaction: ${errorText}`);
            }
            return await response.json();
        }
        catch (error) {
            console.error('Error retrieving transaction:', error);
            throw error;
        }
    }
    // Refund transaction
    async refundTransaction(transactionId, amount) {
        var _a;
        try {
            const authToken = await this.authenticate();
            const response = await fetch(`${this.baseUrl}/acceptance/void_refund/refund`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    auth_token: authToken,
                    transaction_id: transactionId,
                    amount_cents: amount ? Math.round(amount * 100) : undefined,
                }),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to refund transaction: ${errorText}`);
            }
            const result = await response.json();
            return {
                success: true,
                refundId: (_a = result.id) === null || _a === void 0 ? void 0 : _a.toString(),
            };
        }
        catch (error) {
            console.error('Error refunding transaction:', error);
            throw error;
        }
    }
    // Void transaction
    async voidTransaction(transactionId) {
        try {
            const authToken = await this.authenticate();
            const response = await fetch(`${this.baseUrl}/acceptance/void_refund/void`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    auth_token: authToken,
                    transaction_id: transactionId,
                }),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to void transaction: ${errorText}`);
            }
            return { success: true };
        }
        catch (error) {
            console.error('Error voiding transaction:', error);
            throw error;
        }
    }
    // Capture transaction
    async captureTransaction(transactionId, amount) {
        try {
            const authToken = await this.authenticate();
            const response = await fetch(`${this.baseUrl}/acceptance/capture`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    auth_token: authToken,
                    transaction_id: transactionId,
                    amount_cents: amount ? Math.round(amount * 100) : undefined,
                }),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to capture transaction: ${errorText}`);
            }
            return { success: true };
        }
        catch (error) {
            console.error('Error capturing transaction:', error);
            throw error;
        }
    }
    // Verify HMAC for webhooks
    verifyHMAC(data, receivedHMAC) {
        var _a, _b, _c, _d;
        try {
            const crypto = require('crypto');
            // Concatenate specific fields in Paymob's required order
            const concatenatedString = [
                data.amount_cents,
                data.created_at,
                data.currency,
                data.error_occured,
                data.has_parent_transaction,
                data.id,
                data.integration_id,
                data.is_3d_secure,
                data.is_auth,
                data.is_capture,
                data.is_refunded,
                data.is_standalone_payment,
                data.is_voided,
                (_a = data.order) === null || _a === void 0 ? void 0 : _a.id,
                data.owner,
                data.pending,
                (_b = data.source_data) === null || _b === void 0 ? void 0 : _b.pan,
                (_c = data.source_data) === null || _c === void 0 ? void 0 : _c.sub_type,
                (_d = data.source_data) === null || _d === void 0 ? void 0 : _d.type,
                data.success,
            ]
                .filter((val) => val !== undefined && val !== null)
                .join('');
            const calculatedHMAC = crypto
                .createHmac('sha512', this.hmacSecret)
                .update(concatenatedString)
                .digest('hex');
            return calculatedHMAC === receivedHMAC;
        }
        catch (error) {
            console.error('Error verifying HMAC:', error);
            return false;
        }
    }
}
exports.PaymobFunctionsService = PaymobFunctionsService;
exports.default = PaymobFunctionsService;
//# sourceMappingURL=paymob.js.map