import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import Button from '../../components/ui/Button';
import { RentalService, ItemService, UserService, NotificationService } from '../../services/firestore';
import { useAuthContext } from '../../contexts/AuthContext';
import { Rental, Item, User } from '../../types';

interface RentalApprovalScreenProps {
  route: {
    params: {
      rentalId: string;
    };
  };
}

const RentalApprovalScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { rentalId } = route.params as { rentalId: string };
  const { user } = useAuthContext();

  const [rental, setRental] = useState<Rental | null>(null);
  const [item, setItem] = useState<Item | null>(null);
  const [renter, setRenter] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectionForm, setShowRejectionForm] = useState(false);
  const [ownerMessage, setOwnerMessage] = useState('');

  useEffect(() => {
    loadRentalData();
  }, [rentalId]);

  const loadRentalData = async () => {
    try {
      setLoading(true);
      
      const rentalData = await RentalService.getRental(rentalId);
      if (!rentalData) {
        Alert.alert('Error', 'Rental request not found');
        navigation.goBack();
        return;
      }

      if (rentalData.ownerId !== user?.uid) {
        Alert.alert('Error', 'You are not authorized to view this rental request');
        navigation.goBack();
        return;
      }

      setRental(rentalData);

      // Load item and renter details
      const [itemData, renterData] = await Promise.all([
        ItemService.getItem(rentalData.itemId),
        UserService.getUser(rentalData.renterId),
      ]);

      setItem(itemData);
      setRenter(renterData);
    } catch (error) {
      console.error('Error loading rental data:', error);
      Alert.alert('Error', 'Failed to load rental request');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!rental) return;

    Alert.alert(
      'Approve Rental Request',
      'Are you sure you want to approve this rental request? The renter will be notified and can proceed with payment.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            try {
              setActionLoading(true);

              // Update rental status
              await RentalService.updateRental(rentalId, {
                status: 'approved',
                dates: {
                  ...rental.dates,
                  confirmedStart: rental.dates.requestedStart,
                  confirmedEnd: rental.dates.requestedEnd,
                },
                timeline: [
                  ...rental.timeline,
                  {
                    event: 'rental_approved',
                    timestamp: new Date(),
                    actor: user!.uid,
                    details: {
                      message: ownerMessage.trim() || undefined,
                    },
                  },
                ],
              });

              // Create notification for renter
              try {
                await NotificationService.createNotification({
                  userId: rental.renterId,
                  type: 'rental_approved',
                  title: 'Rental Request Approved!',
                  body: `${item?.title || 'Item'} rental has been approved. You can now proceed with payment.`,
                  data: {
                    rentalId: rental.id,
                    itemId: rental.itemId,
                  },
                  priority: 'high',
                  status: 'unread',
                  delivery: {},
                });
              } catch (notificationError) {
                console.error('Failed to create approval notification:', notificationError);
                // Don't fail the approval if notification fails
              }

              // In a real app, this would also:
              // 1. Send push notification to renter
              // 2. Create/update chat thread
              // 3. Initiate payment flow
              // 4. Update item availability

              Alert.alert(
                'Request Approved!',
                'The rental request has been approved. The renter will be notified and can proceed with payment.',
                [
                  {
                    text: 'OK',
                    onPress: () => navigation.goBack(),
                  },
                ]
              );
            } catch (error) {
              console.error('Error approving rental:', error);
              Alert.alert('Error', 'Failed to approve rental request');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleReject = async () => {
    if (!rental) return;
    
    if (!rejectionReason.trim()) {
      Alert.alert('Rejection Reason Required', 'Please provide a reason for rejecting this request');
      return;
    }

    try {
      setActionLoading(true);

      // Update rental status
      await RentalService.updateRental(rentalId, {
        status: 'rejected',
        cancellation: {
          cancelledBy: 'owner',
          reason: rejectionReason.trim(),
          cancelledAt: new Date(),
          refundAmount: 0,
        },
        timeline: [
          ...rental.timeline,
          {
            event: 'rental_rejected',
            timestamp: new Date(),
            actor: user!.uid,
            details: {
              reason: rejectionReason.trim(),
              message: ownerMessage.trim() || undefined,
            },
          },
        ],
      });

      // Create notification for renter
      try {
        await NotificationService.createNotification({
          userId: rental.renterId,
          type: 'rental_rejected',
          title: 'Rental Request Declined',
          body: `${item?.title || 'Item'} rental request was not approved. ${rejectionReason}`,
          data: {
            rentalId: rental.id,
            itemId: rental.itemId,
          },
          priority: 'normal',
          status: 'unread',
          delivery: {},
        });
      } catch (notificationError) {
        console.error('Failed to create rejection notification:', notificationError);
        // Don't fail the rejection if notification fails
      }

      // In a real app, this would also:
      // 1. Send push notification to renter
      // 2. Update item availability
      // 3. Log rejection for analytics

      Alert.alert(
        'Request Rejected',
        'The rental request has been rejected. The renter will be notified.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('Error rejecting rental:', error);
      Alert.alert('Error', 'Failed to reject rental request');
    } finally {
      setActionLoading(false);
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
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getRenterRatingDisplay = () => {
    if (!renter) return 'N/A';
    const asRenterRating = renter.ratings.asRenter;
    if (asRenterRating.count === 0) return 'New user';
    return `${asRenterRating.average.toFixed(1)} ⭐ (${asRenterRating.count} reviews)`;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading rental request...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!rental || !item || !renter) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load rental data</Text>
          <Button title="Go Back" onPress={() => navigation.goBack()} />
        </View>
      </SafeAreaView>
    );
  }

  if (showRejectionForm) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setShowRejectionForm(false)}>
              <Ionicons name="arrow-back" size={24} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Reject Request</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Reason for Rejection</Text>
            <Text style={styles.sectionDescription}>
              Let the renter know why you're unable to approve their request.
            </Text>
            
            <View style={styles.reasonOptions}>
              {[
                'Item not available for selected dates',
                'Rental period too short',
                'Rental period too long',
                'Delivery not available to that location',
                'Renter does not meet requirements',
                'Other reason',
              ].map((reason, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.reasonOption,
                    rejectionReason === reason && styles.reasonOptionSelected,
                  ]}
                  onPress={() => setRejectionReason(reason)}
                >
                  <Text
                    style={[
                      styles.reasonText,
                      rejectionReason === reason && styles.reasonTextSelected,
                    ]}
                  >
                    {reason}
                  </Text>
                  <View
                    style={[
                      styles.radioButton,
                      rejectionReason === reason && styles.radioButtonSelected,
                    ]}
                  />
                </TouchableOpacity>
              ))}
            </View>

            {rejectionReason === 'Other reason' && (
              <TextInput
                style={styles.customReasonInput}
                placeholder="Please specify the reason..."
                value={rejectionReason === 'Other reason' ? '' : rejectionReason}
                onChangeText={(text) => setRejectionReason(text)}
                multiline
                numberOfLines={3}
              />
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Additional Message (Optional)</Text>
            <TextInput
              style={styles.messageInput}
              placeholder="Add a personal message to the renter..."
              value={ownerMessage}
              onChangeText={setOwnerMessage}
              multiline
              numberOfLines={4}
              maxLength={300}
            />
            <Text style={styles.characterCount}>{ownerMessage.length}/300</Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title="Cancel"
            onPress={() => setShowRejectionForm(false)}
            variant="outline"
            style={styles.cancelButton}
          />
          <Button
            title="Reject Request"
            onPress={handleReject}
            loading={actionLoading}
            disabled={!rejectionReason.trim() || actionLoading}
            variant="danger"
            style={styles.rejectButton}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Rental Request</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Status Badge */}
        <View style={styles.statusContainer}>
          <View style={[styles.statusBadge, styles.pendingBadge]}>
            <Text style={styles.statusText}>Pending Approval</Text>
          </View>
        </View>

        {/* Renter Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Renter Information</Text>
          
          <View style={styles.renterCard}>
            <Image
              source={{
                uri: renter.photoURL || 'https://via.placeholder.com/60x60?text=User',
              }}
              style={styles.renterAvatar}
            />
            <View style={styles.renterInfo}>
              <Text style={styles.renterName}>{renter.displayName}</Text>
              <Text style={styles.renterRating}>{getRenterRatingDisplay()}</Text>
              <Text style={styles.renterLocation}>
                {renter.location.city}, {renter.location.country}
              </Text>
              {renter.verification.isVerified && (
                <View style={styles.verificationBadge}>
                  <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                  <Text style={styles.verificationText}>Verified</Text>
                </View>
              )}
            </View>
            <TouchableOpacity style={styles.messageButton}>
              <Ionicons name="chatbubble-outline" size={20} color="#4639eb" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Item Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Item Details</Text>
          
          <View style={styles.itemCard}>
            <Image
              source={{
                uri: item.images[0] || 'https://via.placeholder.com/80x80?text=Item',
              }}
              style={styles.itemImage}
            />
            <View style={styles.itemInfo}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.itemPrice}>
                {formatPrice(item.pricing.dailyRate)}/day
              </Text>
            </View>
          </View>
        </View>

        {/* Rental Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rental Details</Text>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Start Date</Text>
            <Text style={styles.detailValue}>
              {formatDate(rental.dates.requestedStart)}
            </Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>End Date</Text>
            <Text style={styles.detailValue}>
              {formatDate(rental.dates.requestedEnd)}
            </Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Duration</Text>
            <Text style={styles.detailValue}>
              {rental.pricing.totalDays} day{rental.pricing.totalDays !== 1 ? 's' : ''}
            </Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Delivery Method</Text>
            <Text style={styles.detailValue}>
              {rental.delivery.method === 'pickup' && 'Pickup'}
              {rental.delivery.method === 'delivery' && 'Delivery'}
              {rental.delivery.method === 'meet-in-middle' && 'Meet in Middle'}
            </Text>
          </View>

          {rental.delivery.deliveryLocation && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Delivery Address</Text>
              <Text style={styles.detailValue}>
                {rental.delivery.deliveryLocation.address}
              </Text>
            </View>
          )}
        </View>

        {/* Pricing Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pricing</Text>
          
          <View style={styles.pricingRow}>
            <Text style={styles.pricingLabel}>
              {formatPrice(rental.pricing.dailyRate)} × {rental.pricing.totalDays} days
            </Text>
            <Text style={styles.pricingValue}>
              {formatPrice(rental.pricing.subtotal)}
            </Text>
          </View>
          
          <View style={styles.pricingRow}>
            <Text style={styles.pricingLabel}>Security Deposit</Text>
            <Text style={styles.pricingValue}>
              {formatPrice(rental.pricing.securityDeposit)}
            </Text>
          </View>
          
          <View style={styles.pricingRow}>
            <Text style={styles.pricingLabel}>Platform Fee</Text>
            <Text style={styles.pricingValue}>
              {formatPrice(rental.pricing.platformFee)}
            </Text>
          </View>
          
          <View style={styles.pricingDivider} />
          
          <View style={styles.pricingRow}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalValue}>
              {formatPrice(rental.pricing.total)}
            </Text>
          </View>
          
          <Text style={styles.earningsNote}>
            You'll earn: {formatPrice(rental.pricing.subtotal - rental.pricing.platformFee)}
          </Text>
        </View>

        {/* Renter Message */}
        {rental.timeline.find(event => event.details?.message) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Message from Renter</Text>
            <View style={styles.messageCard}>
              <Text style={styles.messageText}>
                {rental.timeline.find(event => event.details?.message)?.details?.message}
              </Text>
            </View>
          </View>
        )}

        {/* Response Message */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Response (Optional)</Text>
          <TextInput
            style={styles.responseInput}
            placeholder="Add a message for the renter..."
            value={ownerMessage}
            onChangeText={setOwnerMessage}
            multiline
            numberOfLines={3}
            maxLength={300}
          />
          <Text style={styles.characterCount}>{ownerMessage.length}/300</Text>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      {rental.status === 'pending' && (
        <View style={styles.footer}>
          <Button
            title="Reject"
            onPress={() => setShowRejectionForm(true)}
            variant="outline"
            style={styles.rejectButton}
          />
          <Button
            title="Approve"
            onPress={handleApprove}
            loading={actionLoading}
            disabled={actionLoading}
            style={styles.approveButton}
          />
        </View>
      )}
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
    fontSize: 16,
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    marginBottom: 20,
    textAlign: 'center',
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
  statusContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  pendingBadge: {
    backgroundColor: '#FEF3C7',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#92400E',
  },
  section: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  renterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  renterAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  renterInfo: {
    flex: 1,
  },
  renterName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  renterRating: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 2,
  },
  renterLocation: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  verificationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  verificationText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '500',
  },
  messageButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F9FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
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
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 16,
    color: '#6B7280',
  },
  detailValue: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
  },
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  pricingLabel: {
    fontSize: 16,
    color: '#6B7280',
  },
  pricingValue: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
  },
  pricingDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 12,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  earningsNote: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '500',
    marginTop: 8,
    textAlign: 'right',
  },
  messageCard: {
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4639eb',
  },
  messageText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  responseInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    textAlignVertical: 'top',
    minHeight: 80,
  },
  characterCount: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'right',
    marginTop: 4,
  },
  reasonOptions: {
    gap: 8,
  },
  reasonOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  reasonOptionSelected: {
    backgroundColor: '#FEF2F2',
    borderColor: '#EF4444',
  },
  reasonText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  reasonTextSelected: {
    color: '#EF4444',
    fontWeight: '500',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  radioButtonSelected: {
    borderColor: '#EF4444',
    backgroundColor: '#EF4444',
  },
  customReasonInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    textAlignVertical: 'top',
    marginTop: 12,
    minHeight: 80,
  },
  messageInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    textAlignVertical: 'top',
    minHeight: 100,
  },
  footer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
  },
  rejectButton: {
    flex: 1,
  },
  approveButton: {
    flex: 1,
  },
});

export default RentalApprovalScreen;
