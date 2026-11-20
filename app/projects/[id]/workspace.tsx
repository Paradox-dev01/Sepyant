'use client';

import { useState, useCallback } from 'react';
import { C } from '@/lib/theme';
import AppSidebar from '@/components/workspace/AppSidebar';
import IDEPanel from '@/components/workspace/IDEPanel';
import ChatPanel from '@/components/workspace/ChatPanel';
import { Divider } from '@/components/workspace/primitives';
import type { Artifact, Msg, TC, PlanItem } from '@/components/workspace/types';

type RawTestCase = {
  id: string;
  title: string;
  steps_json: string[];
  expected_result: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  approved: boolean;
  needs_verification: boolean;
};

type RawTestPlan = {
  id: string;
  content_json: Record<string, any>;
  created_at: string;
  requirements: { raw_content: string } | null;
  test_scenarios: { id: string; title: string; test_cases: RawTestCase[] }[];
};

// Turn one DB test_plan row into a "testplan" artifact + a "testcases" artifact,
// matching the two-artifact-per-generation-round pattern from the Figma design.
function planToArtifacts(tp: RawTestPlan, roundIndex: number): Artifact[] {
  const planItems: PlanItem[] = [
    { section: 'Overview', content: tp.content_json?.overview || '' },
    { section: 'Scope', content: tp.content_json?.scope || '' },
    { section: 'Out of Scope', content: tp.content_json?.out_of_scope || '' },
    { section: 'Testing Approach', content: tp.content_json?.testing_approach || '' },
  ].filter((p) => p.content);

  const allCases: TC[] = [];
  let caseCounter = 1;
  tp.test_scenarios.forEach((ts) => {
    ts.test_cases.forEach((tc) => {
      allCases.push({
        id: tc.id,
        displayId: `TC-${String(caseCounter++).padStart(3, '0')}`,
        title: tc.title,
        priority: tc.priority,
        status: tc.approved ? 'approved' : tc.needs_verification ? 'review' : 'draft',
        steps: tc.steps_json || [],
        expected: tc.expected_result,
        needsVerification: tc.needs_verification,
      });
    });
  });

  const artifacts: Artifact[] = [];
  if (planItems.length) {
    artifacts.push({ id: `${tp.id}-plan`, type: 'testplan', label: `Test Plan ${roundIndex}`, plan: planItems });
  }
  if (allCases.length) {
    artifacts.push({ id: `${tp.id}-cases`, type: 'testcases', label: `Test Cases ${roundIndex}`, cases: allCases });
  }
  return artifacts;
}

function buildInitialState(testPlans: RawTestPlan[]) {
  const artifacts: Artifact[] = [];
  const messages: Msg[] = [];

  testPlans.forEach((tp, i) => {
    const reqText = tp.requirements?.raw_content;
    if (reqText) messages.push({ role: 'user', content: reqText });

    const totalCases = tp.test_scenarios.reduce((sum, ts) => sum + ts.test_cases.length, 0);
    messages.push({
      role: 'ai',
      content: `Generated **Test Plan** and **${totalCases} test cases** across ${tp.test_scenarios.length} scenario(s). Available in the panel — review and approve what looks right.`,
    });

    artifacts.push(...planToArtifacts(tp, i + 1));
  });

  return { artifacts, messages };
}

// Heuristic: does this message read like a generation request, or a general
// question? Generation -> real test plan/case generation endpoint (persists
// to DB, shows in IDE panel). Question -> conversational copilot endpoint.
function looksLikeGenerationRequest(text: string) {
  const m = text.toLowerCase();
  return (
    m.includes('generate') ||
    m.includes('test case') ||
    m.includes('test plan') ||
    m.includes('scenario') ||
    m.includes('create test') ||
    m.includes('negative case') ||
    m.includes('for the following') ||
    m.includes('requirement')
  );
}

