import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import Button from '../../components/ui/Button';
import AvailabilityCalendar from '../../components/calendar/AvailabilityCalendar';
import { RentalService, ItemService } from '../../services/firestore';
import { useAuthContext } from '../../contexts/AuthContext';
import { Item, Rental } from '../../types';

const RentalRequestScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { itemId } = route.params as { itemId: string };
  const { user } = useAuthContext();

  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedDates, setSelectedDates] = useState<{ start: Date | null; end: Date | null }>({
    start: null,
    end: null,
  });
  const [message, setMessage] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'delivery' | 'meetInMiddle'>('pickup');
  const [deliveryAddress, setDeliveryAddress] = useState('');

  useEffect(() => {
    loadItem();
  }, [itemId]);

  const loadItem = async () => {
    try {
      setLoading(true);
      const itemData = await ItemService.getItem(itemId);
      if (!itemData) {
        Alert.alert('Error', 'Item not found');
        navigation.goBack();
        return;
      }
      setItem(itemData);
    } catch (error) {
      console.error('Error loading item:', error);
      Alert.alert('Error', 'Failed to load item details');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const rentalDays = selectedDates.start && selectedDates.end
    ? Math.ceil((selectedDates.end.getTime() - selectedDates.start.getTime()) / (1000 * 60 * 60 * 24)) + 1
    : 0;

  const dailyRate = item?.pricing.dailyRate || 0;
  const totalCost = rentalDays * dailyRate;
  const securityDeposit = item?.pricing.securityDeposit || 0;
  const platformFee = Math.round(totalCost * 0.1); // 10% platform fee
  const totalAmount = totalCost + securityDeposit + platformFee;

  const handleDateRangeSelect = (dates: { start: Date; end: Date }) => {
    if (!item) return;

    const days = Math.ceil((dates.end.getTime() - dates.start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    if (days < item.availability.minRentalDays) {
      Alert.alert(
        'Invalid Selection',
        `Minimum rental period is ${item.availability.minRentalDays} day(s). Please select a longer period.`
      );
      return;
    }

    if (days > item.availability.maxRentalDays) {
      Alert.alert(
        'Invalid Selection',
        `Maximum rental period is ${item.availability.maxRentalDays} day(s). Please select a shorter period.`
      );
      return;
    }

    setSelectedDates({ start: dates.start, end: dates.end });
  };

  const handleSubmitRequest = async () => {
    if (!user || !item) {
      Alert.alert('Error', 'Please sign in to submit rental requests');
      return;
    }

    if (!selectedDates.start || !selectedDates.end) {
      Alert.alert('Missing Information', 'Please select rental dates');
      return;
    }

    if (deliveryMethod === 'delivery' && !deliveryAddress.trim()) {
      Alert.alert('Missing Information', 'Please provide a delivery address');
      return;
    }

    try {
      setSubmitting(true);

      const rentalRequest: Omit<Rental, 'id' | 'createdAt' | 'updatedAt'> = {
        itemId: item.id,
        renterId: user.uid,
        ownerId: item.ownerId,
        status: 'pending',
        dates: {
          requestedStart: selectedDates.start,
          requestedEnd: selectedDates.end,
        },
        pricing: {
          dailyRate: item.pricing.dailyRate,
          totalDays: rentalDays,
          subtotal: totalCost,
          securityDeposit: securityDeposit,
          platformFee: platformFee,
          total: totalAmount,
          currency: 'USD',
        },
        delivery: {
          method: deliveryMethod === 'meetInMiddle' ? 'meet-in-middle' : deliveryMethod,
          pickupLocation: deliveryMethod === 'delivery' ? {
            latitude: item.location.latitude,
            longitude: item.location.longitude,
            address: item.location.address,
          } : undefined,
          deliveryLocation: deliveryMethod === 'delivery' ? {
            latitude: 0, // Would be set based on delivery address in real app
            longitude: 0,
            address: deliveryAddress,
          } : undefined,
        },
        payment: {
          stripePaymentIntentId: '', // Would be created during payment processing
          paymentStatus: 'pending',
          depositStatus: 'held',
          payoutStatus: 'pending',
        },
        communication: {
          chatId: '', // Would be created when chat is initiated
        },
        completion: {},
        timeline: [
          {
            event: 'rental_requested',
            timestamp: new Date(),
            actor: user.uid,
            details: {
              message: message.trim() || undefined,
              deliveryMethod,
              deliveryAddress: deliveryMethod === 'delivery' ? deliveryAddress : undefined,
            },
          },
        ],
      };

      const rentalId = await RentalService.createRental(rentalRequest);

      Alert.alert(
        'Request Submitted!',
        'Your rental request has been sent to the owner. You will be notified when they respond.',
        [
          {
            text: 'OK',
            onPress: () => {
              navigation.goBack();
              // Navigate to rental tracking screen
              // navigation.navigate('RentalTracking', { rentalId });
            },
          },
        ]
      );

    } catch (error) {
      console.error('Error submitting rental request:', error);
      Alert.alert('Error', 'Failed to submit rental request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading || !item) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.loadingText}>Loading item details...</Text>
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
          <Text style={styles.headerTitle}>Request Rental</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Item Summary */}
        <View style={styles.itemSummary}>
          <Text style={styles.itemTitle}>{item.title}</Text>
          <Text style={styles.itemPrice}>
            {formatPrice(item.pricing.dailyRate)}/day
          </Text>
        </View>

        {/* Date Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Rental Dates</Text>
          <Text style={styles.sectionDescription}>
            Choose your preferred rental period. The item must be rented for at least {item.availability.minRentalDays} day(s).
          </Text>

          <View style={styles.dateSelection}>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => {
                // In a real app, this would open a date picker
                Alert.alert('Date Picker', 'Date picker would open here');
              }}
            >
              <Ionicons name="calendar-outline" size={20} color="#4639eb" />
              <View style={styles.dateButtonContent}>
                <Text style={styles.dateButtonLabel}>Start Date</Text>
                <Text style={styles.dateButtonValue}>
                  {selectedDates.start ? formatDate(selectedDates.start) : 'Select start date'}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => {
                // In a real app, this would open a date picker
                Alert.alert('Date Picker', 'Date picker would open here');
              }}
            >
              <Ionicons name="calendar-outline" size={20} color="#4639eb" />
              <View style={styles.dateButtonContent}>
                <Text style={styles.dateButtonLabel}>End Date</Text>
                <Text style={styles.dateButtonValue}>
                  {selectedDates.end ? formatDate(selectedDates.end) : 'Select end date'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Quick date presets */}
          <View style={styles.datePresets}>
            <Text style={styles.presetsTitle}>Quick Select:</Text>
            <View style={styles.presetButtons}>
              {[1, 3, 7, 14, 30].map(days => (
                <TouchableOpacity
                  key={days}
                  style={styles.presetButton}
                  onPress={() => {
                    const start = new Date();
                    const end = new Date();
                    end.setDate(end.getDate() + days);
                    handleDateRangeSelect({ start, end });
                  }}
                >
                  <Text style={styles.presetButtonText}>{days} day{days !== 1 ? 's' : ''}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {selectedDates.start && selectedDates.end && (
            <View style={styles.selectedDatesInfo}>
              <Text style={styles.selectedDatesText}>
                Selected: {formatDate(selectedDates.start)} - {formatDate(selectedDates.end)}
              </Text>
              <Text style={styles.durationText}>
                Duration: {rentalDays} day{rentalDays !== 1 ? 's' : ''}
              </Text>
              <Text style={styles.limitsText}>
                Min: {item.availability.minRentalDays} days • Max: {item.availability.maxRentalDays} days
              </Text>
            </View>
          )}
        </View>

        {/* Delivery Method */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Method</Text>

          {item.location.deliveryOptions.pickup && (
            <TouchableOpacity
              style={[
                styles.deliveryOption,
                deliveryMethod === 'pickup' && styles.deliveryOptionSelected,
              ]}
              onPress={() => setDeliveryMethod('pickup')}
            >
              <Ionicons
                name="location"
                size={20}
                color={deliveryMethod === 'pickup' ? '#4639eb' : '#6B7280'}
              />
              <View style={styles.deliveryInfo}>
                <Text style={[
                  styles.deliveryTitle,
                  deliveryMethod === 'pickup' && styles.deliveryTitleSelected,
                ]}>
                  Pickup
                </Text>
                <Text style={styles.deliveryDescription}>
                  Pick up from owner's location
                </Text>
              </View>
              <View style={[
                styles.radioButton,
                deliveryMethod === 'pickup' && styles.radioButtonSelected,
              ]} />
            </TouchableOpacity>
          )}

          {item.location.deliveryOptions.delivery && (
            <TouchableOpacity
              style={[
                styles.deliveryOption,
                deliveryMethod === 'delivery' && styles.deliveryOptionSelected,
              ]}
              onPress={() => setDeliveryMethod('delivery')}
            >
              <Ionicons
                name="car"
                size={20}
                color={deliveryMethod === 'delivery' ? '#4639eb' : '#6B7280'}
              />
              <View style={styles.deliveryInfo}>
                <Text style={[
                  styles.deliveryTitle,
                  deliveryMethod === 'delivery' && styles.deliveryTitleSelected,
                ]}>
                  Delivery
                </Text>
                <Text style={styles.deliveryDescription}>
                  Owner delivers to your location
                </Text>
              </View>
              <View style={[
                styles.radioButton,
                deliveryMethod === 'delivery' && styles.radioButtonSelected,
              ]} />
            </TouchableOpacity>
          )}

          {item.location.deliveryOptions.meetInMiddle && (
            <TouchableOpacity
              style={[
                styles.deliveryOption,
                deliveryMethod === 'meetInMiddle' && styles.deliveryOptionSelected,
              ]}
              onPress={() => setDeliveryMethod('meetInMiddle')}
            >
              <Ionicons
                name="people"
                size={20}
                color={deliveryMethod === 'meetInMiddle' ? '#4639eb' : '#6B7280'}
              />
              <View style={styles.deliveryInfo}>
                <Text style={[
                  styles.deliveryTitle,
                  deliveryMethod === 'meetInMiddle' && styles.deliveryTitleSelected,
                ]}>
                  Meet in Middle
                </Text>
                <Text style={styles.deliveryDescription}>
                  Meet at a convenient location
                </Text>
              </View>
              <View style={[
                styles.radioButton,
                deliveryMethod === 'meetInMiddle' && styles.radioButtonSelected,
              ]} />
            </TouchableOpacity>
          )}

          {deliveryMethod === 'delivery' && (
            <TextInput
              style={styles.addressInput}
              placeholder="Enter delivery address..."
              value={deliveryAddress}
              onChangeText={setDeliveryAddress}
              multiline
              numberOfLines={2}
            />
          )}
        </View>

        {/* Message to Owner */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Message to Owner (Optional)</Text>
          <TextInput
            style={styles.messageInput}
            placeholder="Add a message to the owner about your rental request..."
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={4}
            maxLength={500}
          />
          <Text style={styles.characterCount}>{message.length}/500</Text>
        </View>

        {/* Cost Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cost Breakdown</Text>

          <View style={styles.costRow}>
            <Text style={styles.costLabel}>
              {formatPrice(dailyRate)} × {rentalDays} day{rentalDays !== 1 ? 's' : ''}
            </Text>
            <Text style={styles.costValue}>{formatPrice(totalCost)}</Text>
          </View>

          <View style={styles.costRow}>
            <Text style={styles.costLabel}>Security Deposit</Text>
            <Text style={styles.costValue}>{formatPrice(securityDeposit)}</Text>
          </View>

          <View style={styles.costRow}>
            <Text style={styles.costLabel}>Platform Fee (10%)</Text>
            <Text style={styles.costValue}>{formatPrice(platformFee)}</Text>
          </View>

          <View style={styles.costDivider} />

          <View style={styles.costRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>
              {formatPrice(totalAmount)}
            </Text>
          </View>

          <Text style={styles.depositNote}>
            *Security deposit will be refunded after the rental period
          </Text>
        </View>
      </ScrollView>

      {/* Submit Button */}
      <View style={styles.footer}>
        <Button
          title="Submit Request"
          onPress={handleSubmitRequest}
          loading={submitting}
          disabled={submitting || !selectedDates.start || !selectedDates.end}
          style={styles.submitButton}
        />
      </View>
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
  itemSummary: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  itemTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 16,
    color: '#4639eb',
    fontWeight: '500',
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
  selectedDatesInfo: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
  },
  selectedDatesText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 4,
  },
  durationText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  limitsText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  dateSelection: {
    gap: 12,
    marginTop: 16,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  dateButtonContent: {
    flex: 1,
  },
  dateButtonLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    marginBottom: 4,
  },
  dateButtonValue: {
    fontSize: 16,
    color: '#111827',
  },
  datePresets: {
    marginTop: 16,
  },
  presetsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  presetButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#EEF2FF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  presetButtonText: {
    fontSize: 14,
    color: '#4639eb',
    fontWeight: '500',
  },
  deliveryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
    gap: 12,
  },
  deliveryOptionSelected: {
    backgroundColor: '#F0F9FF',
    borderColor: '#4639eb',
  },
  deliveryInfo: {
    flex: 1,
  },
  deliveryTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  deliveryTitleSelected: {
    color: '#4639eb',
  },
  deliveryDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
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
    borderColor: '#4639eb',
    backgroundColor: '#4639eb',
  },
  addressInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    textAlignVertical: 'top',
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
  characterCount: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'right',
    marginTop: 4,
  },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  costLabel: {
    fontSize: 16,
    color: '#6B7280',
  },
  costValue: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
  },
  costDivider: {
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
  depositNote: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
    marginTop: 8,
  },
  footer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  submitButton: {
    marginBottom: 0,
  },
});

export default RentalRequestScreen;
