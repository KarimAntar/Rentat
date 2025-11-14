# Required Environment Variables

This document lists all required environment variables for the Rentat application.

## ⚠️ IMPORTANT SECURITY NOTICE

**NEVER commit `.env` files or hardcode API keys in your source code!**

The following files should NEVER be committed to version control:
- `.env`
- `.env.local`
- `.env.development`
- `.env.production`
- `.env.test`

## Client-Side Environment Variables (Expo)

These variables should be prefixed with `EXPO_PUBLIC_` and stored in your `.env` file:

### Firebase Configuration
```
EXPO_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id (optional)
```

### Paymob Configuration
```
EXPO_PUBLIC_PAYMOB_API_KEY=your_paymob_api_key
EXPO_PUBLIC_PAYMOB_PUBLIC_KEY=your_paymob_public_key
EXPO_PUBLIC_PAYMOB_SECRET_KEY=your_paymob_secret_key
EXPO_PUBLIC_PAYMOB_INTEGRATION_ID=your_integration_id
EXPO_PUBLIC_PAYMOB_IFRAME_ID=your_iframe_id
EXPO_PUBLIC_PAYMOB_HMAC_SECRET=your_hmac_secret
```

## Server-Side Environment Variables (Firebase Functions)

These variables should be set using Firebase Functions configuration or Cloud Function environment variables:

### Paymob Configuration
```
PAYMOB_API_KEY=your_paymob_api_key
PAYMOB_INTEGRATION_ID=your_integration_id
PAYMOB_HMAC_SECRET=your_hmac_secret
```

### Didit KYC Configuration
```
DIDIT_API_KEY=your_didit_api_key
DIDIT_WORKFLOW_ID=your_workflow_id
DIDIT_WEBHOOK_SECRET=your_webhook_secret
DIDIT_WEBHOOK_URL=your_webhook_url
```

### Stripe Configuration (Deprecated - kept for reference)
```
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
```

## Setting Up Environment Variables

### For Local Development

1. Copy `.env.example` to `.env` (if example file exists)
2. Fill in all required values in `.env`
3. Never commit the `.env` file

### For Firebase Functions

Set environment variables using Firebase CLI:

```bash
# Set individual variables
firebase functions:config:set paymob.api_key="your_api_key"
firebase functions:config:set didit.api_key="your_api_key"

# Deploy functions after setting config
firebase deploy --only functions
```

Or use Cloud Functions environment variables in the Firebase Console:
1. Go to Firebase Console > Functions
2. Select your function
3. Click "Edit" > "Runtime, build, connections and security settings"
4. Add environment variables under "Runtime environment variables"

### For Production (Expo)

Set environment variables in your CI/CD pipeline or hosting platform. Never expose sensitive keys in client-side code.

## Security Checklist

- [ ] All API keys are stored in environment variables
- [ ] `.env` files are in `.gitignore`
- [ ] No hardcoded credentials in source code
- [ ] Environment variables are different for development and production
- [ ] Sensitive variables are only accessible server-side when possible
- [ ] API keys have appropriate restrictions (IP allowlisting, domain restrictions, etc.)

## Previous Security Issues (Now Fixed)

- ✅ Removed hardcoded Didit KYC API keys from `functions/src/config.ts`
- ✅ Added `docs/` folder to `.gitignore` to prevent leaking integration details
- ✅ Verified all config files use environment variables instead of hardcoded values
