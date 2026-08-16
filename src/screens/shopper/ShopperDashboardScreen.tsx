/**
 * Shopper Dashboard Screen
 * File: src/screens/shopper/ShopperDashboardScreen.tsx
 *
 * PURPOSE:
 * The main screen for shoppers. This is their "home base" - the first thing
 * they see when they open the app and where they return between tasks.
 *
 * ============================================================
 * SCREEN STRUCTURE (TOP TO BOTTOM)
 * ============================================================
 *
 * ┌─────────────────────────────────────────────┐
 * │  Home                              ⚙️      │  ← Header (screen name + settings)
 * ├─────────────────────────────────────────────┤
 * │  🏪 Fresh Mart Grocery                      │  ← Store name
 * │  Welcome back, Sarah!                       │  ← Shopper greeting
 * ├─────────────────────────────────────────────┤
 * │  MY STATUS                                  │
 * │  ┌─────────────────────────────────────┐   │
 * │  │  ✓ Available              ▼        │   │  ← Status dropdown
 * │  └─────────────────────────────────────┘   │
 * ├─────────────────────────────────────────────┤
 * │  CURRENT TASK                               │
 * │  ┌─────────────────────────────────────┐   │
 * │  │  #ABC12345                          │   │  ← Current task card
 * │  │  12 items • John Smith • Delivery   │   │     (or "No tasks" state)
 * │  └─────────────────────────────────────┘   │
 * ├─────────────────────────────────────────────┤
 * │  ┌─────────────────────────────────────┐   │
 * │  │  📋 Pick Tasks                 (5) >│   │  ← Quick link cards
 * │  └─────────────────────────────────────┘   │
 * │  ┌─────────────────────────────────────┐   │
 * │  │  🚚 Drop Offs                  (3) >│   │
 * │  └─────────────────────────────────────┘   │
 * │  ┌─────────────────────────────────────┐   │
 * │  │  👤 Customer Check-ins         (2) >│   │
 * │  └─────────────────────────────────────┘   │
 * └─────────────────────────────────────────────┘
 *
 * ============================================================
 * DESIGN PHILOSOPHY
 * ============================================================
 *
 * 1. TASK-FOCUSED
 *    - Current task is prominently displayed
 *    - Shopper always knows "what should I be doing?"
 *
 * 2. STATUS AWARENESS
 *    - Clear indicator of availability
 *    - Easy to toggle on/off for breaks
 *
 * 3. QUICK NAVIGATION
 *    - One tap to any major section
 *    - Counts show what needs attention
 *
 * 4. INFORMATION HIERARCHY
 *    - Store/shopper identity at top
 *    - Status (can they receive tasks?)
 *    - Current task (what to do now)
 *    - Quick links (what else is happening)
 *
 * ============================================================
 * STATE MANAGEMENT NOTE
 * ============================================================
 *
 * For this visual-focused implementation, we're using:
 * - Mock data for counts and task info
 * - Local state for status (will connect to backend later)
 *
 * In production, this would:
 * - Fetch shopper status from ShopperStatus collection
 * - Fetch current task from Orders collection
 * - Fetch counts from respective collections
 * - Subscribe to real-time updates
 */

import React, { useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Text, Icon } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useAppTheme } from '../../theme';
import { getAvailableTasksCount, getCurrentAssignedOrder } from '../../services/orderService';
import { getShopperStatus, updateShopperAvailability } from '../../services/shopperStatusService';
import { getUserProfileById, getCustomerDisplayName } from '../../services/userService';
import ShopperStatusDropdown from '../../components/shopper/ShopperStatusDropdown';
import CurrentTaskCard from '../../components/shopper/CurrentTaskCard';
import QuickLinkCard from '../../components/shopper/QuickLinkCard';
import type { ShopperStackParamList, ShopperAvailability, TaskCardData, Order } from '../../types';

// ============================================================
// TYPES
// ============================================================

