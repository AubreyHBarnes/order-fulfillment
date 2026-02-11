/**
 * Customer Home Screen
 * File: src/screens/customer/CustomerHomeScreen.tsx
 *
 * PURPOSE: Main shopping interface where customers browse and add products to cart
 *
 * RESPONSIBILITIES:
 * - Fetch products from database
 * - Display products in grid layout
 * - Handle category filtering
 * - Handle search
 * - Show cart badge with item count
 * - Navigate to cart
 *
 * WHY THIS STRUCTURE:
 * This is a "Container Component" - it manages state and data fetching,
 * then passes data down to presentational components (ProductCard).
 * This separation makes testing easier and components more reusable.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ListRenderItemInfo,
} from 'react-native';
import {
  Searchbar,
  Text,
  Chip,
  Badge,
  ActivityIndicator,
  Icon,
} from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCart } from '../../context/CartContext';
import { useAppTheme } from '../../theme';
import {
  getAllProducts,
  getProductsByCategory,
  searchProducts,
  getCategories,
} from '../../services/productService';
import ProductCard from '../../components/customer/ProductCard';
import type { MainStackParamList, Product } from '../../types';

/**
 * WHY THESE IMPORTS?
 *
 * React Native components:
 * - View: Container for layout
 * - ScrollView: For category chips (horizontal scroll)
 * - FlatList: For product grid (optimized for lists)
 * - RefreshControl: Pull-to-refresh functionality
 * - TouchableOpacity: Cart button with visual feedback
 *
 * React Native Paper components:
 * - Searchbar: Material Design search input
 * - Chip: Category filter buttons
 * - Badge: Cart item count indicator
 * - ActivityIndicator: Loading spinner
 *
 * Custom imports:
 * - useCart: Access cart state and functions
 * - productService: Data fetching functions
 * - ProductCard: Reusable product display component
 */

type CustomerHomeScreenProps = NativeStackScreenProps<
  MainStackParamList,
  'CustomerHome'
>;

