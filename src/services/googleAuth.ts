import { 
  signInWithPopup, 
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  UserCredential
} from 'firebase/auth';
import { auth } from '../config/firebase';
import { authService } from './auth';
import { User } from '../types';

export class GoogleAuthService {
  private provider: GoogleAuthProvider;

  constructor() {
    this.provider = new GoogleAuthProvider();
    this.provider.addScope('profile');
    this.provider.addScope('email');
  }

  /**
   * Sign in with Google using popup (for web)
   */
  async signInWithGoogle(): Promise<User> {
    try {
      const result = await signInWithPopup(auth, this.provider);
      return await this.handleGoogleSignIn(result);
    } catch (error: any) {
      if (error.code === 'auth/popup-blocked') {
        // Fall back to redirect if popup is blocked
        return await this.signInWithGoogleRedirect();
      }
      throw error;
    }
  }

  /**
   * Sign in with Google using redirect (fallback for blocked popups)
   */
  async signInWithGoogleRedirect(): Promise<User> {
    try {
      await signInWithRedirect(auth, this.provider);
      // The result will be handled by handleRedirectResult
      throw new Error('REDIRECT_IN_PROGRESS');
    } catch (error) {
      throw error;
    }
  }

  /**
   * Handle redirect result after Google sign in
   */
  async handleRedirectResult(): Promise<User | null> {
    try {
      const result = await getRedirectResult(auth);
      if (result) {
        return await this.handleGoogleSignIn(result);
      }
      return null;
    } catch (error) {
      console.error('Error handling redirect result:', error);
      throw error;
    }
  }

  /**
   * Process Google sign in result
   */
  private async handleGoogleSignIn(result: UserCredential): Promise<User> {
    const firebaseUser = result.user;
    
    // Check if user already exists in Firestore
    let userData = await authService.getUserData(firebaseUser.uid);

    if (userData) {
      // User exists, update their profile picture if it changed
      if (firebaseUser.photoURL && userData.photoURL !== firebaseUser.photoURL) {
        await authService.updateUserProfile({
          photoURL: firebaseUser.photoURL,
        });
        userData.photoURL = firebaseUser.photoURL;
      }
      return userData;
    }

    // New user - create account
    const newUser: User = {
      uid: firebaseUser.uid,
      email: firebaseUser.email!,
      displayName: firebaseUser.displayName || firebaseUser.email!.split('@')[0],
      photoURL: firebaseUser.photoURL || undefined,
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

    // Create user document in Firestore
    await authService['createUserDocument'](newUser);
    
    return newUser;
  }
}

export const googleAuthService = new GoogleAuthService();