type ShopperDashboardScreenProps = NativeStackScreenProps<
  ShopperStackParamList,
  'ShopperHome'
>;

// ============================================================
// CONSTANTS
// ============================================================

// Store name (would come from app config or store selection)
const STORE_NAME = 'Fresh Mart Grocery';

// Mock counts for other quick links (will be replaced with real data later)
const MOCK_DROP_OFFS_COUNT = 0;
const MOCK_CHECK_INS_COUNT = 0;

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Parse items string to get counts
 *
 * WHY THIS FORMAT?
 * - items is stored as "productId:quantity,productId:quantity,..."
 * - Need to count total items and unique products
 *
 * @param items - Compact items string from order
 * @returns Object with itemCount and uniqueItemCount
 */
const parseItemCounts = (items: string): { itemCount: number; uniqueItemCount: number } => {
  if (!items || items.trim() === '') {
    return { itemCount: 0, uniqueItemCount: 0 };
  }

  const itemPairs = items.split(',').filter((item) => item.length > 0);
  let totalItems = 0;

  for (const pair of itemPairs) {
    const parts = pair.split(':');
    const quantity = parts[1] ?? '0';
    totalItems += parseInt(quantity, 10) || 0;
  }

  return {
    itemCount: totalItems,
    uniqueItemCount: itemPairs.length,
  };
};

/**
 * Parse pickedItems string to get picked count
 *
 * @param pickedItems - Compact picked items string from order
 * @returns Total number of items picked
 */
const parsePickedItemsCount = (pickedItems: string): number => {
  if (!pickedItems || pickedItems.trim() === '') {
    return 0;
  }

  const itemPairs = pickedItems.split(',').filter((item) => item.length > 0);
  let totalPicked = 0;

  for (const pair of itemPairs) {
    const parts = pair.split(':');
    const quantity = parts[1] ?? '0';
    totalPicked += parseInt(quantity, 10) || 0;
  }

  return totalPicked;
};

/**
 * Format due time for display
 *
 * @param scheduledReadyTime - ISO timestamp
 * @returns Formatted time string like "2:30 PM"
 */
