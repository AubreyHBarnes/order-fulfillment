/**
 * Shopper Status Service
 * File: src/services/shopperStatusService.ts
 *
 * PURPOSE: Handles shopper status operations with Appwrite
 *
 * RESPONSIBILITIES:
 * - Fetch shopper status from database
 *
 * WHERE DID EVERYTHING ELSE GO?
 * This file used to also decide *which* shopper an order went to
 * (auto-assignment - moved server-side into `functions/auto-assignment/`,
 * see docs/DECISIONS.md's two "Auto-assignment" entries), and later also
 * wrote `isAvailable` toggling and manual claim/swap directly
 * (`updateShopperAvailability`, `assignOrderToShopper`,
 * `swapCurrentOrder`) - all three replaced by server-side Function
 * actions (`toggleAvailability`, folded into `claimOrder`/`swapOrder`
 * respectively) as part of the "Permission tightening" migration, see
 * `src/services/functionActionService.ts` and docs/DECISIONS.md's entry
 * by that name. `getShopperStatus` is the only thing left here - a
 * plain read, never part of any write-path lockdown.
 */

import { Query } from 'appwrite';
import { databases, config } from './appwrite';
import type {
  ShopperStatus,
  ShopperStatusResponse,
} from '../types';

// ============================================================
// SHOPPER STATUS FETCHING
// ============================================================

/**
 * Get shopper status by shopper ID
 *
 * WHY QUERY BY shopperId?
 * - The document $id is not the same as shopperId
 * - Need to find the status document for a specific shopper
 *
 * @param shopperId - The shopper's user ID
 * @returns ShopperStatusResponse with status or error
 */
export const getShopperStatus = async (
  shopperId: string
): Promise<ShopperStatusResponse> => {
  try {
    const response = await databases.listDocuments<ShopperStatus>(
      config.databaseId,
      config.shopperStatusCollectionId,
      [Query.equal('shopperID', shopperId), Query.limit(1)]
    );

    if (response.documents.length === 0) {
      return {
        success: false,
        data: null,
        error: 'Shopper status not found',
      };
    }

    return {
      success: true,
      data: response.documents[0] ?? null,
    };
  } catch (error) {
    console.error('Error fetching shopper status:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to fetch shopper status';

    return {
      success: false,
      data: null,
      error: errorMessage,
    };
  }
};
