'use client';

// ============================================================================
// [SEPYANT 2.0] Automation & script generator (Phase 4 — automation framework
// support). Turns the demo QA test cases into framework-ready automation
// scripts (Playwright, Selenium, Appium, Cypress, Postman) in three steps:
// pick a framework, pick a case, pick a language — then Generate.
//
// Honesty: scripts are assembled locally from deterministic templates in
// lib/qa-mock/automation.ts — they are never executed and nothing leaves the
// browser. Selections persist client-side via the mock store
// ("automation.prefs.v1") so the last setup survives a refresh.
// ============================================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { Code2, Copy, Download, FileCode2, Sparkles } from 'lucide-react';
import { C, alpha } from '@/lib/theme';
import AppShell from '@/components/shell/AppShell';
import { Button, Card, Chip, EmptyState, FilterChips, IconBtn, PageHeader } from '@/components/shell/bits';
import { toast } from '@/components/shell/Toast';
import { copyText, downloadText, useMockStore } from '@/lib/mock-store';
import {
  AUTOMATION_TEST_CASES,
  CONFIG_STEPS,
  FRAMEWORKS,
  SCRIPT_EXT,
  generateScript,
  runCommandFor,
  scriptFilename,
  type AutomationPriority,
  type FrameworkId,
  type GeneratedScript,
  type ScriptLang,
} from '@/lib/qa-mock/automation';
import { CodeBlock, highlightCode, type CodeLang } from '@/components/automation/highlight';

// ------------------------------------------------------------------- setup

type AutomationPrefs = { framework: FrameworkId; caseId: string; language: ScriptLang };
type OutputState = { framework: FrameworkId; language: ScriptLang; caseId: string; generated: GeneratedScript };

const PREFS_KEY = 'automation.prefs.v1';
const PREFS_SEED: AutomationPrefs = {
  framework: 'playwright',
  caseId: AUTOMATION_TEST_CASES[0].id,
  language: 'typescript',
};

const LANGUAGE_LABEL: Record<ScriptLang, string> = {
  typescript: 'TypeScript',
  javascript: 'JavaScript',
  python: 'Python',
  java: 'Java',
  csharp: 'C#',
  json: 'Collection JSON',
};

/** C# shares the C-like tokenizer (comments/strings/keywords are identical). */
const HIGHLIGHT_LANG: Record<ScriptLang, CodeLang> = {
  typescript: 'ts',
  javascript: 'js',
  python: 'python',
  java: 'java',
  csharp: 'java',
  json: 'json',
};

const PRIORITY_COLOR: Record<AutomationPriority, string> = {
  critical: C.danger,
  high: C.warning,
  medium: C.ai,
  low: C.fgMuted,
};

const SECTION_LABEL: React.CSSProperties = {
  margin: '0 0 10px',
  fontSize: 10,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  color: C.fgMuted,
  fontFamily: 'var(--font-mono)',
};

const TH_STYLE: React.CSSProperties = {
  textAlign: 'left',
  fontSize: 10.5,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: C.fgMuted,
  fontFamily: 'var(--font-mono)',
  padding: '6px 10px 8px',
  borderBottom: `1px solid ${C.border}`,
};

const TD_STYLE: React.CSSProperties = { padding: '12px 10px', verticalAlign: 'top' };

// --------------------------------------------------------- framework card

function FrameworkCard({
  name,
  tagline,
  description,
  focus,
  Icon,
  selected,
  onSelect,
}: {
  name: string;
  tagline: string;
  description: string;
  focus: string;
  Icon: (typeof FRAMEWORKS)[number]['icon'];
  selected: boolean;
  onSelect: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      title={description}
      onClick={onSelect}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 8,
        textAlign: 'left',
        padding: '14px 14px 12px',
        borderRadius: 10,
        cursor: 'pointer',
        minHeight: 118,
        background: selected ? alpha(C.accent, 5) : hover ? C.surface2 : C.surface,
        border: `1px solid ${selected ? C.accent : C.border}`,
        transition: 'background 120ms ease, border-color 120ms ease',
        fontFamily: 'inherit',
      }}
    >
      <span style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Icon size={18} color={selected ? C.accent : C.fgMuted} />
        <Chip color={selected ? C.accent : C.fgMuted}>{focus}</Chip>
      </span>
      <span style={{ fontSize: 13.5, fontWeight: 600, color: C.fg }}>{name}</span>
      <span style={{ fontSize: 11, color: C.fgMuted, lineHeight: 1.45 }}>{tagline}</span>
    </button>
  );
}

// ------------------------------------------------------------------- view

