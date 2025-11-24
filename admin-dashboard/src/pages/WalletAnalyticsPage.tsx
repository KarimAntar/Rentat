import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
} from '@mui/material';
import {
  AccountBalance,
  TrendingUp,
  Lock,
  PendingActions,
} from '@mui/icons-material';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../config/firebase';
import { WalletTransaction, TransactionAvailabilityStatus } from '../types';
import { StatCard } from '../components/shared/StatCard';
import { ExportButton } from '../components/shared/ExportButton';

interface WalletStats {
  totalAvailable: number;
  totalPending: number;
  totalLocked: number;
  totalInEscrow: number;
  pendingPayouts: number;
  transactionCount: number;
}

export const WalletAnalyticsPage: React.FC = () => {
  const [stats, setStats] = useState<WalletStats>({
    totalAvailable: 0,
    totalPending: 0,
    totalLocked: 0,
    totalInEscrow: 0,
    pendingPayouts: 0,
    transactionCount: 0,
  });
  const [recentTransactions, setRecentTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWalletAnalytics();
  }, []);

  const fetchWalletAnalytics = async () => {
    try {
      setLoading(true);

      // Fetch all wallet transactions
      const txQuery = query(collection(db, 'wallet_transactions'));
      const txSnapshot = await getDocs(txQuery);

      let available = 0;
      let pending = 0;
      let locked = 0;

      const transactions: WalletTransaction[] = [];

      txSnapshot.docs.forEach(doc => {
        const tx = doc.data() as WalletTransaction;
        const txWithId = {
          ...tx,
          id: doc.id,
          createdAt: (tx.createdAt as any)?.toDate ? (tx.createdAt as any).toDate() : new Date(tx.createdAt as any),
          processedAt: tx.processedAt ? ((tx.processedAt as any)?.toDate ? (tx.processedAt as any).toDate() : new Date(tx.processedAt as any)) : undefined,
        };
        
        transactions.push(txWithId);

        // Calculate totals by availability status
        if (tx.availabilityStatus === 'AVAILABLE') {
          available += tx.amount;
        } else if (tx.availabilityStatus === 'PENDING') {
          pending += tx.amount;
        } else if (tx.availabilityStatus === 'LOCKED') {
          locked += tx.amount;
        }
      });

      // Fetch pending payouts
      const payoutsQuery = query(
        collection(db, 'payout_requests'),
        where('status', '==', 'pending')
      );
      const payoutsSnapshot = await getDocs(payoutsQuery);
      const pendingPayoutsTotal = payoutsSnapshot.docs.reduce((sum, doc) => {
        return sum + (doc.data().amount || 0);
      }, 0);

      setStats({
        totalAvailable: available,
        totalPending: pending,
        totalLocked: locked,
        totalInEscrow: pending + locked,
        pendingPayouts: pendingPayoutsTotal,
        transactionCount: transactions.length,
      });

      // Get recent transactions (last 20)
      const recentTxQuery = query(
        collection(db, 'wallet_transactions'),
        orderBy('createdAt', 'desc'),
        limit(20)
      );
      const recentSnapshot = await getDocs(recentTxQuery);
      const recentTx = recentSnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        processedAt: doc.data().processedAt?.toDate(),
      })) as WalletTransaction[];

      setRecentTransactions(recentTx);

    } catch (err: any) {
      console.error('Error fetching wallet analytics:', err);
      setError('Failed to load wallet analytics. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getAvailabilityStatusColor = (status?: TransactionAvailabilityStatus) => {
    switch (status) {
      case 'AVAILABLE':
        return 'success.main';
      case 'PENDING':
        return 'warning.main';
      case 'LOCKED':
        return 'error.main';
      default:
        return 'text.secondary';
    }
  };

  const getAvailabilityStatusLabel = (status?: TransactionAvailabilityStatus) => {
    return status || 'N/A';
  };

  if (loading) {
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
            Wallet Analytics
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Monitor platform funds and wallet transactions
          </Typography>
        </Box>
        <ExportButton
          data={recentTransactions}
          filename="wallet_transactions"
          headers={['id', 'userId', 'type', 'amount', 'status', 'availabilityStatus', 'createdAt']}
        />
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Overview Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={3}>
          <StatCard
            title="Available Balance"
            value={`${stats.totalAvailable.toFixed(2)} EGP`}
            subtitle="Can be withdrawn"
            icon={<AccountBalance />}
            color="success"
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <StatCard
            title="Pending Balance"
            value={`${stats.totalPending.toFixed(2)} EGP`}
            subtitle="In active rentals"
            icon={<PendingActions />}
            color="warning"
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <StatCard
            title="Locked Balance"
            value={`${stats.totalLocked.toFixed(2)} EGP`}
            subtitle="In disputes"
            icon={<Lock />}
            color="error"
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <StatCard
            title="Total in Escrow"
            value={`${stats.totalInEscrow.toFixed(2)} EGP`}
            subtitle="Pending + Locked"
            icon={<TrendingUp />}
            color="info"
          />
        </Grid>
      </Grid>

      {/* Additional Stats */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Pending Payouts
              </Typography>
              <Typography variant="h3" fontWeight="bold" color="primary">
                {stats.pendingPayouts.toFixed(2)} EGP
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Awaiting admin approval
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Total Transactions
              </Typography>
              <Typography variant="h3" fontWeight="bold" color="primary">
                {stats.transactionCount}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                All-time wallet transactions
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Balance Distribution */}
      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Balance Distribution
        </Typography>
        <Grid container spacing={2} sx={{ mt: 2 }}>
          <Grid item xs={12} md={4}>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Available
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                <Box
                  sx={{
                    width: '100%',
                    height: 40,
                    bgcolor: 'success.light',
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Typography variant="body2" fontWeight="bold">
                    {((stats.totalAvailable / (stats.totalAvailable + stats.totalPending + stats.totalLocked)) * 100 || 0).toFixed(1)}%
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Pending
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                <Box
                  sx={{
                    width: '100%',
                    height: 40,
                    bgcolor: 'warning.light',
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Typography variant="body2" fontWeight="bold">
                    {((stats.totalPending / (stats.totalAvailable + stats.totalPending + stats.totalLocked)) * 100 || 0).toFixed(1)}%
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Locked
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                <Box
                  sx={{
                    width: '100%',
                    height: 40,
                    bgcolor: 'error.light',
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Typography variant="body2" fontWeight="bold">
                    {((stats.totalLocked / (stats.totalAvailable + stats.totalPending + stats.totalLocked)) * 100 || 0).toFixed(1)}%
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Recent Transactions */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Recent Transactions (Last 20)
        </Typography>
        <Divider sx={{ my: 2 }} />
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Transaction ID</TableCell>
                <TableCell>User ID</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Availability</TableCell>
                <TableCell>Date</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {recentTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography color="text.secondary">No transactions found</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                recentTransactions.map((tx) => (
                  <TableRow key={tx.id} hover>
                    <TableCell>{tx.id.substring(0, 8)}...</TableCell>
                    <TableCell>{tx.userId.substring(0, 8)}...</TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {tx.type.replace(/_/g, ' ')}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        color={tx.amount >= 0 ? 'success.main' : 'error.main'}
                        fontWeight="bold"
                      >
                        {tx.amount >= 0 ? '+' : ''}{tx.amount.toFixed(2)} {tx.currency}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="caption"
                        sx={{
                          px: 1,
                          py: 0.5,
                          borderRadius: 1,
                          bgcolor: tx.status === 'completed' ? 'success.light' : 'warning.light',
                        }}
                      >
                        {tx.status}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="caption"
                        sx={{
                          px: 1,
                          py: 0.5,
                          borderRadius: 1,
                          color: getAvailabilityStatusColor(tx.availabilityStatus),
                          fontWeight: 'bold',
                        }}
                      >
                        {getAvailabilityStatusLabel(tx.availabilityStatus)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">
                        {tx.createdAt.toLocaleString()}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};
