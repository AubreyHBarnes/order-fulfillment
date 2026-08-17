/**
 * New Assignment Modal Component
 * File: src/components/shopper/NewAssignmentModal.tsx
 *
 * PURPOSE:
 * Shown when a shopper toggles to Available and an order auto-assigns.
 * Lets them accept it or step back to Unavailable, instead of silently
 * being handed a task with no confirmation step - matches the
 * accept/decline pattern from gig-fulfillment apps like Whole
 * Foods/Amazon Flex.
 *
 * Follows the same Modal + Pressable backdrop pattern as
 * ShopperStatusDropdown (see that file for the fuller rationale on
 * choosing Modal over an absolutely-positioned View). One correction
 * carried over from there: the card itself is wrapped in its own
 * Pressable with an empty onPress, so taps on the card don't fall
 * through to the backdrop's dismiss handler - ShopperStatusDropdown's
 * comment claims this but its code doesn't actually do it.
 */

import React from 'react';
import { View, StyleSheet, Modal, Pressable } from 'react-native';
import { Text, Icon, Button } from 'react-native-paper';
import { useAppTheme } from '../../theme';
import type { NewAssignmentModalProps } from '../../types';

const NewAssignmentModal: React.FC<NewAssignmentModalProps> = ({
  visible,
  task,
  onAccept,
  onDecline,
  declineLoading = false,
}) => {
  const theme = useAppTheme();

  const dynamicStyles = {
    modalOverlay: {
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    card: {
      backgroundColor: theme.colors.surface,
    },
    title: {
      color: theme.colors.onSurface,
    },
    orderId: {
      color: theme.colors.primary,
    },
    detailText: {
      color: theme.custom.textSecondary,
    },
  };

  return (
    <Modal visible={visible} transparent={true} animationType="fade">
      <Pressable style={[styles.modalOverlay, dynamicStyles.modalOverlay]}>
        {/* Wrapped in its own Pressable (with no-op onPress) so taps on
            the card don't bubble up and dismiss via the backdrop - this
            modal has no swipe-to-dismiss, the shopper must pick a button. */}
        <Pressable onPress={() => {}} style={[styles.card, dynamicStyles.card]}>
          <View style={styles.iconRow}>
            <Icon source="cart-check" size={40} color={theme.colors.primary} />
          </View>

          <Text variant="titleLarge" style={[styles.title, dynamicStyles.title]}>
            New Order Assigned
          </Text>

          {task && (
            <View style={styles.detailsBlock}>
              <Text variant="titleMedium" style={[styles.orderId, dynamicStyles.orderId]}>
                #{task.shortOrderId}
              </Text>
              <Text variant="bodyMedium" style={[styles.detailText, dynamicStyles.detailText]}>
                {task.customerName} &middot; {task.uniqueItemCount} unique item
                {task.uniqueItemCount === 1 ? '' : 's'}
              </Text>
              {task.dueTime && (
                <Text variant="bodyMedium" style={[styles.detailText, dynamicStyles.detailText]}>
                  Due by {task.dueTime}
                </Text>
              )}
            </View>
          )}

          <View style={styles.buttonRow}>
            <Button
              mode="outlined"
              onPress={onDecline}
              loading={declineLoading}
              disabled={declineLoading}
              style={styles.button}
            >
              Go Unavailable
            </Button>
            <Button
              mode="contained"
              onPress={onAccept}
              disabled={declineLoading}
              style={styles.button}
            >
              Accept
            </Button>
          </View>
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
    padding: 32,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 16,
    padding: 24,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  iconRow: {
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  detailsBlock: {
    alignItems: 'center',
    marginBottom: 24,
    gap: 4,
  },
  detailText: {
    textAlign: 'center',
  },
  orderId: {
    fontWeight: '700',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
  },
});

export default NewAssignmentModal;
