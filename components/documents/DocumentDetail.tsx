'use client';

// ============================================================================
// [SEPYANT 2.0] Document detail surface (Phase 3). Renders any QaDocument
// (bug report, test plan, test-case set, execution summary, tech doc,
// regression report) in a professional preview, with a structured edit mode
// and a comment rail (Phase 6 tie-in). 100% frontend: data lives in the
// localStorage-backed mock store, seeded from lib/qa-mock/documents.ts.
// ============================================================================

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Check,
  Ellipsis,
  Inbox,
  Paperclip,
  Pencil,
  Plus,
  Send,
  Trash2,
} from 'lucide-react';
import { C, alpha } from '@/lib/theme';
import {
  DOC_STATUS_META,
  DOC_STATUS_OPTIONS,
  DOC_TYPE_META,
  DOCUMENTS_KEY,
  DOCUMENTS_SEED,
  docFilename,
  documentToMarkdown,
  registerDocsForPalette,
  type AffectedCase,
  type BugReportContent,
  type DocStatus,
  type ExecutionSummaryContent,
  type QaDocument,
  type RegressionReportContent,
  type SuiteResult,
  type TestCaseContent,
  type TestCaseSetContent,
  type TechDocContent,
  type TechDocSection,
  type TestPlanContent,
} from '@/lib/qa-mock/documents';
import { copyText, downloadText, relTime, uid, useMockStore } from '@/lib/mock-store';
import { toast } from '@/components/shell/Toast';
import AppShell from '@/components/shell/AppShell';
import {
  Avatar,
  Button,
  Chip,
  EmptyState,
  Field,
  IconBtn,
  inputStyle,
  Menu,
  Modal,
  Select,
} from '@/components/shell/bits';

// ------------------------------------------------------------- constants

type Scope = 'bug-reports' | 'test-plans' | 'reports';

const SCOPE_BACK: Record<Scope, { href: string; label: string }> = {
  'bug-reports': { href: '/bug-reports', label: 'Bug reports' },
  'test-plans': { href: '/test-plans', label: 'Test plans & cases' },
  reports: { href: '/reports', label: 'Reports & docs' },
};

function scopeForType(type: QaDocument['type']): Scope {
  if (type === 'bug-report') return 'bug-reports';
  if (type === 'test-plan' || type === 'test-case-set') return 'test-plans';
  return 'reports';
}

const SEVERITY_OPTIONS = ['Critical', 'High', 'Medium', 'Low'].map((v) => ({ value: v, label: v }));
const PRIORITY_OPTIONS = ['critical', 'high', 'medium', 'low'].map((v) => ({ value: v, label: v }));
const TONE_COLOR: Record<string, string> = {
  critical: C.danger,
  high: C.warning,
  medium: C.accent,
  low: C.fgMuted,
};
function toneColor(v: string): string {
  return TONE_COLOR[v.trim().toLowerCase()] ?? C.fgMuted;
}

// ------------------------------------------------------------ style bits

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  color: C.fgMuted,
  fontFamily: 'var(--font-mono)',
  margin: '0 0 8px',
};

const paragraphStyle: React.CSSProperties = { fontSize: 12.5, color: C.fg, lineHeight: 1.6, margin: 0 };

const olStyle: React.CSSProperties = { margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 };
const liStyle: React.CSSProperties = { fontSize: 12.5, color: C.fg, lineHeight: 1.55 };
const ulStyle: React.CSSProperties = { margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 5 };
const ulLiStyle: React.CSSProperties = { fontSize: 12.5, color: C.fgDim, lineHeight: 1.5 };

const twoColStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: 12,
};

const tableWrapStyle: React.CSSProperties = { overflowX: 'auto' };

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  color: C.fgMuted,
  fontFamily: 'var(--font-mono)',
  padding: '7px 10px',
  borderBottom: `1px solid ${C.border}`,
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  fontSize: 12,
  color: C.fg,
  padding: '8px 10px',
  borderBottom: `1px solid ${C.border}`,
  verticalAlign: 'top',
};

const tdNumStyle: React.CSSProperties = {
  ...tdStyle,
  textAlign: 'right',
  fontFamily: 'var(--font-mono)',
  whiteSpace: 'nowrap',
};

const codeStyle: React.CSSProperties = {
  background: C.bg,
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  padding: '12px 14px',
  fontFamily: 'var(--font-mono)',
  fontSize: 11.5,
  color: C.fg,
  whiteSpace: 'pre-wrap',
  overflowX: 'auto',
  lineHeight: 1.6,
  margin: 0,
};

const textareaStyle: React.CSSProperties = { ...inputStyle, minHeight: 74, resize: 'vertical', lineHeight: 1.55 };

const stackStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 18 };

function Panel({ color, label, children }: { color: string; label: string; children: React.ReactNode }) {
  return (
    <div style={{ background: alpha(color, 5), border: `1px solid ${alpha(color, 18)}`, borderRadius: 8, padding: '12px 14px', minWidth: 0 }}>
      <div style={{ ...sectionLabelStyle, color }}>{label}</div>
      {children}
    </div>
  );
}

function ChecklistItem({ text, color }: { text: string; color: string }) {
  return (
    <li style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5, color: C.fgDim, lineHeight: 1.5 }}>
      <span style={{ color, display: 'flex', flexShrink: 0, marginTop: 2 }} aria-hidden="true">
        <Check size={13} />
      </span>
      <span>{text}</span>
    </li>
  );
}

