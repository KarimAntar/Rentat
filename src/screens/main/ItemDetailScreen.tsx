import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
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
import { useModal } from '../../contexts/ModalContext';
import { authService } from '../../services/auth';
import ChatService from '../../services/chat';
import { reviewService } from '../../services/reviews';
import { Item, User, Review } from '../../types';
import { getCategoryById } from '../../data/categories';
import { getGovernorateById } from '../../data/governorates';
import { moderationService, ReportReason } from '../../services/moderation';
import ReportModal from '../../components/ui/ReportModal';
import ImageGallery from '../../components/ImageGallery';


const { width } = Dimensions.get('window');

const ItemDetailScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { itemId } = route.params as { itemId: string };
  const { user } = useAuthContext();
  const { showModal } = useModal();

  const [item, setItem] = useState<Item | null>(null);
  const [owner, setOwner] = useState<User | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);

  // Modal state
  const [reportModalVisible, setReportModalVisible] = useState(false);

  useEffect(() => {
    loadItem();
  }, [itemId]);

  useEffect(() => {
    if (owner?.uid) {
      loadReviews();
    }
  }, [owner?.uid]);

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
      showModal({
        title: 'Error',
        message: 'Failed to load item details',
        type: 'error',
      });
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
      showModal({
        title: 'Cannot Rent',
        message: 'You cannot rent your own item',
        type: 'warning',
      });
      return;
    }
    (navigation as any).navigate('RentalRequest', { itemId: item?.id });
  };

  const handleFavorite = async () => {
    if (!user) {
      showModal({
        title: 'Sign In Required',
        message: 'Please sign in to save favorites',
        type: 'info',
      });
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

  const handleReport = () => {
    if (!user) {
      showModal({
        title: 'Sign In Required',
        message: 'Please sign in to report this item',
        type: 'info',
      });
      return;
    }

    if (item?.ownerId === user.uid) {
      showModal({
        title: 'Cannot Report',
        message: 'You cannot report your own item',
        type: 'warning',
      });
      return;
    }

    setReportModalVisible(true);
  };

  const handleReportSubmit = async (reason: ReportReason, description: string) => {
    if (!item || !user) return;

    try {
      await moderationService.reportItem(
        item.id,
        user.uid,
        reason,
        description
      );

      Toast.show({
        type: 'success',
        text1: 'Report Submitted',
        text2: 'Thank you for helping keep Rentat safe',
        position: 'top',
      });
    } catch (error) {
      console.error('Error submitting report:', error);
      showModal({
        title: 'Error',
        message: 'Failed to submit report. Please try again.',
        type: 'error',
      });
    }
  };

  const handleContact = async () => {
    if (!user) {
      showModal({
        title: 'Sign In Required',
        message: 'Please sign in to contact the owner',
        type: 'info',
      });
      return;
    }
    if (!item || item.ownerId === user.uid) {
      showModal({
        title: 'Cannot Contact',
        message: 'You cannot contact yourself',
        type: 'warning',
      });
      return;
    }

    try {
      // Find existing chat or create new one
      const existingChat = await ChatService.findChatByParticipants(
        [user.uid, item.ownerId],
        { itemId: item.id, type: 'general' }
      );

      let chatToNavigate = existingChat;
      if (!existingChat) {
        // Create new chat
        chatToNavigate = await ChatService.getOrCreateDirectChat(
          user.uid,
          item.ownerId,
          { itemId: item.id, type: 'general' }
        );
      }

      if (chatToNavigate) {
        // Navigate directly to the chat
        (navigation as any).navigate('Chat', {
          chatId: chatToNavigate.id,
          otherUserId: item.ownerId,
          itemId: item.id,
        });
      }
    } catch (error) {
      console.error('Error creating/finding chat:', error);
      showModal({
        title: 'Error',
        message: 'Failed to open chat. Please try again.',
        type: 'error',
      });
    }
  };

  const handleEdit = () => {
    if (!item) return;
    (navigation as any).navigate('EditItem', { itemId: item.id });
  };

  const handleDelete = () => {
    if (!item) return;
    showModal({
      title: 'Delete Item',
      message: 'Are you sure you want to remove this listing?',
      buttons: [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {},
        },
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
              showModal({
                title: 'Error',
                message: 'Failed to delete item',
                type: 'error',
              });
            }
          },
        },
      ],
      type: 'warning',
    });
  };

  const loadReviews = async () => {
    if (!owner?.uid) return;

    try {
      const { reviews: ownerReviews } = await reviewService.getUserReviews(
        owner.uid,
        'renter-to-owner',
        { limit: 3 }
      );
      setReviews(ownerReviews);
    } catch (error) {
      console.error('Error loading reviews:', error);
    }
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
            {item?.ownerId !== user?.uid && (
              <TouchableOpacity onPress={handleReport} style={styles.actionButton}>
                <Ionicons name="flag-outline" size={24} color="#111827" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollView} contentContainerStyle={{ paddingBottom: 120 }}>
          <View style={styles.imageContainer}>
            <ImageGallery
              images={item.images || []}
              height={400}
              thumbnailHeight={60}
              showThumbnails={true}
            />
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
              <TouchableOpacity
                style={styles.ownerInfo}
                onPress={() => {
                  if (owner?.uid && owner.uid !== user?.uid) {
                    (navigation as any).navigate('PublicProfile', { userId: owner.uid });
                  }
                }}
                disabled={!owner?.uid || owner.uid === user?.uid}
              >
                <Image
                  source={{
                    uri: owner?.photoURL || 'https://via.placeholder.com/48x48?text=U',
                  }}
                  style={styles.ownerAvatar}
                />
                <View style={styles.ownerDetails}>
                  <View style={styles.ownerNameRow}>
                    <Text style={[styles.ownerName, owner?.uid && owner.uid !== user?.uid ? styles.ownerNameClickable : null]}>
                      {owner?.displayName || (owner?.email ? owner.email.split('@')[0] : 'Owner')}
                    </Text>
                    {owner?.verification?.isVerified && (
                      <View style={styles.verificationBadge}>
                        <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                        <Text style={styles.verificationText}>Verified</Text>
                      </View>
                    )}
                  </View>
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
              </TouchableOpacity>
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

            {/* Reviews Section */}
            <View style={styles.section}>
              <View style={styles.reviewsHeader}>
                <Text style={styles.sectionTitle}>Reviews</Text>
                <TouchableOpacity
                  onPress={() => {
                    if (owner?.uid) {
                      (navigation as any).navigate('PublicProfile', { userId: owner.uid });
                    }
                  }}
                >
                  <Text style={styles.seeAllText}>See all</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.ratingSummary}>
                <View style={styles.ratingStars}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Ionicons
                      key={star}
                      name={
                        star <= Math.floor(owner?.ratings?.asOwner?.average || 0)
                          ? 'star'
                          : star - (owner?.ratings?.asOwner?.average || 0) < 1
                          ? 'star-half'
                          : 'star-outline'
                      }
                      size={20}
                      color="#FFC107"
                    />
                  ))}
                </View>
                <Text style={styles.ratingText}>
                  {owner?.ratings?.asOwner?.average?.toFixed(1) || '0.0'} ({owner?.ratings?.asOwner?.count || 0} reviews)
                </Text>
              </View>

              {reviews.length > 0 ? (
                <View style={styles.recentReviews}>
                  {reviews.slice(0, 3).map((review) => (
                    <View key={review.id} style={styles.reviewItem}>
                      <View style={styles.reviewStars}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Ionicons
                            key={star}
                            name={
                              star <= review.ratings.overall
                                ? 'star'
                                : star - review.ratings.overall < 1
                                ? 'star-half'
                                : 'star-outline'
                            }
                            size={14}
                            color="#FFC107"
                          />
                        ))}
                      </View>
                      {review.review?.comment && (
                        <Text style={styles.reviewComment} numberOfLines={2}>
                          {review.review.comment}
                        </Text>
                      )}
                      <Text style={styles.reviewDate}>
                        {review.createdAt?.toLocaleDateString()}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.noReviewsContainer}>
                  <Ionicons name="star-outline" size={32} color="#D1D5DB" />
                  <Text style={styles.noReviewsText}>No reviews yet</Text>
                  <Text style={styles.noReviewsSubtext}>
                    Reviews will appear here after completed rentals
                  </Text>
                </View>
              )}
            </View>
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
            padding: 12,
            paddingBottom: 24,
            borderTop: '1px solid #E5E7EB',
            backgroundColor: '#FFFFFF',
            gap: 12,
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ flex: 1, fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif', boxSizing: 'border-box' }}>
            <div style={{ fontSize: 20, fontWeight: 'bold', color: '#111827', fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif' }}>
              {formatPrice(item.pricing.dailyRate)}/day
            </div>
            <div style={{ fontSize: 12, color: '#6B7280', fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif' }}>
              +{formatPrice(item.pricing.securityDeposit)} deposit
            </div>
          </div>
          <div style={{ marginRight: 16 }}>
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
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Button
              title="Request Rental"
              onPress={handleRentRequest}
              disabled={!item.availability.isAvailable || item.ownerId === user?.uid}
              style={{ minWidth: 140, marginRight: 32 }}
            />
          </View>
        </View>
      )}

      {/* Report Modal */}
      <ReportModal
        visible={reportModalVisible}
        title="Report Item"
        message="Why are you reporting this item?"
        reasons={[
          { label: 'Spam', value: 'spam' },
          { label: 'Inappropriate Content', value: 'inappropriate_content' },
          { label: 'Scam/Fraud', value: 'scam' },
          { label: 'Fake Listing', value: 'fake_listing' },
          { label: 'Dangerous Item', value: 'dangerous_item' },
          { label: 'Other', value: 'other' },
        ]}
        onSubmit={handleReportSubmit}
        onCancel={() => setReportModalVisible(false)}
        type="item"
      />
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
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
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
  ownerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ownerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  ownerNameClickable: {
    color: '#4639eb',
    textDecorationLine: 'underline',
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
    padding: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    gap: 12,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  priceInfo: {
    flex: 1,
    flexDirection: 'column',
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
    marginRight: 12,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  reviewsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  seeAllText: {
    fontSize: 14,
    color: '#4639eb',
    fontWeight: '500',
  },
  ratingSummary: {
    alignItems: 'center',
    marginBottom: 16,
  },
  ratingStars: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 8,
  },
  ratingText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  recentReviews: {
    gap: 12,
  },
  reviewItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  reviewStars: {
    flexDirection: 'row',
    gap: 2,
    marginBottom: 8,
  },
  reviewComment: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 8,
  },
  reviewDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  noReviewsContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  noReviewsText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
    marginTop: 12,
    marginBottom: 4,
  },
  noReviewsSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default ItemDetailScreen;
