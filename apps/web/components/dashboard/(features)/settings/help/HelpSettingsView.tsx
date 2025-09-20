"use client";
import {
  Button,
  Card,
  CardBody,
  Chip,
  Divider,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  useDisclosure,
  addToast,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useCallback, useState } from "react";
import type { GenericId as Id } from "convex/values";
import { useDeleteTicket, useUserTickets } from "@/hooks";

import ContactSupport from "./ContactSupport";

export default function HelpSettingsView() {
  const userTickets = useUserTickets();
  const tickets = userTickets.tickets;
  const loading = userTickets.loading;
  const stats = {
    open: userTickets.openCount,
    inProgress: userTickets.inProgressCount,
    resolved: userTickets.resolvedCount,
  };

  const { deleteTicket } = useDeleteTicket();
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [ticketToDelete, setTicketToDelete] = useState<{
    _id: Id<"tickets">;
    subject: string;
    status: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case "open":
        return "warning";
      case "in_progress":
        return "primary";
      case "resolved":
        return "success";
      case "closed":
        return "default";
      default:
        return "default";
    }
  }, []);

  const getStatusIcon = useCallback((status: string) => {
    switch (status) {
      case "open":
        return "solar:clock-circle-bold";
      case "in_progress":
        return "solar:refresh-circle-bold";
      case "resolved":
        return "solar:check-circle-bold";
      case "closed":
        return "solar:close-circle-bold";
      default:
        return "solar:question-circle-bold";
    }
  }, []);

  const formatDate = useCallback((timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      if (diffInHours < 1) {
        const minutes = Math.floor(diffInHours * 60);

        return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
      }
      const hours = Math.floor(diffInHours);

      return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
    } else if (diffInHours < 48) {
      return "Yesterday";
    } else if (diffInHours < 168) {
      const days = Math.floor(diffInHours / 24);

      return `${days} days ago`;
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
      });
    }
  }, []);

  const handleDeleteClick = useCallback(
    (ticket: { _id: Id<"tickets">; subject: string; status: string }) => {
      setTicketToDelete(ticket);
      onOpen();
    },
    [onOpen]
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!ticketToDelete) return;

    setIsDeleting(true);
    try {
      const result = await deleteTicket(ticketToDelete._id);

      if (result.success) {
        addToast({
          title: "Ticket deleted",
          description: "Ticket deleted successfully",
          color: "success",
        });
        onOpenChange();
        // The ticket list will automatically update via Convex real-time sync
      } else {
        addToast({
          title: result.error || "Failed to delete ticket",
          color: "danger",
        });
      }
    } catch (_error) {
      addToast({
        title: "An error occurred while deleting the ticket",
        color: "danger",
      });
    } finally {
      setIsDeleting(false);
      setTicketToDelete(null);
    }
  }, [ticketToDelete, deleteTicket, onOpenChange]);

  return (
    <div className="space-y-6 pb-8">
      {/* Previous Tickets */}
      {tickets && tickets.length > 0 && (
        <Card className="bg-content2 dark:bg-content1 rounded-xl border border-default-200/50 shadow-none">
          <CardBody className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-foreground">
                Your Support Tickets
              </h3>
              {stats && (
                <div className="flex items-center gap-2">
                  {stats.open > 0 && (
                    <Chip color="warning" size="sm" variant="flat">
                      {stats.open} Open
                    </Chip>
                  )}
                  {stats.inProgress > 0 && (
                    <Chip color="primary" size="sm" variant="flat">
                      {stats.inProgress} In Progress
                    </Chip>
                  )}
                </div>
              )}
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Icon
                  className="animate-spin text-primary"
                  icon="solar:refresh-circle-bold-duotone"
                  width={32}
                />
              </div>
            ) : (
              <div className="space-y-3">
                {tickets
                  .slice(0, 5)
                  .map(
                    (ticket: {
                      id: Id<"tickets">;
                      subject: string;
                      message: string;
                      status: string;
                      createdAt: number;
                      responseCount: number;
                    }) => (
                      <div
                        key={ticket.id}
                        className="group flex items-start gap-3 p-3 rounded-lg bg-content1 border border-divider"
                      >
                        <Icon
                          className={`text-${getStatusColor(ticket.status)} mt-0.5`}
                          icon={getStatusIcon(ticket.status)}
                          width={20}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-foreground truncate">
                                {ticket.subject}
                              </p>
                              <p className="text-xs text-default-500 line-clamp-2 mt-1">
                                {ticket.message}
                              </p>
                            </div>
                            <div className="flex items-start gap-2">
                              <div className="flex flex-col items-end gap-1">
                                <Chip
                                  classNames={{
                                    base: "capitalize",
                                  }}
                                  color={getStatusColor(ticket.status)}
                                  size="sm"
                                  variant="flat"
                                >
                                  {ticket.status.replace("_", " ")}
                                </Chip>
                                <span className="text-xs text-default-400">
                                  {formatDate(ticket.createdAt)}
                                </span>
                              </div>
                              <Button
                                isIconOnly
                                size="sm"
                                variant="flat"
                                onPress={() =>
                                  handleDeleteClick({
                                    _id: ticket.id,
                                    subject: ticket.subject,
                                    status: ticket.status,
                                  })
                                }
                              >
                                <Icon
                                  icon="solar:trash-bin-trash-bold"
                                  className="text-danger"
                                  width={20}
                                />
                              </Button>
                            </div>
                          </div>
                          {ticket.responseCount > 0 && (
                            <div className="flex items-center gap-1 mt-2">
                              <Icon
                                className="text-default-400"
                                icon="solar:chat-square-bold"
                                width={14}
                              />
                              <span className="text-xs text-default-500">
                                {ticket.responseCount} response
                                {ticket.responseCount !== 1 ? "s" : ""}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  )}

                {tickets.length > 5 && (
                  <div className="pt-2">
                    <Button
                      className="w-full"
                      color="primary"
                      size="sm"
                      startContent={
                        <Icon
                          icon="solar:archive-minimalistic-bold"
                          width={16}
                        />
                      }
                      variant="flat"
                    >
                      View All {tickets.length} Tickets
                    </Button>
                  </div>
                )}
              </div>
            )}

            {tickets && tickets.length === 0 && !loading && (
              <div className="text-center py-6">
                <Icon
                  className="text-default-300 mx-auto mb-3"
                  icon="solar:inbox-unread-bold-duotone"
                  width={48}
                />
                <p className="text-sm text-default-500">
                  No support tickets yet
                </p>
                <p className="text-xs text-default-400 mt-1">
                  Submit a ticket below if you need help
                </p>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      <ContactSupport />

      <Modal
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        className="bg-default-50"
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                Are You Sure?
              </ModalHeader>
              <ModalBody>
                {ticketToDelete && (
                  <div className="p-3 bg-content3 rounded-lg mt-2">
                    <p className="text-sm font-medium text-foreground">
                      {ticketToDelete.subject}
                    </p>
                    <p className="text-xs text-default-700 mt-1">
                      Status: {ticketToDelete.status.replace("_", " ")}
                    </p>
                  </div>
                )}
              </ModalBody>
              <ModalFooter>
                <Button
                  color="default"
                  isDisabled={isDeleting}
                  variant="flat"
                  onPress={onClose}
                >
                  Cancel
                </Button>
                <Button
                  color="danger"
                  isLoading={isDeleting}
                  startContent={
                    !isDeleting && (
                      <Icon icon="solar:trash-bin-trash-bold" width={16} />
                    )
                  }
                  onPress={handleDeleteConfirm}
                >
                  Delete Ticket
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
