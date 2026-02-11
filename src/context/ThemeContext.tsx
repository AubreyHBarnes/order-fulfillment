/**
 * Theme Context
 * File: src/context/ThemeContext.tsx
 *
 * PURPOSE: Manage theme preference (light/dark/system) across the app
 *
 * RESPONSIBILITIES:
 * - Track user's theme preference
 * - Persist preference to AsyncStorage
 * - Listen to system theme changes
 * - Provide theme to all components
 *
 * WHY CONTEXT?
 * - Theme needed throughout the app
 * - Avoid prop drilling
 * - Single source of truth for theme state
 * - Same pattern as AuthContext and CartContext
 *
 * FOLLOWS PATTERN FROM: AuthContext.tsx, CartContext.tsx
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  ReactNode,
} from 'react';
import { useColorScheme, StatusBar } from 'react-native';
import { Provider as PaperProvider } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  lightTheme,
  darkTheme,
  getThemeFromMode,
  ThemeMode,
  AppTheme,
} from '../theme';

// ============================================================
// CONSTANTS
// ============================================================

/**
 * AsyncStorage key for theme preference
 *
 * WHY PREFIX?
 * - Namespace our keys to avoid conflicts
 * - Easy to identify our app's data
 * - Consistent with cart storage key pattern
 */
const THEME_STORAGE_KEY = '@GroceryFulfillment:themeMode';

// ============================================================
// CONTEXT TYPES
// ============================================================

/**
 * ThemeContextType - What the context provides
 *
 * WHY THESE VALUES?
 * - themeMode: Current preference ('light', 'dark', 'system')
 * - setThemeMode: Change preference (persists to storage)
 * - theme: Resolved theme object (for non-Paper components)
 * - isDark: Quick check for dark mode
 */
interface ThemeContextType {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  theme: AppTheme;
  isDark: boolean;
}

// ============================================================
// CONTEXT CREATION
// ============================================================

/**
 * WHY DEFAULT TO SYSTEM?
 * - Most users want app to follow device setting
 * - Respects user's OS-level preference
 * - Can be changed in settings
 */
const ThemeContext = createContext<ThemeContextType>({
  themeMode: 'system',
  setThemeMode: async () => {},
  theme: lightTheme,
  isDark: false,
});

// ============================================================
// PROVIDER COMPONENT
// ============================================================

interface ThemeProviderProps {
  children: ReactNode;
}

/**
 * ThemeProvider - Wraps app and provides theme
 *
 * WHY COMBINE WITH PaperProvider?
 * - PaperProvider needs the theme object
 * - Avoids double-wrapping in App.tsx
 * - Single provider for all theme needs
 * - Cleaner component tree
 */
export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  // ============================================================
  // STATE
  // ============================================================

  /**
   * User's theme preference
   * Default to 'system' - follows device setting
   */
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');

  /**
   * Loading state for initial preference load
   * Prevents flash of wrong theme on app start
   */
  const [isLoading, setIsLoading] = useState(true);

  // ============================================================
  // SYSTEM THEME DETECTION
  // ============================================================

  /**
   * useColorScheme - React Native hook for system theme
   *
   * WHY THIS HOOK?
   * - Automatically detects device light/dark setting
   * - Updates when user changes device setting
   * - Works on iOS, Android, and web
   * - Returns 'light', 'dark', or null
   */
  const systemColorScheme = useColorScheme();

  // ============================================================
  // DERIVED STATE
  // ============================================================

  /**
   * Resolve actual theme based on preference and system setting
   *
   * WHY useMemo?
   * - Theme object is expensive to create
   * - Only recalculate when inputs change
   * - Prevents unnecessary re-renders
   */
  const theme = useMemo(
    () => getThemeFromMode(themeMode, systemColorScheme),
    [themeMode, systemColorScheme]
  );

  /**
   * Quick boolean for dark mode check
   */
  const isDark = theme.dark;

  // ============================================================
  // PERSISTENCE
  // ============================================================

  /**
   * Load saved theme preference on mount
   *
   * WHY useEffect?
   * - Need to load from storage once on mount
   * - Async operation (can't do in useState initializer)
   * - Set loading to false when done
   */
  useEffect(() => {
    const loadThemePreference = async () => {
      try {
        const savedMode = await AsyncStorage.getItem(THEME_STORAGE_KEY);

        /**
         * WHY VALIDATE SAVED VALUE?
         * - Storage could be corrupted
         * - Old version might have different values
         * - Default to 'system' if invalid
         */
        if (savedMode === 'light' || savedMode === 'dark' || savedMode === 'system') {
          setThemeModeState(savedMode);
        }
      } catch (error) {
        console.error('Error loading theme preference:', error);
        // Keep default 'system' on error
      } finally {
        setIsLoading(false);
      }
    };

    loadThemePreference();
  }, []);

  /**
   * Set theme mode and persist to storage
   *
   * WHY useCallback?
   * - Function passed to context value
   * - Memoize to prevent unnecessary re-renders
   * - Stable reference for consumers
   */
  const setThemeMode = useCallback(async (mode: ThemeMode): Promise<void> => {
    try {
      // Update state immediately for responsive UI
      setThemeModeState(mode);

      // Persist to storage
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (error) {
      console.error('Error saving theme preference:', error);
      // State is already updated, so UI reflects change
      // Storage error is logged but doesn't break UX
    }
  }, []);

  // ============================================================
  // CONTEXT VALUE
  // ============================================================

  /**
   * WHY useMemo FOR VALUE?
   * - Context value object created each render
   * - If object reference changes, all consumers re-render
   * - useMemo keeps stable reference when values haven't changed
   * - Major performance optimization
   */
  const contextValue = useMemo(
    () => ({
      themeMode,
      setThemeMode,
      theme,
      isDark,
    }),
    [themeMode, setThemeMode, theme, isDark]
  );

  // ============================================================
  // RENDER
  // ============================================================

  /**
   * WHY RENDER LOADING STATE?
   * - Prevents flash of wrong theme
   * - Theme loads from storage asynchronously
   * - Brief delay (< 100ms typically)
   *
   * ALTERNATIVE: Could show splash screen
   * For now, just render nothing briefly
   */
  if (isLoading) {
    return null;
  }

  return (
    <ThemeContext.Provider value={contextValue}>
      {/**
       * WHY PaperProvider HERE?
       * - Provides theme to all React Native Paper components
       * - Theme prop tells Paper which colors to use
       * - All Paper components (Button, TextInput) automatically themed
       */}
      <PaperProvider theme={theme}>
        {/**
         * WHY StatusBar HERE?
         * - Status bar style should match theme
         * - 'dark-content' = dark icons (for light backgrounds)
         * - 'light-content' = light icons (for dark backgrounds)
         * - Automatic based on theme
         */}
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          backgroundColor={theme.colors.background}
        />
        {children}
      </PaperProvider>
    </ThemeContext.Provider>
  );
};

// ============================================================
// HOOK
// ============================================================

/**
 * useThemeMode - Access theme context
 *
 * WHY CUSTOM HOOK?
 * - Cleaner than useContext(ThemeContext)
 * - Can add error handling (if used outside provider)
 * - Consistent with useAuth, useCart pattern
 *
 * USAGE:
 * const { themeMode, setThemeMode, isDark } = useThemeMode();
 * setThemeMode('dark');  // Switch to dark mode
 */
export const useThemeMode = (): ThemeContextType => {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useThemeMode must be used within a ThemeProvider');
  }

  return context;
};

export default ThemeContext;