// ============================================================================
// Preview renderers (one per document type)
// ============================================================================

function BugReportPreview({ content }: { content: BugReportContent }) {
  return (
    <div style={stackStyle}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }} role="list" aria-label="Severity and priority">
        <span role="listitem"><Chip color={toneColor(content.severity)}>{content.severity} severity</Chip></span>
        <span role="listitem"><Chip color={C.accent}>{content.priority} priority</Chip></span>
      </div>

      <section aria-label="Environment">
        <div style={sectionLabelStyle}>Environment</div>
        <div
          style={{
            background: C.surface2,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: '10px 12px',
            fontSize: 12,
            color: C.fgDim,
            fontFamily: 'var(--font-mono)',
            wordBreak: 'break-word',
          }}
        >
          {content.environment}
        </div>
      </section>

      <section aria-label="Steps to reproduce">
        <div style={sectionLabelStyle}>Steps to reproduce</div>
        <ol style={olStyle}>
          {content.steps.map((s, i) => (
            <li key={i} style={liStyle}>
              {s}
            </li>
          ))}
        </ol>
      </section>

      <div style={twoColStyle}>
        <Panel color={C.success} label="Expected">
          <p style={paragraphStyle}>{content.expected}</p>
        </Panel>
        <Panel color={C.danger} label="Actual">
          <p style={paragraphStyle}>{content.actual}</p>
        </Panel>
      </div>

      {content.attachments.length > 0 && (
        <section aria-label="Attachments">
          <div style={sectionLabelStyle}>Attachments</div>
          <ul style={{ ...ulStyle, paddingLeft: 0, listStyle: 'none' }}>
            {content.attachments.map((a, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.fgDim }}>
                <span style={{ color: C.fgMuted, display: 'flex', flexShrink: 0 }} aria-hidden="true">
                  <Paperclip size={12} />
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>{a}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function TestPlanPreview({ content }: { content: TestPlanContent }) {
  return (
    <div style={stackStyle}>
      <section aria-label="Objectives">
        <div style={sectionLabelStyle}>Objectives</div>
        <p style={{ ...paragraphStyle, fontSize: 13, color: C.fgDim, lineHeight: 1.65 }}>{content.objectives}</p>
      </section>

      <div style={twoColStyle}>
        <Panel color={C.success} label="In scope">
          <ul style={ulStyle}>
            {content.scopeIn.map((s, i) => (
              <li key={i} style={ulLiStyle}>{s}</li>
            ))}
          </ul>
        </Panel>
        <Panel color={C.fgMuted} label="Out of scope">
          <ul style={ulStyle}>
            {content.scopeOut.map((s, i) => (
              <li key={i} style={ulLiStyle}>{s}</li>
            ))}
          </ul>
        </Panel>
      </div>

      <section aria-label="Test strategy">
        <div style={sectionLabelStyle}>Test strategy</div>
        <p style={{ ...paragraphStyle, color: C.fgDim, lineHeight: 1.65 }}>{content.strategy}</p>
      </section>

      <div style={twoColStyle}>
        <section aria-label="Resources" style={{ minWidth: 0 }}>
          <div style={sectionLabelStyle}>Resources</div>
          <ul style={ulStyle}>
            {content.resources.map((r, i) => (
              <li key={i} style={ulLiStyle}>{r}</li>
            ))}
          </ul>
        </section>
        <Panel color={C.warning} label="Risks">
          <ul style={ulStyle}>
            {content.risks.map((r, i) => (
              <li key={i} style={{ ...ulLiStyle, color: C.fg }}>{r}</li>
            ))}
          </ul>
        </Panel>
      </div>

      <div style={twoColStyle}>
        <Panel color={C.accent} label="Entry criteria">
          <ul style={{ ...ulStyle, paddingLeft: 0, listStyle: 'none' }}>
            {content.entryCriteria.map((c, i) => (
              <ChecklistItem key={i} text={c} color={C.accent} />
            ))}
          </ul>
        </Panel>
        <Panel color={C.success} label="Exit criteria">
          <ul style={{ ...ulStyle, paddingLeft: 0, listStyle: 'none' }}>
            {content.exitCriteria.map((c, i) => (
              <ChecklistItem key={i} text={c} color={C.success} />
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function TestCaseSetPreview({ content }: { content: TestCaseSetContent }) {
  const { cases } = content;
  const byPriority = ['critical', 'high', 'medium', 'low']
    .map((p) => ({ p, n: cases.filter((c) => c.priority === p).length }))
    .filter((x) => x.n > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }} role="list" aria-label="Case summary">
        <span role="listitem"><Chip color={C.accent}>{cases.length} test cases</Chip></span>
        {byPriority.map(({ p, n }) => (
          <span role="listitem" key={p}>
            <Chip color={toneColor(p)}>{n} {p}</Chip>
          </span>
        ))}
      </div>

      {cases.map((tc) => (
        <article
          key={tc.id}
          aria-label={`Test case ${tc.id}`}
          style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: '12px 14px', background: C.surface2, minWidth: 0 }}
        >
          <header style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
            <Chip color={C.accent}>{tc.id}</Chip>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: C.fg, margin: 0, flex: '1 1 180px', minWidth: 0 }}>{tc.title}</h3>
            <Chip color={toneColor(tc.priority)}>{tc.priority}</Chip>
            {tc.category && <Chip color={C.fgMuted}>{tc.category}</Chip>}
          </header>

          {tc.preconditions && (
            <p style={{ fontSize: 11.5, color: C.fgMuted, margin: '0 0 8px', lineHeight: 1.5 }}>
              <span style={{ fontWeight: 600, color: C.fgDim }}>Preconditions: </span>
              {tc.preconditions}
            </p>
          )}

          <ol style={olStyle}>
            {tc.steps.map((s, i) => (
              <li key={i} style={{ ...liStyle, fontSize: 12, color: C.fgDim }}>{s}</li>
            ))}
          </ol>

          <p style={{ fontSize: 12, color: C.fg, margin: '10px 0 0', lineHeight: 1.55 }}>
            <span style={{ fontWeight: 600, color: C.success }}>Expected: </span>
            {tc.expected}
          </p>
        </article>
      ))}
    </div>
  );
}

function ExecutionSummaryPreview({ content }: { content: ExecutionSummaryContent }) {
  const t = content.totals;
  const kpis: { label: string; value: number; color: string }[] = [
    { label: 'Passed', value: t.passed, color: C.success },
    { label: 'Failed', value: t.failed, color: C.danger },
    { label: 'Blocked', value: t.blocked, color: C.warning },
    { label: 'Pending', value: t.pending, color: C.fgMuted },
  ];
  return (
    <div style={stackStyle}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }} role="list" aria-label="Execution totals">
        {kpis.map((k) => (
          <div key={k.label} role="listitem" style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '12px 14px' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: k.color, lineHeight: 1.1, fontFamily: 'var(--font-mono)' }}>{k.value}</div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: C.fgMuted, fontFamily: 'var(--font-mono)', marginTop: 4 }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }} role="list" aria-label="Key metrics">
        <span role="listitem"><Chip color={C.success}>{content.passRate}% pass rate</Chip></span>
        <span role="listitem"><Chip color={C.accent}>{content.durationHours}h executed</Chip></span>
        <span role="listitem"><Chip color={C.ai}>{content.coveragePct}% coverage</Chip></span>
      </div>

      <section aria-label="Results by suite">
        <div style={sectionLabelStyle}>Results by suite</div>
        <div style={tableWrapStyle}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 420 }}>
            <thead>
              <tr>
                <th style={thStyle}>Suite</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Passed</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Failed</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Blocked</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Pending</th>
              </tr>
            </thead>
            <tbody>
              {content.suites.map((s) => (
                <tr key={s.name}>
                  <td style={tdStyle}>{s.name}</td>
                  <td style={{ ...tdNumStyle, color: s.passed > 0 ? C.success : C.fgMuted }}>{s.passed}</td>
                  <td style={{ ...tdNumStyle, color: s.failed > 0 ? C.danger : C.fgMuted }}>{s.failed}</td>
                  <td style={{ ...tdNumStyle, color: s.blocked > 0 ? C.warning : C.fgMuted }}>{s.blocked}</td>
                  <td style={tdNumStyle}>{s.pending}</td>
                </tr>
              ))}
              <tr>
                <td style={{ ...tdStyle, fontWeight: 700 }}>Total</td>
                <td style={{ ...tdNumStyle, fontWeight: 700 }}>{t.passed}</td>
                <td style={{ ...tdNumStyle, fontWeight: 700 }}>{t.failed}</td>
                <td style={{ ...tdNumStyle, fontWeight: 700 }}>{t.blocked}</td>
                <td style={{ ...tdNumStyle, fontWeight: 700 }}>{t.pending}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function TechDocPreview({ content }: { content: TechDocContent }) {
  return (
    <div>
      {content.sections.map((s, i) => (
        <section key={i} aria-label={s.heading} style={{ marginBottom: i === content.sections.length - 1 ? 0 : 20 }}>
          <h2 style={{ fontSize: 14.5, fontWeight: 600, color: C.fg, margin: '0 0 8px', letterSpacing: '-0.01em' }}>{s.heading}</h2>
          <p style={{ ...paragraphStyle, color: C.fgDim, lineHeight: 1.65 }}>{s.body}</p>
          {s.code && s.code.trim().length > 0 && <pre style={{ ...codeStyle, marginTop: 10 }}>{s.code}</pre>}
        </section>
      ))}
    </div>
  );
}

