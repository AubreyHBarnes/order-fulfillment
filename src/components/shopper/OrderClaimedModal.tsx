/**
 * Order Claimed Modal Component
 * File: src/components/shopper/OrderClaimedModal.tsx
 *
 * PURPOSE:
 * Confirms a shopper's own manual claim or swap from TaskDetailScreen
 * actually landed - which order is now their current one, and (for a
 * swap) which order was released back to the queue.
 *
 * WHY NOT REUSE NewAssignmentModal?
 * NewAssignmentModal asks "start this order or step back?" about an
 * order the system handed them. A manual claim/swap is a choice the
 * shopper already made, so offering "Unavailable" there would let one
 * tap undo the claim they just confirmed. This is an acknowledgement,
 * not a decision - one button, no decline path. ShopperAssignmentContext
 * skips NewAssignmentModal for these orders (autoAssigned: false) so
 * the two never stack.
 *
 * Same Modal + Pressable-backdrop pattern as NewAssignmentModal; the
 * card is wrapped in its own no-op Pressable so taps on it don't fall
 * through to the backdrop.
 */

import React from 'react';
import { View, StyleSheet, Modal, Pressable } from 'react-native';
import { Text, Icon, Button } from 'react-native-paper';
import { useAppTheme, fontFamilies, radius, spacing, tabularNums } from '../../theme';
import type { OrderClaimedModalProps } from '../../types';

const OrderClaimedModal: React.FC<OrderClaimedModalProps> = ({
  visible,
  shortOrderId,
  releasedShortOrderId,
  onContinue,
}) => {
  const theme = useAppTheme();
  const isSwap = !!releasedShortOrderId;

  const dynamicStyles = {
    modalOverlay: {
      backgroundColor: theme.custom.scrim,
    },
    card: {
      backgroundColor: theme.colors.elevation.level3,
    },
    title: {
      color: theme.colors.onSurface,
    },
    orderId: {
      color: theme.colors.primary,
    },
    detailText: {
      ...tabularNums,
      color: theme.custom.textSecondary,
    },
  };

  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onContinue}>
      <Pressable style={[styles.modalOverlay, dynamicStyles.modalOverlay]}>
        <Pressable onPress={() => {}} style={[styles.card, dynamicStyles.card]}>
          <View style={styles.iconRow}>
            <Icon
              source={isSwap ? 'swap-horizontal-circle' : 'cart-check'}
              size={40}
              color={theme.colors.primary}
            />
          </View>

          <Text variant="titleLarge" style={[styles.title, dynamicStyles.title]}>
            {isSwap ? 'Order Swapped' : 'Order Claimed'}
          </Text>

          <View style={styles.detailsBlock}>
            <Text variant="titleMedium" style={[styles.orderId, dynamicStyles.orderId]}>
              #{shortOrderId}
            </Text>
            <Text variant="bodyMedium" style={[styles.detailText, dynamicStyles.detailText]}>
              is now your current order.
            </Text>
            {isSwap && (
              <Text
                variant="bodyMedium"
                style={[styles.detailText, styles.releasedText, dynamicStyles.detailText]}
              >
                Order #{releasedShortOrderId} was released back to the queue - any progress on it
                is kept for whoever picks it up next.
              </Text>
            )}
          </View>

          <Button mode="contained" onPress={onContinue}>
            Start Shopping
          </Button>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxxl,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: radius.lg,
    padding: spacing.xxl,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  iconRow: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: fontFamilies.heading,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  detailsBlock: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
    gap: spacing.xs,
  },
  detailText: {
    ...tabularNums,
    textAlign: 'center',
  },
  releasedText: {
    marginTop: spacing.sm,
  },
  orderId: {
    fontFamily: fontFamilies.bodyBold,
  },
});

export default OrderClaimedModal;
