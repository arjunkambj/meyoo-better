import { httpAction } from "../_generated/server";
import { internal } from "../_generated/api";

export const sendOtp = httpAction(async (ctx, request) => {
  try {
    const body = await request.json();
    const to = typeof body?.to === "string" ? body.to : undefined;
    const token = typeof body?.token === "string" ? body.token : undefined;

    if (!to || !token) {
      return new Response(
        JSON.stringify({ error: "Missing 'to' or 'token'" }),
        { status: 400 },
      );
    }

    await ctx.runMutation(internal.emails.send.sendOtpEmail, { to, token });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Failed to send" }),
      { status: 500 },
    );
  }
});
