import React from 'react';
import { View, Text, Dimensions, StyleSheet, TouchableOpacity } from 'react-native';
import { NavigationContainer, LinkingOptions, CommonActions } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '../contexts/AuthContext';
import { db, collections } from '../config/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import UserGreeting from '../components/UserGreeting';

// Import screens
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import EmailVerificationScreen from '../screens/auth/EmailVerificationScreen';
import HomeScreen from '../screens/main/HomeScreen';
import SearchScreen from '../screens/main/SearchScreen';
import ListItemScreen from '../screens/main/ListItemScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import EditProfileScreen from '../screens/main/EditProfileScreen';
import WalletScreen from '../screens/main/WalletScreen';
import ReferralScreen from '../screens/main/ReferralScreen';
import CreateItemScreen from '../screens/main/CreateItemScreen';
import EditItemScreen from '../screens/main/EditItemScreen';
import ItemDetailScreen from '../screens/main/ItemDetailScreen';
import RentalRequestsScreen from '../screens/main/RentalRequestsScreen';
import MyListingsScreen from '../screens/main/MyListingsScreen';
import RentalHistoryScreen from '../screens/main/RentalHistoryScreen';
import HelpSupportScreen from '../screens/main/HelpSupportScreen';
import LoadingScreen from '../components/LoadingScreen';
import PWAInstallPrompt from '../components/PWAInstallPrompt';

// Import navigation types
import { RootStackParamList, AuthStackParamList, MainTabParamList } from '../types';



// Create navigators
const RootStack = createStackNavigator<RootStackParamList>();
const AuthStack = createStackNavigator<AuthStackParamList>();
const MainTab = createBottomTabNavigator<MainTabParamList>();

// Auth Stack Navigator
const AuthNavigator: React.FC = () => {
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: '#4639eb',
          elevation: 4,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: 18,
        },
        headerTitle: 'Rentat',
        cardStyle: { backgroundColor: '#FFFFFF' },
      }}
    >
      <AuthStack.Screen
        name="Login"
        component={LoginScreen}
        options={{ headerTitle: 'Sign In' }}
      />
      <AuthStack.Screen
        name="Register"
        component={RegisterScreen}
        options={{ headerTitle: 'Sign Up' }}
      />
      <AuthStack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
        options={{ headerTitle: 'Reset Password' }}
      />
    </AuthStack.Navigator>
  );
};

