# Didit KYC Integration Guide

## Overview

This document outlines the integration of Didit KYC (Know Your Customer) verification into the Rentat platform. Users must complete KYC verification before they can withdraw money or submit rental requests.

## What Has Been Implemented

### 1. Didit KYC Service (`src/services/diditKyc.ts`)

A comprehensive service that handles all Didit KYC operations:

- **`createVerificationSession(userId, workflowId?)`** - Creates a new KYC verification session
- **`getSessionStatus(sessionId)`** - Retrieves the status of a verification session
- **`handleWebhook(payload)`** - Processes webhook events from Didit
- **`isUserKycVerified(userId)`** - Checks if a user has completed KYC
- **`getUserKycInfo(userId)`** - Gets detailed KYC information for a user
- **`requireKycVerification(userId)`** - Enforces KYC requirement (throws error if not verified)
- **`cancelSession(sessionId)`** - Cancels an active verification session
- **`getVerificationInfo()`** - Returns information about verification requirements

### 2. Updated Type Definitions (`src/types/index.ts`)

Added new interfaces:

- **`DiditKycInfo`** - Stores KYC session and verification data
- **`User`** interface now includes optional `diditKyc?: DiditKycInfo` field

### 3. Updated WalletScreen (`src/screens/main/WalletScreen.tsx`)

- Checks KYC status on load
- Displays verification status
- Blocks withdrawals for unverified users
- Shows appropriate error messages based on KYC status

## What Still Needs to Be Done

### 1. Environment Variables

Create a `.env` file (or add to existing) with:

```env
REACT_APP_DIDIT_API_KEY=your_didit_api_key_here
REACT_APP_DIDIT_WORKFLOW_ID=your_workflow_id_here
```

