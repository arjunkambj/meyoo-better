import { useAuthActions } from "@convex-dev/auth/react";
import { Button, useTheme } from "heroui-native";
import { useEffect, useMemo, useState } from "react";
import { Platform, View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import Svg, { Path } from "react-native-svg";

WebBrowser.maybeCompleteAuthSession();

interface AuthBottomProps {
  onSuccess?: () => void;
}

function GoogleLogo() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <Path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <Path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <Path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </Svg>
  );
}

export function AuthBottom({ onSuccess }: AuthBottomProps) {
  const { signIn } = useAuthActions();
  const { colors } = useTheme();
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [isLoadingApple, setIsLoadingApple] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS === "ios") {
      // Defer import to avoid requiring expo-apple-authentication on Android
      import("expo-apple-authentication")
        .then((AppleAuth) => AppleAuth.isAvailableAsync())
        .then(setAppleAvailable)
        .catch(() => setAppleAvailable(false));
    }
  }, []);

  const handleGoogleLogin = async () => {
    if (isLoadingGoogle) return;

    setIsLoadingGoogle(true);

    // Open popup immediately to avoid popup blockers
    signIn("google", { redirectTo: "/(tabs)/overview" }).catch((error) => {
      setIsLoadingGoogle(false);
    });
  };

  const handleAppleSignIn = async () => {
    if (isLoadingApple) return;
    setIsLoadingApple(true);
    console.log("Apple sign in");
    setIsLoadingApple(false);
  };

  const appleIconColor = useMemo(() => colors.background ?? "#fff", [colors]);

  return (
    <View className="gap-6">
      <View className="gap-3">
        <Button
          variant="secondary"
          size="lg"
          isDisabled={isLoadingGoogle}
          onPress={handleGoogleLogin}
          className="h-12 bg-surface-3 border border-border"
        >
          <Button.StartContent>
            <View className="w-5 h-5 items-center justify-center">
              <GoogleLogo />
            </View>
          </Button.StartContent>
          <Button.LabelContent classNames={{ text: "font-medium" }}>
            Continue with Google
          </Button.LabelContent>
        </Button>

        {appleAvailable ? (
          <Button
            variant="secondary"
            size="lg"
            isDisabled={isLoadingApple}
            onPress={handleAppleSignIn}
            className="h-12 bg-foreground border border-foreground"
          >
            <Button.StartContent>
              <View className="w-5 h-5 items-center justify-center">
                <Ionicons name="logo-apple" size={20} color={appleIconColor} />
              </View>
            </Button.StartContent>
            <Button.LabelContent classNames={{ text: "text-background" }}>
              Continue with Apple
            </Button.LabelContent>
          </Button>
        ) : null}
      </View>

      <Text className="text-xs text-center text-default-400 mt-1">
        By continuing you agree to the Terms of Service and Privacy Policy.
      </Text>
    </View>
  );
}
