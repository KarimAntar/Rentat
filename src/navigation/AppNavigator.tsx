import React from 'react';
import { View, Text, Dimensions, StyleSheet, TouchableOpacity } from 'react-native';
import { NavigationContainer, LinkingOptions, CommonActions } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '../contexts/AuthContext';

// Import screens
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import EmailVerificationScreen from '../screens/auth/EmailVerificationScreen';
import HomeScreen from '../screens/main/HomeScreen';
import SearchScreen from '../screens/main/SearchScreen';
import ListItemScreen from '../screens/main/ListItemScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import WalletScreen from '../screens/main/WalletScreen';
import ReferralScreen from '../screens/main/ReferralScreen';
import CreateItemScreen from '../screens/main/CreateItemScreen';
import EditItemScreen from '../screens/main/EditItemScreen';
import ItemDetailScreen from '../screens/main/ItemDetailScreen';
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
          iconName = isFocused ? 'wallet' : 'wallet-outline';
        } else if (route.name === 'Profile') {
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
            <Ionicons
              name={iconName}
              size={isFocused ? 24 : 22}
              color={isFocused ? '#4639eb' : '#6B7280'}
            />
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
  const { user, signOut } = useAuthContext();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const getDisplayName = () => {
    if (user?.displayName) {
      // Return only the first name (before the first space)
      return user.displayName.split(' ')[0];
    }
    return 'Visitor';
  };

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
        <Text style={styles.greetingText}>
          {getGreeting()}
        </Text>
        <Text style={styles.greetingName}>
          {getDisplayName()} 👋
        </Text>
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
        component={WalletScreen}
        options={{
          title: 'Wallet',
        }}
      />
      <MainTab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Profile',
        }}
      />
    </MainTab.Navigator>
  );
};

// Linking configuration for web URLs
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
        <RootStack.Screen name="Review" component={require('../screens/main/ReviewScreen').default} />
        <RootStack.Screen name="ItemDetails" component={ItemDetailScreen} />
        <RootStack.Screen name="Chat" component={require('../screens/main/ChatScreen').default} />
        <RootStack.Screen name="RentalRequest" component={require('../screens/main/RentalRequestScreen').default} />
        <RootStack.Screen name="Verification" component={require('../screens/main/VerificationScreen').default} />
        <RootStack.Screen name="Map" component={require('../screens/main/MapScreen').default} />
        <RootStack.Screen name="NotificationPreferences" component={require('../screens/main/NotificationPreferencesScreen').default} />
        <RootStack.Screen name="Referral" component={ReferralScreen} />
        <RootStack.Screen
          name="EmailVerification"
          component={EmailVerificationScreen}
          options={{ headerShown: true, title: 'Verify Email' }}
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
  greetingText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  greetingName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#4639eb',
    marginTop: 4,
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
