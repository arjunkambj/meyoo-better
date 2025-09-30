import { useAuthActions } from '@convex-dev/auth/react';
import { Button, ErrorView, TextField, useTheme } from 'heroui-native';
import { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, Alert } from 'react-native';
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async () => {
    // Validation
    if (!email.trim() || !password.trim()) {
      setErrorMessage('Enter your email address and password to continue.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append('email', email.trim().toLowerCase());
      formData.append('password', password);
      formData.append('flow', 'signIn');

      await signIn('password', formData);
      onSuccess?.();
    } catch (error: unknown) {
      const errorMessageText =
        error instanceof Error ? error.message ?? '' : '';
      setErrorMessage('Could not sign you in. Please check your credentials.');
      Alert.alert('Something went wrong', 'Please try again in a moment.');
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

       <View className="gap-4">
          <Text className="text-[11px] font-semibold text-center uppercase my-3 tracking-[0.25em] text-default-500">
            Email & password
          </Text>

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
              placeholder="Enter password"
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
          </TextField>
        </View>

        <Button
            className="h-12"
            variant="primary"
            isDisabled={isSubmitting}
            onPress={handleSubmit}
          >
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </Button>
        <AuthDivider />
        <View className="gap-3">
          <View className="gap-3">
            <GoogleAuthButton onSuccess={onSuccess} />
            <AppleAuthButton onSuccess={onSuccess} />
          </View>
        </View>

        <View className="gap-3 mt-1">
         

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
