/**
 * Arrival Notification Modal Component
 * File: src/components/shopper/ArrivalNotificationModal.tsx
 *
 * PURPOSE:
 * Shown to the one shopper an order's hand-off is currently addressed
 * to (Order.shopperID) when the customer taps "I've Arrived" - or when
 * it gets reassigned to a different shopper after the previous one
 * didn't respond in time. See docs/DECISIONS.md's arrival hand-off
 * entry for why this is a targeted modal rather than the store-wide
 * toast this feature first shipped with, and for the timeout/
 * reassignment mechanism onDecline (and an unanswered timeout) feeds
 * into server-side.
 *
 * Same Modal + Pressable backdrop pattern as NewAssignmentModal - see
 * that file for the fuller rationale on Modal over an absolutely-
 * positioned View, and why the card gets its own no-op-Pressable
 * wrapper so a tap on it doesn't fall through to the backdrop.
 */

import React from 'react';
import { View, StyleSheet, Modal, Pressable } from 'react-native';
import { Text, Icon, Button } from 'react-native-paper';
import { useAppTheme } from '../../theme';
import type { ArrivalNotificationModalProps } from '../../types';

const ArrivalNotificationModal: React.FC<ArrivalNotificationModalProps> = ({
  visible,
  arrival,
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
        <Pressable onPress={() => {}} style={[styles.card, dynamicStyles.card]}>
          <View style={styles.iconRow}>
            <Icon source="account-check" size={40} color={theme.colors.primary} />
          </View>

          <Text variant="titleLarge" style={[styles.title, dynamicStyles.title]}>
            Customer Has Arrived
          </Text>

          {arrival && (
            <View style={styles.detailsBlock}>
              <Text variant="titleMedium" style={[styles.orderId, dynamicStyles.orderId]}>
                #{arrival.shortOrderId}
              </Text>
              <Text variant="bodyMedium" style={[styles.detailText, dynamicStyles.detailText]}>
                {arrival.customerName}
              </Text>
              {arrival.vehicleDescription && (
                <Text variant="bodyMedium" style={[styles.detailText, dynamicStyles.detailText]}>
                  {arrival.vehicleDescription}
                </Text>
              )}
              {arrival.notes && (
                <Text variant="bodyMedium" style={[styles.detailText, dynamicStyles.detailText]}>
                  {arrival.notes}
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
              Unavailable
            </Button>
            <Button
              mode="contained"
              onPress={onAccept}
              disabled={declineLoading}
              style={styles.button}
            >
              Hand Off Order
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

export default ArrivalNotificationModal;
