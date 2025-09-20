import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { NextResponse } from "next/server";

import { api } from "@/libs/convexApi";

export const runtime = "nodejs";

export async function GET() {
  try {
    const token = await convexAuthNextjsToken();
    if (!token) {
      return NextResponse.json({ connected: false }, { status: 200 });
    }

    const result = await fetchQuery(
      api.integrations.meta.getConnection,
      {},
      { token, url: process.env.NEXT_PUBLIC_CONVEX_URL as string },
    );

    return NextResponse.json(result, { status: 200 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { connected: false, error: msg },
      { status: 200 },
    );
  }
}
