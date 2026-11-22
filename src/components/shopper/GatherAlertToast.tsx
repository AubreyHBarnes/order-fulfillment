/**
 * One-time toast when a customer on one of this shopper's ready orders is about a minute away.
 * The persistent copy of the same signal is the "Arriving soon" list on Customer Check-ins.
 */
import React from 'react';
import { Snackbar, Text } from 'react-native-paper';
import { useAppTheme } from '../../theme';

// Longer than the urgent-order toast: this one is time-critical and easy to miss while walking.
const TOAST_DURATION_MS = 10000;

interface Props {
  message: string | null;
  onDismiss: () => void;
}

const GatherAlertToast: React.FC<Props> = ({ message, onDismiss }) => {
  const theme = useAppTheme();
  return (
    <Snackbar
      visible={!!message}
      onDismiss={onDismiss}
      duration={TOAST_DURATION_MS}
      action={{ label: 'Dismiss', onPress: onDismiss }}
      style={{ backgroundColor: theme.colors.inverseSurface }}
    >
      <Text style={{ color: theme.colors.inverseOnSurface }}>{message}</Text>
    </Snackbar>
  );
};

export default GatherAlertToast;
