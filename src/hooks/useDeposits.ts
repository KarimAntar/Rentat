import { useMemo } from 'react';
import { useDashboard } from '../contexts/DashboardContext';
import { Deposit } from '../types/dashboard';

export const useDeposits = () => {
  const { deposits, loading, error, refreshDeposits } = useDashboard();

  const heldDeposits = useMemo(
    () => deposits.filter(d => d.status === 'held'),
    [deposits]
  );

  const releasedDeposits = useMemo(
    () => deposits.filter(d => d.status === 'released'),
    [deposits]
  );

  const partialRefundDeposits = useMemo(
    () => deposits.filter(d => d.status === 'partial_refund'),
    [deposits]
  );

  const totalHeld = useMemo(
    () => heldDeposits.reduce((sum, d) => sum + d.amount, 0),
    [heldDeposits]
  );

  const totalReleased = useMemo(
    () => releasedDeposits.reduce((sum, d) => sum + d.amount, 0),
    [releasedDeposits]
  );

  const getDepositByRentalId = (rentalId: string): Deposit | undefined => {
    return deposits.find(d => d.rentalId === rentalId);
  };

  const getDepositsByStatus = (status: Deposit['status']): Deposit[] => {
    return deposits.filter(d => d.status === status);
  };

  return {
    deposits,
    heldDeposits,
    releasedDeposits,
    partialRefundDeposits,
    totalHeld,
    totalReleased,
    loading: loading.deposits,
    error: error.deposits,
    refreshDeposits,
    getDepositByRentalId,
    getDepositsByStatus,
  };
};
