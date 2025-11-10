# Rentat Database Schema Design

## Firestore Collections Structure

### 1. users
```typescript
{
  uid: string;                    // Firebase Auth UID
  email: string;
  phone?: string;
  displayName: string;
  profilePicture?: string;        // Firebase Storage URL
  dateOfBirth?: Date;
  location: {
    latitude: number;
    longitude: number;
    address: string;
    city: string;
    country: string;
  };
  verification: {
    isVerified: boolean;
    idDocument?: string;          // Firebase Storage URL
    selfiePhoto?: string;         // Firebase Storage URL
    verifiedAt?: Date;
    verificationStatus: 'pending' | 'approved' | 'rejected';
  };
  ratings: {
    asOwner: {
      average: number;
      count: number;
    };
    asRenter: {
      average: number;
      count: number;
    };
  };
  wallet: {
    balance: number;              // Available for withdrawal
    pendingBalance: number;       // Held in escrow
    totalEarnings: number;
    stripeAccountId?: string;     // Stripe Connect account
  };
  preferences: {
    notifications: {
      email: boolean;
      push: boolean;
      sms: boolean;
    };
    searchRadius: number;         // In kilometers
    currency: string;             // Default: 'USD'
  };
  stats: {
    itemsListed: number;
    itemsRented: number;
    successfulRentals: number;
  };
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  fcmTokens: string[];            // For push notifications
}
```

### 2. items
```typescript
{
  id: string;                     // Auto-generated
  ownerId: string;                // Reference to users collection
  title: string;
  description: string;
  category: string;               // 'electronics', 'furniture', 'vehicles', etc.
  subcategory?: string;
  brand?: string;
  model?: string;
  condition: 'new' | 'like-new' | 'good' | 'fair' | 'poor';
  images: string[];               // Firebase Storage URLs
  pricing: {
    dailyRate: number;
    weeklyRate?: number;          // Optional discount
    monthlyRate?: number;         // Optional discount
    currency: string;
    securityDeposit: number;
  };
  availability: {
    isAvailable: boolean;
    calendar: {
      [date: string]: {           // YYYY-MM-DD format
        available: boolean;
        reason?: string;          // 'booked', 'maintenance', etc.
      };
    };
    minRentalDays: number;        // Default: 1
    maxRentalDays: number;        // Default: 30
    advanceBookingDays: number;   // How far in advance to book
  };
  location: {
    latitude: number;
    longitude: number;
    address: string;
    city: string;
    country: string;
    pickupInstructions?: string;
    deliveryOptions: {
      pickup: boolean;            // Renter picks up
      delivery: boolean;          // Owner delivers
      meetInMiddle: boolean;
      deliveryRadius?: number;    // In kilometers
      deliveryFee?: number;
    };
  };
  specifications?: {
    [key: string]: string;        // Flexible key-value pairs
  };
  policies: {
    cancellationPolicy: string;   // 'flexible', 'moderate', 'strict'
    rules?: string[];             // Usage rules
    restrictions?: string[];      // Age, license requirements, etc.
  };
  ratings: {
    average: number;
    count: number;
  };
  stats: {
    views: number;
    favorites: number;
    totalRentals: number;
    revenue: number;
  };
  status: 'active' | 'inactive' | 'suspended';
  boost?: {
    isActive: boolean;
    packageId: string;
    packageType: 'featured' | 'priority' | 'premium' | 'spotlight';
    startDate: Date;
    endDate: Date;
    searchBoost: number;          // multiplier for search ranking
    visibilityBoost: number;      // multiplier for visibility
    badge?: {
      text: string;
      color: string;
      icon: string;
    };
    transactionId: string;
    expiredAt?: Date;
    cancelledAt?: Date;
    upgradedFrom?: string;
  };
  featured: {
    isFeatured: boolean;
    featuredUntil?: Date;
    boostLevel: number;           // 0 = normal, 1-3 = boost levels (legacy)
  };
  createdAt: Date;
  updatedAt: Date;
  tags: string[];                 // For search optimization
}
```

