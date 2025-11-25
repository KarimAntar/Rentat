import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Grid,
  Divider,
  Avatar,
  Card,
  CardContent,
} from '@mui/material';
import {
  DataGrid,
  GridColDef,
  GridRenderCellParams,
  GridPaginationModel,
} from '@mui/x-data-grid';
import {
  Search,
  Refresh,
  Visibility,
  Cancel,
  FilterList,
  CalendarToday,
  AttachMoney,
} from '@mui/icons-material';
import { collection, getDocs, query, orderBy, doc, updateDoc, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Rental, User, Item } from '../types';

export const RentalsPage: React.FC = () => {
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [users, setUsers] = useState<Record<string, User>>({});
  const [items, setItems] = useState<Record<string, Item>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedRental, setSelectedRental] = useState<Rental | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 10,
  });

  useEffect(() => {
    fetchRentals();
  }, []);

  const fetchRentals = async () => {
    try {
      setLoading(true);
      setError(null);

      const rentalsRef = collection(db, 'rentals');
      const rentalsQuery = query(rentalsRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(rentalsQuery);

      const rentalsData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          dates: {
            ...data.dates,
            requestedStart: data.dates?.requestedStart?.toDate() || new Date(),
            requestedEnd: data.dates?.requestedEnd?.toDate() || new Date(),
            confirmedStart: data.dates?.confirmedStart?.toDate(),
            confirmedEnd: data.dates?.confirmedEnd?.toDate(),
            actualStart: data.dates?.actualStart?.toDate(),
            actualEnd: data.dates?.actualEnd?.toDate(),
          },
        } as Rental;
      });

      setRentals(rentalsData);

      // Fetch related users and items
      const userIds = Array.from(new Set([
        ...rentalsData.map(r => r.renterId).filter(Boolean),
        ...rentalsData.map(r => r.ownerId).filter(Boolean),
      ]));
      
      const itemIds = Array.from(new Set(rentalsData.map(r => r.itemId).filter(Boolean)));

      if (userIds.length > 0) {
        await fetchUsers(userIds);
      }
      
      if (itemIds.length > 0) {
        await fetchItems(itemIds);
      }
    } catch (err: any) {
      console.error('Error fetching rentals:', err);
      setError('Failed to load rentals. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async (userIds: string[]) => {
    try {
      const usersRef = collection(db, 'users');
      const usersData: Record<string, User> = {};

      for (let i = 0; i < userIds.length; i += 10) {
        const batch = userIds.slice(i, i + 10);
        const usersQuery = query(usersRef, where('__name__', 'in', batch));
        const snapshot = await getDocs(usersQuery);

        snapshot.docs.forEach(doc => {
          usersData[doc.id] = {
            id: doc.id,
            uid: doc.id,
            ...doc.data(),
          } as User;
        });
      }

      setUsers(usersData);
    } catch (err: any) {
      console.error('Error fetching users:', err);
    }
  };

  const fetchItems = async (itemIds: string[]) => {
    try {
      const itemsRef = collection(db, 'items');
      const itemsData: Record<string, Item> = {};

      for (let i = 0; i < itemIds.length; i += 10) {
        const batch = itemIds.slice(i, i + 10);
        const itemsQuery = query(itemsRef, where('__name__', 'in', batch));
        const snapshot = await getDocs(itemsQuery);

        snapshot.docs.forEach(doc => {
          itemsData[doc.id] = {
            id: doc.id,
            ...doc.data(),
          } as Item;
        });
      }

      setItems(itemsData);
    } catch (err: any) {
      console.error('Error fetching items:', err);
    }
  };

  const handleViewDetails = (rental: Rental) => {
    setSelectedRental(rental);
    setDetailsDialogOpen(true);
  };

  const handleCloseDetails = () => {
    setDetailsDialogOpen(false);
    setSelectedRental(null);
  };

  const handleCancelRental = async (rentalId: string) => {
    try {
      setActionLoading(true);

      const rentalRef = doc(db, 'rentals', rentalId);
      await updateDoc(rentalRef, {
        status: 'cancelled',
        updatedAt: new Date(),
      });

      await fetchRentals();
      handleCloseDetails();
    } catch (err: any) {
      console.error('Error cancelling rental:', err);
      setError('Failed to cancel rental. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'active':
      case 'completed':
        return 'success';
      case 'pending':
        return 'warning';
      case 'cancelled':
        return 'error';
      default:
        return 'default';
    }
  };

  const columns: GridColDef[] = [
    {
      field: 'itemInfo',
      headerName: 'Item',
      flex: 2,
      minWidth: 300,
      renderCell: (params: GridRenderCellParams) => {
        const rental = params.row as Rental;
        const item = items[rental.itemId];
        const renter = users[rental.renterId];
        const owner = users[rental.ownerId];

        return (
          <Box>
            <Typography variant="body2" fontWeight="bold">
              {item?.title || 'Unknown Item'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {`Renter: ${renter?.displayName || 'Unknown'} • Owner: ${owner?.displayName || 'Unknown'}`}
            </Typography>
          </Box>
        );
      },
    },
    {
      field: 'totalCost',
      headerName: 'Total Cost',
      width: 120,
      valueGetter: (_value, row) => row.pricing?.total || 0,
      valueFormatter: (params) => `$${params || 0}`,
    },
    {
      field: 'startDate',
      headerName: 'Start Date',
      width: 120,
      valueGetter: (_value, row) => row.dates?.confirmedStart || row.dates?.requestedStart,
      valueFormatter: (params) => {
        return params ? new Date(params).toLocaleDateString() : 'N/A';
      },
    },
    {
      field: 'endDate',
      headerName: 'End Date',
      width: 120,
      valueGetter: (_value, row) => row.dates?.confirmedEnd || row.dates?.requestedEnd,
      valueFormatter: (params) => {
        return params ? new Date(params).toLocaleDateString() : 'N/A';
      },
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (params: GridRenderCellParams) => {
        return (
          <Chip
            label={params.value || 'unknown'}
            color={getStatusColor(params.value)}
            size="small"
          />
        );
      },
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 100,
      sortable: false,
      renderCell: (params: GridRenderCellParams) => {
        return (
          <IconButton
            size="small"
            onClick={() => handleViewDetails(params.row)}
            color="primary"
          >
            <Visibility />
          </IconButton>
        );
      },
    },
  ];

  const filteredRentals = rentals.filter(rental => {
    const item = items[rental.itemId];
    const renter = users[rental.renterId];
    const owner = users[rental.ownerId];

    const matchesSearch =
      item?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      renter?.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      renter?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      owner?.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      owner?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rental.id?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || rental.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            Rentals Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage and monitor all rental transactions
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={fetchRentals}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            placeholder="Search rentals..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            size="small"
            sx={{ flexGrow: 1, minWidth: 200 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
          />

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              label="Status"
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="all">All Status</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="cancelled">Cancelled</MenuItem>
            </Select>
          </FormControl>
        </Box>

        <Box sx={{ mt: 2, display: 'flex', gap: 1, alignItems: 'center' }}>
          <FilterList fontSize="small" color="action" />
          <Typography variant="body2" color="text.secondary">
            {filteredRentals.length} of {rentals.length} rentals
          </Typography>
        </Box>
      </Paper>

      {/* Data Grid */}
      <Paper sx={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={filteredRentals}
          columns={columns}
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          pageSizeOptions={[10, 25, 50, 100]}
          loading={loading}
          disableRowSelectionOnClick
          sx={{
            border: 'none',
            '& .MuiDataGrid-cell:focus': {
              outline: 'none',
            },
          }}
        />
      </Paper>

      {/* Rental Details Dialog */}
      <Dialog
        open={detailsDialogOpen}
        onClose={handleCloseDetails}
        maxWidth="md"
        fullWidth
      >
        {selectedRental && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">Rental Details</Typography>
                <Chip
                  label={selectedRental.status || 'unknown'}
                  color={getStatusColor(selectedRental.status)}
                  size="small"
                />
              </Box>
            </DialogTitle>
            <DialogContent dividers>
              <Grid container spacing={3}>
                {/* Item Information */}
                <Grid item xs={12}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Item Information
                      </Typography>
                      <Divider sx={{ mb: 2 }} />
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2" color="text.secondary">
                            Item:
                          </Typography>
                          <Typography variant="body2">
                            {items[selectedRental.itemId]?.title || 'Unknown'}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2" color="text.secondary">
                            Category:
                          </Typography>
                          <Typography variant="body2">
                            {items[selectedRental.itemId]?.category || 'N/A'}
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Parties Involved */}
                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Renter
                      </Typography>
                      <Divider sx={{ mb: 2 }} />
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar>
                          {users[selectedRental.renterId]?.displayName?.charAt(0) || 'R'}
                        </Avatar>
                        <Box>
                          <Typography variant="body1">
                            {users[selectedRental.renterId]?.displayName || 'Unknown'}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {users[selectedRental.renterId]?.email || 'N/A'}
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Owner
                      </Typography>
                      <Divider sx={{ mb: 2 }} />
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar>
                          {users[selectedRental.ownerId]?.displayName?.charAt(0) || 'O'}
                        </Avatar>
                        <Box>
                          <Typography variant="body1">
                            {users[selectedRental.ownerId]?.displayName || 'Unknown'}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {users[selectedRental.ownerId]?.email || 'N/A'}
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Rental Details */}
                <Grid item xs={12}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Rental Details
                      </Typography>
                      <Divider sx={{ mb: 2 }} />
                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <CalendarToday fontSize="small" color="action" />
                            <Box>
                              <Typography variant="body2" color="text.secondary">
                                Start Date
                              </Typography>
                              <Typography variant="body1">
                                {selectedRental.dates?.confirmedStart || selectedRental.dates?.requestedStart
                                  ? new Date(
                                      selectedRental.dates?.confirmedStart || selectedRental.dates?.requestedStart
                                    ).toLocaleDateString('en-US', {
                                      year: 'numeric',
                                      month: 'long',
                                      day: 'numeric',
                                    })
                                  : 'N/A'}
                              </Typography>
                            </Box>
                          </Box>
                        </Grid>
                        <Grid item xs={6}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <CalendarToday fontSize="small" color="action" />
                            <Box>
                              <Typography variant="body2" color="text.secondary">
                                End Date
                              </Typography>
                              <Typography variant="body1">
                                {selectedRental.dates?.confirmedEnd || selectedRental.dates?.requestedEnd
                                  ? new Date(
                                      selectedRental.dates?.confirmedEnd || selectedRental.dates?.requestedEnd
                                    ).toLocaleDateString('en-US', {
                                      year: 'numeric',
                                      month: 'long',
                                      day: 'numeric',
                                    })
                                  : 'N/A'}
                              </Typography>
                            </Box>
                          </Box>
                        </Grid>
                        <Grid item xs={6}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <AttachMoney fontSize="small" color="action" />
                            <Box>
                              <Typography variant="body2" color="text.secondary">
                                Total Cost
                              </Typography>
                              <Typography variant="body1">
                                ${selectedRental.pricing?.total || 0}
                              </Typography>
                            </Box>
                          </Box>
                        </Grid>
                        <Grid item xs={6}>
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              Created
                            </Typography>
                            <Typography variant="body1">
                              {selectedRental.createdAt
                                ? new Date(selectedRental.createdAt).toLocaleDateString()
                                : 'N/A'}
                            </Typography>
                          </Box>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCloseDetails}>Close</Button>
              {selectedRental.status === 'active' && (
                <Button
                  variant="contained"
                  color="error"
                  startIcon={<Cancel />}
                  onClick={() => handleCancelRental(selectedRental.id)}
                  disabled={actionLoading}
                >
                  {actionLoading ? <CircularProgress size={20} /> : 'Cancel Rental'}
                </Button>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};
