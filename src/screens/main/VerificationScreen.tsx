import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, useRoute } from '@react-navigation/native';
import Button from '../../components/ui/Button';
import { verificationService } from '../../services/verification';
import { useAuthContext } from '../../contexts/AuthContext';

interface VerificationScreenProps {
  route: {
    params?: {
      step?: 'id' | 'selfie';
    };
  };
}

const VerificationScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuthContext();
  const initialStep = (route.params as any)?.step || 'id';

  const [currentStep, setCurrentStep] = useState<'id' | 'selfie'>(initialStep);
  const [idDocument, setIdDocument] = useState<string | null>(null);
  const [selfiePhoto, setSelfiePhoto] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [existingVerification, setExistingVerification] = useState<any>(null);

  useEffect(() => {
    loadExistingVerification();
  }, []);

  const loadExistingVerification = async () => {
    if (!user) return;

    try {
      setLoading(true);
      // In a real app, this would load existing verification data
      // For now, we'll assume no existing verification
      setExistingVerification(null);
    } catch (error) {
      console.error('Error loading verification data:', error);
    } finally {
      setLoading(false);
    }
  };

  const requestPermissions = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Camera and photo library permissions are required to upload verification documents.',
          [{ text: 'OK' }]
        );
        return false;
      }
    }
    return true;
  };

  const pickImage = async (source: 'camera' | 'library') => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      let result;
      if (source === 'camera') {
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
        });
      }

      if (!result.canceled && result.assets?.[0]) {
        if (currentStep === 'id') {
          setIdDocument(result.assets[0].uri);
        } else {
          setSelfiePhoto(result.assets[0].uri);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to capture image. Please try again.');
    }
  };

  const handleNext = () => {
    if (currentStep === 'id' && idDocument) {
      setCurrentStep('selfie');
    }
  };

  const handleSubmit = async () => {
    if (!user || !idDocument || !selfiePhoto) return;

    try {
      setSubmitting(true);

      const submission = {
        type: 'government_id' as const,
        frontImage: idDocument,
        selfieImage: selfiePhoto,
      };

      await verificationService.submitVerification(user.uid, submission);

      Alert.alert(
        'Verification Submitted!',
        'Your verification documents have been submitted for review. You will be notified once the verification process is complete.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );

    } catch (error) {
      console.error('Error submitting verification:', error);
      Alert.alert('Error', 'Failed to submit verification. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      <View style={[styles.step, currentStep === 'id' && styles.stepActive]}>
        <Text style={[styles.stepText, currentStep === 'id' && styles.stepTextActive]}>1</Text>
      </View>
      <View style={styles.stepLine} />
      <View style={[styles.step, currentStep === 'selfie' && styles.stepActive]}>
        <Text style={[styles.stepText, currentStep === 'selfie' && styles.stepTextActive]}>2</Text>
      </View>
    </View>
  );

  const renderIdStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Upload ID Document</Text>
      <Text style={styles.stepDescription}>
        Please upload a clear photo of your government-issued ID (passport, driver's license, or national ID).
      </Text>

      <View style={styles.uploadArea}>
        {idDocument ? (
          <View style={styles.imagePreview}>
            <Image source={{ uri: idDocument }} style={styles.previewImage} />
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => setIdDocument(null)}
            >
              <Ionicons name="close-circle" size={24} color="#EF4444" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.uploadPlaceholder}>
            <Ionicons name="document" size={48} color="#D1D5DB" />
            <Text style={styles.uploadText}>No ID document uploaded</Text>
          </View>
        )}
      </View>

      <View style={styles.uploadButtons}>
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={() => pickImage('camera')}
        >
          <Ionicons name="camera" size={20} color="#4639eb" />
          <Text style={styles.uploadButtonText}>Take Photo</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.uploadButton}
          onPress={() => pickImage('library')}
        >
          <Ionicons name="images" size={20} color="#4639eb" />
          <Text style={styles.uploadButtonText}>Choose from Gallery</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.requirements}>
        <Text style={styles.requirementsTitle}>Requirements:</Text>
        <Text style={styles.requirement}>• Clear, readable text</Text>
        <Text style={styles.requirement}>• All corners visible</Text>
        <Text style={styles.requirement}>• No glare or shadows</Text>
        <Text style={styles.requirement}>• Valid, non-expired ID</Text>
      </View>
    </View>
  );

  const renderSelfieStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Take Selfie</Text>
      <Text style={styles.stepDescription}>
        Please take a clear selfie showing your face clearly. This helps us verify that you are the owner of the ID document.
      </Text>

      <View style={styles.uploadArea}>
        {selfiePhoto ? (
          <View style={styles.imagePreview}>
            <Image source={{ uri: selfiePhoto }} style={styles.previewImage} />
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => setSelfiePhoto(null)}
            >
              <Ionicons name="close-circle" size={24} color="#EF4444" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.uploadPlaceholder}>
            <Ionicons name="person" size={48} color="#D1D5DB" />
            <Text style={styles.uploadText}>No selfie uploaded</Text>
          </View>
        )}
      </View>

      <View style={styles.uploadButtons}>
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={() => pickImage('camera')}
        >
          <Ionicons name="camera" size={20} color="#4639eb" />
          <Text style={styles.uploadButtonText}>Take Selfie</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.requirements}>
        <Text style={styles.requirementsTitle}>Requirements:</Text>
        <Text style={styles.requirement}>• Face clearly visible</Text>
        <Text style={styles.requirement}>• Good lighting</Text>
        <Text style={styles.requirement}>• No sunglasses or hats</Text>
        <Text style={styles.requirement}>• Neutral background</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.loadingText}>Loading verification...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Identity Verification</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Progress Indicator */}
        {renderStepIndicator()}

        {/* Step Content */}
        {currentStep === 'id' ? renderIdStep() : renderSelfieStep()}

        {/* Privacy Notice */}
        <View style={styles.privacyNotice}>
          <Ionicons name="shield-checkmark" size={20} color="#10B981" />
          <Text style={styles.privacyText}>
            Your documents are encrypted and securely stored. We only use this information to verify your identity and will never share it with third parties.
          </Text>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        {currentStep === 'id' ? (
          <Button
            title="Next: Take Selfie"
            onPress={handleNext}
            disabled={!idDocument}
            style={styles.nextButton}
          />
        ) : (
          <View style={styles.finalButtons}>
            <Button
              title="Back"
              onPress={() => setCurrentStep('id')}
              variant="outline"
              style={styles.backButton}
            />
            <Button
              title="Submit for Review"
              onPress={handleSubmit}
              loading={submitting}
              disabled={submitting || !idDocument || !selfiePhoto}
              style={styles.submitButton}
            />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    backgroundColor: '#FFFFFF',
    marginTop: 8,
  },
  step: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  stepActive: {
    backgroundColor: '#4639eb',
    borderColor: '#4639eb',
  },
  stepText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  stepTextActive: {
    color: '#FFFFFF',
  },
  stepLine: {
    width: 60,
    height: 2,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 12,
  },
  stepContent: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginTop: 8,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 16,
    color: '#6B7280',
    lineHeight: 24,
    marginBottom: 24,
  },
  uploadArea: {
    height: 200,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#FAFAFA',
  },
  uploadPlaceholder: {
    alignItems: 'center',
  },
  uploadText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 8,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
    resizeMode: 'cover',
  },
  removeButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  uploadButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  uploadButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E7FF',
    gap: 8,
  },
  uploadButtonText: {
    fontSize: 14,
    color: '#4639eb',
    fontWeight: '500',
  },
  requirements: {
    backgroundColor: '#F0F9FF',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  requirementsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  requirement: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
    lineHeight: 20,
  },
  privacyNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginTop: 8,
    gap: 12,
  },
  privacyText: {
    flex: 1,
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  footer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  nextButton: {
    marginBottom: 0,
  },
  finalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  backButton: {
    flex: 1,
  },
  submitButton: {
    flex: 2,
  },
});

export default VerificationScreen;
