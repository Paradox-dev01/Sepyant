# Sepyant — FULL Architecture (Complete Vision)

**Team:** 3 devs, full-time
**Scope:** Complete product — all modules from the original vision doc
**Honest timeline:** 12–18 months to reach the full vision, shipped in 6 phases.
**Rule: every phase must be usable/demoable/launchable before starting the next one.** Do not build features 40-90 in parallel with features 1-20 — you'll end up with nothing finished.

---

## 0. Reality Check (read this before anything else)

150+ features across AI generation, autonomous browser execution, defect management, traceability, risk analysis, team collaboration, billing, integrations, accessibility testing, i18n testing, API testing, mobile testing, and automation-code generation is, structurally, **six separate products** bolted together. That's fine — plenty of real QA platforms (TestRail, Zephyr, Katalon) took years to get here. Just don't expect week 3 to look like the final vision.

What keeps this alive over 12+ months with 3 people:
1. **Ship Phase 1 as a real usable tool by week 8-10** and get actual QA engineers using it, even for free. Feedback here will change your priorities more than anything in this doc.
2. **Each phase is a separate git milestone/release**, not a branch that sits unmerged for months.
3. **Revisit this doc every phase** — by the time you reach Phase 4, AI models, your users' needs, and your own skills will have moved. Don't treat this as fixed law.

---

## 1. Full Module List (from vision doc, organized by system)

**QA Intelligence**
Application Understanding Engine · AI QA Orchestrator · Intelligent Model Routing · QA Knowledge Context · Test Plan Generator · Test Strategy Generator · Test Scenario Generator · Intelligent Test Case Generator · AI Recommended Test Case Count · Test Design Techniques (equivalence partitioning, BVA, decision tables, state transition, pairwise, error guessing) · Test Case Quality Validator · AI Hallucination Prevention

**Execution**
AI Test Execution Engine · AI Browser Agent · Expected vs Actual Verification · Multi-Signal Verification (DOM/Visual/Network) · Test Result States · Pass Criteria Engine · AI Test Confidence Score · Evidence Collection · AI Investigation After Failure · AI Exploratory Testing · AI Test Case Mutation

**Defects**
Automatic Defect Detection · Defect Report Generator · AI Defect Quality Checker · Duplicate Defect Detection · Screenshot Intelligence (visual diffing)

**Organization / Intelligence**
Mind Map Generator · Requirement Traceability · Test Execution Dashboard · Coverage Dashboard · Risk-Based Testing · Regression Intelligence · Change Impact Analysis · Test Data Generator · Project QA Knowledge Graph · Intelligent QA Search · Release Readiness Engine · Test Summary Generator

**Workspace/Product**
AI QA Copilot (chat) · AI Document Editor · Version History · AI Change Transparency · Import System · Export System · Command Palette (Ctrl+K) · Execution Modes (Manual/AI-Assisted/AI-Execute/AI-Explore)

**Platform**
Integrations (Jira, Linear, Azure DevOps, GitHub, TestRail, Zephyr, Xray, Slack, Teams, GitLab, Bitbucket) · Browser Architecture (isolated sessions) · Credential Security · AI Security (encryption, RBAC, audit log, SSO/SAML/SCIM) · AI Usage & Billing · Bring Your Own Key · Collaboration · RBAC · Approval Workflow · Audit Log

**Extended Testing**
Accessibility Testing · Internationalization Testing · API Testing · Mobile Testing (Appium) · Automation Conversion (Playwright/Selenium/Cypress code generation)

That's the whole thing. Now the phasing.

---

## 2. Phased Roadmap (matches vision doc §92, with realistic time estimates for 3 people)

### Phase 1 — QA Intelligence Core (Weeks 1–8)
**Ships:** a working AI test-case generation tool people can actually use.
- Auth, Projects, Requirements input (text/PDF/DOCX/user stories)
- Application Understanding Engine (from URL — page/form/element scan; from screenshots — vision analysis)
- Test Plan Generator, Test Strategy Generator, Test Scenario Generator
- Intelligent Test Case Generator + AI Recommended Count + Test Design Techniques baked into prompts
- Test Case Quality Validator + Hallucination Prevention (observed/derived/assumed tagging)
- Editor (approve/edit/reject), Export (XLSX/CSV/PDF/DOCX)
- Basic AI Copilot chat scoped to generation tasks

**Milestone:** launch this publicly (even free tier) at end of Phase 1. Real feedback here shapes Phase 2 priorities.

