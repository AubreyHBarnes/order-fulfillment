/**
 * App Navigator
 * File: src/navigation/AppNavigator.tsx
 *
 * PURPOSE: Manages navigation between auth screens and main app screens
 *
 * AUTHENTICATION-BASED NAVIGATION:
 * - Not logged in (!user) -> Show auth screens (Login, Register)
 * - Logged in (user) -> Show main app screens (CustomerHome, etc.)
 *
 * WHY THIS PATTERN?
 * - Security: Prevents unauthorized access to app screens
 * - UX: No back button to login after authenticating
 * - Performance: Only mounts needed screens
 * - Clean separation: Auth flow vs main app flow
 */

import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View, TouchableOpacity, Text } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { ShopperAssignmentProvider } from '../context/ShopperAssignmentContext';
import type { AuthStackParamList, MainStackParamList, ShopperStackParamList } from '../types';

// ============================================================
// SCREEN IMPORTS
// ============================================================

// Auth Screens
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';

// Customer Screens
import CustomerHomeScreen from '../screens/customer/CustomerHomeScreen';
import CartScreen from '../screens/customer/CartScreen';
import CheckoutScreen from '../screens/customer/CheckoutScreen';
import OrderConfirmationScreen from '../screens/customer/OrderConfirmationScreen';
import OrdersScreen from '../screens/customer/OrdersScreen';
import OrderDetailScreen from '../screens/customer/OrderDetailScreen';

// Shopper Screens
import {
  ShopperDashboardScreen,
  AvailableTasksScreen,
  DropOffsScreen,
  CustomerCheckInsScreen,
  TaskDetailScreen,
  ShopperSettingsScreen,
} from '../screens/shopper';

// Debug/Development Screens (kept for testing, not in main flow)
// import TestConnectionScreen from '../screens/TestConnectionScreen';

/**
 * WHY COMMENTED OUT TestConnectionScreen?
 * - No longer needed in navigation flow
 * - Replaced by CustomerHomeScreen
 * - Keep import available for debugging if needed
 * - Could navigate to it manually: navigation.navigate('Test')
 */

// ============================================================
// CREATE NAVIGATORS
// ============================================================

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainStack = createNativeStackNavigator<MainStackParamList>();
const ShopperStack = createNativeStackNavigator<ShopperStackParamList>();

/**
 * WHY CREATE OUTSIDE COMPONENT?
 * - Only created once when file loads
 * - If inside: recreated every render (loses navigation state)
 * - Performance: Stable references
 * - Navigation history: Maintains stack
 *
 * WHY SEPARATE SHOPPER STACK?
 * - Different screens and workflows than customer
 * - Role-based navigation (shopper vs customer)
 * - Easier to maintain and extend each flow independently
 * - Clear separation of concerns
 */

// ============================================================
// HEADER COMPONENTS
// ============================================================

/**
 * Welcome Title Component
 *
 * WHY A COMPONENT FOR THE TITLE?
 * - Need to access AuthContext to get user's name
 * - Can't use hooks directly in screen options
 * - headerTitle prop accepts a component
 * - Keeps navigation config clean
 */
const WelcomeTitle: React.FC = () => {
  const { userProfile } = useAuth();
  const firstName = userProfile?.firstName ?? 'Customer';

  return (
    <Text style={{ fontSize: 18, fontWeight: '600', color: '#000' }}>
      Welcome, {firstName}
    </Text>
  );
};

/**
 * WHY SEPARATE COMPONENT?
 * - Used in header (needs to be component)
 * - Could be reused in multiple screens
 * - Encapsulates logout logic
 * - Clean separation of concerns
 */
