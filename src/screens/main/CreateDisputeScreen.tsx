/**
 * Create Dispute Screen
 * Allows users to raise disputes on rentals
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { showAlert } from '../../contexts/ModalContext';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { raiseDispute } from '../../services/disputes';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../config/firebase';

export const CreateDisputeScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { rentalId, rental } = route.params as {
    rentalId: string;
    rental: any;
  };

  const [reason, setReason] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [evidence, setEvidence] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const categories = [
    { id: 'damage', label: '🔨 Item Damaged', description: 'Item was damaged during rental' },
    { id: 'missing', label: '📦 Parts Missing', description: 'Some parts are missing' },
    { id: 'not_returned', label: '⏰ Not Returned', description: 'Item not returned on time' },
    { id: 'condition', label: '⚠️ Poor Condition', description: 'Item in worse condition than described' },
    { id: 'other', label: '❓ Other', description: 'Other dispute reason' },
  ];

  const [focusedField, setFocusedField] = useState<string | null>(null);

  // 🔍 Debug function - TEST
  const testCloudFunction = async () => {
    console.log('🧪 Testing Cloud Function connection...');

    try {
      const testFunc = httpsCallable(functions, 'testFunction');
      const result = await testFunc({ testData: 'hello world', rentalId });
      console.log('✅ testFunction result:', result);
      alert('Cloud Function working! Check console for details.');
    } catch (error: any) {
      console.error('❌ testFunction error:', error);
      alert('Cloud Function error: ' + error.message);
    }
  };

  const handleSubmit = async () => {
    console.log('🎯 DISPUTE SUBMIT STARTED');
    console.log('🎯 Rental data:', { rentalId, rentalIdFromRoute: rentalId, rentalStatus: rental?.status });
    console.log('🎯 Selected category:', selectedCategory);
    console.log('🎯 Reason:', reason);
    console.log('🎯 Evidence count:', evidence.length);

    if (!selectedCategory) {
      showAlert('Category Required', 'Please select an issue category to continue.', [
        { text: 'OK', onPress: () => setFocusedField('category') }
      ]);
      return;
    }

    if (!reason.trim()) {
      showAlert('Description Required', 'Please provide a detailed description of the issue.', [
        { text: 'OK', onPress: () => setFocusedField('description') }
      ]);
      return;
    }

    showAlert(
      'Confirm Dispute',
      'Are you sure you want to raise a dispute? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'TEST FIRST',
          style: 'default',
          onPress: testCloudFunction,
        },
        {
          text: 'Submit',
          style: 'destructive',
          onPress: async () => {
            console.log('🚀 SUBMITTING DISPUTE');

            setLoading(true);
            try {
              const disputeReason = `[${selectedCategory}] ${reason}`;
              console.log('📋 Dispute data:', { rentalId, reason: disputeReason, evidenceCount: evidence.length });

              const result = await raiseDispute({
                rentalId,
                reason: disputeReason,
                evidence,
              });

              console.log('✅ Dispute created result:', result);

              if (result.success) {
                showAlert(
                  'Dispute Created',
                  'Your dispute has been submitted. A moderator will review it shortly.',
                  [
                    {
                      text: 'OK',
                      onPress: () => navigation.goBack(),
                    },
                  ]
                );
              }
            } catch (error: any) {
              console.error('❌ Dispute creation error:', error);
              console.error('❌ Error details:', {
                message: error?.message,
                code: error?.code,
                stack: error?.stack
              });

              showAlert(
                'Error',
                error.message || 'Failed to create dispute. Please try again.'
              );
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleAddEvidence = useCallback(async () => {
    try {
      // Request camera permissions on iOS
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showAlert(
          'Permission needed',
          'Photo access is required to add evidence',
          [{ text: 'OK' }]
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newEvidence = [...evidence, result.assets[0].uri];
        setEvidence(newEvidence);
        console.log('Added evidence:', result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      showAlert(
        'Error',
        'Failed to add photo/video. Please try again.'
      );
    }
  }, [evidence]);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Report Issue</Text>
        <Text style={styles.subtitle}>
          Please provide details about the issue with this rental
        </Text>
      </View>

      {/* Rental Info */}
      <View style={styles.rentalInfo}>
        <Text style={styles.rentalInfoLabel}>Rental ID:</Text>
        <Text style={styles.rentalInfoValue}>{rentalId.substring(0, 8)}...</Text>
      </View>

      {/* Category Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Issue Category *</Text>
        <View style={styles.categoriesContainer}>
          {categories.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.categoryCard,
                selectedCategory === category.id && styles.categoryCardSelected,
              ]}
              onPress={() => setSelectedCategory(category.id)}
            >
              <Text
                style={[
                  styles.categoryLabel,
                  selectedCategory === category.id && styles.categoryLabelSelected,
                ]}
              >
                {category.label}
              </Text>
              <Text
                style={[
                  styles.categoryDescription,
                  selectedCategory === category.id &&
                    styles.categoryDescriptionSelected,
                ]}
              >
                {category.description}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Detailed Description */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Detailed Description *</Text>
        <TextInput
          style={styles.textArea}
          placeholder="Please provide a detailed description of the issue..."
          placeholderTextColor="#999"
          multiline
          numberOfLines={6}
          value={reason}
          onChangeText={setReason}
          textAlignVertical="top"
        />
        <Text style={styles.charCount}>{reason.length} / 500 characters</Text>
      </View>

      {/* Evidence Upload */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Evidence (Optional)</Text>
        <Text style={styles.sectionSubtitle}>
          Upload photos or videos to support your claim
        </Text>

        {evidence.length > 0 && (
          <View style={styles.evidenceGrid}>
            {evidence.map((uri, index) => (
              <View key={index} style={styles.evidenceItem}>
                <Image source={{ uri }} style={styles.evidenceImage} />
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() =>
                    setEvidence(evidence.filter((_, i) => i !== index))
                  }
                >
                  <Text style={styles.removeButtonText}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={styles.addEvidenceButton}
          onPress={handleAddEvidence}
        >
          <Text style={styles.addEvidenceButtonText}>
            📷 Add Photos/Videos
          </Text>
        </TouchableOpacity>
      </View>

      {/* Warning */}
      <View style={styles.warningContainer}>
        <Text style={styles.warningIcon}>⚠️</Text>
        <Text style={styles.warningText}>
          False claims may result in account suspension. Please ensure all
          information is accurate.
        </Text>
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        style={[styles.submitButton, loading && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={styles.submitButtonText}>Submit Dispute</Text>
        )}
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

export default CreateDisputeScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#FFF',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  rentalInfo: {
    backgroundColor: '#FFF',
    padding: 16,
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rentalInfoLabel: {
    fontSize: 14,
    color: '#666',
  },
  rentalInfoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  section: {
    backgroundColor: '#FFF',
    padding: 20,
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  categoriesContainer: {
    gap: 12,
  },
  categoryCard: {
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#FFF',
  },
  categoryCardSelected: {
    borderColor: '#FF6B6B',
    backgroundColor: '#FFF5F5',
  },
  categoryLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  categoryLabelSelected: {
    color: '#FF6B6B',
  },
  categoryDescription: {
    fontSize: 12,
    color: '#666',
  },
  categoryDescriptionSelected: {
    color: '#FF5252',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
    minHeight: 120,
  },
  charCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 8,
  },
  evidenceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  evidenceItem: {
    width: 100,
    height: 100,
    position: 'relative',
  },
  evidenceImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  removeButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FF6B6B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  addEvidenceButton: {
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  addEvidenceButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  warningContainer: {
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    padding: 16,
    marginHorizontal: 20,
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  warningIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: '#E65100',
    lineHeight: 18,
  },
  submitButton: {
    backgroundColor: '#FF6B6B',
    borderRadius: 8,
    padding: 16,
    marginHorizontal: 20,
    marginTop: 20,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#FFCDD2',
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
