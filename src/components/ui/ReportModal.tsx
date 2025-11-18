import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ReportReason } from '../../services/moderation';

const { width } = Dimensions.get('window');

interface ReportModalProps {
  visible: boolean;
  title: string;
  message: string;
  reasons: { label: string; value: ReportReason }[];
  onSubmit: (reason: ReportReason, description: string) => void;
  onCancel: () => void;
  type?: 'item' | 'user' | 'message';
}

const ReportModal: React.FC<ReportModalProps> = ({
  visible,
  title,
  message,
  reasons,
  onSubmit,
  onCancel,
  type = 'item',
}) => {
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [description, setDescription] = useState('');
  const [step, setStep] = useState<'select' | 'describe'>('select');

  const handleReasonSelect = (reason: ReportReason) => {
    setSelectedReason(reason);
    setStep('describe');
  };

  const handleSubmit = () => {
    if (selectedReason && description.trim()) {
      onSubmit(selectedReason, description.trim());
      handleClose();
    }
  };

  const handleClose = () => {
    setSelectedReason(null);
    setDescription('');
    setStep('select');
    onCancel();
  };

  const getIconName = () => {
    switch (type) {
      case 'user':
        return 'person';
      case 'message':
        return 'chatbubble';
      default:
        return 'flag';
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={step === 'describe' ? () => setStep('select') : handleClose}>
              <Ionicons
                name={step === 'describe' ? 'arrow-back' : 'close'}
                size={24}
                color="#6B7280"
              />
            </TouchableOpacity>
            <View style={styles.headerContent}>
              <View style={styles.iconContainer}>
                <Ionicons name={getIconName()} size={24} color="#EF4444" />
              </View>
              <Text style={styles.headerTitle}>
                {step === 'select' ? 'Report' : 'Add Details'}
              </Text>
            </View>
          </View>

          {/* Content */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {step === 'select' ? (
              <View style={styles.selectStep}>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.subtitle}>{message}</Text>

                <View style={styles.reasonsContainer}>
                  {reasons.map((reason, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.reasonButton}
                      onPress={() => handleReasonSelect(reason.value)}
                    >
                      <Text style={styles.reasonText}>{reason.label}</Text>
                      <Ionicons name="chevron-forward" size={20} color="#6B7280" />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : (
              <View style={styles.describeStep}>
                <Text style={styles.title}>Why are you reporting this?</Text>
                <Text style={styles.selectedReason}>
                  Reason: {reasons.find(r => r.value === selectedReason)?.label}
                </Text>

                <Text style={styles.descriptionLabel}>
                  Please provide additional details (optional but helpful):
                </Text>

                <TextInput
                  style={styles.textInput}
                  placeholder="Describe what happened..."
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  maxLength={500}
                />

                <Text style={styles.characterCount}>
                  {description.length}/500 characters
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          {step === 'describe' && (
            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={handleClose}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.submitButton, (!description.trim()) && styles.disabledButton]}
                onPress={handleSubmit}
                disabled={!description.trim()}
              >
                <Text style={[styles.submitButtonText, (!description.trim()) && styles.disabledButtonText]}>
                  Submit Report
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: width - 40,
    maxWidth: 400,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 4,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 32,
  },
  iconContainer: {
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  selectStep: {
    flex: 1,
  },
  describeStep: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  reasonsContainer: {
    gap: 8,
  },
  reasonButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  reasonText: {
    fontSize: 16,
    color: '#111827',
    flex: 1,
  },
  selectedReason: {
    fontSize: 16,
    color: '#4639eb',
    fontWeight: '500',
    marginBottom: 16,
    textAlign: 'center',
  },
  descriptionLabel: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 12,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  characterCount: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'right',
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  submitButton: {
    backgroundColor: '#EF4444',
  },
  disabledButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  disabledButtonText: {
    color: '#9CA3AF',
  },
});

export default ReportModal;