export default function AutomationView({
  userEmail,
  projects,
}: {
  userEmail: string;
  projects: { id: string; name: string }[];
}) {
  const [prefs, setPrefs] = useMockStore<AutomationPrefs>(PREFS_KEY, PREFS_SEED);
  const [generating, setGenerating] = useState(false);
  const [output, setOutput] = useState<OutputState | null>(null);
  const [focusLine, setFocusLine] = useState<number | null>(null);
  const timerRef = useRef<number | null>(null);

  // Clear a pending "generating" timer if the view unmounts mid-generation.
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  // Defensive lookups keep stale persisted prefs from ever crashing the view.
  const framework = FRAMEWORKS.find((f) => f.id === prefs.framework) ?? FRAMEWORKS[0];
  const activeCase = AUTOMATION_TEST_CASES.find((c) => c.id === prefs.caseId) ?? AUTOMATION_TEST_CASES[0];
  const language: ScriptLang = framework.languages.includes(prefs.language)
    ? prefs.language
    : framework.languages[0];

  const outputCase = output ? AUTOMATION_TEST_CASES.find((c) => c.id === output.caseId) : undefined;
  const outputFramework = output ? FRAMEWORKS.find((f) => f.id === output.framework) : undefined;
  const stale =
    output !== null && (output.framework !== framework.id || output.language !== language || output.caseId !== activeCase.id);

  const runCommand = runCommandFor(framework.id, language);
  const downloadExt = SCRIPT_EXT[framework.id][language] ?? 'txt';

  const outputCodeLines = useMemo(() => (output ? output.generated.code.split('\n') : []), [output]);

  function updatePrefs(patch: Partial<AutomationPrefs>) {
    setPrefs((prev) => ({ ...prev, ...patch }));
  }

  function handleGenerate() {
    if (generating) return;
    setGenerating(true);
    setFocusLine(null);
    timerRef.current = window.setTimeout(() => {
      setOutput({
        framework: framework.id,
        language,
        caseId: activeCase.id,
        generated: generateScript(framework.id, language, activeCase),
      });
      setGenerating(false);
      toast('Script generated locally — demo output, not executed', 'info');
    }, 600);
  }

  async function handleCopy() {
    if (!output) return;
    const ok = await copyText(output.generated.code);
    if (ok) toast('Script copied to clipboard', 'success');
    else toast('Copy failed — select the code manually', 'error');
  }

  function handleDownload() {
    if (!output) return;
    const filename = scriptFilename(output.framework, output.language, output.caseId);
    const mime = output.language === 'json' ? 'application/json;charset=utf-8' : 'text/plain;charset=utf-8';
    downloadText(filename, output.generated.code, mime);
    toast(`Saved ${filename} (demo file — not executed)`, 'success');
  }

  function jumpToLine(line: number) {
    setFocusLine(line);
    const el = document.getElementById(`auto-line-${line}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return (
    <AppShell activeView="automation" userEmail={userEmail} projects={projects}>
      <style>{`
        @keyframes sepyant-sparkle-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.35; transform: scale(0.88); } }
        .sepyant-sparkle { animation: sepyant-sparkle-pulse 900ms ease-in-out infinite; }
        @keyframes sepyant-fade-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        .sepyant-fade-in { animation: sepyant-fade-in 240ms ease; }
        .sepyant-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
        .sepyant-scroll::-webkit-scrollbar-thumb { background: ${C.muted}; border-radius: 4px; }
        .sepyant-scroll::-webkit-scrollbar-track { background: transparent; }
      `}</style>

      <PageHeader
        icon={<Code2 size={17} />}
        title="Automation & script generator"
        description="Turn QA test cases into framework-ready automation scripts. Scripts are assembled locally from SEPYANT templates — they are not executed, and nothing leaves your browser."
        right={
          <>
            <Chip color={C.fgMuted}>{FRAMEWORKS.length} frameworks</Chip>
            <Chip color={C.fgDim}>{AUTOMATION_TEST_CASES.length} demo cases</Chip>
          </>
        }
      />

      {/* ---------------------------------------------- step 1 — framework */}
      <section aria-label="Step 1 — pick a framework" style={{ marginBottom: 18 }}>
        <p style={SECTION_LABEL}>Step 1 — Framework</p>
        <div
          role="radiogroup"
          aria-label="Automation framework"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}
        >
          {FRAMEWORKS.map((f) => (
            <FrameworkCard
              key={f.id}
              name={f.name}
              tagline={f.tagline}
              description={f.description}
              focus={f.focus}
              Icon={f.icon}
              selected={f.id === framework.id}
              onSelect={() => updatePrefs({ framework: f.id, language: f.languages.includes(prefs.language) ? prefs.language : f.languages[0] })}
            />
          ))}
        </div>
      </section>

      {/* ---------------------------------------------- step 2 — test case */}
      <Card style={{ marginBottom: 18 }}>
        <p style={SECTION_LABEL}>Step 2 — Test case</p>
        <div
          role="radiogroup"
          aria-label="Test case"
          className="sepyant-scroll"
          style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 302, overflowY: 'auto', paddingRight: 2 }}
        >
          {AUTOMATION_TEST_CASES.map((c) => {
            const selected = c.id === activeCase.id;
            return (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => updatePrefs({ caseId: c.id })}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  minHeight: 44,
                  padding: '9px 12px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  textAlign: 'left',
                  background: selected ? alpha(C.accent, 5) : 'transparent',
                  border: `1px solid ${selected ? C.accent : 'transparent'}`,
                  fontFamily: 'inherit',
                }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      display: 'block',
                      fontSize: 12.5,
                      fontWeight: 500,
                      color: selected ? C.fg : C.fgDim,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {c.title}
                  </span>
                  <span style={{ display: 'block', fontSize: 10.5, color: C.fgMuted, marginTop: 2 }}>
                    {c.project} · {c.steps.length} steps
                  </span>
                </span>
                <Chip color={PRIORITY_COLOR[c.priority]}>{c.priority}</Chip>
              </button>
            );
          })}
        </div>
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p style={{ margin: 0, fontSize: 11.5, color: C.fgMuted, lineHeight: 1.5 }}>
            <span style={{ color: C.fgDim, fontWeight: 600 }}>Preconditions — </span>
            {activeCase.preconditions}
          </p>
          <p style={{ margin: 0, fontSize: 11.5, color: C.fgMuted, lineHeight: 1.5 }}>
            <span style={{ color: C.success, fontWeight: 600 }}>Expected — </span>
            {activeCase.expected}
          </p>
        </div>
      </Card>

      {/* ---------------------------------- step 3 — language and generate */}
      <Card style={{ marginBottom: 18 }}>
        <p style={SECTION_LABEL}>Step 3 — Language</p>
        <FilterChips
          value={language}
          onChange={(v) => updatePrefs({ language: v as ScriptLang })}
          options={framework.languages.map((l) => ({ value: l, label: LANGUAGE_LABEL[l] }))}
          ariaLabel="Script language"
        />
        <p style={{ margin: '10px 0 0', fontFamily: 'var(--font-mono)', fontSize: 10.5, color: C.fgMuted }}>
          Downloads as sepyant-{framework.id}-{activeCase.id}.{downloadExt}
        </p>
        <div
          style={{
            marginTop: 14,
            paddingTop: 14,
            borderTop: `1px solid ${C.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <Button variant="primary" onClick={handleGenerate} disabled={generating} ariaLabel="Generate automation script">
            <Sparkles size={14} className={generating ? 'sepyant-sparkle' : undefined} />
            {generating ? 'Generating…' : 'Generate script'}
          </Button>
          <span style={{ fontSize: 11.5, color: C.fgMuted, lineHeight: 1.45, flex: '1 1 220px' }}>
            Template-based output generated in your browser — never executed.
          </span>
          {stale && (
            <Chip color={C.warning} title="The current selection differs from the generated script">
              Selection changed — regenerate
            </Chip>
          )}
        </div>
      </Card>

      {/* --------------------------------------------- generated script */}
      {output && outputFramework && outputCase ? (
        <section aria-label="Generated script" className="sepyant-fade-in" style={{ marginBottom: 18 }}>
          <p style={SECTION_LABEL}>Generated script</p>
          <Card>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
                marginBottom: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <outputFramework.icon size={16} color={C.accent} style={{ flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.fg }}>
                    {outputFramework.name} · {LANGUAGE_LABEL[output.language]}
                  </div>
                  <div style={{ fontSize: 11, color: C.fgMuted, marginTop: 2 }}>{outputCase.title}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="ghost" small onClick={handleCopy} ariaLabel="Copy script to clipboard">
                  <Copy size={13} /> Copy
                </Button>
                <Button variant="ghost" small onClick={handleDownload} ariaLabel="Download script file">
                  <Download size={13} /> Download
                </Button>
              </div>
            </div>
            <CodeBlock
              code={output.generated.code}
              lang={HIGHLIGHT_LANG[output.language]}
              lineIdPrefix="auto-line"
              focusLine={focusLine}
            />
            <p style={{ margin: '10px 0 0', fontSize: 11, color: C.fgMuted, fontStyle: 'italic' }}>
              Generated locally from templates — demo output, not executed.
            </p>
          </Card>
        </section>
      ) : (
        <div style={{ marginBottom: 18 }}>
          <EmptyState
            icon={<FileCode2 size={22} />}
            title="No script generated yet"
            body="Pick a framework, a test case and a language, then hit Generate. The script is assembled locally from SEPYANT templates — nothing is executed and nothing leaves the browser."
          />
        </div>
      )}

      {/* ---------------------------------- test case to script mapping */}
      {output && (
        <section aria-label="Test case to script mapping" style={{ marginBottom: 18 }}>
          <p style={SECTION_LABEL}>Test-case-to-script mapping</p>
          <Card>
            <p style={{ margin: '0 0 12px', fontSize: 11.5, color: C.fgMuted, lineHeight: 1.5 }}>
              Each step of the test case maps to the generated lines below. Click a row to jump to that step in the script.
            </p>
            <div className="sepyant-scroll" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
                <thead>
                  <tr>
                    <th style={{ ...TH_STYLE, width: '38%' }}>Test case step</th>
                    <th style={TH_STYLE}>Generated code</th>
                  </tr>
                </thead>
                <tbody>
                  {output.generated.mapping.map((m, i) => {
                    const snippet = outputCodeLines.slice(m.lines[0] - 1, m.lines[1]).join('\n');
                    return (
                      <tr
                        key={`${m.anchor}-${i}`}
                        tabIndex={0}
                        title="Jump to this step in the script"
                        onClick={() => jumpToLine(m.lines[0])}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            jumpToLine(m.lines[0]);
                          }
                        }}
                        style={{ cursor: 'pointer', borderTop: `1px solid ${C.border}` }}
                      >
                        <td style={TD_STYLE}>
                          <span
                            style={{
                              display: 'block',
                              fontFamily: 'var(--font-mono)',
                              fontSize: 10.5,
                              fontWeight: 700,
                              color: C.accent,
                              marginBottom: 3,
                            }}
                          >
                            Step {i + 1}
                          </span>
                          <span style={{ fontSize: 12, color: C.fg, lineHeight: 1.45 }}>{m.step}</span>
                        </td>
                        <td style={TD_STYLE}>
                          <pre
                            className="sepyant-scroll"
                            style={{
                              margin: '0 0 4px',
                              background: C.bg,
                              border: `1px solid ${C.border}`,
                              borderRadius: 6,
                              padding: '8px 10px',
                              fontFamily: 'var(--font-mono)',
                              fontSize: 11,
                              lineHeight: 1.6,
                              overflowX: 'auto',
                            }}
                          >
                            <code style={{ fontFamily: 'inherit' }}>{highlightCode(snippet, HIGHLIGHT_LANG[output.language])}</code>
                          </pre>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: C.fgMuted }}>
                            lines {m.lines[0]}–{m.lines[1]}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
      )}

      {/* ---------------------------------- configuration instructions */}
      <section aria-label="Configuration instructions">
        <p style={SECTION_LABEL}>Configuration instructions</p>
        <Card>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.fg, marginBottom: 10 }}>{CONFIG_STEPS[framework.id].title}</div>
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {CONFIG_STEPS[framework.id].steps.map((s, i) => (
              <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span
                  style={{
                    flexShrink: 0,
                    width: 18,
                    height: 18,
                    borderRadius: 5,
                    background: alpha(C.accent, 11),
                    border: `1px solid ${alpha(C.accent, 27)}`,
                    color: C.accent,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 1,
                  }}
                >
                  {i + 1}
                </span>
                <span style={{ fontSize: 12, color: C.fgDim, lineHeight: 1.5 }}>{s}</span>
              </li>
            ))}
          </ol>
          <div
            style={{
              marginTop: 14,
              paddingTop: 12,
              borderTop: `1px solid ${C.border}`,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', color: C.fgMuted }}>
              RUN
            </span>
            <code
              style={{
                background: C.surface2,
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                padding: '5px 9px',
                fontFamily: 'var(--font-mono)',
                fontSize: 11.5,
                color: C.success,
              }}
            >
              {runCommand}
            </code>
            <IconBtn
              label="Copy run command"
              onClick={async () => {
                const ok = await copyText(runCommand);
                if (ok) toast('Run command copied', 'success');
              }}
            >
              <Copy size={13} />
            </IconBtn>
          </div>
        </Card>
      </section>
    </AppShell>
  );
}
