import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Alert,
} from '@mui/material';

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

interface DepositActionModalProps {
  open: boolean;
  deposit: Deposit | null;
  action: 'release' | 'partial' | 'hold' | null;
  onClose: () => void;
  onSubmit: (depositId: string, action: string, reason: string, amount?: number) => Promise<void>;
}

export const DepositActionModal: React.FC<DepositActionModalProps> = ({
  open,
  deposit,
  action,
  onClose,
  onSubmit,
}) => {
  const [reason, setReason] = useState('');
  const [partialAmount, setPartialAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setReason('');
    setPartialAmount('');
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!deposit || !action) return;

    if (!reason.trim()) {
      setError('Reason is required');
      return;
    }

    if (action === 'partial') {
      const amount = parseFloat(partialAmount);
      if (isNaN(amount) || amount <= 0) {
        setError('Please enter a valid amount');
        return;
      }
      if (amount > deposit.amount) {
        setError('Partial amount cannot exceed total deposit amount');
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const amount = action === 'partial' ? parseFloat(partialAmount) : undefined;
      await onSubmit(deposit.id, action, reason, amount);
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Failed to process action');
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    switch (action) {
      case 'release':
        return 'Release Full Deposit';
      case 'partial':
        return 'Partial Deposit Release';
      case 'hold':
        return 'Hold Deposit';
      default:
        return 'Deposit Action';
    }
  };

  const getDescription = () => {
    switch (action) {
      case 'release':
        return 'Release the full deposit amount back to the user. This action cannot be undone.';
      case 'partial':
        return 'Release a partial amount of the deposit. The remaining amount will stay held.';
      case 'hold':
        return 'Continue holding this deposit. Provide a reason for keeping it held.';
      default:
        return '';
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{getTitle()}</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            {getDescription()}
          </Typography>

          {deposit && (
            <Box sx={{ mb: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
              <Typography variant="body2">
                <strong>Deposit Amount:</strong> {deposit.amount.toFixed(2)} {deposit.currency}
              </Typography>
              <Typography variant="body2">
                <strong>Rental ID:</strong> {deposit.rentalId}
              </Typography>
              <Typography variant="body2">
                <strong>User ID:</strong> {deposit.userId}
              </Typography>
            </Box>
          )}

          {action === 'partial' && (
            <TextField
              fullWidth
              label="Partial Amount"
              type="number"
              value={partialAmount}
              onChange={(e) => setPartialAmount(e.target.value)}
              inputProps={{ step: '0.01', min: '0', max: deposit?.amount }}
              sx={{ mb: 2 }}
              helperText={`Enter amount between 0 and ${deposit?.amount || 0} ${deposit?.currency || 'EGP'}`}
            />
          )}

          <TextField
            fullWidth
            label="Reason"
            multiline
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Provide a reason for this action..."
            required
          />

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading}
          color={action === 'release' ? 'success' : action === 'partial' ? 'info' : 'warning'}
        >
          {loading ? 'Processing...' : 'Confirm'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
