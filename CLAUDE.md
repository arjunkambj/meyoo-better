# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Turborepo monorepo using Bun as the package manager. The project appears to be a multi-channel e-commerce analytics and management platform with integrations for Shopify, Meta (Facebook), and Google Ads.

## Architecture

### Apps
- **web** (port 3000): Customer-facing Next.js app for storefront dashboard
- **meyoo** (port 3001): Internal admin backoffice Next.js app
- **mobile**: Expo Router + React Native client (planned NativeWind + Hero Native adoption)
- **backend**: Convex serverless backend with real-time database

### Packages
- **@repo/types**: Shared TypeScript types
- **@repo/ui**: Shared React component library
- **@repo/time**: Time utility functions
- **@repo/eslint-config**: Shared ESLint configuration
- **@repo/typescript-config**: Shared TypeScript configurations

## Development Commands

```bash
# Install dependencies
bun install

# Run all apps in development mode
bun run dev

# Run specific app
bun run dev --filter=web
bun run dev --filter=backend
bun run dev --filter=meyoo

# Build all apps
bun run build

# Type checking
bun run check-types        # Run type checks
bun run watch-types        # Watch mode for type checking

# Linting
bun run lint              # Fix linting issues

# Format code
bun run format            # Format with Prettier
```

## Backend Architecture (Convex)

The Convex backend is organized as follows:

### Directory Structure
- **core/**: Shared domain logic (users, organizations, onboarding, costs, usage)
- **engine/**: Scheduling, analytics, events, rate limiting, workpool jobs
- **integrations/**: Shopify/Meta/Google adapters and storage pipelines
- **jobs/**: Background actions triggered via workpool/cron
- **schema/**: Table definitions split by domain (analytics, core, costs, meta, shopify, etc.)
- **web/**: Public APIs for storefront dashboard (customer-facing)
- **meyoo/**: Admin APIs for backoffice
- **webhooks/**: HTTP handlers for Shopify + GDPR webhooks
- **sync/**: HTTP endpoints for sync triggers

### Convex Conventions
- Public functions use `query`/`mutation`/`action` in web/ and meyoo/ directories
- Internal functions use `internalQuery`/`internalMutation`/`internalAction` elsewhere
- External I/O only in actions/httpAction; database operations in queries/mutations
- All collections must be queried with indexes (no full table scans)
- Background work goes through @convex-dev/workpool (see engine/workpool.ts)
- HTTP routes registered in http.ts (auth + shopify + gdpr + sync)
- Crons in crons.ts for periodic maintenance and token refresh
- Use `getAuthUserId(ctx)` for authentication in public APIs
- All functions must include argument and return validators

### Database Schema
- System fields automatically added: `_id` and `_creationTime`
- Index naming convention: "by_field1_and_field2" for compound indexes
- Always use `v.null()` validator when returning null values
- Prefer paginated reads and `take()` over unbounded collects

## Frontend Architecture

### Tech Stack
- Next.js 15 with App Router and Turbopack
- TypeScript with strict mode
- HeroUI component library
- Tailwind CSS v4
- Framer Motion for animations
- Recharts for data visualization
- Convex for real-time data
- Expo + React Native for mobile (with NativeWind + Hero Native on the roadmap)

### Authentication
- Convex Auth with email/password
- Session-based authentication
- Protected routes use `getAuthUserId(ctx)`

## Environment Variables

Key environment variables used (see turbo.json for full list):
- `NEXT_PUBLIC_CONVEX_URL`: Convex deployment URL
- `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`: Shopify OAuth credentials
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: Google OAuth
- `META_APP_ID`, `META_APP_SECRET`: Meta/Facebook OAuth
- `RESEND_API_KEY`: Email service provider

## Testing & Quality

Currently no test framework is configured. Use these commands for code quality:
- `bun run lint` - Run ESLint with auto-fix
- `bun run check-types` - TypeScript type checking
- `bun run format` - Prettier formatting

## Additional Context

See `rules_convex.md` for detailed Convex patterns and best practices specific to this codebase.
