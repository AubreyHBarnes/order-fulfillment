/**
 * Urgent Order Toast Component
 * File: src/components/shopper/UrgentOrderToast.tsx
 *
 * PURPOSE:
 * A non-intrusive notice for when a new pending order arrives with a
 * due time sooner than the shopper's current task - the "I'm on a 2pm
 * order and an 11am order just came in with nobody working it" gap.
 * Driven by ShopperAssignmentContext's polling - see that file for why
 * this is polling-based rather than push.
 *
 * WHY Snackbar INSTEAD OF A MODAL?
 * - Explicitly asked for "non intrusive" - unlike OrderInterruptedModal
 *   (something already happened to the shopper's own order, needs
 *   acknowledgment) this is just visibility into the queue. The shopper
 *   should be able to keep working and check Pick Tasks whenever they
 *   want, not be blocked.
 * - react-native-paper's Snackbar, like Dialog/Portal, is an unused
 *   part of an already-installed dependency - no new library needed.
 */

import React from 'react';
import { Snackbar, Text } from 'react-native-paper';
import { useAppTheme } from '../../theme';
import type { UrgentOrderToastProps } from '../../types';

const TOAST_DURATION_MS = 6000;

const UrgentOrderToast: React.FC<UrgentOrderToastProps> = ({ visible, dueTime, onDismiss }) => {
  const theme = useAppTheme();

  return (
    <Snackbar
      visible={visible}
      onDismiss={onDismiss}
      duration={TOAST_DURATION_MS}
      action={{ label: 'Dismiss', onPress: onDismiss }}
      style={{ backgroundColor: theme.colors.inverseSurface }}
    >
      <Text style={{ color: theme.colors.inverseOnSurface }}>
        {dueTime
          ? `A new order just came in, due at ${dueTime} - sooner than your current task.`
          : 'A new order just came in, sooner than your current task.'}
      </Text>
    </Snackbar>
  );
};

export default UrgentOrderToast;
