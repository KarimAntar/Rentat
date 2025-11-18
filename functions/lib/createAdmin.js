"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const admin = __importStar(require("firebase-admin"));
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
    }
    catch (error) {
        console.error('\n❌ ERROR CREATING ADMIN:');
        if (error.code === 'auth/user-not-found') {
            console.error('   User with UID', uid, 'not found.');
            console.error('   Please check the UID and try again.');
        }
        else {
            console.error('   ', error.message);
        }
        console.error('\n');
        process.exit(1);
    }
}
createAdmin();
//# sourceMappingURL=createAdmin.js.map