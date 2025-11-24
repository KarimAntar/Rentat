import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Card,
  CardContent,
  Chip,
  IconButton,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
} from '@mui/material';
import {
  Visibility,
  Close,
  CheckCircle,
  Cancel,
  MonetizationOn,
} from '@mui/icons-material';
import { collection, getDocs, query, orderBy, updateDoc, doc, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { PayoutRequest, PayoutRequestStatus, WalletTransaction } from '../types';
import { StatusBadge } from '../components/shared/StatusBadge';
import { ExportButton } from '../components/shared/ExportButton';

export const PayoutsPage: React.FC = () => {
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedPayout, setSelectedPayout] = useState<PayoutRequest | null>(null);
  const [userBalance, setUserBalance] = useState<{ available: number; pending: number; locked: number } | null>(null);
  
  const [statusFilter, setStatusFilter] = useState<PayoutRequestStatus | 'all'>('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  // Rejection form
  const [rejectionReason, setRejectionReason] = useState('');
  const [processingNotes, setProcessingNotes] = useState('');

  useEffect(() => {
    fetchPayouts();
  }, [statusFilter]);

  const fetchPayouts = async () => {
    try {
      setLoading(true);
      const payoutsRef = collection(db, 'payout_requests');
      
      let payoutsQuery;
      if (statusFilter === 'all') {
        payoutsQuery = query(payoutsRef, orderBy('requestedAt', 'desc'));
      } else {
        payoutsQuery = query(
          payoutsRef,
          where('status', '==', statusFilter),
          orderBy('requestedAt', 'desc')
        );
      }
      
      const snapshot = await getDocs(payoutsQuery);

      const payoutsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        requestedAt: doc.data().requestedAt?.toDate() || new Date(),
        processedAt: doc.data().processedAt?.toDate(),
      })) as PayoutRequest[];

      setPayouts(payoutsData);
    } catch (err: any) {
      console.error('Error fetching payouts:', err);
      setError('Failed to load payouts. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserDetails = async (userId: string) => {
    try {
      // User details are fetched but not stored (can be added later if needed)
      // const userDoc = await getDoc(doc(db, 'users', userId));

      // Fetch wallet balance
      const walletTxQuery = query(
        collection(db, 'wallet_transactions'),
        where('userId', '==', userId)
      );
      const walletSnapshot = await getDocs(walletTxQuery);
      
      let available = 0;
      let pending = 0;
      let locked = 0;

      walletSnapshot.docs.forEach(doc => {
        const tx = doc.data() as WalletTransaction;
        const amount = tx.amount;
        
        if (tx.availabilityStatus === 'AVAILABLE') {
          available += amount;
        } else if (tx.availabilityStatus === 'PENDING') {
          pending += amount;
        } else if (tx.availabilityStatus === 'LOCKED') {
          locked += amount;
        }
      });

      setUserBalance({ available, pending, locked });
    } catch (err) {
      console.error('Error fetching user details:', err);
    }
  };

  const handleApprovePayout = async () => {
    try {
      if (!selectedPayout) return;

      setLoading(true);

      const payoutRef = doc(db, 'payout_requests', selectedPayout.id);
      await updateDoc(payoutRef, {
        status: 'approved',
        processedAt: new Date(),
        processedBy: 'admin', // In real app, use actual admin ID
        notes: processingNotes || 'Approved by admin',
      });

      setSuccess('Payout approved successfully!');
      handleCloseDetailDialog();
      await fetchPayouts();
    } catch (err: any) {
      console.error('Error approving payout:', err);
      setError('Failed to approve payout. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRejectPayout = async () => {
    try {
      if (!selectedPayout || !rejectionReason) {
        setError('Please provide a rejection reason.');
        return;
      }

      setLoading(true);

      const payoutRef = doc(db, 'payout_requests', selectedPayout.id);
      await updateDoc(payoutRef, {
        status: 'rejected',
        processedAt: new Date(),
        processedBy: 'admin',
        rejectionReason: rejectionReason,
        notes: processingNotes || '',
      });

      setSuccess('Payout rejected successfully!');
      handleCloseDetailDialog();
      await fetchPayouts();
    } catch (err: any) {
      console.error('Error rejecting payout:', err);
      setError('Failed to reject payout. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsCompleted = async () => {
    try {
      if (!selectedPayout) return;

      setLoading(true);

      const payoutRef = doc(db, 'payout_requests', selectedPayout.id);
      await updateDoc(payoutRef, {
        status: 'completed',
        processedAt: new Date(),
        notes: processingNotes || 'Completed manually',
      });

      setSuccess('Payout marked as completed!');
      handleCloseDetailDialog();
      await fetchPayouts();
    } catch (err: any) {
      console.error('Error marking payout as completed:', err);
      setError('Failed to mark payout as completed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleViewPayout = async (payout: PayoutRequest) => {
    setSelectedPayout(payout);
    setRejectionReason('');
    setProcessingNotes('');
    await fetchUserDetails(payout.userId);
    setDetailDialogOpen(true);
  };

  const handleCloseDetailDialog = () => {
    setDetailDialogOpen(false);
    setSelectedPayout(null);
    setUserBalance(null);
    setRejectionReason('');
    setProcessingNotes('');
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const getPendingTotal = () => {
    return payouts
      .filter(p => p.status === 'pending')
      .reduce((sum, p) => sum + p.amount, 0);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            Payout Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Review and process withdrawal requests
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Filter by Status</InputLabel>
            <Select
              value={statusFilter}
              label="Filter by Status"
              onChange={(e) => setStatusFilter(e.target.value as any)}
            >
              <MenuItem value="all">All Requests</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="approved">Approved</MenuItem>
              <MenuItem value="processing">Processing</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="rejected">Rejected</MenuItem>
            </Select>
          </FormControl>
          <ExportButton
            data={payouts}
            filename="payouts"
            headers={['id', 'userId', 'amount', 'status', 'method', 'requestedAt']}
          />
        </Box>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Pending Requests
              </Typography>
              <Typography variant="h4" fontWeight="bold">
                {payouts.filter(p => p.status === 'pending').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Pending Amount
              </Typography>
              <Typography variant="h4" fontWeight="bold">
                {getPendingTotal().toFixed(2)} {payouts[0]?.currency || 'EGP'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Completed Today
              </Typography>
              <Typography variant="h4" fontWeight="bold">
                {payouts.filter(p => 
                  p.status === 'completed' && 
                  p.processedAt && 
                  new Date(p.processedAt).toDateString() === new Date().toDateString()
                ).length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Total Requests
              </Typography>
              <Typography variant="h4" fontWeight="bold">
                {payouts.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

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

      {/* Payouts Table */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Request ID</TableCell>
                <TableCell>User ID</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Method</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Requested</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && payouts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : payouts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography color="text.secondary">No payout requests found</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                payouts
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((payout) => (
                    <TableRow key={payout.id} hover>
                      <TableCell>{payout.id.substring(0, 8)}...</TableCell>
                      <TableCell>{payout.userId.substring(0, 8)}...</TableCell>
                      <TableCell>
                        {payout.amount.toFixed(2)} {payout.currency}
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={payout.method.replace(/_/g, ' ')} 
                          size="small" 
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={payout.status} />
                      </TableCell>
                      <TableCell>{payout.requestedAt.toLocaleDateString()}</TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => handleViewPayout(payout)}
                        >
                          <Visibility fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50]}
          component="div"
          count={payouts.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>

      {/* Detail Dialog */}
      <Dialog
        open={detailDialogOpen}
        onClose={handleCloseDetailDialog}
        maxWidth="md"
        fullWidth
      >
        {selectedPayout && (
          <>
            <DialogTitle>
              Payout Request Details
              <IconButton
                onClick={handleCloseDetailDialog}
                sx={{ position: 'absolute', right: 8, top: 8 }}
              >
                <Close />
              </IconButton>
            </DialogTitle>
            <DialogContent>
              <Grid container spacing={3} sx={{ mt: 0.5 }}>
                <Grid item xs={12}>
                  <StatusBadge status={selectedPayout.status} size="medium" />
                </Grid>

                <Grid item xs={12}>
                  <Divider />
                </Grid>

                <Grid item xs={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Request ID
                  </Typography>
                  <Typography variant="body2">{selectedPayout.id}</Typography>
                </Grid>

                <Grid item xs={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    User ID
                  </Typography>
                  <Typography variant="body2">{selectedPayout.userId}</Typography>
                </Grid>

                <Grid item xs={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Amount
                  </Typography>
                  <Typography variant="h6" color="primary">
                    {selectedPayout.amount.toFixed(2)} {selectedPayout.currency}
                  </Typography>
                </Grid>

                <Grid item xs={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Payment Method
                  </Typography>
                  <Chip 
                    label={selectedPayout.method.replace(/_/g, ' ')} 
                    size="small"
                  />
                </Grid>

                {userBalance && (
                  <>
                    <Grid item xs={12}>
                      <Divider />
                      <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>
                        User Wallet Balance
                      </Typography>
                    </Grid>

                    <Grid item xs={4}>
                      <Typography variant="body2" color="text.secondary">
                        Available
                      </Typography>
                      <Typography variant="h6" color="success.main">
                        {userBalance.available.toFixed(2)}
                      </Typography>
                    </Grid>

                    <Grid item xs={4}>
                      <Typography variant="body2" color="text.secondary">
                        Pending
                      </Typography>
                      <Typography variant="h6" color="warning.main">
                        {userBalance.pending.toFixed(2)}
                      </Typography>
                    </Grid>

                    <Grid item xs={4}>
                      <Typography variant="body2" color="text.secondary">
                        Locked
                      </Typography>
                      <Typography variant="h6" color="error.main">
                        {userBalance.locked.toFixed(2)}
                      </Typography>
                    </Grid>
                  </>
                )}

                <Grid item xs={12}>
                  <Divider />
                  <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>
                    Account Details
                  </Typography>
                </Grid>

                {selectedPayout.accountDetails.type === 'bank_transfer' && (
                  <>
                    <Grid item xs={6}>
                      <Typography variant="subtitle2" gutterBottom>
                        Bank Name
                      </Typography>
                      <Typography variant="body2">
                        {selectedPayout.accountDetails.bankName}
                      </Typography>
                    </Grid>

                    <Grid item xs={6}>
                      <Typography variant="subtitle2" gutterBottom>
                        Account Number
                      </Typography>
                      <Typography variant="body2">
                        {selectedPayout.accountDetails.accountNumber}
                      </Typography>
                    </Grid>

                    <Grid item xs={12}>
                      <Typography variant="subtitle2" gutterBottom>
                        Account Holder
                      </Typography>
                      <Typography variant="body2">
                        {selectedPayout.accountDetails.accountHolder}
                      </Typography>
                    </Grid>
                  </>
                )}

                {selectedPayout.accountDetails.type === 'mobile_wallet' && (
                  <>
                    <Grid item xs={6}>
                      <Typography variant="subtitle2" gutterBottom>
                        Wallet Provider
                      </Typography>
                      <Typography variant="body2">
                        {selectedPayout.accountDetails.walletProvider}
                      </Typography>
                    </Grid>

                    <Grid item xs={6}>
                      <Typography variant="subtitle2" gutterBottom>
                        Wallet Number
                      </Typography>
                      <Typography variant="body2">
                        {selectedPayout.accountDetails.walletNumber}
                      </Typography>
                    </Grid>
                  </>
                )}

                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">
                    Requested on {selectedPayout.requestedAt.toLocaleString()}
                  </Typography>
                </Grid>

                {selectedPayout.status === 'pending' && (
                  <>
                    <Grid item xs={12}>
                      <Divider sx={{ my: 2 }} />
                      <Typography variant="h6" gutterBottom>
                        Process Request
                      </Typography>
                    </Grid>

                    <Grid item xs={12}>
                      <TextField
                        label="Notes (Optional)"
                        fullWidth
                        multiline
                        rows={2}
                        value={processingNotes}
                        onChange={(e) => setProcessingNotes(e.target.value)}
                        placeholder="Add any notes about this payout..."
                      />
                    </Grid>

                    <Grid item xs={12}>
                      <TextField
                        label="Rejection Reason (Required for rejection)"
                        fullWidth
                        multiline
                        rows={2}
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Why is this payout being rejected?"
                      />
                    </Grid>
                  </>
                )}

                {selectedPayout.rejectionReason && (
                  <Grid item xs={12}>
                    <Alert severity="error">
                      <Typography variant="subtitle2">Rejection Reason:</Typography>
                      <Typography variant="body2">{selectedPayout.rejectionReason}</Typography>
                    </Alert>
                  </Grid>
                )}

                {selectedPayout.notes && (
                  <Grid item xs={12}>
                    <Alert severity="info">
                      <Typography variant="subtitle2">Notes:</Typography>
                      <Typography variant="body2">{selectedPayout.notes}</Typography>
                    </Alert>
                  </Grid>
                )}
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCloseDetailDialog}>Close</Button>
              {selectedPayout.status === 'pending' && (
                <>
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<Cancel />}
                    onClick={handleRejectPayout}
                    disabled={loading || !rejectionReason}
                  >
                    Reject
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<CheckCircle />}
                    onClick={handleApprovePayout}
                    disabled={loading}
                  >
                    {loading ? <CircularProgress size={20} /> : 'Approve'}
                  </Button>
                </>
              )}
              {selectedPayout.status === 'approved' && (
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<MonetizationOn />}
                  onClick={handleMarkAsCompleted}
                  disabled={loading}
                >
                  Mark as Completed
                </Button>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};
