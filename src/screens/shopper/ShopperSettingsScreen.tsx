/**
 * Shopper Settings Screen
 * File: src/screens/shopper/ShopperSettingsScreen.tsx
 *
 * PURPOSE:
 * Settings and preferences for shoppers: profile display, theme
 * preference, app version, and logout.
 *
 * WHY NOT NOTIFICATION PREFERENCES OR AN AVAILABILITY SCHEDULE?
 * Both were on the original placeholder's planned-features list, but
 * neither has anything to control yet: there's no push notification
 * library anywhere in this app (see docs/DECISIONS.md, "Pull-based
 * data, not realtime" - everything is foreground polling), and an
 * availability *schedule* would be a genuinely new recurring-schedule
 * feature, not a settings toggle - out of scope here the same way the
 * project has already deferred other adjacent-but-bigger features
 * found while auditing a screen (e.g. multi-order pickup consolidation
 * in the "Customer ready-for-pickup notification" DECISIONS.md entry).
 * A toggle that controls nothing real would be worse than no toggle.
 *
 * WHY DARK MODE HERE?
 * useThemeMode() (src/context/ThemeContext.tsx) already exists,
 * fully wired (persists to storage, drives the whole app's theme) and
 * was simply never surfaced in any settings UI - this is the first
 * screen to actually expose it.
 */

import React from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Text, Icon, Button, Divider, SegmentedButtons } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { useThemeMode } from '../../context/ThemeContext';
import { useAppTheme, spacing } from '../../theme';
import type { ShopperStackParamList } from '../../types';
import type { ThemeMode } from '../../theme';
import packageJson from '../../../package.json';

type ShopperSettingsScreenProps = NativeStackScreenProps<
  ShopperStackParamList,
  'ShopperSettings'
>;

const ShopperSettingsScreen: React.FC<ShopperSettingsScreenProps> = () => {
  const theme = useAppTheme();
  const { logout, userProfile } = useAuth();
  const { themeMode, setThemeMode } = useThemeMode();

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
        <Text variant="titleLarge" style={{ color: theme.colors.onSurface, marginTop: spacing.md }}>
          {userProfile?.firstName} {userProfile?.lastName}
        </Text>
        <Text variant="bodyMedium" style={{ color: theme.custom.textSecondary }}>
          Shopper
        </Text>
      </View>

      <View style={styles.middleSection}>
        <Divider style={styles.divider} />

        {/* Appearance Settings */}
        <View style={styles.settingsSection}>
          <Text variant="labelMedium" style={{ color: theme.custom.textSecondary, marginBottom: spacing.sm }}>
            APPEARANCE
          </Text>
          <SegmentedButtons
            value={themeMode}
            onValueChange={(value) => setThemeMode(value as ThemeMode)}
            buttons={[
              { value: 'light', label: 'Light', icon: 'white-balance-sunny' },
              { value: 'dark', label: 'Dark', icon: 'weather-night' },
              { value: 'system', label: 'System', icon: 'cellphone' },
            ]}
          />
        </View>

        <Divider style={styles.divider} />

        {/* App Version */}
        <Text variant="bodySmall" style={[styles.versionText, { color: theme.custom.textDisabled }]}>
          Version {packageJson.version}
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
    padding: spacing.xxl,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  divider: {
    marginVertical: spacing.lg,
  },
  middleSection: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  settingsSection: {
    paddingVertical: spacing.xs,
  },
  versionText: {
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  logoutSection: {
    padding: spacing.xl,
    paddingBottom: 40,
  },
  logoutButton: {
    borderWidth: 1,
  },
});

export default ShopperSettingsScreen;
