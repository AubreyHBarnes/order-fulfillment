/**
 * Order Timeline Component
 * File: src/components/customer/OrderTimeline.tsx
 *
 * Displays order status progression as a vertical timeline
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { useAppTheme } from '../../theme';
import type { OrderTimelineProps, OrderStatus } from '../../types';

interface TimelineStep {
  status: OrderStatus;
  label: string;
  timestamp?: string;
  detail?: string;
}

/**
 * Order of statuses for timeline display
 */
const STATUS_ORDER: OrderStatus[] = [
  'pending',
  'assigned',
  'shopping',
  'ready_for_pickup',
  'completed',
];

/**
 * Get the index of a status in the timeline
 */
const getStatusIndex = (status: OrderStatus): number => {
  if (status === 'cancelled') return -1;
  return STATUS_ORDER.indexOf(status);
};

/**
 * Format timestamp for display
 */
const formatTimestamp = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

/**
 * Get label for status
 */
const getStatusLabel = (status: OrderStatus): string => {
  switch (status) {
    case 'pending':
      return 'Order Placed';
    case 'assigned':
      return 'Shopper Assigned';
    case 'shopping':
      return 'Shopping';
    case 'ready_for_pickup':
      return 'Ready for Pickup';
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status;
  }
};

const OrderTimeline: React.FC<OrderTimelineProps> = ({ order }) => {
  const theme = useAppTheme();
  const currentStatusIndex = getStatusIndex(order.status);
  const isCancelled = order.status === 'cancelled';

  const dynamicStyles = {
    completedDot: {
      backgroundColor: theme.custom.success,
      borderColor: theme.custom.success,
    },
    currentDot: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    pendingDot: {
      backgroundColor: 'transparent',
      borderColor: theme.custom.textDisabled,
    },
    cancelledDot: {
      backgroundColor: theme.colors.error,
      borderColor: theme.colors.error,
    },
    completedLine: {
      backgroundColor: theme.custom.success,
    },
    pendingLine: {
      backgroundColor: theme.custom.textDisabled,
    },
    completedText: {
      color: theme.colors.onSurface,
    },
    pendingText: {
      color: theme.custom.textDisabled,
    },
    timestampText: {
      color: theme.custom.textSecondary,
    },
  };

  const renderStep = (status: OrderStatus, index: number) => {
    const isCompleted = index < currentStatusIndex;
    const isCurrent = index === currentStatusIndex;
    const isPending = index > currentStatusIndex;
    const isLast = index === STATUS_ORDER.length - 1;

    let dotStyle;
    let lineStyle;
    let textStyle;

    if (isCancelled && status === 'pending') {
      dotStyle = dynamicStyles.cancelledDot;
      textStyle = dynamicStyles.completedText;
    } else if (isCompleted) {
      dotStyle = dynamicStyles.completedDot;
      lineStyle = dynamicStyles.completedLine;
      textStyle = dynamicStyles.completedText;
    } else if (isCurrent) {
      dotStyle = dynamicStyles.currentDot;
      lineStyle = dynamicStyles.pendingLine;
      textStyle = dynamicStyles.completedText;
    } else {
      dotStyle = dynamicStyles.pendingDot;
      lineStyle = dynamicStyles.pendingLine;
      textStyle = dynamicStyles.pendingText;
    }

    // Show timestamp only for completed/current steps
    const showTimestamp = (isCompleted || isCurrent) && !isCancelled;

    return (
      <View key={status} style={styles.stepContainer}>
        <View style={styles.dotColumn}>
          <View style={[styles.dot, dotStyle]} />
          {!isLast && <View style={[styles.line, lineStyle]} />}
        </View>

        <View style={styles.contentColumn}>
          <Text variant="bodyLarge" style={[styles.label, textStyle]}>
            {getStatusLabel(status)}
          </Text>
          {showTimestamp && (
            <Text
              variant="bodySmall"
              style={[styles.timestamp, dynamicStyles.timestampText]}
            >
              {formatTimestamp(order.orderDate)}
            </Text>
          )}
          {!showTimestamp && isPending && (
            <Text
              variant="bodySmall"
              style={[styles.timestamp, dynamicStyles.pendingText]}
            >
              Pending
            </Text>
          )}
        </View>
      </View>
    );
  };

  // If cancelled, show a simplified timeline
  if (isCancelled) {
    return (
      <View style={styles.container}>
        <View style={styles.stepContainer}>
          <View style={styles.dotColumn}>
            <View style={[styles.dot, dynamicStyles.completedDot]} />
            <View style={[styles.line, dynamicStyles.pendingLine]} />
          </View>
          <View style={styles.contentColumn}>
            <Text
              variant="bodyLarge"
              style={[styles.label, dynamicStyles.completedText]}
            >
              Order Placed
            </Text>
            <Text
              variant="bodySmall"
              style={[styles.timestamp, dynamicStyles.timestampText]}
            >
              {formatTimestamp(order.orderDate)}
            </Text>
          </View>
        </View>

        <View style={styles.stepContainer}>
          <View style={styles.dotColumn}>
            <View style={[styles.dot, dynamicStyles.cancelledDot]} />
          </View>
          <View style={styles.contentColumn}>
            <Text
              variant="bodyLarge"
              style={[styles.label, { color: theme.colors.error }]}
            >
              Cancelled
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {STATUS_ORDER.map((status, index) => renderStep(status, index))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  stepContainer: {
    flexDirection: 'row',
    minHeight: 60,
  },
  dotColumn: {
    width: 32,
    alignItems: 'center',
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
  line: {
    flex: 1,
    width: 2,
    marginVertical: 4,
  },
  contentColumn: {
    flex: 1,
    paddingLeft: 12,
    paddingBottom: 16,
  },
  label: {
    fontWeight: '600',
  },
  timestamp: {
    marginTop: 2,
  },
});

export default OrderTimeline;
