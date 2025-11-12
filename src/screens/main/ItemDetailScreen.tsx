import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  Dimensions,
  Share,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import Button from '../../components/ui/Button';
import Toast from 'react-native-toast-message';
import { ItemService, UserService } from '../../services/firestore';
import { useAuthContext } from '../../contexts/AuthContext';
import { authService } from '../../services/auth';
import { Item, User } from '../../types';
import { getCategoryById } from '../../data/categories';
import { getGovernorateById } from '../../data/governorates';


const { width } = Dimensions.get('window');

const ItemDetailScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { itemId } = route.params as { itemId: string };
  const { user } = useAuthContext();

  const [item, setItem] = useState<Item | null>(null);
  const [owner, setOwner] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [currentX, setCurrentX] = useState(0);

  useEffect(() => {
    loadItem();
  }, [itemId]);

  const loadItem = async () => {
    try {
      setLoading(true);
      const itemData = await ItemService.getItem(itemId);

      if (itemData) {
        setItem(itemData);

        // Load owner information with Firestore first
        try {
          const ownerDoc = await UserService.getUser(itemData.ownerId);
          if (ownerDoc) {
            setOwner(ownerDoc as any);
          } else {
            const ownerData = await authService.getUserData(itemData.ownerId);
            setOwner(ownerData);
          }
        } catch (ownerError) {
          console.error('Failed to load owner data:', ownerError);
          setOwner({
            uid: itemData.ownerId,
            email: '',
            displayName: itemData.ownerId === user?.uid ? 'You' : 'Verified Member',
            location: { latitude: 0, longitude: 0, address: '', city: '', country: '' },
            verification: { isVerified: false, verificationStatus: 'pending' },
            ratings: { asOwner: { average: 0, count: 0 }, asRenter: { average: 0, count: 0 } },
            wallet: { balance: 0, pendingBalance: 0, totalEarnings: 0 },
            preferences: { notifications: { email: true, push: true, sms: false }, searchRadius: 50, currency: 'USD' },
            stats: { itemsListed: 0, itemsRented: 0, successfulRentals: 0 },
            createdAt: new Date(),
            updatedAt: new Date(),
            isActive: true,
            fcmTokens: []
          } as any);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load item details');
    } finally {
      setLoading(false);
    }
  };

  const handleRentRequest = () => {
    if (!user) {
      (navigation as any).navigate('Auth', { screen: 'Login' });
      return;
    }
    if (item?.ownerId === user.uid) {
      Alert.alert('Cannot Rent', 'You cannot rent your own item');
      return;
    }
    (navigation as any).navigate('RentalRequest', { itemId: item?.id });
  };

  const handleFavorite = async () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to save favorites');
      return;
    }
    setIsFavorite(!isFavorite);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out this ${item?.title} for rent on Rentat!`,
        url: `https://rentat.app/items/${itemId}`,
      });
    } catch (error) {}
  };

  const handleContact = () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to contact the owner');
      return;
    }
    if (item?.ownerId === user.uid) {
      Alert.alert('Cannot Contact', 'You cannot contact yourself');
      return;
    }
    (navigation as any).navigate('Chat', {
      otherUserId: item?.ownerId,
      itemId,
    });
  };

  const handleEdit = () => {
    if (!item) return;
    (navigation as any).navigate('EditItem', { itemId: item.id });
  };

  const handleDelete = () => {
    if (!item) return;
    Alert.alert(
      'Delete Item',
      'Are you sure you want to remove this listing?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await ItemService.updateItem(item.id, { status: 'inactive' } as any);
              Toast.show({
                type: 'success',
                text1: 'Listing removed',
                position: 'top',
              });
              (navigation as any).goBack();
            } catch (e) {
              Alert.alert('Error', 'Failed to delete item');
            }
          }
        }
      ]
    );
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EGP',
    }).format(price);
  };

  const category = item ? getCategoryById(item.category) : null;
  const governorate = item ? getGovernorateById(item.governorate) : null;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Loading item details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!item) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#EF4444" />
          <Text style={styles.errorText}>Item not found</Text>
          <Button
            title="Go Back"
            onPress={() => navigation.goBack()}
            style={styles.goBackButton}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={handleShare} style={styles.actionButton}>
              <Ionicons name="share-outline" size={24} color="#111827" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleFavorite} style={styles.actionButton}>
              <Ionicons
                name={isFavorite ? "heart" : "heart-outline"}
                size={24}
                color={isFavorite ? "#EF4444" : "#111827"}
              />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollView} contentContainerStyle={{ paddingBottom: 120 }}>
          <View style={[styles.imageContainer, Platform.OS === 'web' ? { marginTop: 24 } : {}]}>
            {item.images && item.images.length > 0 ? (
              Platform.OS === 'web' ? (
                <div 
                  style={{ position: 'relative', width: '100%', maxWidth: 600, margin: '0 auto', cursor: isDragging ? 'grabbing' : 'grab' }}
                  onMouseDown={(e) => {
                    setIsDragging(true);
                    setStartX(e.clientX);
                    setCurrentX(e.clientX);
                  }}
                  onMouseMove={(e) => {
                    if (isDragging) {
                      setCurrentX(e.clientX);
                    }
                  }}
                  onMouseUp={() => {
                    if (isDragging) {
                      const diff = startX - currentX;
                      const threshold = 50; // minimum drag distance to trigger swipe
                      
                      if (Math.abs(diff) > threshold) {
                        if (diff > 0 && currentImageIndex < item.images.length - 1) {
                          // Swiped left, go to next image
                          setCurrentImageIndex(currentImageIndex + 1);
                        } else if (diff < 0 && currentImageIndex > 0) {
                          // Swiped right, go to previous image
                          setCurrentImageIndex(currentImageIndex - 1);
                        }
                      }
                      
                      setIsDragging(false);
                      setStartX(0);
                      setCurrentX(0);
                    }
                  }}
                  onMouseLeave={() => {
                    if (isDragging) {
                      setIsDragging(false);
                      setStartX(0);
                      setCurrentX(0);
                    }
                  }}
                >
                  <img
                    src={item.images[currentImageIndex]}
                    alt={`item-${currentImageIndex}`}
                    style={{
                      width: '100%',
                      height: 'auto',
                      aspectRatio: '1 / 1',
                      objectFit: 'cover',
                      borderRadius: 12,
                      userSelect: 'none',
                      pointerEvents: 'none',
                    }}
                  />
                  {item.images.length > 1 && (
                    <>
                      <button
                        style={{
                          position: 'absolute',
                          left: 8,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'rgba(255, 255, 255, 0.9)',
                          border: '1px solid #4639eb',
                          borderRadius: '50%',
                          width: 40,
                          height: 40,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          zIndex: 2,
                          fontSize: 18,
                          fontWeight: 'bold',
                          color: '#4639eb',
                        }}
                        onClick={() => setCurrentImageIndex(i => Math.max(i - 1, 0))}
                        disabled={currentImageIndex === 0}
                      >
                        ‹
                      </button>
                      <button
                        style={{
                          position: 'absolute',
                          right: 8,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'rgba(255, 255, 255, 0.9)',
                          border: '1px solid #4639eb',
                          borderRadius: '50%',
                          width: 40,
                          height: 40,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          zIndex: 2,
                          fontSize: 18,
                          fontWeight: 'bold',
                          color: '#4639eb',
                        }}
                        onClick={() => setCurrentImageIndex(i => Math.min(i + 1, item.images.length - 1))}
                        disabled={currentImageIndex === item.images.length - 1}
                      >
                        ›
                      </button>
                      <div style={{
                        position: 'absolute',
                        bottom: 16,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        display: 'flex',
                        gap: 8,
                        zIndex: 2,
                      }}>
                        {item.images.map((_, index) => (
                          <div
                            key={index}
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: 4,
                              backgroundColor: currentImageIndex === index ? '#FFFFFF' : 'rgba(255, 255, 255, 0.5)',
                            }}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <>
                  <View style={{ width, height: Math.round(width * 0.75) }}>
                    <ScrollView
                      horizontal
                      pagingEnabled
                      showsHorizontalScrollIndicator={false}
                      style={{ width, height: Math.round(width * 0.75) }}
                      contentContainerStyle={{ alignItems: 'center' }}
                      onMomentumScrollEnd={(event) => {
                        const index = Math.round(event.nativeEvent.contentOffset.x / width);
                        setCurrentImageIndex(index);
                      }}
                    >
                      {item.images.map((imageUrl, index) => (
                        <Image
                          key={index}
                          source={{ uri: imageUrl }}
                          style={{ width, height: Math.round(width * 0.75), resizeMode: 'cover', borderRadius: 12 }}
                        />
                      ))}
                    </ScrollView>
                  </View>
                  {item.images.length > 1 && (
                    <View style={styles.imageIndicators}>
                      {item.images.map((_, index) => (
                        <View
                          key={index}
                          style={[
                            styles.indicator,
                            currentImageIndex === index && styles.activeIndicator,
                          ]}
                        />
                      ))}
                    </View>
                  )}
                </>
              )
            ) : (
              <View style={styles.placeholderImage}>
                <Ionicons name="image" size={48} color="#D1D5DB" />
                <Text style={styles.placeholderText}>No images available</Text>
              </View>
            )}
          </View>

          <View style={styles.detailsContainer}>
            <View style={styles.titleSection}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <View style={styles.categoryBadge}>
                <Ionicons name={category?.icon as any} size={16} color="#4639eb" />
                <Text style={styles.categoryText}>{category?.name}</Text>
              </View>
            </View>

            <View style={styles.priceSection}>
              <Text style={styles.dailyRate}>
                {formatPrice(item.pricing.dailyRate)}/day
              </Text>
              <Text style={styles.deposit}>
                Security deposit: {formatPrice(item.pricing.securityDeposit)}
              </Text>
            </View>

            <View style={styles.conditionSection}>
              <Text style={styles.conditionLabel}>Condition:</Text>
              <Text style={styles.conditionValue}>
                {item.condition.charAt(0).toUpperCase() + item.condition.slice(1).replace('-', ' ')}
              </Text>
            </View>

            <View style={styles.locationSection}>
              <Ionicons name="location" size={16} color="#6B7280" />
              <Text style={styles.locationLabel}>Location:</Text>
              <Text style={styles.locationValue}>
                {governorate?.name || 'Location not specified'}
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.description}>{item.description}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Owner</Text>
              <View style={styles.ownerInfo}>
                <View style={styles.ownerAvatar}>
                  <Ionicons name="person" size={24} color="#6B7280" />
                </View>
                <View style={styles.ownerDetails}>
                  <Text style={styles.ownerName}>
                    {owner?.displayName || (owner?.email ? owner.email.split('@')[0] : 'Owner')}
                  </Text>
                  <View style={styles.ownerStats}>
                    <Ionicons name="star" size={14} color="#FFC107" />
                    <Text style={styles.rating}>
                      {owner?.ratings?.asOwner?.average?.toFixed(1) || '0.0'} ({owner?.ratings?.asOwner?.count || 0} reviews)
                    </Text>
                    <Text style={styles.separator}>•</Text>
                    <Text style={styles.joinDate}>
                      Joined {(() => {
                        try {
                          const date = owner?.createdAt ? new Date(owner.createdAt) : new Date();
                          return isNaN(date.getTime()) ? new Date().getFullYear() : date.getFullYear();
                        } catch {
                          return new Date().getFullYear();
                        }
                      })()}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity onPress={handleContact} style={styles.contactButton}>
                  <Ionicons name="chatbubble-outline" size={20} color="#4639eb" />
                </TouchableOpacity>
                {item.ownerId === user?.uid && (
                  <View style={styles.ownerActions}>
                    <TouchableOpacity onPress={handleEdit} style={styles.ownerActionButton}>
                      <Ionicons name="pencil" size={20} color="#4639eb" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleDelete} style={styles.ownerActionButton}>
                      <Ionicons name="trash-outline" size={20} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Delivery Options</Text>
              <View style={styles.deliveryOptions}>
                {item.location.deliveryOptions.pickup && (
                  <View style={styles.deliveryOption}>
                    <Ionicons name="location" size={16} color="#10B981" />
                    <Text style={styles.deliveryText}>Pickup available</Text>
                  </View>
                )}
                {item.location.deliveryOptions.delivery && (
                  <View style={styles.deliveryOption}>
                    <Ionicons name="car" size={16} color="#10B981" />
                    <Text style={styles.deliveryText}>Delivery available</Text>
                  </View>
                )}
                {item.location.deliveryOptions.meetInMiddle && (
                  <View style={styles.deliveryOption}>
                    <Ionicons name="people" size={16} color="#10B981" />
                    <Text style={styles.deliveryText}>Meet halfway</Text>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Availability</Text>
              <Text style={styles.availabilityText}>
                {item.availability.isAvailable
                  ? 'Available for rent'
                  : 'Currently unavailable'
                }
              </Text>
              <Text style={styles.availabilityDetails}>
                Min rental: {item.availability.minRentalDays} day(s) •
                Max rental: {item.availability.maxRentalDays} day(s)
              </Text>
            </View>

            {item.specifications && Object.keys(item.specifications).length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Specifications</Text>
                {Object.entries(item.specifications).map(([key, value]) => (
                  <View key={key} style={styles.specRow}>
                    <Text style={styles.specLabel}>{key}:</Text>
                    <Text style={styles.specValue}>{value}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </View>
      {Platform.OS === 'web' ? (
        <div
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 16,
            paddingBottom: 34,
            borderTop: '1px solid #E5E7EB',
            backgroundColor: '#FFFFFF',
            gap: 16,
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ flex: 1, fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif', boxSizing: 'border-box' }}>
            <span style={{ fontSize: 20, fontWeight: 'bold', color: '#111827', fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif' }}>
              {formatPrice(item.pricing.dailyRate)}/day
            </span>
            <span style={{ fontSize: 12, color: '#6B7280', fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif', marginLeft: 8 }}>
              +{formatPrice(item.pricing.securityDeposit)} deposit
            </span>
          </div>
          <button
            style={{
              minWidth: 140,
              maxWidth: '100%',
              width: 'auto',
              backgroundColor: '#4639eb',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '12px 24px',
              fontWeight: 'bold',
              fontSize: 16,
              fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
              boxSizing: 'border-box',
              marginLeft: 16,
              cursor: item.availability.isAvailable && item.ownerId !== user?.uid ? 'pointer' : 'not-allowed',
              opacity: item.availability.isAvailable && item.ownerId !== user?.uid ? 1 : 0.5,
              overflow: 'hidden',
            }}
            disabled={!item.availability.isAvailable || item.ownerId === user?.uid}
            onClick={handleRentRequest}
          >
            Request Rental
          </button>
        </div>
      ) : (
        <View style={styles.bottomBar}>
          <View style={styles.priceInfo}>
            <Text style={styles.bottomPrice}>
              {formatPrice(item.pricing.dailyRate)}/day
            </Text>
            <Text style={styles.bottomDeposit}>
              +{formatPrice(item.pricing.securityDeposit)} deposit
            </Text>
          </View>
          <Button
            title="Request Rental"
            onPress={handleRentRequest}
            disabled={!item.availability.isAvailable || item.ownerId === user?.uid}
            style={styles.rentButton}
          />
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#6B7280',
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  goBackButton: {
    minWidth: 120,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    backdropFilter: 'blur(10px)',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageContainer: {
    position: 'relative',
    marginTop: 60,
  },
  itemImage: {
    width: width,
    height: width * 0.3,
    resizeMode: 'cover',
  },
  placeholderImage: {
    width: width,
    height: width * 0.3,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#D1D5DB',
    marginTop: 8,
    fontSize: 16,
  },
  imageIndicators: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  activeIndicator: {
    backgroundColor: '#FFFFFF',
  },
  detailsContainer: {
    padding: 16,
  },
  titleSection: {
    marginBottom: 16,
  },
  itemTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
    gap: 6,
  },
  categoryText: {
    fontSize: 14,
    color: '#4639eb',
    fontWeight: '500',
  },
  priceSection: {
    marginBottom: 16,
  },
  dailyRate: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
  },
  deposit: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  conditionSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 8,
  },
  conditionLabel: {
    fontSize: 16,
    color: '#6B7280',
  },
  conditionValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  locationSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 8,
  },
  locationLabel: {
    fontSize: 16,
    color: '#6B7280',
  },
  locationValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  section: {
    marginBottom: 24,
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
  },
  ownerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ownerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ownerDetails: {
    flex: 1,
  },
  ownerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  ownerStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  rating: {
    fontSize: 14,
    color: '#6B7280',
  },
  separator: {
    fontSize: 14,
    color: '#D1D5DB',
  },
  joinDate: {
    fontSize: 14,
    color: '#6B7280',
  },
  contactButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F9FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ownerActions: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 8,
  },
  ownerActionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deliveryOptions: {
    gap: 8,
  },
  deliveryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deliveryText: {
    fontSize: 16,
    color: '#374151',
  },
  availabilityText: {
    fontSize: 16,
    color: '#10B981',
    fontWeight: '500',
  },
  availabilityDetails: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  specLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  specValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
    marginBottom: 100,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    gap: 16,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  priceInfo: {
    flex: 1,
  },
  bottomPrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  bottomDeposit: {
    fontSize: 12,
    color: '#6B7280',
  },
  rentButton: {
    minWidth: 140,
  },
  scrollContent: {
    paddingBottom: 100,
  },
});

export default ItemDetailScreen;
