import { showAlert } from '../../contexts/ModalContext';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { StorageService } from '../../services/storage';

interface DamageReportModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (report: {
    hasDamage: boolean;
    description: string;
    images: string[];
    deductionAmount: number;
  }) => Promise<void>;
  securityDeposit: number;
  currency: string;
}

export default function DamageReportModal({
  visible,
  onClose,
  onSubmit,
  securityDeposit,
  currency,
}: DamageReportModalProps) {
  const [hasDamage, setHasDamage] = useState(false);
  const [description, setDescription] = useState('');
  const [deductionAmount, setDeductionAmount] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        showAlert('Permission Required', 'Please grant camera roll permissions to upload images');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 5 - images.length,
      });

      if (!result.canceled && result.assets) {
        setUploading(true);
        const newImages: string[] = [];

        for (const asset of result.assets) {
          try {
            const result = await StorageService.uploadImage(asset.uri, 'damage-reports');
            newImages.push(result.url);
          } catch (error) {
            console.error('Error uploading image:', error);
          }
        }

        setImages([...images, ...newImages]);
        setUploading(false);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      setUploading(false);
      showAlert('Error', 'Failed to pick image');
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    // Validate inputs
    if (hasDamage) {
      if (!description.trim()) {
        showAlert('Error', 'Please provide a damage description');
        return;
      }

      const amount = parseFloat(deductionAmount);
      if (isNaN(amount) || amount < 0) {
        showAlert('Error', 'Please enter a valid deduction amount');
        return;
      }

      if (amount > securityDeposit) {
        showAlert('Error', `Deduction amount cannot exceed the security deposit (${currency} ${securityDeposit})`);
        return;
      }

      if (images.length === 0) {
        showAlert('Error', 'Please upload at least one image of the damage');
        return;
      }
    }

    try {
      setSubmitting(true);
      await onSubmit({
        hasDamage,
        description: description.trim(),
        images,
        deductionAmount: hasDamage ? parseFloat(deductionAmount) : 0,
      });
      
      // Reset form
      setHasDamage(false);
      setDescription('');
      setDeductionAmount('');
      setImages([]);
      onClose();
    } catch (error) {
      console.error('Error submitting damage report:', error);
      showAlert('Error', 'Failed to submit damage report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Item Return Confirmation</Text>
            <TouchableOpacity onPress={onClose} disabled={submitting}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Damage Status Selection */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Item Condition</Text>
              
              <TouchableOpacity
                style={[styles.optionCard, !hasDamage && styles.selectedOption]}
                onPress={() => setHasDamage(false)}
                disabled={submitting}
              >
                <View style={styles.optionHeader}>
                  <Ionicons 
                    name={!hasDamage ? "radio-button-on" : "radio-button-off"} 
                    size={24} 
                    color={!hasDamage ? "#4CAF50" : "#999"} 
                  />
                  <Text style={[styles.optionTitle, !hasDamage && styles.selectedOptionText]}>
                    No Damage
                  </Text>
                </View>
                <Text style={styles.optionDescription}>
                  Item returned in good condition. Full deposit will be refunded.
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.optionCard, hasDamage && styles.selectedOption]}
                onPress={() => setHasDamage(true)}
                disabled={submitting}
              >
                <View style={styles.optionHeader}>
                  <Ionicons 
                    name={hasDamage ? "radio-button-on" : "radio-button-off"} 
                    size={24} 
                    color={hasDamage ? "#FF5722" : "#999"} 
                  />
                  <Text style={[styles.optionTitle, hasDamage && styles.selectedOptionText]}>
                    Damage Reported
                  </Text>
                </View>
                <Text style={styles.optionDescription}>
                  Item has damage. Specify details and deduction amount.
                </Text>
              </TouchableOpacity>
            </View>

            {/* Damage Details (only if damage reported) */}
            {hasDamage && (
              <>
                {/* Description */}
                <View style={styles.section}>
                  <Text style={styles.label}>Damage Description *</Text>
                  <TextInput
                    style={styles.textArea}
                    placeholder="Describe the damage in detail..."
                    multiline
                    numberOfLines={4}
                    value={description}
                    onChangeText={setDescription}
                    editable={!submitting}
                  />
                </View>

                {/* Deduction Amount */}
                <View style={styles.section}>
                  <Text style={styles.label}>Deduction Amount *</Text>
                  <View style={styles.inputContainer}>
                    <Text style={styles.currencySymbol}>{currency}</Text>
                    <TextInput
                      style={styles.amountInput}
                      placeholder="0.00"
                      keyboardType="decimal-pad"
                      value={deductionAmount}
                      onChangeText={setDeductionAmount}
                      editable={!submitting}
                    />
                  </View>
                  <Text style={styles.hint}>
                    Maximum: {currency} {securityDeposit} (Security Deposit)
                  </Text>
                </View>

                {/* Image Upload */}
                <View style={styles.section}>
                  <Text style={styles.label}>Damage Photos *</Text>
                  
                  <View style={styles.imageGrid}>
                    {images.map((uri, index) => (
                      <View key={index} style={styles.imageContainer}>
                        <Image source={{ uri }} style={styles.image} />
                        <TouchableOpacity
                          style={styles.removeImageButton}
                          onPress={() => handleRemoveImage(index)}
                          disabled={submitting}
                        >
                          <Ionicons name="close-circle" size={24} color="#FF5722" />
                        </TouchableOpacity>
                      </View>
                    ))}

                    {images.length < 5 && (
                      <TouchableOpacity
                        style={styles.addImageButton}
                        onPress={handlePickImage}
                        disabled={uploading || submitting}
                      >
                        {uploading ? (
                          <ActivityIndicator color="#007AFF" />
                        ) : (
                          <>
                            <Ionicons name="camera" size={32} color="#007AFF" />
                            <Text style={styles.addImageText}>Add Photo</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={styles.hint}>
                    Upload up to 5 photos showing the damage
                  </Text>
                </View>
              </>
            )}

            {/* Deposit Refund Summary */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Deposit Refund Summary</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Security Deposit</Text>
                <Text style={styles.summaryValue}>{currency} {securityDeposit}</Text>
              </View>
              {hasDamage && deductionAmount && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Damage Deduction</Text>
                  <Text style={[styles.summaryValue, styles.deduction]}>
                    -{currency} {parseFloat(deductionAmount).toFixed(2)}
                  </Text>
                </View>
              )}
              <View style={[styles.summaryRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Refund to Renter</Text>
                <Text style={styles.totalValue}>
                  {currency} {(securityDeposit - (hasDamage && deductionAmount ? parseFloat(deductionAmount) : 0)).toFixed(2)}
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              disabled={submitting}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.submitButtonText}>Confirm Return</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  optionCard: {
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  selectedOption: {
    borderColor: '#007AFF',
    backgroundColor: '#F0F8FF',
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 12,
  },
  selectedOptionText: {
    color: '#007AFF',
  },
  optionDescription: {
    fontSize: 14,
    color: '#666',
    marginLeft: 36,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  currencySymbol: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 12,
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  imageContainer: {
    width: 100,
    height: 100,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#FFF',
    borderRadius: 12,
  },
  addImageButton: {
    width: 100,
    height: 100,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addImageText: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 4,
  },
  summaryCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  deduction: {
    color: '#FF5722',
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  submitButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
});


