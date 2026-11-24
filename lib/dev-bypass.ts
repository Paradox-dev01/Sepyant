// ============================================================================
// [FRONTEND-FIRST DEV BYPASS] — TEMPORARY · DEV-ONLY · REVERSIBLE
// ============================================================================
// Purpose: let the team run, test and polish the Sepyant frontend without a
// real Supabase project or AI provider key (team-lead "frontend-first"
// directive). When the flag below is NOT active, none of this file's logic
// runs and 100% of the original auth + DB + AI code paths execute exactly as
// before — nothing was deleted or rewritten.
//
// How to use:
//   1. Add  NEXT_PUBLIC_DEV_BYPASS_AUTH=1  to .env.local
//   2. (Re)start `next dev` — the app runs against the in-memory mock store
//      below with a fake dev user. Every simulated response is labeled
//      "DEV MOCK" (chat text + sidebar DEV badge) so mock data can never be
//      mistaken for real data.
//   3. Remove the flag (or set 0) and restart -> original behavior restored.
//
// Safety: the flag requires NODE_ENV === 'development', so a production
// build (`next build && next start`) can never silently serve mock data.
// Full restore: delete the flag from .env.local, then delete this file and
// the small clearly-marked "[FRONTEND-FIRST DEV BYPASS]" blocks at each call
// site (the full list is in DEV-BYPASS.md at the repo root).
// ============================================================================

export const DEV_BYPASS =
  process.env.NODE_ENV === 'development' &&
  process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === '1';

export const DEV_USER = {
  id: '00000000-0000-4000-8000-00000000d001',
  email: 'dev@sepyant.local',
};

// ---------------------------------------------------------------------------
// In-memory dev data store — mirrors the row shapes that
// supabase/migrations/0001_init.sql defines and that the real queries return.
// Resets whenever the dev server reloads modules; that is expected for mock
// data and is always announced in the UI.
// ---------------------------------------------------------------------------

export type DevProject = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
};

export type DevTestCase = {
  id: string;
  title: string;
  preconditions: string;
  steps_json: string[];
  test_data: string;
  expected_result: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: string;
  approved: boolean;
  needs_verification: boolean;
};

export type DevScenario = {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  test_cases: DevTestCase[];
};

export type DevTestPlan = {
  id: string;
  content_json: {
    overview: string;
    scope: string;
    out_of_scope: string;
    testing_approach: string;
    recommended_case_count: number;
    recommendation_reason: string;
  };
  created_at: string;
  // [PHASE 1] matches the real PostgREST shape: embedded resources are
  // ARRAYS. The mock previously mirrored the old (incorrect) single-object
  // type, which is exactly the shape mismatch behind the page.tsx TS error.
  requirements: { raw_content: string }[] | null;
  test_scenarios: DevScenario[];
};

// Store lives on globalThis because `next dev` gives every page / route
// handler its own module instance — module-level state would be silently
// per-route. A process-global singleton is shared by all server entry points
// (and conveniently survives hot reloads too).
type DevStore = {
  projects: DevProject[];
  plansByProject: Record<string, DevTestPlan[]>;
  counter: number;
};

const globalRef = globalThis as unknown as { __sepyantDevStore?: DevStore };

function store(): DevStore {
  if (!globalRef.__sepyantDevStore) {
    globalRef.__sepyantDevStore = { projects: [], plansByProject: {}, counter: 0 };
  }
  return globalRef.__sepyantDevStore;
}

function devId(kind: string) {
  const s = store();
  s.counter += 1;
  return `dev-${kind}-${String(s.counter).padStart(4, '0')}`;
}

export function getDevProjects(): DevProject[] {
  return store().projects;
}

export function createDevProject(name: string): DevProject {
  const project: DevProject = {
    id: devId('project'),
    name,
    description: null,
    created_at: new Date().toISOString(),
  };
  // newest-first, matching the real query (created_at desc) on /projects
  store().projects.unshift(project);
  return project;
}

export function getDevProject(id: string): DevProject | undefined {
  return store().projects.find((p) => p.id === id);
}

export function getDevTestPlans(projectId: string): DevTestPlan[] {
  return store().plansByProject[projectId] || [];
}

// ---------------------------------------------------------------------------
// [DEV MOCK PERSISTENCE] Case mutation hooks (server-side, called from the
// dev-only /api/dev/test-cases route). They mirror what persistCaseUpdate /
// persistCaseDelete do against Supabase in the real flow, so review edits,
// approvals and deletes survive browser refreshes in the demo exactly like
// they would with the real backend. Dev ids are globally unique (one shared
// counter), so the lookup walks every project's plans by case id.
// Returns false when the case id is unknown (mirrors a 404).
// ---------------------------------------------------------------------------

