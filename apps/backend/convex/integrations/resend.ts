import { components } from "../_generated/api";
import { Resend } from "@convex-dev/resend";
import { requireEnv } from "../utils/env";

const RESEND_API_KEY = requireEnv("RESEND_API_KEY");

export const resend: Resend = new Resend(components.resend, {
  apiKey: RESEND_API_KEY,
  testMode: false,
});
