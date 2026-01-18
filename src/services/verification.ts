import { 
  doc, 
  updateDoc, 
  getDoc,
  addDoc,
  collection,
  serverTimestamp,
  runTransaction
} from 'firebase/firestore';
import { put, del } from '@vercel/blob';
import { db, collections } from '../config/firebase';
import { User, UserVerification } from '../types';
import { authService } from './auth';

// Get Vercel Blob token from environment or config
const BLOB_READ_WRITE_TOKEN = process.env.EXPO_PUBLIC_BLOB_READ_WRITE_TOKEN || '';

export interface VerificationDocument {
  id: string;
  userId: string;
  type: 'government_id' | 'passport' | 'drivers_license';
  frontImageUrl: string;
  backImageUrl?: string;
  selfieImageUrl: string;
  extractedData?: {
    name?: string;
    dateOfBirth?: string;
    documentNumber?: string;
    expiryDate?: string;
    address?: string;
  };
  status: 'pending' | 'approved' | 'rejected' | 'needs_review';
  reviewNotes?: string;
  submittedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
}

export interface VerificationSubmission {
  type: 'government_id' | 'passport' | 'drivers_license';
  frontImage: string; // base64 or file URI
  backImage?: string; // base64 or file URI
  selfieImage: string; // base64 or file URI
}

export class VerificationService {
  private static instance: VerificationService;

  private constructor() {}

  public static getInstance(): VerificationService {
    if (!VerificationService.instance) {
      VerificationService.instance = new VerificationService();
    }
    return VerificationService.instance;
  }

