import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { AuthProvider } from './src/contexts/AuthContext';
import { ModalProvider } from './src/contexts/ModalContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
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
