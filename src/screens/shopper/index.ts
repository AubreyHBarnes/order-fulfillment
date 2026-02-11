/**
 * Shopper Screens Index
 * File: src/screens/shopper/index.ts
 *
 * PURPOSE:
 * Central export point for all shopper-related screens.
 * Makes imports cleaner in AppNavigator and other files.
 *
 * PATTERN:
 * Instead of: import ShopperDashboardScreen from '../screens/shopper/ShopperDashboardScreen';
 * We can use: import { ShopperDashboardScreen } from '../screens/shopper';
 */

export { default as ShopperDashboardScreen } from './ShopperDashboardScreen';
export { default as AvailableTasksScreen } from './AvailableTasksScreen';
export { default as DropOffsScreen } from './DropOffsScreen';
export { default as CustomerCheckInsScreen } from './CustomerCheckInsScreen';
export { default as TaskDetailScreen } from './TaskDetailScreen';
export { default as ShopperSettingsScreen } from './ShopperSettingsScreen';
