# Frontend-First Dev Bypass — how it works and how to undo it

This is the **temporary** "frontend-first" setup requested by the team lead: authentication,
Supabase and the AI provider are isolated so the UI can be run, tested and polished without
any real backend credentials. Nothing was deleted — every original code path is preserved
behind a single feature flag.

## The flag

In `.env.local` (gitignored):

```
NEXT_PUBLIC_DEV_BYPASS_AUTH=1
```

- `1` + `next dev` (NODE_ENV=development) → the app runs with a fake dev user
  (`dev@sepyant.local`) and an **in-memory mock store**. Every simulated response is labeled
  (`[DEV MOCK]` in chat text, amber **DEV** badge in the workspace sidebar, yellow banner on
  /login and /signup), so mock data can never be mistaken for real data.
- Production builds can never activate it: `lib/dev-bypass.ts` requires
  `NODE_ENV === 'development'`.
- To restore the real app: set the flag to `0` (or remove it) and restart the dev server.
  No other change is needed.

## What is mocked while the flag is on

| Feature | Real behavior | Dev-bypass behavior |
|---|---|---|
| Login / Signup / Google OAuth | Supabase auth | Form still renders; submit explains that auth is bypassed; yellow banner links into the app |
| Session gates (`/`, `/projects`, `/projects/[id]`) | `getUser()` + redirects | Treated as logged-in `dev@sepyant.local` |
| Project list / creation | Supabase `projects` table | In-memory store via dev-only route `POST /api/dev/projects` |
| Workspace data (plans, scenarios, cases) | Supabase queries | In-memory store, snapshotted to `/tmp/sepyant-dev-store.json` so it survives dev-server restarts |
| Generate test plan | OpenRouter AI + DB persistence | Deterministic fixture shaped exactly like the real API response, persisted to the in-memory store, labeled `[DEV MOCK]` |
| Copilot chat | OpenRouter AI | Fixed `[DEV MOCK]` reply |
| Test case edit / approve / delete | Persists to Supabase | Mirrored against the mock store via dev-only `PATCH/DELETE /api/dev/test-cases`, so review curation survives browser refreshes and dev-server restarts |
| CSV / DOC export | Client-side | Unchanged — real, works without backend |
| Quality Dashboard (`/dashboard`) | n/a (new surface) | Frontend-only by design: static deterministic mock dataset in `lib/dashboard-mock.ts`, zero backend calls; works identically with or without the flag |

## AI Test Quality Dashboard

`/dashboard` (added after the frontend-first setup) is a standalone analytics surface reachable from the
sidebar ("Workspace → Quality dashboard"). It renders **only** client-side mock data from
`lib/dashboard-mock.ts` — it never touches Supabase, the dev store, or API routes — so it is not part of
the bypass and needs no restoration. Related files (all new, safe to keep in production):

- `app/dashboard/page.tsx` — route; sidebar props follow the same auth pattern as the other pages
- `components/dashboard/QualityDashboard.tsx` — dashboard UI (tabs, filters, KPIs, gaps, AI recommendations)
- `components/dashboard/charts.tsx` — dependency-free SVG charts
- `lib/dashboard-mock.ts` — deterministic mock dataset

**Not testable without real credentials:** actual auth flows, DB persistence across
restarts, real AI generation.

## Files touched (all changes marked `[FRONTEND-FIRST DEV BYPASS]`)

New files (delete on full restore):

- `lib/dev-bypass.ts` — flag, dev user, mock store, mock generators, case mutation hooks
- `lib/dev-store-persistence.ts` — server-only snapshot/restore of the mock store to `/tmp/sepyant-dev-store.json` (import node:fs; must never be imported from client components)
- `app/api/dev/projects/route.ts` — dev-only project create/list (404 unless flag on)
- `app/api/dev/test-cases/route.ts` — dev-only case update/delete (404 unless flag on)
- `scripts/seed-dev-store.ts` — reseeds `/tmp/sepyant-dev-store.json` with a curated demo project (`bun run scripts/seed-dev-store.ts` from sepyant/)
- `DEV-BYPASS.md` — this document

Edited files (original logic preserved verbatim behind guards):

