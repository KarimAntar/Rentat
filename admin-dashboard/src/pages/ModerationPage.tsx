import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Chip,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Card,
  CardContent,
  CardActions,
  Grid,
} from '@mui/material';
import { CheckCircle, Cancel } from '@mui/icons-material';
import { collection, getDocs, query, where, orderBy, updateDoc, doc } from 'firebase/firestore';
import { db } from '../config/firebase';

interface ModerationItem {
  id: string;
  type: 'item' | 'review' | 'message';
  resourceId: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  content?: any;
}

export const ModerationPage: React.FC = () => {
  const [items, setItems] = useState<ModerationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);

  useEffect(() => {
    fetchModerationItems();
  }, [tabValue]);

  const fetchModerationItems = async () => {
    try {
      setLoading(true);
      const types = ['item', 'review', 'message'];
      const moderationRef = collection(db, 'moderation_queue');
      const moderationQuery = query(
        moderationRef,
        where('type', '==', types[tabValue]),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(moderationQuery);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      })) as ModerationItem[];

      setItems(data);
    } catch (err: any) {
      console.error('Error fetching moderation items:', err);
      setError('Failed to load moderation queue.');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (itemId: string) => {
    try {
      await updateDoc(doc(db, 'moderation_queue', itemId), {
        status: 'approved',
        reviewedAt: new Date(),
      });
      setSuccess('Item approved successfully!');
      fetchModerationItems();
    } catch (err: any) {
      setError('Failed to approve item.');
    }
  };

  const handleReject = async (itemId: string) => {
    try {
      await updateDoc(doc(db, 'moderation_queue', itemId), {
        status: 'rejected',
        reviewedAt: new Date(),
      });
      setSuccess('Item rejected successfully!');
      fetchModerationItems();
    } catch (err: any) {
      setError('Failed to reject item.');
    }
  };

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Content Moderation
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Review and moderate flagged content
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ mb: 3 }}>
        <Tab label="Items" />
        <Tab label="Reviews" />
        <Tab label="Messages" />
      </Tabs>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={3}>
          {items.map((item) => (
            <Grid item xs={12} md={6} lg={4} key={item.id}>
              <Card>
                <CardContent>
                  <Chip label={item.type} size="small" sx={{ mb: 2 }} />
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Reason: {item.reason}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {item.createdAt.toLocaleDateString()}
                  </Typography>
                </CardContent>
                <CardActions>
                  <Button
                    size="small"
                    startIcon={<CheckCircle />}
                    onClick={() => handleApprove(item.id)}
                    color="success"
                  >
                    Approve
                  </Button>
                  <Button
                    size="small"
                    startIcon={<Cancel />}
                    onClick={() => handleReject(item.id)}
                    color="error"
                  >
                    Reject
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
          {items.length === 0 && (
            <Grid item xs={12}>
              <Paper sx={{ p: 4, textAlign: 'center' }}>
                <Typography color="text.secondary">
                  No items pending moderation
                </Typography>
              </Paper>
            </Grid>
          )}
        </Grid>
      )}
    </Box>
  );
};
