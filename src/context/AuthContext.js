/**
 * Authentication Context
 * File: src/context/AuthContext.js
 * 
 * Manages user authentication state and provides auth functions
 * throughout the app
 */

import React, { createContext, useState, useContext, useEffect } from 'react';
import { account, databases, config } from '../services/appwrite';
import { ID } from 'appwrite';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check if user is already logged in on app start
  useEffect(() => {
    const checkUserSession = async () => {
      try {
        setLoading(true);
        const session = await account.get();
        setUser(session);
        
        // Fetch user profile from Users collection
        await fetchUserProfile(session.$id);
      } catch (err) {
        // No active session
        setUser(null);
        setUserProfile(null);
      } finally {
        setLoading(false);
      }
    };
    checkUserSession();
  }, []);


  const fetchUserProfile = async (userID) => {
    try {
      const { Query } = require('appwrite');
      const profiles = await databases.listDocuments(
        config.databaseId,
        config.usersCollectionId,
        [Query.equal('userID', userID)]
      );

      if (profiles.documents.length > 0) {
        setUserProfile(profiles.documents[0]);
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
    }
  };

  // Register new user
  const register = async (email, password, firstName, lastName, role) => {
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

      // Create user profile in Users collection
      const profile = await databases.createDocument(
        config.databaseId,
        config.usersCollectionId,
        ID.unique(),
        {
          userID: newAccount.$id,
          role: role,
          firstName: firstName,
          lastName: lastName,
          phoneNumber: null,
          profileImage: null
        }
      );

      // If registering as shopper, create ShopperStatus record
      if (role === 'shopper') {
        await databases.createDocument(
          config.databaseId,
          config.shopperStatusCollectionId,
          ID.unique(),
          {
            shopperId: newAccount.$id,
            isAvailable: false, // Start as unavailable
            currentOrderId: '',
            location: '',
            maxConcurrentOrders: 1,
            lastActiveTimestamp: new Date().toISOString()
          }
        );
      }

      setUser(newAccount);
      setUserProfile(profile);
      setLoading(false);

      return { success: true };
    } catch (err) {
      setError(err.message);
      setLoading(false);
      return { success: false, error: err.message };
    }
  };

  // Login existing user
  const login = async (email, password) => {
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
      setError(err.message);
      setLoading(false);
      return { success: false, error: err.message };
    }
  };

  // Logout user
  const logout = async () => {
    try {
      setLoading(true);
      await account.deleteSession('current');
      setUser(null);
      setUserProfile(null);
      await AsyncStorage.clear();
      setLoading(false);
      return { success: true };
    } catch (err) {
      setError(err.message);
      setLoading(false);
      return { success: false, error: err.message };
    }
  };

  // Update user profile
  const updateProfile = async (updates) => {
    try {
      setLoading(true);
      setError(null);

      const updatedProfile = await databases.updateDocument(
        config.databaseId,
        config.usersCollectionId,
        userProfile.$id,
        updates
      );

      setUserProfile(updatedProfile);
      setLoading(false);
      return { success: true };
    } catch (err) {
      setError(err.message);
      setLoading(false);
      return { success: false, error: err.message };
    }
  };

  // Password reset
  const resetPassword = async (email) => {
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
      setError(err.message);
      setLoading(false);
      return { success: false, error: err.message };
    }
  };

  const value = {
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
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};