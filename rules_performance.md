# Performance & Developer Experience Guide (Next.js + Convex + HeroUI)

This condensed checklist highlights the practices that have the biggest impact before a production launch.

## Convex Runtime Fundamentals
- Await every promise inside queries, mutations, actions, schedulers, and cron handlers to avoid dropped work or swallowed errors.citeturn0search0
- Validate arguments for every public function and gate privileged paths with `ctx.auth.getUserIdentity()` or other unguessable identifiers.citeturn0search0
- Keep the public surface area small: schedule or `ctx.run*` only `internal.*` functions, and share logic via helpers instead of re-exporting public APIs.citeturn0search0turn0search1

## Data Access Patterns
- Prefer `.withIndex` or `.withSearchIndex` over `.filter`, and reserve `.collect` for genuinely small result sets.citeturn0search0
- Use `.paginate`, `.take`, or denormalized counters when datasets can grow past a few hundred documents to stay within Convex read limits.citeturn0search0turn0search4
- Audit schema indexes periodically; remove prefixes that can be served by a longer composite index to reduce write overhead.citeturn0search0

## Function Design & Layering
- Keep `query`, `mutation`, and `action` wrappers thin—push business logic into `convex/model/*` helpers and reuse them across public and internal functions.citeturn0search0
- Combine related lookups into a single helper instead of chaining `ctx.runQuery` / `ctx.runMutation`, so reads stay consistent across the transaction.citeturn0search0
- Call plain TypeScript helpers when two Convex functions share a runtime, and batch multi-document writes inside a single mutation for atomicity.citeturn0search0

## Reliability Guardrails
- Watch Convex read/write warnings: 16,384 scanned docs, 8 MiB payloads, 4,096 queries per function, and 1 second execution time are hard limits—index and paginate before you get near them.citeturn0search3
- Ship branches only after `bun run lint`, `bun run check-types`, and `bun run build` succeed; these catches complement the runtime constraints above.

## Resources
- Convex Best Practices.citeturn0search0
- Convex Internal Functions.citeturn0search1
- Convex Pagination Guide.citeturn0search4
