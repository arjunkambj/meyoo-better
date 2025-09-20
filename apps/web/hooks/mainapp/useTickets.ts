import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache/hooks";

import { api } from "@/libs/convexApi";
import type { GenericId as Id } from "convex/values";

/**
 * Support Ticket Management Hooks
 */

// ============ TICKET QUERIES ============

// Mirror of returns from api.web.tickets.getUserTickets
type TicketListItem = {
  id: Id<"tickets">;
  type: string;
  subject: string;
  message: string;
  status: "open" | "in_progress" | "resolved" | "closed" | string;
  priority: "low" | "medium" | "high" | "urgent" | string;
  createdAt: number;
  updatedAt: number;
  resolvedAt?: number;
  responseCount: number;
};

/**
 * Get user's tickets
 */
export function useUserTickets(
  status?: "open" | "in_progress" | "resolved" | "closed",
  limit?: number
) {
  const tickets = useQuery(api.web.tickets.getUserTickets, {
    status,
    limit,
  });

  const loading = tickets === undefined;
  const error = tickets === null && !loading ? "Failed to load tickets" : null;

  return {
    tickets: (tickets as TicketListItem[] | null | undefined) || [],
    loading,
    error,
    hasTickets: (tickets && tickets.length > 0) ?? false,
    openCount:
      (tickets as TicketListItem[] | null | undefined)?.filter(
        (t: TicketListItem) => t.status === "open",
      ).length || 0,
    inProgressCount:
      (tickets as TicketListItem[] | null | undefined)?.filter(
        (t: TicketListItem) => t.status === "in_progress",
      ).length || 0,
    resolvedCount:
      (tickets as TicketListItem[] | null | undefined)?.filter(
        (t: TicketListItem) => t.status === "resolved",
      ).length || 0,
  };
}

/**
 * Get single ticket with responses
 */
export function useTicket(ticketId: Id<"tickets"> | undefined) {
  const ticket = useQuery(
    api.web.tickets.getTicket,
    ticketId ? { ticketId } : "skip"
  );

  const loading = ticket === undefined;
  const error =
    ticket === null && !loading ? "Ticket not found or access denied" : null;

  return {
    ticket,
    loading,
    error,
    hasResponses: (ticket?.responses && ticket.responses.length > 0) ?? false,
  };
}

/**
 * Get all tickets (admin only)
 */
export function useAllTickets(filters?: {
  status?: "open" | "in_progress" | "resolved" | "closed";
  priority?: "low" | "medium" | "high" | "urgent";
  limit?: number;
}) {
  // Admin-side list lives under meyoo namespace
  const tickets = useQuery(api.meyoo.tickets.getAllTickets, filters || {});

  const loading = tickets === undefined;
  const error =
    tickets === null && !loading
      ? "Failed to load tickets or access denied"
      : null;

  return {
    tickets: (tickets as TicketListItem[] | null | undefined) || [],
    loading,
    error,
    totalCount: tickets?.length || 0,
    openCount:
      (tickets as TicketListItem[] | null | undefined)?.filter(
        (t: TicketListItem) => t.status === "open",
      ).length || 0,
    inProgressCount:
      (tickets as TicketListItem[] | null | undefined)?.filter(
        (t: TicketListItem) => t.status === "in_progress",
      ).length || 0,
    highPriorityCount:
      (tickets as TicketListItem[] | null | undefined)?.filter(
        (t: TicketListItem) => t.priority === "high" || t.priority === "urgent",
      ).length || 0,
  };
}

// ============ TICKET MUTATIONS ============

/**
 * Create a new ticket
 */
export function useCreateTicket() {
  const createTicket = useMutation(api.web.tickets.createTicket);

  return {
    createTicket: async (data: {
      name: string;
      email: string;
      company?: string;
      type: "sales" | "support" | "partnership" | "feedback" | "other";
      subject: string;
      message: string;
    }) => {
      try {
        const result = await createTicket(data);

        return { success: true, ticketId: result.ticketId };
      } catch (error) {
        // Failed to create ticket

        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to create ticket",
        };
      }
    },
  };
}

