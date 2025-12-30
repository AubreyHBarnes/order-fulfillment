/**
 * App Navigator
 * File: src/navigation/AppNavigator.js
 * 
 * Manages navigation between auth screens and main app screens
 * based on user authentication state
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../context/AuthContext';

// Auth Screens
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';

// Temporary Home Screen (we'll replace this with real screens later)
import TestConnectionScreen from '../screens/TestConnectionScreen';

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
  const { user, userProfile, loading } = useAuth();

  // Show loading screen while checking authentication
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {!user ? (
        // Auth Stack - shown when user is NOT logged in
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
          }}
        >
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen 
            name="ForgotPassword" 
            component={ForgotPasswordScreen}
            options={{ headerShown: true, title: 'Reset Password' }}
          />
        </Stack.Navigator>
      ) : (
        // Main App Stack - shown when user IS logged in
        // For now, we'll just show the test screen
        // Later we'll add Customer/Shopper specific screens
        <Stack.Navigator>
          <Stack.Screen 
            name="Home" 
            component={TestConnectionScreen}
            options={{
              title: `Welcome ${userProfile?.firstName || 'User'}!`,
              headerRight: () => <LogoutButton />,
            }}
          />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
};

// Simple logout button component
const LogoutButton = () => {
  const { logout } = useAuth();
  const [loading, setLoading] = React.useState(false);

  const handleLogout = async () => {
    setLoading(true);
    await logout();
    setLoading(false);
  };

  return (
    <TouchableOpacity onPress={handleLogout} disabled={loading} style={{ marginRight: 15 }}>
      {loading ? (
        <ActivityIndicator size="small" color="#007AFF" />
      ) : (
        <Text style={{ color: '#007AFF', fontSize: 16 }}>Logout</Text>
      )}
    </TouchableOpacity>
  );
};

// Add missing imports at the top
import { TouchableOpacity, Text } from 'react-native';

export default AppNavigator;