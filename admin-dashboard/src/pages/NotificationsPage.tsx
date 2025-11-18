import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Send as SendIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../config/firebase';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  where,
} from 'firebase/firestore';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  targetUsers: 'all' | 'verified' | 'unverified' | 'specific';
  userIds?: string[];
  status: 'draft' | 'sent' | 'scheduled';
  scheduledFor?: Date;
  sentAt?: Date;
  createdAt: Date;
  createdBy: string;
  sentCount?: number;
  readCount?: number;
}

const NotificationsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNotification, setEditingNotification] = useState<Notification | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    type: 'info' as Notification['type'],
    targetUsers: 'all' as Notification['targetUsers'],
    userIds: [] as string[],
    status: 'draft' as Notification['status'],
    scheduledFor: '',
  });
  const [error, setError] = useState('');

  useEffect(() => {
    const q = query(
      collection(db, 'notification_campaigns'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notificationsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        sentAt: doc.data().sentAt?.toDate(),
        scheduledFor: doc.data().scheduledFor?.toDate(),
      })) as Notification[];
      
      setNotifications(notificationsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleOpenDialog = (notification?: Notification) => {
    if (notification) {
      setEditingNotification(notification);
      setFormData({
        title: notification.title,
        message: notification.message,
        type: notification.type,
        targetUsers: notification.targetUsers,
        userIds: notification.userIds || [],
        status: notification.status,
        scheduledFor: notification.scheduledFor ? notification.scheduledFor.toISOString().slice(0, 16) : '',
      });
    } else {
      setEditingNotification(null);
      setFormData({
        title: '',
        message: '',
        type: 'info',
        targetUsers: 'all',
        userIds: [],
        status: 'draft',
        scheduledFor: '',
      });
    }
    setDialogOpen(true);
    setError('');
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingNotification(null);
    setFormData({
      title: '',
      message: '',
      type: 'info',
      targetUsers: 'all',
      userIds: [],
      status: 'draft',
      scheduledFor: '',
    });
    setError('');
  };

  const handleSave = async () => {
    if (!formData.title.trim() || !formData.message.trim()) {
      setError('Title and message are required');
      return;
    }

    try {
      const notificationData = {
        title: formData.title.trim(),
        message: formData.message.trim(),
        type: formData.type,
        targetUsers: formData.targetUsers,
        userIds: formData.targetUsers === 'specific' ? formData.userIds : null,
        status: formData.status,
        scheduledFor: formData.scheduledFor ? new Date(formData.scheduledFor) : null,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser?.uid,
      };

      if (editingNotification) {
        await updateDoc(doc(db, 'notification_campaigns', editingNotification.id), notificationData);
      } else {
        await addDoc(collection(db, 'notification_campaigns'), {
          ...notificationData,
          createdAt: serverTimestamp(),
          createdBy: currentUser?.uid,
        });
      }

      handleCloseDialog();
    } catch (error) {
      console.error('Error saving notification:', error);
      setError('Failed to save notification');
    }
  };

  const handleDelete = async (notificationId: string) => {
    if (!window.confirm('Are you sure you want to delete this notification?')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'notification_campaigns', notificationId));
    } catch (error) {
      console.error('Error deleting notification:', error);
      setError('Failed to delete notification');
    }
  };

  const handleSend = async (notification: Notification) => {
    if (!window.confirm('Are you sure you want to send this notification?')) {
      return;
    }

    try {
      // Update status to sent
      await updateDoc(doc(db, 'notification_campaigns', notification.id), {
        status: 'sent',
        sentAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: currentUser?.uid,
      });

      // Here you would implement the actual sending logic
      // For now, we'll just mark it as sent
      console.log('Notification sent:', notification);
    } catch (error) {
      console.error('Error sending notification:', error);
      setError('Failed to send notification');
    }
  };

  const getStatusColor = (status: Notification['status']) => {
    switch (status) {
      case 'sent':
        return 'success';
      case 'scheduled':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getTypeColor = (type: Notification['type']) => {
    switch (type) {
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      case 'success':
        return 'success';
      default:
        return 'info';
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Typography>Loading notifications...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Notification Campaigns
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Create Notification
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Title</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Target</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Sent</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {notifications.map((notification) => (
              <TableRow key={notification.id}>
                <TableCell>
                  <Typography variant="subtitle2">{notification.title}</Typography>
                  <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 300 }}>
                    {notification.message}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={notification.type}
                    color={getTypeColor(notification.type)}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {notification.targetUsers === 'all' && 'All Users'}
                    {notification.targetUsers === 'verified' && 'Verified Users'}
                    {notification.targetUsers === 'unverified' && 'Unverified Users'}
                    {notification.targetUsers === 'specific' && `${notification.userIds?.length || 0} Users`}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={notification.status}
                    color={getStatusColor(notification.status)}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {notification.createdAt?.toLocaleDateString()}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {notification.sentAt ? notification.sentAt.toLocaleDateString() : '-'}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  {notification.status === 'draft' && (
                    <>
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDialog(notification)}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleSend(notification)}
                        color="primary"
                      >
                        <SendIcon />
                      </IconButton>
                    </>
                  )}
                  <IconButton
                    size="small"
                    onClick={() => handleDelete(notification.id)}
                    color="error"
                  >
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingNotification ? 'Edit Notification' : 'Create Notification'}
        </DialogTitle>
        <DialogContent>
          <Box component="form" sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label="Title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              margin="normal"
              required
            />
            <TextField
              fullWidth
              label="Message"
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              margin="normal"
              multiline
              rows={4}
              required
            />
            <FormControl fullWidth margin="normal">
              <InputLabel>Type</InputLabel>
              <Select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as Notification['type'] })}
                label="Type"
              >
                <MenuItem value="info">Info</MenuItem>
                <MenuItem value="warning">Warning</MenuItem>
                <MenuItem value="error">Error</MenuItem>
                <MenuItem value="success">Success</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth margin="normal">
              <InputLabel>Target Users</InputLabel>
              <Select
                value={formData.targetUsers}
                onChange={(e) => setFormData({ ...formData, targetUsers: e.target.value as Notification['targetUsers'] })}
                label="Target Users"
              >
                <MenuItem value="all">All Users</MenuItem>
                <MenuItem value="verified">Verified Users</MenuItem>
                <MenuItem value="unverified">Unverified Users</MenuItem>
                <MenuItem value="specific">Specific Users</MenuItem>
              </Select>
            </FormControl>
            {formData.targetUsers === 'specific' && (
              <TextField
                fullWidth
                label="User IDs (comma-separated)"
                value={formData.userIds.join(', ')}
                onChange={(e) => setFormData({
                  ...formData,
                  userIds: e.target.value.split(',').map(id => id.trim()).filter(id => id)
                })}
                margin="normal"
                helperText="Enter user IDs separated by commas"
              />
            )}
            <FormControl fullWidth margin="normal">
              <InputLabel>Status</InputLabel>
              <Select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as Notification['status'] })}
                label="Status"
              >
                <MenuItem value="draft">Draft</MenuItem>
                <MenuItem value="scheduled">Scheduled</MenuItem>
                <MenuItem value="sent">Sent</MenuItem>
              </Select>
            </FormControl>
            {formData.status === 'scheduled' && (
              <TextField
                fullWidth
                label="Schedule For"
                type="datetime-local"
                value={formData.scheduledFor}
                onChange={(e) => setFormData({ ...formData, scheduledFor: e.target.value })}
                margin="normal"
                InputLabelProps={{
                  shrink: true,
                }}
              />
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSave} variant="contained">
            {editingNotification ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default NotificationsPage;
