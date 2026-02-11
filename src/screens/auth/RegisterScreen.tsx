/**
 * Register Screen
 * File: src/screens/auth/RegisterScreen.tsx
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
import type { AuthStackParamList, UserRole } from '../../types';

type RegisterScreenProps = NativeStackScreenProps<
  AuthStackParamList,
  'Register'
>;

const RegisterScreen: React.FC<RegisterScreenProps> = ({ navigation }) => {
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [role, setRole] = useState<UserRole>('customer');
  const [localLoading, setLocalLoading] = useState<boolean>(false);

  const { register } = useAuth();
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
    roleButton: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.custom.border,
    },
    roleButtonActive: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primaryContainer,
    },
    roleButtonText: {
      color: theme.custom.textSecondary,
    },
    roleButtonTextActive: {
      color: theme.colors.primary,
    },
    input: {
      backgroundColor: theme.custom.inputBackground,
      borderColor: theme.custom.inputBorder,
      color: theme.colors.onSurface,
    },
    registerButton: {
      backgroundColor: theme.colors.primary,
    },
    registerButtonText: {
      color: theme.colors.onPrimary,
    },
    loginText: {
      color: theme.custom.textSecondary,
    },
    loginLink: {
      color: theme.colors.primary,
    },
  };

  const handleRegister = async (): Promise<void> => {
    // Validation
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }

    setLocalLoading(true);
    const result = await register(email, password, firstName, lastName, role);
    setLocalLoading(false);

    if (result.success) {
      Alert.alert('Success', 'Account created successfully!');
      // Navigation is handled automatically by App.js based on auth state
    } else {
      Alert.alert(
        'Registration Failed',
        result.error ?? 'Unknown error occurred'
      );
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, dynamicStyles.container]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={[styles.title, dynamicStyles.title]}>Create Account</Text>
          <Text style={[styles.subtitle, dynamicStyles.subtitle]}>Sign up to get started</Text>
        </View>

        <View style={styles.form}>
          {/* Role Selection */}
          <View style={styles.roleContainer}>
            <Text style={[styles.label, dynamicStyles.label]}>I am a:</Text>
            <View style={styles.roleButtons}>
              <TouchableOpacity
                style={[
                  styles.roleButton,
                  dynamicStyles.roleButton,
                  role === 'customer' && dynamicStyles.roleButtonActive,
                ]}
                onPress={() => setRole('customer')}
              >
                <Text
                  style={[
                    styles.roleButtonText,
                    dynamicStyles.roleButtonText,
                    role === 'customer' && dynamicStyles.roleButtonTextActive,
                  ]}
                >
                  Customer
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.roleButton,
                  dynamicStyles.roleButton,
                  role === 'shopper' && dynamicStyles.roleButtonActive,
                ]}
                onPress={() => setRole('shopper')}
              >
                <Text
                  style={[
                    styles.roleButtonText,
                    dynamicStyles.roleButtonText,
                    role === 'shopper' && dynamicStyles.roleButtonTextActive,
                  ]}
                >
                  Shopper
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Name Fields */}
          <View style={styles.rowContainer}>
            <View style={[styles.inputContainer, styles.halfWidth]}>
              <Text style={[styles.label, dynamicStyles.label]}>First Name</Text>
              <TextInput
                style={[styles.input, dynamicStyles.input]}
                placeholder="John"
                placeholderTextColor={theme.custom.textDisabled}
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
              />
            </View>

            <View style={[styles.inputContainer, styles.halfWidthRight]}>
              <Text style={[styles.label, dynamicStyles.label]}>Last Name</Text>
              <TextInput
                style={[styles.input, dynamicStyles.input]}
                placeholder="Doe"
                placeholderTextColor={theme.custom.textDisabled}
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
              />
            </View>
          </View>

          {/* Email */}
          <View style={styles.inputContainer}>
            <Text style={[styles.label, dynamicStyles.label]}>Email</Text>
            <TextInput
              style={[styles.input, dynamicStyles.input]}
              placeholder="john.doe@example.com"
              placeholderTextColor={theme.custom.textDisabled}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>

          {/* Password */}
          <View style={styles.inputContainer}>
            <Text style={[styles.label, dynamicStyles.label]}>Password</Text>
            <TextInput
              style={[styles.input, dynamicStyles.input]}
              placeholder="At least 8 characters"
              placeholderTextColor={theme.custom.textDisabled}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          {/* Confirm Password */}
          <View style={styles.inputContainer}>
            <Text style={[styles.label, dynamicStyles.label]}>Confirm Password</Text>
            <TextInput
              style={[styles.input, dynamicStyles.input]}
              placeholder="Re-enter password"
              placeholderTextColor={theme.custom.textDisabled}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          {/* Register Button */}
          <TouchableOpacity
            style={[
              styles.registerButton,
              dynamicStyles.registerButton,
              localLoading && styles.buttonDisabled,
            ]}
            onPress={handleRegister}
            disabled={localLoading}
          >
            {localLoading ? (
              <ActivityIndicator color={theme.colors.onPrimary} />
            ) : (
              <Text style={[styles.registerButtonText, dynamicStyles.registerButtonText]}>Create Account</Text>
            )}
          </TouchableOpacity>

          {/* Login Link */}
          <View style={styles.loginContainer}>
            <Text style={[styles.loginText, dynamicStyles.loginText]}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={[styles.loginLink, dynamicStyles.loginLink]}>Sign In</Text>
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
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 20,
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
  roleContainer: {
    marginBottom: 20,
  },
  roleButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  roleButton: {
    flex: 1,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
  },
  roleButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  rowContainer: {
    flexDirection: 'row',
  },
  halfWidth: {
    flex: 1,
    marginRight: 10,
  },
  halfWidthRight: {
    flex: 1,
  },
  inputContainer: {
    marginBottom: 16,
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
  registerButton: {
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  registerButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginText: {
    fontSize: 14,
  },
  loginLink: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default RegisterScreen;
