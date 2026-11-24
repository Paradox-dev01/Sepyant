'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { FolderOpen } from 'lucide-react';
import { C, alpha } from '@/lib/theme';
import AppSidebar from '@/components/workspace/AppSidebar';
import IDEPanel from '@/components/workspace/IDEPanel';
import ChatPanel, { type ComposerPayload } from '@/components/workspace/ChatPanel';
import ResourcesDrawer from '@/components/workspace/ResourcesDrawer';
import { Divider } from '@/components/workspace/primitives';
import { toast } from '@/components/shell/Toast';
import { uid, useMockStore } from '@/lib/mock-store';
import { RESOURCES_KEY, RESOURCES_SEED, resourcesSeedFor, type ProjectResource } from '@/lib/qa-mock/resources';
import { generateMockOutput, OUTPUT_TYPES, type GeneratedOutput } from '@/lib/qa-mock/generation';
import { DOCUMENTS_KEY, DOCUMENTS_SEED, type DocType, type QaDocument } from '@/lib/qa-mock/documents';
import type { Artifact, Msg, TC, PlanItem, ChatMode } from '@/components/workspace/types';

type RawTestCase = {
  id: string;
  title: string;
  steps_json: string[];
  expected_result: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  approved: boolean;
  needs_verification: boolean;
  // Test-execution status straight from the DB (e.g. 'not_executed').
  status?: string;
  // Used for deterministic ordering of the display IDs (see planToArtifacts).
  created_at?: string;
};

type RawTestPlan = {
  id: string;
  content_json: Record<string, any>;
  created_at: string;
  // PostgREST embedded resources are ARRAYS (0..n rows), not single objects.
  // Typing this as an object previously broke `tsc` at page.tsx:60 and also
  // made the runtime accessor below silently read `undefined` off the array,
  // so reconstructed chat history lost the requirement text.
  requirements: { raw_content: string }[] | null;
  test_scenarios: { id: string; title: string; created_at?: string; test_cases: RawTestCase[] }[];
};

// created_at timestamp as a sortable number, falling back to the array index
// for rows without one (the dev mock store preserves insertion order).
function createdKey(value: string | undefined, fallback: number): number {
  const t = value ? Date.parse(value) : NaN;
  return Number.isNaN(t) ? fallback : t;
}

