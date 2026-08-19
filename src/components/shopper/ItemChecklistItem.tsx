/**
 * Item Checklist Item Component
 * File: src/components/shopper/ItemChecklistItem.tsx
 *
 * PURPOSE:
 * A single row in ShoppingScreen's item list. Shows the ordered item and
 * lets the shopper mark it found (full or partial quantity), out of
 * stock, or propose a substitute.
 *
 * WHY A SEPARATE COMPONENT INSTEAD OF INLINE IN ShoppingScreen?
 * Same reasoning as ProductCard/CartItemCard - a list row with several
 * interactive controls is easier to read and test as its own component
 * than inline in a FlatList renderItem.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text, IconButton, Button, Chip } from 'react-native-paper';
import { useAppTheme } from '../../theme';
import { formatPrice } from '../../services/productService';
import type { ItemChecklistItemProps } from '../../types';

const ItemChecklistItem: React.FC<ItemChecklistItemProps> = ({
  product,
  orderedQty,
  pickedQty,
  issue,
  onMarkFound,
  onQuantityChange,
  onMarkOutOfStock,
  onSubstitute,
}) => {
  const theme = useAppTheme();
  const productName = product?.name ?? 'Unknown Product';

  const dynamicStyles = {
    card: {
      backgroundColor: theme.colors.surface,
    },
    name: {
      color: theme.colors.onSurface,
    },
    detail: {
      color: theme.custom.textSecondary,
    },
    foundChip: {
      backgroundColor: theme.custom.successLight,
    },
    foundChipText: {
      color: theme.custom.success,
    },
    oosChip: {
      backgroundColor: theme.colors.errorContainer,
    },
    oosChipText: {
      color: theme.colors.error,
    },
    pendingChip: {
      backgroundColor: theme.custom.warningLight,
    },
    pendingChipText: {
      color: theme.custom.warning,
    },
  };

  /**
   * WHY DERIVE STATUS INSTEAD OF STORING IT?
   * - The row's visual state (found/partial/oos/substituted) is fully
   *   determined by pickedQty + issue - no separate status field needed
   */
  const renderStatusChip = (): React.ReactElement | null => {
    if (issue?.kind === 'oos') {
      return (
        <Chip style={[styles.chip, dynamicStyles.oosChip]} textStyle={dynamicStyles.oosChipText}>
          Out of Stock
        </Chip>
      );
    }
    if (issue?.kind === 'sub') {
      if (issue.status === 'pending') {
        return (
          <Chip
            style={[styles.chip, dynamicStyles.pendingChip]}
            textStyle={dynamicStyles.pendingChipText}
          >
            Awaiting customer approval
          </Chip>
        );
      }
      if (issue.status === 'approved') {
        return (
          <Chip
            style={[styles.chip, dynamicStyles.foundChip]}
            textStyle={dynamicStyles.foundChipText}
          >
            Substitute approved
          </Chip>
        );
      }
      return (
        <Chip style={[styles.chip, dynamicStyles.oosChip]} textStyle={dynamicStyles.oosChipText}>
          Substitute rejected
        </Chip>
      );
    }
    if (pickedQty >= orderedQty && orderedQty > 0) {
      return (
        <Chip style={[styles.chip, dynamicStyles.foundChip]} textStyle={dynamicStyles.foundChipText}>
          Found
        </Chip>
      );
    }
    if (pickedQty > 0) {
      return (
        <Chip
          style={[styles.chip, dynamicStyles.pendingChip]}
          textStyle={dynamicStyles.pendingChipText}
        >
          Partial ({pickedQty}/{orderedQty})
        </Chip>
      );
    }
    return null;
  };

  // Once a substitution is proposed (any status), the found/oos/substitute
  // controls step aside for the resolution chip above - re-proposing or
  // marking found while a substitute is pending/resolved would leave two
  // conflicting signals on the same item.
  const controlsDisabled = issue?.kind === 'sub' && issue.status !== 'rejected';

  return (
    <Card style={[styles.card, dynamicStyles.card]} elevation={1}>
      <Card.Content>
        <View style={styles.headerRow}>
          <View style={styles.infoBlock}>
            <Text variant="titleMedium" style={[styles.name, dynamicStyles.name]} numberOfLines={2}>
              {productName}
            </Text>
            <Text variant="bodySmall" style={dynamicStyles.detail}>
              Qty {orderedQty} {product ? `• ${formatPrice(product.price)} each` : ''}
            </Text>
          </View>
          {renderStatusChip()}
        </View>

        {!controlsDisabled && (
          <View style={styles.controlsRow}>
            <View style={styles.stepper}>
              <IconButton
                icon="minus"
                mode="outlined"
                size={18}
                onPress={() => onQuantityChange(Math.max(0, pickedQty - 1))}
                disabled={pickedQty <= 0}
              />
              <Text variant="bodyLarge" style={styles.stepperText}>
                {pickedQty}
              </Text>
              <IconButton
                icon="plus"
                mode="outlined"
                size={18}
                onPress={() => onQuantityChange(Math.min(orderedQty, pickedQty + 1))}
                disabled={pickedQty >= orderedQty}
              />
            </View>

            <Button mode="contained-tonal" compact onPress={onMarkFound} style={styles.actionButton}>
              Found
            </Button>
            <Button mode="outlined" compact onPress={onMarkOutOfStock} style={styles.actionButton}>
              Out of Stock
            </Button>
            <Button mode="outlined" compact onPress={onSubstitute} style={styles.actionButton}>
              Substitute
            </Button>
          </View>
        )}

        {issue?.kind === 'sub' && issue.status === 'rejected' && (
          <View style={styles.controlsRow}>
            <Button mode="contained-tonal" compact onPress={onSubstitute} style={styles.actionButton}>
              Propose Another
            </Button>
            <Button mode="outlined" compact onPress={onMarkOutOfStock} style={styles.actionButton}>
              Mark Out of Stock
            </Button>
          </View>
        )}
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  infoBlock: {
    flex: 1,
  },
  name: {
    fontWeight: '600',
  },
  chip: {
    alignSelf: 'flex-start',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepperText: {
    minWidth: 24,
    textAlign: 'center',
  },
  actionButton: {
    marginLeft: 0,
  },
});

export default ItemChecklistItem;
