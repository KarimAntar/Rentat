import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, collections } from '../config/firebase';
import { AdminUser, AdminRole } from '../types';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  adminUser: AdminUser | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  hasPermission: (resource: string, action: string) => boolean;
  isRole: (role: AdminRole) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch admin user data from Firestore
  const fetchAdminUser = async (user: FirebaseUser): Promise<AdminUser | null> => {
    try {
      const adminDocRef = doc(db, collections.admins, user.uid);
      const adminDoc = await getDoc(adminDocRef);

      if (!adminDoc.exists()) {
        throw new Error('User is not an admin');
      }

      const data = adminDoc.data();
      return {
        uid: user.uid,
        email: user.email!,
        displayName: data.displayName || user.displayName || 'Admin',
        role: data.role as AdminRole,
        permissions: data.permissions,
        createdAt: data.createdAt?.toDate() || new Date(),
        lastLogin: new Date(),
        isActive: data.isActive ?? true,
      };
    } catch (err) {
      console.error('Error fetching admin user:', err);
      throw new Error('Failed to fetch admin user data');
    }
  };

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      setError(null);

      if (user) {
        try {
          const admin = await fetchAdminUser(user);
          setCurrentUser(user);
          setAdminUser(admin);
        } catch (err: any) {
          console.error('Auth error:', err);
          setError(err.message || 'Authentication failed');
          setCurrentUser(null);
          setAdminUser(null);
          await firebaseSignOut(auth);
        }
      } else {
        setCurrentUser(null);
        setAdminUser(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Sign in with email and password
  const signIn = async (email: string, password: string) => {
    try {
      setError(null);
      setLoading(true);
      
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const admin = await fetchAdminUser(userCredential.user);
      
      if (!admin) {
        await firebaseSignOut(auth);
        throw new Error('Failed to load admin user data');
      }
      
      if (!admin.isActive) {
        await firebaseSignOut(auth);
        throw new Error('Your admin account has been deactivated');
      }

      // Update last login time
      // TODO: Add Firestore update to record last login
      
      setCurrentUser(userCredential.user);
      setAdminUser(admin);
    } catch (err: any) {
      console.error('Sign in error:', err);
      const errorMessage = err.message || 'Failed to sign in';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setCurrentUser(null);
      setAdminUser(null);
      setError(null);
    } catch (err: any) {
      console.error('Sign out error:', err);
      throw new Error('Failed to sign out');
    }
  };

  // Check if admin has specific permission
  const hasPermission = (resource: string, action: string): boolean => {
    if (!adminUser) return false;

    // Super admin has all permissions
    if (adminUser.role === 'super_admin') return true;

    const permissions = adminUser.permissions as any;
    if (!permissions || !permissions[resource]) return false;

    return permissions[resource][action] === true;
  };

  // Check if admin has specific role
  const isRole = (role: AdminRole): boolean => {
    if (!adminUser) return false;
    return adminUser.role === role;
  };

  const value: AuthContextType = {
    currentUser,
    adminUser,
    loading,
    error,
    signIn,
    signOut,
    hasPermission,
    isRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Protected Route Component
interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: AdminRole;
  requiredPermission?: { resource: string; action: string };
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
  requiredPermission,
}) => {
  const { adminUser, loading, hasPermission, isRole } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        Loading...
      </div>
    );
  }

  if (!adminUser) {
    window.location.href = '/login';
    return null;
  }

  if (requiredRole && !isRole(requiredRole)) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>Access Denied</h2>
        <p>You don't have the required role to access this page.</p>
      </div>
    );
  }

  if (requiredPermission && !hasPermission(requiredPermission.resource, requiredPermission.action)) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>Access Denied</h2>
        <p>You don't have permission to access this page.</p>
      </div>
    );
  }

  return <>{children}</>;
};
