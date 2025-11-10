import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Image,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { RentalService, ItemService, UserService } from '../../services/firestore';
import { useAuthContext } from '../../contexts/AuthContext';
import { Rental, Item, User } from '../../types';

type TabType = 'my-rentals' | 'my-listings';
type FilterType = 'all' | 'pending' | 'active' | 'completed' | 'cancelled';

interface EnrichedRental extends Rental {
  item: Item;
  otherUser: User; // The other party (renter for owners, owner for renters)
}

const RentalDashboard: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuthContext();

  const [activeTab, setActiveTab] = useState<TabType>('my-rentals');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [rentals, setRentals] = useState<EnrichedRental[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user) {
      loadRentals();
    }
  }, [user, activeTab, activeFilter]);

  const loadRentals = async (isRefresh = false) => {
    if (!user) return;

    try {
      if (!isRefresh) setLoading(true);

      // Get rentals based on active tab
      const isOwner = activeTab === 'my-listings';
      const rentalData = await RentalService.getRentalsByUser(user.uid, isOwner);

      // Filter by status if not 'all'
      const filteredRentals = activeFilter === 'all' 
        ? rentalData 
        : rentalData.filter(rental => rental.status === activeFilter);

      // Enrich rentals with item and other user data
      const enrichedRentals = await Promise.all(
        filteredRentals.map(async (rental) => {
          const [item, otherUser] = await Promise.all([
            ItemService.getItem(rental.itemId),
            UserService.getUser(isOwner ? rental.renterId : rental.ownerId),
          ]);

          return {
            ...rental,
            item: item!,
            otherUser: otherUser!,
          };
        })
      );

      setRentals(enrichedRentals);
    } catch (error) {
      console.error('Error loading rentals:', error);
      Alert.alert('Error', 'Failed to load rentals');
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRentals(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#F59E0B';
      case 'approved':
        return '#3B82F6';
      case 'active':
        return '#10B981';
      case 'completed':
        return '#6B7280';
      case 'rejected':
      case 'cancelled':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'approved':
        return 'Approved';
      case 'active':
        return 'Active';
      case 'completed':
        return 'Completed';
      case 'rejected':
        return 'Rejected';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status;
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  const formatDate = (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDateRange = (rental: Rental) => {
    const start = formatDate(rental.dates.requestedStart);
    const end = formatDate(rental.dates.requestedEnd);
    return `${start} - ${end}`;
  };

  const handleRentalPress = (rental: EnrichedRental) => {
    if (activeTab === 'my-listings' && rental.status === 'pending') {
      // Navigate to approval screen for pending requests
      // navigation.navigate('RentalApproval', { rentalId: rental.id });
      console.log('Navigate to approval screen:', rental.id);
    } else {
      // Navigate to rental details screen
      // navigation.navigate('RentalDetails', { rentalId: rental.id });
      console.log('Navigate to rental details:', rental.id);
    }
  };

  const renderRentalCard = ({ item: rental }: { item: EnrichedRental }) => {
    const isOwner = activeTab === 'my-listings';
    
    return (
      <TouchableOpacity
        style={styles.rentalCard}
        onPress={() => handleRentalPress(rental)}
      >
        {/* Item Image and Basic Info */}
        <View style={styles.cardHeader}>
          <Image
            source={{
              uri: rental.item.images[0] || 'https://via.placeholder.com/60x60?text=Item',
            }}
            style={styles.itemImage}
          />
          <View style={styles.itemInfo}>
            <Text style={styles.itemTitle} numberOfLines={1}>
              {rental.item.title}
            </Text>
            <Text style={styles.dateRange}>
              {formatDateRange(rental)}
            </Text>
            <Text style={styles.duration}>
              {rental.pricing.totalDays} day{rental.pricing.totalDays !== 1 ? 's' : ''}
            </Text>
          </View>
          <View style={styles.statusContainer}>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: getStatusColor(rental.status) + '20' },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  { color: getStatusColor(rental.status) },
                ]}
              >
                {getStatusText(rental.status)}
              </Text>
            </View>
          </View>
        </View>

        {/* Other User Info */}
        <View style={styles.userSection}>
          <Image
            source={{
              uri: rental.otherUser.photoURL || 'https://via.placeholder.com/32x32?text=User',
            }}
            style={styles.userAvatar}
          />
          <View style={styles.userInfo}>
            <Text style={styles.userLabel}>
              {isOwner ? 'Renter' : 'Owner'}
            </Text>
            <Text style={styles.userName}>
              {rental.otherUser.displayName}
            </Text>
          </View>
          {rental.otherUser.verification.isVerified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={16} color="#10B981" />
            </View>
          )}
        </View>

        {/* Pricing and Actions */}
        <View style={styles.cardFooter}>
          <View style={styles.pricingInfo}>
            <Text style={styles.priceLabel}>Total</Text>
            <Text style={styles.priceValue}>
              {formatPrice(rental.pricing.total)}
            </Text>
            {isOwner && (
              <Text style={styles.earningsText}>
                Earn: {formatPrice(rental.pricing.subtotal - rental.pricing.platformFee)}
              </Text>
            )}
          </View>
          
          <View style={styles.cardActions}>
            {rental.status === 'pending' && isOwner && (
              <View style={styles.pendingActions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.rejectButton]}
                  onPress={() => console.log('Quick reject')}
                >
                  <Text style={styles.rejectButtonText}>Reject</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.approveButton]}
                  onPress={() => console.log('Quick approve')}
                >
                  <Text style={styles.approveButtonText}>Approve</Text>
                </TouchableOpacity>
              </View>
            )}
            
            {rental.status === 'approved' && (
              <TouchableOpacity style={styles.chatButton}>
                <Ionicons name="chatbubble-outline" size={16} color="#4639eb" />
                <Text style={styles.chatButtonText}>Chat</Text>
              </TouchableOpacity>
            )}
            
            {rental.status === 'active' && (
              <TouchableOpacity style={styles.trackButton}>
                <Ionicons name="location-outline" size={16} color="#10B981" />
                <Text style={styles.trackButtonText}>Track</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Quick Actions Indicator */}
        <TouchableOpacity style={styles.moreActions}>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons 
        name={activeTab === 'my-rentals' ? 'receipt-outline' : 'home-outline'} 
        size={64} 
        color="#D1D5DB" 
      />
      <Text style={styles.emptyTitle}>
        {activeTab === 'my-rentals' ? 'No Rentals Yet' : 'No Rental Requests'}
      </Text>
      <Text style={styles.emptyMessage}>
        {activeTab === 'my-rentals' 
          ? 'Start browsing items to find something to rent'
          : 'List an item to start receiving rental requests'
        }
      </Text>
      <TouchableOpacity 
        style={styles.emptyAction}
        onPress={() => {
          if (activeTab === 'my-rentals') {
            navigation.navigate('Search' as never);
          } else {
            navigation.navigate('CreateItem' as never);
          }
        }}
      >
        <Text style={styles.emptyActionText}>
          {activeTab === 'my-rentals' ? 'Browse Items' : 'List an Item'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const TabButton = ({ tab, title }: { tab: TabType; title: string }) => (
    <TouchableOpacity
      style={[
        styles.tabButton,
        activeTab === tab && styles.activeTabButton,
      ]}
      onPress={() => setActiveTab(tab)}
    >
      <Text
        style={[
          styles.tabButtonText,
          activeTab === tab && styles.activeTabButtonText,
        ]}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );

  const FilterButton = ({ filter, title }: { filter: FilterType; title: string }) => (
    <TouchableOpacity
      style={[
        styles.filterButton,
        activeFilter === filter && styles.activeFilterButton,
      ]}
      onPress={() => setActiveFilter(filter)}
    >
      <Text
        style={[
          styles.filterButtonText,
          activeFilter === filter && styles.activeFilterButtonText,
        ]}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Rentals</Text>
        <TouchableOpacity style={styles.notificationButton}>
          <Ionicons name="notifications-outline" size={24} color="#111827" />
          <View style={styles.notificationBadge} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TabButton tab="my-rentals" title="My Rentals" />
        <TabButton tab="my-listings" title="My Listings" />
      </View>

      {/* Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}
      >
        <FilterButton filter="all" title="All" />
        <FilterButton filter="pending" title="Pending" />
        <FilterButton filter="active" title="Active" />
        <FilterButton filter="completed" title="Completed" />
        <FilterButton filter="cancelled" title="Cancelled" />
      </ScrollView>

      {/* Stats Summary */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {rentals.filter(r => r.status === 'active').length}
          </Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {rentals.filter(r => r.status === 'pending').length}
          </Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {rentals.filter(r => r.status === 'completed').length}
          </Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {formatPrice(
              rentals
                .filter(r => r.status === 'completed')
                .reduce((sum, r) => sum + (activeTab === 'my-listings' 
                  ? r.pricing.subtotal - r.pricing.platformFee 
                  : r.pricing.total), 0)
            )}
          </Text>
          <Text style={styles.statLabel}>
            {activeTab === 'my-listings' ? 'Earned' : 'Spent'}
          </Text>
        </View>
      </View>

      {/* Rentals List */}
      <FlatList
        data={rentals}
        renderItem={renderRentalCard}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
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
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  notificationButton: {
    position: 'relative',
    padding: 8,
  },
  notificationBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTabButton: {
    borderBottomColor: '#4639eb',
  },
  tabButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
  },
  activeTabButtonText: {
    color: '#4639eb',
    fontWeight: '600',
  },
  filterContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filterContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  activeFilterButton: {
    backgroundColor: '#4639eb',
    borderColor: '#4639eb',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  activeFilterButtonText: {
    color: '#FFFFFF',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 16,
  },
  listContainer: {
    padding: 16,
  },
  rentalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    position: 'relative',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  dateRange: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 2,
  },
  duration: {
    fontSize: 14,
    color: '#6B7280',
  },
  statusContainer: {
    marginLeft: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  userInfo: {
    flex: 1,
  },
  userLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  userName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  verifiedBadge: {
    marginLeft: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  pricingInfo: {
    flex: 1,
  },
  priceLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  priceValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  earningsText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '500',
    marginTop: 2,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pendingActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 60,
    alignItems: 'center',
  },
  rejectButton: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  approveButton: {
    backgroundColor: '#4639eb',
  },
  rejectButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#EF4444',
  },
  approveButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F0F9FF',
    borderRadius: 16,
  },
  chatButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#4639eb',
  },
  trackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
  },
  trackButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#10B981',
  },
  moreActions: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyMessage: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  emptyAction: {
    backgroundColor: '#4639eb',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyActionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default RentalDashboard;
