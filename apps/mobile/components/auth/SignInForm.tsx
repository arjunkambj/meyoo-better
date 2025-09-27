import { useAuthActions } from '@convex-dev/auth/react';
import { Button, Checkbox, ErrorView, FormField, TextField } from 'heroui-native';
import { useState } from 'react';
import { View, Text } from 'react-native';

interface SignInFormProps {
  onSuccess?: () => void;
}

export function SignInForm({ onSuccess }: SignInFormProps) {
  const { signIn } = useAuthActions();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberDevice, setRememberDevice] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      setErrorMessage('Enter your email address and password to continue.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await signIn('password', {
        email: email.trim().toLowerCase(),
        password,
        flow: 'signIn',
      });
      onSuccess?.();
    } catch (error) {
      const fallback = 'We could not sign you in. Double-check your credentials and try again.';
      if (error instanceof Error) {
        setErrorMessage(error.message || fallback);
      } else {
        setErrorMessage(fallback);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View className="gap-6">
      <View className="gap-4">
        <Text className="text-sm uppercase tracking-wide text-default-500">
          Sign in with email
        </Text>

        <TextField>
          <TextField.Label>Email</TextField.Label>
          <TextField.Input
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="you@example.com"
            returnKeyType="next"
            value={email}
          />
        </TextField>

        <TextField>
          <TextField.Label>Password</TextField.Label>
          <TextField.Input
            autoCapitalize="none"
            onChangeText={setPassword}
            placeholder="Enter password"
            returnKeyType="done"
            secureTextEntry
            value={password}
          />
          <TextField.Description>
            Use the password you created for Meyoo web.
          </TextField.Description>
        </TextField>
      </View>

      <FormField
        isSelected={rememberDevice}
        onSelectedChange={setRememberDevice}
        className="rounded-2xl bg-transparent"
      >
        <FormField.Content>
          <FormField.Title>Keep me signed in</FormField.Title>
          <FormField.Description>
            We’ll keep your session active on this device.
          </FormField.Description>
        </FormField.Content>
        <FormField.Indicator>
          <Checkbox
            color="default"
            isSelected={rememberDevice}
            onSelectedChange={setRememberDevice}
          />
        </FormField.Indicator>
      </FormField>

      <View className="gap-3">
        <Button
          className="h-12"
          variant="primary"
          isDisabled={isSubmitting}
          onPress={handleSubmit}
        >
          {isSubmitting ? 'Signing in...' : 'Continue'}
        </Button>

        <Text className="text-xs text-default-400">
          By continuing you agree to the Meyoo Terms of Service and Privacy Policy.
        </Text>
      </View>

      <ErrorView isInvalid={Boolean(errorMessage)}>
        {errorMessage ?? ''}
      </ErrorView>
    </View>
  );
}
