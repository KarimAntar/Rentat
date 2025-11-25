import { showAlert } from '../../contexts/ModalContext';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Button from '../../components/ui/Button';
import { useAuthContext } from '../../contexts/AuthContext';
import { UserService } from '../../services/firestore';
import { NotificationPreferences } from '../../types';

const NotificationPreferencesScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuthContext();

  const [preferences, setPreferences] = useState<NotificationPreferences>({
    email: {
      rentalRequests: true,
      rentalApprovals: true,
      rentalRejections: true,
      messages: true,
      reviews: true,
      payments: true,
      reminders: true,
      marketing: false,
    },
    push: {
      rentalRequests: true,
      rentalApprovals: true,
      rentalRejections: true,
      messages: true,
      reviews: true,
      payments: true,
      reminders: true,
    },
    sms: {
      rentalRequests: false,
      rentalApprovals: true,
      rentalRejections: true,
      payments: true,
    },
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const userData = await UserService.getUser(user.uid);
      if (userData?.preferences?.notifications) {
        // Handle migration from old simple structure to new detailed structure
        const existingPrefs = userData.preferences.notifications;
        if (typeof existingPrefs.email === 'boolean') {
          // Old structure - convert to new structure
          const oldPrefs = existingPrefs as any;
          setPreferences({
            email: {
              rentalRequests: oldPrefs.email || false,
              rentalApprovals: oldPrefs.email || false,
              rentalRejections: oldPrefs.email || false,
              messages: oldPrefs.email || false,
              reviews: oldPrefs.email || false,
              payments: oldPrefs.email || false,
              reminders: oldPrefs.email || false,
              marketing: false,
            },
            push: {
              rentalRequests: oldPrefs.push || false,
              rentalApprovals: oldPrefs.push || false,
              rentalRejections: oldPrefs.push || false,
              messages: oldPrefs.push || false,
              reviews: oldPrefs.push || false,
              payments: oldPrefs.push || false,
              reminders: oldPrefs.push || false,
            },
            sms: {
              rentalRequests: false,
              rentalApprovals: oldPrefs.sms || false,
              rentalRejections: oldPrefs.sms || false,
              payments: oldPrefs.sms || false,
            },
          });
        } else {
          // New structure
          setPreferences(existingPrefs as NotificationPreferences);
        }
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    if (!user) return;

    try {
      setSaving(true);
      const userData = await UserService.getUser(user.uid);
      const currentPrefs = userData?.preferences || {
        searchRadius: 50,
        currency: 'USD',
      };

      await UserService.updateUser(user.uid, {
        preferences: {
          ...currentPrefs,
          notifications: preferences,
        },
      });

      showAlert(
        'Preferences Saved',
        'Your notification preferences have been updated successfully.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error saving preferences:', error);
      showAlert('Error', 'Failed to save preferences. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const updatePreference = (
    channel: keyof NotificationPreferences,
    setting: string,
    value: boolean
  ) => {
    setPreferences((prev: NotificationPreferences) => ({
      ...prev,
      [channel]: {
        ...prev[channel],
        [setting]: value,
      },
    }));
  };

  const toggleAllForChannel = (channel: keyof NotificationPreferences, enabled: boolean) => {
    const channelPrefs = preferences[channel];
    const updatedChannelPrefs = Object.keys(channelPrefs).reduce((acc, key) => {
      acc[key] = enabled;
      return acc;
    }, {} as any);

    setPreferences((prev: NotificationPreferences) => ({
      ...prev,
      [channel]: updatedChannelPrefs,
    }));
  };

  const renderChannelSection = (
    channel: keyof NotificationPreferences,
    title: string,
    icon: string,
    description: string
  ) => {
    const channelPrefs = preferences[channel];
    const allEnabled = Object.values(channelPrefs).every(Boolean);
    const someEnabled = Object.values(channelPrefs).some(Boolean);

    return (
      <View style={styles.channelSection}>
        <View style={styles.channelHeader}>
          <View style={styles.channelTitleRow}>
            <Ionicons name={icon as any} size={24} color="#4639eb" />
            <Text style={styles.channelTitle}>{title}</Text>
          </View>
          <TouchableOpacity
            style={styles.toggleAllButton}
            onPress={() => toggleAllForChannel(channel, !allEnabled)}
          >
            <Text style={styles.toggleAllText}>
              {allEnabled ? 'Disable All' : 'Enable All'}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.channelDescription}>{description}</Text>

        <View style={styles.settingsList}>
          {Object.entries(channelPrefs).map(([setting, enabled]) => (
            <View key={setting} style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>
                  {getSettingDisplayName(setting)}
                </Text>
                <Text style={styles.settingDescription}>
                  {getSettingDescription(setting)}
                </Text>
              </View>
              <Switch
                value={!!enabled}
                onValueChange={(value) => updatePreference(channel, setting, value)}
                trackColor={{ false: '#D1D5DB', true: '#C7D2FE' }}
                thumbColor={enabled ? '#4639eb' : '#F9FAFB'}
              />
            </View>
          ))}
        </View>
      </View>
    );
  };

  const getSettingDisplayName = (setting: string): string => {
    const names: Record<string, string> = {
      rentalRequests: 'Rental Requests',
      rentalApprovals: 'Rental Approvals',
      rentalRejections: 'Rental Rejections',
      messages: 'Messages',
      reviews: 'Reviews',
      payments: 'Payments',
      reminders: 'Reminders',
      marketing: 'Marketing & Promotions',
    };
    return names[setting] || setting;
  };

  const getSettingDescription = (setting: string): string => {
    const descriptions: Record<string, string> = {
      rentalRequests: 'When someone requests to rent your item',
      rentalApprovals: 'When you approve a rental request',
      rentalRejections: 'When you reject a rental request',
      messages: 'New messages from renters or owners',
      reviews: 'When you receive a review',
      payments: 'Payment confirmations and updates',
      reminders: 'Rental start/end reminders',
      marketing: 'Promotions, tips, and platform updates',
    };
    return descriptions[setting] || '';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.loadingText}>Loading preferences...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notification Preferences</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color="#4639eb" />
          <Text style={styles.infoText}>
            Choose how you want to be notified about rental activity, messages, and platform updates.
            You can customize notifications for each communication channel.
          </Text>
        </View>

        {/* Push Notifications */}
        {renderChannelSection(
          'push',
          'Push Notifications',
          'notifications',
          'Receive notifications on your device'
        )}

        {/* Email Notifications */}
        {renderChannelSection(
          'email',
          'Email Notifications',
          'mail',
          'Receive notifications via email'
        )}

        {/* SMS Notifications */}
        {renderChannelSection(
          'sms',
          'SMS Notifications',
          'chatbubble',
          'Receive important notifications via text message'
        )}

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>

          <TouchableOpacity style={styles.actionRow}>
            <Ionicons name="time-outline" size={24} color="#4639eb" />
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Quiet Hours</Text>
              <Text style={styles.actionDescription}>
                Set times when you don't want to receive notifications
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#6B7280" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionRow}>
            <Ionicons name="volume-high-outline" size={24} color="#4639eb" />
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Sound & Vibration</Text>
              <Text style={styles.actionDescription}>
                Customize notification sounds and vibration patterns
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* Privacy Notice */}
        <View style={styles.privacyNotice}>
          <Ionicons name="shield-checkmark" size={20} color="#10B981" />
          <Text style={styles.privacyText}>
            Your notification preferences are private and secure. We never share your contact information with third parties.
          </Text>
        </View>
      </ScrollView>

      {/* Save Button */}
      <View style={styles.footer}>
        <Button
          title="Save Preferences"
          onPress={savePreferences}
          loading={saving}
          disabled={saving}
          style={styles.saveButton}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#3730A3',
    lineHeight: 20,
  },
  channelSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  channelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  channelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  channelTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  toggleAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
  },
  toggleAllText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4639eb',
  },
  channelDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  settingsList: {
    gap: 16,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 16,
  },
  quickActions: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    margin: 20,
    marginBottom: 16,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  actionContent: {
    flex: 1,
    marginLeft: 12,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  actionDescription: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 16,
  },
  privacyNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    gap: 12,
  },
  privacyText: {
    flex: 1,
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  footer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  saveButton: {
    marginBottom: 0,
  },
});

export default NotificationPreferencesScreen;