const formatDueTime = (scheduledReadyTime: string): string => {
  const date = new Date(scheduledReadyTime);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

/**
 * Generate short order ID for display
 *
 * @param orderId - Full order ID
 * @returns Short version (first 8 chars)
 */
const generateShortOrderId = (orderId: string): string => {
  return orderId.substring(0, 8).toUpperCase();
};

// ============================================================
// COMPONENT
// ============================================================

const ShopperDashboardScreen: React.FC<ShopperDashboardScreenProps> = ({
  navigation,
}) => {
  const theme = useAppTheme();
  const { userProfile } = useAuth();

  // ============================================================
  // STATE
  // ============================================================

  /**
   * SHOPPER STATUS STATE
   *
   * Fetched from ShopperStatus collection on mount.
   * Default to 'unavailable' until we fetch from database.
   */
  const [shopperStatus, setShopperStatus] = useState<ShopperAvailability>('unavailable');
  const [statusLoading, setStatusLoading] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  /**
   * CURRENT TASK STATE
   *
   * Transformed from Order to TaskCardData for display.
   * null = no assigned task.
   */
  const [currentTask, setCurrentTask] = useState<TaskCardData | null>(null);

  /**
   * AVAILABLE TASKS COUNT
   *
   * WHY LIVE DATA?
   * - Shoppers need to see real-time task availability
   * - Count updates when returning to dashboard (useFocusEffect)
   * - Shows actual pending orders in the system
   */
  const [availableTasksCount, setAvailableTasksCount] = useState<number>(0);
  const [tasksCountLoading, setTasksCountLoading] = useState<boolean>(true);

  // ============================================================
  // HELPER: Transform Order to TaskCardData
  // ============================================================

  /**
   * Transform an Order to TaskCardData for display
   *
   * @param order - The order to transform
   * @param customerName - Customer's display name
   * @param shopperName - Shopper's display name
   * @returns TaskCardData for the CurrentTaskCard
   */
  const transformOrderToTaskCard = (
    order: Order,
    customerName: string,
    shopperName: string
  ): TaskCardData => {
    const { itemCount, uniqueItemCount } = parseItemCounts(order.items);
    const pickedItemCount = parsePickedItemsCount(order.pickedItems ?? '');
    const fulfillmentType = order.deliveryAddress.startsWith('PICKUP:') ? 'pickup' : 'delivery';

    return {
      orderId: order.$id,
      shortOrderId: generateShortOrderId(order.$id),
      itemCount,
      uniqueItemCount,
      pickedItemCount,
      customerName,
      shopperName,
      fulfillmentType,
      dueTime: order.scheduledReadyTime ? formatDueTime(order.scheduledReadyTime) : undefined,
      status: order.status,
    };
  };

  // ============================================================
  // EFFECTS
  // ============================================================

  /**
   * Fetch shopper status, current task, and available tasks count when screen focuses
   *
   * WHY useFocusEffect instead of useEffect?
   * - Dashboard is a "hub" - users return here frequently
   * - Need fresh data each time they return
   * - Catches new orders and status changes
   */
  useFocusEffect(
    useCallback(() => {
      const shopperId = userProfile?.shopperID;

      const fetchDashboardData = async (): Promise<void> => {
        if (!shopperId) {
          setInitialLoadComplete(true);
          return;
        }

        // Fetch available tasks count
        setTasksCountLoading(true);
        const tasksResult = await getAvailableTasksCount();
        if (tasksResult.success) {
          setAvailableTasksCount(tasksResult.count);
        }
        setTasksCountLoading(false);

        // Fetch shopper status from database
        const statusResult = await getShopperStatus(shopperId);
        if (statusResult.success && statusResult.data) {
          const status = statusResult.data;
          setShopperStatus(status.isAvailable ? 'available' : 'unavailable');

          // If there's a current order, fetch it
          if (status.currentOrderId) {
            await fetchCurrentTask(shopperId);
          } else {
            setCurrentTask(null);
          }
        }

        setInitialLoadComplete(true);
      };

      fetchDashboardData();
    }, [userProfile?.shopperID])
  );

  /**
   * Fetch the current assigned order and transform to TaskCardData
   */
  const fetchCurrentTask = async (shopperId: string): Promise<void> => {
    const orderResult = await getCurrentAssignedOrder(shopperId);
    if (orderResult.success && orderResult.data) {
      const order = orderResult.data;

      // Fetch customer profile for name
      const customerResult = await getUserProfileById(order.customerID);
      const customerName = getCustomerDisplayName(customerResult.data);

      // Get shopper's name from current user profile
      const shopperName = userProfile
        ? `${userProfile.firstName} ${userProfile.lastName}`
        : 'Unknown Shopper';

      const taskData = transformOrderToTaskCard(order, customerName, shopperName);
      setCurrentTask(taskData);
    } else {
      setCurrentTask(null);
    }
  };

  // ============================================================
  // HANDLERS
  // ============================================================

  /**
   * Handle status change
   *
   * When becoming available:
   * - Updates ShopperStatus.isAvailable in database
   * - Checks for pending orders and auto-assigns if found
   * - Updates currentTask state with assigned order
   */
  const handleStatusChange = async (newStatus: ShopperAvailability): Promise<void> => {
    if (!userProfile?.shopperID) {
      Alert.alert('Error', 'Shopper profile not found');
      return;
    }

    setStatusLoading(true);

    const isAvailable = newStatus === 'available';
    const result = await updateShopperAvailability(userProfile.shopperID, isAvailable);

    if (result.success) {
      setShopperStatus(newStatus);

      if (isAvailable) {
        // If an order was auto-assigned, transform it to TaskCardData
        if (result.assignedOrder) {
          const customerResult = await getUserProfileById(result.assignedOrder.customerID);
          const customerName = getCustomerDisplayName(customerResult.data);
          const shopperName = `${userProfile.firstName} ${userProfile.lastName}`;

          const taskData = transformOrderToTaskCard(
            result.assignedOrder,
            customerName,
            shopperName
          );
          setCurrentTask(taskData);
        }
      } else {
        // Going unavailable releases any current task back to the queue
        setCurrentTask(null);
      }

      // Refresh available tasks count either way - the queue just changed
      const tasksResult = await getAvailableTasksCount();
      if (tasksResult.success) {
        setAvailableTasksCount(tasksResult.count);
      }
    } else {
      Alert.alert('Error', result.error ?? 'Failed to update status');
    }

    setStatusLoading(false);
  };

  /**
   * Navigate to settings
   */
  const handleSettingsPress = (): void => {
    navigation.navigate('ShopperSettings');
  };

  /**
   * Navigate to task detail
   */
  const handleTaskPress = (task: TaskCardData): void => {
    navigation.navigate('TaskDetail', { orderId: task.orderId });
  };

  /**
   * Navigate to available tasks list
   */
  const handlePickTasksPress = (): void => {
    navigation.navigate('AvailableTasks');
  };

  /**
   * Navigate to drop offs list
   */
  const handleDropOffsPress = (): void => {
    navigation.navigate('DropOffs');
  };

  /**
   * Navigate to customer check-ins list
   */
  const handleCheckInsPress = (): void => {
    navigation.navigate('CustomerCheckIns');
  };

  // ============================================================
  // DERIVED VALUES
  // ============================================================

  /**
   * Get shopper's first name for greeting
   *
   * WHY FIRST NAME ONLY?
   * - More personal and friendly
   * - Saves horizontal space
   * - Common pattern in consumer apps
   */
  const shopperFirstName = userProfile?.firstName ?? 'Shopper';

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
    headerTitle: {
      color: theme.colors.onSurface,
    },
    storeName: {
      color: theme.colors.primary,
    },
    greeting: {
      color: theme.custom.textSecondary,
    },
    sectionTitle: {
      color: theme.custom.textSecondary,
    },
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <View style={[styles.container, dynamicStyles.container]}>
      {/* ============================================================
          HEADER
          Screen title + Settings icon
          ============================================================ */}
      {/**
       * WHY CUSTOM HEADER vs NAVIGATION HEADER?
       *
       * Option A: Use React Navigation header
       * - Less code
       * - But: Less control over styling, harder to customize
       *
       * Option B: Custom header (what we chose)
       * - Full control over design
       * - Can match exact mockup
       * - Consistent with other custom screens
       *
       * For production, you might:
       * - Use navigation header for consistency
       * - Or keep custom for this prominent screen
       */}
      <View style={[styles.header, dynamicStyles.header]}>
        <Text variant="titleLarge" style={[styles.headerTitle, dynamicStyles.headerTitle]}>
          Home
        </Text>
        <TouchableOpacity
          onPress={handleSettingsPress}
          style={styles.settingsButton}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Settings"
          accessibilityHint="Double tap to open settings"
        >
          <Icon source="cog" size={24} color={theme.custom.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ============================================================
            STORE & SHOPPER INFO
            Store name and personalized greeting
            ============================================================ */}
        {/**
         * WHY SHOW STORE NAME?
         *
         * 1. CONTEXT - Shopper might work at multiple stores
         * 2. BRANDING - Reinforces store identity
         * 3. VERIFICATION - Confirms they're in right place
         *
         * In a multi-store app, this would come from store selection
         * or location-based detection.
         */}
        <View style={styles.storeSection}>
          <View style={styles.storeRow}>
            <Icon source="store" size={24} color={theme.colors.primary} />
            <Text variant="titleMedium" style={[styles.storeName, dynamicStyles.storeName]}>
              {STORE_NAME}
            </Text>
          </View>
          <Text variant="bodyLarge" style={[styles.greeting, dynamicStyles.greeting]}>
            Welcome back, {shopperFirstName}!
          </Text>
        </View>

        {/* ============================================================
            STATUS SECTION
            Availability dropdown
            ============================================================ */}
        {/**
         * WHY STATUS SO PROMINENT?
         *
         * Status is CRITICAL for shoppers:
         * - Available = will receive task assignments
         * - Unavailable = won't receive tasks (break, end of shift)
         *
         * Making it prominent ensures:
         * - Shopper always knows their status
         * - Easy to toggle for breaks
         * - Less chance of accidentally being unavailable
         */}
        <ShopperStatusDropdown
          status={shopperStatus}
          onStatusChange={handleStatusChange}
          loading={statusLoading}
        />

        {/* ============================================================
            CURRENT TASK SECTION
            Shows assigned task or "no tasks" state
            ============================================================ */}
        {/**
         * WHY CURRENT TASK BEFORE QUICK LINKS?
         *
         * Information hierarchy:
         * 1. Status (can I receive tasks?)
         * 2. Current task (what should I do NOW?)
         * 3. Quick links (what else is happening?)
         *
         * The current task is the PRIMARY action item.
         * Quick links are secondary navigation.
         */}
        <CurrentTaskCard
          task={currentTask}
          onPress={handleTaskPress}
        />

        {/* ============================================================
            QUICK LINKS SECTION
            Navigation to task lists
            ============================================================ */}
        {/**
         * WHY THESE THREE LINKS?
         *
         * They represent the three main workflows for shoppers:
         *
         * 1. PICK TASKS - Selecting/claiming orders to shop
         *    "What orders need shoppers?"
         *
         * 2. DROP OFFS - Deliveries to complete
         *    "What orders need to be delivered?"
         *
         * 3. CUSTOMER CHECK-INS - Pickups waiting
         *    "Who's here to pick up their order?"
         *
         * These map directly to the shopper's daily activities.
         */}
        <View style={styles.quickLinksSection}>
          <Text
            variant="labelMedium"
            style={[styles.sectionTitle, dynamicStyles.sectionTitle]}
          >
            QUICK LINKS
          </Text>

          <QuickLinkCard
            title="Pick Tasks"
            count={availableTasksCount}
            icon="clipboard-list"
            onPress={handlePickTasksPress}
            subtitle={tasksCountLoading ? 'Loading...' : 'Available orders to shop'}
          />

          <QuickLinkCard
            title="Drop Offs"
            count={MOCK_DROP_OFFS_COUNT}
            icon="truck-delivery"
            onPress={handleDropOffsPress}
            subtitle="Orders ready for delivery"
          />

          <QuickLinkCard
            title="Customer Check-ins"
            count={MOCK_CHECK_INS_COUNT}
            icon="account-check"
            onPress={handleCheckInsPress}
            subtitle="Customers waiting for pickup"
          />
        </View>

        {/* Bottom padding for scroll */}
        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
};

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  /**
   * HEADER
   * Custom header with title and settings
   *
   * WHY THESE SPECIFIC VALUES?
   * - paddingTop: 16 = space from status bar (SafeAreaView handles this in production)
   * - paddingHorizontal: 20 = matches content padding
   * - paddingBottom: 16 = breathing room before content
   */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    // Shadow for subtle separation
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },

  headerTitle: {
    fontWeight: '700',
  },

  settingsButton: {
    padding: 8,
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    padding: 20,
  },

  /**
   * STORE SECTION
   * Store name and greeting
   */
  storeSection: {
    marginBottom: 24,
  },

  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },

  storeName: {
    fontWeight: '600',
  },

  greeting: {
    marginTop: 4,
  },

  /**
   * QUICK LINKS SECTION
   */
  quickLinksSection: {
    marginTop: 8,
  },

  sectionTitle: {
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 12,
  },

  bottomPadding: {
    height: 32,
  },
});

export default ShopperDashboardScreen;