/**
 * Add response to ticket
 */
export function useAddTicketResponse() {
  const addResponse = useMutation(api.web.tickets.addTicketResponse);

  return {
    addResponse: async (ticketId: Id<"tickets">, message: string) => {
      try {
        const result = await addResponse({ ticketId, message });

        return { success: true, responseId: result.responseId };
      } catch (error) {
        // Failed to add response

        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to add response",
        };
      }
    },
  };
}

/**
 * Update ticket status
 */
export function useUpdateTicketStatus() {
  // Admin-side status update lives under meyoo namespace
  const updateStatus = useMutation(api.meyoo.tickets.updateTicketStatus);

  return {
    updateStatus: async (
      ticketId: Id<"tickets">,
      status: "open" | "in_progress" | "resolved" | "closed"
    ) => {
      try {
        await updateStatus({ ticketId, status });

        return { success: true };
      } catch (error) {
        // Failed to update ticket status

        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to update status",
        };
      }
    },
  };
}

/**
 * Delete a ticket
 */
export function useDeleteTicket() {
  const deleteTicket = useMutation(api.web.tickets.deleteTicket);

  return {
    deleteTicket: async (ticketId: Id<"tickets">) => {
      try {
        await deleteTicket({ ticketId });

        return { success: true };
      } catch (error) {
        // Failed to delete ticket

        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to delete ticket",
        };
      }
    },
  };
}

// ============ COMBINED TICKET HOOK ============

/**
 * Combined ticket management hook
 */
export function useTickets() {
  const userTickets = useUserTickets();
  const { createTicket } = useCreateTicket();
  const { addResponse } = useAddTicketResponse();
  const { updateStatus } = useUpdateTicketStatus();
  const { deleteTicket } = useDeleteTicket();

  return {
    // Queries
    tickets: userTickets.tickets,
    loading: userTickets.loading,
    error: userTickets.error,

    // Stats
    stats: {
      total: userTickets.tickets.length,
      open: userTickets.openCount,
      inProgress: userTickets.inProgressCount,
      resolved: userTickets.resolvedCount,
    },

    // Mutations
    createTicket,
    addResponse,
    updateStatus,
    deleteTicket,

    // Utility functions
    getTicketById: (id: Id<"tickets">) => {
      return (userTickets.tickets as TicketListItem[]).find(
        (t: TicketListItem) => t.id === id,
      );
    },

    getOpenTickets: () => {
      return (userTickets.tickets as TicketListItem[]).filter(
        (t: TicketListItem) => t.status === "open",
      );
    },

    getRecentTickets: (limit = 5) => {
      return userTickets.tickets.slice(0, limit);
    },
  };
}

/**
 * Admin ticket management hook
 */
export function useAdminTickets() {
  const allTickets = useAllTickets();
  const { updateStatus } = useUpdateTicketStatus();

  return {
    // All tickets
    tickets: allTickets.tickets,
    loading: allTickets.loading,
    error: allTickets.error,

    // Statistics
    stats: {
      total: allTickets.totalCount,
      open: allTickets.openCount,
      inProgress: allTickets.inProgressCount,
      highPriority: allTickets.highPriorityCount,
    },

    // Actions
    updateStatus,

    // Filters
    getByStatus: (
      status: "open" | "in_progress" | "resolved" | "closed",
    ) => {
      return (allTickets.tickets as TicketListItem[]).filter(
        (t: TicketListItem) => t.status === status,
      );
    },

    getByPriority: (priority: "low" | "medium" | "high" | "urgent") => {
      return (allTickets.tickets as TicketListItem[]).filter(
        (t: TicketListItem) => t.priority === priority,
      );
    },

    getUrgentTickets: () => {
      return (allTickets.tickets as TicketListItem[]).filter(
        (t: TicketListItem) =>
          t.priority === "urgent" ||
          (t.priority === "high" && t.status === "open"),
      );
    },
  };
}
