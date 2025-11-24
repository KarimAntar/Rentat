// Admin Role Types
export type AdminRole = 'super_admin' | 'moderator' | 'analyst';

export interface AdminUser {
  uid: string;
  email: string;
  displayName: string;
  role: AdminRole;
  permissions: AdminPermissions;
  createdAt: Date;
  lastLogin?: Date;
  isActive: boolean;
}

export interface AdminPermissions {
  users: {
    view: boolean;
    edit: boolean;
    suspend: boolean;
    delete: boolean;
  };
  content: {
    view: boolean;
    moderate: boolean;
    delete: boolean;
  };
  analytics: {
    view: boolean;
    export: boolean;
  };
  notifications: {
    send: boolean;
    schedule: boolean;
  };
  featureFlags: {
    view: boolean;
    edit: boolean;
  };
  system: {
    viewLogs: boolean;
    manageAdmins: boolean;
  };
}

// Audit Log Types
export interface AuditLog {
  id: string;
  adminId: string;
  adminEmail: string;
  action: AuditAction;
  resource: string;
  resourceId: string;
  changes?: Record<string, any>;
  metadata?: Record<string, any>;
  timestamp: Date;
  ipAddress?: string;
}

export type AuditAction = 
  | 'user_suspended'
  | 'user_activated'
  | 'user_deleted'
  | 'content_approved'
  | 'content_rejected'
  | 'content_deleted'
  | 'notification_sent'
  | 'feature_flag_updated'
  | 'admin_created'
  | 'admin_deleted';

// Feature Flag Types
export interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  isEnabled: boolean;
  targetAudience: FeatureFlagAudience;
  rolloutPercentage: number;
  conditions?: FeatureFlagCondition[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FeatureFlagAudience {
  type: 'all' | 'percentage' | 'whitelist' | 'custom';
  userIds?: string[];
  segments?: string[];
}

export interface FeatureFlagCondition {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than';
  value: any;
}

// Notification Campaign Types
export interface NotificationCampaign {
  id: string;
  title: string;
  message: string;
  imageUrl?: string;
  targetAudience: NotificationAudience;
  scheduling: NotificationScheduling;
  status: CampaignStatus;
  stats: CampaignStats;
  createdBy: string;
  createdAt: Date;
  sentAt?: Date;
}

export interface NotificationAudience {
  type: 'all' | 'segment' | 'custom';
  userIds?: string[];
  filters?: NotificationFilter[];
}

export interface NotificationFilter {
  field: 'verified' | 'location' | 'lastActive' | 'itemsListed' | 'rentalsCompleted';
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than';
  value: any;
}

export interface NotificationScheduling {
  type: 'immediate' | 'scheduled';
  scheduledAt?: Date;
}

export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled';

export interface CampaignStats {
  targetUsers: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  failed: number;
}

// Analytics Types
export interface DashboardStats {
  users: UserStats;
  items: ItemStats;
  rentals: RentalStats;
  revenue: RevenueStats;
  engagement: EngagementStats;
}

export interface UserStats {
  total: number;
  active: number;
  new: number;
  verified: number;
  suspended: number;
  growth: GrowthMetric[];
}

export interface ItemStats {
  total: number;
  active: number;
  pending: number;
  suspended: number;
  byCategory: Record<string, number>;
}

export interface RentalStats {
  total: number;
  active: number;
  completed: number;
  cancelled: number;
  disputed: number;
  revenue: number;
}

export interface RevenueStats {
  totalGMV: number;
  platformFees: number;
  payouts: number;
  pending: number;
  byPeriod: RevenueByPeriod[];
}

export interface RevenueByPeriod {
  period: string;
  gmv: number;
  fees: number;
  payouts: number;
}

export interface EngagementStats {
  dailyActiveUsers: number;
  monthlyActiveUsers: number;
  averageSessionDuration: number;
  searchesPerUser: number;
  messagesPerUser: number;
}

export interface GrowthMetric {
  date: string;
  count: number;
}

// Dispute Types
export interface Dispute {
  id: string;
  rentalId: string;
  itemId: string;
  reportedBy: string;
  reportedAgainst: string;
  reason: DisputeReason;
  description: string;
  evidence: DisputeEvidence[];
  status: DisputeStatus;
  resolution?: DisputeResolution;
  assignedTo?: string;
  createdAt: Date;
  resolvedAt?: Date;
}

export type DisputeReason = 
  | 'item_not_as_described'
  | 'item_damaged'
  | 'item_not_returned'
  | 'payment_issue'
  | 'inappropriate_behavior'
  | 'other';

export type DisputeStatus = 'open' | 'investigating' | 'resolved' | 'closed';

export interface DisputeEvidence {
  type: 'image' | 'document' | 'message';
  url: string;
  uploadedBy: string;
  uploadedAt: Date;
}

export interface DisputeResolution {
  decision: string;
  refundAmount?: number;
  penaltyAmount?: number;
  notes: string;
  resolvedBy: string;
  resolvedAt: Date;
}

// Content Moderation Types
export interface ModerationQueue {
  id: string;
  type: 'item' | 'review' | 'message' | 'profile';
  resourceId: string;
  reason: ModerationReason;
  status: ModerationStatus;
  priority: ModerationPriority;
  assignedTo?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  decision?: ModerationDecision;
  notes?: string;
  createdAt: Date;
}

export type ModerationReason = 
  | 'flagged_by_user'
  | 'automated_detection'
  | 'admin_review';

export type ModerationStatus = 'pending' | 'reviewing' | 'resolved';
export type ModerationPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface ModerationDecision {
  action: 'approve' | 'reject' | 'require_changes' | 'suspend_user';
  reason: string;
  timestamp: Date;
}

// System Health Types
export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'down';
  services: ServiceHealth[];
  lastChecked: Date;
}