### 3. rentals
```typescript
{
  id: string;                     // Auto-generated
  itemId: string;                 // Reference to items collection
  ownerId: string;                // Reference to users collection
  renterId: string;               // Reference to users collection
  status: 'pending' | 'approved' | 'rejected' | 'active' | 'completed' | 'cancelled' | 'disputed';
  
  dates: {
    requestedStart: Date;
    requestedEnd: Date;
    confirmedStart?: Date;
    confirmedEnd?: Date;
    actualStart?: Date;           // When item was picked up
    actualEnd?: Date;             // When item was returned
  };
  
  pricing: {
    dailyRate: number;
    totalDays: number;
    subtotal: number;
    platformFee: number;          // 7-12% commission
    securityDeposit: number;
    deliveryFee?: number;
    total: number;
    currency: string;
  };
  
  payment: {
    stripePaymentIntentId: string;
    stripeTransferId?: string;    // For payout to owner
    paymentStatus: 'pending' | 'succeeded' | 'failed' | 'refunded';
    depositStatus: 'held' | 'released' | 'claimed';
    payoutStatus: 'pending' | 'processing' | 'completed';
    refundAmount?: number;
  };
  
  delivery: {
    method: 'pickup' | 'delivery' | 'meet-in-middle';
    pickupLocation?: {
      latitude: number;
      longitude: number;
      address: string;
      instructions?: string;
    };
    deliveryLocation?: {
      latitude: number;
      longitude: number;
      address: string;
      instructions?: string;
    };
  };
  
  communication: {
    chatId: string;               // Reference to chats collection
    lastMessage?: Date;
  };
  
  completion: {
    ownerConfirmed?: boolean;
    renterConfirmed?: boolean;
    damageReported?: {
      by: 'owner' | 'renter';
      description: string;
      images: string[];
      amount?: number;
    };
    completedAt?: Date;
  };
  
  cancellation?: {
    cancelledBy: 'owner' | 'renter' | 'system';
    reason: string;
    cancelledAt: Date;
    refundAmount: number;
  };
  
  createdAt: Date;
  updatedAt: Date;
  timeline: Array<{
    event: string;
    timestamp: Date;
    actor: string;                // User ID who performed action
    details?: any;
  }>;
}
```

### 4. chats
```typescript
{
  id: string;                     // Auto-generated
  participants: string[];         // Array of user IDs
  type: 'rental' | 'general';
  rentalId?: string;              // If related to a rental
  itemId?: string;                // If related to an item
  
  lastMessage: {
    text: string;
    senderId: string;
    timestamp: Date;
    type: 'text' | 'image' | 'system';
  };
  
  metadata: {
    unreadCount: {
      [userId: string]: number;
    };
    isActive: boolean;
    blockedBy?: string[];         // User IDs who blocked this chat
  };
  
  createdAt: Date;
  updatedAt: Date;
}
```

### 5. messages (subcollection of chats)
```typescript
{
  id: string;                     // Auto-generated
  senderId: string;               // Reference to users collection
  type: 'text' | 'image' | 'system' | 'location' | 'rental-request' | 'rental-update';
  content: {
    text?: string;
    imageUrl?: string;
    location?: {
      latitude: number;
      longitude: number;
      address?: string;
    };
    systemData?: any;             // For system messages
  };
  
  status: {
    sent: Date;
    delivered?: Date;
    read?: Date;
  };
  
  metadata?: {
    editedAt?: Date;
    deletedAt?: Date;
    replyTo?: string;             // Message ID being replied to
  };
  
  timestamp: Date;
}
```

### 6. reviews
```typescript
{
  id: string;                     // Auto-generated
  rentalId: string;               // Reference to rentals collection
  reviewerId: string;             // User writing the review
  revieweeId: string;             // User being reviewed
  itemId: string;                 // Reference to items collection
  
  type: 'owner-to-renter' | 'renter-to-owner' | 'item-review';
  
  ratings: {
    overall: number;              // 1-5 stars
    communication?: number;       // For user reviews
    reliability?: number;         // For user reviews
    condition?: number;           // For item reviews
    accuracy?: number;            // For item reviews
  };
  
  review: {
    title?: string;
    comment: string;
    images?: string[];            // Optional photos
  };
  
  response?: {
    comment: string;
    respondedAt: Date;
  };
  
  status: 'active' | 'flagged' | 'hidden';
  flags?: Array<{
    reason: string;
    reportedBy: string;
    reportedAt: Date;
  }>;
  
  helpfulVotes: {
    count: number;
    voters: string[];             // User IDs who found it helpful
  };
  
  createdAt: Date;
  updatedAt: Date;
}
```

### 7. wallet_transactions
```typescript
{
  id: string;                     // Auto-generated
  userId: string;                 // Reference to users collection
  type: 'rental_payment' | 'rental_payout' | 'deposit_hold' | 'deposit_release' | 'refund' | 'fee' | 'withdrawal';
  
  amount: number;
  currency: string;
  
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  
  relatedRentalId?: string;       // If transaction is rental-related
  relatedItemId?: string;
  
  payment: {
    stripeTransactionId?: string;
    paymentMethod?: string;
    description: string;
  };
  
  metadata: {
    platformFee?: number;
    processingFee?: number;
    netAmount: number;            // Amount after fees
  };
  
  createdAt: Date;
  processedAt?: Date;
}
```

### 8. notifications
```typescript
{
  id: string;                     // Auto-generated
  userId: string;                 // Reference to users collection
  type: 'rental_request' | 'rental_approved' | 'rental_rejected' | 'message' | 'review' | 'payment' | 'reminder' | 'system';
  
  title: string;
  body: string;
  
  data?: {
    rentalId?: string;
    itemId?: string;
    chatId?: string;
    deepLink?: string;            // For navigation
  };
  
  status: 'unread' | 'read' | 'archived';
  
  delivery: {
    push?: {
      sent: boolean;
      sentAt?: Date;
      failureReason?: string;
    };
    email?: {
      sent: boolean;
      sentAt?: Date;
      failureReason?: string;
    };
    sms?: {
      sent: boolean;
      sentAt?: Date;
      failureReason?: string;
    };
  };
  
  priority: 'low' | 'normal' | 'high' | 'urgent';
  expiresAt?: Date;               // For time-sensitive notifications
  
  createdAt: Date;
  readAt?: Date;
}
```

