// Core User Types
export interface User {
  uid: string;
  email: string;
  phone?: string;
  displayName: string;
  photoURL?: string;
  dateOfBirth?: Date;
  location: Location;
  verification: UserVerification;
  ratings: UserRatings;
  wallet: UserWallet;
  preferences: UserPreferences;
  stats: UserStats;
  favorites: string[]; // Array of item IDs
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  fcmTokens: string[];
}

export interface Location {
  latitude: number;
  longitude: number;
  address: string;
  city: string;
  country: string;
}

export interface UserVerification {
  isVerified: boolean;
  idDocument?: string;
  selfiePhoto?: string;
  verifiedAt?: Date;
  verificationStatus: 'pending' | 'approved' | 'rejected';
}

export interface UserRatings {
  asOwner: {
    average: number;
    count: number;
  };
  asRenter: {
    average: number;
    count: number;
  };
}

export interface UserWallet {
  balance: number;
  pendingBalance: number;
  totalEarnings: number;
  stripeAccountId?: string;
}

export interface UserPreferences {
  notifications: NotificationPreferences;
  searchRadius: number;
  currency: string;
}

export interface NotificationPreferences {
  email: {
    rentalRequests: boolean;
    rentalApprovals: boolean;
    rentalRejections: boolean;
    messages: boolean;
    reviews: boolean;
    payments: boolean;
    reminders: boolean;
    marketing: boolean;
  };
  push: {
    rentalRequests: boolean;
    rentalApprovals: boolean;
    rentalRejections: boolean;
    messages: boolean;
    reviews: boolean;
    payments: boolean;
    reminders: boolean;
  };
  sms: {
    rentalRequests: boolean;
    rentalApprovals: boolean;
    rentalRejections: boolean;
    payments: boolean;
  };
}

export interface UserStats {
  itemsListed: number;
  itemsRented: number;
  successfulRentals: number;
}

// Item Types
export interface Item {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  category: string;
  subcategory?: string;
  brand?: string;
  model?: string;
  condition: ItemCondition;
  governorate: string;
  images: string[];
  pricing: ItemPricing;
  availability: ItemAvailability;
  location: ItemLocation;
  specifications?: Record<string, string>;
  policies: ItemPolicies;
  ratings: ItemRatings;
  stats: ItemStats;
  status: ItemStatus;
  boost?: ItemBoost;
  featured: ItemFeatured;
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
}

export type ItemCondition = 'new' | 'like-new' | 'good' | 'fair' | 'poor';
export type ItemStatus = 'active' | 'inactive' | 'suspended';

export interface ItemPricing {
  dailyRate: number;
  weeklyRate?: number;
  monthlyRate?: number;
  currency: string;
  securityDeposit: number;
}

export interface ItemAvailability {
  isAvailable: boolean;
  calendar: Record<string, {
    available: boolean;
    reason?: string;
  }>;
  minRentalDays: number;
  maxRentalDays: number;
  advanceBookingDays: number;
}

export interface ItemLocation extends Location {
  pickupInstructions?: string;
  deliveryOptions: {
    pickup: boolean;
    delivery: boolean;
    meetInMiddle: boolean;
    deliveryRadius?: number;
    deliveryFee?: number;
  };
}

export interface ItemPolicies {
  cancellationPolicy: string;
  rules?: string[];
  restrictions?: string[];
}

export interface ItemRatings {
  average: number;
  count: number;
}

export interface ItemStats {
  views: number;
  favorites: number;
  totalRentals: number;
  revenue: number;
}

export interface ItemBoost {
  isActive: boolean;
  packageId: string;
  packageType: 'featured' | 'priority' | 'premium' | 'spotlight';
  startDate: Date;
  endDate: Date;
  searchBoost: number;
  visibilityBoost: number;
  badge?: {
    text: string;
    color: string;
    icon: string;
  };
  transactionId: string;
  expiredAt?: Date;
  cancelledAt?: Date;
  upgradedFrom?: string;
}

export interface ItemFeatured {
  isFeatured: boolean;
  featuredUntil?: Date;
  boostLevel: number;
}

// Rental Types
export interface Rental {
  id: string;
  itemId: string;
  ownerId: string;
  renterId: string;
  status: RentalStatus;
  dates: RentalDates;
  pricing: RentalPricing;
  payment: RentalPayment;
  delivery: RentalDelivery;
  communication: RentalCommunication;
  completion: RentalCompletion;
  cancellation?: RentalCancellation;
  createdAt: Date;
  updatedAt: Date;
  timeline: RentalTimelineEvent[];
}

