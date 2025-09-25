# Mobile App

Expo Router project for the Meyoo mobile client.

## Getting started

1. Install dependencies from the repo root: `bun install`.
2. Start the Expo dev server (from the repo root): `bun run dev --filter=mobile`.
   - You can also run the workspace scripts directly: `bun run --filter=mobile android|ios|web`.

The app uses [Expo Router](https://docs.expo.dev/router/introduction/) for file-based navigation. Screens live under the `app/` directory.

## Scripts

- `bun run dev` – start Expo with a cleared Metro cache (default task in Turbo).
- `bun run start` – start Expo without clearing the cache.
- `bun run android` / `bun run ios` / `bun run web` – open the app in the respective target.
- `bun run lint` – lint the workspace with the shared repo config.
- `bun run check-types` – run a no-emit TypeScript check.

## Notes

- This workspace shares TypeScript and ESLint settings from `@repo/*` packages to stay aligned with the rest of the monorepo.
- Keep environment-specific values in `apps/mobile/.env.local` (not committed).
