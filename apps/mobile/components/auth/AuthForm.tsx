import { useAuthActions } from '@convex-dev/auth/react';
import { Button, ErrorView, TextField, useTheme } from 'heroui-native';
import { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GoogleAuthButton } from './GoogleAuthButton';
import { AppleAuthButton } from './AppleAuthButton';
import { AuthDivider } from './AuthDivider';

interface AuthFormProps {
  onSuccess?: () => void;
}

export function AuthForm({ onSuccess }: AuthFormProps) {
  const { signIn } = useAuthActions();
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isNewUser, setIsNewUser] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async () => {
    // Validation
    if (!email.trim() || !password.trim()) {
      setErrorMessage('Enter your email address and password to continue.');
      return;
    }

    if (isNewUser && !name.trim()) {
      setErrorMessage('Please enter your name to create an account.');
      return;
    }

    if (isNewUser && password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append('email', email.trim().toLowerCase());
      formData.append('password', password);
      formData.append('flow', isNewUser ? 'signUp' : 'signIn');

      if (isNewUser) {
        formData.append('name', name.trim());
      }

      await signIn('password', formData);
      onSuccess?.();
    } catch (error: any) {
      // Check if it's a user not found error to suggest signup
      if (error.message?.includes('Invalid email or password') && !isNewUser) {
        setErrorMessage('No account found. Create a new account to continue.');
        setIsNewUser(true);
      } else {
        const fallback = isNewUser
          ? 'Could not create account. Please try again.'
          : 'Could not sign you in. Please check your credentials.';
        setErrorMessage(error.message || fallback);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const iconColor = colors.defaultForeground ?? colors.default ?? '#999999';
  const accentTint = colors.accent ?? '#6366f1';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1"
    >
      <View className="gap-7">
        <View className="gap-3">
          <Text className="text-[11px] font-semibold uppercase tracking-[0.25em] text-default-500">
            Quick start
          </Text>
          <View className="gap-3">
            <GoogleAuthButton onSuccess={onSuccess} />
            <AppleAuthButton onSuccess={onSuccess} />
          </View>
        </View>

        <AuthDivider />

        <View className="gap-4">
          <Text className="text-[11px] font-semibold uppercase tracking-[0.25em] text-default-500">
            {isNewUser ? 'Create account' : 'Email & password'}
          </Text>

          {isNewUser ? (
            <TextField isRequired>
              <TextField.Label>Full name</TextField.Label>
              <TextField.Input
                autoCapitalize="words"
                onChangeText={setName}
                placeholder="Jordan Meyers"
                returnKeyType="next"
                value={name}
              >
                <TextField.InputStartContent>
                  <Ionicons name="person-outline" size={18} color={iconColor} />
                </TextField.InputStartContent>
              </TextField.Input>
            </TextField>
          ) : null}

          <TextField isRequired>
            <TextField.Label>Email address</TextField.Label>
            <TextField.Input
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="you@example.com"
              returnKeyType="next"
              value={email}
            >
              <TextField.InputStartContent>
                <Ionicons name="mail-outline" size={18} color={iconColor} />
              </TextField.InputStartContent>
            </TextField.Input>
          </TextField>

          <TextField isRequired>
            <TextField.Label>Password</TextField.Label>
            <TextField.Input
              autoCapitalize="none"
              onChangeText={setPassword}
              placeholder={isNewUser ? 'Create a password' : 'Enter password'}
              returnKeyType="done"
              secureTextEntry={!showPassword}
              value={password}
            >
              <TextField.InputStartContent>
                <Ionicons name="lock-closed-outline" size={18} color={iconColor} />
              </TextField.InputStartContent>
              <TextField.InputEndContent>
                <Button
                  isIconOnly
                  variant="ghost"
                  size="sm"
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={accentTint}
                  />
                </Button>
              </TextField.InputEndContent>
            </TextField.Input>
            {isNewUser ? (
              <TextField.Description>
                Use at least 8 characters with a number or symbol.
              </TextField.Description>
            ) : null}
          </TextField>
        </View>

        <View className="gap-3 mt-1">
          <Button
            className="h-12"
            variant="primary"
            isDisabled={isSubmitting}
            onPress={handleSubmit}
          >
            {isSubmitting
              ? isNewUser
                ? 'Creating account...'
                : 'Signing in...'
              : isNewUser
                ? 'Create account'
                : 'Sign in'}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onPress={() => {
              setIsNewUser(!isNewUser);
              setErrorMessage(null);
            }}
          >
            {isNewUser
              ? 'Already have an account? Sign in'
              : "Need an account? Create one"}
          </Button>

          <Text className="text-xs text-center text-default-400 mt-1">
            By continuing you agree to the Terms of Service and Privacy Policy.
          </Text>
        </View>

        {errorMessage ? (
          <ErrorView isInvalid={true}>{errorMessage}</ErrorView>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}
