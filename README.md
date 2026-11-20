# QA IDE — Phase 1

AI-powered test plan / scenario / test case generation from requirements. This is Phase 1
of the full architecture (see `ARCHITECTURE_FULL.md` in the project docs) — no browser
execution, defects, or billing yet. Just: requirement in → AI-generated, editable, exportable
test cases out.

## 1. Setup (do this first, everyone on the team)

```bash
npm install
cp .env.local.example .env.local
```

Then fill in `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` — already filled in from
  the example file, these are safe to share (they're public/client-side keys).
- `SUPABASE_SERVICE_ROLE_KEY` — get this from Supabase Dashboard → Project Settings → API →
  `service_role` key. **NEVER commit this or paste it in chat/Slack.** It bypasses all
  security rules.
- `OPENROUTER_API_KEY` — **default AI provider, genuinely free, no credit card.** Get a key
  at https://openrouter.ai (dashboard → Keys). Free models (`:free` suffix) are what
  `lib/ai/orchestrator.ts`'s `MODEL_ROUTING` table uses right now. Free model IDs on
  OpenRouter change over time — if generation starts failing, check
  https://openrouter.ai/models?max_price=0 for the current list and update the model
  strings in `MODEL_ROUTING`.
- `AIRFORCE_API_KEY` — optional, low-cost fallback if you want it. Not required if you're
  only running on OpenRouter's free tier.
- `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` — **final release only.** These providers are
  commented out in `lib/ai/orchestrator.ts` (imports + `PROVIDERS` registry) so the app
  never accidentally calls them. When you're ready to pay for direct Claude/GPT access:
  uncomment the two imports and their `PROVIDERS` entries, then update `MODEL_ROUTING` to
  point tasks at `{ provider: 'anthropic', model: 'claude-sonnet-4-6' }` etc. No other code
  changes needed — this is the whole point of the orchestrator abstraction.

## 2.5. Google Sign-In (optional but included)

1. Google Cloud Console → create OAuth Client ID (Web application)
2. Authorized redirect URI: `https://khadrvmrtqbljuwwjkbq.supabase.co/auth/v1/callback`
3. Supabase Dashboard → Authentication → Providers → Google → paste Client ID + Secret → Save
4. Done — the "Continue with Google" button on `/login` and `/signup` already works, and
   `app/auth/callback/route.ts` handles the redirect back.

## 2. Run the database migration

1. Go to the Supabase dashboard → SQL Editor → New query
2. Paste the entire contents of `supabase/migrations/0001_init.sql`
3. Run it
4. Confirm tables appear under Table Editor: `projects`, `requirements`, `test_plans`,
   `test_scenarios`, `test_cases`, `ai_conversations`, `ai_usage_log`

Only needs to be run once against the shared Supabase project — don't run it again if
someone else already has.

## 3. Enable email auth (one-time, in Supabase dashboard)

Authentication → Providers → Email should be enabled by default. For faster local testing,
you can turn off "Confirm email" under Authentication → Settings while developing (turn it
back on before any real users sign up).

## 4. Run locally

```bash
npm run dev
```

Open http://localhost:3000 — you'll be redirected to `/login`. Sign up, create a project,
paste a requirement, hit "Generate Test Plan."

## 5. Project structure

```
app/
  login/, signup/          — auth pages (email/password + Google OAuth)
  auth/callback/            — OAuth redirect handler
  projects/                — project list + create
  projects/[id]/            — the workspace: 3-pane layout (sidebar, main IDE, AI copilot)
  api/ai/generate-test-plan/   — main generation endpoint
  api/ai/copilot-chat/          — AI copilot chat endpoint
components/workspace/
  Sidebar.tsx                — left pane: project switcher, quick-create, test plan history
  CopilotPanel.tsx           — right pane: AI chat
lib/
  supabase/                — client.ts (browser), server.ts (server components/routes)
  ai/
    orchestrator.ts        — THE shared AI call function (generateStructured + generateText).
                              Every AI feature goes through this. Don't call a provider SDK
                              directly anywhere else.
    providers/               — one file per AI provider (airforce, anthropic, openai), all
                              implementing the same AIProvider interface
    prompts.ts               — prompt templates
    schemas.ts                — zod schemas AI output is validated against
supabase/migrations/        — SQL migration files, run manually in Supabase dashboard
```

## 6. Rules while building (from the architecture doc)

1. Every AI call goes through `lib/ai/orchestrator.ts`. If you're adding a new AI feature
   (defect drafting, copilot chat, etc.), add a new prompt builder in `prompts.ts`, a new
   zod schema in `schemas.ts`, and call `generateStructured()`. Don't write a new
   `anthropic.messages.create()` call somewhere else.
2. Every new table needs RLS. Copy the pattern from `0001_init.sql` — scope to
   `project_id in (select id from projects where owner_id = auth.uid())`.
3. Don't add features outside the Phase 1 list in `ARCHITECTURE_FULL.md` §2 without the
   team agreeing to move the roadmap.

## 8. UI note — ported from Figma Make design

The workspace UI (`app/projects/[id]/workspace.tsx` + `components/workspace/*`) is a port
of a Figma Make design ("Sepyant") into this Next.js app, wired to the real Supabase/AI
backend instead of the original mock data:

- **Real, DB-backed:** Test Plan + Test Cases artifacts (generate, edit, approve, delete —
  all persist to Supabase), chat history (reconstructed from real generations on page load),
  project switcher, settings/account/logout.
- **Not built yet (Phase 2-3 in `ARCHITECTURE_FULL.md`):** Bug Reports and Execution Runs
  artifact types from the original design were left out — there's no `defects` or
  `test_executions` table yet, and showing mock data for those would be exactly the kind of
  AI hallucination the architecture doc's §19 warns against. Add them back once those tables
  and the Playwright execution engine (Phase 2) exist.
- **Cosmetic-only for now:** the file/screenshot attach buttons in chat are visually present
  but disabled ("coming soon") since there's no backend handling for them yet — that's
  Phase 1's Application Understanding Engine (URL/screenshot input), not yet built.

The color system lives in `lib/theme.ts` (`C` object) — matches the Figma design's palette
exactly. Components use inline styles (not Tailwind classes) to match the original design's
approach, which is intentional for this IDE-precision layout.
