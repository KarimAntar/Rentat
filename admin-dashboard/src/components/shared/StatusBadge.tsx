import React from 'react';
import { Chip } from '@mui/material';
import type { RentalStatus, DisputeStatus, PayoutRequestStatus, ItemStatus } from '../../types';

interface StatusBadgeProps {
  status: RentalStatus | DisputeStatus | PayoutRequestStatus | ItemStatus | string;
  size?: 'small' | 'medium';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'small' }) => {
  const getStatusConfig = () => {
    switch (status) {
      // Rental Statuses
      case 'pending':
        return { color: 'warning' as const, label: 'Pending' };
      case 'approved':
        return { color: 'info' as const, label: 'Approved' };
      case 'rejected':
      case 'declined':
        return { color: 'error' as const, label: 'Rejected' };
      case 'awaiting_handover':
        return { color: 'warning' as const, label: 'Awaiting Handover' };
      case 'active':
        return { color: 'success' as const, label: 'Active' };
      case 'completed':
        return { color: 'success' as const, label: 'Completed' };
      case 'cancelled':
        return { color: 'default' as const, label: 'Cancelled' };
      case 'disputed':
        return { color: 'error' as const, label: 'Disputed' };

      // Dispute Statuses
      case 'open':
        return { color: 'error' as const, label: 'Open' };
      case 'investigating':
      case 'under_review':
        return { color: 'warning' as const, label: 'Investigating' };
      case 'resolved':
        return { color: 'success' as const, label: 'Resolved' };
      case 'closed':
        return { color: 'default' as const, label: 'Closed' };

      // Payout Statuses
      case 'processing':
        return { color: 'info' as const, label: 'Processing' };

      // Item Statuses
      case 'inactive':
        return { color: 'default' as const, label: 'Inactive' };
      case 'suspended':
        return { color: 'error' as const, label: 'Suspended' };

      default:
        return { color: 'default' as const, label: status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) };
    }
  };

  const config = getStatusConfig();

  return (
    <Chip
      label={config.label}
      color={config.color}
      size={size}
      sx={{ textTransform: 'capitalize' }}
    />
  );
};
