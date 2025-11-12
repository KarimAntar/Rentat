import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ReferralCode, ReferralProgram, ReferralStats } from '../../services/referrals';

interface ReferralCardProps {
  referralCode: ReferralCode;
  program: ReferralProgram;
  stats: ReferralStats;
  onShare?: () => void;
  onCopy?: () => void;
}

export const ReferralCard: React.FC<ReferralCardProps> = ({
  referralCode,
  program,
  stats,
  onShare,
  onCopy,
}) => {
  const formatReward = (reward: ReferralProgram['rewards']['referrer']) => {
    if (reward.type === 'percentage') {
      return `${reward.amount}%`;
    } else if (reward.type === 'fixed') {
      return `${(reward.amount / 100).toFixed(0)} EGP`;
    } else {
      return `${reward.amount} credits`;
    }
  };

  const getExpiryText = () => {
    if (!referralCode.expiryDate) return 'Never expires';
    const daysLeft = Math.ceil((referralCode.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysLeft <= 0) return 'Expired';
    if (daysLeft === 1) return 'Expires tomorrow';
    return `Expires in ${daysLeft} days`;
  };

  const getUsageText = () => {
    if (!referralCode.maxUsage) return `${referralCode.usageCount} used`;
    return `${referralCode.usageCount}/${referralCode.maxUsage} used`;
  };

  const handleShare = async () => {
    try {
      const message = `Join Rentat and get ${formatReward(program.rewards.referee)} off your first rental! Use my referral code: ${referralCode.code}`;
      await Share.share({
        message,
        title: 'Join Rentat with my referral',
      });
      onShare?.();
    } catch (error) {
      console.error('Error sharing referral code:', error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.programBadge}>
          <Ionicons name="gift-outline" size={16} color="#4639eb" />
          <Text style={styles.programName}>{program.name}</Text>
        </View>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>
            {referralCode.isActive ? 'Active' : 'Inactive'}
          </Text>
        </View>
      </View>

      <View style={styles.codeSection}>
        <Text style={styles.codeLabel}>Your Referral Code</Text>
        <View style={styles.codeContainer}>
          <Text style={styles.codeText}>{referralCode.code}</Text>
          <TouchableOpacity onPress={onCopy} style={styles.copyButton}>
            <Ionicons name="copy-outline" size={20} color="#4639eb" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.rewardsSection}>
        <Text style={styles.rewardsTitle}>Rewards</Text>
        <View style={styles.rewardRow}>
          <View style={styles.rewardItem}>
            <Text style={styles.rewardLabel}>You Earn</Text>
            <Text style={styles.rewardValue}>
              {formatReward(program.rewards.referrer)}
            </Text>
            <Text style={styles.rewardDescription}>
              {program.rewards.referrer.description}
            </Text>
          </View>
          <View style={styles.rewardDivider} />
          <View style={styles.rewardItem}>
            <Text style={styles.rewardLabel}>Friend Gets</Text>
            <Text style={styles.rewardValue}>
              {formatReward(program.rewards.referee)}
            </Text>
            <Text style={styles.rewardDescription}>
              {program.rewards.referee.description}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.statsSection}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.totalReferrals}</Text>
          <Text style={styles.statLabel}>Friends Referred</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{(stats.totalRewardsEarned / 100).toFixed(0)} EGP</Text>
          <Text style={styles.statLabel}>Total Earned</Text>
        </View>
      </View>

      <View style={styles.expirySection}>
        <Ionicons name="time-outline" size={16} color="#6B7280" />
        <Text style={styles.expiryText}>{getExpiryText()}</Text>
      </View>

      <View style={styles.actionsSection}>
        <TouchableOpacity onPress={handleShare} style={styles.shareButton}>
          <Ionicons name="share-social-outline" size={20} color="#FFFFFF" />
          <Text style={styles.shareButtonText}>Share Code</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  programBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  programName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4639eb',
    marginLeft: 4,
  },
  statusBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#166534',
  },
  codeSection: {
    marginBottom: 20,
  },
  codeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  codeText: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    letterSpacing: 1,
  },
  copyButton: {
    padding: 4,
  },
  rewardsSection: {
    marginBottom: 20,
  },
  rewardsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  rewardRow: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 16,
  },
  rewardItem: {
    flex: 1,
    alignItems: 'center',
  },
  rewardLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  rewardValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#059669',
    marginBottom: 4,
  },
  rewardDescription: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 14,
  },
  rewardDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 16,
  },
  statsSection: {
    flexDirection: 'row',
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4639eb',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#C7D2FE',
    marginHorizontal: 16,
  },
  expirySection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  expiryText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
  },
  actionsSection: {
    alignItems: 'center',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4639eb',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  shareButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default ReferralCard;
