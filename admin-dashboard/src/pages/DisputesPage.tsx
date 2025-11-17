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
  ImageList,
  ImageListItem,
} from '@mui/material';
import {
  Visibility,
  Close,
  CheckCircle,
} from '@mui/icons-material';
import { collection, getDocs, query, orderBy, updateDoc, doc, Timestamp, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Dispute, DisputeStatus, DisputeReason } from '../types';

export const DisputesPage: React.FC = () => {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [statusFilter, setStatusFilter] = useState<DisputeStatus | 'all'>('all');
  
  // Resolution form
  const [resolutionDecision, setResolutionDecision] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [refundAmount, setRefundAmount] = useState('');

  useEffect(() => {
    fetchDisputes();
  }, [statusFilter]);

  const fetchDisputes = async () => {
    try {
      setLoading(true);
      const disputesRef = collection(db, 'disputes');
      
      let disputesQuery;
      if (statusFilter === 'all') {
        disputesQuery = query(disputesRef, orderBy('createdAt', 'desc'));
      } else {
        disputesQuery = query(
          disputesRef,
          where('status', '==', statusFilter),
          orderBy('createdAt', 'desc')
        );
      }
      
      const snapshot = await getDocs(disputesQuery);

      const disputesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        resolvedAt: doc.data().resolvedAt?.toDate(),
      })) as Dispute[];

      setDisputes(disputesData);
    } catch (err: any) {
      console.error('Error fetching disputes:', err);
      setError('Failed to load disputes. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResolveDispute = async () => {
    try {
      if (!selectedDispute || !resolutionDecision) {
        setError('Please fill in all required fields.');
        return;
      }

      setLoading(true);

      const disputeRef = doc(db, 'disputes', selectedDispute.id);
      await updateDoc(disputeRef, {
        status: 'resolved',
        resolution: {
          decision: resolutionDecision,
          notes: resolutionNotes,
          refundAmount: refundAmount ? parseFloat(refundAmount) : undefined,
          resolvedBy: 'admin',
          resolvedAt: Timestamp.now(),
        },
        resolvedAt: Timestamp.now(),
      });

      setSuccess('Dispute resolved successfully!');
      handleCloseDetailDialog();
      await fetchDisputes();
    } catch (err: any) {
      console.error('Error resolving dispute:', err);
      setError('Failed to resolve dispute. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDispute = (dispute: Dispute) => {
    setSelectedDispute(dispute);
    setResolutionDecision('');
    setResolutionNotes('');
    setRefundAmount('');
    setDetailDialogOpen(true);
  };

  const handleCloseDetailDialog = () => {
    setDetailDialogOpen(false);
    setSelectedDispute(null);
    setResolutionDecision('');
    setResolutionNotes('');
    setRefundAmount('');
  };

  const getStatusColor = (status: DisputeStatus) => {
    switch (status) {
      case 'open':
        return 'error';
      case 'investigating':
        return 'warning';
      case 'resolved':
        return 'success';
      case 'closed':
        return 'default';
      default:
        return 'default';
    }
  };

  const getReasonLabel = (reason: DisputeReason) => {
    return reason.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            Dispute Resolution
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage and resolve user disputes
          </Typography>
        </Box>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Filter by Status</InputLabel>
          <Select
            value={statusFilter}
            label="Filter by Status"
            onChange={(e) => setStatusFilter(e.target.value as any)}
          >
            <MenuItem value="all">All Disputes</MenuItem>
            <MenuItem value="open">Open</MenuItem>
            <MenuItem value="investigating">Investigating</MenuItem>
            <MenuItem value="resolved">Resolved</MenuItem>
            <MenuItem value="closed">Closed</MenuItem>
          </Select>
        </FormControl>
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

      {loading && disputes.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={3}>
          {disputes.map((dispute) => (
            <Grid item xs={12} md={6} lg={4} key={dispute.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                    <Typography variant="h6" fontWeight="bold" sx={{ flexGrow: 1 }}>
                      {getReasonLabel(dispute.reason)}
                    </Typography>
                    <Chip
                      label={dispute.status}
                      color={getStatusColor(dispute.status)}
                      size="small"
                    />
                  </Box>

                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {dispute.description.length > 100
                      ? `${dispute.description.substring(0, 100)}...`
                      : dispute.description}
                  </Typography>

                  <Divider sx={{ my: 2 }} />

                  <Grid container spacing={1} sx={{ mb: 2 }}>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">
                        Reported By
                      </Typography>
                      <Typography variant="body2">
                        {dispute.reportedBy.substring(0, 8)}...
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">
                        Evidence
                      </Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {dispute.evidence?.length || 0} items
                      </Typography>
                    </Grid>
                  </Grid>

                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                    Created: {dispute.createdAt.toLocaleDateString()}
                  </Typography>

                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<Visibility />}
                      onClick={() => handleViewDispute(dispute)}
                      fullWidth
                    >
                      View Details
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}

          {disputes.length === 0 && !loading && (
            <Grid item xs={12}>
              <Paper sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No disputes found
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {statusFilter === 'all' 
                    ? 'There are currently no disputes in the system'
                    : `There are no ${statusFilter} disputes`}
                </Typography>
              </Paper>
            </Grid>
          )}
        </Grid>
      )}

      {/* Detail Dialog */}
      <Dialog
        open={detailDialogOpen}
        onClose={handleCloseDetailDialog}
        maxWidth="md"
        fullWidth
      >
        {selectedDispute && (
          <>
            <DialogTitle>
              Dispute Details
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
                  <Chip
                    label={selectedDispute.status}
                    color={getStatusColor(selectedDispute.status)}
                    size="small"
                  />
                </Grid>

                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>
                    Reason
                  </Typography>
                  <Typography variant="body1">
                    {getReasonLabel(selectedDispute.reason)}
                  </Typography>
                </Grid>

                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>
                    Description
                  </Typography>
                  <Typography variant="body1">{selectedDispute.description}</Typography>
                </Grid>

                <Grid item xs={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Reported By
                  </Typography>
                  <Typography variant="body2">{selectedDispute.reportedBy}</Typography>
                </Grid>

                <Grid item xs={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Reported Against
                  </Typography>
                  <Typography variant="body2">{selectedDispute.reportedAgainst}</Typography>
                </Grid>

                {selectedDispute.evidence && selectedDispute.evidence.length > 0 && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" gutterBottom>
                      Evidence ({selectedDispute.evidence.length} items)
                    </Typography>
                    <ImageList cols={3} gap={8}>
                      {selectedDispute.evidence.map((evidence, index) => (
                        <ImageListItem key={index}>
                          {evidence.type === 'image' && (
                            <img
                              src={evidence.url}
                              alt={`Evidence ${index + 1}`}
                              loading="lazy"
                              style={{ borderRadius: 4 }}
                            />
                          )}
                        </ImageListItem>
                      ))}
                    </ImageList>
                  </Grid>
                )}

                {selectedDispute.status !== 'resolved' && selectedDispute.status !== 'closed' && (
                  <>
                    <Grid item xs={12}>
                      <Divider />
                    </Grid>

                    <Grid item xs={12}>
                      <Typography variant="h6" gutterBottom>
                        Resolve Dispute
                      </Typography>
                    </Grid>

                    <Grid item xs={12}>
                      <TextField
                        label="Resolution Decision"
                        fullWidth
                        required
                        multiline
                        rows={3}
                        value={resolutionDecision}
                        onChange={(e) => setResolutionDecision(e.target.value)}
                        placeholder="Enter your decision..."
                      />
                    </Grid>

                    <Grid item xs={12}>
                      <TextField
                        label="Notes"
                        fullWidth
                        multiline
                        rows={2}
                        value={resolutionNotes}
                        onChange={(e) => setResolutionNotes(e.target.value)}
                        placeholder="Additional notes (optional)..."
                      />
                    </Grid>

                    <Grid item xs={12}>
                      <TextField
                        label="Refund Amount (Optional)"
                        fullWidth
                        type="number"
                        value={refundAmount}
                        onChange={(e) => setRefundAmount(e.target.value)}
                        placeholder="0.00"
                        InputProps={{
                          startAdornment: '$',
                        }}
                      />
                    </Grid>
                  </>
                )}

                {selectedDispute.resolution && (
                  <>
                    <Grid item xs={12}>
                      <Divider />
                    </Grid>

                    <Grid item xs={12}>
                      <Typography variant="h6" gutterBottom>
                        Resolution
                      </Typography>
                    </Grid>

                    <Grid item xs={12}>
                      <Typography variant="subtitle2" gutterBottom>
                        Decision
                      </Typography>
                      <Typography variant="body1">{selectedDispute.resolution.decision}</Typography>
                    </Grid>

                    {selectedDispute.resolution.notes && (
                      <Grid item xs={12}>
                        <Typography variant="subtitle2" gutterBottom>
                          Notes
                        </Typography>
                        <Typography variant="body1">{selectedDispute.resolution.notes}</Typography>
                      </Grid>
                    )}

                    {selectedDispute.resolution.refundAmount && (
                      <Grid item xs={12}>
                        <Typography variant="subtitle2" gutterBottom>
                          Refund Amount
                        </Typography>
                        <Typography variant="body1">
                          ${selectedDispute.resolution.refundAmount.toFixed(2)}
                        </Typography>
                      </Grid>
                    )}

                    <Grid item xs={12}>
                      <Typography variant="caption" color="text.secondary">
                        Resolved by {selectedDispute.resolution.resolvedBy} on{' '}
                        {selectedDispute.resolution.resolvedAt.toLocaleDateString()}
                      </Typography>
                    </Grid>
                  </>
                )}
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCloseDetailDialog}>Close</Button>
              {selectedDispute.status !== 'resolved' && selectedDispute.status !== 'closed' && (
                <Button
                  variant="contained"
                  startIcon={<CheckCircle />}
                  onClick={handleResolveDispute}
                  disabled={loading || !resolutionDecision}
                >
                  {loading ? <CircularProgress size={20} /> : 'Resolve Dispute'}
                </Button>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};
