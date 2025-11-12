import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Clipboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '../../contexts/AuthContext';
import { ReferralCard } from '../../components/ui/ReferralCard';
import Button from '../../components/ui/Button';
import { referralService, ReferralCode, ReferralProgram, ReferralStats } from '../../services/referrals';

const ReferralScreen: React.FC = () => {
  const { user } = useAuthContext();
  const [referralCodes, setReferralCodes] = useState<ReferralCode[]>([]);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [programs, setPrograms] = useState<ReferralProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingCode, setGeneratingCode] = useState(false);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Load referral codes
      const codes = await referralService.getUserReferralCodes(user.uid);
      setReferralCodes(codes);

      // Load stats
      const userStats = await referralService.getUserReferralStats(user.uid);
      setStats(userStats);

      // Load programs
      const activePrograms = referralService.getActivePrograms();
      setPrograms(activePrograms);
    } catch (error) {
      console.error('Error loading referral data:', error);
      Alert.alert('Error', 'Failed to load referral data');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateCode = async (programId: string = 'standard') => {
    if (!user) return;

    setGeneratingCode(true);
    try {
      const newCode = await referralService.generateReferralCode(user.uid, programId);
      setReferralCodes(prev => [newCode, ...prev]);
      Alert.alert('Success', 'New referral code generated!');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to generate referral code');
    } finally {
      setGeneratingCode(false);
    }
  };

  const handleCopyCode = async (code: string) => {
    try {
      await Clipboard.setString(code);
      Alert.alert('Copied!', 'Referral code copied to clipboard');
    } catch (error) {
      console.error('Error copying code:', error);
    }
  };

  const handleShareCode = () => {
    Alert.alert('Shared!', 'Referral code shared successfully');
  };

  const getProgramForCode = (code: ReferralCode): ReferralProgram | undefined => {
    return programs.find(program => program.id === code.programId);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4639eb" />
          <Text style={styles.loadingText}>Loading referral data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Ionicons name="gift-outline" size={32} color="#4639eb" />
            <Text style={styles.headerTitle}>Earn Rewards</Text>
            <Text style={styles.headerSubtitle}>
              Share your referral code and earn money when friends join Rentat
            </Text>
          </View>
        </View>

        {/* Stats Overview */}
        {stats && (
          <View style={styles.statsContainer}>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.totalReferrals}</Text>
                <Text style={styles.statLabel}>Total Referrals</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.qualifiedReferrals}</Text>
                <Text style={styles.statLabel}>Qualified</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{(stats.totalRewardsEarned / 100).toFixed(0)} EGP</Text>
                <Text style={styles.statLabel}>Earned</Text>
              </View>
            </View>

            {stats.currentTier > 0 && (
              <View style={styles.tierInfo}>
                <Ionicons name="trophy-outline" size={20} color="#F59E0B" />
                <Text style={styles.tierText}>
                  VIP Tier {stats.currentTier} - {stats.currentTier * 10}% bonus rewards
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Generate New Code */}
        <View style={styles.generateSection}>
          <Text style={styles.sectionTitle}>Your Referral Codes</Text>
          {referralCodes.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="gift-outline" size={64} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>No referral codes yet</Text>
              <Text style={styles.emptyText}>
                Generate your first referral code to start earning rewards
              </Text>
            </View>
          )}

          {referralCodes.length > 0 && referralCodes.length < 3 && (
            <View style={styles.generatePrompt}>
              <Text style={styles.generateText}>
                Want to earn more? Create additional referral codes for different programs
              </Text>
            </View>
          )}
        </View>

        {/* Active Referral Code */}
        {referralCodes.length > 0 && (() => {
          const activeCode = referralCodes.find(code => code.isActive) || referralCodes[0];
          const program = getProgramForCode(activeCode);
          if (!program || !stats) return null;

          return (
            <ReferralCard
              key={activeCode.id}
              referralCode={activeCode}
              program={program}
              stats={stats}
              onShare={handleShareCode}
              onCopy={() => handleCopyCode(activeCode.code)}
            />
          );
        })()}

        {/* Generate Button */}
        {referralCodes.length < 3 && (
          <View style={styles.generateButtonContainer}>
            <Button
              title={generatingCode ? "Generating..." : "Generate New Code"}
              onPress={() => handleGenerateCode()}
              loading={generatingCode}
              style={styles.generateButton}
            />
          </View>
        )}

        {/* How It Works */}
        <View style={styles.howItWorksSection}>
          <Text style={styles.sectionTitle}>How It Works</Text>

          <View style={styles.stepContainer}>
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Share Your Code</Text>
                <Text style={styles.stepDescription}>
                  Share your unique referral code with friends via social media or messaging
                </Text>
              </View>
            </View>

            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Friend Signs Up</Text>
                <Text style={styles.stepDescription}>
                  Your friend creates an account and enters your referral code
                </Text>
              </View>
            </View>

            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Complete First Rental</Text>
                <Text style={styles.stepDescription}>
                  Your friend completes their first rental on the platform
                </Text>
              </View>
            </View>

            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>4</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Earn Rewards</Text>
                <Text style={styles.stepDescription}>
                  Both you and your friend receive rewards in your wallets
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Terms */}
        <View style={styles.termsSection}>
          <Text style={styles.termsTitle}>Terms & Conditions</Text>
          <Text style={styles.termsText}>
            • Referral codes are valid for 90 days{'\n'}
            • Only new users can use referral codes{'\n'}
            • Rewards are granted after friend's first completed rental{'\n'}
            • Maximum 50 referrals per user{'\n'}
            • Program terms may change at any time
          </Text>
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
  scrollContainer: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerContent: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 12,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  statsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statsGrid: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4639eb',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  tierInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
  },
  tierText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
    marginLeft: 8,
  },
  generateSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  generatePrompt: {
    backgroundColor: '#EEF2FF',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  generateText: {
    fontSize: 14,
    color: '#4639eb',
    textAlign: 'center',
  },
  generateButtonContainer: {
    marginVertical: 24,
  },
  generateButton: {
    marginHorizontal: 20,
  },
  howItWorksSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  stepContainer: {
    marginTop: 16,
  },
  step: {
    flexDirection: 'row',
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4639eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  stepNumberText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  termsSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  termsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  termsText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 22,
  },
});

export default ReferralScreen;
