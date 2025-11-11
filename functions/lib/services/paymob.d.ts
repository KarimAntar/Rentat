export declare class PaymobFunctionsService {
    private static instance;
    private authToken;
    private tokenExpiry;
    private readonly apiKey;
    private readonly integrationId;
    private readonly hmacSecret;
    private readonly baseUrl;
    private constructor();
    static initialize(config: {
        apiKey: string;
        integrationId: string;
        hmacSecret: string;
    }): PaymobFunctionsService;
    static getInstance(): PaymobFunctionsService;
    authenticate(): Promise<string>;
    createOrder(data: {
        amount: number;
        currency: string;
        merchantOrderId?: string;
    }): Promise<{
        orderId: number;
    }>;
    createPaymentKey(data: {
        amount: number;
        currency: string;
        orderId: number;
        billingData: {
            apartment?: string;
            email?: string;
            floor?: string;
            first_name?: string;
            street?: string;
            building?: string;
            phone_number?: string;
            postal_code?: string;
            city?: string;
            country?: string;
            last_name?: string;
            state?: string;
        };
    }): Promise<{
        paymentKey: string;
    }>;
    retrieveTransaction(transactionId: string): Promise<any>;
    refundTransaction(transactionId: string, amount?: number): Promise<{
        success: boolean;
        refundId?: string;
    }>;
    voidTransaction(transactionId: string): Promise<{
        success: boolean;
    }>;
    captureTransaction(transactionId: string, amount?: number): Promise<{
        success: boolean;
    }>;
    verifyHMAC(data: any, receivedHMAC: string): boolean;
}
export default PaymobFunctionsService;
