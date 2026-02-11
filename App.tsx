/**
 * App.js - Root Component
 *
 * PURPOSE: Entry point of the application
 * Sets up all global providers (theming, auth, cart)
 *
 * PROVIDER HIERARCHY (Order Matters!):
 * 1. ThemeProvider - Theme + React Native Paper (outermost)
 * 2. AuthProvider - Authentication state
 * 3. CartProvider - Shopping cart state (innermost)
 * 4. AppNavigator - Navigation (uses all providers above)
 *
 * WHY THIS ORDER?
 * - Inner providers can access outer providers
 * - CartProvider needs AuthProvider (for user info at checkout)
 * - AuthProvider needs ThemeProvider (uses Paper components)
 * - All need theme (ThemeProvider provides it)
 */

import React from 'react';
import { ThemeProvider } from './src/context/ThemeContext';
import { AuthProvider } from './src/context/AuthContext';
import { CartProvider } from './src/context/CartContext';
import AppNavigator from './src/navigation/AppNavigator';

/**
 * WHY THESE IMPORTS?
 *
 * React:
 * - Core library for JSX and components
 *
 * ThemeProvider:
 * - Manages light/dark/system theme preference
 * - Wraps PaperProvider internally
 * - Provides useThemeMode() hook
 * - Persists preference to AsyncStorage
 *
 * AuthProvider:
 * - Manages user authentication state
 * - Provides login, logout, register functions
 *
 * CartProvider:
 * - Manages shopping cart state
 * - Provides addToCart, removeFromCart, etc.
 *
 * AppNavigator:
 * - Root navigation component
 * - Shows auth screens or main app based on login state
 */

function App() {
  /**
   * WHY FUNCTION DECLARATION?
   * - Could use: const App = () => {}
   * - Function declarations are hoisted
   * - Traditional React pattern for root component
   * - Both work identically
   */
  
  return (
    <ThemeProvider>
      {/**
       * WHY ThemeProvider FIRST?
       * - Provides theme to ALL children
       * - Includes PaperProvider internally
       * - Manages light/dark/system preference
       * - Auth screens need Paper components (Button, TextInput, etc.)
       * - Cart UI needs Paper components (Badge, Chip, etc.)
       *
       * WHAT IF MISSING?
       * - Paper components crash
       * - No theme switching capability
       * - Default theme used (might not match design)
       */}

      <AuthProvider>
        {/**
         * WHY AuthProvider SECOND?
         * - Can use Paper components (PaperProvider wraps it)
         * - CartProvider needs user info (AuthProvider provides it)
         * - Doesn't need cart info
         * 
         * WHAT IT DOES:
         * - Checks for saved session on mount
         * - Provides user state and auth functions globally
         * - Enables any component to: const { user, login, logout } = useAuth()
         */}
        
        <CartProvider>
          {/**
           * WHY CartProvider THIRD?
           * - Can access user from AuthProvider (outer)
           * - Can use Paper components from PaperProvider (outermost)
           * - Most specific provider (only shopping features need it)
           * 
           * WHAT IT DOES:
           * - Loads cart from AsyncStorage on mount
           * - Provides cart state and functions globally
           * - Enables any component to: const { addToCart, cartItems } = useCart()
           * - Automatically saves cart when changed
           * 
           * DEPENDENCY ON AUTH:
           * - Needs user.id for checkout
           * - Can check if user is logged in before checkout
           */}
          
          <AppNavigator />
          {/**
           * WHY AppNavigator INNERMOST?
           * - Has access to ALL providers (theme, auth, cart)
           * - Determines which screens to show based on auth state
           * - All screens need access to all three providers
           * 
           * WHAT IT DOES:
           * - Shows LoginScreen if not logged in
           * - Shows CustomerHomeScreen if logged in
           * - Provides navigation to all screens
           */}
          
        </CartProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

/**
 * WHY EXPORT DEFAULT?
 * - Only one App component per file
 * - Convention for root component
 * - Required by index.js:
 *   import App from './App';
 *   AppRegistry.registerComponent(appName, () => App);
 */
export default App;