// [SEPYANT 2.1] Map a simulated generated output onto the structured content
// shape of the matching QA library document type, so "Save to project" files
// it into the existing document preview/edit surfaces.
function buildGeneratedDoc(
  output: GeneratedOutput,
  meta: { id: string; project: string; owner: string }
): QaDocument {
  type HBlock = { kind: 'h'; text: string };
  type PBlock = { kind: 'p'; text: string };
  type LBlock = { kind: 'list'; ordered?: boolean; items: string[] };
  type CBlock = { kind: 'code'; lang: string; filename?: string; code: string };
  type SBlock = { kind: 'stats'; items: { label: string; value: string; tone?: 'good' | 'warn' | 'bad' | 'neutral' }[] };
  type KBlock = { kind: 'kv'; items: { k: string; v: string }[] };
  const headings = output.blocks.filter((b) => b.kind === 'h') as HBlock[];
  const paragraphs = output.blocks.filter((b) => b.kind === 'p') as PBlock[];
  const lists = output.blocks.filter((b) => b.kind === 'list') as LBlock[];
  const codes = output.blocks.filter((b) => b.kind === 'code') as CBlock[];
  const stats = output.blocks.filter((b) => b.kind === 'stats') as SBlock[];
  const kvs = output.blocks.filter((b) => b.kind === 'kv') as KBlock[];

  const base = {
    id: meta.id,
    title: output.title,
    project: meta.project,
    status: 'draft' as const,
    owner: meta.owner,
    updatedAt: new Date().toISOString(),
    comments: [] as QaDocument['comments'],
    // [SEPYANT 2.1] traceability (names only — contents are never read in the demo)
    resourcesUsed: output.resourcesUsed,
  };

  switch (output.outputType) {
    case 'bug-report': {
      const kv = kvs.flatMap((k) => k.items);
      const find = (label: string) => kv.find((x) => x.k.toLowerCase() === label.toLowerCase())?.v || '';
      return {
        ...base,
        type: 'bug-report',
        content: {
          severity: (find('Severity').split('·')[0] || 'High').trim(),
          priority: (find('Severity').split('·')[1] || 'P1').trim(),
          environment: find('Environment') || 'Staging (demo)',
          steps: lists[0]?.items || [],
          expected: find('Expected') || 'Behaviour matches the specification.',
          actual: find('Actual') || 'To be recorded during execution.',
          attachments: output.resourcesUsed.filter((r) => r.kind === 'file').map((r) => r.name),
        },
      };
    }
    case 'regression-plan':
      return {
        ...base,
        type: 'regression-report',
        content: {
          impactAnalysis: paragraphs[0]?.text || 'Simulated impact analysis.',
          scenarios: lists.flatMap((l) => l.items).slice(0, 8),
          affectedCases: [],
        },
      };
    case 'qa-summary': {
      const items = stats[0]?.items || [];
      const num = (label: string) => parseInt(items.find((s) => s.label.toLowerCase().includes(label))?.value || '0', 10) || 0;
      const planned = num('planned');
      const executed = num('executed');
      const passRate = parseInt(items.find((s) => s.label.toLowerCase().includes('pass'))?.value || '0', 10) || 0;
      return {
        ...base,
        type: 'execution-summary',
        content: {
          totals: { passed: Math.round((executed * passRate) / 100) || 27, failed: num('open') || 2, blocked: 2, pending: Math.max(planned - executed, 0) || 17 },
          durationHours: 14,
          passRate,
          suites: [{ name: 'Simulated demo suites', passed: 27, failed: 2, blocked: 2, pending: 17 }],
          coveragePct: 68,
        },
      };
    }
    case 'automation-scripts': {
      const code = codes[0];
      return {
        ...base,
        type: 'tech-doc',
        content: {
          sections: [
            ...(headings[0] ? [{ heading: headings[0].text, body: paragraphs[0]?.text || '' }] : []),
            {
              heading: `Generated script${code?.filename ? ` — ${code.filename}` : ''}`,
              body: 'Template-generated starter script. It has not been executed — see Automation for the full generator.',
              code: code?.code,
            },
          ],
        },
      };
    }
    case 'tech-doc':
    case 'test-scenarios':
    default: {
      const sections: { heading: string; body: string; code?: string }[] = [];
      let current: { heading: string; body: string; code?: string } | null = null;
      for (const b of output.blocks) {
        if (b.kind === 'h') {
          if (current) sections.push(current);
          current = { heading: b.text, body: '' };
        } else if (b.kind === 'p' || b.kind === 'kv') {
          const text = b.kind === 'p' ? b.text : b.items.map((kv) => `${kv.k}: ${kv.v}`).join('\n');
          if (current) current.body += (current.body ? '\n' : '') + text;
          else sections.push({ heading: 'Notes', body: text });
        } else if (b.kind === 'list') {
          const text = b.items.map((it, i) => `${b.ordered ? `${i + 1}. ` : '- '}${it}`).join('\n');
          if (current) current.body += (current.body ? '\n' : '') + text;
          else sections.push({ heading: 'Notes', body: text });
        } else if (b.kind === 'code' && current) {
          current.code = b.code;
        } else if (b.kind === 'stats') {
          const text = b.items.map((s) => `${s.label}: ${s.value}`).join('\n');
          if (current) current.body += (current.body ? '\n' : '') + text;
        }
      }
      if (current) sections.push(current);
      return { ...base, type: 'tech-doc', content: { sections } };
    }
  }
}

