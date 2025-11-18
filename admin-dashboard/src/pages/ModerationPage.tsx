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
  Avatar,
  Divider,
} from '@mui/material';
import { Cancel, Visibility, Block } from '@mui/icons-material';
import { collection, getDocs, query, where, orderBy, updateDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

interface ModerationItem {
  id: string;
  type: 'item' | 'review' | 'message';
  resourceId: string;
  targetId: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  content?: any;
  itemData?: any;
  userData?: any;
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
      const moderationData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      })) as ModerationItem[];

      // Fetch additional data for items
      const enrichedData = await Promise.all(
        moderationData.map(async (item) => {
          try {
            if (item.type === 'item') {
              // Fetch item data
              const itemDoc = await getDoc(doc(db, 'items', item.targetId));
              const itemData = itemDoc.data();

              // Fetch owner data
              let userData = null;
              if (itemData?.ownerId) {
                const userDoc = await getDoc(doc(db, 'users', itemData.ownerId));
                userData = userDoc.data();
              }

              return {
                ...item,
                itemData,
                userData,
              };
            }
            return item;
          } catch (error) {
            console.warn('Error fetching additional data for item:', item.id, error);
            return item;
          }
        })
      );

      setItems(enrichedData);
    } catch (err: any) {
      console.error('Error fetching moderation items:', err);
      setError('Failed to load moderation queue.');
    } finally {
      setLoading(false);
    }
  };

  const handleSuspendItem = async (moderationId: string, itemId: string) => {
    try {
      // Suspend the item
      await updateDoc(doc(db, 'items', itemId), {
        status: 'suspended',
        suspendedAt: new Date(),
        suspensionReason: 'Content violation',
      });

      // Mark the report as resolved
      await updateDoc(doc(db, 'moderation_queue', moderationId), {
        status: 'resolved',
        reviewedAt: new Date(),
        resolution: 'Item suspended for content violation',
      });

      setSuccess('Item suspended successfully!');
      fetchModerationItems();
    } catch (err: any) {
      console.error('Error suspending item:', err);
      setError('Failed to suspend item.');
    }
  };

  const handleDismissReport = async (moderationId: string) => {
    try {
      await updateDoc(doc(db, 'moderation_queue', moderationId), {
        status: 'resolved',
        reviewedAt: new Date(),
        resolution: 'Report dismissed - no action taken',
      });
      setSuccess('Report dismissed successfully!');
      fetchModerationItems();
    } catch (err: any) {
      setError('Failed to dismiss report.');
    }
  };

  const handleViewItem = (itemId: string) => {
    // Open item in new tab - assuming the app is running on localhost:3000 or similar
    const itemUrl = `${window.location.origin}/item/${itemId}`;
    window.open(itemUrl, '_blank');
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
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Chip label={item.type} size="small" sx={{ mr: 1 }} />
                    <Typography variant="caption" color="text.secondary">
                      {item.createdAt.toLocaleDateString()}
                    </Typography>
                  </Box>

                  {item.type === 'item' && item.itemData && (
                    <>
                      <Typography variant="h6" sx={{ mb: 1 }}>
                        {item.itemData.title || 'Untitled Item'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {item.itemData.description || 'No description available'}
                      </Typography>

                      {item.userData && (
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                          <Avatar
                            src={item.userData.photoURL}
                            sx={{ width: 24, height: 24, mr: 1 }}
                          >
                            {item.userData.displayName?.[0] || item.userData.email?.[0] || 'U'}
                          </Avatar>
                          <Typography variant="body2">
                            {item.userData.displayName || item.userData.email || 'Unknown User'}
                          </Typography>
                        </Box>
                      )}

                      <Divider sx={{ mb: 2 }} />
                    </>
                  )}

                  <Typography variant="body2" color="error" sx={{ mb: 1 }}>
                    Reason: {item.reason.replace(/_/g, ' ')}
                  </Typography>

                  {item.content?.description && (
                    <Typography variant="body2" sx={{ mb: 1, fontStyle: 'italic' }}>
                      "{item.content.description}"
                    </Typography>
                  )}
                </CardContent>
                <CardActions>
                  {item.type === 'item' && (
                    <Button
                      size="small"
                      startIcon={<Visibility />}
                      onClick={() => handleViewItem(item.targetId)}
                      sx={{ mr: 'auto' }}
                    >
                      View Item
                    </Button>
                  )}
                  <Button
                    size="small"
                    startIcon={<Block />}
                    onClick={() => handleSuspendItem(item.id, item.targetId)}
                    color="error"
                  >
                    Suspend Item
                  </Button>
                  <Button
                    size="small"
                    startIcon={<Cancel />}
                    onClick={() => handleDismissReport(item.id)}
                    color="inherit"
                  >
                    Dismiss
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
