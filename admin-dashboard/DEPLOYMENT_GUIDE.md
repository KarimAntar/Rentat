# Admin Dashboard Deployment Guide

## Architecture Overview

### 🏗️ Project Relationship

The admin dashboard is a **separate web application** that is:
- **Part of the same monorepo** (`admin-dashboard/` folder in your Rentat project)
- **Shares the same Firebase project** (same database, auth, storage)
- **Deployed separately** from the main React Native app
- **Has its own build process** (Vite instead of Expo)

```
rentat/                          # Main repository
├── src/                         # React Native mobile app
├── functions/                   # Firebase Cloud Functions (shared)
├── admin-dashboard/             # Web admin dashboard (NEW)
│   ├── src/                     # React web app
│   ├── package.json             # Separate dependencies
│   └── vite.config.ts           # Separate build config
├── firestore.rules              # Shared Firestore rules
├── storage.rules                # Shared Storage rules
└── firebase.json                # Firebase config (update needed)
```

### Why Separate?

1. **Different Technology**:
   - Main app: React Native/Expo (mobile)
   - Admin dashboard: React (web only)

2. **Different Audiences**:
   - Main app: End users (renters/owners)
   - Admin dashboard: Platform administrators

3. **Different Deployment**:
   - Main app: App stores + web via Expo
   - Admin dashboard: Web only (Firebase Hosting or Vercel)

4. **Security**:
   - Separate URL makes it easier to secure
   - Can use different authentication rules
   - Admin access controlled separately

---

## Deployment Options

### Option 1: Firebase Hosting (RECOMMENDED)

**Pros:**
- Same Firebase project (easy access to Firestore/Auth)
- Free SSL certificate
- CDN distribution
- Easy CI/CD with GitHub Actions
- Separate subdomain (admin.rentat.com)

**Cons:**
- Need to configure multiple hosting targets
- Slightly more complex setup

**Setup Steps:**

1. **Update `firebase.json` in root:**
```json
{
  "hosting": [
    {
      "target": "main",
      "public": "public",
      "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
      "rewrites": [
        {
          "source": "**",
          "destination": "/index.html"
        }
      ]
    },
    {
      "target": "admin",
      "public": "admin-dashboard/dist",
      "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
      "rewrites": [
        {
          "source": "**",
          "destination": "/index.html"
        }
      ]
    }
  ],
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "functions": {
    "source": "functions"
  },
  "storage": {
    "rules": "storage.rules"
  }
}
```

2. **Update `.firebaserc` in root:**
```json
{
  "projects": {
    "default": "your-project-id"
  },
  "targets": {
    "your-project-id": {
      "hosting": {
        "main": [
          "rentat"
        ],
        "admin": [
          "rentat-admin"
        ]
      }
    }
  }
}
```

3. **Build and deploy:**
```bash
# Build the admin dashboard
cd admin-dashboard
npm run build

# Go back to root
cd ..

# Deploy admin dashboard only
firebase deploy --only hosting:admin

# Or deploy everything
firebase deploy
```

4. **Access URLs:**
- Main app: `https://rentat.web.app` or your custom domain
- Admin: `https://rentat-admin.web.app` or `https://admin.rentat.com`

---

### Option 2: Vercel (Alternative)

**Pros:**
- Easy deployment from GitHub
- Automatic deployments on push
- Great preview deployments
- Simple configuration

**Cons:**
- Separate platform from Firebase
- Need to manage CORS for Firebase calls
- Additional service to maintain

**Setup Steps:**

1. **Create `vercel.json` in `admin-dashboard/`:**
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "env": {
    "VITE_FIREBASE_API_KEY": "@firebase-api-key",
    "VITE_FIREBASE_AUTH_DOMAIN": "@firebase-auth-domain",
    "VITE_FIREBASE_PROJECT_ID": "@firebase-project-id",
    "VITE_FIREBASE_STORAGE_BUCKET": "@firebase-storage-bucket",
    "VITE_FIREBASE_MESSAGING_SENDER_ID": "@firebase-messaging-sender-id",
    "VITE_FIREBASE_APP_ID": "@firebase-app-id"
  }
}
```

2. **Deploy to Vercel:**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy from admin-dashboard directory
cd admin-dashboard
vercel

# Or connect GitHub repo and auto-deploy
```

3. **Add environment variables in Vercel dashboard**

---

### Option 3: Netlify (Alternative)

Similar to Vercel, with these configuration files:

