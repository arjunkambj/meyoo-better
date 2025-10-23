import { useMutation } from "convex/react";
import { api } from "@/libs/convexApi";

type CreateRequestArgs = {
  platformName: string;
  description: string;
};

export function useCreateIntegrationRequest() {
  const mutate = useMutation(api.web.integrationRequests.createRequest);

  return {
    createRequest: async (args: CreateRequestArgs) => {
      try {
        const res = await mutate(args);
        return { success: true, requestId: res.requestId };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}

