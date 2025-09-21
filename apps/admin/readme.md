## Meyoo Admin (Next.js)

Minimal admin app with a Hello World page and shared repo configs.

- Dev: `bun run dev` (from repo root) or `bun run dev` in `apps/admin`
- Lint: `bun run lint` (root) or `bun run lint` in app
- Types: `bun run check-types` (root) or `bun run check-types` in app
- URL: http://localhost:3001

Notes
- Uses `@repo/eslint-config/next-js` and `@repo/typescript-config/nextjs.json`.
- Imports `@repo/types` in `app/page.tsx` as an example of shared types.
