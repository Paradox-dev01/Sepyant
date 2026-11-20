// ============================================================================
// [SEPYANT 2.1] Context-aware QA generation (frontend-only mock).
//
// Output types selectable from the chat composer when "Generate" is active.
// Two of them (Test Plan, Test Cases) keep using the REAL dev-bypassed
// generation endpoint and the existing artifacts panel — nothing about that
// flow changes. The other six produce a deterministic, clearly-labeled demo
// output rendered as a GeneratedOutput card in the chat.
//
// HONESTY: in this demo no document contents and no URL contents are ever
// read. Generated outputs may NAME the selected resources (so the user can
// see what would be used) but must never claim to have analysed them — every
// output carries a DEMO chip and an explicit note, and the context line reads
// "selected as context (contents not read in this demo)".
// ============================================================================

import { generateScript, scriptFilename, type FrameworkId, type ScriptLang, type AutomationTestCase } from '@/lib/qa-mock/automation';

export type OutputTypeId =
  | 'test-plan'
  | 'test-cases'
  | 'bug-report'
  | 'test-scenarios'
  | 'qa-summary'
  | 'regression-plan'
  | 'automation-scripts'
  | 'tech-doc';

export const OUTPUT_TYPES: { id: OutputTypeId; label: string; hint: string; usesEndpoint: boolean; needsFramework?: boolean }[] = [
  { id: 'test-plan', label: 'Test Plan', hint: 'Uses the workspace generation flow (plans + cases in the IDE panel)', usesEndpoint: true },
  { id: 'test-cases', label: 'Test Cases', hint: 'Uses the workspace generation flow (cases in the IDE panel)', usesEndpoint: true },
  { id: 'bug-report', label: 'Bug Report', hint: 'Structured draft with severity, steps, environment', usesEndpoint: false },
  { id: 'test-scenarios', label: 'Test Scenarios', hint: 'High-level scenario outline before detailed cases', usesEndpoint: false },
  { id: 'qa-summary', label: 'QA Summary', hint: 'Executive summary of quality status and risks', usesEndpoint: false },
  { id: 'regression-plan', label: 'Regression Test Plan', hint: 'Impact analysis and suggested re-run scope', usesEndpoint: false },
  { id: 'automation-scripts', label: 'Automation Scripts', hint: 'Framework-specific starter script (demo generator)', usesEndpoint: false, needsFramework: true },
  { id: 'tech-doc', label: 'Technical QA Documentation', hint: 'Reference documentation for the QA team', usesEndpoint: false },
];

// ------------------------------------------------------------------- blocks

export type OutputBlock =
  | { kind: 'p'; text: string }
  | { kind: 'h'; text: string }
  | { kind: 'list'; ordered?: boolean; items: string[] }
  | { kind: 'code'; lang: string; filename?: string; code: string }
  | { kind: 'stats'; items: { label: string; value: string; tone?: 'good' | 'warn' | 'bad' | 'neutral' }[] }
  | { kind: 'kv'; items: { k: string; v: string }[] };

export type ResourceRef = { name: string; kind: 'file' | 'url' };

export type GeneratedOutput = {
  id: string;
  outputType: OutputTypeId;
  outputLabel: string;
  title: string;
  createdAt: string;
  instructions?: string;
  framework?: { id: FrameworkId; name: string; language: string };
  resourcesUsed: ResourceRef[];
  blocks: OutputBlock[];
};

// ---------------------------------------------------------------- generator

function topicOf(instructions: string | undefined, fallback: string): string {
  const t = (instructions || '').trim().replace(/\s+/g, ' ');
  if (!t) return fallback;
  return t.length > 72 ? `${t.slice(0, 72)}…` : t;
}

function resourceLine(resources: ResourceRef[]): string {
  if (resources.length === 0) {
    return 'No resources were attached — this draft is based on your instructions only.';
  }
  return `Context selected: ${resources.map((r) => r.name).join(', ')}. Their contents were **not** read in this demo — connect the backend integration to generate from real document/URL contents.`;
}

const EDGE_BUCKETS = [
  'positive happy path',
  'negative input handling',
  'boundary values',
  'security/authorisation',
  'state-transition edge case',
  'concurrency/idempotency',
  'localisation & currency formatting',
  'accessibility of the flow',
];

