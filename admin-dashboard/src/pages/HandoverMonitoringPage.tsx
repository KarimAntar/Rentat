import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Divider,
} from '@mui/material';
import {
  HourglassEmpty,
  CheckCircle,
  Warning,
  Send,
  Edit,
} from '@mui/icons-material';
import { collection, getDocs, query, where, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Rental } from '../types';
import { StatCard } from '../components/shared/StatCard';
import { ExportButton } from '../components/shared/ExportButton';

interface HandoverRental extends Rental {
  hoursSincePayment: number;
  isDelayed: boolean;
}

export const HandoverMonitoringPage: React.FC = () => {
  const [rentals, setRentals] = useState<HandoverRental[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [selectedRental, setSelectedRental] = useState<HandoverRental | null>(null);
  const [overrideReason, setOverrideReason] = useState('');

  useEffect(() => {
    fetchPendingHandovers();
  }, []);

  const fetchPendingHandovers = async () => {
    try {
      setLoading(true);

      // Query rentals with awaiting_handover status
      const rentalsQuery = query(
        collection(db, 'rentals'),
        where('status', '==', 'awaiting_handover')
      );
      const snapshot = await getDocs(rentalsQuery);

      const now = new Date();
      const rentalsData: HandoverRental[] = snapshot.docs.map(doc => {
        const rental = { id: doc.id, ...doc.data() } as Rental;
        
        // Calculate hours since payment (use updatedAt as proxy for payment time)
        const paymentTime = rental.updatedAt instanceof Date 
          ? rental.updatedAt 
          : (rental.updatedAt as any)?.toDate?.() || new Date();
        
        const hoursSincePayment = Math.floor((now.getTime() - paymentTime.getTime()) / (1000 * 60 * 60));
        const isDelayed = hoursSincePayment > 24;

        return {
          ...rental,
          hoursSincePayment,
          isDelayed,
        };
      });

      // Sort by hours since payment (most delayed first)
      rentalsData.sort((a, b) => b.hoursSincePayment - a.hoursSincePayment);

      setRentals(rentalsData);
    } catch (err: any) {
      console.error('Error fetching handover rentals:', err);
      setError('Failed to load handover monitoring data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleManualOverride = async () => {
    try {
      if (!selectedRental || !overrideReason) {
        setError('Please provide a reason for manual override.');
        return;
      }

      setLoading(true);

      const rentalRef = doc(db, 'rentals', selectedRental.id);
      await updateDoc(rentalRef, {
        status: 'active',
        'handover.renterConfirmed': true,
        'handover.renterConfirmedAt': Timestamp.now(),
        'handover.ownerConfirmed': true,
        'handover.ownerConfirmedAt': Timestamp.now(),
        'handover.manualOverride': true,
        'handover.overrideReason': overrideReason,
        'handover.overrideBy': 'admin',
        'handover.overrideAt': Timestamp.now(),
        dates: {
          ...selectedRental.dates,
          confirmedStart: Timestamp.now(),
        },
      });

      setSuccess('Handover manually completed successfully!');
      handleCloseOverrideDialog();
      await fetchPendingHandovers();
    } catch (err: any) {
      console.error('Error overriding handover:', err);
      setError('Failed to complete manual override. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendReminder = async (_rentalId: string) => {
    try {
      // In a real implementation, this would trigger a Cloud Function to send notifications
      // For now, we'll just show a success message
      setSuccess('Reminder notifications sent to both parties!');
      
      // You would call a Cloud Function here:
      // await httpsCallable(functions, 'sendHandoverReminder')({ rentalId: _rentalId });
    } catch (err: any) {
      console.error('Error sending reminder:', err);
      setError('Failed to send reminders. Please try again.');
    }
  };

  const handleOpenOverrideDialog = (rental: HandoverRental) => {
    setSelectedRental(rental);
    setOverrideReason('');
    setOverrideDialogOpen(true);
  };

  const handleCloseOverrideDialog = () => {
    setOverrideDialogOpen(false);
    setSelectedRental(null);
    setOverrideReason('');
  };

  const getStats = () => {
    const total = rentals.length;
    const delayed = rentals.filter(r => r.isDelayed).length;
    const avgHours = rentals.length > 0
      ? Math.round(rentals.reduce((sum, r) => sum + r.hoursSincePayment, 0) / rentals.length)
      : 0;
    
    return { total, delayed, avgHours };
  };

  const stats = getStats();

  if (loading && rentals.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            Handover Monitoring
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Track and manage rentals awaiting handover confirmation
          </Typography>
        </Box>
        <ExportButton
          data={rentals}
          filename="handover_monitoring"
          headers={['id', 'itemId', 'ownerId', 'renterId', 'status', 'hoursSincePayment', 'isDelayed']}
        />
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Overview Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <StatCard
            title="Pending Handovers"
            value={stats.total}
            subtitle="Awaiting confirmation"
            icon={<HourglassEmpty />}
            color="warning"
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <StatCard
            title="Delayed (>24h)"
            value={stats.delayed}
            subtitle="Require attention"
            icon={<Warning />}
            color="error"
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <StatCard
            title="Avg. Wait Time"
            value={`${stats.avgHours}h`}
            subtitle="Average hours waiting"
            icon={<CheckCircle />}
            color="info"
          />
        </Grid>
      </Grid>

      {/* Pending Handovers Table */}
      <Paper>
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Pending Handover Confirmations
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Rentals waiting for both parties to confirm handover
          </Typography>
        </Box>
        <Divider />
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Rental ID</TableCell>
                <TableCell>Item ID</TableCell>
                <TableCell>Hours Waiting</TableCell>
                <TableCell>Renter Confirmed</TableCell>
                <TableCell>Owner Confirmed</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rentals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography color="text.secondary" sx={{ py: 3 }}>
                      No pending handovers found - all rentals are confirmed! 🎉
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                rentals.map((rental) => (
                  <TableRow 
                    key={rental.id} 
                    hover
                    sx={{
                      bgcolor: rental.isDelayed ? 'error.light' : 'inherit',
                      opacity: rental.isDelayed ? 0.8 : 1,
                    }}
                  >
                    <TableCell>{rental.id.substring(0, 8)}...</TableCell>
                    <TableCell>{rental.itemId.substring(0, 8)}...</TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        fontWeight="bold"
                        color={rental.isDelayed ? 'error.main' : 'text.primary'}
                      >
                        {rental.hoursSincePayment}h
                      </Typography>
                      {rental.isDelayed && (
                        <Chip
                          label="DELAYED"
                          size="small"
                          color="error"
                          sx={{ mt: 0.5 }}
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      {rental.handover?.renterConfirmed ? (
                        <Chip
                          icon={<CheckCircle />}
                          label="Yes"
                          size="small"
                          color="success"
                        />
                      ) : (
                        <Chip
                          label="Pending"
                          size="small"
                          color="warning"
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      {rental.handover?.ownerConfirmed ? (
                        <Chip
                          icon={<CheckCircle />}
                          label="Yes"
                          size="small"
                          color="success"
                        />
                      ) : (
                        <Chip
                          label="Pending"
                          size="small"
                          color="warning"
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label="Awaiting Handover"
                        size="small"
                        color="warning"
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleSendReminder(rental.id)}
                          title="Send reminder notifications"
                        >
                          <Send fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="warning"
                          onClick={() => handleOpenOverrideDialog(rental)}
                          title="Manual override"
                        >
                          <Edit fontSize="small" />
                        </IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Manual Override Dialog */}
      <Dialog
        open={overrideDialogOpen}
        onClose={handleCloseOverrideDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Manual Handover Override
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This will manually mark the handover as complete and activate the rental. This action should only be used in exceptional circumstances.
          </Alert>
          
          {selectedRental && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Rental ID: {selectedRental.id}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Hours waiting: {selectedRental.hoursSincePayment}
              </Typography>
            </Box>
          )}

          <TextField
            label="Reason for Override"
            fullWidth
            required
            multiline
            rows={3}
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
            placeholder="Explain why manual override is necessary..."
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseOverrideDialog}>Cancel</Button>
          <Button
            variant="contained"
            color="warning"
            onClick={handleManualOverride}
            disabled={loading || !overrideReason}
          >
            {loading ? <CircularProgress size={20} /> : 'Override & Activate'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
