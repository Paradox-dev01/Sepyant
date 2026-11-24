import type { Artifact, TC } from './types';

function dl(content: string, filename: string, mime: string) {
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([content], { type: mime })),
    download: filename,
  });
  a.click();
  URL.revokeObjectURL(a.href);
}

// [PHASE 1] Export options follow the approval workflow (ARCHITECTURE_FULL.md
// §2: "Editor (approve/edit/reject), Export"): the deliverable is the APPROVED
// set, so callers can export approved-only. `all` keeps every case and is
// always labeled as such in the file name so drafts can't masquerade as the
// reviewed deliverable.
export type ExportScope = 'approved' | 'all';

function scopedCases(a: Artifact, scope: ExportScope): TC[] {
  if (!a.cases) return [];
  return scope === 'approved' ? a.cases.filter((c) => c.reviewStatus === 'approved') : a.cases;
}

function fileLabel(a: Artifact, scope: ExportScope): string {
  const base = a.label.replace(/\s/g, '_');
  return scope === 'approved' ? base : `${base}_incl_drafts`;
}

export function exportCSV(a: Artifact, scope: ExportScope = 'approved') {
  let rows: string[][] = [];
  if (a.cases) {
    const cases = scopedCases(a, scope);
    // [PHASE 1] Review (approval workflow) and Execution (run state) are
    // exported as separate columns — the old single "Status" column conflated
    // the two.
    rows = [
      ['ID', 'Title', 'Priority', 'Review', 'Execution', 'Steps', 'Expected'],
      ...cases.map((t) => [
        t.displayId,
        t.title,
        t.priority,
        t.reviewStatus,
        t.executionStatus,
        t.steps.join(' | '),
        t.expected,
      ]),
    ];
  } else if (a.plan) {
    rows = [['Section', 'Content'], ...a.plan.map((p) => [p.section, p.content])];
  }
  dl(rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n'), `${fileLabel(a, scope)}.csv`, 'text/csv');
}

export function exportDoc(a: Artifact, scope: ExportScope = 'approved') {
  const title = scope === 'approved' ? a.label : `${a.label} (including drafts)`;
  let out = `${title}\n${'='.repeat(title.length)}\n\n`;
  if (a.cases) {
    const cases = scopedCases(a, scope);
    if (cases.length === 0) out += 'No approved test cases yet — approve cases before exporting the deliverable.\n\n';
    cases.forEach((t) => {
      out += `${t.displayId} — ${t.title}\nPriority: ${t.priority} | Review: ${t.reviewStatus} | Execution: ${t.executionStatus}\n\nSteps:\n`;
      t.steps.forEach((s, i) => {
        out += `  ${i + 1}. ${s}\n`;
      });
      out += `\nExpected:\n  ${t.expected}\n\n${'─'.repeat(60)}\n\n`;
    });
  } else if (a.plan) {
    a.plan.forEach((p) => {
      out += `${p.section}\n${'─'.repeat(p.section.length)}\n${p.content}\n\n`;
    });
  }
  dl(out, `${fileLabel(a, scope)}.txt`, 'text/plain');
}
