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
  FormGroup,
  FormControlLabel,
  Checkbox,
  Divider,
} from '@mui/material';
import {
  Add,
  Send,
  Delete,
  Visibility,
  Schedule,
  People,
  Close,
} from '@mui/icons-material';
import { collection, addDoc, getDocs, query, orderBy, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { NotificationCampaign } from '../types';

export const NotificationsPage: React.FC = () => {
  const [campaigns, setCampaigns] = useState<NotificationCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<NotificationCampaign | null>(null);
  
  // Form state
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [audienceType, setAudienceType] = useState<'all' | 'segment' | 'custom'>('all');
  const [schedulingType, setSchedulingType] = useState<'immediate' | 'scheduled'>('immediate');
  const [scheduledDate, setScheduledDate] = useState('');
  const [filters, setFilters] = useState({
    verified: false,
    unverified: false,
    activeListers: false,
    activeRenters: false,
  });

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const campaignsRef = collection(db, 'notification_campaigns');
      const campaignsQuery = query(campaignsRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(campaignsQuery);

      const campaignsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        sentAt: doc.data().sentAt?.toDate(),
        scheduling: {
          ...doc.data().scheduling,
          scheduledAt: doc.data().scheduling?.scheduledAt?.toDate(),
        },
      })) as NotificationCampaign[];

      setCampaigns(campaignsData);
    } catch (err: any) {
      console.error('Error fetching campaigns:', err);
      setError('Failed to load campaigns. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCampaign = async () => {
    try {
      if (!title || !message) {
        setError('Please fill in all required fields.');
        return;
      }

      setLoading(true);

      const campaign: Omit<NotificationCampaign, 'id'> = {
        title,
        message,
        ...(imageUrl && { imageUrl }),
        targetAudience: {
          type: audienceType,
          filters: audienceType === 'custom' ? [
            ...(filters.verified ? [{ field: 'verified' as const, operator: 'equals' as const, value: true }] : []),
            ...(filters.unverified ? [{ field: 'verified' as const, operator: 'equals' as const, value: false }] : []),
          ] : undefined,
        },
        scheduling: {
          type: schedulingType,
          scheduledAt: schedulingType === 'scheduled' && scheduledDate
            ? new Date(scheduledDate)
            : undefined,
        },
        status: schedulingType === 'immediate' ? 'sending' : 'scheduled',
        stats: {
          targetUsers: 0,
          sent: 0,
          delivered: 0,
          opened: 0,
          clicked: 0,
          failed: 0,
        },
        createdBy: 'admin', // In production, use actual admin UID
        createdAt: new Date(),
      };

      const campaignsRef = collection(db, 'notification_campaigns');
      await addDoc(campaignsRef, {
        ...campaign,
        createdAt: Timestamp.fromDate(campaign.createdAt),
        scheduling: {
          ...campaign.scheduling,
          scheduledAt: campaign.scheduling.scheduledAt 
            ? Timestamp.fromDate(campaign.scheduling.scheduledAt)
            : null,
        },
      });

      setSuccess(
        schedulingType === 'immediate'
          ? 'Campaign created and sending!'
          : 'Campaign scheduled successfully!'
      );
      
      handleCloseCreateDialog();
      await fetchCampaigns();
    } catch (err: any) {
      console.error('Error creating campaign:', err);
      setError('Failed to create campaign. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    try {
      setLoading(true);
      const campaignRef = doc(db, 'notification_campaigns', campaignId);
      await deleteDoc(campaignRef);
      setSuccess('Campaign deleted successfully!');
      await fetchCampaigns();
    } catch (err: any) {
      console.error('Error deleting campaign:', err);
      setError('Failed to delete campaign. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleViewCampaign = (campaign: NotificationCampaign) => {
    setSelectedCampaign(campaign);
    setPreviewDialogOpen(true);
  };

  const handleCloseCreateDialog = () => {
    setCreateDialogOpen(false);
    setTitle('');
    setMessage('');
    setImageUrl('');
    setAudienceType('all');
    setSchedulingType('immediate');
    setScheduledDate('');
    setFilters({
      verified: false,
      unverified: false,
      activeListers: false,
      activeRenters: false,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
        return 'success';
      case 'sending':
        return 'info';
      case 'scheduled':
        return 'warning';
      case 'draft':
        return 'default';
      case 'cancelled':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            Notification Campaigns
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Create and manage push notification campaigns
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setCreateDialogOpen(true)}
          disabled={loading}
        >
          Create Campaign
        </Button>
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

      {loading && campaigns.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={3}>
          {campaigns.map((campaign) => (
            <Grid item xs={12} md={6} lg={4} key={campaign.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                    <Typography variant="h6" fontWeight="bold" sx={{ flexGrow: 1 }}>
                      {campaign.title}
                    </Typography>
                    <Chip
                      label={campaign.status}
                      color={getStatusColor(campaign.status)}
                      size="small"
                    />
                  </Box>

                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {campaign.message.length > 100
                      ? `${campaign.message.substring(0, 100)}...`
                      : campaign.message}
                  </Typography>

                  <Divider sx={{ my: 2 }} />

                  <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                    <Chip
                      icon={<People />}
                      label={`Target: ${campaign.targetAudience.type}`}
                      size="small"
                      variant="outlined"
                    />
                    {campaign.scheduling.type === 'scheduled' && (
                      <Chip
                        icon={<Schedule />}
                        label="Scheduled"
                        size="small"
                        variant="outlined"
                      />
                    )}
                  </Box>

                  <Grid container spacing={1} sx={{ mb: 2 }}>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">
                        Sent
                      </Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {campaign.stats.sent.toLocaleString()}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">
                        Opened
                      </Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {campaign.stats.opened.toLocaleString()}
                      </Typography>
                    </Grid>
                  </Grid>

                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <IconButton
                      size="small"
                      onClick={() => handleViewCampaign(campaign)}
                      color="primary"
                    >
                      <Visibility />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteCampaign(campaign.id)}
                      color="error"
                      disabled={campaign.status === 'sending'}
                    >
                      <Delete />
                    </IconButton>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}

          {campaigns.length === 0 && !loading && (
            <Grid item xs={12}>
              <Paper sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No campaigns yet
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Create your first notification campaign to engage with users
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={() => setCreateDialogOpen(true)}
                >
                  Create Campaign
                </Button>
              </Paper>
            </Grid>
          )}
        </Grid>
      )}

      {/* Create Campaign Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={handleCloseCreateDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Create Notification Campaign
          <IconButton
            onClick={handleCloseCreateDialog}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField
                label="Campaign Title"
                fullWidth
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., New Feature Announcement"
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Message"
                fullWidth
                required
                multiline
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Enter your notification message..."
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Image URL (Optional)"
                fullWidth
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
              />
            </Grid>

            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Target Audience</InputLabel>
                <Select
                  value={audienceType}
                  label="Target Audience"
                  onChange={(e) => setAudienceType(e.target.value as any)}
                >
                  <MenuItem value="all">All Users</MenuItem>
                  <MenuItem value="segment">Predefined Segment</MenuItem>
                  <MenuItem value="custom">Custom Filters</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {audienceType === 'custom' && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Filter by:
                </Typography>
                <FormGroup>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={filters.verified}
                        onChange={(e) => setFilters({ ...filters, verified: e.target.checked })}
                      />
                    }
                    label="Verified Users"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={filters.unverified}
                        onChange={(e) => setFilters({ ...filters, unverified: e.target.checked })}
                      />
                    }
                    label="Unverified Users"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={filters.activeListers}
                        onChange={(e) => setFilters({ ...filters, activeListers: e.target.checked })}
                      />
                    }
                    label="Active Item Listers"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={filters.activeRenters}
                        onChange={(e) => setFilters({ ...filters, activeRenters: e.target.checked })}
                      />
                    }
                    label="Active Renters"
                  />
                </FormGroup>
              </Grid>
            )}

            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Scheduling</InputLabel>
                <Select
                  value={schedulingType}
                  label="Scheduling"
                  onChange={(e) => setSchedulingType(e.target.value as any)}
                >
                  <MenuItem value="immediate">Send Immediately</MenuItem>
                  <MenuItem value="scheduled">Schedule for Later</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {schedulingType === 'scheduled' && (
              <Grid item xs={12}>
                <TextField
                  label="Schedule Date & Time"
                  type="datetime-local"
                  fullWidth
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  InputLabelProps={{
                    shrink: true,
                  }}
                />
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCreateDialog}>Cancel</Button>
          <Button
            variant="contained"
            startIcon={schedulingType === 'immediate' ? <Send /> : <Schedule />}
            onClick={handleCreateCampaign}
            disabled={loading || !title || !message}
          >
            {loading ? (
              <CircularProgress size={20} />
            ) : schedulingType === 'immediate' ? (
              'Send Now'
            ) : (
              'Schedule'
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Preview Campaign Dialog */}
      <Dialog
        open={previewDialogOpen}
        onClose={() => setPreviewDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        {selectedCampaign && (
          <>
            <DialogTitle>Campaign Details</DialogTitle>
            <DialogContent>
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Title
                </Typography>
                <Typography variant="body1" fontWeight="bold">
                  {selectedCampaign.title}
                </Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Message
                </Typography>
                <Typography variant="body1">{selectedCampaign.message}</Typography>
              </Box>

              {selectedCampaign.imageUrl && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Image
                  </Typography>
                  <img
                    src={selectedCampaign.imageUrl}
                    alt="Campaign"
                    style={{ width: '100%', borderRadius: 8 }}
                  />
                </Box>
              )}

              <Divider sx={{ my: 2 }} />

              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Status
                  </Typography>
                  <Chip
                    label={selectedCampaign.status}
                    color={getStatusColor(selectedCampaign.status)}
                    size="small"
                  />
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Target
                  </Typography>
                  <Typography variant="body2">
                    {selectedCampaign.targetAudience.type}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Sent
                  </Typography>
                  <Typography variant="body2">
                    {selectedCampaign.stats.sent.toLocaleString()}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Opened
                  </Typography>
                  <Typography variant="body2">
                    {selectedCampaign.stats.opened.toLocaleString()}
                  </Typography>
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setPreviewDialogOpen(false)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};
