import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  Alert,
  Modal,
  Dimensions,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';


type RootStackParamList = {
  ItemDetails: { itemId: string };
  // Add other routes if needed
};

type NavigationProp = StackNavigationProp<RootStackParamList>;
import { ItemService } from '../../services/firestore';
import { Item, ItemCondition } from '../../types';
import { CATEGORIES, searchCategories } from '../../data/categories';
import { getGovernorateById } from '../../data/governorates';
import { searchService, SearchResult, SearchSuggestion, SearchFilters } from '../../services/search';
import { useAuthContext } from '../../contexts/AuthContext';
import { useUserProfile } from '../../services/userProfile';
import { locationService } from '../../services/location';
import AsyncStorage from '@react-native-async-storage/async-storage';



const SearchScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuthContext();
  const { addToFavorites, removeFromFavorites, isItemFavorited } = useUserProfile();
  const [searchQuery, setSearchQuery] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [trendingSearches, setTrendingSearches] = useState<string[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const [filters, setFilters] = useState<Partial<SearchFilters>>({
    sortBy: 'relevance',
  });



  // Load trending searches, recent searches, and favorites on mount
  useEffect(() => {
    loadTrendingSearches();
    loadRecentSearches();
    loadUserFavorites();
  }, [user]);

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.length >= 2) {
        loadSuggestions();
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Search when filters change
  useEffect(() => {
    performSearch();
  }, [selectedCategory, filters]);

  const loadTrendingSearches = async () => {
    try {
      const trending = await searchService.getTrendingSearches(10);
      setTrendingSearches(trending);
    } catch (error) {
      console.error('Error loading trending searches:', error);
    }
  };

  const loadRecentSearches = async () => {
    try {
      const recent = await AsyncStorage.getItem('recentSearches');
      if (recent) {
        setRecentSearches(JSON.parse(recent));
      }
    } catch (error) {
      console.error('Error loading recent searches:', error);
    }
  };

  const saveRecentSearch = async (query: string) => {
    try {
      const updated = [query, ...recentSearches.filter(s => s !== query)].slice(0, 10);
      setRecentSearches(updated);
      await AsyncStorage.setItem('recentSearches', JSON.stringify(updated));
    } catch (error) {
      console.error('Error saving recent search:', error);
    }
  };

  const loadUserFavorites = async () => {
    if (!user) return;

    try {
      const userFavorites = await useUserProfile().getUserFavorites(user.uid);
      setFavorites(new Set(userFavorites));
    } catch (error) {
      console.error('Error loading user favorites:', error);
    }
  };

  const toggleFavorite = async (itemId: string) => {
    if (!user) {
      Alert.alert('Login Required', 'Please log in to save favorites');
      return;
    }

    try {
      const isFavorited = favorites.has(itemId);
      const newFavorites = new Set(favorites);

      if (isFavorited) {
        await removeFromFavorites(user.uid, itemId);
        newFavorites.delete(itemId);
      } else {
        await addToFavorites(user.uid, itemId);
        newFavorites.add(itemId);
      }

      setFavorites(newFavorites);
    } catch (error) {
      console.error('Error toggling favorite:', error);
      Alert.alert('Error', 'Failed to update favorites');
    }
  };

  const loadSuggestions = async () => {
    try {
      const suggestions = await searchService.getSearchSuggestions(searchQuery, 5);
      setSuggestions(suggestions);
      setShowSuggestions(suggestions.length > 0);
    } catch (error) {
      console.error('Error loading suggestions:', error);
    }
  };

  const performSearch = async () => {
    try {
      setLoading(true);

      const searchFilters: SearchFilters = {
        query: searchQuery || undefined,
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        sortBy: filters.sortBy || 'relevance',
      };

      const result = await searchService.search(searchFilters);
      setSearchResult(result);
      setItems(result.items);

      // Save search query if it's not empty
      if (searchQuery.trim()) {
        saveRecentSearch(searchQuery.trim());
      }
    } catch (error) {
      console.error('Error performing search:', error);
      Alert.alert('Error', 'Failed to perform search');
    } finally {
      setLoading(false);
    }
  };

  const handleItemPress = (item: Item) => {
    console.log('Navigate to item detail:', item.id);
    navigation.navigate('ItemDetails', { itemId: item.id });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EGP',
    }).format(price);
  };

  const renderItem = ({ item }: { item: Item }) => (
    <TouchableOpacity style={styles.itemCard} onPress={() => handleItemPress(item)}>
      <Image
        source={{
          uri: item.images?.[0] || 'https://via.placeholder.com/200x150?text=No+Image',
        }}
        style={styles.itemImage}
        resizeMode="cover"
      />
      <View style={styles.itemDetails}>
        <Text style={styles.itemTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.itemCategory}>
          {CATEGORIES.find(c => c.id === item.category)?.name || item.category}
        </Text>
        <View style={styles.itemPricing}>
          <Text style={styles.itemPrice}>
            {formatPrice(item.pricing.dailyRate)}/day
          </Text>
          <View style={styles.itemRating}>
            <Ionicons name="star" size={14} color="#FFC107" />
            <Text style={styles.ratingText}>
              {item.ratings.average.toFixed(1)} ({item.ratings.count})
            </Text>
          </View>
        </View>
        <View style={styles.itemLocation}>
          <Ionicons name="location-outline" size={14} color="#6B7280" />
          <Text style={styles.locationText}>
            {getGovernorateById(item.governorate)?.name || 'Location not specified'}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.favoriteButton}
        onPress={() => toggleFavorite(item.id)}
      >
        <Ionicons
          name={favorites.has(item.id) ? "heart" : "heart-outline"}
          size={20}
          color={favorites.has(item.id) ? "#EF4444" : "#6B7280"}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="search-outline" size={64} color="#D1D5DB" />
      <Text style={styles.emptyText}>
        {searchQuery ? 'No items found' : 'Start searching for items'}
      </Text>
      <Text style={styles.emptySubtext}>
        {searchQuery 
          ? 'Try adjusting your search terms or filters'
          : 'Use the search bar above to find items near you'
        }
      </Text>
    </View>
  );

  const CategoryFilter = () => (
    <View style={styles.categoryFilter}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <TouchableOpacity
          style={[
            styles.categoryChip,
            selectedCategory === 'all' && styles.categoryChipActive,
          ]}
          onPress={() => setSelectedCategory('all')}
        >
          <Text
            style={[
              styles.categoryText,
              selectedCategory === 'all' && styles.categoryTextActive,
            ]}
          >
            All
          </Text>
        </TouchableOpacity>

        {CATEGORIES.map((category) => (
          <TouchableOpacity
            key={category.id}
            style={[
              styles.categoryChip,
              selectedCategory === category.id && styles.categoryChipActive,
            ]}
            onPress={() => setSelectedCategory(category.id)}
          >
            <Ionicons
              name={category.icon as any}
              size={16}
              color={selectedCategory === category.id ? '#FFFFFF' : '#6B7280'}
              style={styles.categoryIcon}
            />
            <Text
              style={[
                styles.categoryText,
                selectedCategory === category.id && styles.categoryTextActive,
              ]}
            >
              {category.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const AdvancedFilterModal = () => {
    const [tempFilters, setTempFilters] = useState<Partial<SearchFilters>>(filters);

    const handleApplyFilters = () => {
      setFilters(tempFilters);
      setShowAdvancedFilters(false);
    };

    const handleResetFilters = () => {
      const resetFilters: Partial<SearchFilters> = { sortBy: 'relevance' };
      setTempFilters(resetFilters);
      setFilters(resetFilters);
      setShowAdvancedFilters(false);
    };

    const updateTempFilter = (key: keyof SearchFilters, value: any) => {
      setTempFilters(prev => ({ ...prev, [key]: value }));
    };

    return (
      <Modal
        visible={showAdvancedFilters}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAdvancedFilters(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setShowAdvancedFilters(false)}
              style={styles.modalCloseButton}
            >
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Advanced Filters</Text>
            <TouchableOpacity onPress={handleResetFilters}>
              <Text style={styles.resetText}>Reset</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Condition */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Condition</Text>
              <View style={styles.conditionContainer}>
                {(['new', 'excellent', 'good', 'fair'] as const).map((condition) => (
                  <TouchableOpacity
                    key={condition}
                    style={[
                      styles.conditionChip,
                      tempFilters.condition?.includes(condition) && styles.conditionChipActive
                    ]}
                    onPress={() => {
                      const currentConditions = tempFilters.condition || [];
                      const newConditions = currentConditions.includes(condition)
                        ? currentConditions.filter(c => c !== condition)
                        : [...currentConditions, condition];
                      updateTempFilter('condition', newConditions);
                    }}
                  >
                    <Text
                      style={[
                        styles.conditionText,
                        tempFilters.condition?.includes(condition) && styles.conditionTextActive
                      ]}
                    >
                      {condition.charAt(0).toUpperCase() + condition.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Additional Filters */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Additional Filters</Text>
              <View style={styles.additionalFilters}>
                <TouchableOpacity
                  style={styles.filterOption}
                  onPress={() => updateTempFilter('verifiedOwners', !tempFilters.verifiedOwners)}
                >
                  <View style={styles.checkbox}>
                    {tempFilters.verifiedOwners && <Ionicons name="checkmark" size={16} color="#4639eb" />}
                  </View>
                  <Text style={styles.filterOptionText}>Verified owners only</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.filterOption}
                  onPress={() => updateTempFilter('instantBooking', !tempFilters.instantBooking)}
                >
                  <View style={styles.checkbox}>
                    {tempFilters.instantBooking && <Ionicons name="checkmark" size={16} color="#4639eb" />}
                  </View>
                  <Text style={styles.filterOptionText}>Instant booking</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Sort Options */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Sort By</Text>
              <View style={styles.sortOptions}>
                {[
                  { value: 'relevance', label: 'Relevance' },
                  { value: 'price_low', label: 'Price: Low to High' },
                  { value: 'price_high', label: 'Price: High to Low' },
                  { value: 'rating', label: 'Highest Rated' },
                  { value: 'distance', label: 'Distance' },
                  { value: 'newest', label: 'Newest First' }
                ].map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.sortOption,
                      tempFilters.sortBy === option.value && styles.sortOptionActive
                    ]}
                    onPress={() => updateTempFilter('sortBy', option.value as any)}
                  >
                    <Text
                      style={[
                        styles.sortOptionText,
                        tempFilters.sortBy === option.value && styles.sortOptionTextActive
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowAdvancedFilters(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.applyButton}
              onPress={handleApplyFilters}
            >
              <Text style={styles.applyButtonText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>


        </SafeAreaView>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Search Header */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#6B7280" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search for items..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            onSubmitEditing={performSearch}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#6B7280" />
            </TouchableOpacity>
          )}
        </View>
        
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowAdvancedFilters(true)}
        >
          <Ionicons name="options" size={20} color="#4639eb" />
        </TouchableOpacity>
      </View>

      {/* Search Suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          {suggestions.map((suggestion, index) => (
            <TouchableOpacity
              key={`${suggestion.type}-${index}`}
              style={styles.suggestionItem}
              onPress={() => {
                if (suggestion.type === 'category') {
                  setSelectedCategory(suggestion.metadata?.category || 'all');
                  setSearchQuery('');
                } else {
                  setSearchQuery(suggestion.value);
                }
                setShowSuggestions(false);
                performSearch();
              }}
            >
              <View style={styles.suggestionLeft}>
                <Ionicons
                  name={
                    suggestion.type === 'category' ? 'pricetag-outline' :
                    suggestion.type === 'location' ? 'location-outline' :
                    suggestion.type === 'item' ? 'search-outline' : 'search-outline'
                  }
                  size={20}
                  color="#6B7280"
                />
                <Text style={styles.suggestionText}>{suggestion.value}</Text>
              </View>
              {suggestion.metadata?.itemCount && (
                <Text style={styles.suggestionCount}>{suggestion.metadata.itemCount}</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Recent Searches & Trending */}
      {!searchQuery && !showSuggestions && recentSearches.length > 0 && (
        <View style={styles.discoveryContainer}>
          <View style={styles.discoverySection}>
            <Text style={styles.discoveryTitle}>Recent Searches</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {recentSearches.slice(0, 5).map((search, index) => (
                <TouchableOpacity
                  key={`recent-${index}`}
                  style={styles.discoveryChip}
                  onPress={() => setSearchQuery(search)}
                >
                  <Ionicons name="time-outline" size={16} color="#6B7280" />
                  <Text style={styles.discoveryChipText}>{search}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      )}

      {/* Category Filter */}
      <CategoryFilter />

      {/* Results Header */}
      <View style={styles.resultsHeader}>
        <Text style={styles.resultsCount}>
          {loading ? 'Searching...' : `${items.length} items found`}
        </Text>
      </View>

      {/* Items List */}
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmptyState}
        refreshing={loading}
        onRefresh={performSearch}
      />

      {/* Quick Filters (when showFilters is true) */}
      {showFilters && (
        <View style={styles.quickFilters}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity style={styles.quickFilter}>
              <Text style={styles.quickFilterText}>Under EGP 20</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickFilter}>
              <Text style={styles.quickFilterText}>Nearby</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickFilter}>
              <Text style={styles.quickFilterText}>Available today</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickFilter}>
              <Text style={styles.quickFilterText}>Highly rated</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {/* Advanced Filter Modal */}
      <AdvancedFilterModal />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  searchContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#111827',
  },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#F0F9FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryFilter: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 4,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    gap: 6,
  },
  categoryChipActive: {
    backgroundColor: '#4639eb',
  },
  categoryIcon: {
    marginRight: 4,
  },
  categoryText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  categoryTextActive: {
    color: '#FFFFFF',
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  resultsCount: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  viewToggle: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewToggleActive: {
    backgroundColor: '#F0F9FF',
  },
  listContainer: {
    padding: 16,
  },
  row: {
    justifyContent: 'space-between',
  },
  itemCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    position: 'relative',
  },
  itemImage: {
    width: '100%',
    height: 120,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  itemDetails: {
    padding: 12,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  itemCategory: {
    fontSize: 12,
    color: '#4639eb',
    marginBottom: 8,
  },
  itemPricing: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  itemRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingText: {
    fontSize: 12,
    color: '#6B7280',
  },
  itemLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: 12,
    color: '#6B7280',
  },
  favoriteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#6B7280',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  quickFilters: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  quickFilter: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 4,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
  },
  quickFilterText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalCloseButton: {
    padding: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  resetText: {
    fontSize: 16,
    color: '#EF4444',
    fontWeight: '500',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  filterSection: {
    marginBottom: 24,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  priceRangeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  priceText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  sliderContainer: {
    marginBottom: 8,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#4639eb',
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    marginBottom: 12,
  },
  locationButtonText: {
    fontSize: 16,
    color: '#4639eb',
    marginLeft: 8,
  },
  distanceContainer: {
    marginTop: 12,
  },
  distanceLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  dateContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  dateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  dateButtonText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
  },
  conditionContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  conditionChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
  },
  conditionChipActive: {
    backgroundColor: '#4639eb',
  },
  conditionText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  conditionTextActive: {
    color: '#FFFFFF',
  },
  additionalFilters: {
    gap: 12,
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderRadius: 4,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterOptionText: {
    fontSize: 16,
    color: '#111827',
  },
  sortOptions: {
    gap: 8,
  },
  sortOption: {
    padding: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  sortOptionActive: {
    backgroundColor: '#4639eb',
  },
  sortOptionText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  sortOptionTextActive: {
    color: '#FFFFFF',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  applyButton: {
    flex: 1,
    padding: 12,
    backgroundColor: '#4639eb',
    borderRadius: 8,
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  // Search Suggestions Styles
  suggestionsContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    maxHeight: 200,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  suggestionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  suggestionText: {
    fontSize: 16,
    color: '#111827',
    marginLeft: 12,
    flex: 1,
  },
  suggestionCount: {
    fontSize: 14,
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  // Discovery Styles
  discoveryContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  discoverySection: {
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  discoveryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  discoveryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    gap: 6,
  },
  discoveryChipText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },

});

export default SearchScreen;
