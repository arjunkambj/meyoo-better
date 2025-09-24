import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { resend } from "../integrations/resend";

export const sendOtpEmail = internalMutation({
  args: {
    to: v.string(),
    token: v.string(),
  },
  handler: async (ctx, { to, token }) => {
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Sign in to Meyoo</h2>
        <p>Your verification code is:</p>
        <div style="background: #f5f5f5; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 20px 0;">
          ${token}
        </div>
        <p style="color: #666; font-size: 14px;">This code will expire in 10 minutes.</p>
        <p style="color: #666; font-size: 14px;">If you didn't request this code, you can safely ignore this email.</p>
      </div>
    `;
    await resend.sendEmail(ctx, {
      from: "Meyoo <noreply@mail.meyoo.io>",
      to,
      subject: "Your Meyoo verification code",
      html,
      text: `Your Meyoo verification code is: ${token}\n\nThis code will expire in 10 minutes.`,
    });
  },
});
