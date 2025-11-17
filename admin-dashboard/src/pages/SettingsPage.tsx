import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  Divider,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
} from '@mui/material';
import { Save } from '@mui/icons-material';
import { doc, getDoc, setDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

interface PlatformSettings {
  platformName: string;
  supportEmail: string;
  commissionRate: number;
  maintenanceMode: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
  updatedAt?: Date;
  updatedBy?: string;
}

export const SettingsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<PlatformSettings>({
    platformName: 'Rentat',
    supportEmail: 'support@rentat.com',
    commissionRate: 15,
    maintenanceMode: false,
    emailNotifications: true,
    pushNotifications: true,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      console.log('Loading settings...');

      const settingsRef = doc(db, 'platform_settings', 'global');
      console.log('Settings ref:', settingsRef.path);

      const settingsDoc = await getDoc(settingsRef);
      console.log('Settings doc exists:', settingsDoc.exists());

      if (settingsDoc.exists()) {
        const data = settingsDoc.data();
        console.log('Settings data:', data);
        setSettings({
          platformName: data.platformName || 'Rentat',
          supportEmail: data.supportEmail || 'support@rentat.com',
          commissionRate: data.commissionRate || 15,
          maintenanceMode: data.maintenanceMode || false,
          emailNotifications: data.emailNotifications !== false,
          pushNotifications: data.pushNotifications !== false,
        });
      } else {
        console.log('Settings document does not exist, using defaults');
      }
    } catch (err: any) {
      console.error('Error loading settings:', err);
      console.error('Error code:', err.code);
      console.error('Error message:', err.message);

      // If it's a permission error, try to load from localStorage as fallback
      if (err.code === 'permission-denied') {
        console.log('Permission denied, trying localStorage fallback');
        const localSettings = localStorage.getItem('admin_settings');
        if (localSettings) {
          try {
            const parsed = JSON.parse(localSettings);
            setSettings(prev => ({ ...prev, ...parsed }));
            setError('Loaded settings from local storage. Some features may be limited.');
          } catch (parseErr) {
            console.error('Error parsing local settings:', parseErr);
            setError('Failed to load settings. Using defaults.');
          }
        } else {
          setError('Permission denied. Please ensure you are logged in as an admin.');
        }
      } else {
        setError('Failed to load settings. Using defaults.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      // Validate commission rate
      const commissionRate = parseFloat(settings.commissionRate.toString());
      if (isNaN(commissionRate) || commissionRate < 0 || commissionRate > 100) {
        setError('Commission rate must be a number between 0 and 100.');
        return;
      }

      // Save to Firestore
      const settingsRef = doc(db, 'platform_settings', 'global');
      await setDoc(settingsRef, {
        ...settings,
        commissionRate,
        updatedAt: new Date(),
        updatedBy: 'admin', // In production, use actual admin UID
      });

      // Also update commission service config if commission rate changed
      if (commissionRate !== 15) { // Only update if different from default
        try {
          // Update commission service configuration
          const commissionConfigRef = collection(db, 'platform_config');
          const configQuery = query(commissionConfigRef, orderBy('updatedAt', 'desc'), limit(1));
          const configSnapshot = await getDocs(configQuery);

          if (!configSnapshot.empty) {
            const latestConfig = configSnapshot.docs[0];
            const currentConfig = latestConfig.data().config;

            // Update base rate
            const updatedConfig = {
              ...currentConfig,
              baseRate: commissionRate / 100, // Convert percentage to decimal
            };

            await setDoc(doc(db, 'platform_config', latestConfig.id), {
              config: updatedConfig,
              updatedAt: new Date(),
            });
          }
        } catch (commissionError) {
          console.error('Error updating commission config:', commissionError);
          // Don't fail the whole save operation for this
        }
      }

      setSuccess('Settings saved successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error saving settings:', err);
      setError('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        System Settings
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Configure platform settings and preferences
      </Typography>

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

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              General Settings
            </Typography>
            <Divider sx={{ mb: 3 }} />
            
            <TextField
              label="Platform Name"
              fullWidth
              value={settings.platformName}
              onChange={(e) => setSettings({ ...settings, platformName: e.target.value })}
              sx={{ mb: 2 }}
            />
            
            <TextField
              label="Support Email"
              fullWidth
              type="email"
              value={settings.supportEmail}
              onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
              sx={{ mb: 2 }}
            />
            
            <TextField
              label="Commission Rate (%)"
              fullWidth
              type="number"
              value={settings.commissionRate}
              onChange={(e) => setSettings({ ...settings, commissionRate: parseFloat(e.target.value) || 0 })}
              sx={{ mb: 2 }}
            />
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              System Controls
            </Typography>
            <Divider sx={{ mb: 3 }} />
            
            <FormControlLabel
              control={
                <Switch
                  checked={settings.maintenanceMode}
                  onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.checked })}
                />
              }
              label="Maintenance Mode"
              sx={{ mb: 2, display: 'block' }}
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={settings.emailNotifications}
                  onChange={(e) => setSettings({ ...settings, emailNotifications: e.target.checked })}
                />
              }
              label="Email Notifications"
              sx={{ mb: 2, display: 'block' }}
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={settings.pushNotifications}
                  onChange={(e) => setSettings({ ...settings, pushNotifications: e.target.checked })}
                />
              }
              label="Push Notifications"
              sx={{ mb: 2, display: 'block' }}
            />
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              size="large"
              startIcon={<Save />}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? <CircularProgress size={20} /> : 'Save Settings'}
            </Button>
          </Box>
        </Grid>
      </Grid>
      )}
    </Box>
  );
};
