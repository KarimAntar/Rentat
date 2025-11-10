import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { sendEmailVerification, reload } from 'firebase/auth';
import Toast from 'react-native-toast-message';
import Button from '../../components/ui/Button';
import { useAuthContext } from '../../contexts/AuthContext';

const EmailVerificationScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user, signOut } = useAuthContext();
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleResendEmail = async () => {
    if (!user || resendCooldown > 0) return;

    setLoading(true);
    try {
      await sendEmailVerification(user);
      setResendCooldown(60); // 60 second cooldown
      Toast.show({
        type: 'success',
        text1: 'Email Sent!',
        text2: 'A new verification email has been sent to your email address. Please check your inbox and spam folder.',
      });
    } catch (error: any) {
      console.error('Error sending verification email:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to send verification email. Please try again later.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckVerification = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Reload user data from Firebase to get fresh emailVerified status
      await reload(user);
      
      // Check the updated emailVerified status
      // The reload() updates the user object in place
      const isVerified = user.emailVerified;
      
      console.log('Verification status after reload:', isVerified);
      
      if (isVerified) {
        Toast.show({
          type: 'success',
          text1: 'Success!',
          text2: 'Your email has been verified. You can now access all features.',
        });
        navigation.navigate('Home' as never);
      } else {
        Toast.show({
          type: 'info',
          text1: 'Not Verified Yet',
          text2: 'Your email hasn\'t been verified yet. Please check your inbox and click the verification link.',
        });
      }
    } catch (error) {
      console.error('Error checking verification:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to check verification status. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    Toast.show({
      type: 'info',
      text1: 'Sign Out',
      text2: 'You have been signed out.',
    });
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Icon */}
        <View style={styles.iconContainer}>
          <Ionicons name="mail-outline" size={80} color="#4639eb" />
        </View>

        {/* Title */}
        <Text style={styles.title}>Verify Your Email</Text>

        {/* Subtitle */}
        <Text style={styles.subtitle}>
          We've sent a verification email to:
        </Text>
        <Text style={styles.email}>{user?.email}</Text>

        {/* Instructions */}
        <View style={styles.instructionsContainer}>
          <Text style={styles.instructionsTitle}>To continue:</Text>
          <View style={styles.instructionItem}>
            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
            <Text style={styles.instructionText}>
              Check your email inbox (and spam folder)
            </Text>
          </View>
          <View style={styles.instructionItem}>
            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
            <Text style={styles.instructionText}>
              Click the verification link in the email
            </Text>
          </View>
          <View style={styles.instructionItem}>
            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
            <Text style={styles.instructionText}>
              Come back here and click "I've Verified My Email"
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            title="I've Verified My Email"
            onPress={handleCheckVerification}
            loading={loading}
            style={styles.verifyButton}
          />

          <TouchableOpacity
            style={styles.resendButton}
            onPress={handleResendEmail}
            disabled={loading || resendCooldown > 0}
          >
            <Text style={[
              styles.resendText,
              (loading || resendCooldown > 0) && styles.resendTextDisabled
            ]}>
              {resendCooldown > 0
                ? `Resend email in ${resendCooldown}s`
                : 'Resend verification email'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.signOutButton}
            onPress={handleSignOut}
          >
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* Help Text */}
        <View style={styles.helpContainer}>
          <Ionicons name="information-circle-outline" size={16} color="#6B7280" />
          <Text style={styles.helpText}>
            Didn't receive the email? Check your spam folder or try resending.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 8,
  },
  email: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4639eb',
    textAlign: 'center',
    marginBottom: 32,
  },
  instructionsContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 20,
    marginBottom: 32,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  instructionText: {
    fontSize: 14,
    color: '#4B5563',
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
  actions: {
    gap: 12,
  },
  verifyButton: {
    marginTop: 0,
  },
  resendButton: {
    padding: 16,
    alignItems: 'center',
  },
  resendText: {
    fontSize: 16,
    color: '#4639eb',
    fontWeight: '500',
  },
  resendTextDisabled: {
    color: '#9CA3AF',
  },
  signOutButton: {
    padding: 16,
    alignItems: 'center',
  },
  signOutText: {
    fontSize: 16,
    color: '#EF4444',
    fontWeight: '500',
  },
  helpContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 24,
    padding: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  helpText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
});

export default EmailVerificationScreen;
