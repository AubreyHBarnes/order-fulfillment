/**
 * Quick Link Card Component
 * File: src/components/shopper/QuickLinkCard.tsx
 *
 * PURPOSE:
 * A reusable navigation card for the shopper dashboard.
 * Used for the three quick links:
 * - Pick Tasks (available orders to shop)
 * - Drop Offs (orders ready for delivery)
 * - Customer Check-ins (customers waiting for pickup)
 *
 * ============================================================
 * DESIGN PATTERN: REUSABLE NAVIGATION CARDS
 * ============================================================
 *
 * WHY ONE COMPONENT FOR ALL THREE LINKS?
 *
 * Option A: Three separate components
 * - PickTasksCard, DropOffsCard, CheckInsCard
 * - Pros: Each can be customized independently
 * - Cons: Code duplication, inconsistent styling over time
 *
 * Option B: One configurable component (what we chose)
 * - QuickLinkCard with props for title, icon, count
 * - Pros: DRY, consistent design, easy to add new links
 * - Cons: Less flexibility for individual customization
 *
 * We chose Option B because:
 * 1. All links have same visual structure
 * 2. Consistency is more important than flexibility here
 * 3. Adding a new link is just adding props
 * 4. Changes to design happen in one place
 *
 * ============================================================
 * VISUAL STRUCTURE
 * ============================================================
 *
 * ┌─────────────────────────────────────┐
 * │  [Icon]  Title                (23) >│
 * │          Optional subtitle          │
 * └─────────────────────────────────────┘
 *
 * Layout explanation:
 * - Icon on left: Visual identification
 * - Title: What this link leads to
 * - Count badge on right: How many items (draws attention)
 * - Chevron: Indicates tappable/navigation
 * - Subtitle (optional): Additional context
 *
 * ============================================================
 * COUNT BADGE IMPORTANCE
 * ============================================================
 *
 * The count badge serves multiple purposes:
 *
 * 1. INFORMATION AT A GLANCE
 *    - Shopper sees "5 available tasks" without tapping
 *    - Reduces unnecessary navigation
 *
 * 2. URGENCY/PRIORITY SIGNAL
 *    - High count = lots of work waiting
 *    - Zero count = nothing to do here
 *
 * 3. MOTIVATION
 *    - Seeing "3 customer check-ins" prompts action
 *    - Gamification element (clear the queue!)
 *
 * 4. STATUS AWARENESS
 *    - Managers can glance to see workload
 *    - Real-time pulse of operations
 */

import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text, Icon } from 'react-native-paper';
import { useAppTheme } from '../../theme';
import type { QuickLinkCardProps } from '../../types';

// ============================================================
// COMPONENT
// ============================================================

