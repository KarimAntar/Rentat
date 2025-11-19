import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { authService } from './auth';
import { db, collections } from '../config/firebase';
import { doc, updateDoc, serverTimestamp, collection, addDoc } from 'firebase/firestore';

// Configure notification handling
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export interface NotificationData {
  type: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}

export class NotificationService {
  private static instance: NotificationService;
  private currentToken: string | null = null;
  private notificationListener: any = null;
  private responseListener: any = null;

  private constructor() {}

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  // Initialize notification service
  public async initialize(): Promise<void> {
    try {
      // Request permissions
      const permission = await this.requestPermissions();
      if (!permission) {
        console.warn('Notification permissions not granted');
        return;
      }

      // Get and register FCM token
      const token = await this.getExpoPushToken();
      if (token) {
        await this.registerToken(token);
      }

      // Set up listeners
      this.setupNotificationListeners();

      // Handle notification that opened the app (not available on web)
      if (Platform.OS !== 'web') {
        const lastNotificationResponse = await Notifications.getLastNotificationResponseAsync();
        if (lastNotificationResponse) {
          this.handleNotificationResponse(lastNotificationResponse);
        }
      }
    } catch (error) {
      console.error('Error initializing notification service:', error);
    }
  }

  // Request notification permissions
  public async requestPermissions(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#4639eb',
        });

        // Create channels for different notification types
        await this.createNotificationChannels();
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      return finalStatus === 'granted';
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  }

  // Create notification channels for Android
  private async createNotificationChannels(): Promise<void> {
    if (Platform.OS !== 'android') return;

    const channels = [
      {
        id: 'rental_requests',
        name: 'Rental Requests',
        importance: Notifications.AndroidImportance.HIGH,
        description: 'Notifications for new rental requests',
      },
      {
        id: 'rental_updates',
        name: 'Rental Updates',
        importance: Notifications.AndroidImportance.HIGH,  
        description: 'Updates on your rentals',
      },
      {
        id: 'messages',
        name: 'Messages',
        importance: Notifications.AndroidImportance.DEFAULT,
        description: 'New chat messages',
      },
      {
        id: 'payments',
        name: 'Payments',
        importance: Notifications.AndroidImportance.HIGH,
        description: 'Payment confirmations and updates',
      },
      {
        id: 'reminders',
        name: 'Reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
        description: 'Rental reminders and deadlines',
      },
      {
        id: 'system',
        name: 'System',
        importance: Notifications.AndroidImportance.LOW,
        description: 'App updates and system notifications',
      },
    ];

    for (const channel of channels) {
      await Notifications.setNotificationChannelAsync(channel.id, {
        name: channel.name,
        importance: channel.importance,
        description: channel.description,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#4639eb',
      });
    }
  }

  // Get Expo push token
  public async getExpoPushToken(): Promise<string | null> {
    try {
      // For web, skip device check and use VAPID key from config
      if (Platform.OS === 'web') {
        const vapidPublicKey = (Constants.expoConfig?.notification as any)?.vapidPublicKey;
        if (!vapidPublicKey) {
          console.warn('VAPID public key not configured for web push notifications');
          return null;
        }

        const token = await Notifications.getExpoPushTokenAsync({
          projectId: Constants.expoConfig?.extra?.eas?.projectId,
        });

        this.currentToken = token.data;
        return token.data;
      }

      // For native platforms, check if it's a physical device
      if (!Constants.isDevice) {
        console.warn('Push notifications only work on physical devices');
        return null;
      }

      const token = await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId,
      });

      this.currentToken = token.data;
      return token.data;
    } catch (error) {
      console.error('Error getting Expo push token:', error);
      return null;
    }
  }

  // Register FCM token with user
  public async registerToken(token: string): Promise<void> {
    try {
      if (this.currentToken === token) return; // Token hasn't changed

      await authService.updateFCMToken(token);
      this.currentToken = token;
    } catch (error) {
      console.error('Error registering FCM token:', error);
    }
  }

  // Unregister FCM token
  public async unregisterToken(): Promise<void> {
    try {
      if (this.currentToken) {
        await authService.removeFCMToken(this.currentToken);
        this.currentToken = null;
      }
    } catch (error) {
      console.error('Error unregistering FCM token:', error);
    }
  }

  // Set up notification listeners
  private setupNotificationListeners(): void {
    // Listen for notifications received while app is foregrounded
    this.notificationListener = Notifications.addNotificationReceivedListener(
      this.handleNotificationReceived.bind(this)
    );

    // Listen for user tapping on notifications
    this.responseListener = Notifications.addNotificationResponseReceivedListener(
      this.handleNotificationResponse.bind(this)
    );
  }

  // Handle notification received while app is open
  private async handleNotificationReceived(notification: Notifications.Notification): Promise<void> {
    try {
      const { request } = notification;
      const { content, identifier } = request;

      // Mark notification as delivered in database
      await this.markNotificationAsDelivered(content.data?.notificationId);

      // Update app badge
      await this.updateBadgeCount();
    } catch (error) {
      console.error('Error handling notification received:', error);
    }
  }

  // Handle user tapping on notification
  private async handleNotificationResponse(response: Notifications.NotificationResponse): Promise<void> {
    try {
      const { notification } = response;
      const { content } = notification.request;
      const data = content.data || {};

      // Mark notification as read
      await this.markNotificationAsRead(data.notificationId);

      // Handle navigation based on notification type
      await this.handleNotificationNavigation(data);

      // Update app badge
      await this.updateBadgeCount();
    } catch (error) {
      console.error('Error handling notification response:', error);
    }
  }

  // Mark notification as delivered
  private async markNotificationAsDelivered(notificationId?: string): Promise<void> {
    if (!notificationId) return;

    try {
      const notificationRef = doc(db, collections.notifications, notificationId);
      await updateDoc(notificationRef, {
        'delivery.push.sent': true,
        'delivery.push.sentAt': serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error marking notification as delivered:', error);
    }
  }

  // Mark notification as read
  private async markNotificationAsRead(notificationId?: string): Promise<void> {
    if (!notificationId) return;

    try {
      const notificationRef = doc(db, collections.notifications, notificationId);
      await updateDoc(notificationRef, {
        status: 'read',
        readAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }

  // Handle navigation from notification
  private async handleNotificationNavigation(data: Record<string, any>): Promise<void> {
    // This would integrate with your navigation system
    // For now, we'll just log the navigation intent
    console.log('Notification navigation:', data);

    // Example navigation logic:
    if (data.deepLink) {
      // Handle deep link navigation
      console.log('Navigate to:', data.deepLink);
    } else if (data.rentalId) {
      // Navigate to rental details
      console.log('Navigate to rental:', data.rentalId);
    } else if (data.chatId) {
      // Navigate to chat
      console.log('Navigate to chat:', data.chatId);
    } else if (data.itemId) {
      // Navigate to item details
      console.log('Navigate to item:', data.itemId);
    }
  }

  // Send local notification
  public async sendLocalNotification(notification: NotificationData): Promise<void> {
    try {
      const channelId = this.getChannelId(notification.type);
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: notification.title,
          body: notification.body,
          data: notification.data || {},
          sound: true,
          priority: this.getPriority(notification.priority || 'normal'),
        },
        trigger: null, // Send immediately
        ...(Platform.OS === 'android' && { channelId }),
      });
    } catch (error) {
      console.error('Error sending local notification:', error);
    }
  }

  // Schedule local notification
  public async scheduleNotification(
    notification: NotificationData,
    trigger: Date | number
  ): Promise<string> {
    try {
      const channelId = this.getChannelId(notification.type);
      
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: notification.title,
          body: notification.body,
          data: notification.data || {},
          sound: true,
          priority: this.getPriority(notification.priority || 'normal'),
        },
        trigger: typeof trigger === 'number' ? { seconds: trigger } : trigger,
        ...(Platform.OS === 'android' && { channelId }),
      });

      return notificationId;
    } catch (error) {
      console.error('Error scheduling notification:', error);
      throw error;
    }
  }

  // Cancel scheduled notification
  public async cancelScheduledNotification(notificationId: string): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch (error) {
      console.error('Error canceling scheduled notification:', error);
    }
  }

  // Cancel all scheduled notifications
  public async cancelAllScheduledNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (error) {
      console.error('Error canceling all scheduled notifications:', error);
    }
  }

  // Update app badge count
  public async updateBadgeCount(): Promise<void> {
    try {
      const user = authService.getCurrentUser();
      if (!user) return;

      // Get unread notification count from Firestore
      // This would require a query to count unread notifications
      // For now, we'll set it to 0
      await Notifications.setBadgeCountAsync(0);
    } catch (error) {
      console.error('Error updating badge count:', error);
    }
  }

  // Clear all notifications
  public async clearAllNotifications(): Promise<void> {
    try {
      await Notifications.dismissAllNotificationsAsync();
      await Notifications.setBadgeCountAsync(0);
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  }

  // Get notification channel ID based on type
  private getChannelId(type: string): string {
    const channelMap: Record<string, string> = {
      rental_request: 'rental_requests',
      rental_approved: 'rental_updates',
      rental_rejected: 'rental_updates', 
      rental_confirmed: 'rental_updates',
      rental_completed: 'rental_updates',
      message: 'messages',
      payment: 'payments',
      reminder: 'reminders',
      system: 'system',
    };

    return channelMap[type] || 'default';
  }

  // Get notification priority
  private getPriority(priority: string): Notifications.AndroidNotificationPriority {
    switch (priority) {
      case 'low':
        return Notifications.AndroidNotificationPriority.LOW;
      case 'normal':
        return Notifications.AndroidNotificationPriority.DEFAULT;
      case 'high':
        return Notifications.AndroidNotificationPriority.HIGH;
      case 'urgent':
        return Notifications.AndroidNotificationPriority.MAX;
      default:
        return Notifications.AndroidNotificationPriority.DEFAULT;
    }
  }

  // Schedule rental reminders
  public async scheduleRentalReminders(
    rentalId: string,
    startDate: Date,
    endDate: Date,
    itemTitle: string
  ): Promise<void> {
    try {
      const now = new Date();
      
      // Reminder 24 hours before start
      const reminder24h = new Date(startDate.getTime() - 24 * 60 * 60 * 1000);
      if (reminder24h > now) {
        await this.scheduleNotification(
          {
            type: 'reminder',
            title: 'Rental Starting Tomorrow',
            body: `Your rental of "${itemTitle}" starts tomorrow`,
            data: { rentalId, type: 'rental_start_reminder' },
          },
          reminder24h
        );
      }

      // Reminder 2 hours before start
      const reminder2h = new Date(startDate.getTime() - 2 * 60 * 60 * 1000);
      if (reminder2h > now) {
        await this.scheduleNotification(
          {
            type: 'reminder',
            title: 'Rental Starting Soon',
            body: `Your rental of "${itemTitle}" starts in 2 hours`,
            data: { rentalId, type: 'rental_start_reminder' },
          },
          reminder2h
        );
      }

      // Reminder 24 hours before end
      const reminderEnd24h = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
      if (reminderEnd24h > now) {
        await this.scheduleNotification(
          {
            type: 'reminder',
            title: 'Rental Ending Tomorrow',
            body: `Your rental of "${itemTitle}" ends tomorrow. Don't forget to return it!`,
            data: { rentalId, type: 'rental_end_reminder' },
          },
          reminderEnd24h
        );
      }

      // Reminder 2 hours before end
      const reminderEnd2h = new Date(endDate.getTime() - 2 * 60 * 60 * 1000);
      if (reminderEnd2h > now) {
        await this.scheduleNotification(
          {
            type: 'reminder',
            title: 'Rental Ending Soon',
            body: `Your rental of "${itemTitle}" ends in 2 hours. Please return it on time!`,
            data: { rentalId, type: 'rental_end_reminder' },
            priority: 'high',
          },
          reminderEnd2h
        );
      }
    } catch (error) {
      console.error('Error scheduling rental reminders:', error);
    }
  }

  // Clean up listeners
  public cleanup(): void {
    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
      this.notificationListener = null;
    }

    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
      this.responseListener = null;
    }
  }

  // Get notification settings
  public async getNotificationSettings(): Promise<Notifications.NotificationPermissionsStatus> {
    return await Notifications.getPermissionsAsync();
  }

  // Open device notification settings
  public async openNotificationSettings(): Promise<void> {
    if (Platform.OS === 'ios') {
      // On iOS, this would open the app's notification settings
      // You might need to use a library like expo-linking for this
      console.log('Open iOS notification settings');
    } else if (Platform.OS === 'android') {
      // On Android, this would open the app's notification settings
      console.log('Open Android notification settings');
    }
  }
}

