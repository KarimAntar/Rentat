import { useMemo } from 'react';
import { useDashboard } from '../contexts/DashboardContext';
import { DashboardNotification } from '../types/dashboard';

export const useDashboardNotifications = () => {
  const {
    notifications,
    unreadCount,
    loading,
    error,
    refreshNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
  } = useDashboard();

  const unreadNotifications = useMemo(
    () => notifications.filter(n => !n.read),
    [notifications]
  );

  const readNotifications = useMemo(
    () => notifications.filter(n => n.read),
    [notifications]
  );

  const orderNotifications = useMemo(
    () => notifications.filter(n => n.type === 'order'),
    [notifications]
  );

  const paymentNotifications = useMemo(
    () => notifications.filter(n => n.type === 'payment'),
    [notifications]
  );

  const depositNotifications = useMemo(
    () => notifications.filter(n => n.type === 'deposit'),
    [notifications]
  );

  const systemNotifications = useMemo(
    () => notifications.filter(n => n.type === 'system'),
    [notifications]
  );

  const getNotificationsByType = (type: DashboardNotification['type']): DashboardNotification[] => {
    return notifications.filter(n => n.type === type);
  };

  const getNotificationById = (id: string): DashboardNotification | undefined => {
    return notifications.find(n => n.id === id);
  };

  const recentNotifications = useMemo(() => {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return notifications.filter(n => n.createdAt >= oneDayAgo);
  }, [notifications]);

  return {
    notifications,
    unreadNotifications,
    readNotifications,
    orderNotifications,
    paymentNotifications,
    depositNotifications,
    systemNotifications,
    recentNotifications,
    unreadCount,
    loading: loading.notifications,
    error: error.notifications,
    refreshNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    getNotificationsByType,
    getNotificationById,
  };
};
