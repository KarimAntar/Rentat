import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Button from '../../components/ui/Button';

const ListItemScreen: React.FC = () => {
  const navigation = useNavigation();
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>List Your Item</Text>
          <Text style={styles.subtitle}>
            Start earning by renting out items you don't use daily
          </Text>
        </View>

        <View style={styles.steps}>
          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Add Photos</Text>
              <Text style={styles.stepDescription}>
                Take clear photos of your item from different angles
              </Text>
            </View>
          </View>

          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Describe Your Item</Text>
              <Text style={styles.stepDescription}>
                Add a title, description, and select a category
              </Text>
            </View>
          </View>

          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Set Your Price</Text>
              <Text style={styles.stepDescription}>
                Choose daily rental price and security deposit
              </Text>
            </View>
          </View>

          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>4</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Publish</Text>
              <Text style={styles.stepDescription}>
                Review and publish your listing to start earning
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.benefits}>
          <Text style={styles.benefitsTitle}>Why List on Rentat?</Text>
          <View style={styles.benefitsList}>
            <View style={styles.benefit}>
              <Ionicons name="shield-checkmark" size={20} color="#10B981" />
              <Text style={styles.benefitText}>Secure payments & deposits</Text>
            </View>
            <View style={styles.benefit}>
              <Ionicons name="people" size={20} color="#10B981" />
              <Text style={styles.benefitText}>Verified renters only</Text>
            </View>
            <View style={styles.benefit}>
              <Ionicons name="cash" size={20} color="#10B981" />
              <Text style={styles.benefitText}>Earn passive income</Text>
            </View>
            <View style={styles.benefit}>
              <Ionicons name="headset" size={20} color="#10B981" />
              <Text style={styles.benefitText}>24/7 customer support</Text>
            </View>
          </View>
        </View>

        <View style={styles.commissionCard}>
          <View style={styles.commissionHeader}>
            <Ionicons name="trending-down" size={24} color="#4639eb" />
            <Text style={styles.commissionTitle}>Lower Commission as You Grow</Text>
          </View>
          <Text style={styles.commissionSubtitle}>
            Our tiered commission system rewards active users
          </Text>
          <View style={styles.tiersList}>
            <View style={styles.tier}>
              <View style={styles.tierBadge}>
                <Text style={styles.tierBadgeText}>Bronze</Text>
              </View>
              <Text style={styles.tierRate}>10%</Text>
              <Text style={styles.tierDescription}>Starting rate</Text>
            </View>
            <View style={styles.tier}>
              <View style={[styles.tierBadge, styles.silverBadge]}>
                <Text style={styles.tierBadgeText}>Silver</Text>
              </View>
              <Text style={styles.tierRate}>8%</Text>
              <Text style={styles.tierDescription}>After 10 rentals</Text>
            </View>
            <View style={styles.tier}>
              <View style={[styles.tierBadge, styles.goldBadge]}>
                <Text style={styles.tierBadgeText}>Gold</Text>
              </View>
              <Text style={styles.tierRate}>6%</Text>
              <Text style={styles.tierDescription}>After 50 rentals</Text>
            </View>
            <View style={styles.tier}>
              <View style={[styles.tierBadge, styles.platinumBadge]}>
                <Text style={styles.tierBadgeText}>Platinum</Text>
              </View>
              <Text style={styles.tierRate}>5%</Text>
              <Text style={styles.tierDescription}>After 100 rentals</Text>
            </View>
          </View>
          <View style={styles.commissionNote}>
            <Ionicons name="information-circle" size={16} color="#6B7280" />
            <Text style={styles.commissionNoteText}>
              Commission is only charged on successful rentals
            </Text>
          </View>
        </View>

        <Button
          title="Start Listing"
          onPress={() => navigation.navigate('CreateItem' as never)}
          style={styles.startButton}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollContainer: {
    padding: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  steps: {
    marginBottom: 32,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4639eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  stepNumberText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  benefits: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 12,
    marginBottom: 24,
  },
  benefitsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  benefitsList: {
    gap: 12,
  },
  benefit: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  benefitText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 12,
    flex: 1,
  },
  startButton: {
    marginTop: 8,
  },
  commissionCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#E0E7FF',
  },
  commissionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  commissionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  commissionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  tiersList: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  tier: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
  tierBadge: {
    backgroundColor: '#CD7F32',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  silverBadge: {
    backgroundColor: '#C0C0C0',
  },
  goldBadge: {
    backgroundColor: '#FFD700',
  },
  platinumBadge: {
    backgroundColor: '#E5E4E2',
  },
  tierBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  tierRate: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4639eb',
    marginBottom: 4,
  },
  tierDescription: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
  },
  commissionNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  commissionNoteText: {
    fontSize: 12,
    color: '#6B7280',
    flex: 1,
  },
});

export default ListItemScreen;
