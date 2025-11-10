import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  sendEmailVerification,
  sendPasswordResetEmail,
  User as FirebaseUser,
  onAuthStateChanged,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { auth, db, collections, handleFirebaseError } from '../config/firebase';
import { User, UserVerification, UserPreferences } from '../types';

export class AuthService {
  private static instance: AuthService;
  private authStateListeners: ((user: User | null) => void)[] = [];
  private currentUser: User | null = null;

  private constructor() {
    // Set up auth state listener
    onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userData = await this.getUserData(firebaseUser.uid);
          this.currentUser = userData;
          this.notifyAuthStateListeners(userData);
        } catch (error) {
          console.error('Error fetching user data:', error);
          this.currentUser = null;
          this.notifyAuthStateListeners(null);
        }
      } else {
        this.currentUser = null;
        this.notifyAuthStateListeners(null);
      }
    });
  }

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  // Auth state management
  public onAuthStateChanged(callback: (user: User | null) => void): () => void {
    this.authStateListeners.push(callback);
    // Immediately call with current user
    callback(this.currentUser);
    
    // Return unsubscribe function
    return () => {
      const index = this.authStateListeners.indexOf(callback);
      if (index > -1) {
        this.authStateListeners.splice(index, 1);
      }
    };
  }

  private notifyAuthStateListeners(user: User | null): void {
    this.authStateListeners.forEach(callback => callback(user));
  }

  public getCurrentUser(): User | null {
    return this.currentUser;
  }

  public getFirebaseUser(): FirebaseUser | null {
    return auth.currentUser;
  }

  // Authentication methods
  public async signIn(email: string, password: string): Promise<User> {
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      let userData = await this.getUserData(credential.user.uid);
      
      // If user document doesn't exist, create it (for legacy users)
      if (!userData) {
        console.log('User document not found, creating one for legacy user');
        const newUser: User = {
          uid: credential.user.uid,
          email: credential.user.email!,
          displayName: credential.user.displayName || credential.user.email!.split('@')[0],
          location: {
            latitude: 0,
            longitude: 0,
            address: '',
            city: '',
            country: '',
          },
          verification: {
            isVerified: false,
            verificationStatus: 'pending',
          },
          ratings: {
            asOwner: { average: 0, count: 0 },
            asRenter: { average: 0, count: 0 },
          },
          wallet: {
            balance: 0,
            pendingBalance: 0,
            totalEarnings: 0,
          },
          preferences: {
            notifications: {
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
            },
            searchRadius: 50,
            currency: 'USD',
          },
          stats: {
            itemsListed: 0,
            itemsRented: 0,
            successfulRentals: 0,
          },
          favorites: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          isActive: true,
          fcmTokens: [],
        };
        
        await this.createUserDocument(newUser);
        userData = newUser;
      }

      return userData;
    } catch (error) {
      throw handleFirebaseError(error);
    }
  }

  public async signUp(
    email: string,
    password: string,
    userData: {
      displayName: string;
      phone?: string;
      location: {
        latitude: number;
        longitude: number;
        address: string;
        city: string;
        country: string;
      };
    }
  ): Promise<User> {
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = credential.user;

      // Update Firebase Auth profile
      await updateProfile(firebaseUser, {
        displayName: userData.displayName,
      });

      // Send email verification
      await sendEmailVerification(firebaseUser);

      // Create user document in Firestore - exclude undefined fields
      const newUser: User = {
        uid: firebaseUser.uid,
        email: firebaseUser.email!,
        displayName: userData.displayName,
        location: userData.location ? userData.location : {
          latitude: 0,
          longitude: 0,
          address: '',
          city: '',
          country: '',
        },
        verification: {
          isVerified: false,
          verificationStatus: 'pending',
        },
        ratings: {
          asOwner: { average: 0, count: 0 },
          asRenter: { average: 0, count: 0 },
        },
        wallet: {
          balance: 0,
          pendingBalance: 0,
          totalEarnings: 0,
        },
        preferences: {
          notifications: {
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
          },
          searchRadius: 50, // 50km default
          currency: 'USD',
        },
        stats: {
          itemsListed: 0,
          itemsRented: 0,
          successfulRentals: 0,
        },
        favorites: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
        fcmTokens: [],
        // Only include phone if it's provided
        ...(userData.phone && { phone: userData.phone }),
      };

      await this.createUserDocument(newUser);
      return newUser;
    } catch (error) {
      throw handleFirebaseError(error);
    }
  }

  public async signOut(): Promise<void> {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      throw handleFirebaseError(error);
    }
  }

  public async sendPasswordResetEmail(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      throw handleFirebaseError(error);
    }
  }

  public async updatePassword(currentPassword: string, newPassword: string): Promise<void> {
    try {
      const user = auth.currentUser;
      if (!user || !user.email) {
        throw new Error('No authenticated user found');
      }

      // Re-authenticate user
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Update password
      await updatePassword(user, newPassword);
    } catch (error) {
      throw handleFirebaseError(error);
    }
  }

  public async sendEmailVerification(): Promise<void> {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('No authenticated user found');
      }

      await sendEmailVerification(user);
    } catch (error) {
      throw handleFirebaseError(error);
    }
  }

  // User data management
  private async createUserDocument(userData: User): Promise<void> {
    try {
      const userRef = doc(db, collections.users, userData.uid);
      await setDoc(userRef, {
        ...userData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      throw handleFirebaseError(error);
    }
  }

  public async getUserData(uid: string): Promise<User | null> {
    try {
      const userRef = doc(db, collections.users, uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const data = userSnap.data();
        return {
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as User;
      }

      return null;
    } catch (error) {
      throw handleFirebaseError(error);
    }
  }

  public async updateUserProfile(updates: Partial<User>): Promise<void> {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('No authenticated user found');
      }

      // Update Firebase Auth profile if needed
      if (updates.displayName || updates.photoURL) {
        await updateProfile(user, {
          displayName: updates.displayName || user.displayName,
          photoURL: updates.photoURL || user.photoURL,
        });
      }

      // Update Firestore document
      const userRef = doc(db, collections.users, user.uid);
      await updateDoc(userRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });

      // Update local user data
      if (this.currentUser) {
        this.currentUser = {
          ...this.currentUser,
          ...updates,
          updatedAt: new Date(),
        };
        this.notifyAuthStateListeners(this.currentUser);
      }
    } catch (error) {
      throw handleFirebaseError(error);
    }
  }

  public async updateUserPreferences(preferences: Partial<UserPreferences>): Promise<void> {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('No authenticated user found');
      }

      const userRef = doc(db, collections.users, user.uid);
      await updateDoc(userRef, {
        preferences: {
          ...this.currentUser?.preferences,
          ...preferences,
        },
        updatedAt: serverTimestamp(),
      });

      // Update local user data
      if (this.currentUser) {
        this.currentUser.preferences = {
          ...this.currentUser.preferences,
          ...preferences,
        };
        this.currentUser.updatedAt = new Date();
        this.notifyAuthStateListeners(this.currentUser);
      }
    } catch (error) {
      throw handleFirebaseError(error);
    }
  }

  // Verification methods
  public async submitVerificationDocuments(
    idDocument: string,
    selfiePhoto: string
  ): Promise<void> {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('No authenticated user found');
      }

      const currentVerification = this.currentUser?.verification || {
        isVerified: false,
        verificationStatus: 'pending' as const,
      };

      const verification: UserVerification = {
        ...currentVerification,
        idDocument,
        selfiePhoto,
        verificationStatus: 'pending',
      };

      await this.updateUserProfile({ verification });
    } catch (error) {
      throw handleFirebaseError(error);
    }
  }

  // FCM token management
  public async updateFCMToken(token: string): Promise<void> {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('No authenticated user found');
      }

      const userRef = doc(db, collections.users, user.uid);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const fcmTokens = userData.fcmTokens || [];
        
        // Add token if not already present
        if (!fcmTokens.includes(token)) {
          fcmTokens.push(token);
          await updateDoc(userRef, {
            fcmTokens,
            updatedAt: serverTimestamp(),
          });
        }
      }
    } catch (error) {
      throw handleFirebaseError(error);
    }
  }

  public async removeFCMToken(token: string): Promise<void> {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('No authenticated user found');
      }

      const userRef = doc(db, collections.users, user.uid);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const fcmTokens = (userData.fcmTokens || []).filter((t: string) => t !== token);
        
        await updateDoc(userRef, {
          fcmTokens,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      throw handleFirebaseError(error);
    }
  }

  // User search and validation
  public async checkEmailExists(email: string): Promise<boolean> {
    try {
      const usersRef = collection(db, collections.users);
      const q = query(usersRef, where('email', '==', email));
      const querySnapshot = await getDocs(q);
      
      return !querySnapshot.empty;
    } catch (error) {
      throw handleFirebaseError(error);
    }
  }

  public async checkPhoneExists(phone: string): Promise<boolean> {
    try {
      const usersRef = collection(db, collections.users);
      const q = query(usersRef, where('phone', '==', phone));
      const querySnapshot = await getDocs(q);
      
      return !querySnapshot.empty;
    } catch (error) {
      throw handleFirebaseError(error);
    }
  }

  // Account management
  public async deleteAccount(): Promise<void> {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('No authenticated user found');
      }

      // Mark user as inactive instead of deleting immediately
      // This allows for data retention and cleanup processes
      await this.updateUserProfile({ isActive: false });

      // Note: Actual user deletion should be handled by a Cloud Function
      // that can properly clean up all related data (items, rentals, etc.)
      
      // Sign out the user
      await firebaseSignOut(auth);
    } catch (error) {
      throw handleFirebaseError(error);
    }
  }

  // Utility methods
  public isEmailVerified(): boolean {
    const user = auth.currentUser;
    return user?.emailVerified || false;
  }

  public isUserVerified(): boolean {
    return this.currentUser?.verification?.isVerified || false;
  }

  public canPerformVerifiedActions(): boolean {
    return this.isEmailVerified() && this.isUserVerified();
  }
}

