import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// AsyncStorage fallback for web
let AsyncStorage: any;
try {
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch (e) {
  // Fallback for web environments
  AsyncStorage = {
    getItem: async (key: string) => localStorage.getItem(key),
    setItem: async (key: string, value: string) => localStorage.setItem(key, value),
  };
}

const { width } = Dimensions.get('window');

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const PWAInstallPrompt: React.FC = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    const checkInstalled = async () => {
      const installed = await AsyncStorage.getItem('pwa-installed');
      if (installed === 'true') {
        setIsInstalled(true);
        return;
      }

      // Check if running as PWA
      if (window.matchMedia('(display-mode: standalone)').matches) {
        setIsInstalled(true);
        await AsyncStorage.setItem('pwa-installed', 'true');
        return;
      }

      // Only show on Chrome for Android
      const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
      const isAndroid = /Android/.test(navigator.userAgent);
      const isMobile = /Mobi|Android/i.test(navigator.userAgent);

      if (!isChrome || !isAndroid || !isMobile) {
        return;
      }

      // Listen for the beforeinstallprompt event
      const handleBeforeInstallPrompt = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);

        // Check if user has dismissed before
        AsyncStorage.getItem('pwa-prompt-dismissed').then((dismissed: string | null) => {
          if (dismissed !== 'true') {
            // Show prompt after a short delay
            setTimeout(() => {
              setShowPrompt(true);
            }, 3000);
          }
        });
      };

      // Listen for successful installation
      const handleAppInstalled = () => {
        setIsInstalled(true);
        setShowPrompt(false);
        AsyncStorage.setItem('pwa-installed', 'true');
      };

      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.addEventListener('appinstalled', handleAppInstalled);

      return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.removeEventListener('appinstalled', handleAppInstalled);
      };
    };

    checkInstalled();
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        setIsInstalled(true);
        await AsyncStorage.setItem('pwa-installed', 'true');
      }

      setDeferredPrompt(null);
      setShowPrompt(false);
    } catch (error) {
      console.error('PWA install failed:', error);
    }
  };

  const handleDismiss = async () => {
    setShowPrompt(false);
    await AsyncStorage.setItem('pwa-prompt-dismissed', 'true');
  };

  // Don't show if already installed or not on supported platform
  if (isInstalled || !showPrompt) {
    return null;
  }

  return (
    <Modal
      visible={showPrompt}
      transparent={true}
      animationType="fade"
      onRequestClose={handleDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons name="download" size={24} color="#4639eb" />
            </View>
            <TouchableOpacity onPress={handleDismiss} style={styles.closeButton}>
              <Ionicons name="close" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={styles.content}>
            <Text style={styles.title}>Install Rentat</Text>
            <Text style={styles.description}>
              Get the full app experience with offline access, faster loading, and home screen shortcut.
            </Text>

            {/* Features */}
            <View style={styles.features}>
              <View style={styles.feature}>
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                <Text style={styles.featureText}>Works offline</Text>
              </View>
              <View style={styles.feature}>
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                <Text style={styles.featureText}>Faster loading</Text>
              </View>
              <View style={styles.feature}>
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                <Text style={styles.featureText}>Home screen shortcut</Text>
              </View>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity onPress={handleDismiss} style={styles.skipButton}>
              <Text style={styles.skipText}>Not now</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleInstall} style={styles.installButton}>
              <Ionicons name="download" size={16} color="#FFFFFF" />
              <Text style={styles.installText}>Install App</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: width - 40,
    maxWidth: 400,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 0,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 20,
    paddingTop: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: '#6B7280',
    lineHeight: 24,
    marginBottom: 20,
  },
  features: {
    marginBottom: 20,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
  },
  actions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  skipButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#F3F4F6',
  },
  skipText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  installButton: {
    flex: 2,
    flexDirection: 'row',
    backgroundColor: '#4639eb',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomRightRadius: 16,
    borderBottomLeftRadius: 0,
  },
  installText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default PWAInstallPrompt;
