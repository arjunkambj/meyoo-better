import { useState } from "react";
import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import type { GenericId as Id } from "convex/values";
import { api } from "@/libs/convexApi";
import { addToast } from "@heroui/react";

export interface ApiKey {
  _id: Id<"apiKeys">;
  name: string;
  prefix: string;
  lastUsed?: number;
  usageCount: number;
  isActive: boolean;
  createdAt: number;
  revokedAt?: number;
}

export function useApiKeys() {
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState<Id<"apiKeys"> | null>(null);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<{
    key: string;
    name: string;
  } | null>(null);

  const apiKeys = useQuery(api.web.security.listApiKeys);

  const createApiKeyMutation = useMutation(api.web.security.createApiKey);
  const deleteApiKeyMutation = useMutation(api.web.security.deleteApiKey);
  const revokeApiKeyMutation = useMutation(api.web.security.revokeApiKey);

  const createApiKey = async (name: string) => {
    setIsCreating(true);
    try {
      const result = await createApiKeyMutation({ name });

      setNewlyCreatedKey({
        key: result.key,
        name,
      });

      addToast({
        title: "API key created successfully",
        description: "Copy this key now. It won’t be shown again.",
        color: "success",
      });

      return result;
    } catch (error) {
      addToast({
        title: "Failed to create API key",
        description: error instanceof Error ? error.message : "Unknown error",
        color: "danger",
      });
      throw error;
    } finally {
      setIsCreating(false);
    }
  };

  const deleteApiKey = async (id: Id<"apiKeys">) => {
    setIsDeleting(id);
    try {
      await deleteApiKeyMutation({ id });

      addToast({
        title: "API key deleted",
        description: "The API key has been permanently deleted.",
        color: "success",
      });
    } catch (error) {
      addToast({
        title: "Failed to delete API key",
        description: error instanceof Error ? error.message : "Unknown error",
        color: "danger",
      });
      throw error;
    } finally {
      setIsDeleting(null);
    }
  };

  const revokeApiKey = async (id: Id<"apiKeys">) => {
    try {
      await revokeApiKeyMutation({ id });

      addToast({
        title: "API key revoked",
        description: "The API key has been deactivated.",
        color: "success",
      });
    } catch (error) {
      addToast({
        title: "Failed to revoke API key",
        description: error instanceof Error ? error.message : "Unknown error",
        color: "danger",
      });
      throw error;
    }
  };

  const clearNewlyCreatedKey = () => {
    setNewlyCreatedKey(null);
  };

  return {
    apiKeys: apiKeys || [],
    isLoading: apiKeys === undefined,
    isCreating,
    isDeleting,
    newlyCreatedKey,
    createApiKey,
    deleteApiKey,
    revokeApiKey,
    clearNewlyCreatedKey,
  };
}
