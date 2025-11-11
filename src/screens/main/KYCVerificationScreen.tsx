import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuthContext } from '../../contexts/AuthContext';
import { diditKycService } from '../../services/diditKyc';
import Button from '../../components/ui/Button';

interface StatusInfo {
  icon: string;
  color: string;
  title: string;
  description: string;
}

const KYCVerificationScreen: React.FC = () => {
  const { user } = useAuthContext();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [kycInfo, setKycInfo] = useState<any>(null);
  const [verificationUrl, setVerificationUrl] = useState<string | null>(null);
  const [startingVerification, setStartingVerification] = useState(false);

  // Modal states
  const [showStartingModal, setShowStartingModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showCanceledModal, setShowCanceledModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');

  useEffect(() => {
    loadKycInfo();
  }, [user]);

  // Refresh status when returning to screen
  useFocusEffect(
    React.useCallback(() => {
      loadKycInfo();
    }, [])
  );

  const loadKycInfo = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const info = await diditKycService.getUserKycInfo(user.uid);
      setKycInfo(info);
      setVerificationUrl(info?.verificationUrl || null);
    } catch (error) {
      console.error('Error loading KYC info:', error);
    } finally {
      setLoading(false);
    }
  };

  const startVerification = async () => {
    if (!user) return;

    try {
      setStartingVerification(true);
      setShowStartingModal(true);
      setModalMessage('Creating verification session...');

      const session = await diditKycService.createVerificationSession(user.uid);

      console.log('Session created:', session);

      // Construct verification URL manually since Didit API doesn't provide it
      const verificationUrl = `https://verification.didit.me/verify/${session.sessionId}`;

      setModalMessage('Opening verification page...');

      // Open the verification URL
      const supported = await Linking.canOpenURL(verificationUrl);

      if (supported) {
        await Linking.openURL(verificationUrl);
        setShowStartingModal(false);

        // Show instructions modal
        setModalMessage('Please complete the verification process in the opened window. Once done, return to this app.');
        setShowStartingModal(true);

        // Auto-hide after 3 seconds and refresh status
        setTimeout(() => {
          setShowStartingModal(false);
          loadKycInfo();
        }, 3000);

      } else {
        setShowStartingModal(false);
        setModalMessage('Unable to open verification link. Please check your browser settings.');
        setShowErrorModal(true);
      }
    } catch (error) {
      console.error('Error starting verification:', error);
      setShowStartingModal(false);
      setModalMessage('Failed to start verification. Please try again.');
      setShowErrorModal(true);
    } finally {
      setStartingVerification(false);
    }
  };

  const continueVerification = async () => {
    if (!verificationUrl) return;

    try {
      const supported = await Linking.canOpenURL(verificationUrl);
      if (supported) {
        await Linking.openURL(verificationUrl);
      } else {
        Alert.alert('Error', 'Unable to open verification link');
      }
    } catch (error) {
      console.error('Error opening verification link:', error);
      Alert.alert('Error', 'Failed to open verification. Please try again.');
    }
  };

  const getStatusInfo = (): StatusInfo => {
    if (!kycInfo?.status) {
      return {
        icon: 'alert-circle-outline',
        color: '#6B7280',
        title: 'Verification Required',
        description: 'Complete identity verification to unlock all features including withdrawals and rental requests.',
      };
    }

    switch (kycInfo.status) {
      case 'not_started':
        return {
          icon: 'alert-circle-outline',
          color: '#6B7280',
          title: 'Not Started',
          description: 'You haven\'t started the verification process yet.',
        };
      case 'in_progress':
        return {
          icon: 'time-outline',
          color: '#F59E0B',
          title: 'In Progress',
          description: 'Your verification is currently in progress. Please complete all required steps.',
        };
      case 'in_review':
        return {
          icon: 'search-outline',
          color: '#3B82F6',
          title: 'Under Review',
          description: 'Your documents are being reviewed. This usually takes 1-2 business days.',
        };
      case 'approved':
        return {
          icon: 'checkmark-circle',
          color: '#10B981',
          title: 'Verified',
          description: 'Your identity has been verified successfully! You now have access to all features.',
        };
      case 'rejected':
        return {
          icon: 'close-circle',
          color: '#EF4444',
          title: 'Rejected',
          description: 'Your verification was rejected. Please contact support for more information.',
        };
      case 'expired':
        return {
          icon: 'alert-circle',
          color: '#EF4444',
          title: 'Expired',
          description: 'Your verification session has expired. Please start again.',
        };
      default:
        return {
          icon: 'help-circle-outline',
          color: '#6B7280',
          title: 'Unknown Status',
          description: 'Unable to determine verification status.',
        };
    }
  };

  const statusInfo = getStatusInfo();
  const verificationInfo = diditKycService.getVerificationInfo();

  const showActionButton = !kycInfo?.status || 
    kycInfo.status === 'not_started' || 
    kycInfo.status === 'expired';

  const showContinueButton = kycInfo?.status === 'in_progress' && verificationUrl;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4639eb" />
          <Text style={styles.loadingText}>Loading verification status...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Status Card */}
        <View style={[styles.statusCard, { borderColor: statusInfo.color }]}>
          <Ionicons name={statusInfo.icon as any} size={64} color={statusInfo.color} />
          <Text style={styles.statusTitle}>{statusInfo.title}</Text>
          <Text style={styles.statusDescription}>{statusInfo.description}</Text>
        </View>

        {/* Information Section */}
        {showActionButton && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{verificationInfo.name}</Text>
            <Text style={styles.sectionDescription}>{verificationInfo.description}</Text>

            <Text style={styles.subsectionTitle}>What You'll Need:</Text>
            {verificationInfo.requirements.map((req, index) => (
              <View key={index} style={styles.requirementItem}>
                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                <Text style={styles.requirementText}>{req}</Text>
              </View>
            ))}

            <View style={styles.timeEstimate}>
              <Ionicons name="time-outline" size={20} color="#6B7280" />
              <Text style={styles.estimatedTime}>
                Estimated time: {verificationInfo.estimatedTime}
              </Text>
            </View>
          </View>
        )}

        {/* Verification Status Info */}
        {kycInfo?.sessionId && (
          <View style={styles.infoSection}>
            <Text style={styles.infoLabel}>Session ID:</Text>
            <Text style={styles.infoValue}>{kycInfo.sessionId.substring(0, 16)}...</Text>
            {kycInfo.verifiedAt && (
              <>
                <Text style={styles.infoLabel}>Verified On:</Text>
                <Text style={styles.infoValue}>
                  {new Date(kycInfo.verifiedAt.seconds * 1000).toLocaleDateString()}
                </Text>
              </>
            )}
          </View>
        )}

        {/* Action Buttons */}
        {showActionButton && (
          <Button
            title="Start Verification"
            onPress={startVerification}
            loading={startingVerification}
            disabled={startingVerification}
            style={styles.actionButton}
          />
        )}

        {showContinueButton && (
          <Button
            title="Continue Verification"
            onPress={continueVerification}
            style={styles.actionButton}
          />
        )}

        {kycInfo?.status === 'in_review' && (
          <TouchableOpacity 
            style={styles.refreshButton}
            onPress={loadKycInfo}
          >
            <Ionicons name="refresh" size={20} color="#4639eb" />
            <Text style={styles.refreshText}>Refresh Status</Text>
          </TouchableOpacity>
        )}

        {kycInfo?.status === 'rejected' && (
          <Button
            title="Contact Support"
            onPress={() => {
              Alert.alert(
                'Contact Support',
                'Please email support@rentat.com for assistance with your verification.',
                [{ text: 'OK' }]
              );
            }}
            variant="outline"
            style={styles.actionButton}
          />
        )}
      </ScrollView>

      {/* Starting Verification Modal */}
      <Modal
        visible={showStartingModal}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ActivityIndicator size="large" color="#4639eb" />
            <Text style={styles.modalTitle}>Starting Verification</Text>
            <Text style={styles.modalMessage}>{modalMessage}</Text>
          </View>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Ionicons name="checkmark-circle" size={64} color="#10B981" />
            <Text style={styles.modalTitle}>Verification Successful!</Text>
            <Text style={styles.modalMessage}>
              Your identity has been verified successfully. You now have access to all features including withdrawals.
            </Text>
            <Button
              title="Continue"
              onPress={() => {
                setShowSuccessModal(false);
                navigation.goBack();
              }}
              style={styles.modalButton}
            />
          </View>
        </View>
      </Modal>

      {/* Canceled Modal */}
      <Modal
        visible={showCanceledModal}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Ionicons name="close-circle" size={64} color="#F59E0B" />
            <Text style={styles.modalTitle}>Verification Canceled</Text>
            <Text style={styles.modalMessage}>
              The verification process was canceled or closed. You can restart the verification at any time.
            </Text>
            <Button
              title="Try Again"
              onPress={() => {
                setShowCanceledModal(false);
                startVerification();
              }}
              style={styles.modalButton}
            />
            <Button
              title="Cancel"
              onPress={() => setShowCanceledModal(false)}
              variant="outline"
              style={styles.modalButton}
            />
          </View>
        </View>
      </Modal>

      {/* Error Modal */}
      <Modal
        visible={showErrorModal}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Ionicons name="alert-circle" size={64} color="#EF4444" />
            <Text style={styles.modalTitle}>Verification Error</Text>
            <Text style={styles.modalMessage}>{modalMessage}</Text>
            <Button
              title="Try Again"
              onPress={() => {
                setShowErrorModal(false);
                startVerification();
              }}
              style={styles.modalButton}
            />
            <Button
              title="Cancel"
              onPress={() => setShowErrorModal(false)}
              variant="outline"
              style={styles.modalButton}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  content: {
    padding: 16,
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  statusDescription: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 22,
    marginBottom: 20,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingLeft: 8,
  },
  requirementText: {
    fontSize: 15,
    color: '#374151',
    marginLeft: 12,
    flex: 1,
  },
  timeEstimate: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    padding: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  estimatedTime: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
    fontWeight: '500',
  },
  infoSection: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    color: '#111827',
    marginBottom: 12,
  },
  actionButton: {
    marginBottom: 12,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    marginTop: 8,
  },
  refreshText: {
    fontSize: 16,
    color: '#4639eb',
    fontWeight: '600',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    margin: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    maxWidth: 400,
    width: '90%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  modalButton: {
    minWidth: 120,
    marginVertical: 4,
  },
});

export default KYCVerificationScreen;
