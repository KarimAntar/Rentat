import { useMemo } from 'react';
import { useDashboard } from '../contexts/DashboardContext';
import { Rental } from '../types/index';

export const useActiveOrders = () => {
  const { activeOrders, loading, error, refreshActiveOrders } = useDashboard();

  const asRenter = useMemo(
    () => activeOrders.filter(order => order.renterId === order.renterId),
    [activeOrders]
  );

  const asOwner = useMemo(
    () => activeOrders.filter(order => order.ownerId === order.ownerId),
    [activeOrders]
  );

  const approved = useMemo(
    () => activeOrders.filter(order => order.status === 'approved'),
    [activeOrders]
  );

  const awaitingHandover = useMemo(
    () => activeOrders.filter(order => order.status === 'awaiting_handover'),
    [activeOrders]
  );

  const active = useMemo(
    () => activeOrders.filter(order => order.status === 'active'),
    [activeOrders]
  );

  const getOrderById = (rentalId: string): Rental | undefined => {
    return activeOrders.find(order => order.id === rentalId);
  };

  const getOrdersByStatus = (status: Rental['status']): Rental[] => {
    return activeOrders.filter(order => order.status === status);
  };

  const getOrdersByItemId = (itemId: string): Rental[] => {
    return activeOrders.filter(order => order.itemId === itemId);
  };

  const requiresAction = useMemo(() => {
    return activeOrders.filter(order => {
      // Orders requiring handover confirmation
      if (order.status === 'awaiting_handover') {
        const handover = order.handover;
        if (!handover) return true;
        return !handover.renterConfirmed || !handover.ownerConfirmed;
      }
      // Approved orders awaiting payment
      if (order.status === 'approved') {
        return order.payment.paymentStatus === 'pending';
      }
      return false;
    });
  }, [activeOrders]);

  return {
    activeOrders,
    asRenter,
    asOwner,
    approved,
    awaitingHandover,
    active,
    requiresAction,
    loading: loading.orders,
    error: error.orders,
    refreshActiveOrders,
    getOrderById,
    getOrdersByStatus,
    getOrdersByItemId,
  };
};
