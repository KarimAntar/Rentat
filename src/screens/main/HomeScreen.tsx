import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

type RootStackParamList = {
  ItemDetails: { itemId: string };
  // Add other routes if needed
};

type NavigationProp = StackNavigationProp<RootStackParamList>;
import { useAuthContext } from '../../contexts/AuthContext';
import { useFeaturedItems, useItems } from '../../hooks/useFirestore';
import { Item } from '../../types';
import { getGovernorateById } from '../../data/governorates';
import UserGreeting from '../../components/UserGreeting';

const { width } = Dimensions.get('window');

const HomeScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { signOut } = useAuthContext();
  const { data: featuredItems, loading: featuredLoading, error: featuredError } = useFeaturedItems();

  const handleItemPress = (itemId: string) => {
    navigation.navigate('ItemDetails', { itemId });
  };

  const handleCategoryPress = (categoryId: string) => {
    // Navigate to search screen with category filter
    navigation.navigate('Search' as never);
  };

  const renderFeaturedItem = ({ item }: { item: Item }) => (
    <TouchableOpacity style={styles.featuredCard} onPress={() => handleItemPress(item.id)}>
      <Image source={{ uri: item.images?.[0] || 'https://via.placeholder.com/300x200?text=No+Image' }} style={styles.featuredImage} />
      <View style={styles.featuredOverlay}>
        <View style={styles.featuredContent}>
          <Text style={styles.featuredTitle} numberOfLines={2}>{item.title}</Text>
          <View style={styles.featuredMeta}>
            <Text style={styles.featuredPrice}>EGP {item.pricing.dailyRate}/day</Text>
            <View style={styles.featuredRating}>
              <Ionicons name="star" size={12} color="#FFD700" />
              <Text style={styles.ratingText}>{item.ratings.average.toFixed(1)}</Text>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderCategoryCard = (category: { id: string; name: string; icon: string; color: string }) => (
    <TouchableOpacity
      key={category.id}
      style={styles.categoryCard}
      onPress={() => handleCategoryPress(category.id)}
    >
      <View style={[styles.categoryIcon, { backgroundColor: category.color }]}>
        <Ionicons name={category.icon as any} size={24} color="#FFFFFF" />
      </View>
      <Text style={styles.categoryName}>{category.name}</Text>
    </TouchableOpacity>
  );

  const categories = [
    { id: 'electronics', name: 'Electronics', icon: 'phone-portrait-outline', color: '#4639eb' },
    { id: 'sports', name: 'Sports', icon: 'football-outline', color: '#10B981' },
    { id: 'tools', name: 'Tools', icon: 'hammer-outline', color: '#F59E0B' },
    { id: 'home-garden', name: 'Home & Garden', icon: 'home-outline', color: '#EF4444' },
    { id: 'vehicles', name: 'Vehicles', icon: 'car-outline', color: '#8B5CF6' },
    { id: 'party', name: 'Party Supplies', icon: 'musical-notes-outline', color: '#06B6D4' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>

        {/* Greeting Header - Simple Header Style */}
        <View style={styles.greetingHeader}>
          <View style={styles.greetingSection}>
            <UserGreeting avatarSize={56} />
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="notifications-outline" size={24} color="#6B7280" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => signOut()} style={styles.actionButton}>
              <Ionicons name="log-out-outline" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Logo and Welcome Section - Purple Background */}
        <View style={styles.logoWelcomeHeader}>
          <View style={styles.logoSection}>
            <Image
              source={require('../../../assets/logo.png')}
              style={styles.headerLogo}
              resizeMode="contain"
            />
            <Text style={styles.headerBrandText}>Rentat</Text>
          </View>

          <View style={styles.welcomeMessageSection}>
            <Text style={styles.welcomeMessage}>
              Discover amazing items to rent in your area
            </Text>
          </View>
        </View>

        {/* Quick Actions Grid */}
        <View style={styles.quickActions}>
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: '#EBF8FF' }]}
              onPress={() => navigation.navigate('Search' as never)}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#FFFFFF' }]}>
                <Ionicons name="search" size={28} color="#4639eb" />
              </View>
              <Text style={styles.actionTitle}>Browse Items</Text>
              <Text style={styles.actionSubtitle}>Find what you need</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: '#F0FDF4' }]}
              onPress={() => navigation.navigate('CreateItem' as never)}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#FFFFFF' }]}>
                <Ionicons name="add-circle" size={28} color="#10B981" />
              </View>
              <Text style={styles.actionTitle}>List Your Item</Text>
              <Text style={styles.actionSubtitle}>Earn money renting</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: '#FFFBEB' }]}
              onPress={() => navigation.navigate('Search' as never)}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#FFFFFF' }]}>
                <Ionicons name="location" size={28} color="#F59E0B" />
              </View>
              <Text style={styles.actionTitle}>Near Me</Text>
              <Text style={styles.actionSubtitle}>Local rentals</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: '#FEF2F2' }]}
              onPress={() => navigation.navigate('Search' as never)}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#FFFFFF' }]}>
                <Ionicons name="heart" size={28} color="#EF4444" />
              </View>
              <Text style={styles.actionTitle}>Favorites</Text>
              <Text style={styles.actionSubtitle}>Saved items</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Categories Section */}
        <View style={styles.categoriesCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Browse by Category</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Search' as never)}>
              <Text style={styles.seeAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.categoriesContainer}>
            {categories.map(renderCategoryCard)}
          </View>
        </View>

        {/* Featured Items */}
        <View style={styles.featuredSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Featured Rentals</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Search' as never)}>
              <Text style={styles.seeAllText}>See More</Text>
            </TouchableOpacity>
          </View>

          {featuredLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4639eb" />
              <Text style={styles.loadingText}>Finding great rentals...</Text>
            </View>
          ) : featuredError ? (
            <View style={styles.errorContainer}>
              <Ionicons name="cloud-offline-outline" size={48} color="#9CA3AF" />
              <Text style={styles.errorText}>Unable to load featured items</Text>
              <TouchableOpacity style={styles.retryButton}>
                <Text style={styles.retryText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          ) : featuredItems && featuredItems.length > 0 ? (
            <FlatList
              data={featuredItems.slice(0, 4)}
              renderItem={renderFeaturedItem}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.featuredList}
              ItemSeparatorComponent={() => <View style={{ width: 16 }} />}
            />
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="cube-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>No featured items yet</Text>
              <Text style={styles.emptySubtitle}>
                Great rental opportunities will appear here soon
              </Text>
            </View>
          )}
        </View>

        {/* Trust Indicators */}
        <View style={styles.trustSection}>
          <Text style={styles.sectionTitle}>Why Choose Rentat?</Text>
          <View style={styles.trustGrid}>
            <View style={styles.trustCard}>
              <View style={[styles.trustIcon, { backgroundColor: '#EBF4FF' }]}>
                <Ionicons name="shield-checkmark" size={24} color="#4639eb" />
              </View>
              <Text style={styles.trustTitle}>Secure Payments</Text>
              <Text style={styles.trustText}>Protected transactions</Text>
            </View>
            <View style={styles.trustCard}>
              <View style={[styles.trustIcon, { backgroundColor: '#F0FDF4' }]}>
                <Ionicons name="checkmark-circle" size={24} color="#10B981" />
              </View>
              <Text style={styles.trustTitle}>Verified Owners</Text>
              <Text style={styles.trustText}>Trusted community</Text>
            </View>
            <View style={styles.trustCard}>
              <View style={[styles.trustIcon, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="star" size={24} color="#F59E0B" />
              </View>
              <Text style={styles.trustTitle}>Quality Items</Text>
              <Text style={styles.trustText}>Well-maintained rentals</Text>
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
  scrollView: {
    flex: 1,
  },

  // Greeting Header - Simple Header Style
  greetingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    marginBottom: 20,
  },
  greetingWithAvatar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarContainer: {
    position: 'relative',
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifiedAvatar: {
    borderWidth: 2,
    borderColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  verificationBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#10B981',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  greetingTextContainer: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  kycVerifiedBadge: {
    marginLeft: 4,
  },
  greetingEmoji: {
    marginLeft: 4,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 16,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Logo and Welcome Header - Purple Background
  logoWelcomeHeader: {
    paddingVertical: 32,
    paddingHorizontal: 20,
    backgroundColor: '#e0e7ff',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },

  // New Header Design
  newHeader: {
    paddingVertical: 32,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 20,
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
  },
  greetingSection: {
    flex: 1,
  },
  greetingText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  greetingName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#4639eb',
    marginTop: 4,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLogo: {
    width: 60,
    height: 60,
    marginBottom: 8,
  },
  headerBrandText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#4639eb',
  },
  welcomeMessageSection: {
    alignItems: 'center',
  },
  welcomeMessage: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },

  // Logo Header
  logoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 32,
    height: 32,
    marginRight: 12,
  },
  logoText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#4639eb',
  },
  notificationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Welcome Section
  welcomeSection: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 8,
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  welcomeSubtitle: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 22,
  },

  // Quick Actions
  quickActions: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
    textAlign: 'center',
  },
  actionSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
  },

  // Categories Section
  categoriesSection: {
    paddingVertical: 24,
  },
  categoriesCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  seeAllText: {
    fontSize: 14,
    color: '#4639eb',
    fontWeight: '500',
  },
  categoriesContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 20,
  },
  categoryCard: {
    alignItems: 'center',
    width: 75,
  },
  categoryIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  categoryName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
    textAlign: 'center',
  },

  // Featured Items Styles
  featuredSection: {
    paddingVertical: 24,
  },
  featuredList: {
    paddingHorizontal: 20,
  },
  featuredCard: {
    width: width * 0.75,
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  featuredImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  featuredOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  featuredContent: {
    padding: 20,
  },
  featuredTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  featuredMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  featuredPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  featuredRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 14,
    color: '#FFFFFF',
    marginLeft: 4,
    fontWeight: '500',
  },

  // Loading and Error States
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 12,
    fontWeight: '500',
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#4639eb',
    borderRadius: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },

  // Trust Indicators
  trustSection: {
    paddingHorizontal: 20,
    paddingVertical: 32,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  trustGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  trustCard: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  trustIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  trustTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
    textAlign: 'center',
  },
  trustText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 16,
  },
});

export default HomeScreen;