**`admin-dashboard/netlify.toml`:**
```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

---

## Recommended Deployment Strategy

### For Your Use Case: **Firebase Hosting**

**Reasoning:**
1. ✅ Your main app already uses Firebase
2. ✅ Admin dashboard needs direct Firestore access
3. ✅ Easier to manage in one Firebase project
4. ✅ Free hosting for admin dashboard
5. ✅ Can use custom subdomain (admin.rentat.com)
6. ✅ No additional platforms to manage

### Deployment Workflow

```bash
# 1. Make changes to admin dashboard
cd admin-dashboard
# ... make changes ...

# 2. Build the admin dashboard
npm run build

# 3. Go back to root
cd ..

# 4. Deploy ONLY admin dashboard
firebase deploy --only hosting:admin

# 5. Or deploy everything together
firebase deploy
```

---

## Environment Variables

### For Firebase Hosting

Create `.env.production` in `admin-dashboard/`:
```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

These are the **same credentials** as your main app since they share the Firebase project.

### For Vercel

Add environment variables in Vercel dashboard under "Settings > Environment Variables"

---

## CI/CD Setup (GitHub Actions)

Create `.github/workflows/deploy-admin.yml`:

```yaml
name: Deploy Admin Dashboard

on:
  push:
    branches: [main]
    paths:
      - 'admin-dashboard/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: |
          cd admin-dashboard
          npm ci
          
      - name: Build
        env:
          VITE_FIREBASE_API_KEY: ${{ secrets.FIREBASE_API_KEY }}
          VITE_FIREBASE_AUTH_DOMAIN: ${{ secrets.FIREBASE_AUTH_DOMAIN }}
          VITE_FIREBASE_PROJECT_ID: ${{ secrets.FIREBASE_PROJECT_ID }}
          VITE_FIREBASE_STORAGE_BUCKET: ${{ secrets.FIREBASE_STORAGE_BUCKET }}
          VITE_FIREBASE_MESSAGING_SENDER_ID: ${{ secrets.FIREBASE_MESSAGING_SENDER_ID }}
          VITE_FIREBASE_APP_ID: ${{ secrets.FIREBASE_APP_ID }}
        run: |
          cd admin-dashboard
          npm run build
          
      - name: Deploy to Firebase
        uses: w9jds/firebase-action@master
        with:
          args: deploy --only hosting:admin
        env:
          FIREBASE_TOKEN: ${{ secrets.FIREBASE_TOKEN }}
```

---

## Security Considerations

### 1. Separate Subdomain
- Admin dashboard: `admin.rentat.com`
- Main app: `rentat.com` or `app.rentat.com`

### 2. Firestore Security Rules

Update `firestore.rules` to allow admin access:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper function to check if user is admin
    function isAdmin() {
      return request.auth != null && 
        exists(/databases/$(database)/documents/admins/$(request.auth.uid));
    }
    
    function isSuperAdmin() {
      return isAdmin() && 
        get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.role == 'super_admin';
    }
    
    // Admin collection - only super admins can manage
    match /admins/{adminId} {
      allow read: if isAdmin();
      allow write: if isSuperAdmin();
    }
    
    // Audit logs - admins can read, any authenticated can write
    match /audit_logs/{logId} {
      allow read: if isAdmin();
      allow create: if request.auth != null;
    }
    
    // All other collections - admins have full access
    match /{document=**} {
      allow read, write: if isAdmin();
    }
    
    // ... rest of your existing rules for regular users
  }
}
```

### 3. Admin Authentication

Admins will log in using:
- Email/password via Firebase Auth
- Admin privileges granted via custom claims or `admins` collection
- Role-based permissions enforced in the dashboard

---

## Summary

### ✅ Recommended Setup

```
Project Structure:
├── Main Rentat App (React Native)
│   └── Deployed to: App Stores + Web
│
├── Admin Dashboard (React Web)
│   └── Deployed to: Firebase Hosting (admin.rentat.com)
│
└── Shared Firebase Project
    ├── Firestore (shared database)
    ├── Auth (shared authentication)
    ├── Storage (shared file storage)
    └── Functions (shared backend logic)
```

### Deployment Commands

```bash
# Development
cd admin-dashboard && npm run dev

# Build
cd admin-dashboard && npm run build

# Deploy to Firebase Hosting
firebase deploy --only hosting:admin

# Deploy everything
firebase deploy
```

### Access URLs
- **Main App**: `https://rentat.com`
- **Admin Dashboard**: `https://admin.rentat.com`
- **Dev Server**: `http://localhost:3001`

The admin dashboard is part of your monorepo but deployed separately as a web app, sharing the same Firebase backend with your main mobile app.
