# Vercel Blob Storage Setup Guide

This document explains how to set up and configure Vercel Blob storage for the Rentat application.

## Overview

The application has been migrated from Firebase Storage to Vercel Blob for handling all file uploads including:
- User profile images
- Item listing images
- Identity verification documents
- Damage report images

## Prerequisites

1. A Vercel account
2. Access to the Vercel project dashboard

## Setup Instructions

### 1. Create a Vercel Blob Store

1. Go to your Vercel dashboard: https://vercel.com/dashboard
2. Navigate to your project
3. Go to the **Storage** tab
4. Click **Create Database**
5. Select **Blob** as the storage type
6. Give it a name (e.g., `rentat-storage`)
7. Click **Create**

### 2. Get Your Blob Read/Write Token

1. In the Storage tab, click on your newly created Blob store
2. Go to the **Settings** or **Tokens** section
3. Copy the **Read/Write Token** (starts with `vercel_blob_rw_`)

### 3. Configure Environment Variables

#### Store Details

Your Vercel Blob store has been created with the following details:

- **Store ID**: `store_UvsgM6oYONFVRrxU`
- **Region**: London, United Kingdom
- **Base URL**: `https://uvsgm6oyonfvrrxu.public.blob.vercel-storage.com`

All uploaded files will be publicly accessible at URLs like:
`https://uvsgm6oyonfvrrxu.public.blob.vercel-storage.com/path/to/file.jpg`

#### For Local Development

Create or update your `.env.local` file in the project root:

```env
EXPO_PUBLIC_BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxxxxxxxxx
```

**Note**: Replace `vercel_blob_rw_xxxxxxxxxxxx` with your actual token from the Vercel dashboard.

#### For Production (Vercel)

1. Go to your Vercel project settings
2. Navigate to **Environment Variables**
3. Add a new environment variable:
   - **Name**: `EXPO_PUBLIC_BLOB_READ_WRITE_TOKEN`
   - **Value**: Your Blob read/write token
   - **Environments**: Select Production, Preview, and Development

#### For React Native/Expo

If using Expo's environment variables, add to your `app.json` or create an `.env` file:

```json
{
  "expo": {
    "extra": {
      "blobToken": "vercel_blob_rw_xxxxxxxxxxxx"
    }
  }
}
```

Or in `.env`:
```env
EXPO_PUBLIC_BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxxxxxxxxx
```

## Usage in Code

The storage service automatically uses the environment variable:

```typescript
import { StorageService } from './services/storage';

// Upload an image
const result = await StorageService.uploadImage(
  imageUri,
  'items/item123',
  'image.jpg'
);

// Delete an image
await StorageService.deleteImage(result.url);
```

## File Organization

Files are organized in the following structure:

```
/users/{userId}/profile.jpg          - User profile images
/users/{userId}/verification/        - Identity verification documents
/items/{itemId}/image_*.jpg          - Item listing images
/damage-reports/                     - Damage report images
/identity/{userId}/                  - Alternative identity document storage
```

## Security Considerations

### Token Security

- **NEVER** commit your Blob token to version control
- Add `.env`, `.env.local`, `.env.production` to `.gitignore`
- Use different tokens for development and production environments
- Rotate tokens periodically

### Access Control

- The current implementation uses public access for uploaded files
- For sensitive files (e.g., identity documents), consider:
  - Using server-side uploads through Cloud Functions
  - Implementing signed URLs with expiration
  - Adding authentication middleware

### File Validation

The storage service includes validation for:
- File size limits (10MB max)
- Supported formats (JPEG, PNG)
- Image dimensions (minimum 640x480 for verification)

## Migration from Firebase Storage

### What Changed

1. **Import statements**: Changed from `firebase/storage` to `@vercel/blob`
2. **API methods**: 
   - `uploadBytes` → `put`
   - `getDownloadURL` → result.url (returned directly)
   - `deleteObject` → `del`
3. **Configuration**: Uses environment variable instead of Firebase config
4. **Path handling**: Simplified path structure

### Data Migration

If you have existing files in Firebase Storage, you'll need to:

1. Download all files from Firebase Storage
2. Re-upload them to Vercel Blob using the storage service
3. Update Firestore document references with new URLs

Example migration script structure:

```typescript
// Pseudo-code for migration
async function migrateStorageToBlob() {
  // 1. List all files from Firebase Storage
  // 2. Download each file
  // 3. Upload to Vercel Blob using StorageService
  // 4. Update Firestore with new URLs
  // 5. Optionally delete from Firebase Storage
}
```

## Troubleshooting

### Token Not Found Error

If you see `Failed to upload image` errors:
1. Verify the environment variable is set correctly
2. Restart your development server
3. Check that the variable name is exactly `EXPO_PUBLIC_BLOB_READ_WRITE_TOKEN`

### CORS Issues

If uploading from web browsers fails:
1. Check Vercel Blob CORS settings in your dashboard
2. Ensure your domain is whitelisted
3. For local development, add `localhost` to allowed origins

### File Upload Failures

Common causes:
- File exceeds 10MB limit
- Invalid file format
- Network connectivity issues
- Invalid or expired token

## Cost Considerations

Vercel Blob pricing:
- **Free tier**: 1GB storage, 10GB bandwidth
- **Pro tier**: Starts at 100GB storage, 1TB bandwidth
- Check current pricing: https://vercel.com/docs/storage/vercel-blob/usage-and-pricing

## Additional Resources

- [Vercel Blob Documentation](https://vercel.com/docs/storage/vercel-blob)
- [Vercel Blob SDK](https://www.npmjs.com/package/@vercel/blob)
- [Storage Service Code](../src/services/storage.ts)

## Support

For issues or questions:
1. Check the Vercel Blob documentation
2. Review the storage service implementation
3. Contact the development team