function RegressionPreview({ content }: { content: RegressionReportContent }) {
  return (
    <div style={stackStyle}>
      <section aria-label="Impact analysis">
        <div style={sectionLabelStyle}>Impact analysis</div>
        <p style={{ ...paragraphStyle, color: C.fgDim, lineHeight: 1.65 }}>{content.impactAnalysis}</p>
      </section>

      <section aria-label="Suggested regression scenarios">
        <div style={sectionLabelStyle}>Suggested regression scenarios</div>
        <ol style={olStyle}>
          {content.scenarios.map((s, i) => (
            <li key={i} style={liStyle}>{s}</li>
          ))}
        </ol>
      </section>

      <section aria-label="Affected cases">
        <div style={sectionLabelStyle}>Affected cases ({content.affectedCases.length})</div>
        <div style={tableWrapStyle}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
            <thead>
              <tr>
                <th style={thStyle}>ID</th>
                <th style={thStyle}>Title</th>
                <th style={thStyle}>Reason</th>
              </tr>
            </thead>
            <tbody>
              {content.affectedCases.map((a) => (
                <tr key={a.id}>
                  <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', color: C.accent }}>{a.id}</td>
                  <td style={tdStyle}>{a.title}</td>
                  <td style={{ ...tdStyle, color: C.fgDim }}>{a.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function PreviewBody({ doc }: { doc: QaDocument }) {
  switch (doc.type) {
    case 'bug-report':
      return <BugReportPreview content={doc.content} />;
    case 'test-plan':
      return <TestPlanPreview content={doc.content} />;
    case 'test-case-set':
      return <TestCaseSetPreview content={doc.content} />;
    case 'execution-summary':
      return <ExecutionSummaryPreview content={doc.content} />;
    case 'tech-doc':
      return <TechDocPreview content={doc.content} />;
    case 'regression-report':
      return <RegressionPreview content={doc.content} />;
  }
}

// ============================================================================
// Edit mode — structured editors (one per document type + shared helpers)
// ============================================================================

function StringListEditor({
  label,
  items,
  onChange,
  placeholder,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
}) {
  return (
    <div role="group" aria-label={label}>
      <div style={sectionLabelStyle}>{label}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              style={{ ...inputStyle, flex: 1, minWidth: 0 }}
              value={item}
              placeholder={placeholder}
              aria-label={`${label} — item ${i + 1}`}
              onChange={(e) => onChange(items.map((v, j) => (j === i ? e.target.value : v)))}
            />
            <IconBtn label={`Remove ${label} item ${i + 1}`} danger onClick={() => onChange(items.filter((_, j) => j !== i))}>
              <Trash2 size={13} />
            </IconBtn>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 8 }}>
        <Button small onClick={() => onChange([...items, ''])}>
          <Plus size={12} /> Add item
        </Button>
      </div>
    </div>
  );
}

function NumInput({ label, value, onChange, step }: { label: string; value: number; onChange: (n: number) => void; step?: number }) {
  return (
    <Field label={label}>
      <input
        type="number"
        min={0}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => {
          const n = Number(e.target.value);
          onChange(Number.isFinite(n) ? n : 0);
        }}
        style={inputStyle}
      />
    </Field>
  );
}

function CommonEditor({ draft, onChange }: { draft: QaDocument; onChange: (d: QaDocument) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
      <Field label="Title">
        <input style={inputStyle} value={draft.title} aria-label="Title" onChange={(e) => onChange({ ...draft, title: e.target.value })} />
      </Field>
      <Field label="Owner">
        <input style={inputStyle} value={draft.owner} aria-label="Owner" onChange={(e) => onChange({ ...draft, owner: e.target.value })} />
      </Field>
      <Field label="Project">
        <input style={inputStyle} value={draft.project} aria-label="Project" onChange={(e) => onChange({ ...draft, project: e.target.value })} />
      </Field>
      <Field label="Status">
        <Select
          value={draft.status}
          onChange={(v) => onChange({ ...draft, status: v as DocStatus })}
          options={DOC_STATUS_OPTIONS}
          ariaLabel="Status"
        />
      </Field>
    </div>
  );
}

function BugReportEditor({ value, onChange }: { value: BugReportContent; onChange: (c: BugReportContent) => void }) {
  return (
    <div style={{ ...stackStyle, gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <Field label="Severity">
          <Select value={value.severity} onChange={(v) => onChange({ ...value, severity: v })} options={SEVERITY_OPTIONS} ariaLabel="Severity" />
        </Field>
        <Field label="Priority">
          <input style={inputStyle} value={value.priority} aria-label="Priority" onChange={(e) => onChange({ ...value, priority: e.target.value })} />
        </Field>
      </div>
      <Field label="Environment">
        <input style={inputStyle} value={value.environment} aria-label="Environment" onChange={(e) => onChange({ ...value, environment: e.target.value })} />
      </Field>
      <StringListEditor label="Steps" items={value.steps} onChange={(steps) => onChange({ ...value, steps })} placeholder="Step description" />
      <div style={twoColStyle}>
        <Field label="Expected result">
          <textarea style={textareaStyle} value={value.expected} onChange={(e) => onChange({ ...value, expected: e.target.value })} />
        </Field>
        <Field label="Actual result">
          <textarea style={textareaStyle} value={value.actual} onChange={(e) => onChange({ ...value, actual: e.target.value })} />
        </Field>
      </div>
      <StringListEditor label="Attachments" items={value.attachments} onChange={(attachments) => onChange({ ...value, attachments })} placeholder="file.zip (size)" />
    </div>
  );
}

function TestPlanEditor({ value, onChange }: { value: TestPlanContent; onChange: (c: TestPlanContent) => void }) {
  return (
    <div style={{ ...stackStyle, gap: 14 }}>
      <Field label="Objectives">
        <textarea style={textareaStyle} value={value.objectives} onChange={(e) => onChange({ ...value, objectives: e.target.value })} />
      </Field>
      <div style={twoColStyle}>
        <StringListEditor label="In scope" items={value.scopeIn} onChange={(scopeIn) => onChange({ ...value, scopeIn })} />
        <StringListEditor label="Out of scope" items={value.scopeOut} onChange={(scopeOut) => onChange({ ...value, scopeOut })} />
      </div>
      <Field label="Test strategy">
        <textarea style={textareaStyle} value={value.strategy} onChange={(e) => onChange({ ...value, strategy: e.target.value })} />
      </Field>
      <div style={twoColStyle}>
        <StringListEditor label="Resources" items={value.resources} onChange={(resources) => onChange({ ...value, resources })} />
        <StringListEditor label="Risks" items={value.risks} onChange={(risks) => onChange({ ...value, risks })} />
      </div>
      <div style={twoColStyle}>
        <StringListEditor label="Entry criteria" items={value.entryCriteria} onChange={(entryCriteria) => onChange({ ...value, entryCriteria })} />
        <StringListEditor label="Exit criteria" items={value.exitCriteria} onChange={(exitCriteria) => onChange({ ...value, exitCriteria })} />
      </div>
    </div>
  );
}

function TestCaseSetEditor({ value, onChange }: { value: TestCaseSetContent; onChange: (c: TestCaseSetContent) => void }) {
  const setCase = (i: number, patch: Partial<TestCaseContent>) =>
    onChange({ ...value, cases: value.cases.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {value.cases.map((tc, i) => (
        <article key={i} aria-label={`Edit case ${i + 1}`} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: '12px 14px', background: C.surface2 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
            <input
              style={{ ...inputStyle, width: 92, flex: '0 0 auto', fontFamily: 'var(--font-mono)' }}
              value={tc.id}
              aria-label={`Case ${i + 1} id`}
              onChange={(e) => setCase(i, { id: e.target.value })}
            />
            <input
              style={{ ...inputStyle, flex: 1, minWidth: 140 }}
              value={tc.title}
              placeholder="Case title"
              aria-label={`Case ${i + 1} title`}
              onChange={(e) => setCase(i, { title: e.target.value })}
            />
            <Select value={tc.priority} onChange={(v) => setCase(i, { priority: v })} options={PRIORITY_OPTIONS} ariaLabel={`Case ${i + 1} priority`} width={108} />
            <IconBtn label={`Remove case ${tc.id || i + 1}`} danger onClick={() => onChange({ ...value, cases: value.cases.filter((_, j) => j !== i) })}>
              <Trash2 size={14} />
            </IconBtn>
          </div>
          <input
            style={{ ...inputStyle, marginBottom: 10 }}
            value={tc.preconditions}
            placeholder="Preconditions"
            aria-label={`Case ${i + 1} preconditions`}
            onChange={(e) => setCase(i, { preconditions: e.target.value })}
          />
          <StringListEditor label="Steps" items={tc.steps} onChange={(steps) => setCase(i, { steps })} placeholder="Step description" />
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <input
              style={{ ...inputStyle, flex: 1, minWidth: 180 }}
              value={tc.expected}
              placeholder="Expected result"
              aria-label={`Case ${i + 1} expected result`}
              onChange={(e) => setCase(i, { expected: e.target.value })}
            />
            <input
              style={{ ...inputStyle, width: 130, flex: '0 0 auto' }}
              value={tc.category}
              placeholder="Category"
              aria-label={`Case ${i + 1} category`}
              onChange={(e) => setCase(i, { category: e.target.value })}
            />
          </div>
        </article>
      ))}
      <Button
        small
        onClick={() =>
          onChange({
            ...value,
            cases: [
              ...value.cases,
              { id: `TC-${value.cases.length + 1}`, title: '', preconditions: '', steps: [''], expected: '', priority: 'medium', category: '' },
            ],
          })
        }
      >
        <Plus size={12} /> Add test case
      </Button>
    </div>
  );
}

function ExecutionSummaryEditor({ value, onChange }: { value: ExecutionSummaryContent; onChange: (c: ExecutionSummaryContent) => void }) {
  const setTotals = (k: keyof ExecutionSummaryContent['totals'], n: number) => {
    const totals = { ...value.totals, [k]: n };
    const executed = totals.passed + totals.failed + totals.blocked + totals.pending;
    onChange({ ...value, totals, passRate: executed > 0 ? Math.round((totals.passed / executed) * 100) : 0 });
  };
  const setSuite = (i: number, patch: Partial<SuiteResult>) =>
    onChange({ ...value, suites: value.suites.map((s, j) => (j === i ? { ...s, ...patch } : s)) });

  return (
    <div style={{ ...stackStyle, gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 12 }}>
        <NumInput label="Passed" value={value.totals.passed} onChange={(n) => setTotals('passed', n)} />
        <NumInput label="Failed" value={value.totals.failed} onChange={(n) => setTotals('failed', n)} />
        <NumInput label="Blocked" value={value.totals.blocked} onChange={(n) => setTotals('blocked', n)} />
        <NumInput label="Pending" value={value.totals.pending} onChange={(n) => setTotals('pending', n)} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
        <NumInput label="Pass rate (%)" value={value.passRate} onChange={(n) => onChange({ ...value, passRate: n })} />
        <NumInput label="Duration (hours)" step={0.5} value={value.durationHours} onChange={(n) => onChange({ ...value, durationHours: n })} />
        <NumInput label="Coverage (%)" value={value.coveragePct} onChange={(n) => onChange({ ...value, coveragePct: n })} />
      </div>

      <div role="group" aria-label="Suites">
        <div style={sectionLabelStyle}>Suites</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {value.suites.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                style={{ ...inputStyle, flex: 1, minWidth: 150 }}
                value={s.name}
                placeholder="Suite name"
                aria-label={`Suite ${i + 1} name`}
                onChange={(e) => setSuite(i, { name: e.target.value })}
              />
              {(['passed', 'failed', 'blocked', 'pending'] as const).map((k) => (
                <input
                  key={k}
                  type="number"
                  min={0}
                  style={{ ...inputStyle, width: 62, flex: '0 0 auto' }}
                  value={s[k]}
                  aria-label={`Suite ${i + 1} ${k}`}
                  title={k}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    setSuite(i, { [k]: Number.isFinite(n) ? n : 0 });
                  }}
                />
              ))}
              <IconBtn label={`Remove suite ${s.name || i + 1}`} danger onClick={() => onChange({ ...value, suites: value.suites.filter((_, j) => j !== i) })}>
                <Trash2 size={13} />
              </IconBtn>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 8 }}>
          <Button small onClick={() => onChange({ ...value, suites: [...value.suites, { name: '', passed: 0, failed: 0, blocked: 0, pending: 0 }] })}>
            <Plus size={12} /> Add suite
          </Button>
        </div>
        <p style={{ fontSize: 11, color: C.fgMuted, margin: '8px 0 0' }}>
          Pass rate recalculates automatically when the totals change.
        </p>
      </div>
    </div>
  );
}

function TechDocEditor({ value, onChange }: { value: TechDocContent; onChange: (c: TechDocContent) => void }) {
  const setSection = (i: number, patch: Partial<TechDocSection>) =>
    onChange({ ...value, sections: value.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {value.sections.map((s, i) => (
        <article key={i} aria-label={`Edit section ${i + 1}`} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: '12px 14px', background: C.surface2 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <input
              style={{ ...inputStyle, flex: 1, minWidth: 0, fontWeight: 600 }}
              value={s.heading}
              placeholder="Section heading"
              aria-label={`Section ${i + 1} heading`}
              onChange={(e) => setSection(i, { heading: e.target.value })}
            />
            <IconBtn label={`Remove section ${s.heading || i + 1}`} danger onClick={() => onChange({ ...value, sections: value.sections.filter((_, j) => j !== i) })}>
              <Trash2 size={14} />
            </IconBtn>
          </div>
          <textarea
            style={{ ...textareaStyle, marginBottom: 8 }}
            value={s.body}
            placeholder="Section body"
            aria-label={`Section ${i + 1} body`}
            onChange={(e) => setSection(i, { body: e.target.value })}
          />
          <textarea
            style={{ ...textareaStyle, minHeight: 64, fontFamily: 'var(--font-mono)', fontSize: 11.5 }}
            value={s.code || ''}
            placeholder="Optional code block"
            aria-label={`Section ${i + 1} code`}
            onChange={(e) => setSection(i, { code: e.target.value })}
          />
        </article>
      ))}
      <Button small onClick={() => onChange({ ...value, sections: [...value.sections, { heading: '', body: '' }] })}>
        <Plus size={12} /> Add section
      </Button>
    </div>
  );
}

function RegressionEditor({ value, onChange }: { value: RegressionReportContent; onChange: (c: RegressionReportContent) => void }) {
  const setCase = (i: number, patch: Partial<AffectedCase>) =>
    onChange({ ...value, affectedCases: value.affectedCases.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  return (
    <div style={{ ...stackStyle, gap: 14 }}>
      <Field label="Impact analysis">
        <textarea style={textareaStyle} value={value.impactAnalysis} onChange={(e) => onChange({ ...value, impactAnalysis: e.target.value })} />
      </Field>
      <StringListEditor
        label="Suggested regression scenarios"
        items={value.scenarios}
        onChange={(scenarios) => onChange({ ...value, scenarios })}
        placeholder="Scenario description"
      />
      <div role="group" aria-label="Affected cases">
        <div style={sectionLabelStyle}>Affected cases</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {value.affectedCases.map((a, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                style={{ ...inputStyle, width: 86, flex: '0 0 auto', fontFamily: 'var(--font-mono)' }}
                value={a.id}
                aria-label={`Affected case ${i + 1} id`}
                onChange={(e) => setCase(i, { id: e.target.value })}
              />
              <input
                style={{ ...inputStyle, flex: 1, minWidth: 130 }}
                value={a.title}
                placeholder="Case title"
                aria-label={`Affected case ${i + 1} title`}
                onChange={(e) => setCase(i, { title: e.target.value })}
              />
              <input
                style={{ ...inputStyle, flex: 1.4, minWidth: 160 }}
                value={a.reason}
                placeholder="Why it is affected"
                aria-label={`Affected case ${i + 1} reason`}
                onChange={(e) => setCase(i, { reason: e.target.value })}
              />
              <IconBtn label={`Remove affected case ${a.id || i + 1}`} danger onClick={() => onChange({ ...value, affectedCases: value.affectedCases.filter((_, j) => j !== i) })}>
                <Trash2 size={13} />
              </IconBtn>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 8 }}>
          <Button small onClick={() => onChange({ ...value, affectedCases: [...value.affectedCases, { id: '', title: '', reason: '' }] })}>
            <Plus size={12} /> Add affected case
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main component
// ============================================================================

export default function DocumentDetail({ id, userEmail, projects }: { id: string; userEmail: string; projects: { id: string; name: string }[] }) {
  const router = useRouter();
  const [docs, setDocs] = useMockStore<QaDocument[]>(DOCUMENTS_KEY, DOCUMENTS_SEED);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<QaDocument | null>(null);
  const [comment, setComment] = useState('');
  const [rename, setRename] = useState<{ id: string; title: string } | null>(null);

  // Keep the sidebar command-palette registry in sync (deep links can land
  // directly on this page, bypassing the list view).
  useEffect(() => {
    registerDocsForPalette(docs);
  }, [docs]);

  const doc = docs.find((d) => d.id === id);

  if (!doc) {
    return (
      <AppShell activeView="reports" userEmail={userEmail} projects={projects}>
        <EmptyState
          icon={<Inbox size={30} />}
          title="Document not found"
          body="This document may have been deleted or the link is incorrect."
          action={
            <Button onClick={() => router.push('/reports')} ariaLabel="Back to reports">
              <ArrowLeft size={13} /> Back to reports
            </Button>
          }
        />
      </AppShell>
    );
  }

  const typeMeta = DOC_TYPE_META[doc.type];
  const statusMeta = DOC_STATUS_META[doc.status];
  const scope = scopeForType(doc.type);
  const back = SCOPE_BACK[scope];
  const TypeIcon = typeMeta.icon;

  const setDraftDoc = (d: QaDocument) => setDraft(d);

  const startEdit = () => {
    setDraft(JSON.parse(JSON.stringify(doc)) as QaDocument);
    setEditing(true);
  };
  const cancelEdit = () => {
    setEditing(false);
    setDraft(null);
  };
  const saveEdit = () => {
    if (!draft) return;
    const title = draft.title.trim();
    if (!title) {
      toast('Title cannot be empty', 'error');
      return;
    }
    const saved: QaDocument = { ...draft, title };
    setDocs((prev) => prev.map((d) => (d.id === saved.id ? { ...saved, updatedAt: new Date().toISOString() } : d)));
    toast('Document saved', 'success');
    setEditing(false);
    setDraft(null);
  };
  const setStatus = (v: string) => {
    const status = v as DocStatus;
    setDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, status } : d)));
    toast(`Status → ${DOC_STATUS_META[status].label}`, 'success');
  };
  const copyMd = async () => {
    const ok = await copyText(documentToMarkdown(doc));
    toast(ok ? 'Copied as Markdown to clipboard' : 'Could not access the clipboard', ok ? 'success' : 'error');
  };
  const downloadMd = () => {
    downloadText(docFilename(doc), documentToMarkdown(doc), 'text/markdown;charset=utf-8');
    toast('Markdown file downloaded', 'success');
  };
  const confirmRename = () => {
    if (!rename) return;
    const title = rename.title.trim();
    if (!title) {
      toast('Title cannot be empty', 'error');
      return;
    }
    setDocs((prev) => prev.map((d) => (d.id === rename.id ? { ...d, title } : d)));
    toast('Document renamed', 'success');
    setRename(null);
  };
  const addComment = () => {
    const body = comment.trim();
    if (!body) return;
    const author = userEmail.split('@')[0] || 'you';
    setDocs((prev) =>
      prev.map((d) => (d.id === doc.id ? { ...d, comments: [...d.comments, { id: uid('cmt'), author, body, at: new Date().toISOString() }] } : d))
    );
    setComment('');
    toast('Comment added', 'success');
  };

  return (
    <AppShell activeView={scope} userEmail={userEmail} projects={projects}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <button
          onClick={() => router.push(back.href)}
          aria-label={`Back to ${back.label}`}
          style={{
            background: 'transparent',
            border: 'none',
            color: C.fgMuted,
            fontSize: 12.5,
            cursor: 'pointer',
            padding: '6px 0',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            transition: 'color 120ms ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = C.fg)}
          onMouseLeave={(e) => (e.currentTarget.style.color = C.fgMuted)}
        >
          <ArrowLeft size={14} /> {back.label}
        </button>

        <header style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap', margin: '8px 0 18px' }}>
          <span
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: alpha(typeMeta.color, 8),
              border: `1px solid ${alpha(typeMeta.color, 27)}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
            aria-hidden="true"
          >
            <TypeIcon size={18} color={typeMeta.color} />
          </span>

          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 17, fontWeight: 700, color: C.fg, margin: 0, letterSpacing: '-0.01em', overflowWrap: 'anywhere' }}>{doc.title}</h1>
              <Chip color={statusMeta.color}>{statusMeta.label}</Chip>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 7, fontSize: 11.5, color: C.fgMuted }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Avatar name={doc.owner} size={18} /> {doc.owner}
              </span>
              <span aria-hidden="true">·</span>
              <span>{doc.project}</span>
              <span aria-hidden="true">·</span>
              <span suppressHydrationWarning>Updated {relTime(doc.updatedAt)}</span>
            </div>
            {/* [SEPYANT 2.1] traceability: resources used as generation context */}
            {doc.resourcesUsed && doc.resourcesUsed.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                <span style={{ fontSize: 10, color: C.fgMuted, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>Generated from</span>
                {doc.resourcesUsed.map((r) => (
                  <span
                    key={r.name}
                    title={r.kind === 'url' ? 'URL selected as context — contents were not fetched in this demo' : 'File selected as context — contents were not read in this demo'}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, padding: '2px 8px', borderRadius: 999, background: alpha(C.ai, 7), border: `1px solid ${alpha(C.ai, 27)}`, color: C.fgDim }}
                  >
                    {r.kind === 'url' ? '🔗' : '📄'} {r.name}
                  </span>
                ))}
                <span style={{ fontSize: 10, color: C.fgMuted }}>(names only — contents are not read in this demo)</span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {!editing && (
              <>
                <Select
                  value={doc.status}
                  onChange={setStatus}
                  options={DOC_STATUS_OPTIONS}
                  ariaLabel="Document status"
                  width={118}
                />
                <Menu
                  trigger={(open) => (
                    <IconBtn label="Document actions" active={open}>
                      <Ellipsis size={16} />
                    </IconBtn>
                  )}
                  items={[
                    { label: 'Rename…', onSelect: () => setRename({ id: doc.id, title: doc.title }) },
                    { label: 'Copy as Markdown', onSelect: () => void copyMd() },
                    { label: 'Download .md', onSelect: downloadMd },
                  ]}
                />
                <Button onClick={startEdit}>
                  <Pencil size={13} /> Edit
                </Button>
              </>
            )}
            {editing && (
              <Button variant="primary" onClick={saveEdit}>
                <Check size={13} /> Done
              </Button>
            )}
          </div>
        </header>

        <article
          aria-label={`${typeMeta.label}: ${doc.title}`}
          style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '20px 22px' }}
        >
          {editing && draft ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <CommonEditor draft={draft} onChange={setDraftDoc} />
              {draft.type === 'bug-report' && <BugReportEditor value={draft.content} onChange={(content) => setDraftDoc({ ...draft, content })} />}
              {draft.type === 'test-plan' && <TestPlanEditor value={draft.content} onChange={(content) => setDraftDoc({ ...draft, content })} />}
              {draft.type === 'test-case-set' && <TestCaseSetEditor value={draft.content} onChange={(content) => setDraftDoc({ ...draft, content })} />}
              {draft.type === 'execution-summary' && <ExecutionSummaryEditor value={draft.content} onChange={(content) => setDraftDoc({ ...draft, content })} />}
              {draft.type === 'tech-doc' && <TechDocEditor value={draft.content} onChange={(content) => setDraftDoc({ ...draft, content })} />}
              {draft.type === 'regression-report' && <RegressionEditor value={draft.content} onChange={(content) => setDraftDoc({ ...draft, content })} />}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 8,
                  borderTop: `1px solid ${C.border}`,
                  paddingTop: 14,
                  flexWrap: 'wrap',
                }}
              >
                <Button onClick={cancelEdit}>Cancel</Button>
                <Button variant="primary" onClick={saveEdit}>
                  <Check size={13} /> Save changes
                </Button>
              </div>
            </div>
          ) : (
            <PreviewBody doc={doc} />
          )}
        </article>

        {/* Comments — Phase 6 tie-in (stored on the document record) */}
        <section
          aria-label={`Comments (${doc.comments.length})`}
          style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '16px 18px', marginTop: 14 }}
        >
          <div style={{ ...sectionLabelStyle, marginBottom: 2 }}>Comments ({doc.comments.length})</div>
          {doc.comments.length === 0 ? (
            <p style={{ fontSize: 12, color: C.fgMuted, margin: '8px 0 0' }}>No comments yet — start the discussion.</p>
          ) : (
            <div>
              {doc.comments.map((c, i) => (
                <div key={c.id} style={{ display: 'flex', gap: 10, padding: '12px 0', borderTop: i === 0 ? 'none' : `1px solid ${C.border}` }}>
                  <Avatar name={c.author} size={26} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: C.fg }}>{c.author}</span>
                      <span suppressHydrationWarning style={{ fontSize: 10.5, color: C.fgMuted }}>
                        {relTime(c.at)}
                      </span>
                    </div>
                    <div style={{ fontSize: 12.5, color: C.fgDim, lineHeight: 1.55, marginTop: 3, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                      {c.body}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              style={{ ...inputStyle, flex: 1, minWidth: 160 }}
              value={comment}
              placeholder="Write a comment…"
              aria-label="Add a comment"
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addComment();
              }}
            />
            <Button variant="primary" onClick={addComment} disabled={!comment.trim()} ariaLabel="Post comment">
              <Send size={13} /> Comment
            </Button>
          </div>
        </section>
      </div>

      {rename && (
        <Modal title="Rename document" onClose={() => setRename(null)}>
          <Field label="Title">
            <input
              style={inputStyle}
              value={rename.title}
              aria-label="Document title"
              autoFocus
              onChange={(e) => setRename({ ...rename, title: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmRename();
              }}
            />
          </Field>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <Button onClick={() => setRename(null)}>Cancel</Button>
            <Button variant="primary" onClick={confirmRename}>
              Save
            </Button>
          </div>
        </Modal>
      )}
    </AppShell>
  );
}
