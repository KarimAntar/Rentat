import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useActiveOrders } from '../../hooks/useActiveOrders';
import { useDashboard } from '../../contexts/DashboardContext';
import { ActiveOrderCard } from './ActiveOrderCard';
import { LoadingSpinner } from '../ui/LoadingSpinner';

export const ActiveOrdersSection: React.FC = () => {
  const navigation = useNavigation<any>();
  const {
    activeOrders,
    requiresAction,
    loading,
    error,
  } = useActiveOrders();

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Active Orders</Text>
        <LoadingSpinner />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Active Orders</Text>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load active orders</Text>
        </View>
      </View>
    );
  }

  const priorityOrders = activeOrders
    .filter(order => ['approved', 'awaiting_handover', 'active'].includes(order.status))
    .sort((a, b) => {
      // Sort by priority: action required first
      const aAction = (a.status === 'approved' || a.status === 'awaiting_handover');
      const bAction = (b.status === 'approved' || b.status === 'awaiting_handover');
      if (aAction && !bAction) return -1;
      if (!aAction && bAction) return 1;
      // Then by date
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    })
    .slice(0, 5); // Show top 5

  if (priorityOrders.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Active Orders</Text>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No active orders</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Active Orders</Text>
        {requiresAction.length > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{requiresAction.length} action needed</Text>
          </View>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {priorityOrders.map((order) => (
          <ActiveOrderCard 
            key={order.id} 
            order={order} 
            onPress={() => navigation.navigate('OrderDetails', { rentalId: order.id })}
          />
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    marginVertical: 8,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  badge: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  scrollView: {
    marginHorizontal: -16,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  errorText: {
    fontSize: 14,
    color: '#F44336',
    textAlign: 'center',
  },
});