### 9. categories (Reference Data)
```typescript
{
  id: string;                     // e.g., 'electronics'
  name: string;                   // Display name
  description: string;
  icon: string;                   // Icon name or URL
  subcategories: Array<{
    id: string;
    name: string;
    description?: string;
  }>;
  
  isActive: boolean;
  sortOrder: number;
  
  createdAt: Date;
  updatedAt: Date;
}
```

### 10. boost_transactions
```typescript
{
  id: string;                     // Auto-generated
  itemId: string;                 // Reference to items collection
  ownerId: string;                // Reference to users collection
  packageId: string;              // Boost package identifier
  packageType: 'featured' | 'priority' | 'premium' | 'spotlight';
  amount: number;                 // Amount in cents
  duration: number;               // Duration in days
  status: 'pending' | 'active' | 'expired' | 'cancelled';

  startDate: Date;
  endDate: Date;
  paymentIntentId?: string;       // Stripe payment intent ID

  benefits: string[];             // Array of benefit descriptions
  searchBoost: number;            // Search ranking multiplier
  visibilityBoost: number;        // Visibility multiplier

  cancelledAt?: Date;
  refundAmount?: number;          // Amount refunded in cents

  createdAt: Date;
  updatedAt: Date;
}
```

### 11. platform_revenue
```typescript
{
  id: string;                     // Auto-generated
  type: 'boost_fee' | 'rental_commission' | 'subscription_fee' | 'other';
  source: 'listing_boost' | 'rental' | 'subscription' | 'referral' | 'other';

  amount: number;                 // Amount in cents
  currency: string;               // Default: 'USD'

  itemId?: string;                // Reference to items collection
  ownerId?: string;               // Reference to users collection
  rentalId?: string;              // Reference to rentals collection

  date: Date;
  processedAt?: Date;

  metadata: {
    packageId?: string;
    packageType?: string;
    duration?: number;
    searchBoost?: number;
    visibilityBoost?: number;
    commissionRate?: number;
    [key: string]: any;
  };
}
```

### 12. refund_requests
```typescript
{
  id: string;                     // Auto-generated
  transactionId: string;          // Reference to boost_transactions
  ownerId: string;                // Reference to users collection
  itemId: string;                 // Reference to items collection

  originalAmount: number;         // Original transaction amount in cents
  refundAmount: number;           // Amount to refund in cents
  refundRatio: number;            // Ratio of refund (0-1)

  status: 'pending' | 'processing' | 'completed' | 'failed';
  reason: string;                 // Reason for refund

  stripeRefundId?: string;        // Stripe refund ID
  failureReason?: string;         // If refund failed

  createdAt: Date;
  processedAt?: Date;
}
```

### 13. admin_logs (For Admin Dashboard)
```typescript
{
  id: string;
  adminId: string;
  action: string;                 // 'user_suspended', 'item_flagged', etc.
  targetType: 'user' | 'item' | 'rental' | 'review' | 'boost';
  targetId: string;

  details: {
    reason?: string;
    notes?: string;
    previousState?: any;
    newState?: any;
  };

  timestamp: Date;
}
```

## Indexing Strategy

### Compound Indexes
```javascript
// Items collection
{ category: 1, status: 1, "location.city": 1 }
{ ownerId: 1, status: 1, createdAt: -1 }
{ "availability.isAvailable": 1, "location.city": 1, "pricing.dailyRate": 1 }

// Rentals collection
{ renterId: 1, status: 1, createdAt: -1 }
{ ownerId: 1, status: 1, createdAt: -1 }
{ itemId: 1, status: 1, "dates.requestedStart": 1 }

// Reviews collection
{ revieweeId: 1, type: 1, createdAt: -1 }
{ itemId: 1, status: 1, createdAt: -1 }

// Notifications collection
{ userId: 1, status: 1, createdAt: -1 }
{ userId: 1, type: 1, createdAt: -1 }
```

## Data Relationships

1. **Users** ↔ **Items** (one-to-many: owner relationship)
2. **Items** ↔ **Rentals** (one-to-many: rental history)
3. **Users** ↔ **Rentals** (many-to-many: as owner or renter)
4. **Rentals** ↔ **Chats** (one-to-one: communication)
5. **Chats** ↔ **Messages** (one-to-many: subcollection)
6. **Rentals** ↔ **Reviews** (one-to-many: multiple review types)
7. **Users** ↔ **Wallet_Transactions** (one-to-many: payment history)
8. **Users** ↔ **Notifications** (one-to-many: user notifications)

## Security Considerations

1. **Field-level security**: Sensitive fields (payment info, personal details) have restricted access
2. **User isolation**: Users can only access their own data and public data of others
3. **Rental access**: Only rental participants can access rental details
4. **Chat privacy**: Only chat participants can read messages
5. **Admin access**: Separate admin roles with elevated permissions
6. **Audit trails**: All critical actions are logged with timestamps and user IDs
