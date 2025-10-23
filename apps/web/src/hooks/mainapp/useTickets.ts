import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { useMemo } from "react";

import { api } from "@/libs/convexApi";
import type { GenericId as Id } from "convex/values";

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

export function useUserTickets(
  status?: "open" | "in_progress" | "resolved" | "closed",
  limit?: number
) {
  const args = useMemo(() => ({ status, limit }), [status, limit]);
  const tickets = useQuery(api.web.tickets.getUserTickets, args);

  const loading = tickets === undefined;
  const error = tickets === null && !loading ? "Failed to load tickets" : null;

  const { list, openCount, inProgressCount, resolvedCount } = useMemo(() => {
    const list = (tickets as TicketListItem[] | null | undefined) || [];

    return list.reduce(
      (acc, ticket) => {
        switch (ticket.status) {
          case "open":
            acc.openCount += 1;
            break;
          case "in_progress":
            acc.inProgressCount += 1;
            break;
          case "resolved":
            acc.resolvedCount += 1;
            break;
          default:
            break;
        }

        acc.list.push(ticket);
        return acc;
      },
      {
        list: [] as TicketListItem[],
        openCount: 0,
        inProgressCount: 0,
        resolvedCount: 0,
      }
    );
  }, [tickets]);

  return {
    tickets: list,
    loading,
    error,
    hasTickets: list.length > 0,
    openCount,
    inProgressCount,
    resolvedCount,
  };
}

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

function useAddTicketResponse() {
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

function useUpdateTicketStatus() {
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
        (t: TicketListItem) => t.id === id
      );
    },

    getOpenTickets: () => {
      return (userTickets.tickets as TicketListItem[]).filter(
        (t: TicketListItem) => t.status === "open"
      );
    },

    getRecentTickets: (limit = 5) => {
      return userTickets.tickets.slice(0, limit);
    },
  };
}
