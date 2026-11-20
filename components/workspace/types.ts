export type ArtifactType = 'testcases' | 'testplan';

// Review/approval workflow state (draft -> review -> approved). Derived from
// the DB's `approved` + `needs_verification` flags — this is about REVIEWING
// the AI's work, NOT about whether the case has been executed.
export type ReviewStatus = 'approved' | 'needs_review' | 'draft';

export interface TC {
  id: string; // real test_cases.id (uuid)
  displayId: string; // e.g. "TC-007" for display
  title: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  reviewStatus: ReviewStatus;
  // Test-execution status, straight from test_cases.status ('not_executed',
  // 'passed', ...). Kept separate from reviewStatus: executing a case is a
  // Phase 2 concern (test_executions), editing/approving must not touch it.
  executionStatus: string;
  steps: string[];
  expected: string;
  needsVerification: boolean;
}

export interface PlanItem {
  section: string;
  content: string;
}

export interface Artifact {
  id: string;
  type: ArtifactType;
  label: string;
  cases?: TC[];
  plan?: PlanItem[];
}

export interface Msg {
  role: 'user' | 'ai';
  content: string;
  // [SEPYANT 2.1] context that travelled with this message (demo snapshot —
  // names only; file contents are never uploaded or analysed).
  attachments?: { name: string; kind: 'file' | 'url' }[];
  resourceNames?: string[]; // reused project resources (display names)
  // AI messages: a simulated generated output rendered as an OutputCard.
  output?: import('@/lib/qa-mock/generation').GeneratedOutput;
  outputDocId?: string | null; // set once the output is saved to the library
}

// [PHASE 1] Explicit chat intent. Generation and Q&A hit different endpoints;
// the user picks the mode instead of the app guessing from keywords.
export type ChatMode = 'ask' | 'generate';

export const typeIcon: Record<ArtifactType, string> = {
  testcases: '✓',
  testplan: '📋',
};

export const typeLabel: Record<ArtifactType, string> = {
  testcases: 'Test Cases',
  testplan: 'Test Plan',
};
