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
  Switch,
  FormControlLabel,
  Slider,
  Divider,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Flag,
  Close,
} from '@mui/icons-material';
import { collection, addDoc, getDocs, query, orderBy, updateDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { FeatureFlag } from '../types';

export const FeatureFlagsPage: React.FC = () => {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedFlag, setSelectedFlag] = useState<FeatureFlag | null>(null);
  
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isEnabled, setIsEnabled] = useState(false);
  const [rolloutPercentage, setRolloutPercentage] = useState(100);

  useEffect(() => {
    fetchFlags();
  }, []);

  const fetchFlags = async () => {
    try {
      setLoading(true);
      const flagsRef = collection(db, 'feature_flags');
      const flagsQuery = query(flagsRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(flagsQuery);

      const flagsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as FeatureFlag[];

      setFlags(flagsData);
    } catch (err: any) {
      console.error('Error fetching flags:', err);
      setError('Failed to load feature flags. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFlag = async () => {
    try {
      if (!name) {
        setError('Please fill in all required fields.');
        return;
      }

      setLoading(true);

      const flag: Omit<FeatureFlag, 'id'> = {
        name,
        description,
        isEnabled,
        rolloutPercentage,
        targetAudience: {
          type: 'all',
        },
        createdBy: 'admin', // In production, use actual admin UID
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const flagsRef = collection(db, 'feature_flags');
      await addDoc(flagsRef, {
        ...flag,
        createdAt: Timestamp.fromDate(flag.createdAt),
        updatedAt: Timestamp.fromDate(flag.updatedAt),
      });

      setSuccess('Feature flag created successfully!');
      handleCloseCreateDialog();
      await fetchFlags();
    } catch (err: any) {
      console.error('Error creating flag:', err);
      setError('Failed to create feature flag. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateFlag = async () => {
    try {
      if (!selectedFlag || !name) {
        setError('Please fill in all required fields.');
        return;
      }

      setLoading(true);

      const flagRef = doc(db, 'feature_flags', selectedFlag.id);
      await updateDoc(flagRef, {
        name,
        description,
        isEnabled,
        rolloutPercentage,
        updatedAt: Timestamp.now(),
      });

      setSuccess('Feature flag updated successfully!');
      handleCloseEditDialog();
      await fetchFlags();
    } catch (err: any) {
      console.error('Error updating flag:', err);
      setError('Failed to update feature flag. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFlag = async (flag: FeatureFlag) => {
    try {
      setLoading(true);
      const flagRef = doc(db, 'feature_flags', flag.id);
      await updateDoc(flagRef, {
        isEnabled: !flag.isEnabled,
        updatedAt: Timestamp.now(),
      });

      setSuccess(`Feature flag ${!flag.isEnabled ? 'enabled' : 'disabled'} successfully!`);
      await fetchFlags();
    } catch (err: any) {
      console.error('Error toggling flag:', err);
      setError('Failed to toggle feature flag. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFlag = async (flagId: string) => {
    try {
      setLoading(true);
      const flagRef = doc(db, 'feature_flags', flagId);
      await deleteDoc(flagRef);
      setSuccess('Feature flag deleted successfully!');
      await fetchFlags();
    } catch (err: any) {
      console.error('Error deleting flag:', err);
      setError('Failed to delete feature flag. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditFlag = (flag: FeatureFlag) => {
    setSelectedFlag(flag);
    setName(flag.name);
    setDescription(flag.description || '');
    setIsEnabled(flag.isEnabled);
    setRolloutPercentage(flag.rolloutPercentage);
    setEditDialogOpen(true);
  };

  const handleCloseCreateDialog = () => {
    setCreateDialogOpen(false);
    setName('');
    setDescription('');
    setIsEnabled(false);
    setRolloutPercentage(100);
  };

  const handleCloseEditDialog = () => {
    setEditDialogOpen(false);
    setSelectedFlag(null);
    setName('');
    setDescription('');
    setIsEnabled(false);
    setRolloutPercentage(100);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            Feature Flags
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Enable/disable features and control rollout percentages
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setCreateDialogOpen(true)}
          disabled={loading}
        >
          Create Flag
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

      {loading && flags.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={3}>
          {flags.map((flag) => (
            <Grid item xs={12} md={6} lg={4} key={flag.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="h6" fontWeight="bold" gutterBottom>
                        {flag.name}
                      </Typography>
                    </Box>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={flag.isEnabled}
                          onChange={() => handleToggleFlag(flag)}
                          color="success"
                        />
                      }
                      label=""
                    />
                  </Box>

                  {flag.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {flag.description}
                    </Typography>
                  )}

                  <Divider sx={{ my: 2 }} />

                  <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        Rollout Percentage
                      </Typography>
                      <Chip
                        label={`${flag.rolloutPercentage}%`}
                        size="small"
                        color={flag.rolloutPercentage === 100 ? 'success' : 'warning'}
                      />
                    </Box>
                    <Box sx={{ px: 1 }}>
                      <Box
                        sx={{
                          height: 6,
                          bgcolor: 'grey.200',
                          borderRadius: 1,
                          overflow: 'hidden',
                        }}
                      >
                        <Box
                          sx={{
                            width: `${flag.rolloutPercentage}%`,
                            height: '100%',
                            bgcolor: flag.isEnabled ? 'success.main' : 'grey.400',
                            transition: 'width 0.3s',
                          }}
                        />
                      </Box>
                    </Box>
                  </Box>

                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                    Last updated: {flag.updatedAt.toLocaleDateString()}
                  </Typography>

                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <IconButton
                      size="small"
                      onClick={() => handleEditFlag(flag)}
                      color="primary"
                    >
                      <Edit />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteFlag(flag.id)}
                      color="error"
                    >
                      <Delete />
                    </IconButton>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}

          {flags.length === 0 && !loading && (
            <Grid item xs={12}>
              <Paper sx={{ p: 4, textAlign: 'center' }}>
                <Flag sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No feature flags yet
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Create your first feature flag to control feature rollout
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={() => setCreateDialogOpen(true)}
                >
                  Create Flag
                </Button>
              </Paper>
            </Grid>
          )}
        </Grid>
      )}

      {/* Create Flag Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={handleCloseCreateDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Create Feature Flag
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
                label="Flag Name"
                fullWidth
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., New Payment System"
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Description"
                fullWidth
                multiline
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this flag controls..."
              />
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={isEnabled}
                    onChange={(e) => setIsEnabled(e.target.checked)}
                    color="success"
                  />
                }
                label="Enable flag"
              />
            </Grid>

            <Grid item xs={12}>
              <Typography gutterBottom>
                Rollout Percentage: {rolloutPercentage}%
              </Typography>
              <Slider
                value={rolloutPercentage}
                onChange={(_, value) => setRolloutPercentage(value as number)}
                step={10}
                marks
                min={0}
                max={100}
                valueLabelDisplay="auto"
              />
              <Typography variant="caption" color="text.secondary">
                Controls the percentage of users who will see this feature
              </Typography>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCreateDialog}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateFlag}
            disabled={loading || !name}
          >
            {loading ? <CircularProgress size={20} /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Flag Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={handleCloseEditDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Edit Feature Flag
          <IconButton
            onClick={handleCloseEditDialog}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField
                label="Flag Name"
                fullWidth
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Description"
                fullWidth
                multiline
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={isEnabled}
                    onChange={(e) => setIsEnabled(e.target.checked)}
                    color="success"
                  />
                }
                label="Enable flag"
              />
            </Grid>

            <Grid item xs={12}>
              <Typography gutterBottom>
                Rollout Percentage: {rolloutPercentage}%
              </Typography>
              <Slider
                value={rolloutPercentage}
                onChange={(_, value) => setRolloutPercentage(value as number)}
                step={10}
                marks
                min={0}
                max={100}
                valueLabelDisplay="auto"
              />
              <Typography variant="caption" color="text.secondary">
                Controls the percentage of users who will see this feature
              </Typography>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEditDialog}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleUpdateFlag}
            disabled={loading || !name}
          >
            {loading ? <CircularProgress size={20} /> : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
