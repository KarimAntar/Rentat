import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp, NavigationProp } from '@react-navigation/native';
import { useAuthContext } from '../../contexts/AuthContext';
import { RentalService } from '../../services/firestore';
import { Rental, RootStackParamList } from '../../types';
import { commissionService } from '../../services/commission';
import { UserService } from '../../services/firestore';

type OrderDetailsScreenRouteProp = RouteProp<RootStackParamList, 'OrderDetails'>;

interface OrderWithDetails extends Rental {
  itemTitle?: string;
  itemImage?: string;
  ownerName?: string;
  renterName?: string;
}

const OrderDetailsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<OrderDetailsScreenRouteProp>();
  const { user } = useAuthContext();

  const { rentalId } = route.params;

  const [order, setOrder] = useState<OrderWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [earningsData, setEarningsData] = useState<any>(null);

  useEffect(() => {
    loadOrderDetails();
  }, [rentalId, user]);

  const loadOrderDetails = async () => {
    if (!user) {
      setLoading(false);
      Alert.alert('Error', 'Please log in to view order details');
      navigation.goBack();
      return;
    }

    if (!rentalId) {
      setLoading(false);
      Alert.alert('Error', 'Invalid order ID');
      navigation.goBack();
      return;
    }

    try {
      setLoading(true);

      // Get the rental
      const rental = await RentalService.getRental(rentalId) as OrderWithDetails;
      if (!rental) {
        setLoading(false);
        Alert.alert('Error', 'Order not found');
        navigation.goBack();
        return;
      }

      // Check permissions - user should be either owner or renter
      if (rental.ownerId !== user.uid && rental.renterId !== user.uid) {
        setLoading(false);
        Alert.alert('Error', 'You do not have permission to view this order');
        navigation.goBack();
        return;
      }

      // Determine if current user is the owner
      setIsOwner(rental.ownerId === user.uid);

      // Fetch item details
      if (rental.itemId) {
        try {
          // Instead of making additional API calls, we'll just use the existing data
          // The itemTitle and itemImage should already be populated from the service calls
        } catch (error) {
          console.log('Could not fetch item details:', error);
        }
      }

      // Fetch user details
      try {
        const [renterData, ownerData] = await Promise.all([
          UserService.getUser(rental.renterId),
          UserService.getUser(rental.ownerId)
        ]);

        rental.renterName = renterData?.displayName || 'Renter';
        rental.ownerName = ownerData?.displayName || 'Owner';
      } catch (error) {
        console.log('Could not fetch user details:', error);
      }

      // Calculate earnings for owners
      if (isOwner && rental.status === 'completed') {
        try {
          // Calculate what the owner earned based on the pricing
          const ownerEarnings = (rental.pricing.subtotal || 0) - (rental.pricing.platformFee || 0) + (rental.completion?.damageReported?.amount || 0);
          setEarningsData({
            gross: rental.pricing.subtotal || 0,
            platformFee: rental.pricing.platformFee || 0,
            damageCompensation: rental.completion?.damageReported?.amount || 0,
            netEarnings: ownerEarnings,
            totalPaid: rental.pricing.total || 0,
            depositRefunded: (rental.completion?.refund?.amount || 0),
          });
        } catch (error) {
          console.log('Error calculating earnings:', error);
        }
      }

      setOrder(rental);
    } catch (error) {
      console.error('Error loading order details:', error);
      Alert.alert('Error', 'Failed to load order details');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: any): string => {
    try {
      if (!date) return 'N/A';
      const dateObj = date?.toDate ? date.toDate() : new Date(date);
      if (isNaN(dateObj.getTime())) return 'N/A';
      return dateObj.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch (error) {
      return 'N/A';
    }
  };

  const formatTime = (date: any): string => {
    try {
      if (!date) return '';
      const dateObj = date?.toDate ? date.toDate() : new Date(date);
      if (isNaN(dateObj.getTime())) return '';
      return dateObj.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (error) {
      return '';
    }
  };

  const getTimestampMs = (timestamp: any): number => {
    try {
      if (!timestamp) return 0;
      // Check if it's a Firestore timestamp with toMillis method
      if (timestamp.toMillis && typeof timestamp.toMillis === 'function') {
        return timestamp.toMillis();
      }
      // Check if it's already a Date object
      if (timestamp instanceof Date) {
        return timestamp.getTime();
      }
      // Convert to Date if it's a string/number
      const dateObj = new Date(timestamp);
      return isNaN(dateObj.getTime()) ? 0 : dateObj.getTime();
    } catch (error) {
      return 0;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#F59E0B';
      case 'approved': return '#3B82F6';
      case 'active': return '#10B981';
      case 'completed': return '#8B5CF6';
      case 'rejected':
      case 'cancelled':
        return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Pending Approval';
      case 'approved': return 'Approved & Ready for Payment';
      case 'active': return 'Rental In Progress';
      case 'completed': return 'Rental Completed';
      case 'rejected': return 'Rejected';
      case 'cancelled': return 'Cancelled';
      default: return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4639eb" />
          <Text style={styles.loadingText}>Loading order details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={64} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>Order Not Found</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
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
        <Text style={styles.headerTitle}>Order Details</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Order Status */}
        <View style={[styles.statusCard, { backgroundColor: getStatusColor(order.status) + '15' }]}>
          <View style={styles.statusHeader}>
            <Ionicons
              name={
                order.status === 'completed' ? 'checkmark-circle' :
                order.status === 'active' ? 'time' :
                order.status === 'pending' ? 'hourglass' :
                'information-circle'
              }
              size={24}
              color={getStatusColor(order.status)}
            />
            <Text style={[styles.statusText, { color: getStatusColor(order.status) }]}>
              {getStatusText(order.status)}
            </Text>
          </View>
          {order.payment?.paymentStatus && (
            <Text style={styles.paymentStatus}>
              Payment: {order.payment.paymentStatus.charAt(0).toUpperCase() + order.payment.paymentStatus.slice(1)}
            </Text>
          )}
        </View>

        {/* Item Details */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Item & Dates</Text>

          <View style={styles.itemRow}>
            {order.itemImage && (
              <Image source={{ uri: order.itemImage }} style={styles.itemImage} />
            )}
            <View style={styles.itemInfo}>
              <Text style={styles.itemTitle}>{order.itemTitle || 'Item'}</Text>
              <Text style={styles.itemOwner}>
                Owned by {order.ownerName || 'Owner'}
              </Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="calendar-outline" size={16} color="#6B7280" />
            <Text style={styles.detailText}>
              {formatDate(order.dates.requestedStart)} - {formatDate(order.dates.requestedEnd)}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="location-outline" size={16} color="#6B7280" />
            <Text style={styles.detailText}>
              {order.delivery.method === 'pickup' ? 'Pickup delivery' :
               order.delivery.method === 'delivery' ? 'Door-to-door delivery' :
               order.delivery.method === 'meet-in-middle' ? 'Meet halfway' : 'Pickup'}
            </Text>
          </View>
        </View>

        {/* Price Breakdown */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Price Breakdown</Text>

          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Rental Duration</Text>
            <Text style={styles.priceValue}>{order.pricing.totalDays} day{order.pricing.totalDays !== 1 ? 's' : ''}</Text>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Daily Rate</Text>
            <Text style={styles.priceValue}>
              {order.pricing.dailyRate} {order.pricing.currency}
            </Text>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Subtotal</Text>
            <Text style={styles.priceValue}>
              {order.pricing.subtotal} {order.pricing.currency}
            </Text>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Platform Fee</Text>
            <Text style={[styles.priceValue, styles.fee]}>
              -{order.pricing.platformFee} {order.pricing.currency}
            </Text>
          </View>

          {order.pricing.deliveryFee && order.pricing.deliveryFee > 0 && (
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Delivery Fee</Text>
              <Text style={styles.priceValue}>
                {order.pricing.deliveryFee} {order.pricing.currency}
              </Text>
            </View>
          )}

          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Security Deposit</Text>
            <Text style={styles.priceValue}>
              {order.pricing.securityDeposit} {order.pricing.currency}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.priceRow}>
            <Text style={[styles.priceLabel, styles.totalLabel]}>Total Payment</Text>
            <Text style={[styles.priceValue, styles.totalValue]}>
              {order.pricing.total} {order.pricing.currency}
            </Text>
          </View>
        </View>

        {/* Owner Earnings (only for owners) */}
        {isOwner && earningsData && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Your Earnings</Text>

            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Rental Income</Text>
              <Text style={[styles.priceValue, styles.positive]}>
                +{earningsData.gross} {order.pricing.currency}
              </Text>
            </View>

            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Platform Fee</Text>
              <Text style={[styles.priceValue, styles.fee]}>
                -{earningsData.platformFee} {order.pricing.currency}
              </Text>
            </View>

            {earningsData.damageCompensation > 0 && (
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Damage Compensation</Text>
                <Text style={[styles.priceValue, styles.positive]}>
                  +{earningsData.damageCompensation} {order.pricing.currency}
                </Text>
              </View>
            )}

            <View style={styles.divider} />

            <View style={styles.priceRow}>
              <Text style={[styles.priceLabel, styles.totalLabel]}>Net Earnings</Text>
              <Text style={[styles.priceValue, styles.totalValue]}>
                {earningsData.netEarnings} {order.pricing.currency}
              </Text>
            </View>

            {earningsData.depositRefunded > 0 && (
              <>
                <View style={styles.divider} />
                <Text style={styles.cardSubtitle}>Deposit Status</Text>
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Deposit Returned to Renter</Text>
                  <Text style={styles.priceValue}>
                    -{earningsData.depositRefunded} {order.pricing.currency}
                  </Text>
                </View>
              </>
            )}
          </View>
        )}

        {/* Timeline */}
        {order.timeline && order.timeline.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Order Timeline</Text>

            {order.timeline
              .sort((a, b) => {
                const aTime = getTimestampMs(a.timestamp);
                const bTime = getTimestampMs(b.timestamp);
                return bTime - aTime;
              })
              .map((event, index) => (
                <View key={index} style={styles.timelineItem}>
                  <View style={styles.timelineDot} />
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineEvent}>{event.event.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}</Text>
                    <Text style={styles.timelineTime}>
                      {formatDate(event.timestamp)} at {formatTime(event.timestamp)}
                    </Text>
                    {event.details && (
                      <Text style={styles.timelineDetails}>
                        {typeof event.details === 'string' ? event.details :
                         event.details.message || JSON.stringify(event.details)}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionsCard}>
          {isOwner && order.status === 'pending' && (
            <>
              <TouchableOpacity
                style={[styles.actionButton, styles.rejectButton]}
                onPress={() => {
                  Alert.alert(
                    'Reject Order',
                    'Are you sure you want to reject this rental request?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Reject',
                        style: 'destructive',
                        onPress: () => {
                          // Handle rejection
                          navigation.goBack();
                        }
                      }
                    ]
                  );
                }}
              >
                <Text style={styles.rejectButtonText}>Reject Order</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.approveButton]}
                onPress={() => {
                  Alert.alert(
                    'Approve Order',
                    'This will make the order ready for payment. Continue?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Approve',
                        onPress: () => {
                          // Handle approval
                          navigation.goBack();
                        }
                      }
                    ]
                  );
                }}
              >
                <Text style={styles.approveButtonText}>Approve Order</Text>
              </TouchableOpacity>
            </>
          )}

          {order.status === 'approved' && order.payment?.paymentStatus === 'pending' && !isOwner && (
            <TouchableOpacity
              style={[styles.actionButton, styles.primaryButton]}
              onPress={() => navigation.navigate('RentalPayment', { rentalId: order.id })}
            >
              <Text style={styles.primaryButtonText}>Complete Payment</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.actionButton, styles.secondaryButton]}
            onPress={() => console.log('Contact user - navigation needs to be implemented')}
          >
            <Text style={styles.secondaryButtonText}>Contact {isOwner ? order.renterName : order.ownerName}</Text>
          </TouchableOpacity>
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
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
  content: {
    flex: 1,
    padding: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
  },
  backButton: {
    backgroundColor: '#4639eb',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  statusCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
  },
  paymentStatus: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  cardSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
  },
  itemInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  itemOwner: {
    fontSize: 14,
    color: '#6B7280',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  priceLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  priceValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4639eb',
  },
  fee: {
    color: '#EF4444',
  },
  positive: {
    color: '#10B981',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 12,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4639eb',
    marginTop: 6,
    marginRight: 16,
  },
  timelineContent: {
    flex: 1,
  },
  timelineEvent: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  timelineTime: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  timelineDetails: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  actionsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
  },
  actionButton: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
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
  primaryButton: {
    backgroundColor: '#4639eb',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
});

export default OrderDetailsScreen;
