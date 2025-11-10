# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Rentat/Rent@ is a peer-to-peer rental marketplace mobile application built with React Native (Expo) and Firebase. Users can list items for rent and rent items from others in their area, with secure payment processing via Stripe.

## Development Commands

### Client (React Native)
```bash
# Start development server
npm start

# Run on specific platforms
npm run ios
npm run android
npm run web

# Testing
npm test                    # Run all tests
npm run test:watch          # Run tests in watch mode
npm run test:coverage       # Generate coverage report

# Code quality
npm run lint                # Check for linting errors
npm run lint:fix            # Fix auto-fixable linting errors
npm run type-check          # Run TypeScript type checking
npm run prettier            # Format code with Prettier

# Build
npm run build              # Build the project
npm run build:android      # Build for Android
npm run build:ios          # Build for iOS

# Maintenance
npm run clean              # Clean install (removes node_modules, .expo)
```

### Cloud Functions (Backend)
```bash
cd functions

# Build and development
npm run build              # Compile TypeScript
npm run build:watch        # Watch mode for development
npm run serve              # Start Firebase emulators

# Testing and deployment
npm run lint               # Lint Functions code
npm run lint:fix           # Fix linting errors
npm run deploy             # Build and deploy to Firebase
npm run logs               # View Firebase Functions logs

# Firebase commands (run from project root)
firebase emulators:start   # Start all Firebase emulators
firebase deploy --only functions    # Deploy only Functions
firebase deploy --only firestore:rules  # Deploy Firestore rules
```

## Architecture

### Application Structure

**Frontend (React Native + Expo):**
- Entry point: `App.tsx` wraps the app with `AuthProvider` and `SafeAreaProvider`
- Navigation: Stack-based navigation with bottom tabs for main screens (src/navigation/AppNavigator.tsx)
- Authentication: Context-based auth state management (src/contexts/AuthContext.tsx)
- State patterns: React Context for global state, local state for component-specific data

**Backend (Firebase):**
- Authentication: Firebase Auth with email/password and phone verification
- Database: Firestore for all collections (users, items, rentals, chats, reviews, etc.)
- Storage: Firebase Storage for images (profile photos, item images, verification documents)
- Functions: Cloud Functions for business logic, Stripe webhooks, and server-side operations

### Key Services Layer

All business logic is organized in `src/services/`:

- **firestore.ts**: Generic Firestore CRUD operations with typed service classes (UserService, ItemService, RentalService, ReviewService, WalletService, NotificationService)
- **auth.ts**: Authentication operations (sign in, sign up, password reset)
- **payments.ts**: Stripe payment integration via Cloud Functions (escrow, damage claims, payouts)
- **chat.ts**: Real-time messaging functionality
- **storage.ts**: Firebase Storage operations for file uploads
- **notifications.ts**: Push notification handling with expo-notifications
- **verification.ts**: Identity verification workflows
- **location.ts**: Location services for nearby items
- **search.ts**: Item search and filtering
- **reviews.ts**: Rating and review system
- **subscriptions.ts**: Subscription tier management
- **boost.ts**: Featured listing boost functionality
- **commission.ts**: Commission calculation and processing

### Firebase Cloud Functions (functions/src/index.ts)

Critical server-side operations handled by Cloud Functions:

- **processRentalRequest**: Validates and creates rental requests with availability checking
- **processRentalResponse**: Handles owner approval/rejection and creates Stripe payment intents
- **completeRental**: Processes rental completion, damage claims, payouts
- **webhooks**: Stripe webhook handler for payment events
- **onRentalCreated/Updated**: Firestore triggers for stats updates and status changes

### Type System (src/types/index.ts)

Comprehensive TypeScript definitions for all domain models:
- User, Item, Rental, Review, Chat/Message, Notification
- Wallet transactions, payment flows, verification states
- Search filters, pagination, API responses
- Navigation types for React Navigation

### Payment Flow Architecture

