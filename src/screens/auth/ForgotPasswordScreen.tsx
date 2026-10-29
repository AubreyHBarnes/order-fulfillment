/**
 * Forgot Password Screen
 * File: src/screens/auth/ForgotPasswordScreen.tsx
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import type { AuthStackParamList } from '../../types';
import { fontFamilies, radius, spacing, useAppTheme } from '../../theme';
import type { AppTheme } from '../../theme';

type ForgotPasswordScreenProps = NativeStackScreenProps<
  AuthStackParamList,
  'ForgotPassword'
>;

const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({
  navigation,
}) => {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const [email, setEmail] = useState<string>('');
  const [localLoading, setLocalLoading] = useState<boolean>(false);
  const [emailSent, setEmailSent] = useState<boolean>(false);

  const { resetPassword } = useAuth();

  const handleResetPassword = async (): Promise<void> => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    setLocalLoading(true);
    const result = await resetPassword(email);
    setLocalLoading(false);

    if (result.success) {
      setEmailSent(true);
    } else {
      Alert.alert('Error', result.error ?? 'Unknown error occurred');
    }
  };

  if (emailSent) {
    return (
      <View style={styles.container}>
        <View style={styles.successContainer}>
          <Text style={styles.successIcon}>checkmark</Text>
          <Text style={styles.successTitle}>Check Your Email</Text>
          <Text style={styles.successText}>
            We've sent password reset instructions to:
          </Text>
          <Text style={styles.emailText}>{email}</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.backButtonText}>Back to Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Reset Password</Text>
        <Text style={styles.subtitle}>
          Enter your email address and we'll send you instructions to reset your
          password.
        </Text>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
        </View>

        <TouchableOpacity
          style={[styles.resetButton, localLoading && styles.buttonDisabled]}
          onPress={handleResetPassword}
          disabled={localLoading}
        >
          {localLoading ? (
            <ActivityIndicator color={theme.colors.onPrimary} />
          ) : (
            <Text style={styles.resetButtonText}>Send Reset Link</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: spacing.xl,
    justifyContent: 'center',
  },
  content: {
    width: '100%',
  },
  title: {
    fontSize: 28,
    fontFamily: fontFamilies.heading,
    color: theme.colors.onSurface,
    marginBottom: spacing.md,
  },
  subtitle: {
    fontFamily: fontFamilies.body,
    fontSize: 16,
    color: theme.custom.textSecondary,
    marginBottom: 30,
    lineHeight: 22,
  },
  inputContainer: {
    marginBottom: spacing.xl,
  },
  label: {
    fontSize: 14,
    fontFamily: fontFamilies.bodySemiBold,
    color: theme.colors.onSurface,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: theme.colors.elevation.level1,
    color: theme.colors.onSurface,
    fontFamily: fontFamilies.body,
    borderRadius: radius.sm,
    padding: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  resetButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: radius.sm,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  resetButtonText: {
    color: theme.colors.onPrimary,
    fontSize: 16,
    fontFamily: fontFamilies.bodySemiBold,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  cancelButton: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontFamily: fontFamilies.body,
    color: theme.custom.textSecondary,
    fontSize: 16,
  },
  successContainer: {
    alignItems: 'center',
  },
  successIcon: {
    fontSize: 64,
    color: theme.custom.status.picked.color,
    marginBottom: spacing.xl,
  },
  successTitle: {
    fontSize: 24,
    fontFamily: fontFamilies.heading,
    color: theme.colors.onSurface,
    marginBottom: spacing.md,
  },
  successText: {
    fontFamily: fontFamilies.body,
    fontSize: 16,
    color: theme.custom.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  emailText: {
    fontSize: 16,
    fontFamily: fontFamilies.bodySemiBold,
    color: theme.colors.onSurface,
    marginBottom: 30,
  },
  backButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: radius.sm,
    padding: spacing.lg,
    width: '100%',
    alignItems: 'center',
  },
  backButtonText: {
    color: theme.colors.onPrimary,
    fontSize: 16,
    fontFamily: fontFamilies.bodySemiBold,
  },
});

export default ForgotPasswordScreen;