export default function Workspace({
  project,
  allProjects,
  initialTestPlans,
  userEmail,
}: {
  project: { id: string; name: string };
  allProjects: { id: string; name: string }[];
  initialTestPlans: RawTestPlan[];
  userEmail: string;
}) {
  const initial = buildInitialState(initialTestPlans);
  const [artifacts, setArtifacts] = useState<Artifact[]>(initial.artifacts);
  const [messages, setMessages] = useState<Msg[]>(initial.messages);
  const [streaming, setStreaming] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [sidebarW, setSidebarW] = useState(224);
  const [chatW, setChatW] = useState(340);
  const [roundCount, setRoundCount] = useState(initialTestPlans.length);

  const onSidebarDrag = useCallback((dx: number) => setSidebarW((w) => Math.max(160, Math.min(360, w + dx))), []);
  const onChatDrag = useCallback((dx: number) => setChatW((w) => Math.max(260, Math.min(520, w - dx))), []);

  async function handleSend(text: string) {
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setStreaming(true);

    try {
      if (looksLikeGenerationRequest(text)) {
        const res = await fetch('/api/ai/generate-test-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: project.id, requirementText: text }),
        });
        const data = await res.json();

        if (!res.ok) {
          setMessages((prev) => [...prev, { role: 'ai', content: `Couldn't generate that: ${data.error || 'unknown error'}` }]);
        } else {
          const nextRound = roundCount + 1;
          setRoundCount(nextRound);

          const totalCases = (data.scenarios || []).reduce((sum: number, s: any) => sum + (s.test_cases?.length || 0), 0);
          const rawPlan: RawTestPlan = {
            id: data.testPlan.id,
            content_json: data.testPlan.content_json,
            created_at: data.testPlan.created_at,
            requirements: null,
            test_scenarios: data.scenarios,
          };
          setArtifacts((prev) => [...prev, ...planToArtifacts(rawPlan, nextRound)]);
          setMessages((prev) => [
            ...prev,
            {
              role: 'ai',
              content: `Generated **Test Plan** and **${totalCases} test cases** across ${data.scenarios.length} scenario(s).${
                data.recommendationReason ? `\n\n${data.recommendationReason}` : ''
              }\n\nAvailable in the panel — review and approve what looks right.`,
            },
          ]);
        }
      } else {
        const res = await fetch('/api/ai/copilot-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: project.id, messages: [...messages, { role: 'user', content: text }].map((m) => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.content })) }),
        });
        const data = await res.json();
        setMessages((prev) => [...prev, { role: 'ai', content: res.ok ? data.reply : `Error: ${data.error || 'something went wrong'}` }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: 'ai', content: 'Network error. Try again.' }]);
    }
    setStreaming(false);
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: C.bg, color: C.fg, overflow: 'hidden' }}>
      <AppSidebar
        currentProjectId={project.id}
        projects={allProjects}
        userEmail={userEmail}
        visible={sidebarVisible}
        onHide={() => setSidebarVisible(false)}
        width={sidebarW}
      />
      {sidebarVisible && <Divider onDrag={onSidebarDrag} />}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, position: 'relative' }}>
        {!sidebarVisible && (
          <button
            onClick={() => setSidebarVisible(true)}
            title="Show sidebar"
            style={{
              position: 'absolute',
              top: 8,
              left: 8,
              zIndex: 20,
              background: C.surface,
              border: `1px solid ${C.border}`,
              color: C.fgMuted,
              cursor: 'pointer',
              padding: '4px 6px',
              borderRadius: 6,
              display: 'flex',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>
        )}
        <div style={{ padding: '8px 20px', borderBottom: `1px solid ${C.border}`, fontSize: 12, color: C.fgMuted, paddingLeft: sidebarVisible ? 20 : 36 }}>
          {project.name}
        </div>
        <IDEPanel artifacts={artifacts} onUpdate={setArtifacts} />
      </div>

      <Divider onDrag={onChatDrag} />

      <div style={{ width: chatW, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderLeft: `1px solid ${C.border}` }}>
        <ChatPanel messages={messages} streaming={streaming} onSend={handleSend} />
      </div>
    </div>
  );
}