export type RentalStatus = 'pending' | 'approved' | 'rejected' | 'active' | 'completed' | 'cancelled' | 'disputed';

export interface RentalDates {
  requestedStart: Date;
  requestedEnd: Date;
  confirmedStart?: Date;
  confirmedEnd?: Date;
  actualStart?: Date;
  actualEnd?: Date;
}

export interface RentalPricing {
  dailyRate: number;
  totalDays: number;
  subtotal: number;
  platformFee: number;
  securityDeposit: number;
  deliveryFee?: number;
  total: number;
  currency: string;
}

export interface RentalPayment {
  stripePaymentIntentId: string;
  stripeTransferId?: string;
  paymentStatus: PaymentStatus;
  depositStatus: DepositStatus;
  payoutStatus: PayoutStatus;
  refundAmount?: number;
}

export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded';
export type DepositStatus = 'held' | 'released' | 'claimed';
export type PayoutStatus = 'pending' | 'processing' | 'completed';

export interface RentalDelivery {
  method: 'pickup' | 'delivery' | 'meet-in-middle';
  pickupLocation?: DeliveryLocation;
  deliveryLocation?: DeliveryLocation;
}

export interface DeliveryLocation {
  latitude: number;
  longitude: number;
  address: string;
  instructions?: string;
}

export interface RentalCommunication {
  chatId: string;
  lastMessage?: Date;
}

export interface RentalCompletion {
  ownerConfirmed?: boolean;
  renterConfirmed?: boolean;
  damageReported?: DamageReport;
  completedAt?: Date;
}

export interface DamageReport {
  by: 'owner' | 'renter';
  description: string;
  images: string[];
  amount?: number;
}

export interface RentalCancellation {
  cancelledBy: 'owner' | 'renter' | 'system';
  reason: string;
  cancelledAt: Date;
  refundAmount: number;
}

export interface RentalTimelineEvent {
  event: string;
  timestamp: Date;
  actor: string;
  details?: any;
}

// Chat Types
export interface Chat {
  id: string;
  participants: string[];
  type: 'rental' | 'general';
  rentalId?: string;
  itemId?: string;
  lastMessage: LastMessage;
  metadata: ChatMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export interface LastMessage {
  text: string;
  senderId: string;
  timestamp: Date;
  type: MessageType;
}

export interface ChatMetadata {
  unreadCount: Record<string, number>;
  isActive: boolean;
  blockedBy?: string[];
}

export interface Message {
  id: string;
  senderId: string;
  type: MessageType;
  content: MessageContent;
  status: MessageStatus;
  metadata?: MessageMetadata;
  timestamp: Date;
}

export type MessageType = 'text' | 'image' | 'system' | 'location' | 'rental-request' | 'rental-update';

export interface MessageContent {
  text?: string;
  imageUrl?: string;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  systemData?: any;
}

export interface MessageStatus {
  sent: Date;
  delivered?: Date;
  read?: Date;
}

export interface MessageMetadata {
  editedAt?: Date;
  deletedAt?: Date;
  replyTo?: string;
}

// Review Types
export interface Review {
  id: string;
  rentalId: string;
  reviewerId: string;
  revieweeId: string;
  itemId: string;
  type: ReviewType;
  ratings: ReviewRatings;
  review: ReviewContent;
  response?: ReviewResponse;
  status: ReviewStatus;
  flags?: ReviewFlag[];
  helpfulVotes: HelpfulVotes;
  createdAt: Date;
  updatedAt: Date;
}

export type ReviewType = 'owner-to-renter' | 'renter-to-owner' | 'item-review';
export type ReviewStatus = 'active' | 'flagged' | 'hidden';

export interface ReviewRatings {
  overall: number;
  communication?: number;
  reliability?: number;
  condition?: number;
  accuracy?: number;
}

export interface ReviewContent {
  title?: string;
  comment: string;
  images?: string[];
}

export interface ReviewResponse {
  comment: string;
  respondedAt: Date;
}

export interface ReviewFlag {
  reason: string;
  reportedBy: string;
  reportedAt: Date;
}

export interface HelpfulVotes {
  count: number;
  voters: string[];
}

// Wallet & Transaction Types
export interface WalletTransaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  currency: string;
  status: TransactionStatus;
  relatedRentalId?: string;
  relatedItemId?: string;
  payment: TransactionPayment;
  metadata: TransactionMetadata;
  createdAt: Date;
  processedAt?: Date;
}

