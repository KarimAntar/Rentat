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
import { ReviewService, RentalService, ItemService, UserService } from '../../services/firestore';
import { useAuthContext } from '../../contexts/AuthContext';
import { Rental, Item, User, Review } from '../../types';

interface ReviewScreenProps {
  route: {
    params: {
      rentalId: string;
      reviewType: 'owner-to-renter' | 'renter-to-owner';
    };
  };
}

const ReviewScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { rentalId, reviewType } = route.params as { rentalId: string; reviewType: 'owner-to-renter' | 'renter-to-owner' };
  const { user } = useAuthContext();

  const [rental, setRental] = useState<Rental | null>(null);
  const [item, setItem] = useState<Item | null>(null);
  const [reviewee, setReviewee] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Review form state
  const [overallRating, setOverallRating] = useState(0);
  const [communicationRating, setCommunicationRating] = useState(0);
  const [reliabilityRating, setReliabilityRating] = useState(0);
  const [conditionRating, setConditionRating] = useState(0);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [recommend, setRecommend] = useState<boolean | null>(null);

  useEffect(() => {
    loadData();
  }, [rentalId]);

  const loadData = async () => {
    try {
      setLoading(true);

      const rentalData = await RentalService.getRental(rentalId);
      if (!rentalData) {
        Alert.alert('Error', 'Rental not found');
        navigation.goBack();
        return;
      }

      // Verify user is authorized to review this rental
      const isOwner = rentalData.ownerId === user?.uid;
      const isRenter = rentalData.renterId === user?.uid;

      if (reviewType === 'owner-to-renter' && !isOwner) {
        Alert.alert('Unauthorized', 'Only the owner can leave this review');
        navigation.goBack();
        return;
      }

      if (reviewType === 'renter-to-owner' && !isRenter) {
        Alert.alert('Unauthorized', 'Only the renter can leave this review');
        navigation.goBack();
        return;
      }

      setRental(rentalData);

      // Load item details
      const itemData = await ItemService.getItem(rentalData.itemId);
      setItem(itemData);

      // Load reviewee details
      const revieweeId = reviewType === 'owner-to-renter' ? rentalData.renterId : rentalData.ownerId;
      const revieweeData = await UserService.getUser(revieweeId);
      setReviewee(revieweeData);

    } catch (error) {
      console.error('Error loading review data:', error);
      Alert.alert('Error', 'Failed to load review data');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!rental || !user || !reviewee) return;

    if (overallRating === 0) {
      Alert.alert('Rating Required', 'Please provide an overall rating');
      return;
    }

    if (!comment.trim()) {
      Alert.alert('Comment Required', 'Please provide a review comment');
      return;
    }

    try {
      setSubmitting(true);

      const reviewData: Omit<Review, 'id' | 'createdAt' | 'updatedAt'> = {
        rentalId: rental.id,
        reviewerId: user.uid,
        revieweeId: reviewType === 'owner-to-renter' ? rental.renterId : rental.ownerId,
        itemId: rental.itemId,
        type: reviewType,
        ratings: {
          overall: overallRating,
          communication: communicationRating || undefined,
          reliability: reliabilityRating || undefined,
          condition: conditionRating || undefined,
        },
        review: {
          title: title.trim() || undefined,
          comment: comment.trim(),
        },
        response: undefined,
        status: 'active',
        flags: [],
        helpfulVotes: {
          count: 0,
          voters: [],
        },
      };

      await ReviewService.createReview(reviewData);

      Alert.alert(
        'Review Submitted',
        'Thank you for your feedback! Your review helps build trust in our community.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );

    } catch (error) {
      console.error('Error submitting review:', error);
      Alert.alert('Error', 'Failed to submit review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStarRating = (
    rating: number,
    onRatingChange: (rating: number) => void,
    label: string
  ) => (
    <View style={styles.ratingSection}>
      <Text style={styles.ratingLabel}>{label}</Text>
      <View style={styles.starContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => onRatingChange(star)}
            style={styles.starButton}
          >
            <Ionicons
              name={star <= rating ? 'star' : 'star-outline'}
              size={24}
              color={star <= rating ? '#FFC107' : '#D1D5DB'}
            />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  if (loading || !rental || !item || !reviewee) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.loadingText}>Loading review details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isOwnerReviewingRenter = reviewType === 'owner-to-renter';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isOwnerReviewingRenter ? 'Review Renter' : 'Review Owner'}
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Review Context */}
        <View style={styles.contextSection}>
          <View style={styles.itemInfo}>
            <Image
              source={{ uri: item.images[0] || 'https://via.placeholder.com/60x60?text=Item' }}
              style={styles.itemImage}
            />
            <View style={styles.itemDetails}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.rentalPeriod}>
                {new Date(rental.dates.confirmedStart || rental.dates.requestedStart).toLocaleDateString()} - {' '}
                {new Date(rental.dates.confirmedEnd || rental.dates.requestedEnd).toLocaleDateString()}
              </Text>
            </View>
          </View>

          <View style={styles.revieweeInfo}>
            <Image
              source={{ uri: reviewee.photoURL || 'https://via.placeholder.com/50x50?text=User' }}
              style={styles.revieweeAvatar}
            />
            <View style={styles.revieweeDetails}>
              <Text style={styles.revieweeName}>
                Reviewing {reviewee.displayName}
              </Text>
              <Text style={styles.reviewType}>
                {isOwnerReviewingRenter ? 'How was your experience with this renter?' : 'How was your experience with this owner?'}
              </Text>
            </View>
          </View>
        </View>

        {/* Ratings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rate Your Experience</Text>

          {renderStarRating(overallRating, setOverallRating, 'Overall Experience *')}

          {isOwnerReviewingRenter ? (
            <>
              {renderStarRating(communicationRating, setCommunicationRating, 'Communication')}
              {renderStarRating(reliabilityRating, setReliabilityRating, 'Reliability')}
            </>
          ) : (
            <>
              {renderStarRating(communicationRating, setCommunicationRating, 'Communication')}
              {renderStarRating(conditionRating, setConditionRating, 'Item Condition')}
            </>
          )}
        </View>

        {/* Review Content */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Review</Text>

          <TextInput
            style={styles.titleInput}
            placeholder="Review title (optional)"
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />

          <TextInput
            style={styles.commentInput}
            placeholder="Share your experience... *"
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={6}
            maxLength={1000}
            textAlignVertical="top"
          />
          <Text style={styles.characterCount}>{comment.length}/1000</Text>
        </View>

        {/* Recommendation */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Would you recommend?</Text>

          <View style={styles.recommendationContainer}>
            <TouchableOpacity
              style={[
                styles.recommendationButton,
                recommend === true && styles.recommendationButtonSelected,
              ]}
              onPress={() => setRecommend(true)}
            >
              <Ionicons
                name="thumbs-up"
                size={20}
                color={recommend === true ? '#10B981' : '#6B7280'}
              />
              <Text style={[
                styles.recommendationText,
                recommend === true && styles.recommendationTextSelected,
              ]}>
                Yes, I recommend
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.recommendationButton,
                recommend === false && styles.recommendationButtonSelected,
              ]}
              onPress={() => setRecommend(false)}
            >
              <Ionicons
                name="thumbs-down"
                size={20}
                color={recommend === false ? '#EF4444' : '#6B7280'}
              />
              <Text style={[
                styles.recommendationText,
                recommend === false && styles.recommendationTextSelected,
              ]}>
                No, I don't recommend
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Guidelines */}
        <View style={styles.guidelinesSection}>
          <Text style={styles.guidelinesTitle}>Review Guidelines</Text>
          <Text style={styles.guidelinesText}>
            • Be honest and constructive{'\n'}
            • Focus on your experience{'\n'}
            • Avoid personal attacks{'\n'}
            • Keep it relevant to the rental
          </Text>
        </View>
      </ScrollView>

      {/* Submit Button */}
      <View style={styles.footer}>
        <Button
          title="Submit Review"
          onPress={handleSubmitReview}
          loading={submitting}
          disabled={submitting || overallRating === 0 || !comment.trim()}
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
  contextSection: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginTop: 8,
  },
  itemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  itemDetails: {
    flex: 1,
    marginLeft: 12,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  rentalPeriod: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  revieweeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  revieweeAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  revieweeDetails: {
    flex: 1,
    marginLeft: 12,
  },
  revieweeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  reviewType: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
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
  ratingSection: {
    marginBottom: 20,
  },
  ratingLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  starContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  starButton: {
    padding: 4,
  },
  titleInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  commentInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 120,
    textAlignVertical: 'top',
  },
  characterCount: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'right',
    marginTop: 4,
  },
  recommendationContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  recommendationButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  recommendationButtonSelected: {
    backgroundColor: '#F0F9FF',
    borderColor: '#4639eb',
  },
  recommendationText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  recommendationTextSelected: {
    color: '#4639eb',
  },
  guidelinesSection: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginTop: 8,
    marginBottom: 16,
  },
  guidelinesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  guidelinesText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
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

export default ReviewScreen;
