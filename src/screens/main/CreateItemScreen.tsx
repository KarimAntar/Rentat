import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, CommonActions } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import Button from '../../components/ui/Button';
import { ItemService } from '../../services/firestore';
import { StorageService } from '../../services/storage';
import { useAuthContext } from '../../contexts/AuthContext';
import { ItemCondition } from '../../types';
import { CATEGORIES, getCategoryById } from '../../data/categories';
import { GOVERNORATES, Governorate } from '../../data/governorates';
import { commissionService } from '../../services/commission';

// Local form interface for the screen
interface CreateItemFormData {
  title: string;
  description: string;
  category: string;
  subcategory?: string;
  condition: ItemCondition;
  dailyRate: string;
  securityDeposit: string;
  governorate: string;
  minRentalDays: string;
  maxRentalDays: string;
  images: string[];
  deliveryOptions: {
    pickup: boolean;
    delivery: boolean;
    meetInMiddle: boolean;
  };
  policies: {
    cancellationPolicy: string;
  };
  specifications?: Record<string, string>;
}

const CONDITIONS: { value: ItemCondition; label: string; description: string }[] = [
  { value: 'new', label: 'New', description: 'Brand new, never used' },
  { value: 'like-new', label: 'Like New', description: 'Used once or twice, excellent condition' },
  { value: 'good', label: 'Good', description: 'Well maintained, some signs of use' },
  { value: 'fair', label: 'Fair', description: 'Used regularly, shows wear but works well' },
  { value: 'poor', label: 'Poor', description: 'Heavy use, may need repairs' },
];

const CreateItemScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuthContext();
  const [loading, setLoading] = useState(false);

  // Check email verification on component mount and redirect if not verified
  useEffect(() => {
    if (user && !user.emailVerified) {
      // Immediately redirect to verification screen
      Toast.show({
        type: 'info',
        text1: 'Email Verification Required',
        text2: 'Please verify your email to list items',
        position: 'top',
        visibilityTime: 3000,
      });
      
      // Redirect after a short delay to show the toast
      setTimeout(() => {
        navigation.navigate('Verification' as never);
      }, 500);
    }
  }, [user, navigation]);
  
  const [formData, setFormData] = useState<CreateItemFormData>({
    title: '',
    description: '',
    category: '',
    condition: 'good',
    dailyRate: '',
    securityDeposit: '',
    governorate: '',
    minRentalDays: '',
    maxRentalDays: '',
    images: [],
    deliveryOptions: {
      pickup: true,
      delivery: false,
      meetInMiddle: false,
    },
    policies: {
      cancellationPolicy: 'flexible',
    },
  });

  const [currentStep, setCurrentStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [commissionInfo, setCommissionInfo] = useState<{
    rate: number;
    tier: string;
    estimatedEarnings: number;
    commissionAmount: number;
  } | null>(null);

  // Calculate commission when daily rate or category changes
  useEffect(() => {
    const calculateCommission = async () => {
      if (!user || !formData.dailyRate || !formData.category) return;
      
      try {
        const dailyRate = parseFloat(formData.dailyRate);
        if (isNaN(dailyRate) || dailyRate <= 0) return;

        // Use the calculateCommission method which returns full calculation
        const calculation = await commissionService.calculateCommission(
          dailyRate * 100, // Convert to cents
          user.uid,
          formData.category
        );
        
        setCommissionInfo({
          rate: calculation.commissionRate * 100,
          tier: calculation.tier,
          estimatedEarnings: calculation.ownerPayout / 100, // Convert back to dollars
          commissionAmount: calculation.commissionAmount / 100, // Convert back to dollars
        });
      } catch (error) {
        console.error('Error calculating commission:', error);
      }
    };

    calculateCommission();
  }, [user, formData.dailyRate, formData.category]);

  const steps = [
    { title: 'Photos', subtitle: 'Add photos of your item' },
    { title: 'Details', subtitle: 'Describe your item' },
    { title: 'Pricing', subtitle: 'Set your rental price' },
    { title: 'Review', subtitle: 'Review and publish' },
  ];

  const pickImages = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        aspect: [4, 3],
      });

      if (!result.canceled && result.assets) {
        const newImages = result.assets.map(asset => asset.uri);
        setFormData(prev => ({
          ...prev,
          images: [...(prev.images || []), ...newImages].slice(0, 8), // Max 8 images
        }));
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick images. Please try again.');
    }
  };

  const takePhoto = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]) {
        setFormData(prev => ({
          ...prev,
          images: [...(prev.images || []), result.assets![0].uri].slice(0, 8),
        }));
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const removeImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images?.filter((_, i) => i !== index) || [],
    }));
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    switch (step) {
      case 0: // Photos
        if (!formData.images?.length) {
          newErrors.images = 'Please add at least one photo';
        }
        break;
      case 1: // Details
        if (!formData.title?.trim()) {
          newErrors.title = 'Title is required';
        }
        if (!formData.description?.trim()) {
          newErrors.description = 'Description is required';
        }
        if (!formData.category) {
          newErrors.category = 'Category is required';
        }
        break;
      case 2: // Pricing
        if (!formData.dailyRate || parseFloat(formData.dailyRate) <= 0) {
          newErrors.dailyRate = 'Daily rate must be greater than 0';
        }
        if (!formData.securityDeposit || parseFloat(formData.securityDeposit) < 0) {
          newErrors.securityDeposit = 'Security deposit must be 0 or greater';
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < steps.length - 1) {
        setCurrentStep(prev => prev + 1);
      } else {
        handleSubmit();
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    } else {
      navigation.goBack();
    }
  };

  const handleSubmit = async () => {
    console.log('Starting item submission...');
    
    if (!user) {
      Alert.alert('Error', 'You must be logged in to create a listing');
      return;
    }

    // Check email verification before allowing submission
    if (!user.emailVerified) {
      Alert.alert(
        'Email Verification Required',
        'You need to verify your email address before you can list items.',
        [
          {
            text: 'Verify Now',
            onPress: () => navigation.navigate('Verification' as never),
          },
          {
            text: 'Cancel',
            style: 'cancel'
          }
        ]
      );
      return;
    }

    setLoading(true);
    try {
      // Validate all required fields
      if (!formData.title?.trim() || 
          !formData.description?.trim() || 
          !formData.category ||
          !formData.dailyRate ||
          !formData.securityDeposit ||
          !formData.images?.length) {
        Alert.alert('Error', 'Please fill in all required fields');
        setLoading(false);
        return;
      }

      console.log('Validation passed, creating item data...');

      // Create proper item data with all required fields and no undefined values
      const itemData: any = {
        ownerId: user.uid,
        title: formData.title.trim(),
        description: formData.description.trim(),
        category: formData.category,
        condition: formData.condition,
        governorate: formData.governorate,
        images: [], // Will be updated after upload
        pricing: {
          dailyRate: parseFloat(formData.dailyRate),
          currency: 'USD',
          securityDeposit: parseFloat(formData.securityDeposit),
          weeklyDiscount: 0,
          monthlyDiscount: 0,
        },
        availability: {
          isAvailable: true,
          calendar: {},
          minRentalDays: formData.minRentalDays ? parseInt(formData.minRentalDays) : 1,
          maxRentalDays: formData.maxRentalDays ? parseInt(formData.maxRentalDays) : 30,
          advanceBookingDays: 365,
          blackoutDates: [],
        },
        location: {
          latitude: 37.7749, // Default to San Francisco coordinates
          longitude: -122.4194,
          address: 'Address not specified',
          city: 'City',
          state: 'State',
          country: 'US',
          postalCode: '00000',
          deliveryOptions: {
            pickup: formData.deliveryOptions?.pickup || false,
            delivery: formData.deliveryOptions?.delivery || false,
            meetInMiddle: formData.deliveryOptions?.meetInMiddle || false,
          },
          deliveryRadius: 10,
          deliveryFee: 0,
        },
        policies: {
          cancellationPolicy: formData.policies?.cancellationPolicy || 'flexible',
          houseRules: [],
          additionalFees: [],
        },
        ratings: { average: 0, count: 0 },
        stats: { views: 0, favorites: 0, totalRentals: 0, revenue: 0 },
        status: 'active' as const,
        featured: { isFeatured: false, boostLevel: 0 },
        tags: [],
        specifications: formData.specifications || {},
        isActive: true,
        // Remove createdAt and updatedAt - they will be added by Firestore
      };

      // Add subcategory only if it exists to avoid undefined values
      if (formData.subcategory) {
        itemData.subcategory = formData.subcategory;
      }

      // Create the item first to get the document ID
      console.log('Creating item in Firestore...');
      const itemId = await ItemService.createItem(itemData);
      console.log('Item created successfully with ID:', itemId);
      
      let imageUrls: string[] = [];
      
      // Upload images to Firebase Storage if any exist
      if (formData.images && formData.images.length > 0) {
        try {
          console.log('Uploading images to Storage...');
          const uploadResults = await StorageService.uploadItemImages(formData.images, itemId);
          imageUrls = uploadResults.map(result => result.url);
          console.log('Images uploaded successfully:', imageUrls);
          
          // Update the item with the image URLs
          console.log('Updating item with image URLs...');
          await ItemService.updateItem(itemId, { images: imageUrls });
          console.log('Item updated with images successfully');
        } catch (imageError) {
          console.error('Error uploading images:', imageError);
          // Continue without images rather than failing completely
          Alert.alert(
            'Warning', 
            'Images could not be uploaded, but your listing was created. You can add images later.'
          );
        }
      }
      
      console.log('Showing success toast and navigating...');
      
      // Show success toast
      Toast.show({
        type: 'success',
        text1: 'Success!',
        text2: 'Your item has been listed successfully.',
        position: 'top',
        visibilityTime: 3000,
      });
      
      // Navigate to the newly created item detail page and reset navigation stack
      setTimeout(() => {
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [
              { name: 'Main' },
              { name: 'ItemDetails', params: { itemId } }
            ],
          })
        );
      }, 500);
    } catch (error) {
      console.error('Error creating item:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to create listing. Please try again.',
        position: 'top',
        visibilityTime: 4000,
      });
    } finally {
      setLoading(false);
    }
  };

  const renderPhotosStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Add Photos</Text>
      <Text style={styles.stepSubtitle}>
        Upload clear, well-lit photos from different angles. The first photo will be your main image.
      </Text>

      <View style={styles.imageGrid}>
        {formData.images?.map((uri, index) => (
          <View key={index} style={styles.imageContainer}>
            <Image source={{ uri }} style={styles.image} />
            {index === 0 && (
              <View style={styles.mainImageBadge}>
                <Text style={styles.mainImageText}>Main</Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.removeImageButton}
              onPress={() => removeImage(index)}
            >
              <Ionicons name="close-circle" size={24} color="#EF4444" />
            </TouchableOpacity>
          </View>
        ))}
        
        {(formData.images?.length || 0) < 8 && (
          <TouchableOpacity style={styles.addImageButton} onPress={pickImages}>
            <Ionicons name="add" size={32} color="#6B7280" />
            <Text style={styles.addImageText}>Add Photo</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.photoActions}>
        <TouchableOpacity style={styles.photoActionButton} onPress={pickImages}>
          <Ionicons name="images" size={20} color="#4639eb" />
          <Text style={styles.photoActionText}>From Gallery</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.photoActionButton} onPress={takePhoto}>
          <Ionicons name="camera" size={20} color="#4639eb" />
          <Text style={styles.photoActionText}>Take Photo</Text>
        </TouchableOpacity>
      </View>

      {errors.images && <Text style={styles.errorText}>{errors.images}</Text>}
    </View>
  );

  const renderDetailsStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Item Details</Text>
      
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Title *</Text>
        <TextInput
          style={[styles.input, ...(errors.title ? [styles.inputError] : [])]}
          value={formData.title}
          onChangeText={(text) => setFormData(prev => ({ ...prev, title: text }))}
          placeholder="e.g., Professional DSLR Camera"
          maxLength={100}
        />
        {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Category *</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
          {CATEGORIES.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.categoryButton,
                formData.category === category.id && styles.categoryButtonActive
              ]}
              onPress={() => setFormData(prev => ({ ...prev, category: category.id }))}
            >
              <Ionicons 
                name={category.icon as any} 
                size={20} 
                color={formData.category === category.id ? '#FFFFFF' : '#6B7280'} 
              />
              <Text style={[
                styles.categoryButtonText,
                formData.category === category.id && styles.categoryButtonTextActive
              ]}>
                {category.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {errors.category && <Text style={styles.errorText}>{errors.category}</Text>}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Condition *</Text>
        <View style={styles.conditionList}>
          {CONDITIONS.map((condition) => (
            <TouchableOpacity
              key={condition.value}
              style={[
                styles.conditionButton,
                formData.condition === condition.value && styles.conditionButtonActive
              ]}
              onPress={() => setFormData(prev => ({ ...prev, condition: condition.value }))}
            >
              <View style={styles.conditionContent}>
                <Text style={[
                  styles.conditionLabel,
                  formData.condition === condition.value && styles.conditionLabelActive
                ]}>
                  {condition.label}
                </Text>
                <Text style={[
                  styles.conditionDescription,
                  formData.condition === condition.value && styles.conditionDescriptionActive
                ]}>
                  {condition.description}
                </Text>
              </View>
              {formData.condition === condition.value && (
                <Ionicons name="checkmark-circle" size={20} color="#4639eb" />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Governorate *</Text>
        {Platform.OS === 'web' ? (
          <View style={styles.governorateGrid}>
            {GOVERNORATES.map((governorate) => (
              <TouchableOpacity
                key={governorate.id}
                style={[
                  styles.governorateGridItem,
                  formData.governorate === governorate.id && styles.governorateButtonActive
                ]}
                onPress={() => setFormData(prev => ({ ...prev, governorate: governorate.id }))}
              >
                <Text style={[
                  styles.governorateButtonText,
                  formData.governorate === governorate.id && styles.governorateButtonTextActive
                ]}>
                  {governorate.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.governorateScroll}>
            {GOVERNORATES.map((governorate) => (
              <TouchableOpacity
                key={governorate.id}
                style={[
                  styles.governorateButton,
                  formData.governorate === governorate.id && styles.governorateButtonActive
                ]}
                onPress={() => setFormData(prev => ({ ...prev, governorate: governorate.id }))}
              >
                <Text style={[
                  styles.governorateButtonText,
                  formData.governorate === governorate.id && styles.governorateButtonTextActive
                ]}>
                  {governorate.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
        {errors.governorate && <Text style={styles.errorText}>{errors.governorate}</Text>}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Description *</Text>
        <TextInput
          style={[styles.textArea, ...(errors.description ? [styles.inputError] : [])]}
          value={formData.description}
          onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
          placeholder="Describe your item in detail. Include brand, model, features, and any important information for renters."
          multiline
          numberOfLines={4}
          maxLength={1000}
        />
        {errors.description && <Text style={styles.errorText}>{errors.description}</Text>}
      </View>
    </View>
  );

  const renderPricingStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Set Your Price</Text>
      
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Daily Rental Rate *</Text>
        <View style={styles.priceInputContainer}>
          <Text style={styles.currencySymbol}>$</Text>
          <TextInput
            style={[styles.priceInput, ...(errors.dailyRate ? [styles.inputError] : [])]}
            value={formData.dailyRate}
            onChangeText={(text) => setFormData(prev => ({ ...prev, dailyRate: text }))}
            placeholder="25.00"
            keyboardType="decimal-pad"
          />
          <Text style={styles.priceUnit}>/ day</Text>
        </View>
        {errors.dailyRate && <Text style={styles.errorText}>{errors.dailyRate}</Text>}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Security Deposit *</Text>
        <View style={styles.priceInputContainer}>
          <Text style={styles.currencySymbol}>$</Text>
          <TextInput
            style={[styles.priceInput, ...(errors.securityDeposit ? [styles.inputError] : [])]}
            value={formData.securityDeposit}
            onChangeText={(text) => setFormData(prev => ({ ...prev, securityDeposit: text }))}
            placeholder="50.00"
            keyboardType="decimal-pad"
          />
        </View>
        <Text style={styles.helperText}>
          Refundable deposit to cover potential damages
        </Text>
        {errors.securityDeposit && <Text style={styles.errorText}>{errors.securityDeposit}</Text>}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Rental Period</Text>
        <View style={styles.rentalPeriodContainer}>
          <View style={styles.rentalPeriodInput}>
            <Text style={styles.rentalPeriodLabel}>Min days</Text>
            <TextInput
              style={styles.rentalPeriodField}
              value={formData.minRentalDays}
              onChangeText={(text) => setFormData(prev => ({ ...prev, minRentalDays: text }))}
              placeholder="1"
              keyboardType="number-pad"
              maxLength={3}
            />
          </View>
          <View style={styles.rentalPeriodInput}>
            <Text style={styles.rentalPeriodLabel}>Max days</Text>
            <TextInput
              style={styles.rentalPeriodField}
              value={formData.maxRentalDays}
              onChangeText={(text) => setFormData(prev => ({ ...prev, maxRentalDays: text }))}
              placeholder="30"
              keyboardType="number-pad"
              maxLength={3}
            />
          </View>
        </View>
        <Text style={styles.helperText}>
          Set minimum and maximum rental duration (optional)
        </Text>
      </View>

      {/* Commission Preview */}
      {commissionInfo && formData.dailyRate && parseFloat(formData.dailyRate) > 0 && (
        <View style={styles.commissionPreview}>
          <View style={styles.commissionHeader}>
            <Ionicons name="information-circle" size={20} color="#4639eb" />
            <Text style={styles.commissionTitle}>Your Earnings Preview</Text>
          </View>
          
          <View style={styles.earningsBreakdown}>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Daily Rate</Text>
              <Text style={styles.breakdownValue}>
                ${parseFloat(formData.dailyRate).toFixed(2)}
              </Text>
            </View>
            
            <View style={styles.breakdownRow}>
              <View style={styles.breakdownLabelContainer}>
                <Text style={styles.breakdownLabel}>Platform Fee</Text>
                <View style={styles.tierBadge}>
                  <Text style={styles.tierBadgeText}>{commissionInfo.tier}</Text>
                </View>
              </View>
              <Text style={styles.breakdownFee}>
                -{commissionInfo.rate.toFixed(1)}% (${commissionInfo.commissionAmount.toFixed(2)})
              </Text>
            </View>
            
            <View style={styles.breakdownDivider} />
            
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabelBold}>You Earn (per day)</Text>
              <Text style={styles.breakdownEarnings}>
                ${commissionInfo.estimatedEarnings.toFixed(2)}
              </Text>
            </View>
          </View>

          <View style={styles.commissionTip}>
            <Ionicons name="bulb" size={16} color="#F59E0B" />
            <Text style={styles.commissionTipText}>
              Complete more rentals to unlock lower commission rates! Check your tier progress in Profile.
            </Text>
          </View>
        </View>
      )}

      <View style={styles.deliveryOptions}>
        <Text style={styles.label}>Delivery Options</Text>
        
        <TouchableOpacity
          style={styles.optionButton}
          onPress={() => setFormData(prev => ({
            ...prev,
            deliveryOptions: {
              ...prev.deliveryOptions!,
              pickup: !prev.deliveryOptions!.pickup
            }
          }))}
        >
          <Ionicons 
            name={formData.deliveryOptions?.pickup ? "checkbox" : "square-outline"} 
            size={20} 
            color="#4639eb" 
          />
          <Text style={styles.optionText}>Pickup at my location</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.optionButton}
          onPress={() => setFormData(prev => ({
            ...prev,
            deliveryOptions: {
              ...prev.deliveryOptions!,
              delivery: !prev.deliveryOptions!.delivery
            }
          }))}
        >
          <Ionicons 
            name={formData.deliveryOptions?.delivery ? "checkbox" : "square-outline"} 
            size={20} 
            color="#4639eb" 
          />
          <Text style={styles.optionText}>I can deliver (extra fee)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.optionButton}
          onPress={() => setFormData(prev => ({
            ...prev,
            deliveryOptions: {
              ...prev.deliveryOptions!,
              meetInMiddle: !prev.deliveryOptions!.meetInMiddle
            }
          }))}
        >
          <Ionicons 
            name={formData.deliveryOptions?.meetInMiddle ? "checkbox" : "square-outline"} 
            size={20} 
            color="#4639eb" 
          />
          <Text style={styles.optionText}>Meet halfway</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderReviewStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Review Your Listing</Text>
      
      <View style={styles.reviewCard}>
        {formData.images?.[0] && (
          <Image source={{ uri: formData.images[0] }} style={styles.reviewImage} />
        )}
        
        <View style={styles.reviewContent}>
          <Text style={styles.reviewTitle}>{formData.title}</Text>
          <Text style={styles.reviewCategory}>
            {CATEGORIES.find(c => c.id === formData.category)?.name}
          </Text>
          <Text style={styles.reviewCondition}>
            Condition: {CONDITIONS.find(c => c.value === formData.condition)?.label}
          </Text>
          <Text style={styles.reviewPrice}>
            ${formData.dailyRate}/day • ${formData.securityDeposit} deposit
          </Text>
          <Text style={styles.reviewDescription} numberOfLines={3}>
            {formData.description}
          </Text>
        </View>
      </View>

      <Text style={styles.reviewNote}>
        By publishing this listing, you agree to our Terms of Service and Community Guidelines.
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{steps[currentStep].title}</Text>
          <Text style={styles.stepIndicator}>{currentStep + 1}/{steps.length}</Text>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill, 
              { width: `${((currentStep + 1) / steps.length) * 100}%` }
            ]} 
          />
        </View>

        {/* Content */}
        <ScrollView style={styles.content}>
          {currentStep === 0 && renderPhotosStep()}
          {currentStep === 1 && renderDetailsStep()}
          {currentStep === 2 && renderPricingStep()}
          {currentStep === 3 && renderReviewStep()}
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <Button
            title={currentStep === steps.length - 1 ? "Publish Listing" : "Continue"}
            onPress={handleNext}
            loading={loading}
            style={styles.continueButton}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  stepIndicator: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E5E7EB',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4639eb',
  },
  content: {
    flex: 1,
  },
  stepContainer: {
    padding: 16,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 24,
    lineHeight: 24,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  imageContainer: {
    position: 'relative',
    width: 80,
    height: 80,
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  mainImageBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: '#4639eb',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  mainImageText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
  },
  addImageButton: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addImageText: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center',
  },
  photoActions: {
    flexDirection: 'row',
    gap: 16,
  },
  photoActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    gap: 8,
  },
  photoActionText: {
    color: '#4639eb',
    fontWeight: '500',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  categoryScroll: {
    marginBottom: 8,
  },
  categoryButton: {
    flexDirection: 'column',
    alignItems: 'center',
    padding: 12,
    marginRight: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minWidth: 80,
  },
  categoryButtonActive: {
    backgroundColor: '#4639eb',
    borderColor: '#4639eb',
  },
  categoryButtonText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center',
  },
  categoryButtonTextActive: {
    color: '#FFFFFF',
  },
  governorateScroll: {
    marginBottom: 8,
  },
  governorateButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minWidth: 100,
  },
  governorateButtonActive: {
    backgroundColor: '#4639eb',
    borderColor: '#4639eb',
  },
  governorateButtonText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    fontWeight: '500',
  },
  governorateButtonTextActive: {
    color: '#FFFFFF',
  },
  governorateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8,
  },
  governorateGridItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minWidth: 100,
  },
  conditionList: {
    gap: 8,
  },
  conditionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  conditionButtonActive: {
    borderColor: '#4639eb',
    backgroundColor: '#F0F9FF',
  },
  conditionContent: {
    flex: 1,
  },
  conditionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  conditionLabelActive: {
    color: '#4639eb',
  },
  conditionDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  conditionDescriptionActive: {
    color: '#4639eb',
  },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    paddingLeft: 12,
  },
  priceInput: {
    flex: 1,
    padding: 12,
    fontSize: 18,
    fontWeight: '600',
  },
  priceUnit: {
    fontSize: 16,
    color: '#6B7280',
    paddingRight: 12,
  },
  helperText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  deliveryOptions: {
    marginTop: 20,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  optionText: {
    fontSize: 16,
    color: '#111827',
  },
  reviewCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  reviewImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 12,
  },
  reviewContent: {
    gap: 4,
  },
  reviewTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  reviewCategory: {
    fontSize: 14,
    color: '#4639eb',
    fontWeight: '500',
  },
  reviewCondition: {
    fontSize: 14,
    color: '#6B7280',
  },
  reviewPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginTop: 4,
  },
  reviewDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
    lineHeight: 20,
  },
  reviewNote: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 16,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  continueButton: {
    marginTop: 0,
  },
  rentalPeriodContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  rentalPeriodInput: {
    flex: 1,
  },
  rentalPeriodLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  rentalPeriodField: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    textAlign: 'center',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 4,
  },
  commissionPreview: {
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  commissionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  commissionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E40AF',
  },
  earningsBreakdown: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  breakdownLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  breakdownLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  breakdownLabelBold: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  breakdownFee: {
    fontSize: 14,
    fontWeight: '500',
    color: '#EF4444',
  },
  breakdownDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 8,
  },
  breakdownEarnings: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#10B981',
  },
  tierBadge: {
    backgroundColor: '#E0E7FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  tierBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#4639eb',
  },
  commissionTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEF3C7',
    padding: 10,
    borderRadius: 8,
  },
  commissionTipText: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
    lineHeight: 16,
  },
});

export default CreateItemScreen;
