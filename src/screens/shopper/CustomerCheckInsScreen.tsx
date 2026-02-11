/**
 * Customer Check-ins Screen (Placeholder)
 * File: src/screens/shopper/CustomerCheckInsScreen.tsx
 *
 * PURPOSE:
 * Lists customers who have arrived for pickup orders.
 * Shoppers can see who's waiting and mark orders as handed off.
 * This is a placeholder - full implementation will come later.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Icon } from 'react-native-paper';
import { useAppTheme } from '../../theme';

const CustomerCheckInsScreen: React.FC = () => {
  const theme = useAppTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Icon source="account-check" size={64} color={theme.custom.textDisabled} />
      <Text variant="headlineSmall" style={{ color: theme.colors.onSurface, marginTop: 16 }}>
        Customer Check-ins
      </Text>
      <Text variant="bodyMedium" style={{ color: theme.custom.textSecondary, marginTop: 8 }}>
        Customers waiting for pickup will appear here
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
});

export default CustomerCheckInsScreen;