- `middleware.ts` — skips Supabase session refresh when flag on
- `app/page.tsx` — redirects straight to `/projects` when flag on
- `app/projects/page.tsx` — dev store instead of Supabase (same empty-state UI)
- `app/projects/[id]/page.tsx` — serves mock workspace data
- `app/login/page.tsx`, `app/signup/page.tsx` — SSR-safe guard + dev banner
- `app/projects/new-project-form.tsx` — dev creation path (+ error display fix)
- `components/workspace/AppSidebar.tsx` — dev creation path, DEV badge (+ error display fix)
- `components/workspace/IDEPanel.tsx` — persist helpers mirror writes into the mock store in dev mode (real Supabase flow untouched)
- `components/workspace/SettingsModal.tsx` — sign-out just navigates in dev mode
- `app/api/ai/generate-test-plan/route.ts` — mock branch before auth (real flow untouched)
- `app/api/ai/copilot-chat/route.ts` — mock branch before auth (real flow untouched)
- `app/projects/page.tsx`, `app/projects/[id]/page.tsx`, both AI routes also call `loadDevStoreOnce()` / `saveDevStore()` from `lib/dev-store-persistence.ts` inside their dev branches
- `.env.local` — adds the flag (placeholders for Supabase keys unchanged)

## Genuine (non-bypass) fixes included

- Project creation failures are now visible (red inline error) in
  `new-project-form.tsx` and `AppSidebar.tsx` instead of failing silently.
- IDEPanel persistence errors are logged instead of swallowed (real mode).
- `aria-label` on the project-name inputs.

## SEPYANT 2.0 frontend surfaces (production-safe, no bypass involvement)

The 2.0 features are frontend-only mock surfaces. They render identically
with or without the dev-bypass flag and never touch Supabase, API routes,
or the dev store:

- `lib/mock-store.ts` — localStorage-backed mock state (prefix `sepyant2.`)
  + SSR-safe helpers (`useMockStore`, `relTime`, `downloadText`, …)
- `lib/qa-mock/{conversations,documents,automation,team,notifications}.ts` — static mock seeds
- `components/shell/{AppShell,bits,Toast,CommandPalette,NotificationsPopover}.tsx` — shared shell, Ctrl+K palette, toasts, notifications
- `components/workspace/AppSidebar.tsx` — extended navigation (Workspace / QA library / Collaborate), notifications bell, palette trigger; all pre-2.0 props and behaviour preserved
- Routes: `/projects` (overview, no longer auto-redirects), `/conversations` + `/conversations/[id]`, `/bug-reports`, `/test-plans`, `/reports`, `/documents/[id]`, `/automation`, `/team`, `/dashboard` (+ workspace strip)
- `app/icon.svg` — SEPYANT favicon

To wipe 2.0 demo state: command palette → "Reset 2.0 demo data"
(clears every `sepyant2.*` localStorage key).

## SEPYANT 2.1 — project resources & context-aware generation (production-safe)

Same rules as the 2.0 surfaces: frontend-only, mock-only, honest labeling,
zero backend involvement. New since 2.0:

- `lib/qa-mock/resources.ts` — resource model + per-project demo seeds,
  file-type registry (10 MB demo limit), URL format validation. Files are
  read **locally** for previews only (text excerpt / image thumbnail via
  FileReader) and never uploaded; URLs are validated for format and never
  fetched.
- `lib/qa-mock/generation.ts` — 8 selectable output types. Test Plan / Test
  Cases keep the REAL generation endpoint + IDE panel flow (unchanged); the
  other six produce deterministic simulated outputs that name — but never
  claim to analyse — the selected context.
- `components/workspace/composer/ResourceBar.tsx` — shared composer resource
  area (attach files, add URL, reuse project resources, previews, simulated
  upload progress, "Save to project").
- `components/workspace/composer/OutputCard.tsx` — generated-output card
  (preview / edit-as-markdown / copy / download / save-to-project /
  regenerate / refine with follow-up instructions + resources-used chips).
- `components/workspace/ResourcesDrawer.tsx` — per-project reusable resource
  manager (slide-over, workspace header → "Resources").
- Chat integration: `ChatPanel.tsx` + `app/projects/[id]/workspace.tsx`
  (output-type & framework selectors, drag & drop, context chips on
  messages, save outputs as QA library documents carrying `resourcesUsed`).
- Conversations: the same resource experience in 2.0 conversation threads.
- Light/dark themes: design tokens now resolve through CSS custom properties
  (`app/globals.css`; `[data-theme='light']`), toggled from the sidebar or
  Settings → Appearance, persisted under `sepyant2.theme`.