### Phase 2 — Browser & Execution (Weeks 9–16)
- Browser Architecture (isolated Playwright sessions per project)
- AI Browser Agent (navigate, click, type, select, scroll, form submission)
- Test Execution Engine + Expected vs Actual + Multi-Signal Verification (DOM, visual, network)
- Test Result States (Pass/Fail/Blocked/Inconclusive/Not Executed) + Pass Criteria Engine
- AI Test Confidence Score
- Evidence Collection (screenshot, video, console, network)
- Execution Modes: Manual, AI-Assisted, AI-Execute
- Credential Security (isolated credential vault, never raw passwords into prompts)

**Milestone:** users can execute AI-generated test cases against a real staging app, not just generate documents.

### Phase 3 — Evidence & Defects (Weeks 17–22)
- AI Investigation After Failure (root-cause hypothesis engine)
- Automatic Defect Detection + Defect Report Generator
- AI Defect Quality Checker
- Duplicate Defect Detection (embedding-based similarity)
- Screenshot Intelligence / visual diffing
- AI Test Case Mutation (edge-case variant generation)

### Phase 4 — QA Intelligence Layer (Weeks 23–30)
- Requirement Traceability (full graph: requirement→scenario→case→execution→defect)
- Coverage Dashboard, Execution Dashboard
- Risk-Based Testing classification
- Regression Intelligence + Change Impact Analysis (needs build/version comparison)
- Test Data Generator (synthetic data)
- Project QA Knowledge Graph + Intelligent QA Search (natural language search — needs vector DB)
- Release Readiness Engine, Test Summary Generator
- Mind Map Generator (interactive, exportable)
- AI Exploratory Testing mode

### Phase 5 — Collaboration & Business (Weeks 31–38)
- Team workspaces, invitations, comments, mentions
- RBAC (Owner/Admin/QA Lead/QA Engineer/Developer/Viewer)
- Approval Workflow (draft→review→approved→locked) + AI Change Transparency (diff view, accept/reject)
- Audit Log
- AI Usage & Billing (credits system, plans: Free/Pro/Team/Enterprise)
- Bring Your Own Key
- First integrations: Jira + Slack (highest demand, build others on request)
- Version History across all artifacts

### Phase 6 — Autonomous QA + Extended Testing (Weeks 39+, ongoing)
- AI Exploratory Testing at scale, autonomous regression runs
- Automation Conversion (generate Playwright/Selenium/Cypress code from manual cases)
- API Testing (OpenAPI/Postman import → generated API test cases)
- Accessibility Testing, Internationalization Testing
- Mobile Testing (Appium — Android first, iOS later)
- Enterprise Security (SSO/SAML/SCIM, private deployment, self-hosting)
- Additional integrations: TestRail, Zephyr, Xray, Azure DevOps, GitHub Issues, Teams, GitLab, Bitbucket

This phase never really "ends" — it's the ongoing v2/v3/v4 track after you have paying users telling you what to prioritize.

---

## 3. Full Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js 14 + TypeScript + Tailwind + shadcn/ui | |
| Backend | Next.js API routes → split into services if load demands (start monolith, per doc §78) | |
| Database | Supabase Postgres | RLS on every table |
| Vector search | Supabase pgvector (Phase 4+, for Intelligent QA Search + duplicate detection) | |
| AI orchestration | Custom orchestrator layer — Anthropic Claude primary, OpenAI/Gemini as secondary providers (doc §9) | Provider-agnostic from day 1 so Phase 5 BYOK isn't a rewrite |
| Model routing | Task→model mapping table (doc §10) — reasoning-heavy tasks to Claude Sonnet/Opus, fast/cheap tasks to Haiku-class models | |
| Browser automation | Playwright (Node), isolated browser contexts per session | |
| Mobile automation | Appium (Phase 6) | |
| File parsing | pdf-parse, mammoth, papaparse, xlsx (SheetJS) | |
| Auth | Supabase Auth → SAML/SCIM via WorkOS or similar (Phase 6, enterprise) | |
| Billing | Stripe (Phase 5) | |
| Storage | Supabase Storage (screenshots, videos, evidence) | |
| Hosting | Vercel + Supabase, move to dedicated infra (Railway/Fly.io/AWS) once Playwright execution load grows | |
| Search/Knowledge Graph | Postgres + pgvector initially; consider Neo4j only if the graph queries in Phase 4 genuinely need it | |

---

## 4. Full Database Schema

