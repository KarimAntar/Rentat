import * as admin from 'firebase-admin';

// Initialize Firebase Admin
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function createAdmin() {
  const uid = '5oQsSCbaKiWH3T8hdzVbkZZQhrJ3';
  
  try {
    console.log('🔄 Adding admin permissions to existing user...');
    console.log('   UID:', uid);
    
    // 1. Fetch existing user from Firebase Auth
    const userRecord = await admin.auth().getUser(uid);
    
    console.log('✅ Found existing user!');
    console.log('   Email:', userRecord.email);
    console.log('   Display Name:', userRecord.displayName || 'Not set');

    // 2. Create admin document in Firestore
    await admin.firestore().collection('admins').doc(uid).set({
      email: userRecord.email,
      displayName: userRecord.displayName || 'Karim Antar',
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

    console.log('✅ Admin document created in Firestore!');
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 ADMIN PERMISSIONS ADDED SUCCESSFULLY!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 Email:', userRecord.email);
    console.log('👤 Name:', userRecord.displayName || 'Not set');
    console.log('🔑 UID:', uid);
    console.log('👑 Role: Super Admin');
    console.log('🌐 Login at: https://rentat-app.web.app');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ ERROR CREATING ADMIN:');
    
    if (error.code === 'auth/user-not-found') {
      console.error('   User with UID', uid, 'not found.');
      console.error('   Please check the UID and try again.');
    } else {
      console.error('   ', error.message);
    }
    
    console.error('\n');
    process.exit(1);
  }
}

createAdmin();
