/**
 * Shown over ShoppingScreen when its order stops being this shopper's
 * (reassigned, swapped, or cancelled) so the stale checklist isn't left
 * up with buttons the server will reject. The interrupt case doesn't use
 * this - OrderInterruptedModal already explains that one.
 */
import React from 'react';
import { View, StyleSheet, Modal, Pressable } from 'react-native';
import { Text, Icon, Button } from 'react-native-paper';
import { useAppTheme } from '../../theme';

interface OrderNoLongerAssignedModalProps {
  visible: boolean;
  onDismiss: () => void;
}

const OrderNoLongerAssignedModal: React.FC<OrderNoLongerAssignedModalProps> = ({ visible, onDismiss }) => {
  const theme = useAppTheme();

  return (
    <Modal visible={visible} transparent={true} animationType="fade">
      <Pressable style={styles.overlay}>
        <Pressable onPress={() => {}} style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.iconRow}>
            <Icon source="alert-circle-outline" size={40} color={theme.colors.primary} />
          </View>
          <Text variant="titleLarge" style={[styles.title, { color: theme.colors.onSurface }]}>
            No Longer Assigned to You
          </Text>
          <Text variant="bodyMedium" style={[styles.body, { color: theme.custom.textSecondary }]}>
            This order is no longer assigned to you, or it was cancelled.
          </Text>
          <Button mode="contained" onPress={onDismiss} style={styles.button}>
            Back to Home
          </Button>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  card: { width: '100%', maxWidth: 340, borderRadius: 16, padding: 24, elevation: 8 },
  iconRow: { alignItems: 'center', marginBottom: 12 },
  title: { fontWeight: '700', textAlign: 'center', marginBottom: 16 },
  body: { textAlign: 'center', marginBottom: 24 },
  button: { width: '100%' },
});

export default OrderNoLongerAssignedModal;