// Turn one DB test_plan row into a "testplan" artifact + a "testcases" artifact,
// matching the two-artifact-per-generation-round pattern from the Figma design.
//
// [PHASE 1] Display IDs: `startNumber` continues ONE global TC-### sequence
// across every test plan of the project instead of each round restarting at
// TC-001 (which produced duplicate, unstable IDs). Rows are ordered by
// created_at before numbering so the same case keeps its number between
// loads (the nested Supabase select returns no guaranteed order).
function planToArtifacts(
  tp: RawTestPlan,
  roundIndex: number,
  startNumber: number
): { artifacts: Artifact[]; nextNumber: number } {
  const planItems: PlanItem[] = [
    { section: 'Overview', content: tp.content_json?.overview || '' },
    { section: 'Scope', content: tp.content_json?.scope || '' },
    { section: 'Out of Scope', content: tp.content_json?.out_of_scope || '' },
    { section: 'Testing Approach', content: tp.content_json?.testing_approach || '' },
  ].filter((p) => p.content);

  const allCases: TC[] = [];
  let caseCounter = startNumber;
  const scenarios = tp.test_scenarios
    .map((ts, i) => ({ ts, k: createdKey(ts.created_at, i) }))
    .sort((a, b) => a.k - b.k)
    .map(({ ts }) => ({
      ...ts,
      test_cases: ts.test_cases
        .map((tc, i) => ({ tc, k: createdKey(tc.created_at, i) }))
        .sort((a, b) => a.k - b.k)
        .map(({ tc }) => tc),
    }));
  scenarios.forEach((ts) => {
    ts.test_cases.forEach((tc) => {
      allCases.push({
        id: tc.id,
        displayId: `TC-${String(caseCounter++).padStart(3, '0')}`,
        title: tc.title,
        priority: tc.priority,
        // [PHASE 1] Approval/review state and test-execution state are now
        // separate: `approved`+`needs_verification` drive the review status;
        // the DB `status` column (untouched by review actions) is carried
        // through as the execution status.
        reviewStatus: tc.approved ? 'approved' : tc.needs_verification ? 'needs_review' : 'draft',
        executionStatus: tc.status || 'not_executed',
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
  return { artifacts, nextNumber: caseCounter };
}

function buildInitialState(testPlans: RawTestPlan[]) {
  const artifacts: Artifact[] = [];
  const messages: Msg[] = [];
  let caseNumber = 1;

  testPlans.forEach((tp, i) => {
    const reqText = tp.requirements?.[0]?.raw_content;
    if (reqText) messages.push({ role: 'user', content: reqText });

    const totalCases = tp.test_scenarios.reduce((sum, ts) => sum + ts.test_cases.length, 0);
    messages.push({
      role: 'ai',
      content: `Generated **Test Plan** and **${totalCases} test cases** across ${tp.test_scenarios.length} scenario(s). Available in the panel — review and approve what looks right.`,
    });

    const built = planToArtifacts(tp, i + 1, caseNumber);
    caseNumber = built.nextNumber;
    artifacts.push(...built.artifacts);
  });

  return { artifacts, messages, nextCaseNumber: caseNumber };
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
  // [PHASE 1] next global TC-### display number, continued by new generations.
  const [nextCaseNumber, setNextCaseNumber] = useState(initial.nextCaseNumber);
  const [streaming, setStreaming] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [sidebarW, setSidebarW] = useState(224);
  const [chatW, setChatW] = useState(340);
  const [roundCount, setRoundCount] = useState(initialTestPlans.length);
  // [SEPYANT 2.1] project resources (reusable) + the resources drawer.
  const [resourceMap, setResourceMap] = useMockStore<Record<string, ProjectResource[]>>(RESOURCES_KEY, RESOURCES_SEED);
  const [resourcesOpen, setResourcesOpen] = useState(false);
  // [SEPYANT 2.1] QA library store — "Save to project" files generated outputs here.
  const [docs, setDocs] = useMockStore<QaDocument[]>(DOCUMENTS_KEY, DOCUMENTS_SEED);
  const projectResources = useMemo<ProjectResource[]>(() => resourceMap[project.id] || resourcesSeedFor(project.id) || [], [resourceMap, project.id]);
  // [FRONTEND-FIRST FIX] Responsive defaults. SSR renders the original desktop
  // state; a client-only effect then adapts to small screens so the fixed-width
  // panes can't squeeze the IDE panel out of view on mobile/tablet.
  //  - <1024px: sidebar starts hidden (the existing "show sidebar" button works)
  //  - <768px:  chat also starts hidden and opens as a full-height overlay
  //  - >=1024px: original 3-pane desktop layout, byte-for-byte unchanged
  const [isMobile, setIsMobile] = useState(false);
  const [chatVisible, setChatVisible] = useState(true);
  useEffect(() => {
    const vw = window.innerWidth;
    if (vw < 768) {
      setIsMobile(true);
      setSidebarVisible(false);
      setChatVisible(false);
    } else if (vw < 1024) {
      setSidebarVisible(false);
      setChatW(Math.min(340, Math.max(280, vw - 480)));
    }
  }, []);

  const onSidebarDrag = useCallback((dx: number) => setSidebarW((w) => Math.max(160, Math.min(360, w + dx))), []);
  const onChatDrag = useCallback((dx: number) => setChatW((w) => Math.max(260, Math.min(520, w - dx))), []);

  // [PHASE 1] The mode is an explicit user choice (Ask / Generate toggle in
  // ChatPanel), not a keyword guess. Generate -> real test plan/case
  // generation endpoint (persists to DB, shows in IDE panel).
  // Ask -> conversational copilot endpoint.
  // [SEPYANT 2.1] the payload now carries attachments, reused project
  // resources, the chosen output type and framework; Test Plan / Test Cases
  // keep the exact endpoint flow, the six other output types produce a
  // clearly-labeled simulated output card in this conversation.
  async function handleSend(payload: ComposerPayload) {
    const { text, mode, outputType, framework, attachments, resourceIds } = payload;
    const reusedNames = resourceIds.map((id) => projectResources.find((r) => r.id === id)?.name).filter(Boolean) as string[];
    setMessages((prev) => [
      ...prev,
      {
        role: 'user',
        content: text || (attachments.length || reusedNames.length ? 'Generate from the attached context.' : ''),
        attachments: attachments.length ? attachments : undefined,
        resourceNames: reusedNames.length ? reusedNames : undefined,
      },
    ]);
    setStreaming(true);

    try {
      if (mode === 'generate' && !OUTPUT_TYPES.find((o) => o.id === outputType)?.usesEndpoint) {
        // -------- [SEPYANT 2.1] simulated demo output (no endpoint call) ---
        await new Promise((r) => window.setTimeout(r, 950));
        const output: GeneratedOutput = generateMockOutput({
          outputType,
          instructions: text,
          resources: [
            ...reusedNames.map((n) => ({ name: n, kind: (projectResources.find((r) => r.name === n)?.kind || 'file') as 'file' | 'url' })),
            ...attachments.map((a) => ({ name: a.name, kind: a.kind })),
          ],
          framework,
          projectName: project.name,
          demoUser: userEmail,
        });
        setMessages((prev) => [
          ...prev,
          {
            role: 'ai',
            content: `Simulated **${output.outputLabel}** — review it below, then edit, copy, download or save it to the project library.`,
            output,
          },
        ]);
      } else if (mode === 'generate') {
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
          // Continue the project-wide TC-### sequence instead of restarting
          // at TC-001 for every generation round.
          const built = planToArtifacts(rawPlan, nextRound, nextCaseNumber);
          setNextCaseNumber(built.nextNumber);
          setArtifacts((prev) => [...prev, ...built.artifacts]);
          const ctxNote = reusedNames.length || attachments.length ? ` Context: ${[...reusedNames, ...attachments.map((a) => a.name)].join(', ')} (names only — contents are not read in this demo).` : '';
          setMessages((prev) => [
            ...prev,
            {
              role: 'ai',
              content: `Generated **Test Plan** and **${totalCases} test cases** across ${data.scenarios.length} scenario(s).${
                data.recommendationReason ? `\n\n${data.recommendationReason}` : ''
              }${ctxNote}\n\nAvailable in the panel — review and approve what looks right.`,
              attachments: attachments.length ? attachments : undefined,
              resourceNames: reusedNames.length ? reusedNames : undefined,
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
        const ctxNote = reusedNames.length || attachments.length ? `\n\nContext noted from your request: ${[...reusedNames, ...attachments.map((a) => a.name)].join(', ')} — in this demo their contents are not read.` : '';
        setMessages((prev) => [
          ...prev,
          {
            role: 'ai',
            content: (res.ok ? data.reply : `Error: ${data.error || 'something went wrong'}`) + ctxNote,
            attachments: attachments.length ? attachments : undefined,
            resourceNames: reusedNames.length ? reusedNames : undefined,
          },
        ]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: 'ai', content: 'Network error. Try again.' }]);
    }
    setStreaming(false);
  }

  // -------- [SEPYANT 2.1] output-card callbacks ---------------------------

  /** Save a staged attachment permanently as a project resource. */
  function saveAttachmentAsResource(localId: string, att: { name: string; kind: 'file' | 'url'; size?: number }) {
    const now = new Date().toISOString();
    const resource: ProjectResource = {
      id: uid('res'),
      projectId: project.id,
      kind: att.kind,
      name: att.name,
      category: /require|prd/i.test(att.name) ? 'requirements' : /api/i.test(att.name) ? 'api-doc' : 'other',
      addedAt: now,
      addedBy: userEmail,
      size: att.size,
      excerpt: att.kind === 'file' ? 'Attached via the chat composer (demo) — content extraction requires the backend integration.' : undefined,
      url: att.kind === 'url' ? att.name : undefined,
    };
    setResourceMap((prev) => ({ ...prev, [project.id]: [resource, ...(prev[project.id] || resourcesSeedFor(project.id))] }));
    toast(`“${att.name}” saved to project resources`, 'success');
  }

  function saveOutputToProject(messageIndex: number): string | null {
    const msg = messages[messageIndex];
    const output = msg?.output;
    if (!output) return null;
    const doc = buildGeneratedDoc(output, { id: uid('doc'), project: project.name, owner: userEmail });
    setDocs((prev) => [doc, ...prev]);
    setMessages((prev) => prev.map((m, i) => (i === messageIndex ? { ...m, outputDocId: doc.id } : m)));
    toast(`Saved to ${project.name} — find it under the matching QA library section`, 'success');
    return doc.id;
  }

  function regenerateOutput(messageIndex: number) {
    const msg = messages[messageIndex];
    const prevUser = [...messages.slice(0, messageIndex)].reverse().find((m) => m.role === 'user');
    if (!msg?.output || !prevUser) return;
    setStreaming(true);
    window.setTimeout(() => {
      const output = generateMockOutput({
        outputType: msg.output!.outputType,
        instructions: prevUser.content,
        resources: msg.output!.resourcesUsed,
        framework: msg.output!.framework,
        projectName: project.name,
        demoUser: userEmail,
      });
      setMessages((prev) => prev.map((m, i) => (i === messageIndex ? { ...m, output, outputDocId: null } : m)));
      setStreaming(false);
      toast('Regenerated (simulated demo)', 'info');
    }, 900);
  }

  function refineOutput(messageIndex: number, instructions: string) {
    const msg = messages[messageIndex];
    if (!msg?.output) return;
    setStreaming(true);
    setMessages((prev) => [...prev, { role: 'user', content: `Refine: ${instructions}` }]);
    window.setTimeout(() => {
      const output = generateMockOutput({
        outputType: msg.output!.outputType,
        instructions: `${msg.output!.instructions ? msg.output!.instructions + ' ' : ''}${instructions}`,
        resources: msg.output!.resourcesUsed,
        framework: msg.output!.framework,
        projectName: project.name,
        demoUser: userEmail,
      });
      setMessages((prev) => [
        ...prev,
        { role: 'ai', content: `Refined the **${output.outputLabel}** with your additional instructions — updated version below.`, output },
      ]);
      setStreaming(false);
    }, 900);
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
            aria-label="Show sidebar"
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
        <div style={{ padding: '8px 20px', borderBottom: `1px solid ${C.border}`, fontSize: 12, color: C.fgMuted, paddingLeft: sidebarVisible ? 20 : 36, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{project.name}</span>
          {/* [SEPYANT 2.1] project resources entry point */}
          <button
            onClick={() => setResourcesOpen(true)}
            title="Project resources — files and URLs reusable across conversations"
            aria-label={`Project resources (${projectResources.length})`}
            style={{
              marginLeft: 'auto',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11.5,
              fontWeight: 500,
              padding: '4px 10px',
              borderRadius: 6,
              border: `1px solid ${C.border}`,
              background: 'transparent',
              color: C.fgDim,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <FolderOpen size={12} />
            Resources
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: C.fgMuted, border: `1px solid ${C.border}`, borderRadius: 999, padding: '0 5px' }}>{projectResources.length}</span>
          </button>
        </div>
        <IDEPanel artifacts={artifacts} onUpdate={setArtifacts} />

        {/* [FRONTEND-FIRST FIX] floating toggle to bring the chat back when hidden */}
        {!chatVisible && (
          <button
            onClick={() => setChatVisible(true)}
            title="Show chat"
            aria-label="Show chat"
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
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
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          </button>
        )}
      </div>

      {chatVisible && !isMobile && <Divider onDrag={onChatDrag} />}

      {chatVisible && (
        <div
          style={
            isMobile
              ? {
                  // Overlay drawer on mobile so the IDE panel keeps its width.
                  position: 'fixed',
                  top: 0,
                  right: 0,
                  bottom: 0,
                  width: 'min(340px, calc(100vw - 32px))',
                  zIndex: 100,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  borderLeft: `1px solid ${C.border}`,
                  boxShadow: '-8px 0 24px rgba(0,0,0,0.5)',
                }
              : {
                  width: chatW,
                  flexShrink: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  borderLeft: `1px solid ${C.border}`,
                }
          }
        >
          <ChatPanel
            messages={messages}
            streaming={streaming}
            onSend={handleSend}
            projectId={project.id}
            projectName={project.name}
            demoUser={userEmail}
            projectResources={projectResources}
            onSaveAttachmentAsResource={saveAttachmentAsResource}
            onRegenerateOutput={regenerateOutput}
            onRefineOutput={refineOutput}
            onSaveOutputToProject={saveOutputToProject}
          />
        </div>
      )}

      {/* [SEPYANT 2.1] project resources slide-over */}
      {resourcesOpen && <ResourcesDrawer projectId={project.id} projectName={project.name} demoUser={userEmail} onClose={() => setResourcesOpen(false)} />}

      {/* [FRONTEND-FIRST FIX] close button over the mobile chat overlay */}
      {isMobile && chatVisible && (
        <button
          onClick={() => setChatVisible(false)}
          title="Hide chat"
          aria-label="Hide chat"
          style={{
            position: 'fixed',
            top: 8,
            right: 8,
            zIndex: 110,
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
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