const QuickLinkCard: React.FC<QuickLinkCardProps> = ({
  title,
  count,
  icon,
  onPress,
  subtitle,
}) => {
  const theme = useAppTheme();

  // ============================================================
  // DYNAMIC STYLES
  // ============================================================

  const dynamicStyles = {
    container: {
      backgroundColor: theme.colors.surface,
    },
    iconContainer: {
      backgroundColor: theme.colors.primaryContainer,
    },
    icon: {
      color: theme.colors.primary,
    },
    title: {
      color: theme.colors.onSurface,
    },
    subtitle: {
      color: theme.custom.textSecondary,
    },
    countBadge: {
      backgroundColor: count > 0 ? theme.colors.primary : theme.custom.textDisabled,
    },
    countText: {
      color: count > 0 ? theme.colors.onPrimary : theme.colors.surface,
    },
    chevron: {
      color: theme.custom.textSecondary,
    },
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.container, dynamicStyles.container]}
      /**
       * ACCESSIBILITY
       *
       * WHY DETAILED accessibilityLabel?
       * - Screen reader users can't see the count badge
       * - Need to announce: "Pick Tasks, 5 items"
       * - Provides complete information without visual
       */
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${count} ${count === 1 ? 'item' : 'items'}`}
      accessibilityHint={`Double tap to view ${title.toLowerCase()}`}
    >
      {/* Left: Icon */}
      {/**
       * WHY ICON IN COLORED CONTAINER?
       *
       * Option A: Icon only (no background)
       * - Clean, minimal
       * - But: Icon can get lost, less visual weight
       *
       * Option B: Icon in colored circle (what we chose)
       * - More prominent
       * - Creates visual rhythm (icon, text, badge pattern)
       * - Consistent with modern app design (iOS, Android)
       */}
      <View style={[styles.iconContainer, dynamicStyles.iconContainer]}>
        <Icon source={icon} size={24} color={dynamicStyles.icon.color} />
      </View>

      {/* Center: Title and Subtitle */}
      <View style={styles.textContainer}>
        <Text variant="titleMedium" style={[styles.title, dynamicStyles.title]}>
          {title}
        </Text>
        {subtitle && (
          <Text variant="bodySmall" style={[styles.subtitle, dynamicStyles.subtitle]}>
            {subtitle}
          </Text>
        )}
      </View>

      {/* Right: Count Badge */}
      {/**
       * WHY ALWAYS SHOW COUNT (even zero)?
       *
       * Option A: Hide badge when count is 0
       * - Cleaner when nothing
       * - But: User might wonder "is this broken?"
       *
       * Option B: Show 0 with muted styling (what we chose)
       * - Consistent layout (always has badge)
       * - Clear that count is known (not loading/broken)
       * - Muted color indicates "nothing here" vs "action needed"
       *
       * BADGE SIZE CONSIDERATIONS:
       * - minWidth: 28 ensures badge doesn't get too small
       * - Handles 1-2 digit counts well (most common)
       * - 3+ digits still fit, just slightly wider
       */}
      <View style={[styles.countBadge, dynamicStyles.countBadge]}>
        <Text variant="labelMedium" style={[styles.countText, dynamicStyles.countText]}>
          {count}
        </Text>
      </View>

      {/* Chevron: Navigation indicator */}
      {/**
       * WHY CHEVRON?
       *
       * Convention in mobile apps:
       * - Chevron (>) = "tap to navigate deeper"
       * - No chevron = "tap performs action here"
       *
       * This card navigates to a list, so chevron is appropriate.
       * Helps users build correct mental model of app structure.
       */}
      <Icon source="chevron-right" size={24} color={dynamicStyles.chevron.color} />
    </TouchableOpacity>
  );
};

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  /**
   * CONTAINER
   * The main touchable area
   *
   * WHY THESE SPECIFIC VALUES?
   * - padding: 16 = comfortable touch target, breathing room
   * - borderRadius: 12 = modern, consistent with other cards
   * - gap: 12 = consistent spacing between elements
   * - elevation/shadow = subtle depth, indicates tappable
   */
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginBottom: 12,
    // Shadow for iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    // Elevation for Android
    elevation: 2,
  },

  /**
   * ICON CONTAINER
   * Colored background circle for icon
   *
   * WHY 44x44?
   * - Minimum recommended touch target size (Apple HIG)
   * - But this isn't the touch target (whole card is)
   * - Just visual sizing that looks balanced
   */
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /**
   * TEXT CONTAINER
   * Title and optional subtitle
   *
   * WHY flex: 1?
   * - Takes remaining space between icon and badge
   * - Allows text to wrap if needed
   * - Badge and chevron stay on right
   */
  textContainer: {
    flex: 1,
  },

  title: {
    fontWeight: '600',
  },

  subtitle: {
    marginTop: 2,
  },

  /**
   * COUNT BADGE
   * Circular badge showing item count
   *
   * WHY THESE STYLES?
   * - minWidth: 28 = ensures circle even for "0"
   * - height: 28 = matches minWidth for circle
   * - borderRadius: 14 = half of height for circle
   * - paddingHorizontal: 8 = room for 2-3 digit numbers
   */
  countBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },

  countText: {
    fontWeight: '700',
    fontSize: 14,
  },
});

export default QuickLinkCard;
