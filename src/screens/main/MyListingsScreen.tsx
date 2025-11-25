import { showAlert } from '../../contexts/ModalContext';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuthContext } from '../../contexts/AuthContext';
import { ItemService } from '../../services/firestore';
import { Item } from '../../types';
import TabHeader from '../../components/TabHeader';

const MyListingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuthContext();
  const [listings, setListings] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'inactive' | 'all'>('active');

  useEffect(() => {
    loadListings();
  }, [user, activeTab]);

  const loadListings = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const allListings = await ItemService.getItemsByOwner(user.uid);

      let filteredListings = allListings;
      if (activeTab === 'active') {
        filteredListings = allListings.filter(item => item.status === 'active');
      } else if (activeTab === 'inactive') {
        filteredListings = allListings.filter(item => item.status === 'inactive');
      }

      setListings(filteredListings);
    } catch (error) {
      console.error('Error loading listings:', error);
      showAlert('Error', 'Failed to load your listings');
    } finally {
      setLoading(false);
    }
  };

  const handleEditListing = (itemId: string) => {
    (navigation as any).navigate('EditItem', { itemId });
  };

  const handleToggleStatus = async (itemId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
      await ItemService.updateItem(itemId, { status: newStatus });
      loadListings(); // Refresh the list
      showAlert('Success', `Item ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
    } catch (error) {
      console.error('Error updating item status:', error);
      showAlert('Error', 'Failed to update item status');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#10B981';
      case 'inactive': return '#6B7280';
      case 'suspended': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Active';
      case 'inactive': return 'Inactive';
      case 'suspended': return 'Suspended';
      default: return status;
    }
  };

  const formatPrice = (price: number) => {
    return `EGP ${price.toLocaleString('en-US')}`;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4639eb" />
          <Text style={styles.loadingText}>Loading your listings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <TabHeader 
        showGreeting={true}
        showMessages={true}
        showNotifications={true}
        showSignOut={false}
      />

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'active' && styles.tabActive]}
          onPress={() => setActiveTab('active')}
        >
          <Text style={[styles.tabText, activeTab === 'active' && styles.tabTextActive]}>
            Active ({listings.filter(item => item.status === 'active').length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'inactive' && styles.tabActive]}
          onPress={() => setActiveTab('inactive')}
        >
          <Text style={[styles.tabText, activeTab === 'inactive' && styles.tabTextActive]}>
            Inactive ({listings.filter(item => item.status === 'inactive').length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'all' && styles.tabActive]}
          onPress={() => setActiveTab('all')}
        >
          <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>
            All ({listings.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Listings List */}
      <ScrollView style={styles.content}>
        {listings.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="list-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>
              {activeTab === 'active' ? 'No active listings' :
               activeTab === 'inactive' ? 'No inactive listings' :
               'No listings yet'}
            </Text>
            <Text style={styles.emptyText}>
              {activeTab === 'active' ? 'Your active listings will appear here' :
               activeTab === 'inactive' ? 'Your inactive listings will appear here' :
               'Start by creating your first listing'}
            </Text>
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => (navigation as any).navigate('CreateItem')}
            >
              <Text style={styles.createButtonText}>Create Listing</Text>
            </TouchableOpacity>
          </View>
        ) : (
          listings.map((item) => (
            <View key={item.id} style={styles.listingCard}>
              <View style={styles.listingHeader}>
                {item.images.length > 0 && (
                  <Image source={{ uri: item.images[0] }} style={styles.itemImage} />
                )}
                <View style={styles.itemInfo}>
                  <Text style={styles.itemTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={styles.itemPrice}>
                    {formatPrice(item.pricing.dailyRate)}/day
                  </Text>
                  <View style={styles.itemStats}>
                    <Text style={styles.statText}>
                      {item.stats.views} views
                    </Text>
                    <Text style={styles.statText}>
                      {item.stats.totalRentals} rentals
                    </Text>
                  </View>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
                  <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
                </View>
              </View>

              <View style={styles.listingActions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleEditListing(item.id)}
                >
                  <Ionicons name="pencil" size={16} color="#4639eb" />
                  <Text style={styles.actionButtonText}>Edit</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleToggleStatus(item.id, item.status)}
                >
                  <Ionicons
                    name={item.status === 'active' ? 'eye-off' : 'eye'}
                    size={16}
                    color="#4639eb"
                  />
                  <Text style={styles.actionButtonText}>
                    {item.status === 'active' ? 'Deactivate' : 'Activate'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionButton}>
                  <Ionicons name="stats-chart" size={16} color="#4639eb" />
                  <Text style={styles.actionButtonText}>Stats</Text>
                </TouchableOpacity>
              </View>
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
    marginBottom: 24,
  },
  createButton: {
    backgroundColor: '#4639eb',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  listingCard: {
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
  listingHeader: {
    flexDirection: 'row',
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
  itemPrice: {
    fontSize: 14,
    color: '#4639eb',
    fontWeight: '500',
    marginBottom: 4,
  },
  itemStats: {
    flexDirection: 'row',
    gap: 12,
  },
  statText: {
    fontSize: 12,
    color: '#6B7280',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  listingActions: {
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

export default MyListingsScreen;


