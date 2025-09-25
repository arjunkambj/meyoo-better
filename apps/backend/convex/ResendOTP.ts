import { Email } from "@convex-dev/auth/providers/Email";
import { generateRandomString, type RandomReader } from "@oslojs/crypto/random";
import { requireEnv } from "./utils/env";
// Switched from raw Resend SDK to Convex Resend Component via HTTP endpoint

const AUTH_RESEND_KEY = requireEnv("AUTH_RESEND_KEY");
const NEXT_PUBLIC_CONVEX_URL = requireEnv("CONVEX_SITE_URL");

export const ResendOTP = Email({
  id: "resend-otp",
  apiKey: AUTH_RESEND_KEY,
  maxAge: 60 * 10, // 10 minutes for OTP
  async generateVerificationToken() {
    const random: RandomReader = {
      read(bytes) {
        crypto.getRandomValues(bytes);
      },
    };

    const alphabet = "0123456789";
    const length = 6; // 6-digit code to match our input field

    return generateRandomString(random, alphabet, length);
  },
  async sendVerificationRequest({ identifier: email, token }) {
    const res = await fetch(`${NEXT_PUBLIC_CONVEX_URL}/emails/send-otp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ to: email, token }),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "Failed to send OTP");
      throw new Error(`OTP email failed: ${res.status} ${msg}`);
    }
  },
});
