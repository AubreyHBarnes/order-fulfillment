/**
 * Current Task Card Component
 * File: src/components/shopper/CurrentTaskCard.tsx
 *
 * PURPOSE:
 * Displays the shopper's currently assigned task on the dashboard.
 * This is the primary focus area for shoppers - what they need to do NOW.
 *
 * ============================================================
 * TWO STATES
 * ============================================================
 *
 * This component handles two distinct states:
 *
 * STATE 1: No Task Assigned (task = null)
 * ┌─────────────────────────────────────┐
 * │  CURRENT TASK                       │
 * │  ┌─────────────────────────────┐   │
 * │  │  📋                          │   │
 * │  │  No tasks assigned           │   │
 * │  │  Check available tasks or    │   │
 * │  │  wait for assignment         │   │
 * │  └─────────────────────────────┘   │
 * └─────────────────────────────────────┘
 *
 * STATE 2: Task Assigned
 * ┌─────────────────────────────────────┐
 * │  CURRENT TASK                       │
 * │  Due by 2:30 PM                     │
 * │  ┌─────────────────────────────┐   │
 * │  │  #ABC12345                   │   │
 * │  │  12 items (8 unique)         │   │
 * │  │  John Smith                  │   │
 * │  │  🚚 Delivery                 │   │
 * │  └─────────────────────────────┘   │
 * └─────────────────────────────────────┘
 *
 * WHY HANDLE BOTH IN ONE COMPONENT?
 * - Same screen location (Current Task section)
 * - Same semantic meaning (what's my current task?)
 * - Simpler parent component (just pass task or null)
 * - Smooth transitions between states
 *
 * ============================================================
 * INFORMATION HIERARCHY
 * ============================================================
 *
 * When a task IS assigned, information is shown in this order:
 *
 * 1. DUE TIME (most urgent - displayed prominently)
 *    - "Due by 2:30 PM" - shopper needs to know deadline first
 *
 * 2. ORDER ID (identifier)
 *    - "#ABC12345" - reference for communication
 *
 * 3. ITEMS COUNT (scope of work)
 *    - "12 items (8 unique)" - how much shopping to do
 *
 * 4. CUSTOMER NAME (who it's for)
 *    - "John Smith" - personalization, helps with handoff
 *
 * 5. FULFILLMENT TYPE (where it goes)
 *    - "Delivery" or "Pickup" - determines end action
 *
 * This hierarchy follows the "most actionable first" principle:
 * - Due time tells them WHEN (urgency)
 * - Items tell them WHAT (shopping list)
 * - Customer tells them WHO (personalization)
 * - Fulfillment tells them HOW (end delivery)
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Card, Text, Icon } from 'react-native-paper';
import { useAppTheme } from '../../theme';
import type { CurrentTaskCardProps } from '../../types';

// ============================================================
// COMPONENT
// ============================================================

const CurrentTaskCard: React.FC<CurrentTaskCardProps> = ({ task, onPress }) => {
  const theme = useAppTheme();

  // ============================================================
  // DYNAMIC STYLES
  // ============================================================

  const dynamicStyles = {
    sectionTitle: {
      color: theme.custom.textSecondary,
    },
    dueTime: {
      color: theme.colors.error,
    },
    emptyContainer: {
      backgroundColor: theme.colors.surfaceVariant,
    },
    emptyText: {
      color: theme.custom.textSecondary,
    },
    emptySubtext: {
      color: theme.custom.textDisabled,
    },
    taskCard: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.primary,
    },
    orderId: {
      color: theme.colors.primary,
    },
    itemsText: {
      color: theme.colors.onSurface,
    },
    customerName: {
      color: theme.custom.textSecondary,
    },
    fulfillmentBadge: {
      backgroundColor: theme.colors.primaryContainer,
    },
    fulfillmentText: {
      color: theme.colors.onPrimaryContainer,
    },
  };

  // ============================================================
  // RENDER: NO TASK STATE
  // ============================================================

  if (!task) {
    return (
      <View style={styles.container}>
        {/* Section Title */}
        <Text
          variant="labelMedium"
          style={[styles.sectionTitle, dynamicStyles.sectionTitle]}
        >
          CURRENT TASK
        </Text>

        {/* Empty State Card */}
        <View style={[styles.emptyContainer, dynamicStyles.emptyContainer]}>
          {/**
           * WHY AN ICON?
           * - Visual interest in otherwise empty space
           * - Immediately communicates "nothing here"
           * - Friendlier than just text
           *
           * WHY clipboard-text-outline?
           * - Suggests "tasks" or "list"
           * - Neutral (not error, not success)
           * - Consistent with task/order iconography
           */}
          <Icon
            source="clipboard-text-outline"
            size={48}
            color={theme.custom.textDisabled}
          />
          <Text
            variant="titleMedium"
            style={[styles.emptyText, dynamicStyles.emptyText]}
          >
            No tasks assigned
          </Text>
          <Text
            variant="bodySmall"
            style={[styles.emptySubtext, dynamicStyles.emptySubtext]}
          >
            Check available tasks or wait for assignment
          </Text>
        </View>
      </View>
    );
  }

  // ============================================================
  // RENDER: TASK ASSIGNED STATE
  // ============================================================

  /**
   * CONTENT WRAPPING STRATEGY
   *
   * If onPress is provided → wrap in TouchableOpacity (clickable)
   * If onPress is undefined → just render the card (not clickable)
   *
   * WHY CONDITIONAL WRAPPER?
   * - Sometimes we want tap to navigate to task detail
   * - Sometimes we just want to display (read-only)
   * - Keeps component flexible for different use cases
   */
  const CardContent = (
    <Card style={[styles.taskCard, dynamicStyles.taskCard]} elevation={2}>
      <Card.Content style={styles.taskCardContent}>
        {/* Order ID */}
        <Text
          variant="titleLarge"
          style={[styles.orderId, dynamicStyles.orderId]}
        >
          #{task.shortOrderId}
        </Text>

        {/* Items Count and Progress */}
        {/**
         * WHY SHOW PROGRESS?
         * - Shows shopper how much work is done vs remaining
         * - "3 of 12 items picked" is clearer than just "12 items"
         * - Visual progress bar provides at-a-glance status
         */}
        <View style={styles.itemsRow}>
          <Icon source="basket" size={20} color={theme.custom.textSecondary} />
          <Text variant="bodyLarge" style={[styles.itemsText, dynamicStyles.itemsText]}>
            {task.pickedItemCount} of {task.itemCount} items picked
          </Text>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressBarContainer}>
          <View
            style={[
              styles.progressBar,
              {
                backgroundColor: theme.colors.primary,
                width: `${task.itemCount > 0 ? (task.pickedItemCount / task.itemCount) * 100 : 0}%`,
              },
            ]}
          />
          <View
            style={[
              styles.progressBarBackground,
              { backgroundColor: theme.colors.surfaceVariant },
            ]}
          />
        </View>

        {/* Unique Items Count */}
        <Text variant="bodySmall" style={dynamicStyles.customerName}>
          {task.uniqueItemCount} unique products
        </Text>

        {/* Customer Name */}
        <View style={styles.customerRow}>
          <Icon source="account" size={20} color={theme.custom.textSecondary} />
          <Text
            variant="bodyMedium"
            style={[styles.customerName, dynamicStyles.customerName]}
          >
            {task.customerName}
          </Text>
        </View>

        {/* Shopper Name */}
        <View style={styles.customerRow}>
          <Icon source="account-hard-hat" size={20} color={theme.custom.textSecondary} />
          <Text
            variant="bodyMedium"
            style={[styles.customerName, dynamicStyles.customerName]}
          >
            {task.shopperName}
          </Text>
        </View>

        {/* Fulfillment Type Badge */}
        <View style={styles.fulfillmentRow}>
          <View style={[styles.fulfillmentBadge, dynamicStyles.fulfillmentBadge]}>
            <Icon
              source={task.fulfillmentType === 'delivery' ? 'truck-delivery' : 'store'}
              size={16}
              color={dynamicStyles.fulfillmentText.color}
            />
            <Text
              variant="labelMedium"
              style={[styles.fulfillmentText, dynamicStyles.fulfillmentText]}
            >
              {task.fulfillmentType === 'delivery' ? 'Delivery' : 'Pickup'}
            </Text>
          </View>
        </View>
      </Card.Content>
    </Card>
  );

  return (
    <View style={styles.container}>
      {/* Section Title */}
      <View style={styles.headerRow}>
        <Text
          variant="labelMedium"
          style={[styles.sectionTitle, dynamicStyles.sectionTitle]}
        >
          CURRENT TASK
        </Text>

        {/* Due Time - shown prominently if available */}
        {task.dueTime && (
          <Text variant="labelMedium" style={[styles.dueTime, dynamicStyles.dueTime]}>
            Due by {task.dueTime}
          </Text>
        )}
      </View>

      {/* Task Card - optionally wrapped for tap handling */}
      {onPress ? (
        <TouchableOpacity
          onPress={() => onPress(task)}
          activeOpacity={0.7}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={`Current task: Order ${task.shortOrderId}, ${task.itemCount} items for ${task.customerName}`}
          accessibilityHint="Double tap to view task details"
        >
          {CardContent}
        </TouchableOpacity>
      ) : (
        CardContent
      )}
    </View>
  );
};

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },

  /**
   * SECTION TITLE
   * "CURRENT TASK" label
   * WHY UPPERCASE + LETTER SPACING?
   * - Creates visual hierarchy
   * - Distinguishes labels from content
   * - Consistent with other section headers in app
   */
  sectionTitle: {
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 8,
  },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },

  /**
   * DUE TIME
   * Prominent urgency indicator
   * WHY ON THE RIGHT?
   * - "CURRENT TASK" on left (what)
   * - "Due by X" on right (when)
   * - Natural left-to-right reading flow
   */
  dueTime: {
    fontWeight: '600',
  },

  /**
   * EMPTY STATE CONTAINER
   * Shown when no task assigned
   */
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    borderRadius: 12,
    gap: 8,
  },

  emptyText: {
    fontWeight: '500',
    marginTop: 8,
  },

  emptySubtext: {
    textAlign: 'center',
  },

  /**
   * TASK CARD
   * The main card when task is assigned
   * WHY BORDER?
   * - Emphasizes this is the PRIMARY action item
   * - Draws eye to most important content
   * - Different from other cards (higher prominence)
   */
  taskCard: {
    borderWidth: 2,
    borderRadius: 12,
  },

  taskCardContent: {
    gap: 12,
  },

  orderId: {
    fontWeight: '700',
  },

  itemsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  itemsText: {
    fontWeight: '500',
  },

  /**
   * PROGRESS BAR
   * Visual indicator of picking progress
   */
  progressBarContainer: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
  },

  progressBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    borderRadius: 4,
    zIndex: 1,
  },

  progressBarBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '100%',
    borderRadius: 4,
    zIndex: 0,
  },

  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  customerName: {
    fontWeight: '500',
  },

  fulfillmentRow: {
    flexDirection: 'row',
    marginTop: 4,
  },

  /**
   * FULFILLMENT BADGE
   * Delivery/Pickup indicator
   * WHY A BADGE vs JUST TEXT?
   * - Visual distinction
   * - Quick to scan
   * - Icon reinforces meaning
   */
  fulfillmentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },

  fulfillmentText: {
    fontWeight: '600',
  },
});

export default CurrentTaskCard;