export function generateMockOutput(opts: {
  outputType: OutputTypeId;
  instructions?: string;
  resources: ResourceRef[];
  framework?: { id: FrameworkId; name: string; language: string };
  projectName: string;
  demoUser: string;
}): GeneratedOutput {
  const { outputType, instructions, resources, framework, projectName } = opts;
  const topic = topicOf(instructions, `${projectName} current scope`);
  const base = { id: `gen-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, createdAt: new Date().toISOString(), instructions, resourcesUsed: resources, framework };
  const ctx = resourceLine(resources);

  switch (outputType) {
    case 'bug-report':
      return {
        ...base,
        outputType,
        outputLabel: 'Bug Report',
        title: `Bug report draft — ${topic}`,
        blocks: [
          { kind: 'h', text: 'Draft structure (simulated)' },
          { kind: 'kv', items: [
            { k: 'Title', v: `${topic} — unexpected behaviour` },
            { k: 'Severity', v: 'High · Priority P1 (adjust after triage)' },
            { k: 'Environment', v: 'Staging — captured from project resources metadata (demo)' },
          ] },
          { kind: 'h', text: 'Steps to reproduce' },
          { kind: 'list', ordered: true, items: [
            'Open the affected flow on the staging environment.',
            'Enter a valid state and trigger the action under test.',
            'Observe the result — expected vs actual to be confirmed against the requirement document.',
          ] },
          { kind: 'kv', items: [
            { k: 'Expected', v: 'Behaviour matches the specification.' },
            { k: 'Actual', v: 'To be recorded during execution — placeholder in this simulated draft.' },
          ] },
          { kind: 'p', text: ctx },
        ],
      };

    case 'test-scenarios':
      return {
        ...base,
        outputType,
        outputLabel: 'Test Scenarios',
        title: `Scenario outline — ${topic}`,
        blocks: [
          { kind: 'h', text: 'Scenario outline' },
          { kind: 'list', ordered: true, items: EDGE_BUCKETS.slice(0, 6).map((b, i) => `SC-${String(i + 1).padStart(2, '0')} — ${b} for ${topic}`) },
          { kind: 'p', text: 'Turn any scenario into detailed test cases from the composer, or save this outline to the project as a reference document.' },
          { kind: 'p', text: ctx },
        ],
      };

    case 'qa-summary':
      return {
        ...base,
        outputType,
        outputLabel: 'QA Summary',
        title: `QA summary — ${topic}`,
        blocks: [
          { kind: 'h', text: 'Executive summary (simulated)' },
          { kind: 'stats', items: [
            { label: 'Planned cases', value: '48', tone: 'neutral' },
            { label: 'Executed', value: '31', tone: 'neutral' },
            { label: 'Pass rate', value: '87%', tone: 'good' },
            { label: 'Open P1/P0', value: '2', tone: 'warn' },
          ] },
          { kind: 'h', text: 'Highlights' },
          { kind: 'list', items: [
            'Core happy paths are stable on staging.',
            'Two medium defects around boundary inputs remain open.',
            'Coverage of negative paths is behind plan — flagged in Quality analytics.',
          ] },
          { kind: 'p', text: 'Figures above are illustrative demo numbers, not live project data.' },
          { kind: 'p', text: ctx },
        ],
      };

    case 'regression-plan':
      return {
        ...base,
        outputType,
        outputLabel: 'Regression Test Plan',
        title: `Regression scope — ${topic}`,
        blocks: [
          { kind: 'h', text: 'Impact analysis (simulated)' },
          { kind: 'p', text: `Changed areas implied by your instructions: ${topic}. Cross-referencing the project resource list (names only in this demo): ${resources.length ? resources.map((r) => r.name).join(', ') : 'none selected'}.` },
          { kind: 'h', text: 'Suggested re-run scope' },
          { kind: 'list', items: [
            'All P0/P1 cases for the affected module.',
            'Adjacent integration points one hop from the change.',
            'Smoke pack for deployment verification.',
          ] },
          { kind: 'h', text: 'Safe to defer' },
          { kind: 'list', items: ['Unrelated marketing/static content', 'Visual regression on untouched pages'] },
          { kind: 'p', text: ctx },
        ],
      };

    case 'automation-scripts': {
      const fw = framework?.id || 'playwright';
      const lang = (framework?.language as ScriptLang) || 'typescript';
      const demoCase: AutomationTestCase = {
        id: 'GEN-001',
        title: topic,
        project: projectName,
        priority: 'high',
        preconditions: 'Application is reachable on the staging environment.',
        steps: [
          'Open the application under test.',
          'Perform the primary action described in the instructions.',
          'Assert the expected outcome is visible.',
        ],
        expected: 'The flow completes without errors and the expected state is displayed.',
        data: { BASE_URL: 'https://staging.example.sepyant.dev', USER: 'demo-qa' },
      };
      const script = generateScript(fw, lang, demoCase);
      const filename = scriptFilename(fw, lang, demoCase.id);
      return {
        ...base,
        outputType,
        outputLabel: 'Automation Scripts',
        title: `${framework?.name || 'Automation'} starter script — ${topic}`,
        blocks: [
          { kind: 'code', lang, filename, code: script.code },
          { kind: 'p', text: `Script generated by the demo template generator (same engine as the Automation page) — it has **not** been executed and does not run against any environment.` },
          { kind: 'p', text: ctx },
        ],
      };
    }

    case 'tech-doc':
    default:
      return {
        ...base,
        outputType: 'tech-doc',
        outputLabel: 'Technical QA Documentation',
        title: `QA documentation — ${topic}`,
        blocks: [
          { kind: 'h', text: 'Purpose' },
          { kind: 'p', text: `Reference notes for the QA team covering ${topic}, assembled as a simulated draft for review.` },
          { kind: 'h', text: 'Scope covered' },
          { kind: 'list', items: ['Feature behaviour summary', 'Test environment and data prerequisites', 'Known risks and open questions', 'Traceability pointers to the project resource list'] },
          { kind: 'h', text: 'Open questions' },
          { kind: 'list', items: ['Confirm expected behaviour against the requirement document once backend extraction is available.'] },
          { kind: 'p', text: ctx },
        ],
      };
  }
}

/** Markdown export for a generated output (used by Copy / Download). */
export function generatedToMarkdown(out: GeneratedOutput, projectName: string): string {
  const lines: string[] = [];
  lines.push(`# ${out.title}`);
  lines.push('');
  lines.push(`> SEPYANT demo — simulated ${out.outputLabel.toLowerCase()} for ${projectName}. Generated ${new Date(out.createdAt).toLocaleString('en-GB')}.`);
  if (out.resourcesUsed.length) {
    lines.push('>');
    lines.push(`> Context selected: ${out.resourcesUsed.map((r) => r.name).join(', ')} (contents not read in this demo).`);
  }
  lines.push('');
  if (out.instructions) {
    lines.push(`**Instructions:** ${out.instructions}`);
    lines.push('');
  }
  if (out.framework) {
    lines.push(`**Framework:** ${out.framework.name} · ${out.framework.language}`);
    lines.push('');
  }
  for (const b of out.blocks) {
    switch (b.kind) {
      case 'h':
        lines.push(`## ${b.text}`, '');
        break;
      case 'p':
        lines.push(b.text.replace(/\*\*/g, '**'), '');
        break;
      case 'list':
        b.items.forEach((it, i) => lines.push(b.ordered ? `${i + 1}. ${it}` : `- ${it}`));
        lines.push('');
        break;
      case 'code':
        lines.push('```' + b.lang, b.code, '```', '');
        break;
      case 'stats':
        lines.push('| Metric | Value |', '| --- | --- |');
        b.items.forEach((s) => lines.push(`| ${s.label} | ${s.value} |`));
        lines.push('');
        break;
      case 'kv':
        b.items.forEach((kv) => lines.push(`- **${kv.k}:** ${kv.v}`));
        lines.push('');
        break;
    }
  }
  lines.push('---', '', 'Generated by SEPYANT 2.0 demo — mock output, no AI/document analysis performed.');
  return lines.join('\n');
}
