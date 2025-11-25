import { showAlert } from '../../contexts/ModalContext';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

const HelpSupportScreen: React.FC = () => {
  const navigation = useNavigation();

  const handleContact = (method: string) => {
    let url = '';
    switch (method) {
      case 'email':
        url = 'mailto:support@rentat.com?subject=Help Request';
        break;
      case 'phone':
        url = 'tel:+20123456789';
        break;
      case 'whatsapp':
        url = 'https://wa.me/20123456789';
        break;
    }

    if (url) {
      Linking.canOpenURL(url).then(supported => {
        if (supported) {
          Linking.openURL(url);
        } else {
          showAlert('Error', 'Unable to open the contact method');
        }
      });
    }
  };

  const faqs = [
    {
      question: 'How do I create a listing?',
      answer: 'Go to your profile, tap "My Listings", then tap the "+" button to create a new listing. Fill in the details about your item, set pricing, and upload photos.',
    },
    {
      question: 'How do I request to rent an item?',
      answer: 'Browse items, tap on one you\'re interested in, then tap "Request Rental". Select your dates and submit your request. The owner will review and approve or reject it.',
    },
    {
      question: 'How does payment work?',
      answer: 'Payments are processed securely through Paymob. You pay when the rental is approved. Funds are held until the rental is completed successfully.',
    },
    {
      question: 'What if there\'s a problem with the rental?',
      answer: 'Contact the other party through the chat. If you can\'t resolve it, contact our support team. We have dispute resolution processes in place.',
    },
    {
      question: 'How do I verify my identity?',
      answer: 'Go to Profile > Identity Verification. Follow the steps to upload your ID documents. Verification helps build trust in our community.',
    },
    {
      question: 'What are the fees?',
      answer: 'We charge a 10% platform fee on rentals. There are no listing fees. Payment processing fees may apply depending on your payment method.',
    },
  ];

  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & Support</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Contact Methods */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Us</Text>
          <Text style={styles.sectionDescription}>
            Need help? Get in touch with our support team
          </Text>

          <View style={styles.contactMethods}>
            <TouchableOpacity
              style={styles.contactMethod}
              onPress={() => handleContact('email')}
            >
              <View style={styles.contactIcon}>
                <Ionicons name="mail" size={24} color="#4639eb" />
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactTitle}>Email Support</Text>
                <Text style={styles.contactDetail}>support@rentat.com</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#6B7280" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.contactMethod}
              onPress={() => handleContact('phone')}
            >
              <View style={styles.contactIcon}>
                <Ionicons name="call" size={24} color="#4639eb" />
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactTitle}>Phone Support</Text>
                <Text style={styles.contactDetail}>+20 123 456 789</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#6B7280" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.contactMethod}
              onPress={() => handleContact('whatsapp')}
            >
              <View style={styles.contactIcon}>
                <Ionicons name="logo-whatsapp" size={24} color="#4639eb" />
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactTitle}>WhatsApp</Text>
                <Text style={styles.contactDetail}>Quick support</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>
        </View>

        {/* FAQ Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>

          {faqs.map((faq, index) => (
            <View key={index} style={styles.faqItem}>
              <TouchableOpacity
                style={styles.faqQuestion}
                onPress={() => toggleFaq(index)}
              >
                <Text style={styles.faqQuestionText}>{faq.question}</Text>
                <Ionicons
                  name={expandedFaq === index ? "chevron-up" : "chevron-down"}
                  size={20}
                  color="#6B7280"
                />
              </TouchableOpacity>

              {expandedFaq === index && (
                <View style={styles.faqAnswer}>
                  <Text style={styles.faqAnswerText}>{faq.answer}</Text>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>

          <View style={styles.quickActions}>
            <TouchableOpacity style={styles.quickAction}>
              <Ionicons name="document-text" size={24} color="#4639eb" />
              <Text style={styles.quickActionText}>Terms of Service</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickAction}>
              <Ionicons name="shield-checkmark" size={24} color="#4639eb" />
              <Text style={styles.quickActionText}>Privacy Policy</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickAction}>
              <Ionicons name="information-circle" size={24} color="#4639eb" />
              <Text style={styles.quickActionText}>Safety Guidelines</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickAction}>
              <Ionicons name="bug" size={24} color="#4639eb" />
              <Text style={styles.quickActionText}>Report a Bug</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* App Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Information</Text>

          <View style={styles.appInfo}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Version</Text>
              <Text style={styles.infoValue}>1.0.0</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Last Updated</Text>
              <Text style={styles.infoValue}>December 2025</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Platform</Text>
              <Text style={styles.infoValue}>iOS & Android</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
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
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  contactMethods: {
    gap: 8,
  },
  contactMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  contactIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contactInfo: {
    flex: 1,
  },
  contactTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  contactDetail: {
    fontSize: 14,
    color: '#6B7280',
  },
  faqItem: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    marginBottom: 8,
    overflow: 'hidden',
  },
  faqQuestion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#F9FAFB',
  },
  faqQuestionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    flex: 1,
    marginRight: 12,
  },
  faqAnswer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  faqAnswerText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flex: 1,
    minWidth: '45%',
  },
  quickActionText: {
    fontSize: 14,
    color: '#4639eb',
    fontWeight: '500',
    marginLeft: 8,
  },
  appInfo: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  infoValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
});

export default HelpSupportScreen;


