import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuthContext } from '../../contexts/AuthContext';
import { RentalService } from '../../services/firestore';
import { Rental } from '../../types';

const RentalHistoryScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuthContext();
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'as-owner' | 'as-renter' | 'all'>('as-renter');

  useEffect(() => {
    loadRentals();
  }, [user, activeTab]);

  const loadRentals = async () => {
    if (!user) return;

    try {
      setLoading(true);
      let rentalData: Rental[] = [];

      if (activeTab === 'as-owner') {
        rentalData = await RentalService.getRentalsByUser(user.uid, true);
      } else if (activeTab === 'as-renter') {
        rentalData = await RentalService.getRentalsByUser(user.uid, false);
      } else {
        // Get both as owner and as renter, then combine and sort
        const asOwner = await RentalService.getRentalsByUser(user.uid, true);
        const asRenter = await RentalService.getRentalsByUser(user.uid, false);
        rentalData = [...asOwner, ...asRenter].sort((a, b) =>
          b.createdAt.getTime() - a.createdAt.getTime()
        );
      }

      setRentals(rentalData);
    } catch (error) {
      console.error('Error loading rental history:', error);
      Alert.alert('Error', 'Failed to load rental history');
    } finally {
      setLoading(false);
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

  const getRoleText = (rental: Rental) => {
    if (!user) return '';
    return rental.ownerId === user.uid ? 'Owner' : 'Renter';
  };

  const getOtherPartyName = (rental: Rental) => {
    if (!user) return '';
    // This would need to be populated from the rental data or fetched separately
    return rental.ownerId === user.uid ? 'Renter' : 'Owner';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4639eb" />
          <Text style={styles.loadingText}>Loading rental history...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rental History</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'as-renter' && styles.tabActive]}
          onPress={() => setActiveTab('as-renter')}
        >
          <Text style={[styles.tabText, activeTab === 'as-renter' && styles.tabTextActive]}>
            As Renter ({rentals.filter(r => r.renterId === user?.uid).length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'as-owner' && styles.tabActive]}
          onPress={() => setActiveTab('as-owner')}
        >
          <Text style={[styles.tabText, activeTab === 'as-owner' && styles.tabTextActive]}>
            As Owner ({rentals.filter(r => r.ownerId === user?.uid).length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'all' && styles.tabActive]}
          onPress={() => setActiveTab('all')}
        >
          <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>
            All ({rentals.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Rentals List */}
      <ScrollView style={styles.content}>
        {rentals.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="time-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>
              {activeTab === 'as-renter' ? 'No rentals as renter' :
               activeTab === 'as-owner' ? 'No rentals as owner' :
               'No rental history yet'}
            </Text>
            <Text style={styles.emptyText}>
              {activeTab === 'as-renter' ? 'Your rental history as a renter will appear here' :
               activeTab === 'as-owner' ? 'Your rental history as an owner will appear here' :
               'Your rental history will appear here'}
            </Text>
          </View>
        ) : (
          rentals.map((rental) => (
            <View key={rental.id} style={styles.rentalCard}>
              <View style={styles.rentalHeader}>
                <View style={styles.rentalInfo}>
                  <Text style={styles.itemTitle}>
                    Item
                  </Text>
                  <Text style={styles.roleText}>
                    {getRoleText(rental)} • {getOtherPartyName(rental)}
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
                    style={styles.actionButton}
                    onPress={() => {
                      const reviewType = rental.ownerId === user?.uid ? 'owner-to-renter' : 'renter-to-owner';
                      (navigation as any).navigate('Review', {
                        rentalId: rental.id,
                        reviewType,
                      });
                    }}
                  >
                    <Ionicons name="star-outline" size={16} color="#4639eb" />
                    <Text style={styles.actionButtonText}>Leave Review</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionButton}>
                    <Ionicons name="chatbubble-outline" size={16} color="#4639eb" />
                    <Text style={styles.actionButtonText}>Contact</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionButton}>
                    <Ionicons name="receipt-outline" size={16} color="#4639eb" />
                    <Text style={styles.actionButtonText}>Receipt</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 16,
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
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#4639eb',
  },
  tabText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#4639eb',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 64,
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
    maxWidth: 280,
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
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  roleText: {
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
  rentalDetails: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
  },
  rentalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 4,
  },
  actionButtonText: {
    fontSize: 14,
    color: '#4639eb',
    fontWeight: '500',
  },
});

export default RentalHistoryScreen;