// Export singleton instance
export const authService = AuthService.getInstance();

// Convenience functions
export const useAuth = () => {
  return {
    signIn: authService.signIn.bind(authService),
    signUp: authService.signUp.bind(authService),
    signOut: authService.signOut.bind(authService),
    getCurrentUser: authService.getCurrentUser.bind(authService),
    updateProfile: authService.updateUserProfile.bind(authService),
    updatePreferences: authService.updateUserPreferences.bind(authService),
    onAuthStateChanged: authService.onAuthStateChanged.bind(authService),
    sendPasswordResetEmail: authService.sendPasswordResetEmail.bind(authService),
    updatePassword: authService.updatePassword.bind(authService),
    sendEmailVerification: authService.sendEmailVerification.bind(authService),
    submitVerificationDocuments: authService.submitVerificationDocuments.bind(authService),
    updateFCMToken: authService.updateFCMToken.bind(authService),
    removeFCMToken: authService.removeFCMToken.bind(authService),
    checkEmailExists: authService.checkEmailExists.bind(authService),
    checkPhoneExists: authService.checkPhoneExists.bind(authService),
    deleteAccount: authService.deleteAccount.bind(authService),
    isEmailVerified: authService.isEmailVerified.bind(authService),
    isUserVerified: authService.isUserVerified.bind(authService),
    canPerformVerifiedActions: authService.canPerformVerifiedActions.bind(authService),
  };
};
