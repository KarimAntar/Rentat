import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { useAuthContext } from '../../contexts/AuthContext';
import { RentalService } from '../../services/firestore';
import { Rental, RootStackParamList } from '../../types';

type MainTabType = 'orders' | 'rentals';
type RentalsTabType = 'requests' | 'as-owner' | 'as-renter';

const OrdersScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { user } = useAuthContext();
  const [activeTab, setActiveTab] = useState<MainTabType>('orders');
  const [activeRentalsTab, setActiveRentalsTab] = useState<RentalsTabType>('requests');

  // Rental requests state
  const [requests, setRequests] = useState<Rental[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsFilter, setRequestsFilter] = useState<'pending' | 'approved' | 'all'>('pending');

  // Rental history state for "As Owner" and "As Renter"
  const [ownerRentals, setOwnerRentals] = useState<Rental[]>([]);
  const [renterRentals, setRenterRentals] = useState<Rental[]>([]);
  const [rentalsLoading, setRentalsLoading] = useState(false);

  // Load data based on active tab
  useEffect(() => {
    if (activeTab === 'rentals') {
      if (activeRentalsTab === 'requests') {
        loadRentalRequests();
      } else if (activeRentalsTab === 'as-owner') {
        loadRentalHistory(true); // Load owner rentals
      } else if (activeRentalsTab === 'as-renter') {
        loadRentalHistory(false); // Load renter rentals
      }
    }
  }, [activeTab, activeRentalsTab, user]);

  const loadRentalRequests = async () => {
    if (!user) return;

    try {
      setRequestsLoading(true);
      const allRequests = await RentalService.getOwnerRentalRequests(user.uid);

      let filteredRequests = allRequests;
      if (requestsFilter === 'pending') {
        filteredRequests = allRequests.filter(r => r.status === 'pending');
      } else if (requestsFilter === 'approved') {
        filteredRequests = allRequests.filter(r => ['approved', 'active', 'completed'].includes(r.status));
      }

      setRequests(filteredRequests);
    } catch (error) {
      console.error('Error loading rental requests:', error);
      Alert.alert('Error', 'Failed to load rental requests');
    } finally {
      setRequestsLoading(false);
    }
  };

  const loadRentalHistory = async (asOwner: boolean) => {
    if (!user) return;

    try {
      setRentalsLoading(true);
      const rentals = await RentalService.getRentalsByUser(user.uid, asOwner);

      if (asOwner) {
        setOwnerRentals(rentals);
      } else {
        setRenterRentals(rentals);
      }
    } catch (error) {
      console.error('Error loading rental history:', error);
      Alert.alert('Error', 'Failed to load rental history');
    } finally {
      setRentalsLoading(false);
    }
  };

  const handleRequestAction = async (requestId: string, action: 'approve' | 'reject') => {
    try {
      if (action === 'approve') {
        await RentalService.approveRental(requestId);
        Alert.alert('Success', 'Rental request approved!');
      } else {
        await RentalService.rejectRental(requestId);
        Alert.alert('Success', 'Rental request rejected.');
      }
      loadRentalRequests(); // Refresh the list
    } catch (error) {
      console.error('Error updating rental request:', error);
      Alert.alert('Error', `Failed to ${action} rental request`);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#F59E0B';
      case 'approved': return '#10B981';
      case 'active': return '#3B82F6';
      case 'completed': return '#8B5CF6';
      case 'rejected': return '#EF4444';
      case 'cancelled': return '#6B7280';
      default: return '#6B7280';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'approved': return 'Approved';
      case 'active': return 'Active';
      case 'completed': return 'Completed';
      case 'rejected': return 'Rejected';
      case 'cancelled': return 'Cancelled';
      default: return status;
    }
  };

  const formatDate = (date: any) => {
    // Handle Firestore Timestamp objects
    const dateObj = date?.toDate ? date.toDate() : date;
    if (!(dateObj instanceof Date)) return 'Invalid date';

    return dateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatPrice = (price: number) => {
    return `EGP ${price.toLocaleString('en-US')}`;
  };

  const renderRequestCard = (request: Rental) => (
    <View key={request.id} style={styles.requestCard}>
      <View style={styles.requestHeader}>
        <View style={styles.requestInfo}>
          <Text style={styles.itemTitle}>Item</Text>
          <Text style={styles.renterName}>
            Requested by: User
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(request.status) }]}>
          <Text style={styles.statusText}>{getStatusText(request.status)}</Text>
        </View>
      </View>

      <View style={styles.requestDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={16} color="#6B7280" />
          <Text style={styles.detailText}>
            {formatDate(request.dates.requestedStart)} - {formatDate(request.dates.requestedEnd)}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="cash-outline" size={16} color="#6B7280" />
          <Text style={styles.detailText}>
            {formatPrice(request.pricing.total)}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="wallet-outline" size={16} color="#10B981" />
          <Text style={[styles.detailText, styles.earningsText]}>
            You'll earn: {formatPrice((request.pricing.subtotal || 0) - (request.pricing.platformFee || 0))}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="location-outline" size={16} color="#6B7280" />
          <Text style={styles.detailText}>
            {request.delivery.method === 'delivery' ? 'Delivery requested' :
             request.delivery.method === 'meet-in-middle' ? 'Meet in middle' :
             'Pickup'}
          </Text>
        </View>
      </View>

      {request.status === 'pending' && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => handleRequestAction(request.id, 'reject')}
          >
            <Text style={styles.rejectButtonText}>Reject</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.approveButton]}
            onPress={() => handleRequestAction(request.id, 'approve')}
          >
            <Text style={styles.approveButtonText}>Approve</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderRentalCard = (rental: Rental, isOwner: boolean) => (
    <View key={rental.id} style={styles.rentalCard}>
      <View style={styles.rentalHeader}>
        <View style={styles.rentalInfo}>
          <Text style={styles.itemTitle}>
            Item
          </Text>
          <Text style={styles.roleText}>
            {isOwner ? 'Owner' : 'Renter'} • Other Party
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(rental.status) }]}>
          <Text style={styles.statusText}>{getStatusText(rental.status)}</Text>
        </View>
      </View>

      <View style={styles.rentalDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={16} color="#6B7280" />
          <Text style={styles.detailText}>
            {formatDate(rental.dates.requestedStart)} - {formatDate(rental.dates.requestedEnd)}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="cash-outline" size={16} color="#6B7280" />
          <Text style={styles.detailText}>
            {formatPrice(rental.pricing.total)}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="time-outline" size={16} color="#6B7280" />
          <Text style={styles.detailText}>
            Created {formatDate(rental.createdAt)}
          </Text>
        </View>
      </View>

      {rental.status === 'completed' && (
        <View style={styles.rentalActions}>
          <TouchableOpacity
            style={styles.rentalActionButton}
            onPress={() => {
              const reviewType = isOwner ? 'owner-to-renter' : 'renter-to-owner';
              (navigation as any).navigate('Review', {
                rentalId: rental.id,
                reviewType,
              });
            }}
          >
            <Ionicons name="star-outline" size={16} color="#4639eb" />
            <Text style={styles.rentalActionButtonText}>Leave Review</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.rentalActionButton}>
            <Ionicons name="chatbubble-outline" size={16} color="#4639eb" />
            <Text style={styles.rentalActionButtonText}>Contact</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.rentalActionButton}>
            <Ionicons name="receipt-outline" size={16} color="#4639eb" />
            <Text style={styles.rentalActionButtonText}>Receipt</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderTabBar = () => {
    const tabs: { key: MainTabType; label: string; icon: string }[] = [
      { key: 'orders', label: 'Orders', icon: 'document-text-outline' },
      { key: 'rentals', label: 'Rentals', icon: 'time-outline' },
    ];

    return (
      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.activeTab]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Ionicons
              name={tab.icon as any}
              size={18}
              color={activeTab === tab.key ? '#4639eb' : '#6B7280'}
            />
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.activeTabLabel]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderRentalsSubTabBar = () => {
    const subTabs: { key: RentalsTabType; label: string; icon: string }[] = [
      { key: 'requests', label: 'Requests', icon: 'document-text-outline' },
      { key: 'as-owner', label: 'As Owner', icon: 'business-outline' },
      { key: 'as-renter', label: 'As Renter', icon: 'person-outline' },
    ];

    return (
      <View style={styles.subTabBar}>
        {subTabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.subTab, activeRentalsTab === tab.key && styles.activeSubTab]}
            onPress={() => setActiveRentalsTab(tab.key)}
          >
            <Ionicons
              name={tab.icon as any}
              size={16}
              color={activeRentalsTab === tab.key ? '#4639eb' : '#6B7280'}
            />
            <Text style={[styles.subTabLabel, activeRentalsTab === tab.key && styles.activeSubTabLabel]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderRentalsContent = () => {
    if (activeRentalsTab === 'requests') {
      return (
        <View style={styles.content}>
          <ScrollView
            style={styles.requestsScrollView}
            contentContainerStyle={styles.requestsContent}
            refreshControl={
              <RefreshControl refreshing={requestsLoading} onRefresh={loadRentalRequests} colors={['#4639eb']} />
            }
          >
            {requests.length === 0 ? (
              <View style={styles.emptyRequestsState}>
                <Ionicons name="document-text-outline" size={64} color="#D1D5DB" />
                <Text style={styles.emptyRequestsTitle}>
                  No rental requests yet
                </Text>
                <Text style={styles.emptyRequestsText}>
                  When someone requests to rent your items, they'll appear here
                </Text>
              </View>
            ) : (
              requests.map((request) => renderRequestCard(request))
            )}
          </ScrollView>
        </View>
      );
    } else if (activeRentalsTab === 'as-owner') {
      const rentals = ownerRentals;
      return (
        <View style={styles.content}>
          <ScrollView
            style={styles.requestsScrollView}
            contentContainerStyle={styles.requestsContent}
            refreshControl={
              <RefreshControl refreshing={rentalsLoading} onRefresh={() => loadRentalHistory(true)} colors={['#4639eb']} />
            }
          >
            {rentals.length === 0 ? (
              <View style={styles.emptyRequestsState}>
                <Ionicons name="business-outline" size={64} color="#D1D5DB" />
                <Text style={styles.emptyRequestsTitle}>
                  No owner rentals yet
                </Text>
                <Text style={styles.emptyRequestsText}>
                  Your rental history as an owner will appear here
                </Text>
              </View>
            ) : (
              rentals.map((rental) => renderRentalCard(rental, true))
            )}
          </ScrollView>
        </View>
      );
    } else {
      const rentals = renterRentals;
      return (
        <View style={styles.content}>
          <ScrollView
            style={styles.requestsScrollView}
            contentContainerStyle={styles.requestsContent}
            refreshControl={
              <RefreshControl refreshing={rentalsLoading} onRefresh={() => loadRentalHistory(false)} colors={['#4639eb']} />
            }
          >
            {rentals.length === 0 ? (
              <View style={styles.emptyRequestsState}>
                <Ionicons name="person-outline" size={64} color="#D1D5DB" />
                <Text style={styles.emptyRequestsTitle}>
                  No renter rentals yet
                </Text>
                <Text style={styles.emptyRequestsText}>
                  Your rental history as a renter will appear here
                </Text>
              </View>
            ) : (
              rentals.map((rental) => renderRentalCard(rental, false))
            )}
          </ScrollView>
        </View>
      );
    }
  };

  const renderContent = () => {
    if (activeTab === 'orders') {
      return (
        <View style={styles.content}>
          <Text style={styles.title}>My Orders</Text>
          <Text style={styles.subtitle}>All your rental orders will appear here</Text>
        </View>
      );
    } else {
      return (
        <View style={styles.rentalsContainer}>
          {renderRentalsSubTabBar()}
          {renderRentalsContent()}
        </View>
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {activeTab === 'orders' ? 'Orders' : 'Rentals'}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Tab Bar */}
      {renderTabBar()}

      {/* Content */}
      {renderContent()}
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
  tabBar: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingVertical: 12,
    flexDirection: 'row',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 20,
    gap: 6,
  },
  activeTab: {
    backgroundColor: '#EEF2FF',
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  activeTabLabel: {
    color: '#4639eb',
    fontWeight: '600',
  },
  rentalsContainer: {
    flex: 1,
  },
  subTabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingVertical: 8,
  },
  subTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginHorizontal: 4,
    borderRadius: 16,
    gap: 4,
  },
  activeSubTab: {
    backgroundColor: '#F0F9FF',
  },
  subTabLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  activeSubTabLabel: {
    color: '#4639eb',
    fontWeight: '600',
  },
  requestsScrollView: {
    flex: 1,
  },
  requestsContent: {
    padding: 16,
  },
  emptyRequestsState: {
    alignItems: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  emptyRequestsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyRequestsText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  requestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  requestInfo: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  renterName: {
    fontSize: 14,
    color: '#6B7280',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  requestDetails: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#374151',
  },
  earningsText: {
    color: '#10B981',
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  rejectButton: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  rejectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#DC2626',
  },
  approveButton: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  approveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#16A34A',
  },
  rentalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  rentalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  rentalInfo: {
    flex: 1,
  },
  roleText: {
    fontSize: 14,
    color: '#6B7280',
  },
  rentalDetails: {
    marginBottom: 16,
  },
  rentalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  rentalActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 4,
  },

  rentalActionButtonText: {
    fontSize: 14,
    color: '#4639eb',
    fontWeight: '500',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#4639eb',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default OrdersScreen;