  // Submit verification documents
  public async submitVerification(
    userId: string,
    submission: VerificationSubmission
  ): Promise<string> {
    try {
      // Upload images to storage
      const frontImageUrl = await this.uploadVerificationImage(
        userId,
        'front',
        submission.frontImage
      );

      let backImageUrl: string | undefined;
      if (submission.backImage) {
        backImageUrl = await this.uploadVerificationImage(
          userId,
          'back',
          submission.backImage
        );
      }

      const selfieImageUrl = await this.uploadVerificationImage(
        userId,
        'selfie',
        submission.selfieImage
      );

      // Create verification document
      const verificationDoc = {
        userId,
        type: submission.type,
        frontImageUrl,
        backImageUrl,
        selfieImageUrl,
        status: 'pending' as const,
        submittedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'verifications'), verificationDoc);

      // Update user verification status
      await this.updateUserVerificationStatus(userId, {
        verificationStatus: 'pending',
        isVerified: false,
      });

      return docRef.id;
    } catch (error) {
      console.error('Error submitting verification:', error);
      throw new Error('Failed to submit verification');
    }
  }

  // Upload verification image to Vercel Blob
  private async uploadVerificationImage(
    userId: string,
    type: 'front' | 'back' | 'selfie',
    imageData: string
  ): Promise<string> {
    try {
      // Convert base64 to blob if needed
      const blob = await this.convertToBlob(imageData);
      
      // Create unique filename
      const filename = `verification/${userId}/${type}_${Date.now()}.jpg`;

      // Upload to Vercel Blob
      const result = await put(filename, blob, {
        access: 'public',
        token: BLOB_READ_WRITE_TOKEN,
      });

      return result.url;
    } catch (error) {
      console.error('Error uploading verification image:', error);
      throw new Error('Failed to upload verification image');
    }
  }

  // Convert image data to blob
  private async convertToBlob(imageData: string): Promise<Blob> {
    // If it's a file URI (from React Native image picker)
    if (imageData.startsWith('file://') || imageData.startsWith('content://')) {
      const response = await fetch(imageData);
      return await response.blob();
    }

    // If it's base64
    if (imageData.startsWith('data:')) {
      const response = await fetch(imageData);
      return await response.blob();
    }

    // Assume it's base64 without data URL prefix
    const base64Response = await fetch(`data:image/jpeg;base64,${imageData}`);
    return await base64Response.blob();
  }

  // Get verification status for user
  public async getVerificationStatus(userId: string): Promise<UserVerification | null> {
    try {
      const userDoc = await getDoc(doc(db, collections.users, userId));
      
      if (!userDoc.exists()) {
        throw new Error('User not found');
      }

      const userData = userDoc.data() as User;
      return userData.verification || null;
    } catch (error) {
      console.error('Error getting verification status:', error);
      throw new Error('Failed to get verification status');
    }
  }

  // Check if user is verified
  public async isUserVerified(userId: string): Promise<boolean> {
    try {
      const verification = await this.getVerificationStatus(userId);
      return verification?.isVerified === true;
    } catch (error) {
      console.error('Error checking user verification:', error);
      return false;
    }
  }

  // Update user verification status
  private async updateUserVerificationStatus(
    userId: string,
    updates: Partial<UserVerification>
  ): Promise<void> {
    try {
      const userRef = doc(db, collections.users, userId);
      
      await updateDoc(userRef, {
        verification: {
          ...updates,
          ...(updates.isVerified && { verifiedAt: serverTimestamp() }),
        },
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating user verification status:', error);
      throw new Error('Failed to update verification status');
    }
  }

  // Admin functions for reviewing verifications
  public async reviewVerification(
    verificationId: string,
    decision: 'approved' | 'rejected',
    notes?: string,
    reviewerId?: string
  ): Promise<void> {
    try {
      await runTransaction(db, async (transaction) => {
        // Get verification document
        const verificationRef = doc(db, 'verifications', verificationId);
        const verificationDoc = await transaction.get(verificationRef);
        
        if (!verificationDoc.exists()) {
          throw new Error('Verification not found');
        }

        const verification = verificationDoc.data() as VerificationDocument;
        
        // Update verification document
        transaction.update(verificationRef, {
          status: decision,
          reviewNotes: notes,
          reviewedAt: serverTimestamp(),
          reviewedBy: reviewerId,
        });

        // Update user verification status
        const userRef = doc(db, collections.users, verification.userId);
        transaction.update(userRef, {
          'verification.verificationStatus': decision,
          'verification.isVerified': decision === 'approved',
          ...(decision === 'approved' && {
            'verification.verifiedAt': serverTimestamp(),
          }),
          updatedAt: serverTimestamp(),
        });
      });
    } catch (error) {
      console.error('Error reviewing verification:', error);
      throw new Error('Failed to review verification');
    }
  }

  // Get verification requirements
  public getVerificationRequirements(): {
    acceptedDocuments: string[];
    imageRequirements: {
      format: string[];
      maxSize: number;
      quality: string;
    };
    tips: string[];
  } {
    return {
      acceptedDocuments: [
        'Government-issued ID',
        'Passport',
        'Driver\'s License',
        'National ID Card',
      ],
      imageRequirements: {
        format: ['JPEG', 'PNG'],
        maxSize: 10, // MB
        quality: 'High resolution, clear and readable',
      },
      tips: [
        'Ensure all corners of the document are visible',
        'Take photos in good lighting',
        'Avoid glare or shadows on the document',
        'Make sure all text is clearly readable',
        'Use a plain background',
        'Hold the document flat and straight',
        'For selfie: face the camera directly with good lighting',
      ],
    };
  }

  // Validate image before upload
  public async validateImage(imageUri: string): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    try {
      // Check if image exists
      const response = await fetch(imageUri);
      if (!response.ok) {
        errors.push('Unable to access image file');
        return { isValid: false, errors };
      }

      const blob = await response.blob();
      
      // Check file size (max 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB in bytes
      if (blob.size > maxSize) {
        errors.push('Image file size must be less than 10MB');
      }

      // Check file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
      if (!allowedTypes.includes(blob.type)) {
        errors.push('Image must be in JPEG or PNG format');
      }

      // Basic image dimension check (optional)
      const image = new Image();
      const imageUrl = URL.createObjectURL(blob);
      
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = imageUrl;
      });

      // Minimum dimensions
      if (image.width < 640 || image.height < 480) {
        errors.push('Image resolution too low. Minimum 640x480 pixels required');
      }

      URL.revokeObjectURL(imageUrl);

    } catch (error) {
      errors.push('Unable to process image file');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // Delete verification images (for privacy/cleanup)
  public async deleteVerificationImages(imageUrls: string[]): Promise<void> {
    try {
      // Delete each image URL from Vercel Blob
      const deletePromises = imageUrls.map(url => 
        del(url, { token: BLOB_READ_WRITE_TOKEN })
      );
      
      await Promise.all(deletePromises);
      
      console.log('Verification images deleted successfully');
    } catch (error) {
      console.error('Error deleting verification images:', error);
      throw new Error('Failed to delete verification images');
    }
  }

  // Get verification statistics (for admin dashboard)
  public async getVerificationStats(): Promise<{
    pending: number;
    approved: number;
    rejected: number;
    total: number;
  }> {
    try {
      // In a real implementation, you'd use Firestore aggregation queries
      // For now, return mock data
      return {
        pending: 0,
        approved: 0,
        rejected: 0,
        total: 0,
      };
    } catch (error) {
      console.error('Error getting verification stats:', error);
      throw new Error('Failed to get verification statistics');
    }
  }

  // Retry failed verification
  public async retryVerification(userId: string): Promise<void> {
    try {
      await this.updateUserVerificationStatus(userId, {
        verificationStatus: 'pending',
        isVerified: false,
      });
    } catch (error) {
      console.error('Error retrying verification:', error);
      throw new Error('Failed to retry verification');
    }
  }

  // Get verification badge info
  public getVerificationBadge(isVerified: boolean): {
    show: boolean;
    color: string;
    icon: string;
    text: string;
  } {
    if (isVerified) {
      return {
        show: true,
        color: '#10B981', // Green
        icon: 'checkmark-circle',
        text: 'Verified',
      };
    }

    return {
      show: false,
      color: '#6B7280', // Gray
      icon: 'help-circle',
      text: 'Not verified',
    };
  }
}

// Export singleton instance
export const verificationService = VerificationService.getInstance();

// Convenience hook
export const useVerification = () => {
  return {
    submitVerification: verificationService.submitVerification.bind(verificationService),
    getVerificationStatus: verificationService.getVerificationStatus.bind(verificationService),
    isUserVerified: verificationService.isUserVerified.bind(verificationService),
    reviewVerification: verificationService.reviewVerification.bind(verificationService),
    getVerificationRequirements: verificationService.getVerificationRequirements.bind(verificationService),
    validateImage: verificationService.validateImage.bind(verificationService),
    deleteVerificationImages: verificationService.deleteVerificationImages.bind(verificationService),
    getVerificationStats: verificationService.getVerificationStats.bind(verificationService),
    retryVerification: verificationService.retryVerification.bind(verificationService),
    getVerificationBadge: verificationService.getVerificationBadge.bind(verificationService),
  };
};

export default verificationService;