**To get these values:**
1. Sign up at [business.didit.me](https://business.didit.me)
2. Create your organization workspace
3. Create a KYC workflow in Console → Verifications → Workflows
4. Copy the Workflow ID from the workflow details
5. Generate an API key in Verifications → Settings → API & Webhooks

### 2. Create KYC Verification Screen

Create `src/screens/main/KYCVerificationScreen.tsx`:

```typescript
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '../../contexts/AuthContext';
import { diditKycService } from '../../services/diditKyc';
import Button from '../../components/ui/Button';

const KYCVerificationScreen: React.FC = () => {
  const { user } = useAuthContext();
  const [loading, setLoading] = useState(true);
  const [kycInfo, setKycInfo] = useState<any>(null);
  const [verificationUrl, setVerificationUrl] = useState<string | null>(null);

  useEffect(() => {
    loadKycInfo();
  }, [user]);

  const loadKycInfo = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const info = await diditKycService.getUserKycInfo(user.uid);
      setKycInfo(info);
      setVerificationUrl(info.verificationUrl || null);
    } catch (error) {
      console.error('Error loading KYC info:', error);
    } finally {
      setLoading(false);
    }
  };

  const startVerification = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const session = await diditKycService.createVerificationSession(user.uid);
      setVerificationUrl(session.verificationUrl);
      
      // Open the verification URL
      if (session.verificationUrl) {
        await Linking.openURL(session.verificationUrl);
      }
    } catch (error) {
      console.error('Error starting verification:', error);
      Alert.alert('Error', 'Failed to start verification. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusInfo = () => {
    if (!kycInfo?.status) {
      return {
        icon: 'alert-circle-outline',
        color: '#6B7280',
        title: 'Verification Required',
        description: 'Complete identity verification to unlock all features.',
      };
    }

    switch (kycInfo.status) {
      case 'not_started':
        return {
          icon: 'alert-circle-outline',
          color: '#6B7280',
          title: 'Not Started',
          description: 'You haven\'t started the verification process yet.',
        };
      case 'in_progress':
        return {
          icon: 'time-outline',
          color: '#F59E0B',
          title: 'In Progress',
          description: 'Your verification is currently in progress.',
        };
      case 'in_review':
        return {
          icon: 'search-outline',
          color: '#3B82F6',
          title: 'Under Review',
          description: 'Your documents are being reviewed. This usually takes 1-2 business days.',
        };
      case 'approved':
        return {
          icon: 'checkmark-circle',
          color: '#10B981',
          title: 'Verified',
          description: 'Your identity has been verified successfully!',
        };
      case 'rejected':
        return {
          icon: 'close-circle',
          color: '#EF4444',
          title: 'Rejected',
          description: 'Your verification was rejected. Please contact support for more information.',
        };
      case 'expired':
        return {
          icon: 'alert-circle',
          color: '#EF4444',
          title: 'Expired',
          description: 'Your verification session has expired. Please start again.',
        };
      default:
        return {
          icon: 'help-circle-outline',
          color: '#6B7280',
          title: 'Unknown Status',
          description: 'Unable to determine verification status.',
        };
    }
  };

  const statusInfo = getStatusInfo();
  const verificationInfo = diditKycService.getVerificationInfo();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Status Card */}
        <View style={styles.statusCard}>
          <Ionicons name={statusInfo.icon as any} size={64} color={statusInfo.color} />
          <Text style={styles.statusTitle}>{statusInfo.title}</Text>
          <Text style={styles.statusDescription}>{statusInfo.description}</Text>
        </View>

        {/* Information Section */}
        {(!kycInfo?.status || kycInfo.status === 'not_started' || kycInfo.status === 'expired') && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{verificationInfo.name}</Text>
            <Text style={styles.sectionDescription}>{verificationInfo.description}</Text>

            <Text style={styles.subsectionTitle}>What You'll Need:</Text>
            {verificationInfo.requirements.map((req, index) => (
              <View key={index} style={styles.requirementItem}>
                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                <Text style={styles.requirementText}>{req}</Text>
              </View>
            ))}

            <Text style={styles.estimatedTime}>
              Estimated time: {verificationInfo.estimatedTime}
            </Text>
          </View>
        )}

        {/* Action Button */}
        {(!kycInfo?.status || kycInfo.status === 'not_started' || kycInfo.status === 'expired') && (
          <Button
            title="Start Verification"
            onPress={startVerification}
            loading={loading}
            disabled={loading}
          />
        )}

        {kycInfo?.status === 'in_progress' && verificationUrl && (
          <Button
            title="Continue Verification"
            onPress={() => Linking.openURL(verificationUrl)}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

// Add styles here...

export default KYCVerificationScreen;
```

### 3. Add Navigation Route

Update `src/navigation/AppNavigator.tsx` to include the KYC screen:

```typescript
<Stack.Screen 
  name="KYCVerification" 
  component={KYCVerificationScreen}
  options={{ title: 'Identity Verification' }}
/>
```

Also update the navigation in `WalletScreen.tsx` to navigate to the KYC screen:

```typescript
import { useNavigation } from '@react-navigation/native';

// In the component:
const navigation = useNavigation();

// Replace console.log with:
navigation.navigate('KYCVerification' as never);
```

### 4. Add KYC Check to Rental Requests

Update `src/screens/main/RentalRequestScreen.tsx`:

```typescript
import { diditKycService } from '../../services/diditKyc';

// In handleSubmitRequest function, add before creating the rental:
try {
  await diditKycService.requireKycVerification(user.uid);
  // ... rest of rental request code
} catch (error: any) {
  // Handle KYC errors similar to WalletScreen
  if (error.message === 'KYC_REQUIRED') {
    Alert.alert(
      'Verification Required',
      'You need to complete identity verification before requesting rentals.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Verify Now', onPress: () => navigation.navigate('KYCVerification') }
      ]
    );
    return;
  }
  // ... handle other errors
}
```

### 5. Set Up Webhook Endpoint (Backend)

✅ **COMPLETED** - Firebase Cloud Function deployed successfully!

The webhook endpoint has been deployed and is available at:
**`https://us-central1-rentat-app.cloudfunctions.net/webhooks`**

The webhook handler is configured to receive Didit KYC status updates at the `/didit-webhook` endpoint.

**To configure in Didit Console:**
1. Go to your Didit dashboard → Verifications → Settings → API & Webhooks
2. Add the webhook URL: `https://us-central1-rentat-app.cloudfunctions.net/webhooks/didit-webhook`
3. Save the configuration

The webhook will automatically update user KYC status in Firestore when verification sessions complete.

### 6. Update Firestore Rules

Add rules to protect KYC data:

```
match /users/{userId} {
  allow read: if request.auth.uid == userId;
  allow update: if request.auth.uid == userId && 
    !request.resource.data.diff(resource.data).affectedKeys().hasAny(['diditKyc']);
  // Only backend can update KYC data
}
```

### 7. Testing

1. **Set up test environment:**
   - Use Didit's sandbox mode for testing
   - Test with various document types

2. **Test scenarios:**
   - User starts KYC verification
   - User completes verification successfully
   - User abandons verification midway
   - Verification is rejected
   - User tries to withdraw without KYC
   - User tries to request rental without KYC
   - Webhook updates user status correctly

### 8. Production Checklist

- [ ] Add Didit API keys to production environment
- [ ] Configure production webhook URL
- [ ] Test webhook delivery in production
- [ ] Add monitoring/logging for KYC events
- [ ] Set up alerts for failed verifications
- [ ] Add customer support flow for rejected verifications
- [ ] Update privacy policy to mention KYC data
- [ ] Add KYC requirements to terms of service
- [ ] Create help documentation for users

## Security Considerations

1. **API Key Security:**
   - Never expose API keys in frontend code
   - All Didit API calls should go through your backend
   - Use environment variables for API keys

2. **Webhook Security:**
   - Verify webhook signatures
   - Use HTTPS only
   - Log all webhook events

3. **Data Privacy:**
   - Store minimal KYC data
   - Follow GDPR/data protection requirements
   - Allow users to delete their data

## Support & Documentation

- Didit Documentation: https://docs.didit.me
- Didit Support: hello@didit.me
- WhatsApp Support: +34 681 310 687

## Troubleshooting

### Verification fails to start
- Check API key is correct
- Verify workflow ID exists
- Check network connectivity

### Webhook not receiving updates
- Verify webhook URL is correct
- Check Cloud Function logs
- Verify webhook is configured in Didit Console

### User stuck in "in_progress" status
- Check Didit Console for session status
- Verify user completed all steps
- Contact Didit support if issue persists