const LogoutButton: React.FC = () => {
  const { logout } = useAuth();
  const [loading, setLoading] = useState<boolean>(false);

  /**
   * WHY LOCAL LOADING STATE?
   * - Shows visual feedback during logout
   * - Prevents double-clicks
   * - Better UX than instant disappear
   */
  const handleLogout = async (): Promise<void> => {
    setLoading(true);
    await logout();
    setLoading(false);
    /**
     * WHY NOT setLoading(false) AFTER?
     * - After logout, component unmounts (user goes to Login)
     * - setLoading(false) would cause React warning
     * - But included for completeness/safety
     */
  };

  return (
    <TouchableOpacity
      onPress={handleLogout}
      disabled={loading}
      style={{ marginRight: 15 }}
      /**
       * WHY marginRight: 15?
       * - Space from screen edge
       * - Visual breathing room
       * - Standard header button spacing
       */
      accessible={true}
      accessibilityLabel="Logout button"
      accessibilityHint="Double tap to sign out"
      accessibilityRole="button"
      /**
       * WHY ACCESSIBILITY PROPS?
       * - Screen readers need description
       * - WCAG compliance
       * - Professional standard
       */
    >
      {loading ? (
        <ActivityIndicator size="small" color="#007AFF" />
      ) : (
        <Text style={{ color: '#007AFF', fontSize: 16 }}>Logout</Text>
      )}
    </TouchableOpacity>
  );
};

/**
 * WHY INLINE STYLES HERE?
 * - Small component
 * - Styles only used once
 * - StyleSheet.create() would be overkill
 * - Quick iteration/tweaking
 *
 * WHEN TO USE StyleSheet.create():
 * - Multiple components
 * - Reused styles
 * - Complex styling
 * - Main screen components
 */

// ============================================================
// MAIN NAVIGATOR COMPONENT
// ============================================================

