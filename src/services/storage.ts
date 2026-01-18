import { put, del } from '@vercel/blob';

export interface ImageUploadResult {
  url: string;
  path: string;
}

// Get Vercel Blob token from environment or config
const BLOB_READ_WRITE_TOKEN = process.env.EXPO_PUBLIC_BLOB_READ_WRITE_TOKEN || '';

export class StorageService {
  /**
   * Upload an image to Vercel Blob
   */
  static async uploadImage(
    uri: string,
    folder: string,
    fileName?: string
  ): Promise<ImageUploadResult> {
    try {
      // Generate unique filename if not provided
      const timestamp = Date.now();
      const finalFileName = fileName || `image_${timestamp}.jpg`;
      
      // Create the full path
      const path = `${folder}/${finalFileName}`;
      
      // Convert URI to blob
      const response = await fetch(uri);
      const blob = await response.blob();
      
      // Upload to Vercel Blob
      const result = await put(path, blob, {
        access: 'public',
        token: BLOB_READ_WRITE_TOKEN,
      });
      
      return {
        url: result.url,
        path: result.pathname,
      };
    } catch (error) {
      console.error('Error uploading image:', error);
      throw new Error('Failed to upload image');
    }
  }

  /**
   * Upload multiple images for an item
   */
  static async uploadItemImages(
    imageUris: string[],
    itemId: string
  ): Promise<ImageUploadResult[]> {
    try {
      const uploadPromises = imageUris.map((uri, index) =>
        this.uploadImage(uri, `items/${itemId}`, `image_${index}_${Date.now()}.jpg`)
      );
      
      return await Promise.all(uploadPromises);
    } catch (error) {
      console.error('Error uploading multiple images:', error);
      throw new Error('Failed to upload images');
    }
  }

  /**
   * Delete an image from Vercel Blob
   */
  static async deleteImage(imageUrl: string): Promise<void> {
    try {
      await del(imageUrl, {
        token: BLOB_READ_WRITE_TOKEN,
      });
    } catch (error) {
      console.error('Error deleting image:', error);
      throw new Error('Failed to delete image');
    }
  }

  /**
   * Delete multiple images
   */
  static async deleteImages(imageUrls: string[]): Promise<void> {
    try {
      const deletePromises = imageUrls.map(url => this.deleteImage(url));
      await Promise.all(deletePromises);
    } catch (error) {
      console.error('Error deleting multiple images:', error);
      throw new Error('Failed to delete images');
    }
  }

  /**
   * Upload user profile image
   */
  static async uploadUserProfileImage(
    uri: string,
    userId: string
  ): Promise<ImageUploadResult> {
    return this.uploadImage(uri, `users/${userId}`, 'profile.jpg');
  }

  /**
   * Upload identity verification images
   */
  static async uploadIdentityImages(
    idImageUri: string,
    selfieUri: string,
    userId: string
  ): Promise<{ idImage: ImageUploadResult; selfie: ImageUploadResult }> {
    try {
      const [idImage, selfie] = await Promise.all([
        this.uploadImage(idImageUri, `identity/${userId}`, 'id_document.jpg'),
        this.uploadImage(selfieUri, `identity/${userId}`, 'selfie.jpg'),
      ]);

      return { idImage, selfie };
    } catch (error) {
      console.error('Error uploading identity images:', error);
      throw new Error('Failed to upload identity verification images');
    }
  }

  /**
   * Get file size in bytes from URI
   */
  static async getFileSize(uri: string): Promise<number> {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      return blob.size;
    } catch (error) {
      console.error('Error getting file size:', error);
      return 0;
    }
  }

  /**
   * Validate image before upload
   */
  static async validateImage(uri: string): Promise<{ valid: boolean; error?: string }> {
    try {
      const fileSize = await this.getFileSize(uri);
      const maxSize = 10 * 1024 * 1024; // 10MB

      if (fileSize > maxSize) {
        return { valid: false, error: 'Image size must be less than 10MB' };
      }

      // Check if it's a valid image by trying to load it
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ valid: true });
        img.onerror = () => resolve({ valid: false, error: 'Invalid image file' });
        img.src = uri;
      });
    } catch (error) {
      return { valid: false, error: 'Failed to validate image' };
    }
  }
}
