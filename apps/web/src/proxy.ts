import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";
import { NextResponse } from "next/server";

// Public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  "/",
  "/about(.*)",
  "/careers(.*)",
  "/contact(.*)",
  "/cookies(.*)",
  "/pricing(.*)",
  "/data-protection(.*)",
  "/privacy(.*)",
]);

// Auth routes
const isAuthRoute = createRouteMatcher(["/signin", "/signup"]);

export default convexAuthNextjsMiddleware(
  async (request, { convexAuth }) => {
    const pathname = request.nextUrl.pathname;
    const method = request.method;

    // Simple logging for all API routes without affecting behavior
    if (pathname.startsWith("/api/")) {
      try {
        console.log(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            kind: "api",
            method,
            path: pathname,
          })
        );
      } catch (error) {
        console.warn("Failed to log API request metadata", error);
      }
      return; // Do not apply auth logic to API handlers
    }

    // Special handling for Shopify app installation with shop parameter
    if (pathname === "/" && request.nextUrl.searchParams.has("shop")) {
      const shop = request.nextUrl.searchParams.get("shop");

      if (shop) {
        const redirectUrl = new URL(`/api/v1/shopify/auth`, request.url);

        request.nextUrl.searchParams.forEach((value, key) => {
          redirectUrl.searchParams.set(key, value);
        });

        return NextResponse.redirect(redirectUrl);
      }
    }

    // Short-circuit early for public routes to avoid unnecessary auth checks
    if (isPublicRoute(request)) {
      return;
    }

    // Check if user is authenticated only for non-public routes
    const isAuthenticated = await convexAuth.isAuthenticated();

    if (!isAuthenticated) {
      // Allow auth routes when unauthenticated
      if (isAuthRoute(request)) {
        return;
      }

      return nextjsMiddlewareRedirect(request, "/signin");
    }

    // Redirect to dashboard if user is authenticated and on auth route
    if (isAuthRoute(request)) {
      return nextjsMiddlewareRedirect(request, "/overview");
    }

    return;
  },
  {
    cookieConfig: { maxAge: 60 * 60 * 24 * 30 },
  }
);

export const config = {
  // The following matcher runs middleware on all routes
  // except static assets and specific API routes that handle their own auth
  matcher: [
    "/((?!.*\\..*|_next|api/v1/meta/auth|api/v1/meta/callback|api/v1/shopify/auth|api/v1/shopify/callback).*)",
    "/",
  ],
};
