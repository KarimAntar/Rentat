import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ItemService } from '../../services/firestore';
import { useAuthContext } from '../../contexts/AuthContext';
import { SearchFilters } from '../../types';

interface MapScreenProps {
  route: {
    params?: {
      filters?: Partial<SearchFilters>;
    };
  };
}

const MapScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuthContext();

  // Web compatibility check
  const isWeb = Platform.OS === 'web';

  const filters = (route.params as any)?.filters as Partial<SearchFilters> | undefined;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Find Items Near You</Text>
        <TouchableOpacity onPress={() => (navigation as any).navigate('Search', { filters })}>
          <Ionicons name="filter" size={24} color="#4639eb" />
        </TouchableOpacity>
      </View>

      {/* Web Fallback UI */}
      <View style={styles.webFallback}>
        <Ionicons name="map" size={64} color="#D1D5DB" />
        <Text style={styles.webFallbackTitle}>Map View</Text>
        <Text style={styles.webFallbackText}>
          Interactive maps are not available in web view.{'\n'}
          Please use the mobile app for full map functionality.
        </Text>
        <TouchableOpacity
          style={styles.listViewButton}
          onPress={() => (navigation as any).navigate('Search', { filters })}
        >
          <Ionicons name="list" size={20} color="#4639eb" />
          <Text style={styles.listViewButtonText}>Switch to List View</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom Stats */}
      <View style={styles.statsBar}>
        <Text style={styles.statsText}>
          Map view available on mobile app
        </Text>
        <TouchableOpacity
          style={styles.listButton}
          onPress={() => (navigation as any).navigate('Search', { filters })}
        >
          <Ionicons name="list" size={16} color="#4639eb" />
          <Text style={styles.listButtonText}>List View</Text>
        </TouchableOpacity>
      </View>
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
  webFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#F9FAFB',
  },
  webFallbackTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  webFallbackText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  listViewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  listViewButtonText: {
    fontSize: 16,
    color: '#4639eb',
    fontWeight: '600',
  },
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  statsText: {
    fontSize: 14,
    color: '#6B7280',
  },
  listButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F0F9FF',
    borderRadius: 16,
  },
  listButtonText: {
    fontSize: 14,
    color: '#4639eb',
    fontWeight: '500',
  },
});

export default MapScreen;
