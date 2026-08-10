/**
 * Authentication Context
 * File: src/context/AuthContext.tsx
 *
 * Manages user authentication state and provides auth functions
 * throughout the app
 */

import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  ReactNode,
} from 'react';
import { account, databases, config, Query } from '../services/appwrite';
import { ID, Models } from 'appwrite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  AuthContextType,
  AuthResult,
  UserProfile,
  UserRole,
  ProfileUpdateData,
} from '../types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<Models.User<Models.Preferences> | null>(
    null
  );
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Check if user is already logged in on app start
  useEffect(() => {
    const checkUserSession = async (): Promise<void> => {
      try {
        setLoading(true);
        const session = await account.get();
        setUser(session);

        // Fetch user profile from Users collection
        await fetchUserProfile(session.$id);
      } catch {
        // No active session
        setUser(null);
        setUserProfile(null);
      } finally {
        setLoading(false);
      }
    };
    checkUserSession();
  }, []);

  const fetchUserProfile = async (userID: string): Promise<void> => {
    try {
      const profiles = await databases.listDocuments<UserProfile>(
        config.databaseId,
        config.usersCollectionId,
        [Query.equal('userID', userID)]
      );

      const firstProfile = profiles.documents[0];
      if (firstProfile) {
        setUserProfile(firstProfile);
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
    }
  };

  // Register new user
  const register = async (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    role: UserRole
  ): Promise<AuthResult> => {
    try {
      setLoading(true);
      setError(null);

      // Create account in Appwrite Auth
      const newAccount = await account.create(
        ID.unique(),
        email,
        password,
        `${firstName} ${lastName}`
      );

      // Create session (log in)
      await account.createEmailPasswordSession(email, password);

      try {
        // Create user profile in Users collection
        // Note: Appwrite schema requires both customerID and shopperID fields
        // We set the relevant one based on role, and empty string for the other
        const profile = await databases.createDocument<UserProfile>(
          config.databaseId,
          config.usersCollectionId,
          ID.unique(),
          {
            userID: newAccount.$id,
            role: role,
            firstName: firstName,
            lastName: lastName,
            // Set customerID for customers, empty for shoppers
            customerID: role === 'customer' ? newAccount.$id : '',
            // Set shopperID for shoppers, empty for customers
            shopperID: role === 'shopper' ? newAccount.$id : '',
          }
        );

        // If registering as shopper, create ShopperStatus record
        if (role === 'shopper') {
          try {
            await databases.createDocument(
              config.databaseId,
              config.shopperStatusCollectionId,
              ID.unique(),
              {
                shopperID: newAccount.$id,
                isAvailable: false, // Start as unavailable
                currentOrderId: '',
                location: '',
                maxConcurrentOrders: 1,
                lastActiveTimeStamp: new Date().toISOString(),
              }
            );
          } catch (shopperStatusErr) {
            // Undo the profile doc too, so we don't leave a Users record
            // with no matching ShopperStatus for a shopper account
            await databases.deleteDocument(
              config.databaseId,
              config.usersCollectionId,
              profile.$id
            );
            throw shopperStatusErr;
          }
        }

        // Get the full user object after session creation
        const currentUser = await account.get();
        setUser(currentUser);
        setUserProfile(profile);
        setLoading(false);

        return { success: true };
      } catch (profileErr) {
        // Profile setup failed after the Auth account already exists.
        // The client SDK has no way to delete an account (only the
        // server-side Users API can, and that needs an API key we don't
        // have configured) so the best we can do is block it and drop the
        // session rather than leave a live, logged-in account with no
        // profile. updateStatus() must run before deleteSession() — it
        // needs the active session to identify which account to block.
        try {
          await account.updateStatus();
        } catch {
          // best effort
        }
        try {
          await account.deleteSession('current');
        } catch {
          // best effort
        }

        const baseMessage =
          profileErr instanceof Error
            ? profileErr.message
            : 'Failed to create user profile';
        throw new Error(
          `${baseMessage} (the Auth account for ${email} was created but has been blocked since profile setup failed - delete it in the console before retrying with this email)`
        );
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Registration failed';
      setError(errorMessage);
      setLoading(false);
      return { success: false, error: errorMessage };
    }
  };

  // Login existing user
  const login = async (
    email: string,
    password: string
  ): Promise<AuthResult> => {
    try {
      setLoading(true);
      setError(null);

      // Create session
      await account.createEmailPasswordSession(email, password);

      // Get account details
      const accountDetails = await account.get();
      setUser(accountDetails);

      // Fetch user profile
      await fetchUserProfile(accountDetails.$id);

      setLoading(false);
      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      setError(errorMessage);
      setLoading(false);
      return { success: false, error: errorMessage };
    }
  };

  // Logout user
  const logout = async (): Promise<AuthResult> => {
    try {
      setLoading(true);
      await account.deleteSession('current');
      setUser(null);
      setUserProfile(null);
      await AsyncStorage.clear();
      setLoading(false);
      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Logout failed';
      setError(errorMessage);
      setLoading(false);
      return { success: false, error: errorMessage };
    }
  };

  // Update user profile
  const updateProfile = async (
    updates: ProfileUpdateData
  ): Promise<AuthResult> => {
    try {
      setLoading(true);
      setError(null);

      if (!userProfile) {
        throw new Error('No user profile found');
      }

      const updatedProfile = await databases.updateDocument<UserProfile>(
        config.databaseId,
        config.usersCollectionId,
        userProfile.$id,
        updates
      );

      setUserProfile(updatedProfile);
      setLoading(false);
      return { success: true };
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Profile update failed';
      setError(errorMessage);
      setLoading(false);
      return { success: false, error: errorMessage };
    }
  };

  // Password reset
  const resetPassword = async (email: string): Promise<AuthResult> => {
    try {
      setLoading(true);
      setError(null);

      await account.createRecovery(
        email,
        'https://groceryfulfillment.app/reset-password' // This is a placeholder URL
      );

      setLoading(false);
      return { success: true };
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Password reset failed';
      setError(errorMessage);
      setLoading(false);
      return { success: false, error: errorMessage };
    }
  };

  const value: AuthContextType = {
    user,
    userProfile,
    loading,
    error,
    register,
    login,
    logout,
    updateProfile,
    resetPassword,
    isCustomer: userProfile?.role === 'customer',
    isShopper: userProfile?.role === 'shopper',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
