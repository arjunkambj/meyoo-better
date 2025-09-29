import { useAuthActions } from '@convex-dev/auth/react';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Button, useTheme } from 'heroui-native';
import { useState } from 'react';
import { Alert, Platform, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface AppleAuthButtonProps {
  onSuccess?: () => void;
  text?: string;
}

export function AppleAuthButton({
  onSuccess,
  text = 'Continue with Apple'
}: AppleAuthButtonProps) {
  const { signIn } = useAuthActions();
  const { colors } = useTheme();
  const [isLoading, setIsLoading] = useState(false);

  // Check if Apple Auth is available (iOS only)
  const [isAvailable, setIsAvailable] = useState(false);

  useState(() => {
    if (Platform.OS === 'ios') {
      AppleAuthentication.isAvailableAsync().then(setIsAvailable);
    }
  });

  if (!isAvailable) {
    return null;
  }

  const handleAppleSignIn = async () => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      // Sign in with Convex using the Apple credential
      const formData = new FormData();
      formData.append('idToken', credential.identityToken || '');
      formData.append('email', credential.email || '');
      if (credential.fullName) {
        const name = `${credential.fullName.givenName || ''} ${credential.fullName.familyName || ''}`.trim();
        if (name) formData.append('name', name);
      }

      await signIn('apple', formData);
      onSuccess?.();
    } catch (error: any) {
      if (error.code === 'ERR_REQUEST_CANCELED') {
        // User canceled the sign-in, do nothing
      } else {
        const message = error instanceof Error ? error.message : 'Apple sign-in failed';
        Alert.alert('Sign In Failed', message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="secondary"
      size="lg"
      isDisabled={isLoading}
      onPress={handleAppleSignIn}
      className="h-12 bg-foreground border border-foreground"
    >
      <Button.StartContent>
        <View className="w-5 h-5 items-center justify-center">
          <Ionicons name="logo-apple" size={20} color={colors.background} />
        </View>
      </Button.StartContent>
      <Button.LabelContent classNames={{ text: 'text-background' }}>
        {text}
      </Button.LabelContent>
    </Button>
  );
}