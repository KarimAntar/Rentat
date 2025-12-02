import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { collection, query, where, onSnapshot, orderBy, Unsubscribe, getDocs, updateDoc, doc, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuthContext } from './AuthContext';
import { DashboardState, Deposit, DashboardNotification } from '../types/dashboard';
import { Rental, WalletTransaction } from '../types/index';

interface DashboardContextType extends DashboardState {
  refreshDeposits: () => Promise<void>;
  refreshActiveOrders: () => Promise<void>;
  refreshWallet: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  markNotificationAsRead: (notificationId: string) => Promise<void>;
  markAllNotificationsAsRead: () => Promise<void>;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export const DashboardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuthContext();
  
  const [state, setState] = useState<DashboardState>({
    deposits: [],
    activeOrders: [],
    walletTransactions: [],
    notifications: [],
    unreadCount: 0,
    loading: {
      deposits: true,
      orders: true,
      wallet: true,
      notifications: true,
    },
    error: {
      deposits: null,
      orders: null,
      wallet: null,
      notifications: null,
    },
  });

  // Refresh deposits
  const refreshDeposits = useCallback(async () => {
    if (!user) return;

    setState(prev => ({
      ...prev,
      loading: { ...prev.loading, deposits: true },
      error: { ...prev.error, deposits: null },
    }));

    try {
      const depositsRef = collection(db, 'deposits');
      const q = query(
        depositsRef,
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      const deposits: Deposit[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as Deposit[];

      setState(prev => ({
        ...prev,
        deposits,
        loading: { ...prev.loading, deposits: false },
      }));
    } catch (error: any) {
      console.error('Error fetching deposits:', error);
      setState(prev => ({
        ...prev,
        loading: { ...prev.loading, deposits: false },
        error: { ...prev.error, deposits: error.message },
      }));
    }
  }, [user]);

  // Refresh active orders
  const refreshActiveOrders = useCallback(async () => {
    if (!user) return;

    setState(prev => ({
      ...prev,
      loading: { ...prev.loading, orders: true },
      error: { ...prev.error, orders: null },
    }));

    try {
      const rentalsRef = collection(db, 'rentals');
      const activeStatuses = ['approved', 'awaiting_handover', 'active'];
      
      // Query rentals where user is renter
      const renterQuery = query(
        rentalsRef,
        where('renterId', '==', user.uid),
        where('status', 'in', activeStatuses)
      );
      
      const renterSnapshot = await getDocs(renterQuery);
      
      // Query rentals where user is owner
      const ownerQuery = query(
        rentalsRef,
        where('ownerId', '==', user.uid),
        where('status', 'in', activeStatuses)
      );
      
      const ownerSnapshot = await getDocs(ownerQuery);
      
      const rentals: Rental[] = [
        ...renterSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
          updatedAt: doc.data().updatedAt?.toDate() || new Date(),
          dates: {
            ...doc.data().dates,
            requestedStart: doc.data().dates?.requestedStart?.toDate() || new Date(),
            requestedEnd: doc.data().dates?.requestedEnd?.toDate() || new Date(),
            confirmedStart: doc.data().dates?.confirmedStart?.toDate(),
            confirmedEnd: doc.data().dates?.confirmedEnd?.toDate(),
            actualStart: doc.data().dates?.actualStart?.toDate(),
            actualEnd: doc.data().dates?.actualEnd?.toDate(),
          },
        })) as Rental[],
        ...ownerSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
          updatedAt: doc.data().updatedAt?.toDate() || new Date(),
          dates: {
            ...doc.data().dates,
            requestedStart: doc.data().dates?.requestedStart?.toDate() || new Date(),
            requestedEnd: doc.data().dates?.requestedEnd?.toDate() || new Date(),
            confirmedStart: doc.data().dates?.confirmedStart?.toDate(),
            confirmedEnd: doc.data().dates?.confirmedEnd?.toDate(),
            actualStart: doc.data().dates?.actualStart?.toDate(),
            actualEnd: doc.data().dates?.actualEnd?.toDate(),
          },
        })) as Rental[],
      ];

      // Remove duplicates and sort by date
      const uniqueRentals = Array.from(
        new Map(rentals.map(r => [r.id, r])).values()
      ).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      setState(prev => ({
        ...prev,
        activeOrders: uniqueRentals,
        loading: { ...prev.loading, orders: false },
      }));
    } catch (error: any) {
      console.error('Error fetching active orders:', error);
      setState(prev => ({
        ...prev,
        loading: { ...prev.loading, orders: false },
        error: { ...prev.error, orders: error.message },
      }));
    }
  }, [user]);

  // Refresh wallet transactions
  const refreshWallet = useCallback(async () => {
    if (!user) return;

    setState(prev => ({
      ...prev,
      loading: { ...prev.loading, wallet: true },
      error: { ...prev.error, wallet: null },
    }));

    try {
      const transactionsRef = collection(db, 'wallet_transactions');
      const q = query(
        transactionsRef,
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      const transactions: WalletTransaction[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        processedAt: doc.data().processedAt?.toDate(),
      })) as WalletTransaction[];

      setState(prev => ({
        ...prev,
        walletTransactions: transactions,
        loading: { ...prev.loading, wallet: false },
      }));
    } catch (error: any) {
      console.error('Error fetching wallet transactions:', error);
      setState(prev => ({
        ...prev,
        loading: { ...prev.loading, wallet: false },
        error: { ...prev.error, wallet: error.message },
      }));
    }
  }, [user]);

  // Refresh notifications
  const refreshNotifications = useCallback(async () => {
    if (!user) return;

    setState(prev => ({
      ...prev,
      loading: { ...prev.loading, notifications: true },
      error: { ...prev.error, notifications: null },
    }));

    try {
      const notificationsRef = collection(db, 'dashboard_notifications');
      const q = query(
        notificationsRef,
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      const notifications: DashboardNotification[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      })) as DashboardNotification[];

      const unreadCount = notifications.filter(n => !n.read).length;

      setState(prev => ({
        ...prev,
        notifications,
        unreadCount,
        loading: { ...prev.loading, notifications: false },
      }));
    } catch (error: any) {
      console.error('Error fetching notifications:', error);
      setState(prev => ({
        ...prev,
        loading: { ...prev.loading, notifications: false },
        error: { ...prev.error, notifications: error.message },
      }));
    }
  }, [user]);

  // Mark notification as read
  const markNotificationAsRead = useCallback(async (notificationId: string) => {
    if (!user) return;

    try {
      const notificationRef = doc(db, 'dashboard_notifications', notificationId);
      await updateDoc(notificationRef, {
        read: true,
      });

      setState(prev => ({
        ...prev,
        notifications: prev.notifications.map(n =>
          n.id === notificationId ? { ...n, read: true } : n
        ),
        unreadCount: Math.max(0, prev.unreadCount - 1),
      }));
    } catch (error: any) {
      console.error('Error marking notification as read:', error);
    }
  }, [user]);

  // Mark all notifications as read
  const markAllNotificationsAsRead = useCallback(async () => {
    if (!user) return;

    try {
      const batch = writeBatch(db);
      
      state.notifications
        .filter(n => !n.read)
        .forEach(notification => {
          const notificationRef = doc(db, 'dashboard_notifications', notification.id);
          batch.update(notificationRef, { read: true });
        });

      await batch.commit();

      setState(prev => ({
        ...prev,
        notifications: prev.notifications.map(n => ({ ...n, read: true })),
        unreadCount: 0,
      }));
    } catch (error: any) {
      console.error('Error marking all notifications as read:', error);
    }
  }, [user, state.notifications]);

  // Setup real-time listeners
  useEffect(() => {
    if (!user) {
      setState({
        deposits: [],
        activeOrders: [],
        walletTransactions: [],
        notifications: [],
        unreadCount: 0,
        loading: {
          deposits: false,
          orders: false,
          wallet: false,
          notifications: false,
        },
        error: {
          deposits: null,
          orders: null,
          wallet: null,
          notifications: null,
        },
      });
      return;
    }

    const unsubscribers: Unsubscribe[] = [];

    // Real-time deposits listener
    const depositsRef = collection(db, 'deposits');
    const depositsQuery = query(
      depositsRef,
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    
    const unsubDeposits = onSnapshot(
      depositsQuery,
      (snapshot) => {
        const deposits: Deposit[] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
          updatedAt: doc.data().updatedAt?.toDate() || new Date(),
        })) as Deposit[];

        setState(prev => ({
          ...prev,
          deposits,
          loading: { ...prev.loading, deposits: false },
        }));
      },
      (error) => {
        console.error('Error in deposits listener:', error);
        setState(prev => ({
          ...prev,
          loading: { ...prev.loading, deposits: false },
          error: { ...prev.error, deposits: error.message },
        }));
      }
    );
    unsubscribers.push(unsubDeposits);

    // Real-time notifications listener
    const notificationsRef = collection(db, 'dashboard_notifications');
    const notificationsQuery = query(
      notificationsRef,
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    
    const unsubNotifications = onSnapshot(
      notificationsQuery,
      (snapshot) => {
        const notifications: DashboardNotification[] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
        })) as DashboardNotification[];

        const unreadCount = notifications.filter(n => !n.read).length;

        setState(prev => ({
          ...prev,
          notifications,
          unreadCount,
          loading: { ...prev.loading, notifications: false },
        }));
      },
      (error) => {
        console.error('Error in notifications listener:', error);
        setState(prev => ({
          ...prev,
          loading: { ...prev.loading, notifications: false },
          error: { ...prev.error, notifications: error.message },
        }));
      }
    );
    unsubscribers.push(unsubNotifications);

    // Initial load for orders and wallet
    refreshActiveOrders();
    refreshWallet();

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [user, refreshActiveOrders, refreshWallet]);

  const value = useMemo(
    () => ({
      ...state,
      refreshDeposits,
      refreshActiveOrders,
      refreshWallet,
      refreshNotifications,
      markNotificationAsRead,
      markAllNotificationsAsRead,
    }),
    [
      state,
      refreshDeposits,
      refreshActiveOrders,
      refreshWallet,
      refreshNotifications,
      markNotificationAsRead,
      markAllNotificationsAsRead,
    ]
  );

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
};

export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
};
