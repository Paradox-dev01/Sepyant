import type { Artifact } from './types';

function dl(content: string, filename: string, mime: string) {
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([content], { type: mime })),
    download: filename,
  });
  a.click();
  URL.revokeObjectURL(a.href);
}

export function exportCSV(a: Artifact) {
  const name = a.label.replace(/\s/g, '_');
  let rows: string[][] = [];
  if (a.cases) {
    rows = [
      ['ID', 'Title', 'Priority', 'Status', 'Steps', 'Expected'],
      ...a.cases.map((t) => [t.displayId, t.title, t.priority, t.status, t.steps.join(' | '), t.expected]),
    ];
  } else if (a.plan) {
    rows = [['Section', 'Content'], ...a.plan.map((p) => [p.section, p.content])];
  }
  dl(rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n'), `${name}.csv`, 'text/csv');
}

export function exportDoc(a: Artifact) {
  let out = `${a.label}\n${'='.repeat(a.label.length)}\n\n`;
  if (a.cases) {
    a.cases.forEach((t) => {
      out += `${t.displayId} — ${t.title}\nPriority: ${t.priority} | Status: ${t.status}\n\nSteps:\n`;
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
  dl(out, `${a.label.replace(/\s/g, '_')}.txt`, 'text/plain');
}