export interface ServiceHealth {
  name: string;
  status: 'up' | 'down' | 'degraded';
  responseTime?: number;
  errorRate?: number;
  lastError?: string;
}

// Filter and Pagination Types
export interface FilterOptions {
  search?: string;
  status?: string;
  dateRange?: DateRange;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface PaginationParams {
  page: number;
  limit: number;
  total?: number;
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

// Payout Request Types
export interface PayoutRequest {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  status: PayoutRequestStatus;
  method: PayoutMethod;
  accountDetails: PayoutAccountDetails;
  requestedAt: Date;
  processedAt?: Date;
  processedBy?: string;
  rejectionReason?: string;
  notes?: string;
}

export type PayoutRequestStatus = 'pending' | 'approved' | 'processing' | 'completed' | 'rejected';
export type PayoutMethod = 'bank_transfer' | 'mobile_wallet' | 'paypal';

export interface PayoutAccountDetails {
  type: PayoutMethod;
  bankName?: string;
  accountNumber?: string;
  accountHolder?: string;
  walletNumber?: string;
  walletProvider?: string;
  email?: string;
}

// Wallet Balance Types
export interface WalletBalance {
  userId: string;
  available: number;
  pending: number;
  locked: number;
  total: number;
}

// Handover Monitoring Types
export interface HandoverMonitoring {
  rentalId: string;
  itemId: string;
  ownerId: string;
  renterId: string;
  status: 'awaiting_handover';
  paymentReceivedAt: Date;
  hoursSincePayment: number;
  renterConfirmed: boolean;
  ownerConfirmed: boolean;
  remindersSent: number;
  lastReminderAt?: Date;
}

// Import types from main app (these will be shared)
export type {
  Item,
  Rental,
  Review,
  Chat,
  Message,
  WalletTransaction,
  Notification,
  RentalStatus,
  ItemStatus,
  PaymentStatus,
  ItemCondition,
  TransactionAvailabilityStatus,
  RentalHandover,
  RentalDispute,
} from '../../../src/types/index';

// Import base User type and extend it with admin-specific fields
import { User as BaseUser } from '../../../src/types/index';

// Extended User type with admin-specific fields
export interface User extends Omit<BaseUser, 'uid'> {
  id: string; // For DataGrid compatibility
  uid: string;
  phoneNumber?: string; // Alias for phone
  isBanned?: boolean; // Admin field
  verificationStatus?: string; // Flattened from verification.verificationStatus
  governorate?: string; // Flattened from location.city
}