```sql
-- ===== Identity & Org =====
users               (id, email, name, created_at)
organizations       (id, name, owner_id, created_at)
teams               (id, org_id, name)
team_members        (id, team_id, user_id, role)  -- Phase 5

-- ===== Projects =====
projects            (id, org_id, name, description, created_at)
applications        (id, project_id, url, type, context_model_json)  -- Application Understanding output

-- ===== Requirements =====
requirements         (id, project_id, source_type, raw_content, parsed_content, created_at)
user_stories          (id, requirement_id, as_a, i_want, so_that)
acceptance_criteria   (id, requirement_id, given, when, then)

-- ===== QA Artifacts =====
test_plans           (id, project_id, requirement_id, content_json, version, status)
test_strategies      (id, test_plan_id, type, content_json)
test_scenarios       (id, test_plan_id, title, description, priority)
test_cases           (id, test_scenario_id, title, preconditions, steps_json, test_data,
                       expected_result, priority, severity, test_type, status,
                       ai_generated, approved, needs_verification, version)
mind_maps            (id, project_id, structure_json)

-- ===== Execution =====
test_executions      (id, test_case_id, mode, status, confidence_score,
                       actual_result, started_at, finished_at)
execution_steps      (id, execution_id, step_number, action, target_element,
                       observed_state, screenshot_url)
evidence             (id, execution_id, type, url_or_data, created_at)

-- ===== Defects =====
defects              (id, project_id, test_execution_id, title, module,
                       steps_to_reproduce, expected_result, actual_result,
                       severity, priority, status, duplicate_of, quality_score)

-- ===== Traceability / Intelligence =====
traceability_links   (id, requirement_id, scenario_id, case_id, execution_id, defect_id)
coverage_snapshots   (id, project_id, requirement_coverage, execution_coverage, computed_at)
risk_classifications (id, project_id, module, risk_level, factors_json)
regression_suites    (id, project_id, build_id, recommended_case_ids)
release_readiness    (id, project_id, status, reasoning_json, computed_at)
test_summaries        (id, project_id, content_json, created_at)

-- ===== AI System =====
ai_conversations      (id, project_id, user_id, messages_json)
ai_usage_log          (id, project_id, task_type, model_used, tokens_used, cost_estimate)
ai_credentials         (id, org_id, provider, encrypted_key)  -- BYOK, Phase 5

-- ===== Collaboration (Phase 5) =====
comments              (id, entity_type, entity_id, user_id, content, created_at)
approvals              (id, entity_type, entity_id, approved_by, approved_at)
audit_logs             (id, org_id, user_id, action, entity_type, entity_id, timestamp)
subscriptions          (id, org_id, plan, credits_remaining, renews_at)

-- ===== Integrations (Phase 5-6) =====
integrations           (id, org_id, provider, encrypted_config, connected_at)
```

Every table: `RLS scoped by org_id/project_id → membership check`. Set this up correctly in Phase 1 — retrofitting RLS onto 30+ tables in Phase 5 is painful.

---

## 5. AI Orchestrator Design (built once, used everywhere)

```
Request
  ↓
Task Classifier (which task type: generation / execution / analysis / chat)
  ↓
Model Router (task → provider + model, per §10 table)
  ↓
Prompt Builder (system instructions + QA rules + project context +
                 requirement context + application context + task input)
  ↓
Provider Call (Claude / OpenAI / Gemini — abstracted behind one interface)
  ↓
Structured Output Parser + Schema Validator (zod)
  ↓
  ├─ valid → save + return
  └─ invalid → retry once with error context → still invalid → surface error to user
```

Build this as **one shared module** (`/lib/ai/orchestrator.ts`) from Phase 1. Every feature from Test Plan generation to AI Copilot to Defect drafting calls through it. This is what makes Phase 5's multi-provider/BYOK work trivial instead of a rewrite.

---

## 6. Team Task Division (adjust per phase)

| Person | Phase 1-2 focus | Phase 3-4 focus | Phase 5-6 focus |
|---|---|---|---|
| **Mahmuda** | AI orchestrator, Supabase schema/RLS, prompt engineering | Traceability engine, knowledge graph, defect AI logic | Billing, BYOK, model routing refinement |
| **Helper 1** | Workspace UI, editor, dashboard | Coverage/risk dashboards, mind map UI | Collaboration UI, RBAC, approval workflows |
| **Helper 2** | — (joins Phase 2) | Playwright execution engine, evidence capture | Integrations (Jira/Slack), automation code generation |

Re-split as needed — this is a guide, not a contract.

---

## 7. Guardrails (non-negotiable, or this becomes vaporware)

1. **Phase N+1 does not start until Phase N is deployed and at least one real person outside the team has used it.**
2. Every AI call goes through the shared orchestrator — no feature builds its own one-off Claude call.
3. RLS on every table from day 1.
4. Each phase gets its own git tag/release. If a phase runs more than 50% over its estimate, stop and cut scope inside that phase — don't silently let it bleed into the next one.
5. Revisit and rewrite this doc at the start of each phase based on what you actually learned.

---

## 8. What to Build First (this week)

Regardless of the 12-18 month horizon, the actual first lines of code are identical to the trimmed MVP plan: Supabase schema + Next.js scaffold + the AI orchestrator + Test Plan/Case generation. Everything above is just the map for what comes after that works.
