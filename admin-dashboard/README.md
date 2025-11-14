# Rentat Admin Dashboard

A comprehensive web-based admin dashboard for managing the Rentat peer-to-peer rental marketplace platform.

## Overview

This admin dashboard provides powerful tools for platform administrators to manage users, moderate content, analyze metrics, send notifications, and configure platform features.

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **UI Framework**: Material-UI (MUI) v5+
- **Backend**: Firebase (Firestore, Auth, Functions, Storage)
- **Charts**: Recharts
- **Build Tool**: Vite
- **Routing**: React Router v6
- **Styling**: MUI Theme System + Emotion

## Features

### ✅ Implemented (Foundation)
- [x] Project structure and configuration
- [x] TypeScript setup with strict mode
- [x] Material-UI theme configuration (light/dark mode)
- [x] Firebase configuration
- [x] Environment variables setup
- [x] Admin-specific TypeScript types
- [x] Vite build configuration

### 🚧 To Be Implemented

#### Phase 1: Authentication & Layout
- [ ] Admin authentication system
- [ ] Role-based access control (Super Admin, Moderator, Analyst)
- [ ] Protected routes
- [ ] Dashboard layout with sidebar navigation
- [ ] Header with user info and logout
- [ ] Mobile-responsive design

#### Phase 2: User Management
- [ ] User overview dashboard with metrics
- [ ] Paginated users table with search/filter
- [ ] User detail pages
- [ ] Suspend/activate user accounts
- [ ] Bulk user actions
- [ ] User activity timeline
- [ ] Export users to CSV

#### Phase 3: Content Moderation
- [ ] Item listings moderation queue
- [ ] Review moderation system
- [ ] Chat message monitoring
- [ ] Bulk approve/reject actions
- [ ] Content flagging system
- [ ] Moderation analytics

#### Phase 4: Analytics Dashboard
- [ ] Key metrics overview (users, items, rentals, revenue)
- [ ] Revenue charts with Recharts
- [ ] User growth analytics
- [ ] Conversion funnels
- [ ] Real-time data updates
- [ ] Custom date range filters
- [ ] Export reports

#### Phase 5: Advanced Features
- [ ] Push notification campaigns
- [ ] Feature flag management
- [ ] Dispute resolution system
- [ ] System health monitoring
- [ ] Audit logs for all admin actions
- [ ] Security dashboard

## Project Structure

```
admin-dashboard/
├── src/
│   ├── components/
│   │   ├── common/          # Shared components
│   │   ├── layout/          # Layout components
│   │   ├── users/           # User management components
│   │   ├── content/         # Content moderation components
│   │   ├── analytics/       # Analytics components
│   │   ├── notifications/   # Notification components
│   │   └── features/        # Feature flag components
│   ├── pages/               # Page components
│   ├── services/            # Firebase services
│   ├── hooks/               # Custom React hooks
│   ├── utils/               # Utility functions
│   ├── types/               # TypeScript type definitions
│   ├── contexts/            # React contexts
│   ├── theme/               # MUI theme configuration
│   ├── config/              # Firebase & app configuration
│   ├── App.tsx              # Main app component
│   ├── main.tsx             # Entry point
│   └── index.css            # Global styles
├── public/                  # Static assets
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Firebase project (same as main Rentat app)
- Admin user credentials

### Installation

1. **Clone and navigate to the admin dashboard directory:**
   ```bash
   cd admin-dashboard
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```
   
   Then edit `.env` with your Firebase configuration:
   ```env
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```
   
   The dashboard will be available at `http://localhost:3001`

### Building for Production

```bash
npm run build
```

The production-ready files will be in the `dist/` directory.

### Deployment

Deploy to Firebase Hosting:

```bash
firebase deploy --only hosting:admin
```

## Firebase Setup Required

### Firestore Collections

Create these collections in your Firebase project:

- `admins/` - Admin users and their roles/permissions
- `audit_logs/` - Audit trail of all admin actions
- `feature_flags/` - Remote feature toggle configuration
- `notification_campaigns/` - Push notification campaigns
- `disputes/` - Dispute resolution cases
- `moderation_queue/` - Content moderation queue
- `system_logs/` - System health and error logs

### Firestore Security Rules

Update `firestore.rules` to allow admin access:

```javascript
match /admins/{adminId} {
  allow read, write: if request.auth != null && 
    get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.role == 'super_admin';
}

match /audit_logs/{logId} {
  allow read: if request.auth != null && 
    exists(/databases/$(database)/documents/admins/$(request.auth.uid));
  allow write: if request.auth != null;
}
```

### Firebase Functions

Create Cloud Functions for admin operations:

- `createAdmin` - Create new admin users
- `bulkSuspendUsers` - Bulk user suspension
- `sendNotificationCampaign` - Send push notifications
- `generateAnalyticsReport` - Generate analytics reports

## Admin Roles & Permissions

### Super Admin
- Full access to all features
- Can manage other admins
- View all audit logs
- Access system configuration

### Moderator
- User management (view, suspend)
- Content moderation
- View analytics
- Cannot manage admins or feature flags

### Analyst
- View-only access to analytics
- Export reports
- No user management or moderation capabilities

## Security Best Practices

1. **Authentication**: All admin users must authenticate via Firebase Auth
2. **Custom Claims**: Admin roles stored as custom claims in Firebase Auth
3. **Audit Trails**: All admin actions are logged with timestamps and user info
4. **Rate Limiting**: Sensitive operations have rate limits
5. **Environment Variables**: Never commit `.env` files to version control
6. **HTTPS Only**: Admin dashboard must be served over HTTPS in production

## Development Guidelines

### Code Style
- Use TypeScript strict mode
- Follow Material-UI best practices
- Use functional components with hooks
- Implement proper error boundaries

### State Management
- Use React Context for global state
- Local state with useState/useReducer
- Firebase real-time listeners for live data

### Performance
- Lazy load routes and components
- Implement virtual scrolling for large tables
- Optimize Firebase queries with pagination
- Use React.memo for expensive components

## Troubleshooting

### Firebase Connection Issues
- Verify `.env` file has correct Firebase config
- Check Firebase project permissions
- Ensure Firebase services are enabled

### Build Errors
- Clear node_modules: `rm -rf node_modules && npm install`
- Clear Vite cache: `rm -rf node_modules/.vite`

### Authentication Issues
- Verify admin user exists in `admins` collection
- Check Firebase Auth custom claims
- Review Firestore security rules

## Next Steps

To complete the admin dashboard implementation:

1. **Implement Authentication Context** (`src/contexts/AuthContext.tsx`)
2. **Create Dashboard Layout** (`src/components/layout/DashboardLayout.tsx`)
3. **Build Login Page** (`src/pages/LoginPage.tsx`)
4. **Implement Routing** (`src/App.tsx` with React Router)
5. **Create User Management Pages** (users list, user detail)
6. **Build Analytics Dashboard** (charts and metrics)
7. **Add Notification System** (campaign creation and sending)
8. **Implement Feature Flags** (CRUD operations)
9. **Create Moderation Tools** (queue management)
10. **Add Audit Logs Viewer** (admin action history)

## Resources

- [Material-UI Documentation](https://mui.com/)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Recharts Documentation](https://recharts.org/)
- [React Router Documentation](https://reactrouter.com/)
- [Vite Documentation](https://vitejs.dev/)

## Support

For issues or questions, contact the development team or refer to the main Rentat repository documentation.

## License

Proprietary - Rentat Platform
