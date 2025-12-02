import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  Typography,
  Box,
} from '@mui/material';
import { CheckCircle, Cancel, HourglassEmpty } from '@mui/icons-material';

interface Deposit {
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

interface DepositTableProps {
  deposits: Deposit[];
  onActionClick: (deposit: Deposit, action: 'release' | 'partial' | 'hold') => void;
}

export const DepositTable: React.FC<DepositTableProps> = ({ deposits, onActionClick }) => {
  const getStatusColor = (status: Deposit['status']) => {
    switch (status) {
      case 'held':
        return 'warning';
      case 'released':
        return 'success';
      case 'partial_refund':
        return 'info';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status: Deposit['status']) => {
    switch (status) {
      case 'held':
        return 'Held';
      case 'released':
        return 'Released';
      case 'partial_refund':
        return 'Partial Refund';
      default:
        return status;
    }
  };

  const formatAmount = (amount: number, currency: string) => {
    return `${amount.toFixed(2)} ${currency}`;
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableCell>Rental ID</TableCell>
          <TableCell>User ID</TableCell>
          <TableCell>Amount</TableCell>
          <TableCell>Status</TableCell>
          <TableCell>Created At</TableCell>
          <TableCell>Actions</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {deposits.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} align="center">
              <Typography variant="body2" color="textSecondary">
                No deposits found
              </Typography>
            </TableCell>
          </TableRow>
        ) : (
          deposits.map((deposit) => (
            <TableRow key={deposit.id}>
              <TableCell>
                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                  {deposit.rentalId.substring(0, 8)}...
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                  {deposit.userId.substring(0, 8)}...
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2" fontWeight="600">
                  {formatAmount(deposit.amount, deposit.currency)}
                </Typography>
                {deposit.status === 'partial_refund' && deposit.partialAmount && (
                  <Typography variant="caption" color="textSecondary">
                    Refunded: {formatAmount(deposit.partialAmount, deposit.currency)}
                  </Typography>
                )}
              </TableCell>
              <TableCell>
                <Chip
                  label={getStatusLabel(deposit.status)}
                  color={getStatusColor(deposit.status)}
                  size="small"
                />
              </TableCell>
              <TableCell>
                <Typography variant="body2">
                  {formatDate(deposit.createdAt)}
                </Typography>
              </TableCell>
              <TableCell>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {deposit.status === 'held' && (
                    <>
                      <Tooltip title="Release Full Deposit">
                        <IconButton
                          size="small"
                          color="success"
                          onClick={() => onActionClick(deposit, 'release')}
                        >
                          <CheckCircle />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Partial Release">
                        <IconButton
                          size="small"
                          color="info"
                          onClick={() => onActionClick(deposit, 'partial')}
                        >
                          <HourglassEmpty />
                        </IconButton>
                      </Tooltip>
                    </>
                  )}
                  {deposit.status !== 'held' && (
                    <Tooltip title="Hold Deposit">
                      <IconButton
                        size="small"
                        color="warning"
                        onClick={() => onActionClick(deposit, 'hold')}
                      >
                        <Cancel />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
};