// Export singleton instance
export const notificationService = NotificationService.getInstance();

// Convenience functions
export const useNotifications = () => {
  return {
    initialize: notificationService.initialize.bind(notificationService),
    requestPermissions: notificationService.requestPermissions.bind(notificationService),
    getExpoPushToken: notificationService.getExpoPushToken.bind(notificationService),
    registerToken: notificationService.registerToken.bind(notificationService),
    unregisterToken: notificationService.unregisterToken.bind(notificationService),
    sendLocalNotification: notificationService.sendLocalNotification.bind(notificationService),
    scheduleNotification: notificationService.scheduleNotification.bind(notificationService),
    cancelScheduledNotification: notificationService.cancelScheduledNotification.bind(notificationService),
    cancelAllScheduledNotifications: notificationService.cancelAllScheduledNotifications.bind(notificationService),
    updateBadgeCount: notificationService.updateBadgeCount.bind(notificationService),
    clearAllNotifications: notificationService.clearAllNotifications.bind(notificationService),
    scheduleRentalReminders: notificationService.scheduleRentalReminders.bind(notificationService),
    cleanup: notificationService.cleanup.bind(notificationService),
    getNotificationSettings: notificationService.getNotificationSettings.bind(notificationService),
    openNotificationSettings: notificationService.openNotificationSettings.bind(notificationService),
  };
};

export default notificationService;
