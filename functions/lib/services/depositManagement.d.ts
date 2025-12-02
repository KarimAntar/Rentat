import * as functions from 'firebase-functions';
/**
 * Callable function to release full deposit (admin only)
 */
export declare const releaseDepositFunction: functions.https.CallableFunction<any, Promise<{
    success: boolean;
    message: string;
}>, unknown>;
/**
 * Callable function to release partial deposit (admin only)
 */
export declare const releasePartialDepositFunction: functions.https.CallableFunction<any, Promise<{
    success: boolean;
    message: string;
}>, unknown>;
/**
 * Callable function to hold deposit (admin only)
 */
export declare const holdDepositFunction: functions.https.CallableFunction<any, Promise<{
    success: boolean;
    message: string;
}>, unknown>;
/**
 * Validate deposit operations middleware
 */
export declare function validateDepositOperations(depositData: any): boolean;