const CustomerHomeScreen: React.FC<CustomerHomeScreenProps> = ({
  navigation,
}) => {
  // ============================================================
  // THEME
  // ============================================================

  const theme = useAppTheme();

  // ============================================================
  // STATE MANAGEMENT
  // ============================================================

  /**
   * WHY SEPARATE STATE VARIABLES?
   * Could use single object: const [state, setState] = useState({...})
   * But separate variables are:
   * - Easier to update (no spreading needed)
   * - More performant (only re-renders when specific value changes)
   * - More readable (clear what each piece represents)
   */

  const [products, setProducts] = useState<Product[]>([]);
  // WHY: Array of all products to display

  const [categories, setCategories] = useState<string[]>(['All']);
  // WHY: Available categories for filtering
  // Default 'All' ensures something is always selected

  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  // WHY: Tracks which category filter is active

  const [searchQuery, setSearchQuery] = useState<string>('');
  // WHY: Controlled input for search bar

  const [loading, setLoading] = useState<boolean>(true);
  // WHY: Shows spinner while fetching data
  // True initially to show spinner on first load

  const [refreshing, setRefreshing] = useState<boolean>(false);
  // WHY: Separate from loading for pull-to-refresh
  // Different UX: refreshing shows at top, loading shows center

  const [error, setError] = useState<string | null>(null);
  // WHY: Store error messages to display to user

  // ============================================================
  // CONTEXT
  // ============================================================

  const { getItemCount } = useCart();
  /**
   * WHY DESTRUCTURE ONLY WHAT WE NEED?
   * - const cart = useCart() would work
   * - But destructuring is clearer about dependencies
   * - Only re-renders when getItemCount changes (optimization)
   * - More readable: getItemCount() vs cart.getItemCount()
   */

  // ============================================================
  // EFFECTS
  // ============================================================

  /**
   * Load initial data on mount
   *
   * WHY useEffect?
   * - Side effect (data fetching) shouldn't happen during render
   * - Runs after component mounts
   * - Empty dependency array [] = run once
   *
   * WHY ASYNC/AWAIT IN useEffect?
   * useEffect can't be async directly:
   * useEffect(async () => {...})  // Returns promise, not cleanup
   * useEffect(() => { async function load() {...}; load(); })
   */
  useEffect(() => {
    loadInitialData();
  }, []);

  /**
   * WHY SEPARATE FUNCTION?
   * Could write logic directly in useEffect, but:
   * - Can reuse for refresh
   * - Cleaner useEffect (shows intent)
   * - Easier to test
   * - Can call from multiple places
   */
  const loadInitialData = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      // Parallel requests (faster than sequential)
      /**
       * WHY Promise.all?
       * Sequential (slow):
       *   const cats = await getCategories();  // Wait 500ms
       *   const prods = await getAllProducts();  // Wait 500ms
       *   Total: 1000ms
       *
       * Parallel (fast):
       *   const [cats, prods] = await Promise.all([...]);
       *   Total: 500ms (both at once)
       */
      const [categoriesResult, productsResult] = await Promise.all([
        getCategories(),
        getAllProducts(),
      ]);

      if (categoriesResult.success) {
        // Prepend 'All' to categories
        /**
         * WHY ['All', ...categoriesResult.data]?
         * - Spread operator creates new array
         * - Adds 'All' as first option
         * - Keeps original categories intact
         * - Could also: ['All'].concat(categoriesResult.data)
         */
        setCategories(['All', ...categoriesResult.data]);
      }

      if (productsResult.success) {
        setProducts(productsResult.data);
      } else {
        setError(productsResult.error ?? 'Failed to load products');
      }
    } catch (err) {
      /**
       * WHY TRY/CATCH?
       * Promise.all rejects if ANY promise fails
       * Without try/catch: app crashes
       * With try/catch: show error message gracefully
       */
      console.error('Error loading data:', err);
      setError('Failed to load products. Please try again.');
    } finally {
      /**
       * WHY FINALLY?
       * - Runs whether try succeeds or catch runs
       * - Perfect for cleanup (always stop loading)
       * - Prevents stuck loading spinner
       */
      setLoading(false);
    }
  };

  // ============================================================
  // HANDLERS
  // ============================================================

  /**
   * Handle category filter selection
   *
   * WHY ASYNC?
   * Needs to fetch filtered products from database
   */
  const handleCategorySelect = async (category: string): Promise<void> => {
    setSelectedCategory(category);
    setSearchQuery(''); // Clear search when filtering
    /**
     * WHY CLEAR SEARCH?
     * - Category and search are different filters
     * - Applying both at once is confusing
     * - User expects category to show all products in that category
     */

    try {
      setLoading(true);
      setProducts([]); // Clear products to trigger loading state
      /**
       * WHY CLEAR PRODUCTS?
       * - Prevents stale data from previous category showing during fetch
       * - Ensures loading spinner displays (loading && products.length === 0)
       * - Avoids layout jump when new data arrives with different item count
       */

      let result;
      if (category === 'All') {
        result = await getAllProducts();
      } else {
        result = await getProductsByCategory(category);
      }

      if (result.success) {
        setProducts(result.data);
      }
    } catch (err) {
      console.error('Error filtering products:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle search query changes
   *
   * WHY NOT ASYNC?
   * Just updates state - doesn't fetch yet
   * Actual search happens in separate function
   */
  const handleSearchChange = (query: string): void => {
    setSearchQuery(query);

    /**
     * WHY CHECK IF EMPTY?
     * - Empty search should show all products
     * - User expects clearing search to reset view
     * - Prevents unnecessary API call
     */
    if (query.trim() === '') {
      loadInitialData();
    }
  };

  /**
   * Execute search when user submits
   *
   * WHY SEPARATE FROM handleSearchChange?
   * - Don't search on every keystroke (too many API calls)
   * - Search when user presses enter/search button
   * - Better performance, less server load
   *
   * ALTERNATIVE: Debouncing
   * Could search as user types with delay:
   *   const debouncedSearch = debounce(searchProducts, 500);
   * For this app: Submit is simpler
   */
  const handleSearchSubmit = async (): Promise<void> => {
    if (!searchQuery.trim()) return;

    try {
      setLoading(true);
      setProducts([]); // Clear products to trigger loading state
      setSelectedCategory('All'); // Reset category filter

      const result = await searchProducts(searchQuery);
      if (result.success) {
        setProducts(result.data);
      }
    } catch (err) {
      console.error('Error searching products:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle pull-to-refresh
   *
   * WHY SEPARATE FROM loadInitialData?
   * - Uses different loading state (refreshing vs loading)
   * - Different UI feedback (spinner at top vs center)
   * - Could add analytics: "User refreshed"
   *
   * WHY RESPECT SELECTED CATEGORY?
   * - User expectation: "I'm viewing Dairy, refresh should show updated Dairy products"
   * - Calling loadInitialData() would fetch ALL products, ignoring the filter
   * - This caused a bug: products showed all items but category chip stayed selected
   * - State inconsistency = confusing UX and potential trust issues
   *
   * THE BUG EXPLAINED:
   * Before fix: handleRefresh -> loadInitialData -> getAllProducts()
   *   - selectedCategory state: "Dairy" (unchanged)
   *   - products state: ALL products (reset by loadInitialData)
   *   - Result: UI shows "Dairy" selected but displays all products (mismatch!)
   *
   * After fix: handleRefresh checks selectedCategory and fetches accordingly
   *   - selectedCategory state: "Dairy" (unchanged)
   *   - products state: Only Dairy products (respects filter)
   *   - Result: UI is consistent - "Dairy" selected, Dairy products shown
   *
   * KEY PRINCIPLE: State should always be consistent across related values.
   * When two pieces of state are conceptually linked (selectedCategory and products),
   * any operation that changes one should consider the other.
   */
  const handleRefresh = async (): Promise<void> => {
    setRefreshing(true);

    try {
      /**
       * WHY CONDITIONAL FETCH?
       * - Check current selectedCategory state
       * - Fetch products that match the active filter
       * - "All" = getAllProducts(), otherwise = getProductsByCategory()
       * - This mirrors the logic in handleCategorySelect
       */
      let result;
      if (selectedCategory === 'All') {
        result = await getAllProducts();
      } else {
        result = await getProductsByCategory(selectedCategory);
      }

      if (result.success) {
        setProducts(result.data);
      }
    } catch (err) {
      console.error('Error refreshing products:', err);
    } finally {
      setRefreshing(false);
    }
  };

  /**
   * Navigate to product detail
   *
   * WHY PASS product?
   * - Need product data in detail screen
   * - React Navigation passes as route.params
   * - Alternative: Pass only ID, fetch in detail screen
   * - Passing object: Faster (no fetch), but stale if product updates
   * - For this app: Passing object is fine
   */
  const handleProductPress = (product: Product): void => {
    // Will implement in Phase 3.2
    console.log('Product pressed:', product.name);
    // navigation.navigate('ProductDetail', { product });
  };

  /**
   * Navigate to cart
   *
   * WHY SIMPLE NAVIGATION?
   * - Cart screen handles all cart logic
   * - No params needed (cart data from context)
   * - Standard navigation pattern
   */
  const handleCartPress = (): void => {
    navigation.navigate('Cart');
  };

  /**
   * Navigate to orders list
   */
  const handleOrdersPress = (): void => {
    navigation.navigate('Orders');
  };

  // ============================================================
  // DYNAMIC STYLES
  // ============================================================

  const dynamicStyles = {
    container: {
      backgroundColor: theme.colors.background,
    },
    header: {
      backgroundColor: theme.colors.surface,
    },
    cartBadge: {
      backgroundColor: theme.colors.error,
    },
    emptyText: {
      color: theme.custom.textSecondary,
    },
    loadingText: {
      color: theme.custom.textSecondary,
    },
    errorTitle: {
      color: theme.colors.error,
    },
    errorText: {
      color: theme.custom.textSecondary,
    },
    retryButton: {
      backgroundColor: theme.colors.primary,
    },
    retryButtonText: {
      color: theme.colors.onPrimary,
    },
  };

  // ============================================================
  // RENDER FUNCTIONS
  // ============================================================

  /**
   * Render individual product item
   *
   * WHY SEPARATE FUNCTION?
   * - FlatList renderItem requires function
   * - Could inline: renderItem={(item) => <ProductCard />}
   * - Separate: Cleaner, easier to add logic
   * - Can add analytics, error handling here
   */
  const renderProduct = ({
    item,
  }: ListRenderItemInfo<Product>): React.ReactElement => {
    /**
     * WHY DESTRUCTURE { item }?
     * FlatList passes: { item, index, separators }
     * We only need item
     * Could: const renderProduct = (data) => { const item = data.item; }
     * Destructuring is cleaner
     */
    return <ProductCard product={item} onPress={handleProductPress} />;
  };

  /**
   * Render empty state
   *
   * WHY SEPARATE COMPONENT?
   * - FlatList shows when data is empty
   * - Better UX than blank screen
   * - Explains why nothing is showing
   * - Opportunity to guide user
   */
  const renderEmptyState = (): React.ReactElement | null => {
    /**
     * WHY CHECK LOADING?
     * Don't show "No products" while still loading
     * Show spinner first, then empty state if really empty
     */
    if (loading) return null;

    return (
      <View style={styles.emptyContainer}>
        <Text variant="headlineSmall" style={styles.emptyTitle}>
          No Products Found
        </Text>
        <Text variant="bodyMedium" style={[styles.emptyText, dynamicStyles.emptyText]}>
          {searchQuery
            ? `No results for "${searchQuery}"`
            : 'No products available in this category'}
        </Text>
      </View>
    );
  };

  // ============================================================
  // MAIN RENDER
  // ============================================================

  /**
   * WHY EARLY RETURN FOR LOADING?
   * - Simplifies main render
   * - Prevents rendering incomplete UI
   * - Clear loading state
   *
   * ALTERNATIVE: Conditional rendering in JSX
   *   {loading ? <Spinner /> : <ProductList />}
   * Early return is cleaner for full-screen loading
   */
  if (loading && products.length === 0) {
    return (
      <View style={[styles.centerContainer, dynamicStyles.container]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, dynamicStyles.loadingText]}>Loading products...</Text>
      </View>
    );
  }

  /**
   * WHY CHECK error?
   * - Show user-friendly error message
   * - Provide action (retry)
   * - Better than crash or blank screen
   */
  if (error && products.length === 0) {
    return (
      <View style={[styles.centerContainer, dynamicStyles.container]}>
        <Text variant="headlineSmall" style={[styles.errorTitle, dynamicStyles.errorTitle]}>
          Oops! Something went wrong
        </Text>
        <Text variant="bodyMedium" style={[styles.errorText, dynamicStyles.errorText]}>
          {error}
        </Text>
        <TouchableOpacity style={[styles.retryButton, dynamicStyles.retryButton]} onPress={loadInitialData}>
          <Text style={[styles.retryButtonText, dynamicStyles.retryButtonText]}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, dynamicStyles.container]}>
      {/* ========== HEADER ========== */}
      <View style={[styles.header, dynamicStyles.header]}>
        <Text variant="headlineMedium" style={styles.headerTitle}>
          Grocery Store
        </Text>

        <View style={styles.headerButtons}>
          {/* Orders Button */}
          <TouchableOpacity
            onPress={handleOrdersPress}
            style={styles.headerButton}
            accessible={true}
            accessibilityLabel="My Orders"
            accessibilityHint="Double tap to view your orders"
            accessibilityRole="button"
          >
            <Icon source="clipboard-text-outline" size={28} color={theme.colors.primary} />
          </TouchableOpacity>

          {/* Cart Button with Badge */}
          <TouchableOpacity
            onPress={handleCartPress}
            style={styles.headerButton}
            /**
             * WHY ACCESSIBILITY PROPS?
             * - Screen readers need labels
             * - Required for WCAG compliance
             * - Professional apps must have this
             * - Impressive in interviews
             */
            accessible={true}
            accessibilityLabel={`Shopping cart with ${getItemCount()} items`}
            accessibilityHint="Double tap to view cart"
            accessibilityRole="button"
          >
            <Icon source="cart" size={28} color={theme.colors.primary} />
            {/**
             * WHY CONDITIONAL BADGE?
             * Only show if cart has items
             * Cleaner when empty
             * Visual feedback for adding items
             */}
            {getItemCount() > 0 && (
              <Badge style={[styles.cartBadge, dynamicStyles.cartBadge]}>{getItemCount()}</Badge>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ========== SEARCH BAR ========== */}
      <Searchbar
        placeholder="Search products..."
        onChangeText={handleSearchChange}
        value={searchQuery}
        onSubmitEditing={handleSearchSubmit}
        /**
         * WHY onSubmitEditing?
         * - Triggers when user presses enter/search
         * - Better than searching on every keystroke
         * - Standard mobile pattern
         */
        style={styles.searchBar}
        /**
         * WHY icon and iconColor?
         * - Custom search icon styling
         * - Matches brand colors
         * - Better visual hierarchy
         */
        icon="magnify"
        iconColor={theme.colors.primary}
      />

      {/* ========== CATEGORY FILTERS ========== */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        /**
         * WHY HORIZONTAL SCROLLVIEW?
         * - Categories might not fit on screen
         * - Horizontal scroll is standard for filters
         * - showsHorizontalScrollIndicator={false} = cleaner UI
         *
         * ALTERNATIVE: Dropdown
         * Horizontal chips are more discoverable
         */
        style={styles.categoryContainer}
        contentContainerStyle={styles.categoryContent}
      >
        {categories.map((category) => (
          <Chip
            key={category}
            /**
             * WHY KEY?
             * - React needs unique key for list items
             * - Helps React identify which items changed
             * - Performance optimization
             * - Using category name as key (unique and stable)
             */
            selected={selectedCategory === category}
            /**
             * WHY SELECTED PROP?
             * - Visual feedback (highlighted)
             * - User knows which filter is active
             * - Material Design pattern
             */
            onPress={() => handleCategorySelect(category)}
            style={styles.categoryChip}
            /**
             * WHY SELECTED STYLE?
             * - Different colors for active vs inactive
             * - Clear visual distinction
             * - Accessibility (not just color, also different appearance)
             */
            selectedColor={theme.colors.primary}
          >
            {category}
          </Chip>
        ))}
      </ScrollView>

      {/* ========== PRODUCT GRID ========== */}
      <FlatList
        /**
         * WHY FLATLIST OVER SCROLLVIEW?
         *
         * ScrollView:
         * - Renders ALL items immediately
         * - 100 products = render 100 cards at once
         * - Slow, memory intensive
         *
         * FlatList:
         * - Renders only visible items
         * - Virtual scrolling (lazy loading)
         * - Recycles views (memory efficient)
         * - Standard for lists in React Native
         */
        style={styles.flatList}
        /**
         * WHY style={{ flex: 1 }}?
         * - FlatList needs to fill remaining vertical space
         * - Without it, FlatList only takes content height
         * - Causes layout issues when few products (3-4 items)
         * - flex: 1 ensures consistent layout regardless of content
         */
        data={products}
        renderItem={renderProduct}
        keyExtractor={(item) => item.$id}
        /**
         * WHY KEY EXTRACTOR?
         * - FlatList needs unique key for each item
         * - item.$id is Appwrite document ID (guaranteed unique)
         * - Better than index (stable across updates)
         */
        numColumns={2}
        /**
         * WHY 2 COLUMNS?
         * - Mobile screens are narrow
         * - 2 columns = good balance (visibility vs quantity)
         * - 1 column = too much scrolling
         * - 3 columns = too small on phone
         * - Could make responsive based on screen width
         */
        columnWrapperStyle={styles.row}
        /**
         * WHY columnWrapperStyle?
         * - Styles the row container
         * - For spacing between columns
         * - Could also use contentContainerStyle
         */
        contentContainerStyle={styles.productList}
        ListEmptyComponent={renderEmptyState}
        /**
         * WHY ListEmptyComponent?
         * - Shows when data is empty
         * - Better UX than blank screen
         * - Can show message, image, action
         */
        refreshControl={
          <RefreshControl
            /**
             * WHY REFRESH CONTROL?
             * - Standard mobile pattern
             * - User expects pull-to-refresh
             * - Updates data without leaving screen
             * - Shows app is reactive
             */
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]} // Android
            tintColor={theme.colors.primary} // iOS
          />
        }
      />

      {/* ========== FLOATING CART BUTTON (ALTERNATIVE) ========== */}
      {/**
       * WHY FAB (Floating Action Button)?
       * - Always visible (doesn't scroll away)
       * - Primary action for this screen
       * - Material Design pattern
       * - Eye-catching
       *
       * WHY COMMENTED OUT?
       * - Already have cart in header
       * - Two cart buttons is redundant
       * - Uncomment if you remove header cart
       * - Good to show alternative approach
       */}
      {/* <FAB
        icon="cart"
        style={styles.fab}
        onPress={handleCartPress}
        label={getItemCount() > 0 ? String(getItemCount()) : undefined}
      /> */}
    </View>
  );
};

// ============================================================
// STYLES
// ============================================================

/**
 * WHY StyleSheet.create()?
 * - Performance: Styles created once, not on every render
 * - Validation: Catches style errors in development
 * - Better than inline styles
 *
 * WHY THIS ORGANIZATION?
 * - Layout styles first (container, header)
 * - Section styles (search, categories)
 * - List styles (products, items)
 * - Element styles (text, buttons)
 * - Easier to find and maintain
 */
const styles = StyleSheet.create({
  // ===== LAYOUT =====
  container: {
    flex: 1,
    /**
     * WHY flex: 1?
     * - Takes all available space
     * - Allows FlatList to scroll
     * - Standard for screen containers
     */
  },

  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  // ===== HEADER =====
  header: {
    flexDirection: 'row',
    /**
     * WHY flexDirection: row?
     * - Places title and cart button side-by-side
     * - Default is column (stacked)
     */
    justifyContent: 'space-between',
    /**
     * WHY space-between?
     * - Title on left, cart on right
     * - Maximum separation
     * - Standard header pattern
     */
    alignItems: 'center',
    padding: 16,
    /**
     * WHY elevation/shadowOffset?
     * - Creates shadow (depth)
     * - Separates header from content
     * - Material Design standard
     * - elevation (Android), shadow* (iOS)
     */
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },

  headerTitle: {
    fontWeight: 'bold',
  },

  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  headerButton: {
    position: 'relative',
    /**
     * WHY position: relative?
     * - Allows badge to position absolutely within button
     * - Badge can overlay the cart icon
     */
    padding: 8,
  },

  cartBadge: {
    position: 'absolute',
    /**
     * WHY position: absolute?
     * - Overlays the cart icon
     * - Doesn't affect button layout
     * - Can position precisely with top/right
     */
    top: 0,
    right: 0,
  },

  // ===== SEARCH =====
  searchBar: {
    margin: 16,
    marginTop: 8,
    marginBottom: 8,
    elevation: 0,
    /**
     * WHY elevation: 0?
     * - Paper components have default elevation
     * - Remove shadow for cleaner look
     * - Searchbar border is enough
     */
  },

  // ===== CATEGORIES =====
  categoryContainer: {
    height: 50,
    flexGrow: 0,
    flexShrink: 0,
    /**
     * WHY flexGrow: 0, flexShrink: 0?
     * - Prevents ScrollView from expanding in flex container
     * - height: 50 alone can be overridden by flex behavior
     * - These ensure the container stays exactly 50px
     * - Without them, container expands when FlatList has few items
     */
  },

  categoryContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    /**
     * WHY contentContainerStyle?
     * - ScrollView styles the content, not wrapper
     * - paddingHorizontal: Space from edges
     * - paddingVertical: Vertical breathing room
     */
  },

  categoryChip: {
    marginRight: 8,
    height: 32,
    /**
     * WHY marginRight?
     * - Space between chips
     * - Last chip has extra space (ok for horizontal scroll)
     * - Could use gap (newer React Native)
     */
  },

  // ===== PRODUCTS =====
  flatList: {
    flex: 1,
    /**
     * WHY flex: 1?
     * - Makes FlatList fill remaining vertical space in container
     * - Without this, FlatList height = content height
     * - With few items, causes layout gaps above the list
     * - Ensures consistent layout regardless of product count
     */
  },

  productList: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    /**
     * WHY paddingHorizontal: 20?
     * - More space between device edges and product grid
     * - Creates visual breathing room on sides
     * - Cards appear more centered and less cramped
     */
  },

  row: {
    justifyContent: 'center',
    gap: 12,
    /**
     * WHY justifyContent: center with gap?
     * - Centers cards instead of spreading them apart
     * - gap: 12 gives consistent, smaller spacing between cards
     * - Cards closer together horizontally than space-between
     */
  },

  // ===== EMPTY STATE =====
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },

  emptyTitle: {
    marginBottom: 8,
    textAlign: 'center',
  },

  emptyText: {
    textAlign: 'center',
  },

  // ===== LOADING =====
  loadingText: {
    marginTop: 16,
  },

  // ===== ERROR =====
  errorTitle: {
    marginBottom: 8,
  },

  errorText: {
    marginBottom: 24,
    textAlign: 'center',
  },

  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },

  retryButtonText: {
    fontWeight: '600',
    fontSize: 16,
  },

  // ===== FAB (if using) =====
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
});

export default CustomerHomeScreen;