The app uses an escrow-based payment system:
1. **Request**: Renter requests rental → pending status
2. **Approval**: Owner approves → Stripe Payment Intent created
3. **Payment**: Renter pays (rental amount + deposit + fees) → funds held in escrow
4. **Active**: Payment succeeds → rental becomes active
5. **Completion**: Both parties confirm → commission deducted, owner receives payout, deposit refunded (unless damage claimed)

All Stripe operations are handled server-side through Firebase Cloud Functions for security.

### Data Model Relationships

- **User** → has many **Items** (as owner)
- **User** → has many **Rentals** (as owner or renter)
- **Item** → has many **Rentals**
- **Rental** → has one **Chat** for communication
- **Rental** → has many **Reviews** (owner-to-renter and renter-to-owner)
- **User** → has many **WalletTransactions**
- **User** → has many **Notifications**

### Real-time Subscriptions

Use Firestore real-time listeners for:
- Chats and messages (live updates)
- Notifications (instant delivery)
- Rental status changes (for tracking)
- User wallet transactions

Example pattern:
```typescript
const unsubscribe = RentalService.subscribeToUserRentals(
  userId,
  (rentals) => setRentals(rentals),
  false // asOwner
);
// Clean up: unsubscribe()
```

## Environment Configuration

Required environment variables (see `.env.example`):
- Firebase config: API keys, project ID, storage bucket, app ID
- Stripe keys: publishable and secret keys (use test keys in development)
- Google Maps API key for location features
- App settings: search radius, commission rate, max photos

Firebase configuration is loaded from environment variables prefixed with `EXPO_PUBLIC_` for Expo compatibility.

## Business Rules

### Payment & Commission
- Platform fee: 10% of rental subtotal
- Security deposits are required and held in escrow
- Commission is automatically deducted at payout (handled by commission.ts service)
- Stripe processing fees apply to all transactions

### Cancellation Policy
- 24h+ before start: Full rental refund
- Less than 24h: 50% refund
- No-show: 0% refund
- Deposit always refunded unless damage reported

### Verification Requirements
- Unverified users can browse only
- Identity verification (ID + selfie) required for listing items or making rental requests
- Verification status checked in Cloud Functions before critical operations

### Availability & Booking
- Items have calendar-based availability (src/components/calendar/AvailabilityCalendar.tsx)
- Cloud Functions check for conflicting rentals before approval
- Minimum and maximum rental period enforced per item

## Testing Strategy

- Jest for unit tests (tests should be in `__tests__` directories)
- Setup file: `src/setupTests.ts`
- Test pattern: `**/__tests__/**/*.test.(ts|tsx|js|jsx)`
- Coverage collected from `src/**/*.{ts,tsx}` (excluding .d.ts files)

## Common Patterns

### Service Layer Usage
Always use service classes instead of direct Firestore calls:
```typescript
// Good
const item = await ItemService.getItem(itemId);

// Avoid
const itemDoc = await getDoc(doc(db, 'items', itemId));
```

### Error Handling
Use Firebase's error handling utility:
```typescript
import { handleFirebaseError } from '../config/firebase';

try {
  await operation();
} catch (error) {
  const appError = handleFirebaseError(error);
  // Show user-friendly message: appError.message
}
```

### Navigation
Use typed navigation params:
```typescript
import { RootStackParamList } from '../types';
import { NavigationProp } from '@react-navigation/native';

type Props = {
  navigation: NavigationProp<RootStackParamList, 'ItemDetails'>;
};
```

### Cloud Function Calls
Client-side calls to Cloud Functions use Firebase SDK:
```typescript
import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';

const processRental = httpsCallable(functions, 'processRentalRequest');
const result = await processRental({ itemId, startDate, endDate });
```

## Important Notes

- Node.js version: 18+ (specified in functions/package.json)
- React Native version: 0.72.6
- Expo SDK: ~49.0.15
- Firebase Admin SDK in Cloud Functions should use v12+
- Stripe API version: 2023-10-16 (in Cloud Functions)
- All Stripe operations must be server-side (Cloud Functions) - never use Stripe secret keys in client code
- Firebase emulators can be used for local development (configure in app.json extra.useEmulators)
- The app uses React Navigation v6 with both stack and tab navigators
- Commission processing is automated when rentals are completed (see RentalService.completeRental)
