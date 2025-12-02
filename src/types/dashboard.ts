import { Rental, WalletTransaction } from './index';

export interface Deposit {
  id: string;
  rentalId: string;
  userId: string;
  amount: number;
  currency: string;
  status: 'held' | 'released' | 'partial_refund';
  holdReason?: string;
  releaseReason?: string;
  partialAmount?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DashboardNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'order' | 'payment' | 'deposit' | 'system';
  read: boolean;
  data?: Record<string, any>;
  createdAt: Date;
}

export interface DashboardState {
  deposits: Deposit[];
  activeOrders: Rental[];
  walletTransactions: WalletTransaction[];
  notifications: DashboardNotification[];
  unreadCount: number;
  loading: {
    deposits: boolean;
    orders: boolean;
    wallet: boolean;
    notifications: boolean;
  };
  error: {
    deposits: string | null;
    orders: string | null;
    wallet: string | null;
    notifications: string | null;
  };
}

export interface DepositAction {
  depositId: string;
  actionType: 'release_full' | 'release_partial' | 'hold';
  amount?: number;
  reason: string;
}
