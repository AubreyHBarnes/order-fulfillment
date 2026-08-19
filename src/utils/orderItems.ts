/**
 * Order Item String Helpers
 * File: src/utils/orderItems.ts
 *
 * PURPOSE: Parse/format the compact string fields on Order (items,
 * pickedItems, itemIssues) for the shopping workflow (ShoppingScreen,
 * OrderCompletionScreen) and the customer-side substitution approval
 * card on OrderDetailScreen.
 *
 * WHY A NEW SHARED MODULE INSTEAD OF EXTENDING THE EXISTING PER-SCREEN
 * COPIES?
 * TaskDetailScreen, AvailableTasksScreen, ShopperDashboardScreen, and
 * the customer OrderDetailScreen each already have their own small
 * local parser for `items`/`pickedItems`. Those are working code for
 * read-only display and weren't touched here - this module exists for
 * the new read/write item-issue logic the shopping workflow needs,
 * which none of those screens had before.
 */

/**
 * Parse the compact `items` string: "productId:qty,productId:qty,..."
 */
export interface ParsedOrderItem {
  productId: string;
  quantity: number;
}

export const parseItemsString = (itemsString: string): ParsedOrderItem[] => {
  if (!itemsString) return [];

  return itemsString
    .split(',')
    .map((pair) => {
      const [productId, qty] = pair.split(':');
      return {
        productId: productId ?? '',
        quantity: parseInt(qty ?? '0', 10) || 0,
      };
    })
    .filter((item) => item.productId && item.quantity > 0);
};

/**
 * Parse/format the compact `pickedItems` string: same shape as `items`.
 */
export const parsePickedItemsString = (pickedItems: string): Record<string, number> => {
  const result: Record<string, number> = {};
  if (!pickedItems) return result;

  for (const pair of pickedItems.split(',')) {
    if (!pair) continue;
    const [productId, qty] = pair.split(':');
    if (productId) {
      result[productId] = parseInt(qty ?? '0', 10) || 0;
    }
  }
  return result;
};

export const formatPickedItemsString = (picked: Record<string, number>): string => {
  return Object.entries(picked)
    .filter(([, qty]) => qty > 0)
    .map(([productId, qty]) => `${productId}:${qty}`)
    .join(',');
};

/**
 * Parse/format the compact `itemIssues` string.
 *
 * FORMAT:
 * - "productId:oos" - item marked out of stock, no substitute offered
 * - "productId:sub:subProductId:pending|approved|rejected" - a
 *   substitution proposal and its current approval state
 *
 * WHY A DISCRIMINATED UNION?
 * - 'oos' and 'sub' issues carry different data (a sub needs the
 *   substitute product id and approval status, oos needs nothing else)
 * - TypeScript narrows on `kind` at every call site, no optional fields
 */
export type ItemIssue =
  | { productId: string; kind: 'oos' }
  | {
      productId: string;
      kind: 'sub';
      subProductId: string;
      status: 'pending' | 'approved' | 'rejected';
    };

export const parseItemIssues = (itemIssues: string): ItemIssue[] => {
  if (!itemIssues) return [];

  const issues: ItemIssue[] = [];
  for (const entry of itemIssues.split(',')) {
    if (!entry) continue;
    const parts = entry.split(':');
    const [productId, kind] = parts;
    if (!productId) continue;

    if (kind === 'oos') {
      issues.push({ productId, kind: 'oos' });
    } else if (kind === 'sub') {
      const subProductId = parts[2];
      const status = parts[3];
      if (
        subProductId &&
        (status === 'pending' || status === 'approved' || status === 'rejected')
      ) {
        issues.push({ productId, kind: 'sub', subProductId, status });
      }
    }
  }
  return issues;
};

export const formatItemIssues = (issues: ItemIssue[]): string => {
  return issues
    .map((issue) =>
      issue.kind === 'oos'
        ? `${issue.productId}:oos`
        : `${issue.productId}:sub:${issue.subProductId}:${issue.status}`
    )
    .join(',');
};
