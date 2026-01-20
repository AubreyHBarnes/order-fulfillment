/**
 * App.js - Root Component
 * 
 * PURPOSE: Entry point of the application
 * Sets up all global providers (theming, auth, cart)
 * 
 * PROVIDER HIERARCHY (Order Matters!):
 * 1. PaperProvider - Material Design theming (outermost)
 * 2. AuthProvider - Authentication state
 * 3. CartProvider - Shopping cart state (innermost)
 * 4. AppNavigator - Navigation (uses all providers above)
 * 
 * WHY THIS ORDER?
 * - Inner providers can access outer providers
 * - CartProvider needs AuthProvider (for user info at checkout)
 * - AuthProvider needs PaperProvider (uses Paper components)
 * - All need theme (PaperProvider provides it)
 */

import React from 'react';
import { Provider as PaperProvider } from 'react-native-paper';
import { AuthProvider } from './src/context/AuthContext';
import { CartProvider } from './src/context/CartContext';
import AppNavigator from './src/navigation/AppNavigator';
// import { lightTheme } from './src/constants/theme';

/**
 * WHY THESE IMPORTS?
 * 
 * React:
 * - Core library for JSX and components
 * 
 * PaperProvider (aliased):
 * - Provides Material Design theming
 * - "as PaperProvider" avoids naming conflicts
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
 * 
 * lightTheme:
 * - Custom theme configuration (colors, spacing, typography)
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
    <PaperProvider>
      {/**
       * WHY PaperProvider FIRST?
       * - Provides theme to ALL children
       * - Auth screens need Paper components (Button, TextInput, etc.)
       * - Cart UI needs Paper components (Badge, Chip, etc.)
       * - Must wrap everything that uses Material Design
       * 
       * WHAT IF MISSING?
       * - Paper components crash
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
    </PaperProvider>
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