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
  Avatar,
  Grid,
  Card,
  CardMedia,
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
  Block,
  CheckCircle,
  FilterList,
  Image as ImageIcon,
} from '@mui/icons-material';
import { collection, getDocs, query, orderBy, doc, updateDoc, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Item, User } from '../types';

export const ItemsPage: React.FC = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [users, setUsers] = useState<Record<string, User>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 10,
  });

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      setLoading(true);
      setError(null);

      const itemsRef = collection(db, 'items');
      const itemsQuery = query(itemsRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(itemsQuery);

      const itemsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      })) as Item[];

      setItems(itemsData);

      // Fetch user data for all unique owner IDs
      const ownerIds = Array.from(new Set(itemsData.map(item => item.ownerId).filter(Boolean)));
      if (ownerIds.length > 0) {
        await fetchUsers(ownerIds);
      }
    } catch (err: any) {
      console.error('Error fetching items:', err);
      setError('Failed to load items. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async (userIds: string[]) => {
    try {
      const usersRef = collection(db, 'users');
      const usersData: Record<string, User> = {};

      // Fetch users in batches of 10 (Firestore limit for 'in' queries)
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
      // Don't show error for user fetch failures, just use fallback
    }
  };

  const handleViewDetails = (item: Item) => {
    setSelectedItem(item);
    setDetailsDialogOpen(true);
  };

  const handleCloseDetails = () => {
    setDetailsDialogOpen(false);
    setSelectedItem(null);
  };

  const handleToggleStatus = async (itemId: string, currentStatus: string) => {
    try {
      setActionLoading(true);
      const newStatus = currentStatus === 'active' ? 'suspended' : 'active';

      const itemRef = doc(db, 'items', itemId);
      await updateDoc(itemRef, {
        status: newStatus,
        updatedAt: new Date(),
      });

      // Refresh items list
      await fetchItems();

      handleCloseDetails();
    } catch (err: any) {
      console.error('Error updating item status:', err);
      setError('Failed to update item status. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'pending':
        return 'warning';
      case 'suspended':
        return 'error';
      case 'rented':
        return 'info';
      default:
        return 'default';
    }
  };

  const getConditionColor = (condition?: string) => {
    switch (condition) {
      case 'new':
        return 'success';
      case 'like_new':
        return 'info';
      case 'good':
        return 'warning';
      case 'fair':
        return 'error';
      default:
        return 'default';
    }
  };

  const columns: GridColDef[] = [
    {
      field: 'images',
      headerName: 'Image',
      width: 80,
      sortable: false,
      renderCell: (params: GridRenderCellParams) => {
        const images = params.row.images || [];
        return (
          <Avatar
            variant="rounded"
            src={images[0]}
            sx={{ width: 48, height: 48 }}
          >
            <ImageIcon />
          </Avatar>
        );
      },
    },
    {
      field: 'title',
      headerName: 'Title',
      flex: 1,
      minWidth: 200,
    },
    {
      field: 'ownerName',
      headerName: 'Owner',
      flex: 1,
      minWidth: 150,
      valueGetter: (_value, row) => {
        const user = users[row.ownerId];
        return user?.displayName || user?.email || row.ownerId || 'Unknown';
      },
    },
    {
      field: 'category',
      headerName: 'Category',
      width: 120,
    },
    {
      field: 'dailyRate',
      headerName: 'Price',
      width: 100,
      valueGetter: (_value, row) => row.pricing?.dailyRate || 0,
      valueFormatter: (params) => `$${params || 0}/day`,
    },
    {
      field: 'condition',
      headerName: 'Condition',
      width: 120,
      renderCell: (params: GridRenderCellParams) => {
        const condition = params.value || 'unknown';
        return (
          <Chip
            label={condition.replace('_', ' ').toUpperCase()}
            color={getConditionColor(condition)}
            size="small"
          />
        );
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
      field: 'createdAt',
      headerName: 'Listed',
      width: 120,
      valueFormatter: (params) => {
        return new Date(params).toLocaleDateString();
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

  // Filter items based on search and filters
  const filteredItems = items.filter(item => {
    const user = users[item.ownerId];
    const ownerName = user?.displayName || user?.email || item.ownerId || '';

    const matchesSearch =
      item.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ownerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.ownerId?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  // Get unique categories for filter dropdown
  const categories = Array.from(new Set(items.map(item => item.category).filter(Boolean)));

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            Items Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage and moderate platform listings
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={fetchItems}
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
            placeholder="Search items..."
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
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="suspended">Suspended</MenuItem>
              <MenuItem value="rented">Rented</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Category</InputLabel>
            <Select
              value={categoryFilter}
              label="Category"
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <MenuItem value="all">All Categories</MenuItem>
              {categories.map(category => (
                <MenuItem key={category} value={category}>
                  {category}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Box sx={{ mt: 2, display: 'flex', gap: 1, alignItems: 'center' }}>
          <FilterList fontSize="small" color="action" />
          <Typography variant="body2" color="text.secondary">
            {filteredItems.length} of {items.length} items
          </Typography>
        </Box>
      </Paper>

      {/* Data Grid */}
      <Paper sx={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={filteredItems}
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

      {/* Item Details Dialog */}
      <Dialog
        open={detailsDialogOpen}
        onClose={handleCloseDetails}
        maxWidth="md"
        fullWidth
      >
        {selectedItem && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">Item Details</Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Chip
                    label={selectedItem.condition || 'unknown'}
                    color={getConditionColor(selectedItem.condition)}
                    size="small"
                  />
                  <Chip
                    label={selectedItem.status || 'unknown'}
                    color={getStatusColor(selectedItem.status)}
                    size="small"
                  />
                </Box>
              </Box>
            </DialogTitle>
            <DialogContent dividers>
              <Grid container spacing={3}>
                {/* Images */}
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" gutterBottom>
                    Images
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {selectedItem.images && selectedItem.images.length > 0 ? (
                      selectedItem.images.map((image, index) => (
                        <Card key={index} sx={{ width: 120, height: 120 }}>
                          <CardMedia
                            component="img"
                            height="120"
                            image={image}
                            alt={`Item image ${index + 1}`}
                          />
                        </Card>
                      ))
                    ) : (
                      <Box
                        sx={{
                          width: 120,
                          height: 120,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: 'grey.100',
                          borderRadius: 1,
                        }}
                      >
                        <ImageIcon sx={{ fontSize: 48, color: 'grey.400' }} />
                      </Box>
                    )}
                  </Box>
                </Grid>

                {/* Details */}
                <Grid item xs={12} md={6}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">
                        Title
                      </Typography>
                      <Typography variant="body1">{selectedItem.title || 'N/A'}</Typography>
                    </Box>

                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">
                        Description
                      </Typography>
                      <Typography variant="body1">
                        {selectedItem.description || 'No description provided'}
                      </Typography>
                    </Box>

                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">
                        Price
                      </Typography>
                      <Typography variant="body1">
                        ${selectedItem.pricing?.dailyRate || 0} per day
                      </Typography>
                    </Box>

                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">
                        Category
                      </Typography>
                      <Typography variant="body1">
                        {selectedItem.category || 'Uncategorized'}
                      </Typography>
                    </Box>

                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">
                        Owner ID
                      </Typography>
                      <Typography variant="body1" sx={{ fontFamily: 'monospace' }}>
                        {selectedItem.ownerId || 'N/A'}
                      </Typography>
                    </Box>

                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">
                        Listed Date
                      </Typography>
                      <Typography variant="body1">
                        {selectedItem.createdAt
                          ? new Date(selectedItem.createdAt).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })
                          : 'N/A'}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCloseDetails}>Close</Button>
              <Button
                variant="contained"
                color={selectedItem.status === 'active' ? 'error' : 'success'}
                startIcon={selectedItem.status === 'active' ? <Block /> : <CheckCircle />}
                onClick={() => handleToggleStatus(selectedItem.id, selectedItem.status || 'active')}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <CircularProgress size={20} />
                ) : selectedItem.status === 'active' ? (
                  'Suspend Item'
                ) : (
                  'Activate Item'
                )}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};
