import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Divider,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  People,
  ShoppingBag,
  Receipt,
  AttachMoney,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { User, Item, Rental } from '../types';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ReactNode;
  color: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, change, icon, color }) => {
  const isPositive = change !== undefined && change >= 0;
  
  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {title}
            </Typography>
            <Typography variant="h4" fontWeight="bold" sx={{ mb: 1 }}>
              {value}
            </Typography>
            {change !== undefined && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {isPositive ? (
                  <TrendingUp fontSize="small" color="success" />
                ) : (
                  <TrendingDown fontSize="small" color="error" />
                )}
                <Typography
                  variant="body2"
                  color={isPositive ? 'success.main' : 'error.main'}
                >
                  {isPositive ? '+' : ''}{change}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  vs last period
                </Typography>
              </Box>
            )}
          </Box>
          <Box
            sx={{
              bgcolor: `${color}.50`,
              color: `${color}.main`,
              p: 1.5,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export const AnalyticsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState('30d');
  
  // Metrics state
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [totalRentals, setTotalRentals] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  
  const [userGrowthData, setUserGrowthData] = useState<any[]>([]);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [statusData, setStatusData] = useState<any[]>([]);

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      // Calculate date range
      const now = new Date();
      const daysAgo = parseInt(timeRange.replace('d', ''));
      const startDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

      // Fetch all data
      const [users, items, rentals] = await Promise.all([
        fetchUsers(startDate),
        fetchItems(startDate),
        fetchRentals(startDate),
      ]);

      // Calculate metrics
      setTotalUsers(users.length);
      setTotalItems(items.length);
      setTotalRentals(rentals.length);

      // Calculate revenue
      const revenue = rentals.reduce((sum, rental) => {
        return sum + (rental.pricing?.total || 0);
      }, 0);
      setTotalRevenue(revenue);

      // Process user growth data
      const usersByDate = processUserGrowth(users, daysAgo);
      setUserGrowthData(usersByDate);

      // Process revenue data
      const revenueByDate = processRevenue(rentals, daysAgo);
      setRevenueData(revenueByDate);

      // Process category data
      const categories = processCategoryData(items);
      setCategoryData(categories);

      // Process rental status data
      const statuses = processStatusData(rentals);
      setStatusData(statuses);

    } catch (err: any) {
      console.error('Error fetching analytics:', err);
      setError('Failed to load analytics. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async (startDate: Date): Promise<User[]> => {
    const usersRef = collection(db, 'users');
    const usersQuery = query(
      usersRef,
      where('createdAt', '>=', Timestamp.fromDate(startDate))
    );
    const snapshot = await getDocs(usersQuery);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      uid: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
    })) as User[];
  };

  const fetchItems = async (startDate: Date): Promise<Item[]> => {
    const itemsRef = collection(db, 'items');
    const itemsQuery = query(
      itemsRef,
      where('createdAt', '>=', Timestamp.fromDate(startDate))
    );
    const snapshot = await getDocs(itemsQuery);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
    })) as Item[];
  };

  const fetchRentals = async (startDate: Date): Promise<Rental[]> => {
    const rentalsRef = collection(db, 'rentals');
    const rentalsQuery = query(
      rentalsRef,
      where('createdAt', '>=', Timestamp.fromDate(startDate))
    );
    const snapshot = await getDocs(rentalsQuery);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
      } as Rental;
    });
  };

  const processUserGrowth = (users: User[], days: number) => {
    const dataMap = new Map<string, number>();
    
    // Initialize all dates with 0
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (days - i - 1));
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dataMap.set(dateStr, 0);
    }

    // Count users per day
    users.forEach(user => {
      const dateStr = new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dataMap.set(dateStr, (dataMap.get(dateStr) || 0) + 1);
    });

    return Array.from(dataMap.entries()).map(([date, count]) => ({
      date,
      users: count,
    }));
  };

  const processRevenue = (rentals: Rental[], days: number) => {
    const dataMap = new Map<string, number>();
    
    // Initialize all dates with 0
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (days - i - 1));
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dataMap.set(dateStr, 0);
    }

    // Sum revenue per day
    rentals.forEach(rental => {
      const dateStr = new Date(rental.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const revenue = rental.pricing?.total || 0;
      dataMap.set(dateStr, (dataMap.get(dateStr) || 0) + revenue);
    });

    return Array.from(dataMap.entries()).map(([date, revenue]) => ({
      date,
      revenue: Math.round(revenue * 100) / 100,
    }));
  };

  const processCategoryData = (items: Item[]) => {
    const categoryMap = new Map<string, number>();
    
    items.forEach(item => {
      const category = item.category || 'Uncategorized';
      categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
    });

    return Array.from(categoryMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5); // Top 5 categories
  };

  const processStatusData = (rentals: Rental[]) => {
    const statusMap = new Map<string, number>();
    
    rentals.forEach(rental => {
      const status = rental.status || 'unknown';
      statusMap.set(status, (statusMap.get(status) || 0) + 1);
    });

    return Array.from(statusMap.entries()).map(([name, value]) => ({ name, value }));
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            Analytics Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Platform insights and performance metrics
          </Typography>
        </Box>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Time Range</InputLabel>
          <Select
            value={timeRange}
            label="Time Range"
            onChange={(e) => setTimeRange(e.target.value)}
          >
            <MenuItem value="7d">Last 7 days</MenuItem>
            <MenuItem value="30d">Last 30 days</MenuItem>
            <MenuItem value="90d">Last 90 days</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* Key Metrics */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard
                title="Total Users"
                value={totalUsers.toLocaleString()}
                change={12.5}
                icon={<People fontSize="large" />}
                color="primary"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard
                title="Total Items"
                value={totalItems.toLocaleString()}
                change={8.2}
                icon={<ShoppingBag fontSize="large" />}
                color="success"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard
                title="Total Rentals"
                value={totalRentals.toLocaleString()}
                change={15.3}
                icon={<Receipt fontSize="large" />}
                color="warning"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard
                title="Revenue"
                value={`$${totalRevenue.toLocaleString()}`}
                change={-3.1}
                icon={<AttachMoney fontSize="large" />}
                color="error"
              />
            </Grid>
          </Grid>

          {/* Charts */}
          <Grid container spacing={3}>
            {/* User Growth Chart */}
            <Grid item xs={12} lg={6}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  User Growth
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={userGrowthData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="users" stroke="#1976d2" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>

            {/* Revenue Chart */}
            <Grid item xs={12} lg={6}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Revenue Trend
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="revenue" fill="#4caf50" />
                  </BarChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>

            {/* Category Distribution */}
            <Grid item xs={12} lg={6}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Top Categories
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {categoryData.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>

            {/* Rental Status Distribution */}
            <Grid item xs={12} lg={6}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Rental Status Distribution
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={statusData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="value" fill="#ff9800" />
                  </BarChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
          </Grid>
        </>
      )}
    </Box>
  );
};