export type TransactionType = 'rental_payment' | 'rental_payout' | 'deposit_hold' | 'deposit_release' | 'refund' | 'fee' | 'withdrawal';
export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'cancelled';

export interface TransactionPayment {
  stripeTransactionId?: string;
  paymentMethod?: string;
  description: string;
}

export interface TransactionMetadata {
  platformFee?: number;
  processingFee?: number;
  netAmount: number;
}

// Notification Types
export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: NotificationData;
  status: NotificationStatus;
  delivery: NotificationDelivery;
  priority: NotificationPriority;
  expiresAt?: Date;
  createdAt: Date;
  readAt?: Date;
}

export type NotificationType = 'rental_request' | 'rental_approved' | 'rental_rejected' | 'message' | 'review' | 'payment' | 'reminder' | 'system';
export type NotificationStatus = 'unread' | 'read' | 'archived';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface NotificationData {
  rentalId?: string;
  itemId?: string;
  chatId?: string;
  deepLink?: string;
}

export interface NotificationDelivery {
  push?: DeliveryAttempt;
  email?: DeliveryAttempt;
  sms?: DeliveryAttempt;
}

export interface DeliveryAttempt {
  sent: boolean;
  sentAt?: Date;
  failureReason?: string;
}

// Category Types
export interface Category {
  id: string;
  name: string;
  description: string;
  icon: string;
  subcategories: Subcategory[];
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Subcategory {
  id: string;
  name: string;
  description?: string;
}

// Search & Filter Types
export interface SearchFilters {
  query?: string;
  category?: string;
  subcategory?: string;
  location?: {
    latitude: number;
    longitude: number;
    radius: number;
  };
  priceRange?: {
    min: number;
    max: number;
  };
  dateRange?: {
    start: Date;
    end: Date;
  };
  condition?: ItemCondition[];
  features?: string[];
  sortBy?: 'relevance' | 'price_low' | 'price_high' | 'distance' | 'rating' | 'newest';
}

export interface SearchResult {
  items: Item[];
  totalCount: number;
  hasMore: boolean;
  nextCursor?: string;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Form Types
export interface LoginForm {
  email: string;
  password: string;
}

export interface RegisterForm {
  email: string;
  password: string;
  confirmPassword: string;
  displayName: string;
  phone?: string;
  agreeToTerms: boolean;
}

export interface CreateItemForm {
  title: string;
  description: string;
  category: string;
  subcategory?: string;
  brand?: string;
  model?: string;
  condition: ItemCondition;
  images: string[];
  dailyRate: number;
  weeklyRate?: number;
  monthlyRate?: number;
  securityDeposit: number;
  location: Location;
  deliveryOptions: {
    pickup: boolean;
    delivery: boolean;
    meetInMiddle: boolean;
    deliveryRadius?: number;
    deliveryFee?: number;
  };
  policies: {
    cancellationPolicy: string;
    rules?: string[];
    restrictions?: string[];
  };
  specifications?: Record<string, string>;
}

export interface RentalRequestForm {
  itemId: string;
  startDate: Date;
  endDate: Date;
  deliveryMethod: 'pickup' | 'delivery' | 'meet-in-middle';
  deliveryLocation?: DeliveryLocation;
  message?: string;
}

// Navigation Types
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  ItemDetails: { itemId: string };
  CreateItem: undefined;
  EditItem: { itemId: string };
  EditProfile: undefined;
  Review: { rentalId: string; reviewType: 'owner-to-renter' | 'renter-to-owner' };
  RentalRequest: { itemId: string };
  Chat: { chatId: string };
  Profile: { userId?: string };
  Settings: undefined;
  Verification: undefined;
  EmailVerification: undefined;
  NotificationPreferences: undefined;
  Wallet: undefined;
  Referral: undefined;
  Reviews: { userId?: string; itemId?: string };
  Search: { filters?: Partial<SearchFilters> };
  Map: { filters?: Partial<SearchFilters> };
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  VerifyEmail: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Search: undefined;
  AddItem: undefined;
  Messages: undefined;
  Profile: undefined;
};

// Hook Types
export interface UseFirestoreOptions {
  realtime?: boolean;
  cache?: boolean;
}

export interface UseAuthReturn {
  user: User | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, userData: Partial<User>) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
}

// Error Types
export interface AppError {
  code: string;
  message: string;
  details?: any;
}

// Utility Types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
