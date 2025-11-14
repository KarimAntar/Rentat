import React, { useEffect, useState } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  People,
  Inventory,
  Receipt,
  TrendingUp,
  TrendingDown,
} from '@mui/icons-material';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { db } from '../config/firebase';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactElement;
  trend?: number;
  color: string;
  loading?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, trend, color, loading }) => {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: `${color}.lighter`,
              color: `${color}.main`,
            }}
          >
            {icon}
          </Box>
          {trend !== undefined && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                color: trend >= 0 ? 'success.main' : 'error.main',
              }}
            >
              {trend >= 0 ? <TrendingUp /> : <TrendingDown />}
              <Typography variant="body2" fontWeight="bold" sx={{ ml: 0.5 }}>
                {Math.abs(trend)}%
              </Typography>
            </Box>
          )}
        </Box>
        
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          {loading ? <CircularProgress size={32} /> : value}
        </Typography>
        
        <Typography variant="body2" color="text.secondary">
          {title}
        </Typography>
      </CardContent>
    </Card>
  );
};

export const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalItems: 0,
    totalRentals: 0,
    activeRentals: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch total users
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const totalUsers = usersSnapshot.size;

        // Fetch total items
        const itemsSnapshot = await getDocs(collection(db, 'items'));
        const totalItems = itemsSnapshot.size;

        // Fetch total rentals
        const rentalsSnapshot = await getDocs(collection(db, 'rentals'));
        const totalRentals = rentalsSnapshot.size;

        // Fetch active rentals (status: 'active' or 'approved')
        const activeRentalsQuery = query(
          collection(db, 'rentals'),
          where('status', 'in', ['active', 'approved'])
        );
        const activeRentalsSnapshot = await getDocs(activeRentalsQuery);
        const activeRentals = activeRentalsSnapshot.size;

        setStats({
          totalUsers,
          totalItems,
          totalRentals,
          activeRentals,
        });
      } catch (err: any) {
        console.error('Error fetching dashboard stats:', err);
        setError('Failed to load dashboard statistics. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (error) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Dashboard Overview
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Welcome to the Rentat Admin Dashboard
      </Typography>

      {/* Stats Grid */}
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Users"
            value={stats.totalUsers.toLocaleString()}
            icon={<People fontSize="large" />}
            color="primary"
            loading={loading}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Items"
            value={stats.totalItems.toLocaleString()}
            icon={<Inventory fontSize="large" />}
            color="info"
            loading={loading}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Rentals"
            value={stats.totalRentals.toLocaleString()}
            icon={<Receipt fontSize="large" />}
            color="success"
            loading={loading}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Active Rentals"
            value={stats.activeRentals.toLocaleString()}
            icon={<Receipt fontSize="large" />}
            color="warning"
            loading={loading}
          />
        </Grid>
      </Grid>

      {/* Recent Activity Section - Placeholder */}
      <Box sx={{ mt: 4 }}>
        <Typography variant="h5" fontWeight="bold" gutterBottom>
          Recent Activity
        </Typography>
        <Card>
          <CardContent>
            <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
              Activity feed will be implemented in the next phase
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Quick Actions Section - Placeholder */}
      <Box sx={{ mt: 4 }}>
        <Typography variant="h5" fontWeight="bold" gutterBottom>
          Quick Actions
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={4}>
            <Card sx={{ cursor: 'pointer', '&:hover': { boxShadow: 3 } }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  View All Users
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Manage and moderate platform users
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={4}>
            <Card sx={{ cursor: 'pointer', '&:hover': { boxShadow: 3 } }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  View All Items
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Browse and manage listed items
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={4}>
            <Card sx={{ cursor: 'pointer', '&:hover': { boxShadow: 3 } }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Analytics
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  View detailed platform analytics
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
};
