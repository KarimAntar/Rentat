import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { showAlert } from '../../contexts/ModalContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { useAuthContext } from '../../contexts/AuthContext';
import { RentalService, ItemService, UserService } from '../../services/firestore';
import { confirmHandoverAsRenter, confirmHandoverAsOwner } from '../../services/handover';
import { Rental, RootStackParamList } from '../../types';

type MainTabType = 'orders' | 'rentals';
type RentalsTabType = 'requests' | 'as-owner' | 'as-renter';

const OrdersScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { user } = useAuthContext();

  // All useState hooks must be called in the same order every render
  const [activeTab, setActiveTab] = useState<MainTabType>('orders');
  const [activeRentalsTab, setActiveRentalsTab] = useState<RentalsTabType>('requests');
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [modalConfirmText, setModalConfirmText] = useState('');
  const [modalCancelText, setModalCancelText] = useState('Cancel');
  const [onModalConfirm, setOnModalConfirm] = useState<(() => void) | null>(null);
  const [requests, setRequests] = useState<(Rental & { itemTitle?: string; itemImage?: string; renterName?: string })[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsFilter, setRequestsFilter] = useState<'pending' | 'approved' | 'all'>('pending');
  const [ownerRentals, setOwnerRentals] = useState<Rental[]>([]);
  const [renterRentals, setRenterRentals] = useState<Rental[]>([]);
  const [rentalsLoading, setRentalsLoading] = useState(false);
  const [orders, setOrders] = useState<(Rental & { itemTitle?: string; itemImage?: string; otherPartyName?: string })[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Modal helper function - must be after all hooks
  const showModalHandler = ({
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    onConfirm = null
  }: {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: (() => void) | null;
  }) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalConfirmText(confirmText);
    setModalCancelText(cancelText);
    setOnModalConfirm(() => onConfirm);
    setModalVisible(true);
  };

  // Load data based on active tab
  useEffect(() => {
    if (activeTab === 'orders') {
      loadOrders();
    } else if (activeTab === 'rentals') {
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
      showAlert('Error', 'Failed to load rental requests');
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
      showAlert('Error', 'Failed to load rental history');
    } finally {
      setRentalsLoading(false);
    }
  };

  const loadOrders = async () => {
    if (!user) return;

    try {
      setOrdersLoading(true);
      // Get rentals where user is owner OR renter and filter for relevant statuses
      const renterRentals = await RentalService.getRentalsByUser(user.uid, false); // false = as renter
      const ownerRentals = await RentalService.getRentalsByUser(user.uid, true); // true = as owner

      // Show ALL rentals for both renters and owners where user is involved
      // (orders should never disappear from Orders page - except completed ones)
      const activeOrders = renterRentals.filter(rental =>
        !['completed', 'rejected', 'cancelled'].includes(rental.status)
      );

      // Add ALL owner rentals that are not cancelled or rejected
      const ownerOrders = ownerRentals.filter(rental =>
        !['cancelled'].includes(rental.status) // Keep completed/rejected for history/dashboard
      );

      // Combine and deduplicate
      const allOrders = [...activeOrders, ...ownerOrders].filter((rental, index, self) =>
        index === self.findIndex((r) => r.id === rental.id)
      );

      // Enrich all orders (both active orders and handover confirmations)
      const enrichedOrders = await Promise.all(
        allOrders.map(async (order) => {
          try {
            // Get item data
            const itemDoc = await ItemService.getItem(order.itemId);
            const itemTitle = itemDoc?.title || 'Item';

            // Get other party user data
            const otherPartyId = order.ownerId === user.uid ? order.renterId : order.ownerId; // Determine who the other party is
            const otherPartyDoc = await UserService.getUser(otherPartyId);
            const otherPartyName = otherPartyDoc ?
              (otherPartyDoc.displayName || otherPartyDoc.email || 'Unknown') :
              'Unknown';

            return {
              ...order,
              itemTitle,
              otherPartyName,
              itemImage: itemDoc?.images?.[0]
            };
          } catch (err) {
            console.error('Error enriching order data:', err);
            return {
              ...order,
              itemTitle: 'Item',
              otherPartyName: 'Unknown',
              itemImage: undefined
            };
          }
        })
      );

      setOrders(enrichedOrders);
    } catch (error) {
      console.error('Error loading orders:', error);
      showAlert('Error', 'Failed to load orders');
    } finally {
      setOrdersLoading(false);
    }
  };

  const handleRequestAction = async (requestId: string, action: 'approve' | 'reject') => {
    try {
      if (action === 'approve') {
        await RentalService.approveRental(requestId);
        showAlert('Success', 'Rental request approved!');
      } else {
        await RentalService.rejectRental(requestId);
        showAlert('Success', 'Rental request rejected.');
      }
      loadRentalRequests(); // Refresh the list
    } catch (error) {
      console.error('Error updating rental request:', error);
      showAlert('Error', `Failed to ${action} rental request`);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#F59E0B';
      case 'approved': return '#10B981';
      case 'awaiting_handover': return '#8B5CF6';
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
      case 'awaiting_handover': return 'Awaiting Handover';
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

  const renderRequestCard = (request: Rental & { itemTitle?: string; itemImage?: string; renterName?: string }) => (
    <View key={request.id} style={styles.requestCard}>
      <View style={styles.requestHeader}>
        {request.itemImage && (
          <Image source={{ uri: request.itemImage }} style={styles.itemThumbnail} />
        )}
        <View style={styles.requestInfo}>
          <Text style={styles.itemTitle}>{request.itemTitle || 'Item'}</Text>
          <Text style={styles.renterName}>
            Requested by: {request.renterName || 'User'}
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

  const renderRentalCard = (rental: Rental & { itemTitle?: string; itemImage?: string; otherPartyName?: string }, isOwner: boolean) => (
    <View key={rental.id} style={styles.rentalCard}>
      <View style={styles.rentalHeader}>
        {rental.itemImage && (
          <Image source={{ uri: rental.itemImage }} style={styles.itemThumbnail} />
        )}
        <View style={styles.rentalInfo}>
          <Text style={styles.itemTitle}>
            {rental.itemTitle || 'Item'}
          </Text>
          <Text style={styles.roleText}>
            {isOwner ? 'Owner' : 'Renter'} • {rental.otherPartyName || 'Unknown User'}
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

  const renderOrdersContent = () => {
    if (ordersLoading && orders.length === 0) {
      // Show loading spinner on initial load
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4639eb" />
          <Text style={styles.loadingText}>Loading orders...</Text>
        </View>
      );
    }

    return (
      <View style={styles.content}>
        <ScrollView
          style={styles.requestsScrollView}
          contentContainerStyle={styles.requestsContent}
          refreshControl={
            <RefreshControl refreshing={ordersLoading} onRefresh={loadOrders} colors={['#4639eb']} />
          }
        >
          {orders.length === 0 ? (
            <View style={styles.emptyRequestsState}>
              <Ionicons name="document-text-outline" size={64} color="#D1D5DB" />
              <Text style={styles.emptyRequestsTitle}>
                No active orders yet
              </Text>
              <Text style={styles.emptyRequestsText}>
                Approved rental requests will appear here for payment processing
              </Text>
            </View>
          ) : (
            orders.map((order) => (
              <View key={order.id} style={styles.orderCard}>
                <View style={styles.requestHeader}>
                  {order.itemImage && (
                    <Image source={{ uri: order.itemImage }} style={styles.itemThumbnail} />
                  )}
                  <View style={styles.requestInfo}>
                    <Text style={styles.itemTitle}>{order.itemTitle || 'Item'}</Text>
                    <Text style={styles.renterName}>
                      Owner: {order.otherPartyName || 'Unknown'}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) }]}>
                    <Text style={styles.statusText}>{getStatusText(order.status)}</Text>
                  </View>
                </View>

                <View style={styles.requestDetails}>
                  <View style={styles.detailRow}>
                    <Ionicons name="calendar-outline" size={16} color="#6B7280" />
                    <Text style={styles.detailText}>
                      {formatDate(order.dates.requestedStart)} - {formatDate(order.dates.requestedEnd)}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Ionicons name="cash-outline" size={16} color="#6B7280" />
                    <Text style={styles.detailText}>
                      {formatPrice(order.pricing.total)}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Ionicons name="location-outline" size={16} color="#6B7280" />
                    <Text style={styles.detailText}>
                      {order.delivery.method === 'delivery' ? 'Delivery arranged' :
                       order.delivery.method === 'meet-in-middle' ? 'Meet in middle' :
                       'Pickup required'}
                    </Text>
                  </View>
                </View>

                <View style={styles.actions}>
                  {order.status === 'awaiting_handover' ? (
                    // Handle handover confirmation states
                    <TouchableOpacity
                      style={[styles.actionButton, styles.confirmButton, (
                        order.handover?.renterConfirmed && order.renterId === user?.uid ||
                        order.handover?.ownerConfirmed && order.ownerId === user?.uid
                      ) && styles.waitingButton]}
                      disabled={
                        order.handover?.renterConfirmed && order.renterId === user?.uid ||
                        order.handover?.ownerConfirmed && order.ownerId === user?.uid
                      }
                      onPress={async () => {
                        try {
                          console.log('Confirm handover button pressed for rental:', order.id);
                          console.log('Order status:', order.status);
                          console.log('User ID:', user?.uid);
                          console.log('Handover state:', order.handover);

                          const isRenter = order.renterId === user?.uid;
                          const result = isRenter
                            ? await confirmHandoverAsRenter(order.id)
                            : await confirmHandoverAsOwner(order.id);
                          console.log('Confirm handover result:', result);

                          if (result.success) {
                            if (result.bothConfirmed) {
                              showAlert('Success', 'Both parties confirmed - rental is now active!');
                            } else {
                              showAlert('Success', 'Handover confirmed! Waiting for the other party to confirm.');
                            }
                            loadOrders(); // Refresh the list
                          } else {
                            // Handle specific error messages
                            let errorMessage = 'Failed to confirm handover';

                            if (result.error) {
                              console.error('Handover error:', result.error);
                              if (result.error.includes('only the renter')) {
                                errorMessage = 'You are not authorized to confirm handover for this rental';
                              } else if (result.error.includes('awaiting_handover status')) {
                                errorMessage = 'Rental must be in handover confirmation status';
                              } else if (result.error.includes('already confirmed')) {
                                errorMessage = 'Handover has already been confirmed';
                              } else {
                                errorMessage = result.error;
                              }
                            }

                            showAlert('Error', errorMessage);
                          }
                        } catch (error) {
                          console.error('Error confirming handover (caught):', error);
                          showAlert('Error', 'Failed to process handover confirmation');
                        }
                      }}
                    >
                      <Text style={[styles.confirmButtonText, (
                        order.handover?.renterConfirmed && order.renterId === user?.uid ||
                        order.handover?.ownerConfirmed && order.ownerId === user?.uid
                      ) && styles.waitingButtonText]}>
                        {((order.handover?.renterConfirmed && order.renterId === user?.uid) ||
                          (order.handover?.ownerConfirmed && order.ownerId === user?.uid))
                          ? 'Waiting for Other Party' : 'Confirm Handover'}
                      </Text>
                    </TouchableOpacity>
                  ) : order.status === 'active' ? (
                    // Active rental - show return options
                    <View style={styles.actionButtonsRow}>
                      {order.renterId === user?.uid ? (
                        // Renter buttons for returning item
                        <>
                          <TouchableOpacity
                            style={[styles.actionButton, styles.returnButton]}
                            onPress={() => {
                              showModalHandler({
                                title: 'Return Item',
                                message: 'Has the item been returned to the owner?',
                                confirmText: 'Yes, Returned',
                                onConfirm: () => {
                                  // Update rental status to renter_returned
                                  // For now, just show success modal
                              console.log('Return item confirmed');
                              showModalHandler({
                                title: 'Item Returned',
                                message: 'Notified the owner that you have returned the item. They can now confirm receipt.',
                                confirmText: 'OK',
                                cancelText: '',
                                onConfirm: () => {
                                  console.log('Success modal confirmed');
                                  // Modal will close automatically
                                },
                              });
                                }
                              });
                            }}
                          >
                            <Text style={styles.returnButtonText}>Return Item</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.actionButton, styles.disputeButton]}
                            onPress={() => {
                              (navigation as any).navigate('CreateDispute', { rentalId: order.id });
                            }}
                          >
                            <Text style={styles.disputeButtonText}>Create Dispute</Text>
                          </TouchableOpacity>
                        </>
                      ) : (
                        // Owner buttons for receiving item or creating dispute
                        <>
                          <TouchableOpacity
                            style={[styles.actionButton, styles.successButton]}
                            onPress={() => {
                              showModalHandler({
                                title: 'Item Received',
                                message: 'Confirm that you have received the item back and it\'s in good condition?',
                                confirmText: 'Confirm Received',
                                onConfirm: async () => {
                                  try {
                                    // Here you would call a function to mark item received
                                    showModalHandler({
                                      title: 'Success',
                                      message: 'Item receipt confirmed. Rental will be completed.',
                                    });
                                    loadOrders();
                                  } catch (error) {
                                    showModalHandler({
                                      title: 'Error',
                                      message: 'Failed to confirm item receipt',
                                    });
                                  }
                                }
                              });
                            }}
                          >
                            <Text style={styles.successButtonText}>Item Received</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.actionButton, styles.disputeButton]}
                            onPress={() => {
                              (navigation as any).navigate('CreateDispute', { rentalId: order.id });
                            }}
                          >
                            <Text style={styles.disputeButtonText}>Create Dispute</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.actionButton, styles.payButton]}
                      onPress={() => {
                        // Navigate to payment screen for approved rentals
                        (navigation as any).navigate('RentalPayment', { rentalId: order.id });
                      }}
                    >
                      <Text style={styles.payButtonText}>Proceed to Payment</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))
          )}
        </ScrollView>
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
      return renderOrdersContent();
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

      {/* Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{modalTitle}</Text>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.modalMessage}>{modalMessage}</Text>
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.modalCancelButtonText}>{modalCancelText}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={() => {
                  if (onModalConfirm) onModalConfirm();
                  setModalVisible(false);
                }}
              >
                <Text style={styles.modalConfirmButtonText}>{modalConfirmText}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  itemThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
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
  orderCard: {
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
  waitingButton: {
    backgroundColor: '#F3F4F6',
  },
  waitingButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    flex: 1,
    gap: 8,
  },
  secondaryButton: {
    backgroundColor: '#6B7280',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  successButton: {
    backgroundColor: '#10B981',
  },
  successButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  disputeButton: {
    backgroundColor: '#EF4444',
  },
  disputeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  returnButton: {
    backgroundColor: '#3B82F6',
  },
  returnButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  payButton: {
    backgroundColor: '#4639eb',
  },
  payButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  confirmButton: {
    backgroundColor: '#8B5CF6',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 0,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  modalMessage: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
    textAlign: 'center',
  },
  modalFooter: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  modalConfirmButton: {
    flex: 1,
    backgroundColor: '#4639eb',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalConfirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default OrdersScreen;
