# Repository Guidelines

ALways USE CONTEXT& to Fetch docs

## Agent & Components Usage Rules

- Always fetch latest Context7 docs before editing code that touches Convex Agent, Resend, or other Convex components (`/get-convex/agent`, `/get-convex/resend`, etc.).
- When wiring components, keep middleware order stable:
  - `app.use(workpool, { name: "mainWorkpool" })`
  - `app.use(actionRetrier)`
  - `app.use(rag)`
  - `app.use(agent)`
  - `app.use(resend)`
- In Convex actions, never use `ctx.db` directly — use `ctx.runQuery`/`ctx.runMutation` to access the database.

## Project Structure & Module Organization

- Monorepo managed by Turbo and Bun.
- Apps
  - `apps/web` — Next.js (App Router) storefront; code in `app/`, shared UI in `components/`, utilities under `libs/`.
  - `apps/mobile` — Expo Router React Native app with NativeWind styling and HeroUI Native components.
- `apps/admin` — Next.js Admin panel (formerly `apps/meyoo`); minimal scaffold plus standard folders (`components/`, `hooks/`, `libs/`, `config/`, `constants/`, `store/`, `types/`, `styles/`). Dev on port 3001.
  - `apps/backend` — Convex backend. Functions and jobs under `convex/` organized by domain:
    - `convex/web/*` — storefront APIs
    - `convex/meyoo/*` — admin APIs
    - shared domains under `convex/core`, `convex/engine`, `convex/integrations`, etc.
- Packages
  - `packages/ui` — Shared React components.
  - `packages/eslint-config` — Centralized ESLint configs.
  - `packages/typescript-config` — Shared `tsconfig` presets.
- Assets live in `apps/web/public`. Env files use `*.env.local` per app.

## Build, Test, and Development Commands

- Install: `bun install` (root) — installs all workspace deps.
- Dev (all): `bun run dev` — runs `turbo run dev` across apps.
- Dev (web): `bun run dev` in `apps/web` — Next dev on port 3000.
- Dev (backend): `bun run dev` in `apps/backend` — starts Convex.
- Build: `bun run build` — `turbo run build` with caching.
- Lint: `bun run lint` — ESLint via shared configs.
- Types: `bun run check-types` — TypeScript no‑emit checks.
- Format: `bun run format` — Prettier on `ts/tsx/md`.
- Convex codegen runs on the managed server; **never run `convex codegen` locally**.

### Workspace filtering (Turbo)

- Target a single app: `bun run dev --filter=web` or `bun run dev --filter=meyoo`.
- Build a single app: `bun run build --filter=web`.
- Run any script in one workspace: `bun run --filter=web <script>`.

### Package manager policy

- Use `bun` exclusively (do not use npm/pnpm/yarn).

## Coding Style & Naming Conventions

- Languages: TypeScript, React 19, Next.js 15, Convex.
- Linting: use `@repo/eslint-config` variants (`base`, `react-internal`, `next-js`).
- Formatting: Prettier 3; 2‑space indent, single quotes where applicable.
- Naming: React components `PascalCase` (`MyComponent.tsx`); hooks `useX.ts`; utilities `camelCase.ts`; Convex functions colocated by domain under `convex/<area>/` (see structure above).
- TS: strict mode enabled; prefer explicit types for exports and public APIs.

### UI & Frontend Conventions

- Components: prefer `@heroui/react` for building UI.
- Styling: Tailwind CSS 4 with semantic, utility-first classes.
- Icons: always use `@iconify/react` for icons.
- Tables/Charts: TanStack Table and Recharts are available in web.
- Mobile: use NativeWind for styling and HeroUI Native (HeroUI for React Native) components in the Expo app; avoid mixing other UI kits without alignment.

### Convex Types in Frontend

- For Convex document IDs in React code, import `GenericId` and alias as `Id` to match generated types: `import type { GenericId as Id } from 'convex/values'`.
- Do not use ad-hoc `Id` shims in `apps/web`; rely on generated types via `api` and `useQuery/useMutation` inference where possible.
- Path aliases are set so web/admin clients can import the Convex generated API via `@/libs/convexApi` and, when needed, generated data model via `@repo/convex/*` path.

## Monorepo Best Practices

- Share code via packages (e.g., `packages/ui`, `packages/typescript-config`), avoid duplication.
- Keep workspace dependencies explicit; add deps in the specific workspace.
- Leverage Turbo caching; use `--filter` for targeted operations.
- Install dependencies from the repo root with `bun install`.

## Rule Files

- `rules_convex.md` — Convex patterns and best practices.
- `rules_performance.md` — Performance optimization guidelines.
- `rules_style.md` — UI conventions and design system.

## Testing Guidelines

- No dedicated test runner configured yet. Prioritize:
  - Type checks (`bun run check-types`) and ESLint (`bun run lint`).
  - Add unit tests if introducing critical logic; prefer Vitest, files as `*.test.ts(x)` colocated next to sources.

## Environment Variables

- Store per app in `*.env.local` and never commit.
- Common keys used across apps/integrations (set only what you need):
  - Next.js: `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_CONVEX_URL`
  - Auth: `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`
  - Shopify: `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_SCOPES`, `SHOPIFY_APP_HANDLE`
  - Ads: `META_APP_ID`, `META_APP_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
  - Email: `RESEND_API_KEY`
  - Turbo remote caching (optional): `TURBO_TOKEN`, `TURBO_TEAM`

## Commit & Pull Request Guidelines

- Commits: follow Conventional Commits when possible (`feat:`, `fix:`, `chore:`). Keep concise, imperative.
- PRs must include:
  - Problem statement, summary of changes, and scope.
  - Linked issue (if applicable) and screenshots for UI changes.
  - Verification: `bun run lint`, `bun run check-types`, and local build pass.

## Security & Configuration Tips

- Store secrets only in per‑app `*.env.local` (never commit). Refer via `process.env` or Convex env.
- Node ≥ 18 and Bun ≥ 1.2.18 required.

## avaible heroui native componetns

Accordion
Avatar
Button
Card
Checkbox
Chip
Dialog
Divider
Drop Shadow View
Error View
Form Field
Radio
Radio Group
Scroll Shadow
Skeleton
Skeleton Group
Spinner
Surface
Switch
Text Field