export type DevCaseFields = Partial<Pick<DevTestCase, 'title' | 'steps_json' | 'expected_result' | 'approved'>>;

function findDevCase(caseId: string): { tc: DevTestCase; scenario: DevScenario } | null {
  const s = store();
  for (const plans of Object.values(s.plansByProject)) {
    for (const plan of plans) {
      for (const scenario of plan.test_scenarios) {
        const tc = scenario.test_cases.find((c) => c.id === caseId);
        if (tc) return { tc, scenario };
      }
    }
  }
  return null;
}

export function updateDevTestCase(caseId: string, fields: DevCaseFields): boolean {
  const hit = findDevCase(caseId);
  if (!hit) return false;
  Object.assign(hit.tc, fields);
  return true;
}

export function deleteDevTestCase(caseId: string): boolean {
  const hit = findDevCase(caseId);
  if (!hit) return false;
  hit.scenario.test_cases = hit.scenario.test_cases.filter((c) => c.id !== caseId);
  return true;
}

function addDevTestPlan(projectId: string, plan: DevTestPlan): void {
  const s = store();
  if (!s.plansByProject[projectId]) s.plansByProject[projectId] = [];
  s.plansByProject[projectId].push(plan);
}

// ---------------------------------------------------------------------------
// [DEV MOCK PERSISTENCE] Server-only snapshot/restore hooks used by
// lib/dev-store-persistence.ts so a crafted demo scenario survives dev-server
// restarts (browser refreshes were already covered by globalThis). Deliberately
// free of node:fs — this module is also imported by client components (which
// use only the DEV_BYPASS constant), and a node import here would break the
// client bundle. All IO lives in dev-store-persistence.ts (server files only).
// ---------------------------------------------------------------------------

export function snapshotDevStore(): string {
  return JSON.stringify({ version: 1, data: store() });
}

