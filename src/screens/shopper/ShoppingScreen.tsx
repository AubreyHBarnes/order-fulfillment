/**
 * Shopping Screen
 * File: src/screens/shopper/ShoppingScreen.tsx
 *
 * PURPOSE:
 * The core in-store shopping loop. Shows every item on the order as a
 * checklist row (ItemChecklistItem) - the shopper marks each one found,
 * out of stock, or proposes a substitute. Every change writes to
 * Appwrite immediately (optimistic local update, revert on failure).
 *
 * SUBSTITUTION FLOW:
 * Proposing a substitute writes a 'pending' entry to the order's
 * itemIssues field. There's no realtime push in this app (see
 * docs/DECISIONS.md, "Pull-based data, not realtime") - so while any
 * substitution is pending, this screen polls the order every 8 seconds
 * (same interval as ShopperAssignmentContext) until the customer
 * approves or rejects it via OrderDetailScreen's matching poll.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator, Alert } from 'react-native';
import { Text, Button } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppTheme } from '../../theme';
import { getOrderById, updatePickedItems, updateItemIssues } from '../../services/orderService';
import { getProductById } from '../../services/productService';
import {
  parseItemsString,
  parsePickedItemsString,
  formatPickedItemsString,
  parseItemIssues,
  formatItemIssues,
  type ItemIssue,
} from '../../utils/orderItems';
import ItemChecklistItem from '../../components/shopper/ItemChecklistItem';
import SubstitutionPickerModal from '../../components/shopper/SubstitutionPickerModal';
import type { ShopperStackParamList, Product } from '../../types';

const POLL_INTERVAL_MS = 8000;

type ShoppingScreenProps = NativeStackScreenProps<ShopperStackParamList, 'Shopping'>;

const ShoppingScreen: React.FC<ShoppingScreenProps> = ({ route, navigation }) => {
  const theme = useAppTheme();
  const { orderId } = route.params;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [orderedItems, setOrderedItems] = useState<{ productId: string; quantity: number }[]>([]);
  const [products, setProducts] = useState<Record<string, Product | null>>({});
  const [substituteProducts, setSubstituteProducts] = useState<Record<string, Product>>({});
  const [pickedItems, setPickedItems] = useState<Record<string, number>>({});
  const [issues, setIssues] = useState<ItemIssue[]>([]);

  const [substitutionTarget, setSubstitutionTarget] = useState<string | null>(null);

  const dynamicStyles = {
    container: {
      backgroundColor: theme.colors.background,
    },
    footer: {
      backgroundColor: theme.colors.surface,
      borderTopColor: theme.custom.border,
    },
    errorText: {
      color: theme.colors.error,
    },
    detailText: {
      color: theme.custom.textSecondary,
    },
  };

  // ============================================================
  // LOAD ORDER + PRODUCTS
  // ============================================================

  useEffect(() => {
    const load = async (): Promise<void> => {
      setLoading(true);
      setError(null);

      const orderResult = await getOrderById(orderId);
      if (!orderResult.success || !orderResult.data) {
        setError(orderResult.error ?? 'Order not found');
        setLoading(false);
        return;
      }

      const order = orderResult.data;
      const items = parseItemsString(order.items);
      const picked = parsePickedItemsString(order.pickedItems);
      const parsedIssues = parseItemIssues(order.itemIssues ?? '');

      setOrderedItems(items);
      setPickedItems(picked);
      setIssues(parsedIssues);

      const productIds = new Set<string>(items.map((i) => i.productId));
      const subProductIds = parsedIssues
        .filter((i): i is Extract<ItemIssue, { kind: 'sub' }> => i.kind === 'sub')
        .map((i) => i.subProductId);
      subProductIds.forEach((id) => productIds.add(id));

      const productEntries = await Promise.all(
        Array.from(productIds).map(async (id) => {
          const result = await getProductById(id);
          return [id, result.success ? result.data : null] as const;
        })
      );

      const productMap: Record<string, Product | null> = {};
      const subMap: Record<string, Product> = {};
      for (const [id, product] of productEntries) {
        productMap[id] = product;
      }
      for (const issue of parsedIssues) {
        if (issue.kind === 'sub' && productMap[issue.subProductId]) {
          subMap[issue.productId] = productMap[issue.subProductId] as Product;
        }
      }

      setProducts(productMap);
      setSubstituteProducts(subMap);
      setLoading(false);
    };

    load();
  }, [orderId]);

  // ============================================================
  // POLL WHILE A SUBSTITUTION IS PENDING CUSTOMER APPROVAL
  // ============================================================

  useEffect(() => {
    const hasPending = issues.some((issue) => issue.kind === 'sub' && issue.status === 'pending');
    if (!hasPending) return;

    const poll = async (): Promise<void> => {
      const result = await getOrderById(orderId);
      if (result.success && result.data) {
        setIssues(parseItemIssues(result.data.itemIssues ?? ''));
      }
    };

    const intervalId = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [issues, orderId]);

  // ============================================================
  // PERSISTENCE (optimistic update, revert on failure)
  // ============================================================

  const persistPicked = useCallback(
    async (next: Record<string, number>): Promise<void> => {
      const previous = pickedItems;
      setPickedItems(next);
      const result = await updatePickedItems(orderId, formatPickedItemsString(next));
      if (!result.success) {
        setPickedItems(previous);
        Alert.alert('Error', result.error ?? 'Failed to save progress. Please try again.');
      }
    },
    [orderId, pickedItems]
  );

  const persistIssues = useCallback(
    async (next: ItemIssue[]): Promise<void> => {
      const previous = issues;
      setIssues(next);
      const result = await updateItemIssues(orderId, formatItemIssues(next));
      if (!result.success) {
        setIssues(previous);
        Alert.alert('Error', result.error ?? 'Failed to save progress. Please try again.');
      }
    },
    [orderId, issues]
  );

  const clearIssueFor = (productId: string): ItemIssue[] =>
    issues.filter((issue) => issue.productId !== productId);

  // ============================================================
  // HANDLERS
  // ============================================================

  const handleMarkFound = (productId: string, orderedQty: number): void => {
    persistPicked({ ...pickedItems, [productId]: orderedQty });
    if (issues.some((issue) => issue.productId === productId)) {
      persistIssues(clearIssueFor(productId));
    }
  };

  const handleQuantityChange = (productId: string, qty: number): void => {
    persistPicked({ ...pickedItems, [productId]: qty });
  };

  const handleMarkOutOfStock = (productId: string): void => {
    persistPicked({ ...pickedItems, [productId]: 0 });
    persistIssues([...clearIssueFor(productId), { productId, kind: 'oos' }]);
  };

  const handleOpenSubstitute = (productId: string): void => {
    setSubstitutionTarget(productId);
  };

  const handleSelectSubstitute = (product: Product): void => {
    if (!substitutionTarget) return;
    const productId = substitutionTarget;

    setSubstituteProducts((prev) => ({ ...prev, [productId]: product }));
    persistIssues([
      ...clearIssueFor(productId),
      { productId, kind: 'sub', subProductId: product.$id, status: 'pending' },
    ]);
    setSubstitutionTarget(null);
  };

  const isItemResolved = (productId: string, orderedQty: number): boolean => {
    const issue = issues.find((i) => i.productId === productId);
    if (issue?.kind === 'oos') return true;
    if (issue?.kind === 'sub') return issue.status === 'approved';
    return (pickedItems[productId] ?? 0) >= orderedQty;
  };

  const allResolved =
    orderedItems.length > 0 && orderedItems.every((item) => isItemResolved(item.productId, item.quantity));

  const handleContinue = (): void => {
    navigation.navigate('OrderCompletion', { orderId });
  };

  // ============================================================
  // RENDER
  // ============================================================

  if (loading) {
    return (
      <View style={[styles.centerContainer, dynamicStyles.container]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, dynamicStyles.detailText]}>Loading order...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centerContainer, dynamicStyles.container]}>
        <Text variant="headlineSmall" style={dynamicStyles.errorText}>
          Unable to load order
        </Text>
        <Text variant="bodyMedium" style={[styles.errorText, dynamicStyles.detailText]}>
          {error}
        </Text>
      </View>
    );
  }

  const substitutionOriginalProduct = substitutionTarget ? products[substitutionTarget] ?? null : null;

  return (
    <View style={[styles.container, dynamicStyles.container]}>
      <FlatList
        data={orderedItems}
        keyExtractor={(item) => item.productId}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const issue = issues.find((i) => i.productId === item.productId) ?? null;
          const displayProduct =
            issue?.kind === 'sub' ? substituteProducts[item.productId] ?? products[item.productId] : products[item.productId];

          return (
            <ItemChecklistItem
              product={displayProduct ?? null}
              productId={item.productId}
              orderedQty={item.quantity}
              pickedQty={pickedItems[item.productId] ?? 0}
              issue={issue}
              onMarkFound={() => handleMarkFound(item.productId, item.quantity)}
              onQuantityChange={(qty) => handleQuantityChange(item.productId, qty)}
              onMarkOutOfStock={() => handleMarkOutOfStock(item.productId)}
              onSubstitute={() => handleOpenSubstitute(item.productId)}
            />
          );
        }}
      />

      <View style={[styles.footer, dynamicStyles.footer]}>
        <Button mode="contained" onPress={handleContinue} disabled={!allResolved} style={styles.continueButton}>
          {allResolved ? 'Continue to Completion' : 'Resolve all items to continue'}
        </Button>
      </View>

      <SubstitutionPickerModal
        visible={substitutionTarget !== null}
        originalProduct={substitutionOriginalProduct}
        onSelect={handleSelectSubstitute}
        onCancel={() => setSubstitutionTarget(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
  },
  errorText: {
    marginTop: 8,
    textAlign: 'center',
  },
  listContent: {
    paddingVertical: 12,
    paddingBottom: 24,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
  },
  continueButton: {
    borderRadius: 8,
  },
});

export default ShoppingScreen;
