/**
 * Completion Summary Component
 * File: src/components/shopper/CompletionSummary.tsx
 *
 * PURPOSE:
 * Shows a quick recap of how the order went - found / substituted /
 * out-of-stock counts - before the shopper confirms completion on
 * OrderCompletionScreen.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text } from 'react-native-paper';
import { useAppTheme } from '../../theme';
import type { CompletionSummaryProps } from '../../types';

const CompletionSummary: React.FC<CompletionSummaryProps> = ({
  foundCount,
  outOfStockCount,
  substitutedCount,
  totalCount,
}) => {
  const theme = useAppTheme();

  const dynamicStyles = {
    card: {
      backgroundColor: theme.colors.surface,
    },
    label: {
      color: theme.custom.textSecondary,
    },
    foundValue: {
      color: theme.custom.success,
    },
    subValue: {
      color: theme.custom.warning,
    },
    oosValue: {
      color: theme.colors.error,
    },
  };

  const rows: { label: string; value: number; valueStyle: object }[] = [
    { label: 'Items Found', value: foundCount, valueStyle: dynamicStyles.foundValue },
    { label: 'Substituted', value: substitutedCount, valueStyle: dynamicStyles.subValue },
    { label: 'Out of Stock', value: outOfStockCount, valueStyle: dynamicStyles.oosValue },
  ];

  return (
    <Card style={[styles.card, dynamicStyles.card]} elevation={1}>
      <Card.Content>
        <Text variant="titleSmall" style={[styles.sectionTitle, dynamicStyles.label]}>
          ORDER SUMMARY
        </Text>
        {rows.map((row) => (
          <View key={row.label} style={styles.row}>
            <Text variant="bodyLarge" style={dynamicStyles.label}>
              {row.label}
            </Text>
            <Text variant="titleMedium" style={[styles.value, row.valueStyle]}>
              {row.value}
            </Text>
          </View>
        ))}
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text variant="titleMedium" style={styles.totalLabel}>
            Total Items
          </Text>
          <Text variant="titleMedium" style={styles.totalValue}>
            {totalCount}
          </Text>
        </View>
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  value: {
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(128,128,128,0.2)',
    marginVertical: 8,
  },
  totalLabel: {
    fontWeight: '700',
  },
  totalValue: {
    fontWeight: '700',
  },
});

export default CompletionSummary;
