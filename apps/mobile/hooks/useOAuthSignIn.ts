import { useCallback, useState } from "react";
import { Platform } from "react-native";
import { makeRedirectUri } from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";

WebBrowser.maybeCompleteAuthSession();

import { useAuthActions } from "@convex-dev/auth/react";

type OAuthProvider = "google" | "apple";

type State = {
  loadingProvider: OAuthProvider | null;
  error: string | null;
};

export function useOAuthSignIn() {
  const { signIn } = useAuthActions();
  const [{ loadingProvider, error }, setState] = useState<State>({
    loadingProvider: null,
    error: null,
  });

  const runOAuthFlow = useCallback(
    async (provider: OAuthProvider) => {
      setState({ loadingProvider: provider, error: null });
      try {
        const redirectTo = makeRedirectUri();
        const result = await signIn(provider, { redirectTo });
        const redirect = result.redirect?.toString();

        if (Platform.OS === "web") {
          setState({ loadingProvider: null, error: null });
          return;
        }

        if (!redirect) {
          throw new Error("Unable to start authentication flow.");
        }

        const authResult = await WebBrowser.openAuthSessionAsync(redirect, redirectTo);

        if (authResult.type === "success") {
          const url = new URL(authResult.url);
          const code = url.searchParams.get("code");
          if (!code) {
            throw new Error("Missing authorization code.");
          }
          await signIn(provider, { code });
        } else if (authResult.type === "cancel") {
          throw new Error("Sign in was cancelled.");
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to sign in. Please try again.";
        setState({ loadingProvider: null, error: message });
        return;
      }
      setState({ loadingProvider: null, error: null });
    },
    [signIn],
  );

  const signInWithGoogle = useCallback(() => runOAuthFlow("google"), [runOAuthFlow]);
  const signInWithApple = useCallback(() => runOAuthFlow("apple"), [runOAuthFlow]);

  return {
    signInWithGoogle,
    signInWithApple,
    loadingProvider,
    error,
  };
}
