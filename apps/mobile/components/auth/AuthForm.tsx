import { useAuthActions } from '@convex-dev/auth/react';
import { Button, ErrorView, TextField } from 'heroui-native';
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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1"
    >
      <View className="gap-6">
        {/* Social Auth Buttons */}
        <View className="gap-3">
          <GoogleAuthButton onSuccess={onSuccess} />
          <AppleAuthButton onSuccess={onSuccess} />
        </View>

        {/* Divider */}
        <AuthDivider />

        {/* Email/Password Form */}
        <View className="gap-4">
          <Text className="text-sm uppercase tracking-wide text-default-500">
            {isNewUser ? 'Create account with email' : 'Sign in with email'}
          </Text>

          {isNewUser && (
            <TextField isRequired>
              <TextField.Label>Name</TextField.Label>
              <TextField.Input
                autoCapitalize="words"
                onChangeText={setName}
                placeholder="John Doe"
                returnKeyType="next"
                value={name}
              >
                <TextField.InputStartContent>
                  <Ionicons name="person-outline" size={16} color="#999" />
                </TextField.InputStartContent>
              </TextField.Input>
            </TextField>
          )}

          <TextField isRequired>
            <TextField.Label>Email</TextField.Label>
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
                <Ionicons name="mail-outline" size={16} color="#999" />
              </TextField.InputStartContent>
            </TextField.Input>
          </TextField>

          <TextField isRequired>
            <TextField.Label>Password</TextField.Label>
            <TextField.Input
              autoCapitalize="none"
              onChangeText={setPassword}
              placeholder={isNewUser ? "Create a password" : "Enter password"}
              returnKeyType="done"
              secureTextEntry={!showPassword}
              value={password}
            >
              <TextField.InputStartContent>
                <Ionicons name="lock-closed-outline" size={16} color="#999" />
              </TextField.InputStartContent>
              <TextField.InputEndContent>
                <Button
                  isIconOnly
                  variant="ghost"
                  size="sm"
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={16}
                    color="#999"
                  />
                </Button>
              </TextField.InputEndContent>
            </TextField.Input>
            {isNewUser && (
              <TextField.Description>
                Must be at least 8 characters long
              </TextField.Description>
            )}
          </TextField>
        </View>

        {/* Submit Button */}
        <View className="gap-3">
          <Button
            className="h-12"
            variant="primary"
            isDisabled={isSubmitting}
            onPress={handleSubmit}
          >
            {isSubmitting
              ? (isNewUser ? 'Creating account...' : 'Signing in...')
              : (isNewUser ? 'Create Account' : 'Sign In')}
          </Button>

          {/* Toggle between signin/signup */}
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
              : "Don't have an account? Create one"}
          </Button>

          <Text className="text-xs text-default-400 text-center">
            By continuing you agree to the Terms of Service and Privacy Policy.
          </Text>
        </View>

        {/* Error Display */}
        <ErrorView isInvalid={Boolean(errorMessage)}>
          {errorMessage ?? ''}
        </ErrorView>
      </View>
    </KeyboardAvoidingView>
  );
}