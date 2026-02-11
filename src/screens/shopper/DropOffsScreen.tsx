/**
 * Drop Offs Screen (Placeholder)
 * File: src/screens/shopper/DropOffsScreen.tsx
 *
 * PURPOSE:
 * Lists orders ready for delivery. Shows assigned deliveries for the shopper.
 * This is a placeholder - full implementation will come later.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Icon } from 'react-native-paper';
import { useAppTheme } from '../../theme';

const DropOffsScreen: React.FC = () => {
  const theme = useAppTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Icon source="truck-delivery" size={64} color={theme.custom.textDisabled} />
      <Text variant="headlineSmall" style={{ color: theme.colors.onSurface, marginTop: 16 }}>
        Drop Offs
      </Text>
      <Text variant="bodyMedium" style={{ color: theme.custom.textSecondary, marginTop: 8 }}>
        Orders ready for delivery will appear here
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

export default DropOffsScreen;
