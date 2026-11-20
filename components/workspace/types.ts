export type ArtifactType = 'testcases' | 'testplan';

export interface TC {
  id: string; // real test_cases.id (uuid)
  displayId: string; // e.g. "TC-001" for display
  title: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'approved' | 'draft' | 'review';
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
}

export const typeIcon: Record<ArtifactType, string> = {
  testcases: '✓',
  testplan: '📋',
};

export const typeLabel: Record<ArtifactType, string> = {
  testcases: 'Test Cases',
  testplan: 'Test Plan',
};
