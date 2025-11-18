import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../types';
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db, collections } from '../../config/firebase';
import { User, Item, Review } from '../../types';
import { reviewService } from '../../services/reviews';
import { diditKycService } from '../../services/diditKyc';

type PublicProfileScreenRouteProp = RouteProp<RootStackParamList, 'PublicProfile'>;
type NavigationProp = StackNavigationProp<RootStackParamList>;

const PublicProfileScreen: React.FC = () => {
  const route = useRoute<PublicProfileScreenRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { userId } = route.params;

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const [stats, setStats] = useState({
    totalListings: 0,
    activeListings: 0,
    totalRentalsAsOwner: 0,
    totalRentalsAsRenter: 0,
    completionRate: 0,
    responseTime: 'N/A',
  });
  const [reviews, setReviews] = useState<Review[]>([]);
  const [activeTab, setActiveTab] = useState<'owner' | 'renter'>('owner');
  const [reviewsLoading, setReviewsLoading] = useState(false);

  useEffect(() => {
    loadUserProfile();
    loadUserStats();
    loadReviews();
  }, [userId]);

  useEffect(() => {
    loadReviews();
  }, [activeTab]);

  const loadUserProfile = async () => {
    try {
      setLoading(true);
      const userDoc = await getDoc(doc(db, collections.users, userId));
      
      if (userDoc.exists()) {
        const userData = {
          id: userDoc.id,
          ...userDoc.data(),
          createdAt: userDoc.data().createdAt?.toDate(),
          updatedAt: userDoc.data().updatedAt?.toDate(),
        } as User;
        
        setUser(userData);

        // Check verification status
        const verified = await diditKycService.isUserKycVerified(userId);
        setIsVerified(verified);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserStats = async () => {
    try {
      // Get total listings
      const listingsQuery = query(
        collection(db, collections.items),
        where('ownerId', '==', userId)
      );
      const listingsSnapshot = await getDocs(listingsQuery);
      const totalListings = listingsSnapshot.size;
      
      // Get active listings
      const activeListings = listingsSnapshot.docs.filter(
        doc => doc.data().status === 'active'
      ).length;

      // Get rentals as owner
      const ownerRentalsQuery = query(
        collection(db, collections.rentals),
        where('ownerId', '==', userId)
      );
      const ownerRentalsSnapshot = await getDocs(ownerRentalsQuery);
      const totalRentalsAsOwner = ownerRentalsSnapshot.size;

      // Get rentals as renter
      const renterRentalsQuery = query(
        collection(db, collections.rentals),
        where('renterId', '==', userId)
      );
      const renterRentalsSnapshot = await getDocs(renterRentalsQuery);
      const totalRentalsAsRenter = renterRentalsSnapshot.size;

      // Calculate completion rate
      const completedRentals = ownerRentalsSnapshot.docs.filter(
        doc => doc.data().status === 'completed'
      ).length;
      const completionRate = totalRentalsAsOwner > 0 
        ? (completedRentals / totalRentalsAsOwner) * 100 
        : 0;

      setStats({
        totalListings,
        activeListings,
        totalRentalsAsOwner,
        totalRentalsAsRenter,
        completionRate: Math.round(completionRate),
        responseTime: 'Within hours', // TODO: Calculate actual response time
      });
    } catch (error) {
      console.error('Error loading user stats:', error);
    }
  };

  const loadReviews = async () => {
    try {
      setReviewsLoading(true);
      const reviewType = activeTab === 'owner' ? 'renter-to-owner' : 'owner-to-renter';
      const { reviews: userReviews } = await reviewService.getUserReviews(
        userId,
        reviewType,
        { limit: 10 }
      );
      setReviews(userReviews);
    } catch (error) {
      console.error('Error loading reviews:', error);
    } finally {
      setReviewsLoading(false);
    }
  };

  const renderStarRating = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Ionicons
          key={i}
          name={i <= rating ? 'star' : i - rating < 1 ? 'star-half' : 'star-outline'}
          size={16}
          color="#FFC107"
        />
      );
    }
    return <View style={styles.starsContainer}>{stars}</View>;
  };

  const renderReviewCard = ({ item: review }: { item: Review }) => (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <View style={styles.reviewerInfo}>
          <Ionicons name="person-circle" size={40} color="#6B7280" />
          <View style={styles.reviewerDetails}>
            <Text style={styles.reviewerName}>
              {review.isAnonymous ? 'Anonymous' : 'User'}
            </Text>
            <Text style={styles.reviewDate}>
              {review.createdAt?.toLocaleDateString()}
            </Text>
          </View>
        </View>
        {renderStarRating(review.ratings.overall)}
      </View>
      
      {review.review?.title && (
        <Text style={styles.reviewTitle}>{review.review.title}</Text>
      )}
      
      {review.review?.comment && (
        <Text style={styles.reviewComment}>{review.review.comment}</Text>
      )}

      {review.response && (
        <View style={styles.responseContainer}>
          <Text style={styles.responseLabel}>Owner's response:</Text>
          <Text style={styles.responseText}>{review.response}</Text>
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4639eb" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color="#EF4444" />
          <Text style={styles.errorText}>User not found</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const displayName = user.displayName || user.email?.split('@')[0] || 'User';
  const joinDate = user.createdAt 
    ? new Date(user.createdAt).toLocaleDateString('en-US', { 
        month: 'long', 
        year: 'numeric' 
      })
    : 'Unknown';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backIconButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
        </View>

        {/* User Info */}
        <View style={styles.userInfo}>
          <View style={styles.avatarContainer}>
            {user.photoURL ? (
              <Image source={{ uri: user.photoURL }} style={styles.avatar} />
            ) : (
              <View style={styles.avatar}>
                <Ionicons name="person" size={48} color="#6B7280" />
              </View>
            )}
            {isVerified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={32} color="#0EA5E9" />
              </View>
            )}
          </View>

          <Text style={styles.userName}>{displayName}</Text>
          
          {isVerified && (
            <View style={styles.verifiedLabel}>
              <Ionicons name="shield-checkmark" size={16} color="#10B981" />
              <Text style={styles.verifiedText}>Identity Verified</Text>
            </View>
          )}

          <Text style={styles.joinDate}>Joined {joinDate}</Text>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.activeListings}</Text>
            <Text style={styles.statLabel}>Active Listings</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.totalRentalsAsOwner}</Text>
            <Text style={styles.statLabel}>Rentals</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.completionRate}%</Text>
            <Text style={styles.statLabel}>Completion</Text>
          </View>
        </View>

        {/* Ratings */}
        <View style={styles.ratingsSection}>
          <Text style={styles.sectionTitle}>Ratings</Text>
          
          <View style={styles.ratingCard}>
            <View style={styles.ratingRow}>
              <Text style={styles.ratingLabel}>As Owner</Text>
              <View style={styles.ratingValue}>
                <Ionicons name="star" size={20} color="#FFC107" />
                <Text style={styles.ratingNumber}>
                  {user.ratings?.asOwner?.average?.toFixed(1) || 'N/A'}
                </Text>
                <Text style={styles.ratingCount}>
                  ({user.ratings?.asOwner?.count || 0} reviews)
                </Text>
              </View>
            </View>

            <View style={styles.ratingRow}>
              <Text style={styles.ratingLabel}>As Renter</Text>
              <View style={styles.ratingValue}>
                <Ionicons name="star" size={20} color="#FFC107" />
                <Text style={styles.ratingNumber}>
                  {user.ratings?.asRenter?.average?.toFixed(1) || 'N/A'}
                </Text>
                <Text style={styles.ratingCount}>
                  ({user.ratings?.asRenter?.count || 0} reviews)
                </Text>
              </View>
            </View>

            <View style={styles.ratingRow}>
              <Text style={styles.ratingLabel}>Response Time</Text>
              <Text style={styles.ratingValue}>{stats.responseTime}</Text>
            </View>
          </View>
        </View>

        {/* Reviews Section */}
        <View style={styles.reviewsSection}>
          <Text style={styles.sectionTitle}>Reviews</Text>

          {/* Review Tabs */}
          <View style={styles.reviewTabs}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'owner' && styles.activeTab]}
              onPress={() => setActiveTab('owner')}
            >
              <Text
                style={[styles.tabText, activeTab === 'owner' && styles.activeTabText]}
              >
                As Owner ({user.ratings?.asOwner?.count || 0})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'renter' && styles.activeTab]}
              onPress={() => setActiveTab('renter')}
            >
              <Text
                style={[styles.tabText, activeTab === 'renter' && styles.activeTabText]}
              >
                As Renter ({user.ratings?.asRenter?.count || 0})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Reviews List */}
          {reviewsLoading ? (
            <View style={styles.reviewsLoading}>
              <ActivityIndicator size="small" color="#4639eb" />
            </View>
          ) : reviews.length > 0 ? (
            <FlatList
              data={reviews}
              renderItem={renderReviewCard}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              contentContainerStyle={styles.reviewsList}
            />
          ) : (
            <View style={styles.noReviews}>
              <Ionicons name="chatbox-outline" size={48} color="#D1D5DB" />
              <Text style={styles.noReviewsText}>No reviews yet</Text>
            </View>
          )}
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#EF4444',
    marginTop: 16,
  },
  backButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#4639eb',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backIconButton: {
    padding: 8,
  },
  userInfo: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 2,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  verifiedLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  verifiedText: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '500',
  },
  joinDate: {
    fontSize: 14,
    color: '#6B7280',
  },
  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4639eb',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  ratingsSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  ratingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  ratingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  ratingLabel: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  ratingValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ratingNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  ratingCount: {
    fontSize: 14,
    color: '#6B7280',
  },
  reviewsSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  reviewTabs: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeTab: {
    backgroundColor: '#4639eb',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  reviewsLoading: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  reviewsList: {
    gap: 12,
  },
  reviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  reviewerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reviewerDetails: {
    flex: 1,
  },
  reviewerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  reviewDate: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  reviewComment: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  responseContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#4639eb',
  },
  responseLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4639eb',
    marginBottom: 4,
  },
  responseText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 18,
  },
  noReviews: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  noReviewsText: {
    fontSize: 16,
    color: '#9CA3AF',
    marginTop: 12,
  },
});

export default PublicProfileScreen;