export function restoreDevStore(json: string): boolean {
  try {
    const parsed = JSON.parse(json) as { version?: number; data?: DevStore };
    const d = parsed?.data;
    if (
      parsed?.version !== 1 ||
      !d ||
      !Array.isArray(d.projects) ||
      typeof d.plansByProject !== 'object' ||
      d.plansByProject === null ||
      typeof d.counter !== 'number'
    ) {
      return false;
    }
    globalRef.__sepyantDevStore = {
      projects: d.projects,
      plansByProject: d.plansByProject,
      counter: d.counter,
    };
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Mock AI generation — deterministic fixture shaped exactly like the real
// /api/ai/generate-test-plan response contract (testPlan / scenarios /
// recommendedCaseCount / recommendationReason). It also persists into the dev
// store so a page reload reconstructs the chat history, like the real app
// does from the DB. NEVER contains real AI output.
// ---------------------------------------------------------------------------

function mockCase(
  idx: number,
  title: string,
  steps: string[],
  expected: string,
  priority: DevTestCase['priority'],
  needsVerification: boolean
): DevTestCase {
  return {
    id: devId('case'),
    title,
    preconditions: '',
    steps_json: steps,
    test_data: '',
    expected_result: expected,
    priority,
    severity: priority,
    status: 'not_executed',
    approved: false,
    needs_verification: needsVerification,
  };
}

function featureLabel(requirementText: string): string {
  const words = requirementText.trim().split(/\s+/).slice(0, 6).join(' ');
  const label = words.length > 48 ? `${words.slice(0, 45)}…` : words;
  return label || 'the feature under test';
}

export function buildMockGeneration(projectId: string, projectName: string, requirementText: string) {
  const feature = featureLabel(requirementText);
  const now = new Date().toISOString();
  const excerpt =
    requirementText.trim().length > 140
      ? `${requirementText.trim().slice(0, 140)}…`
      : requirementText.trim();

  const scenarios: DevScenario[] = [
    {
      id: devId('scenario'),
      title: `Successful end-to-end ${feature} flow`,
      description: 'Covers the primary positive path with valid data.',
      priority: 'high',
      test_cases: [
        mockCase(1, `Complete the ${feature} flow with valid data`, [
          'Open the screen that contains ' + feature,
          'Fill every required field with valid data',
          'Submit / confirm the flow',
          'Observe the result screen or confirmation',
        ], 'The flow completes without errors and a clear success confirmation is shown.', 'high', false),
        mockCase(2, `Minimum boundary values are accepted for ${feature}`, [
          'Open the ' + feature + ' flow',
          'Enter the smallest allowed value in each bounded field',
          'Submit the flow',
        ], 'Values at the minimum boundary are accepted and the flow proceeds normally.', 'medium', true),
        mockCase(3, `Entered progress is retained when leaving and returning`, [
          'Partially complete the ' + feature + ' flow',
          'Navigate away from the page, then return',
          'Check the previously entered data',
        ], 'Previously entered data is preserved, or the user is warned before it is discarded.', 'medium', true),
      ],
    },
    {
      id: devId('scenario'),
      title: 'Validation and error handling',
      description: 'Negative cases: empty input, invalid format, duplicate submission.',
      priority: 'high',
      test_cases: [
        mockCase(4, `Submit ${feature} with all required fields empty`, [
          'Open the ' + feature + ' flow',
          'Leave every required field empty',
          'Attempt to submit',
        ], 'Submission is blocked and inline validation messages identify each required field.', 'high', false),
        mockCase(5, `Invalid input format is rejected with a readable error`, [
          'Open the ' + feature + ' flow',
          'Enter malformed data (e.g. wrong email format, letters in a numeric field)',
          'Attempt to submit',
        ], 'A specific, human-readable error is shown and focus moves to the first invalid field.', 'high', true),
        mockCase(6, `Duplicate submission is prevented on double-click`, [
          'Fill the ' + feature + ' flow with valid data',
          'Double-click the submit button quickly',
          'Count the resulting submissions / records',
        ], 'Only one submission is processed; the control is disabled or the request is de-duplicated.', 'medium', true),
      ],
    },
    {
      id: devId('scenario'),
      title: 'Edge cases and state handling',
      description: 'Session loss, extreme input sizes, and concurrent access.',
      priority: 'medium',
      test_cases: [
        mockCase(7, `Session expires midway through ${feature}`, [
          'Start the ' + feature + ' flow',
          'Let the session expire (or clear the session manually)',
          'Continue and submit the flow',
        ], 'The user is prompted to authenticate again and entered data is not silently lost.', 'medium', true),
        mockCase(8, `Extremely long input (1000+ characters) is handled`, [
          'Open the ' + feature + ' flow',
          'Paste a 1000+ character string into a text field',
          'Submit the flow',
        ], 'The input is handled gracefully — truncated or rejected with a clear message, no crash or layout break.', 'low', true),
        mockCase(9, `Two tabs working on ${feature} at the same time`, [
          'Open the same ' + feature + ' record in two browser tabs',
          'Modify and save it from both tabs',
          'Reload both tabs and compare the result',
        ], 'No data corruption occurs and the final state matches a predictable last-write behavior.', 'low', true),
      ],
    },
  ];

  const totalCases = scenarios.reduce((sum, s) => sum + s.test_cases.length, 0);

  const plan: DevTestPlan = {
    id: devId('plan'),
    content_json: {
      overview: `[DEV MOCK] Simulated test plan for "${projectName}". The real app sends this requirement to the configured AI provider and stores its output. Requirement excerpt: "${excerpt}"`,
      scope: `[DEV MOCK] Functional coverage of ${feature}: positive flows, input validation, error handling, and state edge cases.`,
      out_of_scope: 'Performance, load, security, and browser-compatibility testing are out of scope for this simulated round.',
      testing_approach:
        'Manual scripted checks informed by equivalence partitioning and boundary value analysis on inputs, plus a decision table over the state combinations of the flow.',
      recommended_case_count: totalCases,
      recommendation_reason: `[DEV MOCK] Simulated response — no AI provider key is configured in this frontend-first environment, so a fixed fixture is served instead of real model output.`,
    },
    created_at: now,
    requirements: [{ raw_content: requirementText }],
    test_scenarios: scenarios,
  };

  addDevTestPlan(projectId, plan);

  // Response shape mirrors the real route exactly (plus the devMock label).
  return {
    testPlan: {
      id: plan.id,
      content_json: plan.content_json,
      created_at: plan.created_at,
    },
    scenarios: plan.test_scenarios,
    recommendedCaseCount: plan.content_json.recommended_case_count,
    recommendationReason: plan.content_json.recommendation_reason,
    devMock: true as const,
  };
}

export function buildMockCopilotReply(projectName: string | undefined, lastUserMessage: string): string {
  return [
    `[DEV MOCK] Simulated assistant reply${projectName ? ` for "${projectName}"` : ''} — no AI provider is configured in this frontend-first environment.`,
    lastUserMessage ? `You said: "${lastUserMessage.slice(0, 140)}${lastUserMessage.length > 140 ? '…' : ''}"` : '',
    // [PHASE 1] updated for the explicit Ask/Generate toggle — generation no
    // longer triggers from plain chat text, so the old "just type generate"
    // instruction would be wrong.
    `Switch the chat to Generate mode and paste a requirement to see simulated artifacts appear in the IDE panel.`,
  ]
    .filter(Boolean)
    .join('\n\n');
}
