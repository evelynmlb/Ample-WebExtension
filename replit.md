# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Artifacts

- **Highlighter Extension** (`artifacts/highlighter-extension/`) — React + Vite popup UI for a Chrome MV3 browser extension that lets users highlight text on any web page and save it (with source URL, page title, surrounding context, color, tags, and notes) to a session-only library. The same React app powers both the in-workspace preview (uses `sessionStorage` with seeded sample data) and the real extension popup (uses `chrome.storage.session`). Extension scripts (manifest, content script, background service worker, icons) live in `extension/` and are bundled to `dist/` by `pnpm --filter @workspace/highlighter-extension run build:ext`. Load `dist/` as an unpacked extension at `chrome://extensions` (Developer Mode on).

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
