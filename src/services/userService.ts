/**
 * User Service
 * File: src/services/userService.ts
 *
 * PURPOSE:
 * Handles user profile-related operations with Appwrite.
 * Used by shopper screens to fetch customer information.
 *
 * WHY SEPARATE SERVICE?
 * - User profile fetching is distinct from authentication
 * - Reusable across different parts of the app
 * - Single responsibility - all user profile operations in one place
 */

import { Query } from 'appwrite';
import { databases, config } from './appwrite';
import type { UserProfile } from '../types';

// ============================================================
// TYPES
// ============================================================

export interface UserProfileResponse {
  success: boolean;
  data: UserProfile | null;
  error?: string;
}

export interface UserProfileListResponse {
  success: boolean;
  data: UserProfile[];
  error?: string;
}

// ============================================================
// USER PROFILE FUNCTIONS
// ============================================================

/**
 * Fetch a user profile by their Appwrite user ID
 *
 * WHY userID NOT $id?
 * - $id is the document ID in the Users collection
 * - userID is the Appwrite Auth user ID stored in the profile
 * - We query by userID to link auth accounts to profiles
 *
 * @param userId - The Appwrite Auth user ID
 * @returns UserProfileResponse with profile or error
 */
export const getUserProfileById = async (
  userId: string
): Promise<UserProfileResponse> => {
  try {
    /**
     * WHY listDocuments with Query instead of getDocument?
     * - We're searching by userID field, not document $id
     * - Query.equal finds the profile with matching userID
     * - Typically returns one result (one profile per user)
     */
    const response = await databases.listDocuments<UserProfile>(
      config.databaseId,
      config.usersCollectionId,
      [Query.equal('userID', userId), Query.limit(1)]
    );

    const profile = response.documents[0];
    if (profile) {
      return {
        success: true,
        data: profile,
      };
    }

    return {
      success: false,
      data: null,
      error: 'User profile not found',
    };
  } catch (error) {
    console.error('Error fetching user profile:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to fetch user profile';

    return {
      success: false,
      data: null,
      error: errorMessage,
    };
  }
};

/**
 * Fetch multiple user profiles by their user IDs
 *
 * WHY BATCH FETCH?
 * - When showing a list of orders, we need customer names
 * - Fetching one by one would be slow (N+1 problem)
 * - Batch fetch gets all profiles in one query
 *
 * WHY RETURN AS MAP?
 * - Easy lookup: profilesMap[customerId] gives the profile
 * - O(1) lookup instead of O(n) array search
 * - Convenient for mapping over orders
 *
 * @param userIds - Array of Appwrite Auth user IDs
 * @returns Object with profiles mapped by userId
 */
export const getUserProfilesByIds = async (
  userIds: string[]
): Promise<{
  success: boolean;
  data: Record<string, UserProfile>;
  error?: string;
}> => {
  try {
    // Filter out empty strings and duplicates
    const uniqueIds = [...new Set(userIds.filter((id) => id.length > 0))];

    if (uniqueIds.length === 0) {
      return {
        success: true,
        data: {},
      };
    }

    /**
     * WHY Query.equal with array?
     * - Appwrite treats array values as OR conditions
     * - Query.equal('userID', ['id1', 'id2']) means userID = 'id1' OR userID = 'id2'
     * - Efficient single query for multiple IDs
     */
    const response = await databases.listDocuments<UserProfile>(
      config.databaseId,
      config.usersCollectionId,
      [Query.equal('userID', uniqueIds), Query.limit(100)]
    );

    // Convert array to map for easy lookup
    const profilesMap: Record<string, UserProfile> = {};
    for (const profile of response.documents) {
      profilesMap[profile.userID] = profile;
    }

    return {
      success: true,
      data: profilesMap,
    };
  } catch (error) {
    console.error('Error fetching user profiles:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to fetch user profiles';

    return {
      success: false,
      data: {},
      error: errorMessage,
    };
  }
};

/**
 * Get customer's full name from profile
 *
 * WHY HELPER FUNCTION?
 * - Consistent name formatting across the app
 * - Handles missing names gracefully
 * - Single place to change format if needed
 *
 * @param profile - UserProfile or null
 * @returns Full name or fallback string
 */
export const getCustomerDisplayName = (
  profile: UserProfile | null | undefined
): string => {
  if (!profile) {
    return 'Unknown Customer';
  }

  const firstName = profile.firstName || '';
  const lastName = profile.lastName || '';

  if (firstName && lastName) {
    return `${firstName} ${lastName}`;
  }

  return firstName || lastName || 'Unknown Customer';
};
