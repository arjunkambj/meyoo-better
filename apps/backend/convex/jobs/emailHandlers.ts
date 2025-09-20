import { Resend } from "@convex-dev/resend";
import { v } from "convex/values";
import { components } from "../_generated/api";
import { internalAction } from "../_generated/server";

// Initialize Resend component
const resend = new Resend(components.resend);

/**
 * Handle email send
 */
export const handleEmailSend = internalAction({
  args: {
    to: v.string(),
    subject: v.string(),
    body: v.string(),
    template: v.optional(v.string()),
    data: v.optional(v.any()),
  },
  handler: async (ctx, args) => {

    try {
      await resend.sendEmail(ctx, {
        from: "Meyoo <team@meyoo.app>",
        to: args.to,
        subject: args.subject,
        html: args.body,
      });

      return { success: true };
    } catch (error) {
      console.error(`[Email] Failed to send email:`, error);
      throw new Error("Failed to send email");
    }
  },
});

/**
 * Send invitation email to new team member
 */
export const sendInvitationEmail = internalAction({
  args: {
    to: v.string(),
    inviterName: v.string(),
    organizationName: v.string(),
    invitationUrl: v.string(),
  },
  handler: async (ctx, args) => {

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>You're invited to join ${args.organizationName} on Meyoo</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to Meyoo!</h1>
          </div>
          
          <div style="background: white; padding: 30px; border: 1px solid #e1e4e8; border-top: none; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333; margin-top: 0;">You're invited to join ${args.organizationName}</h2>
            
            <p style="font-size: 16px; color: #666;">
              Hi there!
            </p>
            
            <p style="font-size: 16px; color: #666;">
              ${args.inviterName} has invited you to join their team on Meyoo, the profit intelligence platform for ecommerce brands.
            </p>
            
            <p style="font-size: 16px; color: #666;">
              As a team member, you'll have access to:
            </p>
            
            <ul style="font-size: 16px; color: #666;">
              <li>Real-time analytics and insights</li>
              <li>P&L, customer, inventory, and order analytics</li>
              <li>Multi-channel performance tracking</li>
              <li>Collaborative team features</li>
            </ul>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${args.invitationUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">
                Accept Invitation
              </a>
            </div>
            
            <p style="font-size: 14px; color: #999; text-align: center;">
              This invitation will expire in 7 days. If you have any questions, please contact the person who invited you.
            </p>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
            <p>
              © ${new Date().getFullYear()} Meyoo. All rights reserved.
            </p>
            <p>
              <a href="https://meyoo.app" style="color: #667eea; text-decoration: none;">meyoo.app</a>
            </p>
          </div>
        </body>
      </html>
    `;

    try {
      await resend.sendEmail(ctx, {
        from: "Meyoo <team@meyoo.app>",
        to: args.to,
        subject: `You're invited to join ${args.organizationName} on Meyoo`,
        html: emailHtml,
      });

      // production: avoid logging recipient addresses

      return { success: true };
    } catch (error) {
      console.error(`[Email] Failed to send invitation email:`, error);
      throw new Error("Failed to send invitation email");
    }
  },
});
