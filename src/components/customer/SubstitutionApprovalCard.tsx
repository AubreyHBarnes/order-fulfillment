/**
 * Substitution Approval Card Component
 * File: src/components/customer/SubstitutionApprovalCard.tsx
 *
 * PURPOSE:
 * Appears on OrderDetailScreen when the shopper has proposed a
 * substitute for an out-of-stock item and it's awaiting the customer's
 * approve/reject decision. Parallels ArrivalNotificationCard's
 * self-contained-props pattern.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text, Button } from 'react-native-paper';
import { useAppTheme } from '../../theme';
import { formatPrice } from '../../services/productService';
import type { SubstitutionApprovalCardProps } from '../../types';

const SubstitutionApprovalCard: React.FC<SubstitutionApprovalCardProps> = ({
  originalProduct,
  substituteProduct,
  onApprove,
  onReject,
  loading = false,
}) => {
  const theme = useAppTheme();

  const dynamicStyles = {
    card: {
      backgroundColor: theme.colors.primaryContainer,
    },
    title: {
      color: theme.colors.onPrimaryContainer,
    },
    subtitle: {
      color: theme.colors.onSurfaceVariant,
    },
    itemLabel: {
      color: theme.custom.textSecondary,
    },
  };

  return (
    <Card style={[styles.card, dynamicStyles.card]}>
      <Card.Content>
        <Text variant="titleMedium" style={[styles.title, dynamicStyles.title]}>
          Substitution Proposed
        </Text>
        <Text variant="bodyMedium" style={[styles.subtitle, dynamicStyles.subtitle]}>
          Your shopper couldn't find an item and would like to substitute it.
        </Text>

        <View style={styles.itemRow}>
          <Text variant="bodySmall" style={dynamicStyles.itemLabel}>
            Ordered
          </Text>
          <Text variant="bodyLarge">{originalProduct?.name ?? 'Unknown item'}</Text>
        </View>

        <View style={styles.itemRow}>
          <Text variant="bodySmall" style={dynamicStyles.itemLabel}>
            Proposed substitute
          </Text>
          <Text variant="bodyLarge">
            {substituteProduct?.name ?? 'Unknown item'}
            {substituteProduct ? ` — ${formatPrice(substituteProduct.price)}` : ''}
          </Text>
        </View>

        <View style={styles.buttonRow}>
          <Button
            mode="outlined"
            onPress={onReject}
            loading={loading}
            disabled={loading}
            style={styles.button}
          >
            Reject
          </Button>
          <Button
            mode="contained"
            onPress={onApprove}
            loading={loading}
            disabled={loading}
            style={styles.button}
          >
            Approve
          </Button>
        </View>
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 8,
  },
  title: {
    fontWeight: '600',
    marginBottom: 4,
  },
  subtitle: {
    marginBottom: 16,
  },
  itemRow: {
    marginBottom: 10,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  button: {
    flex: 1,
  },
});

export default SubstitutionApprovalCard;
