import { useAction } from "convex/react";
import { useEffect, useState } from "react";

import { api } from "@/libs/convexApi";

export function usePassword() {
  const [hasPassword, setHasPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const hasPasswordAction = useAction(api.core.users.hasPasswordAccount);
  const changePasswordAction = useAction(api.core.users.changePassword);

  useEffect(() => {
    const checkPassword = async () => {
      try {
        const result = await hasPasswordAction();

        setHasPassword(result);
      } catch (error) {
        console.error("Failed to check password status:", error);
        setHasPassword(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkPassword();
  }, [hasPasswordAction]);

  const changePassword = async (
    currentPassword?: string,
    newPassword?: string,
  ): Promise<{ success: boolean; message: string }> => {
    if (!newPassword) {
      throw new Error("New password is required");
    }

    const result = await changePasswordAction({
      currentPassword,
      newPassword,
    });

    if (!result.success) {
      throw new Error(result.message || "Failed to change password");
    }

    // Update hasPassword state after successful password change
    setHasPassword(true);

    return result;
  };

  return {
    hasPassword,
    isLoading,
    changePassword,
  };
}