// Custom Tab Bar Component - Always shows text below icons
const CustomTabBar: React.FC<any> = ({ state, descriptors, navigation }) => {
  const { user } = useAuthContext();
  const [unreadCount, setUnreadCount] = React.useState(0);

  // Subscribe to unread messages count
  React.useEffect(() => {
    if (!user) return;

    const chatsQuery = query(
      collection(db, collections.chats),
      where('participants', 'array-contains', user.uid),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(chatsQuery, (snapshot) => {
      let totalUnread = 0;
      snapshot.docs.forEach((doc) => {
        const chatData = doc.data();
        const unreadForUser = chatData.metadata?.unreadCount?.[user.uid] || 0;
        totalUnread += unreadForUser;
      });
      setUnreadCount(totalUnread);
    });

    return unsubscribe;
  }, [user]);

  return (
    <View style={styles.tabBarContainer}>
      {state.routes.map((route: any, index: number) => {
        const { options } = descriptors[route.key];
        const label =
          options.tabBarLabel !== undefined
            ? options.tabBarLabel
            : options.title !== undefined
            ? options.title
            : route.name;

        const isFocused = state.index === index;

        let iconName: keyof typeof Ionicons.glyphMap = 'help-outline';

        if (route.name === 'Home') {
          iconName = isFocused ? 'home' : 'home-outline';
        } else if (route.name === 'Search') {
          iconName = isFocused ? 'search' : 'search-outline';
        } else if (route.name === 'AddItem') {
          iconName = isFocused ? 'add-circle' : 'add-circle-outline';
        } else if (route.name === 'Messages') {
          iconName = isFocused ? 'chatbubble' : 'chatbubble-outline';
        } else if (route.name === 'Account') {
          iconName = isFocused ? 'person' : 'person-outline';
        }

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            // Check if user needs to be authenticated for this tab
            const requiresAuth = ['AddItem', 'Messages', 'Profile'].includes(route.name);

            if (requiresAuth && !user) {
              // Navigate to auth stack instead of the protected tab
              navigation.navigate('Auth', { screen: 'Login' });
              return;
            }

            navigation.navigate(route.name);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            testID={options.tabBarTestID}
            onPress={onPress}
            onLongPress={onLongPress}
            style={styles.tabBarItem}
          >
            <View style={styles.iconContainer}>
              <Ionicons
                name={iconName}
                size={isFocused ? 24 : 22}
                color={isFocused ? '#4639eb' : '#6B7280'}
              />
              {route.name === 'Messages' && unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>
                    {unreadCount > 99 ? '99+' : unreadCount.toString()}
                  </Text>
                </View>
              )}
            </View>
            <Text
              style={[
                styles.tabBarLabel,
                {
                  color: isFocused ? '#4639eb' : '#6B7280',
                  fontWeight: isFocused ? '600' : '500',
                },
              ]}
            >
              {typeof label === 'string' ? label : label({ focused: isFocused, color: '' })}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// Global Header Component
const GlobalHeader: React.FC<{ title?: string; navigation?: any }> = ({ title, navigation }) => {
  const { signOut } = useAuthContext();

  const handleSignOut = async () => {
    try {
      await signOut();
      // Navigate to Auth stack after sign out (allows back navigation)
      if (navigation) {
        navigation.navigate('Auth');
      }
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <View style={styles.globalHeader}>
      <View style={styles.greetingSection}>
        <UserGreeting avatarSize={48} />
      </View>
      <View style={styles.headerActions}>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="notifications-outline" size={24} color="#6B7280" />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSignOut} style={styles.actionButton}>
          <Ionicons name="log-out-outline" size={24} color="#6B7280" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Main Tab Navigator
const MainNavigator: React.FC = () => {
  return (
    <MainTab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        header: (props) => <GlobalHeader title={props.options.title} navigation={props.navigation} />,
      }}
    >
      <MainTab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Home',
          headerShown: false, // Hide header for home screen since it has its own greeting
        }}
      />
      <MainTab.Screen
        name="Search"
        component={SearchScreen}
        options={{
          title: 'Search',
        }}
      />
      <MainTab.Screen
        name="AddItem"
        component={ListItemScreen}
        options={{
          title: 'Add Item',
        }}
      />
      <MainTab.Screen
        name="Messages"
        component={require('../screens/main/MessagesScreen').default}
        options={{
          title: 'Messages',
        }}
      />
      <MainTab.Screen
        name="Account"
        component={ProfileScreen}
        options={{
          title: 'Account',
        }}
      />
    </MainTab.Navigator>
  );
};

// Linking configuration for web URLs and deep links
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['https://rentat.app', 'rentat://', '/'],
  config: {
    screens: {
      Auth: {
        screens: {
          Login: 'login',
          Register: 'register',
          ForgotPassword: 'forgot-password',
        },
      },
      Main: {
        screens: {
          Home: '',
          Search: 'search',
          AddItem: 'add-item',
          Messages: 'messages',
          Profile: 'profile',
        },
      },
      CreateItem: 'create-item',
      ItemDetails: {
        path: 'items/:itemId',
        parse: {
          itemId: (itemId: string) => itemId,
        },
      },
      Chat: {
        path: 'chat/:otherUserId',
        parse: {
          otherUserId: (otherUserId: string) => otherUserId,
        },
      },
      RentalRequest: {
        path: 'rental-request/:itemId',
        parse: {
          itemId: (itemId: string) => itemId,
        },
      },
      Verification: 'verification',
      KYCVerification: {
        path: 'kyc-result',
        parse: {
          status: (status: string) => status,
          userId: (userId: string) => userId,
        },
      },
    },
  },
};

// Root Navigator
const AppNavigator: React.FC = () => {
  const { user, loading } = useAuthContext();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer linking={linking}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        <RootStack.Screen name="Main" component={MainNavigator} />
        <RootStack.Screen name="Auth" component={AuthNavigator} />
        <RootStack.Screen name="CreateItem" component={CreateItemScreen} />
        <RootStack.Screen name="EditItem" component={EditItemScreen} />
        <RootStack.Screen name="EditProfile" component={EditProfileScreen} />
        <RootStack.Screen name="Review" component={require('../screens/main/ReviewScreen').default} />
        <RootStack.Screen name="ItemDetails" component={ItemDetailScreen} />
        <RootStack.Screen name="Chat" component={require('../screens/main/ChatScreen').default} />
        <RootStack.Screen name="RentalRequest" component={require('../screens/main/RentalRequestScreen').default} />
        <RootStack.Screen name="Verification" component={require('../screens/main/VerificationScreen').default} />
        <RootStack.Screen name="Map" component={require('../screens/main/MapScreen').default} />
        <RootStack.Screen name="NotificationPreferences" component={require('../screens/main/NotificationPreferencesScreen').default} />
        <RootStack.Screen name="Referral" component={ReferralScreen} />
        <RootStack.Screen
          name="KYCVerification"
          component={require('../screens/main/KYCVerificationScreen').default}
          options={{ headerShown: true, title: 'Identity Verification' }}
        />
        <RootStack.Screen
          name="EmailVerification"
          component={EmailVerificationScreen}
          options={{ headerShown: true, title: 'Verify Email' }}
        />
        <RootStack.Screen
          name="RentalRequests"
          component={RentalRequestsScreen}
          options={{ headerShown: false }}
        />
        <RootStack.Screen
          name="MyListings"
          component={MyListingsScreen}
          options={{ headerShown: false }}
        />
        <RootStack.Screen
          name="RentalHistory"
          component={RentalHistoryScreen}
          options={{ headerShown: false }}
        />
        <RootStack.Screen
          name="HelpSupport"
          component={HelpSupportScreen}
          options={{ headerShown: false }}
        />
        <RootStack.Screen
          name="PaymobTest"
          component={require('../screens/main/PaymobTestScreen').default}
          options={{ headerShown: false }}
        />
      </RootStack.Navigator>

      {/* PWA Install Prompt - Only shows on Chrome for Android */}
      <PWAInstallPrompt />
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  tabBarContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingBottom: 4,
    paddingTop: 8,
    height: 70,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tabBarItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 4,
  },
  tabBarLabel: {
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
  },
  iconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  globalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  greetingSection: {
    flex: 1,
  },
  greetingWithAvatar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarContainer: {
    position: 'relative',
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifiedAvatar: {
    borderWidth: 2,
    borderColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  verificationBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#10B981',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  greetingTextContainer: {
    flex: 1,
  },
  greetingText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'left',
  },
  greetingName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#4639eb',
    marginTop: 4,
    textAlign: 'left',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  kycVerifiedBadge: {
    marginLeft: 4,
  },
  greetingEmoji: {
    marginLeft: 4,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 16,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default AppNavigator;
