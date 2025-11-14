# Admin Authentication Setup Guide

This guide explains how to create and manage admin accounts for the Rentat Admin Dashboard.

## Overview

The admin dashboard uses Firebase Authentication combined with Firestore to manage admin users. An admin account requires:
1. A Firebase Authentication account (email/password)
2. An entry in the `admins` collection in Firestore

## Method 1: Manual Setup (Recommended for First Admin)

### Step 1: Create Firebase Authentication User

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `rentat-app`
3. Navigate to **Authentication** → **Users**
4. Click **Add User**
5. Enter admin email and password
6. Click **Add User**
7. **Copy the User UID** (you'll need this for Step 2)

### Step 2: Create Admin Document in Firestore

1. In Firebase Console, navigate to **Firestore Database**
2. Click **Start Collection** (if `admins` collection doesn't exist) or click into `admins` collection
3. Collection ID: `admins`
4. Click **Add Document**
5. Document ID: **Use the UID from Step 1**
6. Add the following fields:

```json
{
  "email": "admin@example.com",
  "displayName": "Admin Name",
  "role": "super_admin",
  "permissions": {
    "users": {
      "view": true,
      "edit": true,
      "suspend": true,
      "delete": true
    },
    "content": {
      "view": true,
      "moderate": true,
      "delete": true
    },
    "analytics": {
      "view": true,
      "export": true
    },
    "notifications": {
      "send": true,
      "schedule": true
    },
    "featureFlags": {
      "view": true,
      "edit": true
    },
    "system": {
      "viewLogs": true,
      "manageAdmins": true
    }
  },
  "isActive": true,
  "createdAt": [Current timestamp]
}
```

7. Click **Save**

### Step 3: Login to Admin Dashboard

1. Go to https://rentat-app.web.app
2. You'll be redirected to `/login`
3. Enter the email and password from Step 1
4. You should be logged in and see the dashboard

## Method 2: Using Firebase Admin SDK (Programmatic)

If you have access to the Firebase Admin SDK (in Cloud Functions or backend), you can create admin users programmatically:

```typescript
import * as admin from 'firebase-admin';

async function createAdmin(email: string, password: string, displayName: string) {
  try {
    // 1. Create Firebase Auth user
    const userRecord = await admin.auth().createUser({
      email: email,
      password: password,
      displayName: displayName,
    });

    // 2. Create admin document in Firestore
    await admin.firestore().collection('admins').doc(userRecord.uid).set({
      email: email,
      displayName: displayName,
      role: 'super_admin',
      permissions: {
        users: {
          view: true,
          edit: true,
          suspend: true,
          delete: true
        },
        content: {
          view: true,
          moderate: true,
          delete: true
        },
        analytics: {
          view: true,
          export: true
        },
        notifications: {
          send: true,
          schedule: true
        },
        featureFlags: {
          view: true,
          edit: true
        },
        system: {
          viewLogs: true,
          manageAdmins: true
        }
      },
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('Admin created successfully:', userRecord.uid);
    return userRecord.uid;
  } catch (error) {
    console.error('Error creating admin:', error);
    throw error;
  }
}

// Usage
createAdmin('admin@example.com', 'SecurePassword123!', 'John Doe');
```

## Method 3: Using Firebase CLI and Scripts

Create a script file `create-admin.js`:

```javascript
const admin = require('firebase-admin');
const serviceAccount = require('./path/to/serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function createAdmin() {
  const email = 'admin@example.com';
  const password = 'SecurePassword123!';
  const displayName = 'Admin Name';

  try {
    const userRecord = await admin.auth().createUser({
      email: email,
      password: password,
      displayName: displayName,
    });

    await admin.firestore().collection('admins').doc(userRecord.uid).set({
      email: email,
      displayName: displayName,
      role: 'super_admin',
      permissions: {
        users: { view: true, edit: true, suspend: true, delete: true },
        content: { view: true, moderate: true, delete: true },
        analytics: { view: true, export: true },
        notifications: { send: true, schedule: true },
        featureFlags: { view: true, edit: true },
        system: { viewLogs: true, manageAdmins: true }
      },
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('✅ Admin created successfully!');
    console.log('UID:', userRecord.uid);
    console.log('Email:', email);
    console.log('You can now login at: https://rentat-app.web.app');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

createAdmin();
```

Run it:
```bash
node create-admin.js
```

## Admin Roles & Permissions

### Super Admin
- Full access to all features
- Can manage other admins
- All permissions set to `true`

### Moderator
```json
{
  "role": "moderator",
  "permissions": {
    "users": { "view": true, "edit": false, "suspend": true, "delete": false },
    "content": { "view": true, "moderate": true, "delete": true },
    "analytics": { "view": true, "export": false },
    "notifications": { "send": true, "schedule": false },
    "featureFlags": { "view": true, "edit": false },
    "system": { "viewLogs": true, "manageAdmins": false }
  }
}
```

### Analyst
```json
{
  "role": "analyst",
  "permissions": {
    "users": { "view": true, "edit": false, "suspend": false, "delete": false },
    "content": { "view": true, "moderate": false, "delete": false },
    "analytics": { "view": true, "export": true },
    "notifications": { "send": false, "schedule": false },
    "featureFlags": { "view": true, "edit": false },
    "system": { "viewLogs": false, "manageAdmins": false }
  }
}
```

## Security Rules

Make sure your Firestore security rules protect the `admins` collection:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Admins collection - only authenticated admins can read
    match /admins/{adminId} {
      allow read: if request.auth != null && exists(/databases/$(database)/documents/admins/$(request.auth.uid));
      allow write: if false; // Only create through backend/console
    }
  }
}
```

## Testing Your Admin Account

1. **Open the admin dashboard**: https://rentat-app.web.app
2. **Login** with your admin credentials
3. **Verify access**:
   - You should see the dashboard overview
   - Check the sidebar - you should see all menu items based on your permissions
   - Try navigating to `/users` to test the User Management page

## Troubleshooting

### "User is not an admin" Error
- **Solution**: Make sure the user's UID in Firebase Auth matches the document ID in the `admins` collection

### "Authentication failed" Error
- **Solution**: Check that the email/password combination is correct in Firebase Authentication

### Can't see certain menu items
- **Solution**: Check the `permissions` object in your admin document - the user needs appropriate permissions

### Dashboard shows loading forever
- **Solution**: 
  1. Check browser console for errors
  2. Verify Firebase config in `.env` file
  3. Make sure Firestore has the `admins` collection

## Environment Setup

Make sure you have a `.env` file in `admin-dashboard/` with your Firebase config:

```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=rentat-app.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=rentat-app
VITE_FIREBASE_STORAGE_BUCKET=rentat-app.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

## Quick Reference

### Admin Document Structure
```typescript
interface AdminUser {
  uid: string;              // Same as Firebase Auth UID
  email: string;            // Admin email
  displayName: string;      // Admin name
  role: 'super_admin' | 'moderator' | 'analyst';
  permissions: {
    users: { view, edit, suspend, delete },
    content: { view, moderate, delete },
    analytics: { view, export },
    notifications: { send, schedule },
    featureFlags: { view, edit },
    system: { viewLogs, manageAdmins }
  };
  isActive: boolean;        // Can be used to disable admin
  createdAt: Timestamp;
  lastLogin?: Timestamp;
}
```

### Collection Path
```
Firestore → admins → [uid] → { admin document }
```

## Support

For issues or questions, refer to:
- `README.md` - General documentation
- `DEPLOYMENT_GUIDE.md` - Deployment information
- `IMPLEMENTATION_STATUS.md` - Feature roadmap
