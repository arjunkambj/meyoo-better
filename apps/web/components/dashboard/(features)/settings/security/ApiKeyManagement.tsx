"use client";

import { Button, Card, CardBody, CardHeader, Skeleton } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState } from "react";
import type { GenericId as Id } from "convex/values";
import { useApiKeys } from "@/hooks/useApiKeys";
import ApiKeyTable from "./ApiKeyTable";
import CreateApiKeyModal from "./CreateApiKeyModal";
import ApiKeyDisplayModal from "./ApiKeyDisplayModal";
import DeleteApiKeyModal from "./DeleteApiKeyModal";

export default function ApiKeyManagement() {
  const {
    apiKeys,
    isLoading,
    isCreating,
    isDeleting,
    newlyCreatedKey,
    createApiKey,
    deleteApiKey,
    clearNewlyCreatedKey,
  } = useApiKeys();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteModalState, setDeleteModalState] = useState<{
    isOpen: boolean;
    keyId: Id<"apiKeys"> | null;
    keyName: string;
  }>({
    isOpen: false,
    keyId: null,
    keyName: "",
  });

  const handleCreate = async (name: string) => {
    await createApiKey(name);
    setShowCreateModal(false);
  };

  const handleDeleteClick = (id: Id<"apiKeys">, name: string) => {
    setDeleteModalState({
      isOpen: true,
      keyId: id,
      keyName: name,
    });
  };

  const handleDeleteConfirm = async () => {
    if (deleteModalState.keyId) {
      await deleteApiKey(deleteModalState.keyId);
      setDeleteModalState({
        isOpen: false,
        keyId: null,
        keyName: "",
      });
    }
  };

  const handleCloseDeleteModal = () => {
    if (!isDeleting) {
      setDeleteModalState({
        isOpen: false,
        keyId: null,
        keyName: "",
      });
    }
  };

  return (
    <>
      <Card className="rounded-2xl border border-default-100 shadow-none bg-content2 dark:bg-content1">
        <CardHeader className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon icon="solar:key-bold" width={20} />
            <h3 className="text-lg font-semibold text-default-800">API Keys</h3>
          </div>
          <Button
            color="primary"
            startContent={<Icon icon="solar:add-circle-bold" width={18} />}
            onPress={() => setShowCreateModal(true)}
          >
            Generate New Key
          </Button>
        </CardHeader>
        <CardBody className="px-5 py-5">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>
          ) : (
            <ApiKeyTable
              apiKeys={apiKeys}
              onDelete={handleDeleteClick}
              deletingId={isDeleting}
            />
          )}
        </CardBody>
      </Card>

      {/* Create Modal */}
      <CreateApiKeyModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreate}
        isCreating={isCreating}
      />

      {/* Display New Key Modal */}
      {newlyCreatedKey && (
        <ApiKeyDisplayModal
          isOpen={true}
          onClose={clearNewlyCreatedKey}
          apiKey={newlyCreatedKey.key}
          keyName={newlyCreatedKey.name}
        />
      )}

      {/* Delete Confirmation Modal */}
      <DeleteApiKeyModal
        isOpen={deleteModalState.isOpen}
        onClose={handleCloseDeleteModal}
        onConfirm={handleDeleteConfirm}
        keyName={deleteModalState.keyName}
        isDeleting={isDeleting === deleteModalState.keyId}
      />
    </>
  );
}
