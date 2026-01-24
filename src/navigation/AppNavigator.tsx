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
import type { AuthStackParamList, MainStackParamList } from '../types';

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

/**
 * WHY CREATE OUTSIDE COMPONENT?
 * - Only created once when file loads
 * - If inside: recreated every render (loses navigation state)
 * - Performance: Stable references
 * - Navigation history: Maintains stack
 */

// ============================================================
// LOGOUT BUTTON COMPONENT
// ============================================================

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
  const { user, loading } = useAuth();

  /**
   * WHY DESTRUCTURE FROM useAuth?
   * - user: Check if logged in
   * - userProfile: Access user details (name, role)
   * - loading: Show spinner while checking session
   *
   * FLOW:
   * App starts -> loading=true -> Check session -> loading=false
   *   |
   * If user exists: Show main app
   * If no user: Show auth screens
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
       * Two completely separate navigation stacks based on auth state
       *
       * WHY CONDITIONAL?
       * - Security: Logged out users can't access app screens
       * - UX: No back button confusion (can't go back to login after login)
       * - Performance: Only mount relevant screens
       *
       * ALTERNATIVE APPROACHES:
       * 1. Single stack with all screens (worse: security issues)
       * 2. Check auth in every screen (worse: repetitive, error-prone)
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
      ) : (
        // ========================================================
        // MAIN APP STACK - Logged In
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
              title: 'Shop',
              /**
               * WHY "Shop" NOT "Home"?
               * - Action-oriented (tells user what to do)
               * - Clear purpose
               * - Consistent across users
               * - Short (doesn't take space)
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
