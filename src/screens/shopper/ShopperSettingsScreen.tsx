/**
 * Shopper Settings Screen (Placeholder)
 * File: src/screens/shopper/ShopperSettingsScreen.tsx
 *
 * PURPOSE:
 * Provides settings and preferences for shoppers.
 * This includes notification preferences, account settings, logout.
 * This is a placeholder - full implementation will come later.
 *
 * ============================================================
 * PLANNED FEATURES
 * ============================================================
 *
 * In production, this screen would include:
 * 1. Profile information (name, photo)
 * 2. Notification settings (push, sound, vibration)
 * 3. Availability schedule preferences
 * 4. Dark mode toggle
 * 5. Logout button
 * 6. App version info
 */

import React from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Text, Icon, Button, Divider } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { useAppTheme } from '../../theme';
import type { ShopperStackParamList } from '../../types';

type ShopperSettingsScreenProps = NativeStackScreenProps<
  ShopperStackParamList,
  'ShopperSettings'
>;

const ShopperSettingsScreen: React.FC<ShopperSettingsScreenProps> = ({ navigation }) => {
  const theme = useAppTheme();
  const { logout, userProfile } = useAuth();

  /**
   * Handle logout with confirmation
   *
   * WHY CONFIRMATION DIALOG?
   * - Prevents accidental logouts
   * - Standard UX pattern for destructive actions
   * - Gives user a chance to reconsider
   */
  const handleLogout = (): void => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Profile Section */}
      <View style={[styles.profileSection, { backgroundColor: theme.colors.surface }]}>
        <View style={[styles.avatarContainer, { backgroundColor: theme.colors.primaryContainer }]}>
          <Icon source="account" size={48} color={theme.colors.primary} />
        </View>
        <Text variant="titleLarge" style={{ color: theme.colors.onSurface, marginTop: 12 }}>
          {userProfile?.firstName} {userProfile?.lastName}
        </Text>
        <Text variant="bodyMedium" style={{ color: theme.custom.textSecondary }}>
          Shopper
        </Text>
      </View>

      <Divider style={styles.divider} />

      {/* Placeholder Settings */}
      <View style={styles.settingsSection}>
        <Icon source="cog-outline" size={48} color={theme.custom.textDisabled} />
        <Text variant="bodyMedium" style={{ color: theme.custom.textSecondary, marginTop: 8, textAlign: 'center' }}>
          Additional settings will be available here
        </Text>
      </View>

      {/* Logout Button */}
      <View style={styles.logoutSection}>
        <Button
          mode="outlined"
          onPress={handleLogout}
          textColor={theme.colors.error}
          style={[styles.logoutButton, { borderColor: theme.colors.error }]}
          icon="logout"
        >
          Logout
        </Button>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  profileSection: {
    alignItems: 'center',
    padding: 24,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  divider: {
    marginVertical: 16,
  },
  settingsSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  logoutSection: {
    padding: 20,
    paddingBottom: 40,
  },
  logoutButton: {
    borderWidth: 1,
  },
});

export default ShopperSettingsScreen;
