import { useAuthActions } from '@convex-dev/auth/react';
import { Button } from 'heroui-native';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';

WebBrowser.maybeCompleteAuthSession();

interface GoogleAuthButtonProps {
  onSuccess?: () => void;
  text?: string;
}

export function GoogleAuthButton({
  onSuccess,
  text = 'Continue with Google'
}: GoogleAuthButtonProps) {
  const { signIn } = useAuthActions();
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      await signIn('google');
      onSuccess?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Google sign-in failed';
      Alert.alert('Sign In Failed', message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="secondary"
      size="lg"
      isDisabled={isLoading}
      onPress={handleGoogleSignIn}
      className="h-12"
    >
      <Button.StartContent>
        <View className="w-5 h-5 items-center justify-center">
          <Ionicons name="logo-google" size={18} color="#4285F4" />
        </View>
      </Button.StartContent>
      <Button.LabelContent>{text}</Button.LabelContent>
    </Button>
  );
}