const AppNavigator: React.FC = () => {
  const { user, userProfile, loading } = useAuth();

  /**
   * WHY DESTRUCTURE FROM useAuth?
   * - user: Check if logged in
   * - userProfile: Access user details (name, role)
   * - loading: Show spinner while checking session
   *
   * FLOW:
   * App starts -> loading=true -> Check session -> loading=false
   *   |
   * If user exists: Show main app (customer or shopper based on role)
   * If no user: Show auth screens
   *
   * ROLE-BASED NAVIGATION:
   * - userProfile.role === 'shopper' -> ShopperStack
   * - userProfile.role === 'customer' (or default) -> MainStack
   */

  // ============================================================
  // LOADING STATE
  // ============================================================

  if (loading) {
    /**
     * WHY LOADING SCREEN?
     * - Prevents flash of login screen if user is logged in
     * - AuthContext is checking for saved session
     * - Better UX than showing wrong screen briefly
     *
     * USER EXPERIENCE:
     * App opens -> Spinner -> Home screen (smooth)
     * App opens -> Login flash -> Home screen (jarring)
     */
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#F5F5F5',
        }}
      >
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={{ marginTop: 16, color: '#757575' }}>Loading...</Text>
      </View>
    );
  }

  // ============================================================
  // NAVIGATION STRUCTURE
  // ============================================================

  return (
    <NavigationContainer>
      {/**
       * CONDITIONAL NAVIGATION:
       * Three separate navigation stacks based on auth state and role
       *
       * NAVIGATION FLOW:
       * 1. !user -> AuthStack (Login, Register, ForgotPassword)
       * 2. user + role=shopper -> ShopperStack (Dashboard, Tasks, etc.)
       * 3. user + role=customer -> MainStack (Shop, Cart, Checkout, etc.)
       *
       * WHY CONDITIONAL?
       * - Security: Logged out users can't access app screens
       * - Role separation: Shoppers and customers have different flows
       * - UX: No back button confusion (can't go back to login after login)
       * - Performance: Only mount relevant screens for each role
       *
       * ALTERNATIVE APPROACHES:
       * 1. Single stack with all screens (worse: security issues, role confusion)
       * 2. Check auth/role in every screen (worse: repetitive, error-prone)
       * 3. This approach (best: enforced at navigation level)
       */}

      {!user ? (
        // ========================================================
        // AUTH STACK - Not Logged In
        // ========================================================

        <AuthStack.Navigator
          screenOptions={{
            headerShown: false,
            /**
             * WHY headerShown: false?
             * - Auth screens design their own headers
             * - Cleaner look (no default header)
             * - More control over design
             * - Can override per-screen if needed
             */
          }}
        >
          {/**
           * SCREEN ORDER:
           * First screen listed = initial screen (Login)
           * User navigates: Login -> Register -> ForgotPassword
           */}

          <AuthStack.Screen
            name="Login"
            component={LoginScreen}
            /**
             * WHY NO OPTIONS?
             * - Using default (no header)
             * - LoginScreen handles its own layout
             * - Simple, clean
             */
          />

          <AuthStack.Screen
            name="Register"
            component={RegisterScreen}
            /**
             * WHY NO OPTIONS?
             * - Same as Login
             * - Consistent auth flow
             */
          />

          <AuthStack.Screen
            name="ForgotPassword"
            component={ForgotPasswordScreen}
            options={{
              headerShown: true,
              /**
               * WHY SHOW HEADER HERE?
               * - ForgotPassword is sub-flow of Login
               * - Back button is helpful
               * - Standard pattern for secondary screens
               */
              title: 'Reset Password',
              /**
               * WHY CUSTOM TITLE?
               * - Clear what user is doing
               * - "Reset Password" more descriptive than "ForgotPassword"
               * - User-facing language
               */
            }}
          />

          {/**
           * POTENTIAL ADDITIONAL SCREENS:
           * - VerifyEmail (after registration)
           * - SetNewPassword (from reset email link)
           * - Terms of Service
           * - Privacy Policy
           */}
        </AuthStack.Navigator>
      ) : userProfile?.role === 'shopper' ? (
        // ========================================================
        // SHOPPER STACK - Logged In as Shopper
        // ========================================================
        /**
         * WHY SEPARATE SHOPPER STACK?
         *
         * Shoppers have completely different workflows than customers:
         * - Customers: Browse products, add to cart, checkout
         * - Shoppers: View tasks, shop orders, deliver/hand off
         *
         * Benefits of separate stacks:
         * 1. Clear separation of concerns
         * 2. Role-specific navigation flows
         * 3. Easier to maintain and extend
         * 4. No confusion between customer/shopper screens
         */

        // WHY WRAPPED IN ShopperAssignmentProvider HERE?
        // This is the one place `role === 'shopper'` is already
        // evaluated, and it's above every shopper screen - mounting the
        // provider (and the interrupt-notification polling it runs)
        // here means it's live no matter which shopper screen is open,
        // and stops entirely once the shopper logs out or a customer
        // logs in (this branch stops rendering).
        <ShopperAssignmentProvider shopperId={userProfile?.shopperID ?? ''}>
        <ShopperStack.Navigator
          screenOptions={{
            headerStyle: {
              backgroundColor: '#FFFFFF',
            },
            headerTintColor: '#007AFF',
            headerTitleStyle: {
              fontWeight: '600',
            },
          }}
        >
          <ShopperStack.Screen
            name="ShopperHome"
            component={ShopperDashboardScreen}
            options={{
              headerShown: false,
              /**
               * WHY headerShown: false?
               * - ShopperDashboardScreen has its own custom header
               * - More control over design (settings icon, etc.)
               * - Consistent with dashboard's visual design
               */
            }}
          />

          <ShopperStack.Screen
            name="AvailableTasks"
            component={AvailableTasksScreen}
            options={{
              title: 'Pick Tasks',
              /**
               * WHY "Pick Tasks"?
               * - Matches the quick link label on dashboard
               * - Clear action-oriented title
               * - "Available Tasks" is longer and less actionable
               */
            }}
          />

          <ShopperStack.Screen
            name="DropOffs"
            component={DropOffsScreen}
            options={{
              title: 'Drop Offs',
            }}
          />

          <ShopperStack.Screen
            name="CustomerCheckIns"
            component={CustomerCheckInsScreen}
            options={{
              title: 'Customer Check-ins',
            }}
          />

          <ShopperStack.Screen
            name="TaskDetail"
            component={TaskDetailScreen}
            options={{
              title: 'Task Details',
            }}
          />

          <ShopperStack.Screen
            name="ShopperSettings"
            component={ShopperSettingsScreen}
            options={{
              title: 'Settings',
            }}
          />
        </ShopperStack.Navigator>
        </ShopperAssignmentProvider>
      ) : (
        // ========================================================
        // MAIN APP STACK - Logged In as Customer
        // ========================================================

        <MainStack.Navigator
          screenOptions={{
            /**
             * WHY DIFFERENT screenOptions FROM AUTH?
             * - Main app shows headers (navigation clarity)
             * - Headers provide context ("where am I?")
             * - Back button for navigation
             */
            headerStyle: {
              backgroundColor: '#FFFFFF',
            },
            headerTintColor: '#007AFF',
            /**
             * WHY THESE COLORS?
             * - White background: Clean, standard
             * - Blue tint: Matches primary color
             * - Consistent with brand
             */
            headerTitleStyle: {
              fontWeight: '600',
            },
          }}
        >
          {/**
           * CUSTOMER SCREENS:
           * Currently just CustomerHome
           * Will add: Cart, Checkout, OrderHistory, Profile, etc.
           */}

          <MainStack.Screen
            name="CustomerHome"
            component={CustomerHomeScreen}
            options={{
              headerTitle: () => <WelcomeTitle />,
              /**
               * WHY CUSTOM headerTitle COMPONENT?
               * - Shows personalized "Welcome, [Name]" greeting
               * - Needs access to AuthContext for user's name
               * - More welcoming than generic "Shop" title
               */

              headerRight: () => <LogoutButton />,
              /**
               * WHY LOGOUT IN HEADER?
               * - Always accessible
               * - Standard mobile pattern
               * - Doesn't take main screen space
               * - Clear exit path
               *
               * ALTERNATIVE: Profile screen with logout
               * This is simpler for now
               */
            }}
          />

          <MainStack.Screen
            name="Cart"
            component={CartScreen}
            options={{
              title: 'Shopping Cart',
              /**
               * WHY "Shopping Cart"?
               * - Clear, descriptive title
               * - User knows exactly where they are
               * - Standard e-commerce terminology
               */
            }}
          />

          <MainStack.Screen
            name="Checkout"
            component={CheckoutScreen}
            options={{
              title: 'Checkout',
              /**
               * WHY "Checkout"?
               * - Clear, action-oriented title
               * - Standard e-commerce terminology
               * - User knows this is final step before order
               */
            }}
          />

          <MainStack.Screen
            name="OrderConfirmation"
            component={OrderConfirmationScreen}
            options={{
              title: 'Order Confirmation',
              headerBackVisible: false,
              /**
               * WHY headerBackVisible: false?
               * - Prevents going back to Checkout
               * - Cart is cleared after order
               * - Going back would show empty checkout
               * - "Continue Shopping" is the only exit
               */
            }}
          />

          <MainStack.Screen
            name="Orders"
            component={OrdersScreen}
            options={{
              title: 'My Orders',
            }}
          />

          <MainStack.Screen
            name="OrderDetail"
            component={OrderDetailScreen}
            options={({ route }) => ({
              title: `Order #${route.params.orderId.slice(-8).toUpperCase()}`,
            })}
          />

          {/**
           * FUTURE SCREENS:
           *
           * <MainStack.Screen
           *   name="ProductDetail"
           *   component={ProductDetailScreen}
           *   options={{ title: 'Product Details' }}
           * />
           *
           * <MainStack.Screen
           *   name="OrderTracking"
           *   component={OrderTrackingScreen}
           *   options={({ route }) => ({
           *     title: `Order #${route.params.orderId}`
           *   })}
           * />
           *
           * <MainStack.Screen
           *   name="Profile"
           *   component={ProfileScreen}
           *   options={{ title: 'My Profile' }}
           * />
           */}

          {/**
           * DEBUG SCREEN (commented out):
           * Kept for testing but not in main flow
           *
           * <MainStack.Screen
           *   name="TestConnection"
           *   component={TestConnectionScreen}
           *   options={{ title: 'Test Connection' }}
           * />
           *
           * Can navigate manually if needed:
           * navigation.navigate('TestConnection')
           */}
        </MainStack.Navigator>
      )}
    </NavigationContainer>
  );
};

export default AppNavigator;
