/**
 * Login Screen
 * File: src/screens/auth/LoginScreen.tsx
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
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { useAppTheme } from '../../theme';
import type { AuthStackParamList } from '../../types';

type LoginScreenProps = NativeStackScreenProps<AuthStackParamList, 'Login'>;

const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [localLoading, setLocalLoading] = useState<boolean>(false);

  const { login } = useAuth();
  const theme = useAppTheme();

  const dynamicStyles = {
    container: {
      backgroundColor: theme.colors.background,
    },
    title: {
      color: theme.colors.onBackground,
    },
    subtitle: {
      color: theme.custom.textSecondary,
    },
    label: {
      color: theme.colors.onBackground,
    },
    input: {
      backgroundColor: theme.custom.inputBackground,
      borderColor: theme.custom.inputBorder,
      color: theme.colors.onSurface,
    },
    forgotPasswordText: {
      color: theme.colors.primary,
    },
    loginButton: {
      backgroundColor: theme.colors.primary,
    },
    loginButtonText: {
      color: theme.colors.onPrimary,
    },
    registerText: {
      color: theme.custom.textSecondary,
    },
    registerLink: {
      color: theme.colors.primary,
    },
  };

  const handleLogin = async (): Promise<void> => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLocalLoading(true);
    const result = await login(email, password);
    setLocalLoading(false);

    if (!result.success) {
      Alert.alert('Login Failed', result.error ?? 'Unknown error occurred');
    }
    // Navigation is handled automatically by App.js based on auth state
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, dynamicStyles.container]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={[styles.title, dynamicStyles.title]}>Grocery Fulfillment</Text>
          <Text style={[styles.subtitle, dynamicStyles.subtitle]}>Sign in to continue</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Text style={[styles.label, dynamicStyles.label]}>Email</Text>
            <TextInput
              style={[styles.input, dynamicStyles.input]}
              placeholder="Enter your email"
              placeholderTextColor={theme.custom.textDisabled}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.label, dynamicStyles.label]}>Password</Text>
            <TextInput
              style={[styles.input, dynamicStyles.input]}
              placeholder="Enter your password"
              placeholderTextColor={theme.custom.textDisabled}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity
            style={styles.forgotPassword}
            onPress={() => navigation.navigate('ForgotPassword')}
          >
            <Text style={[styles.forgotPasswordText, dynamicStyles.forgotPasswordText]}>Forgot Password?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.loginButton, dynamicStyles.loginButton, localLoading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={localLoading}
          >
            {localLoading ? (
              <ActivityIndicator color={theme.colors.onPrimary} />
            ) : (
              <Text style={[styles.loginButtonText, dynamicStyles.loginButtonText]}>Sign In</Text>
            )}
          </TouchableOpacity>

          <View style={styles.registerContainer}>
            <Text style={[styles.registerText, dynamicStyles.registerText]}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text style={[styles.registerLink, dynamicStyles.registerLink]}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    borderWidth: 1,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 20,
  },
  forgotPasswordText: {
    fontSize: 14,
  },
  loginButton: {
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  registerText: {
    fontSize: 14,
  },
  registerLink: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default LoginScreen;
