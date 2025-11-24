import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline, Box, CircularProgress } from '@mui/material';
import theme from './theme';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { UsersPage } from './pages/UsersPage';
import { ItemsPage } from './pages/ItemsPage';
import { RentalsPage } from './pages/RentalsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import NotificationsPage from './pages/NotificationsPage';
import { FeatureFlagsPage } from './pages/FeatureFlagsPage';
import { DisputesPage } from './pages/DisputesPage';
import { ModerationPage } from './pages/ModerationPage';
import { SettingsPage } from './pages/SettingsPage';
import { PayoutsPage } from './pages/PayoutsPage';
import { WalletAnalyticsPage } from './pages/WalletAnalyticsPage';
import { HandoverMonitoringPage } from './pages/HandoverMonitoringPage';

// Protected Route wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, adminUser, loading } = useAuth();

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!currentUser || !adminUser) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Public Route wrapper (redirects to dashboard if already logged in)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, adminUser, loading } = useAuth();

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (currentUser && adminUser) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

function AppContent() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />

      {/* Protected Routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <DashboardPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      {/* User Management */}
      <Route
        path="/users"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <UsersPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      {/* Items Management */}
      <Route
        path="/items"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <ItemsPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      {/* Rentals Management */}
      <Route
        path="/rentals"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <RentalsPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      {/* Analytics */}
      <Route
        path="/analytics"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <AnalyticsPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      {/* Notifications */}
      <Route
        path="/notifications"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <NotificationsPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      {/* Feature Flags */}
      <Route
        path="/feature-flags"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <FeatureFlagsPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      {/* Disputes */}
      <Route
        path="/disputes"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <DisputesPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      {/* Payouts */}
      <Route
        path="/payouts"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <PayoutsPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      {/* Wallet Analytics */}
      <Route
        path="/wallet-analytics"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <WalletAnalyticsPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      {/* Handover Monitoring */}
      <Route
        path="/handover-monitoring"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <HandoverMonitoringPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      {/* Moderation */}
      <Route
        path="/moderation"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <ModerationPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      {/* Settings */}
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <SettingsPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
