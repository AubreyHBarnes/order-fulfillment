/**
 * Order Interrupted Modal Component
 * File: src/components/shopper/OrderInterruptedModal.tsx
 *
 * PURPOSE:
 * Tells a shopper their current order was taken from them and put back
 * in the queue to make room for a rush order. Driven by
 * ShopperAssignmentContext, which polls for this - see that file for
 * why polling instead of a live push subscription.
 *
 * Same Modal + Pressable-backdrop pattern as NewAssignmentModal /
 * ShopperStatusDropdown; the card is wrapped in its own no-op Pressable
 * so taps on it don't fall through to the backdrop.
 */

import React from 'react';
import { View, StyleSheet, Modal, Pressable } from 'react-native';
import { Text, Icon, Button } from 'react-native-paper';
import { useAppTheme, fontFamilies, radius, spacing, tabularNums } from '../../theme';
import type { OrderInterruptedModalProps } from '../../types';

/**
 * Count unique products in the compact items string
 * ("productId:quantity,productId:quantity,...").
 *
 * WHY A LOCAL COPY INSTEAD OF IMPORTING FROM ShopperDashboardScreen?
 * ShopperDashboardScreen has its own equivalent parser, but it's a
 * screen, not a shared module - a component reaching into a screen file
 * for a helper would be a backwards dependency. This is a small enough
 * parse that duplicating it here is simpler than extracting a new
 * shared utils module for one three-line function.
 */
const countUniqueItems = (items: string): number => {
  if (!items || items.trim() === '') {
    return 0;
  }
  return items.split(',').filter((item) => item.length > 0).length;
};

const OrderInterruptedModal: React.FC<OrderInterruptedModalProps> = ({
  visible,
  order,
  onDismiss,
}) => {
  const theme = useAppTheme();

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
      color: theme.custom.warning,
    },
    detailText: {
      ...tabularNums,
      color: theme.custom.textSecondary,
    },
  };

  return (
    <Modal visible={visible} transparent={true} animationType="fade">
      <Pressable style={[styles.modalOverlay, dynamicStyles.modalOverlay]}>
        <Pressable onPress={() => {}} style={[styles.card, dynamicStyles.card]}>
          <View style={styles.iconRow}>
            <Icon source="run-fast" size={40} color={theme.custom.warning} />
          </View>

          <Text variant="titleLarge" style={[styles.title, dynamicStyles.title]}>
            Order Reassigned
          </Text>

          {order && (
            <View style={styles.detailsBlock}>
              <Text variant="titleMedium" style={[styles.orderId, dynamicStyles.orderId]}>
                #{order.$id.slice(-8).toUpperCase()}
              </Text>
              <Text variant="bodyMedium" style={[styles.detailText, dynamicStyles.detailText]}>
                {countUniqueItems(order.items)} unique item
                {countUniqueItems(order.items) === 1 ? '' : 's'} &middot; sent back to the queue
              </Text>
              <Text variant="bodyMedium" style={[styles.detailText, dynamicStyles.detailText]}>
                Reassigned to make room for a rush order
              </Text>
            </View>
          )}

          <Button mode="contained" onPress={onDismiss} style={styles.button}>
            OK
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
  orderId: {
    fontFamily: fontFamilies.bodyBold,
  },
  button: {
    width: '100%',
  },
});

export default OrderInterruptedModal;
