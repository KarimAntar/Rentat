# Rentat/Rent@ - Peer-to-Peer Rental Marketplace

A mobile application that enables users to rent items from each other, built with React Native (Expo) and Firebase.

## 🚀 Features

- **User Authentication**: Email/phone signup with identity verification
- **Browse & Search**: Location-based item discovery with map view
- **Rent Items**: Request rentals with secure payment and deposit handling
- **List Items**: Create listings with photos, pricing, and availability
- **In-App Chat**: Real-time messaging between owners and renters
- **Ratings & Reviews**: Two-way rating system for trust building
- **Wallet System**: Manage earnings and payouts
- **Push Notifications**: Stay updated on rental requests and messages

## 🛠️ Tech Stack

- **Frontend**: React Native with Expo
- **Backend**: Firebase (Auth, Firestore, Storage, Cloud Functions)
- **Payments**: Stripe (with Connect for payouts)
- **Maps**: react-native-maps
- **Notifications**: expo-notifications

## 📋 Business Rules

### Payment Flow
- Full rental amount + security deposit charged upfront when approved
- Funds held in escrow until rental completion
- Deposit refunded if no damage reported
- Commission (7-12%) deducted at payout to owner

### Cancellation Policy
- **24h+ before start**: Full rental refund
- **Less than 24h**: 50% refund
- **No-show**: 0% refund
- Deposit always refunded unless damage occurred

### Verification Requirements
- Unverified users can browse only
- Listing/renting requires identity verification (ID + selfie)

### Distance & Delivery
- Default search radius: 50km
- Owners can set custom pickup/delivery options
- Delivery fees (Phase 2)

## 📁 Project Structure

```
rentat/
├── src/
│   ├── config/          # Firebase, Stripe, app configuration
│   ├── types/           # TypeScript interfaces
│   ├── services/        # Business logic layer
│   ├── hooks/           # Custom React hooks
│   ├── navigation/      # Navigation configuration
│   ├── screens/         # Screen components
│   ├── components/      # Reusable UI components
│   ├── utils/           # Helper functions
│   └── theme/           # Design system
└── functions/           # Firebase Cloud Functions
```

## 🔧 Setup Instructions

### Prerequisites
- Node.js 18+
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- Firebase CLI (`npm install -g firebase-tools`)
- iOS Simulator (Mac) or Android Studio

### Installation

1. **Clone and install dependencies**
```bash
npm install
```

2. **Configure Firebase**
```bash
# Create a Firebase project at https://console.firebase.google.com
# Copy your config to src/config/firebase.ts
```

3. **Configure Stripe**
```bash
# Get your Stripe keys from https://dashboard.stripe.com
# Add to .env file
```

4. **Set up environment variables**
```bash
cp .env.example .env
# Fill in your API keys
```

5. **Start the development server**
```bash
npm start
```

6. **Deploy Cloud Functions**
```bash
cd functions
npm install
firebase deploy --only functions
```

## 🗄️ Database Schema

### Collections

- **users**: User profiles and verification status
- **items**: Rental item listings
- **rentals**: Rental transactions and status
- **chats**: Conversation threads
- **messages**: Chat messages (subcollection)
- **reviews**: User and item reviews
- **wallet_transactions**: Payment history
- **notifications**: User notifications

## 🚦 Roadmap

### Phase 1 - MVP (Current)
- ✅ Authentication
- ✅ Item listing/browsing
- ✅ Rental requests
- ✅ Chat system
- ✅ Basic payments

### Phase 2 - Core Features
- ⏳ Identity verification
- ⏳ Map view
- ⏳ Deposit handling
- ⏳ Ratings & reviews
- ⏳ Wallet management
- ⏳ Push notifications

### Phase 3 - Scaling
- 📋 Boost listings
- 📋 Subscription tiers
- 📋 Advanced search
- 📋 Admin dashboard
- 📋 Insurance options
- 📋 Dispute resolution

## 💰 Monetization

- **Commission**: 7-12% on rental transactions
- **Boost Listings**: Featured placement ($5-20/week)
- **Subscriptions**: Unlimited listings + perks ($9.99/month)
- **Ads**: Optional for free tier users

## 🔐 Security

- Firebase Security Rules for data access
- Identity verification required for transactions
- Stripe-secured payment processing
- Encrypted chat messages
- Two-way rating system

## 📱 Development

```bash
# Start development server
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android

# Run tests
npm test

# Lint code
npm run lint
```

## 📄 License

Proprietary - All rights reserved

## 👥 Support

For questions or issues, contact: [your-email@example.com]
