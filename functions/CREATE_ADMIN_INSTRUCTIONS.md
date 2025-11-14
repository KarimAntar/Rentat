# Create Admin User Script

This script creates an admin user with full super admin permissions.

## Prerequisites

You need a Firebase Admin SDK service account key to run this script.

### Getting the Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `rentat-app`
3. Click the **Settings** gear icon → **Project Settings**
4. Navigate to **Service Accounts** tab
5. Click **Generate New Private Key**
6. Save the JSON file as `serviceAccountKey.json` in the `functions/` directory

⚠️ **SECURITY WARNING**: Never commit `serviceAccountKey.json` to git. It's already in `.gitignore`.

## Running the Script

### Option 1: Using ts-node (Recommended)

```bash
cd functions
npm install -g ts-node
ts-node src/createAdmin.ts
```

### Option 2: Compile and Run

```bash
cd functions
npm run build
node lib/createAdmin.js
```

### Option 3: Using tsx

```bash
cd functions
npx tsx src/createAdmin.ts
```

## What This Script Does

1. Creates a Firebase Authentication user with email: `karimamdou7@gmail.com`
2. Creates an admin document in Firestore with:
   - **Role**: Super Admin
   - **Full Permissions**: All features unlocked
   - **Status**: Active

## After Running

Once the script completes successfully:

1. You'll see a success message with the UID
2. Login at: https://rentat-app.web.app
3. Use credentials:
   - Email: `karimamdou7@gmail.com`
   - Password: `ZawZaw24@!#`

## Troubleshooting

### "Email already exists" Error

The email is already registered in Firebase Auth. You can:

1. **Delete the existing user**:
   - Go to Firebase Console → Authentication → Users
   - Find the user and delete it
   - Run the script again

2. **Use the existing user**:
   - Just add the admin document to Firestore manually
   - Use the existing user's UID

### "Service account key not found" Error

Make sure `serviceAccountKey.json` exists in the `functions/` directory.

### "Permission denied" Error

Make sure your service account has the necessary permissions:
- Firebase Authentication Admin
- Cloud Firestore Admin

## Alternative: Manual Creation (No Script Needed)

If you don't want to use the script, you can create the admin manually:

1. **Create Firebase Auth User**:
   - Firebase Console → Authentication → Users → Add User
   - Email: `karimamdou7@gmail.com`
   - Password: `ZawZaw24@!#`
   - Copy the UID

2. **Create Firestore Document**:
   - Firebase Console → Firestore → `admins` collection
   - Add document with the UID as Document ID
   - Copy the following JSON and add each field:

```json
{
  "email": "karimamdou7@gmail.com",
  "displayName": "Karim Mamdouh",
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
  "createdAt": [Use Firestore timestamp]
}
```

## Security Best Practices

1. ✅ Keep `serviceAccountKey.json` private
2. ✅ Don't commit credentials to git
3. ✅ Use strong passwords
4. ✅ Enable 2FA on your Firebase account
5. ✅ Rotate service account keys regularly
6. ✅ Delete inactive admin users

## Need Help?

Check the main admin setup guide: `admin-dashboard/ADMIN_SETUP_GUIDE.md`
