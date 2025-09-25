import { useConvexAuth } from "convex/react";

export function useAuthStatus() {
  const auth = useConvexAuth();
  return {
    isLoading: auth.isLoading,
    isAuthenticated: auth.isAuthenticated,
  };
}
