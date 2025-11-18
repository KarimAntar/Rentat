import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { AuthProvider } from './src/contexts/AuthContext';
import { ModalProvider } from './src/contexts/ModalContext';
import AppNavigator from './src/navigation/AppNavigator';
import { notificationService } from './src/services/notifications';

export default function App() {
  useEffect(() => {
    // Initialize notification service on app start
    notificationService.initialize();

    // Cleanup on app unmount
    return () => {
      notificationService.cleanup();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ModalProvider>
          <AppNavigator />
          <StatusBar style="auto" />
          <Toast />
        </ModalProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
