# Agent Handbook

## Core Rules
- Remove legacy or unused functions once the replacement is live; do not leave dead code behind.
- Explain work in plain language so the team can follow quickly.
- Merge or delete duplicate code and docs whenever you see them.

## Component Wiring
- Register backend components in this exact order:
  - `app.use(workpool, { name: "mainWorkpool" })`
  - `app.use(actionRetrier)`
  - `app.use(rag)`
  - `app.use(agent)`
  - `app.use(resend)`
- Always fetch the latest Context7 docs before touching these components or their wiring.

## Monorepo Layout
- Turborepo + Bun power the workspace.

### Apps
- `apps/web` – Next.js dashboard. Routes live in `src/app`, shared UI in `src/components`, helpers in `src/libs`, state in `src/store`, and static assets in `public/`.
- `apps/mobile` – Expo + React Native client. Screens under `app/`, shared pieces in `components/`, contexts in `contexts/`, state in `store/`, and styles in `styles/`.
- `apps/backend` – Convex backend runtime. Business logic under `convex/` with shared helpers in `libs/`.

### Packages
- `@repo/ui` – Shared React and React Native components.
- `@repo/types` – Cross-platform TypeScript types.
- `@repo/time` – Time utilities used by web and backend.
- `@repo/eslint-config` – Centralized ESLint rules.
- `@repo/typescript-config` – Shared tsconfig presets.

### Backend Convex Map
- `agent/` – Agent flows, chat actions, and MCP tooling.
- `core/` – Core domain logic: orgs, users, onboarding, costs, usage.
- `engine/` – Scheduling, analytics, events, rate limiting, workpool jobs.
- `jobs/` – Background jobs triggered by workpool or cron.
- `meta/` – Meta Ads integrations and storage helpers.
- `meyoo/` – Backoffice/admin APIs.
- `resend/` – Transactional email actions and helpers.
- `schema/` – Table definitions and indexes (`schema.ts` is the entry point).
- `shopify/` – Shopify auth, sync, and webhook helpers.
- `utils/` – Shared backend utilities.
- `web/` – Customer-facing storefront APIs.
- `webhooks/` – HTTP handlers for Shopify + GDPR flows.
- Root files: `auth*.ts`, `http.ts`, `httpSync.ts`, `rag.ts`, `ResendOTP.ts`, `installations.ts`.
- `_generated/` and `schema.ts` come from Convex codegen—do not edit.

### Backend Shared Libraries
- `apps/backend/libs/env.ts` – Environment variable loading.
- `apps/backend/libs/integrations.ts`, `meta/`, `shopify/`, `time/`, `utils/` – Reusable backend helpers shared across Convex domains.

## Development Commands
- Install everything once with `bun install` from the repo root.
- Run all apps via `bun run dev`. Use `bun run dev --filter=web`, `--filter=backend`, or `--filter=mobile` to target one workspace.
- Build with `bun run build`; add `--filter=<workspace>` for a single target.
- Quality checks: `bun run lint` and `bun run check-types`.
- Formatting: `bun run format` keeps markdown and ts/tsx tidy.
- Only use Bun (no npm/pnpm/yarn). Node 18+ and Bun 1.2.18+ are required.

## Frontend Conventions
- Use HeroUI on web and HeroUI Native on mobile.
- Tailwind CSS 4 powers styling—stick to semantic utility classes and keep config files in sync.
- Icons come from `@iconify/react`.
- Tables and charts rely on TanStack Table and Recharts.
- Share UI through `@repo/ui`; avoid copy/paste duplicates.

## Convex in Frontend
- Import Convex IDs with `GenericId` aliased as `Id` from `convex/values`.
- Use generated Convex helpers via `@/libs/convexApi` and `@repo/convex/*`.
- Convex codegen runs on the managed server—never run `convex codegen` locally.

## Testing and Quality
- Run `bun run check-types` and `bun run lint` before handing off work.
- Add Vitest (`*.test.ts(x)`) when introducing critical logic.
- When editing Convex queries, use indexes and prefer pagination helpers over raw collection scans.

## Environment and Secrets
- Keep secrets per app in `*.env.local`; never commit them.
- Common keys: `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_CONVEX_URL`, Shopify (`SHOPIFY_*`), Meta (`META_*`), Google (`GOOGLE_*`), `RESEND_API_KEY`, `CONVEX_DEPLOY_KEY`, `CONVEX_*_SITE_URL`, and MCP-related keys.

## Tools and MCP Usage
- Use Convex MCP helpers to inspect or run one-off data queries. Add temporary MCP code in its own folder and remove it after use.
- Use Shopify MCP to study webhook payloads when needed.
- Pull the latest Context7 docs before editing Shopify components or related docs.

## Reference Files
- `rules_convex.md` – Convex patterns and examples.
- `rules_performance.md` – Performance guidelines.
- `rules_style.md` – UI conventions and design system details.
