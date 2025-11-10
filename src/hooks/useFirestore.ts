import { useState, useEffect, useRef } from 'react';
import { Unsubscribe } from 'firebase/firestore';
import {
  UserService,
  ItemService,
  RentalService,
  ReviewService,
  WalletService,
  NotificationService,
} from '../services/firestore';
import { User, Item, Rental, Review, WalletTransaction, Notification } from '../types';

// Generic hook for loading state
interface UseDataState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

interface UseDataArrayState<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// User hooks
export const useUser = (userId: string | null): UseDataState<User> => {
  const [data, setData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const unsubscribeRef = useRef<Unsubscribe | null>(null);

  const fetchUser = async () => {
    if (!userId) {
      setData(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const user = await UserService.getUser(userId);
      setData(user);
    } catch (err) {
      console.error('Error fetching user:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch user');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!userId) {
      setData(null);
      setLoading(false);
      return;
    }

    // Subscribe to real-time updates
    unsubscribeRef.current = UserService.subscribeToUser(userId, (user) => {
      setData(user);
      setLoading(false);
      setError(null);
    });

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [userId]);

  return { data, loading, error, refetch: fetchUser };
};

// Items hooks
export const useItems = (ownerId?: string): UseDataArrayState<Item> => {
  const [data, setData] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const unsubscribeRef = useRef<Unsubscribe | null>(null);

  const fetchItems = async () => {
    try {
      setLoading(true);
      setError(null);
      const items = ownerId 
        ? await ItemService.getItemsByOwner(ownerId)
        : await ItemService.getActiveItems();
      setData(items);
    } catch (err) {
      console.error('Error fetching items:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch items');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Subscribe to real-time updates
    unsubscribeRef.current = ItemService.subscribeToItems((items) => {
      setData(items);
      setLoading(false);
      setError(null);
    }, ownerId);

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [ownerId]);

  return { data, loading, error, refetch: fetchItems };
};

export const useItem = (itemId: string | null): UseDataState<Item> => {
  const [data, setData] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchItem = async () => {
    if (!itemId) {
      setData(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const item = await ItemService.getItem(itemId);
      setData(item);
    } catch (err) {
      console.error('Error fetching item:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch item');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItem();
  }, [itemId]);

  return { data, loading, error, refetch: fetchItem };
};

export const useFeaturedItems = (): UseDataArrayState<Item> => {
  const [data, setData] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = async () => {
    try {
      setLoading(true);
      setError(null);
      const items = await ItemService.getFeaturedItems();
      setData(items);
    } catch (err) {
      console.error('Error fetching featured items:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch featured items');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  return { data, loading, error, refetch: fetchItems };
};

export const useItemsByCategory = (category: string): UseDataArrayState<Item> => {
  const [data, setData] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = async () => {
    try {
      setLoading(true);
      setError(null);
      const items = await ItemService.getItemsByCategory(category);
      setData(items);
    } catch (err) {
      console.error('Error fetching items by category:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch items');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [category]);

  return { data, loading, error, refetch: fetchItems };
};

// Rental hooks
export const useUserRentals = (userId: string | null, asOwner: boolean = false): UseDataArrayState<Rental> => {
  const [data, setData] = useState<Rental[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const unsubscribeRef = useRef<Unsubscribe | null>(null);

  const fetchRentals = async () => {
    if (!userId) {
      setData([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const rentals = await RentalService.getRentalsByUser(userId, asOwner);
      setData(rentals);
    } catch (err) {
      console.error('Error fetching rentals:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch rentals');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!userId) {
      setData([]);
      setLoading(false);
      return;
    }

    // Subscribe to real-time updates
    unsubscribeRef.current = RentalService.subscribeToUserRentals(userId, (rentals) => {
      setData(rentals);
      setLoading(false);
      setError(null);
    }, asOwner);

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [userId, asOwner]);

  return { data, loading, error, refetch: fetchRentals };
};

export const useRental = (rentalId: string | null): UseDataState<Rental> => {
  const [data, setData] = useState<Rental | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRental = async () => {
    if (!rentalId) {
      setData(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const rental = await RentalService.getRental(rentalId);
      setData(rental);
    } catch (err) {
      console.error('Error fetching rental:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch rental');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRental();
  }, [rentalId]);

  return { data, loading, error, refetch: fetchRental };
};

// Review hooks
export const useUserReviews = (userId: string | null): UseDataArrayState<Review> => {
  const [data, setData] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReviews = async () => {
    if (!userId) {
      setData([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const reviews = await ReviewService.getReviewsForUser(userId);
      setData(reviews);
    } catch (err) {
      console.error('Error fetching reviews:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch reviews');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [userId]);

  return { data, loading, error, refetch: fetchReviews };
};

export const useItemReviews = (itemId: string | null): UseDataArrayState<Review> => {
  const [data, setData] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReviews = async () => {
    if (!itemId) {
      setData([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const reviews = await ReviewService.getReviewsForItem(itemId);
      setData(reviews);
    } catch (err) {
      console.error('Error fetching item reviews:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch reviews');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [itemId]);

  return { data, loading, error, refetch: fetchReviews };
};

// Wallet hooks
export const useUserTransactions = (userId: string | null): UseDataArrayState<WalletTransaction> => {
  const [data, setData] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const unsubscribeRef = useRef<Unsubscribe | null>(null);

  const fetchTransactions = async () => {
    if (!userId) {
      setData([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const transactions = await WalletService.getUserTransactions(userId);
      setData(transactions);
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch transactions');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!userId) {
      setData([]);
      setLoading(false);
      return;
    }

    // Subscribe to real-time updates
    unsubscribeRef.current = WalletService.subscribeToUserTransactions(userId, (transactions) => {
      setData(transactions);
      setLoading(false);
      setError(null);
    });

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [userId]);

  return { data, loading, error, refetch: fetchTransactions };
};

export const useUserBalance = (userId: string | null) => {
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = async () => {
    if (!userId) {
      setBalance(0);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const userBalance = await WalletService.getUserBalance(userId);
      setBalance(userBalance);
    } catch (err) {
      console.error('Error fetching balance:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch balance');
      setBalance(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBalance();
  }, [userId]);

  return { balance, loading, error, refetch: fetchBalance };
};

// Notification hooks
export const useUserNotifications = (
  userId: string | null,
  unreadOnly: boolean = false
): UseDataArrayState<Notification> => {
  const [data, setData] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const unsubscribeRef = useRef<Unsubscribe | null>(null);

  const fetchNotifications = async () => {
    if (!userId) {
      setData([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const notifications = await NotificationService.getUserNotifications(userId, unreadOnly);
      setData(notifications);
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch notifications');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!userId) {
      setData([]);
      setLoading(false);
      return;
    }

    // Subscribe to real-time updates
    unsubscribeRef.current = NotificationService.subscribeToUserNotifications(
      userId,
      (notifications) => {
        setData(notifications);
        setLoading(false);
        setError(null);
      },
      unreadOnly
    );

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [userId, unreadOnly]);

  return { data, loading, error, refetch: fetchNotifications };
};

// Generic mutation hook for create/update/delete operations
export const useFirestoreMutation = <T>() => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = async (operation: () => Promise<T>): Promise<T | null> => {
    try {
      setLoading(true);
      setError(null);
      const result = await operation();
      return result;
    } catch (err) {
      console.error('Mutation error:', err);
      setError(err instanceof Error ? err.message : 'Operation failed');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setError(null);
    setLoading(false);
  };

  return { mutate, loading, error, reset };
};

// Specific mutation hooks
export const useCreateItem = () => {
  const { mutate, loading, error, reset } = useFirestoreMutation<string>();

  const createItem = async (itemData: Omit<Item, 'id' | 'createdAt' | 'updatedAt'>) => {
    return await mutate(() => ItemService.createItem(itemData));
  };

  return { createItem, loading, error, reset };
};

export const useUpdateItem = () => {
  const { mutate, loading, error, reset } = useFirestoreMutation<void>();

  const updateItem = async (itemId: string, data: Partial<Item>) => {
    return await mutate(() => ItemService.updateItem(itemId, data));
  };

  return { updateItem, loading, error, reset };
};

export const useCreateRental = () => {
  const { mutate, loading, error, reset } = useFirestoreMutation<string>();

  const createRental = async (rentalData: Omit<Rental, 'id' | 'createdAt' | 'updatedAt'>) => {
    return await mutate(() => RentalService.createRental(rentalData));
  };

  return { createRental, loading, error, reset };
};

export const useUpdateRental = () => {
  const { mutate, loading, error, reset } = useFirestoreMutation<void>();

  const updateRental = async (rentalId: string, data: Partial<Rental>) => {
    return await mutate(() => RentalService.updateRental(rentalId, data));
  };

  return { updateRental, loading, error, reset };
};
