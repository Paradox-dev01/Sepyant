// ============================================================================
// [SEPYANT 2.1] Project resources (frontend-only mock layer).
//
// A "resource" is a piece of project context: an uploaded file (requirements,
// API docs, designs, specs, code…) or a URL (staging site, API docs, PRD…).
// Resources are stored per project id in localStorage via lib/mock-store.ts —
// same persistence rules as the other 2.0 surfaces (survives browser
// refreshes, demo-only, no backend involved).
//
// HONESTY RULES (enforced everywhere this module is used):
//  - Adding a URL does NOT fetch it. Nothing is retrieved or analysed.
//  - Uploaded files are NOT uploaded anywhere. Text-like files and images get
//    a REAL local preview/excerpt produced in the browser (FileReader);
//    binary formats (PDF/DOCX/XLSX…) show a placeholder excerpt and clearly
//    state that content extraction needs a backend integration.
// ============================================================================

import { C } from '@/lib/theme';

export const RESOURCES_KEY = 'resources.v1';

// ------------------------------------------------------------------- types

export type ResourceKind = 'file' | 'url';

export type ResourceCategory = 'requirements' | 'api-doc' | 'design' | 'spec' | 'data' | 'other';

export type ProjectResource = {
  id: string;
  projectId: string;
  kind: ResourceKind;
  name: string; // file name (with extension) or URL
  category: ResourceCategory;
  addedAt: string; // ISO
  addedBy: string; // display name/email
  // file-only fields
  mime?: string;
  size?: number; // bytes
  excerpt?: string; // real local text excerpt, or a binary-format placeholder
  dataUrl?: string; // image thumbnail (object URL is session-bound; we keep small data URLs only)
  // url-only fields
  url?: string;
  note?: string; // e.g. "staging environment"
};

/** Attachment staged in a composer (message-scoped, not yet saved anywhere). */
export type ComposerAttachment =
  | {
      localId: string;
      kind: 'file';
      name: string;
      mime: string;
      size: number;
      status: 'uploading' | 'ready' | 'error';
      progress: number; // 0..100 (simulated)
      error?: string;
      excerpt?: string;
      dataUrl?: string;
      savedAsResource?: boolean;
    }
  | {
      localId: string;
      kind: 'url';
      name: string; // the URL string
      status: 'ready' | 'error';
      error?: string;
      note?: string;
    };

export const RESOURCE_CATEGORY_META: Record<ResourceCategory, { label: string; color: string }> = {
  requirements: { label: 'Requirements', color: C.accent },
  'api-doc': { label: 'API doc', color: C.ai },
  design: { label: 'Design', color: '#e8845d' },
  spec: { label: 'Specification', color: C.success },
  data: { label: 'Data', color: C.warning },
  other: { label: 'Other', color: C.fgMuted },
};

// --------------------------------------------------------- file-type registry

export type FileKindMeta = { exts: string[]; label: string; previewable: 'text' | 'image' | 'none' };

/**
 * Supported project-document formats. `previewable` describes what the BROWSER
 * can genuinely do locally:
 *  - text  → real excerpt via FileReader (txt/md/csv/json/xml/yaml + code)
 *  - image → real thumbnail (png/jpg/jpeg)
 *  - none  → binary document (pdf/doc(x)/xls(x)); excerpt is an explicit
 *            "extraction requires backend integration" placeholder.
 * Anything outside this registry is rejected with an honest error.
 */
export const FILE_KINDS: FileKindMeta[] = [
  { exts: ['pdf'], label: 'PDF document', previewable: 'none' },
  { exts: ['doc', 'docx'], label: 'Word document', previewable: 'none' },
  { exts: ['txt'], label: 'Text file', previewable: 'text' },
  { exts: ['md', 'markdown'], label: 'Markdown', previewable: 'text' },
  { exts: ['csv', 'tsv'], label: 'CSV data', previewable: 'text' },
  { exts: ['xlsx', 'xls'], label: 'Excel workbook', previewable: 'none' },
  { exts: ['json'], label: 'JSON', previewable: 'text' },
  { exts: ['xml'], label: 'XML', previewable: 'text' },
  { exts: ['yaml', 'yml'], label: 'YAML', previewable: 'text' },
  { exts: ['png'], label: 'PNG image', previewable: 'image' },
  { exts: ['jpg', 'jpeg'], label: 'JPEG image', previewable: 'image' },
  // Source-code formats for code analysis (same real text preview as txt).
  { exts: ['ts', 'tsx', 'js', 'jsx', 'py', 'java', 'kt', 'go', 'rb', 'php', 'cs', 'sql', 'sh', 'html', 'css'], label: 'Source code', previewable: 'text' },
];

/** Demo size limit — enforced client-side with an explicit error state. */
export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

export function fileExt(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

export function fileKindMeta(name: string): FileKindMeta | null {
  const ext = fileExt(name);
  return FILE_KINDS.find((k) => k.exts.includes(ext)) || null;
}

export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Validate a file against the demo registry. Returns an error string or null. */
export function validateFile(file: { name: string; size: number }): string | null {
  if (!fileKindMeta(file.name)) {
    const ext = fileExt(file.name);
    return ext ? `.${ext} files are not supported in this demo` : 'Files without an extension are not supported';
  }
  if (file.size > MAX_FILE_BYTES) return `Too large — demo limit is ${humanSize(MAX_FILE_BYTES)}`;
  if (file.size === 0) return 'Empty file';
  return null;
}

/** Pragmatic URL format check (protocol optional — https:// is added). */
export function normalizeUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(candidate);
    if (!u.hostname.includes('.') && u.hostname !== 'localhost') return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Short, honest placeholder excerpt for binary formats. */
export const BINARY_EXCERPT = 'Binary document — in-browser preview shows metadata only. Text extraction requires the backend integration (not part of this demo).';

/** Guess a resource category from the file name / URL (demo convenience). */
export function guessCategory(name: string): ResourceCategory {
  const n = name.toLowerCase();
  if (/require|prd|user.?stor/.test(n)) return 'requirements';
  if (/api|swagger|openapi|postman/.test(n)) return 'api-doc';
  if (/design|mock|figma|screenshot|wireframe/.test(n) || /\.(png|jpe?g)$/.test(n)) return 'design';
  if (/spec|test.?plan/.test(n)) return 'spec';
  if (/\.(csv|tsv|xlsx?|json)$/.test(n)) return 'data';
  return 'other';
}

// ------------------------------------------------------------------- seeds

type SeedResource = Omit<ProjectResource, 'id' | 'addedAt' | 'addedBy'> & { addedBy?: string };

function hoursAgoIso(h: number): string {
  return new Date(Date.now() - h * 3600_000).toISOString();
}

function seed(projectId: string, resources: SeedResource[]): ProjectResource[] {
  return resources.map((r, i) => ({
    ...r,
    id: `res-${projectId}-${i + 1}`,
    addedAt: hoursAgoIso(r.addedBy ? 48 + i * 6 : 24 + i * 5),
    addedBy: r.addedBy || 'dev@sepyant.local',
  }));
}

/**
 * Seed resources for the KNOWN demo projects. Projects created later by the
 * user start with an empty collection and a helpful empty state.
 *  - `dev-project-0001` (Checkout Flow Redesign, dev store) + `proj-ecommerce`
 *    (2.0 conversations) share the checkout/e-commerce example from the brief.
 *  - Unknown project ids resolve to [] — honest, nothing invented.
 */
const SEEDS: Record<string, SeedResource[]> = {
  'dev-project-0001': [
    { projectId: 'dev-project-0001', kind: 'file', name: 'Checkout_Requirements.pdf', mime: 'application/pdf', size: 842_112, category: 'requirements', excerpt: BINARY_EXCERPT },
    { projectId: 'dev-project-0001', kind: 'file', name: 'Payment_API_Documentation.pdf', mime: 'application/pdf', size: 1_204_558, category: 'api-doc', excerpt: BINARY_EXCERPT },
    { projectId: 'dev-project-0001', kind: 'file', name: 'Checkout_Test_Specification.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 96_400, category: 'spec', excerpt: BINARY_EXCERPT },
    { projectId: 'dev-project-0001', kind: 'url', name: 'https://staging.checkout-demo.sepyant.dev', url: 'https://staging.checkout-demo.sepyant.dev', category: 'other', note: 'Staging environment' },
    { projectId: 'dev-project-0001', kind: 'url', name: 'https://docs.payments-gateway.example/api', url: 'https://docs.payments-gateway.example/api', category: 'api-doc', note: 'Payment gateway API docs' },
  ],
  'dev-project-0015': [
    { projectId: 'dev-project-0015', kind: 'file', name: 'expense-tracker-prd.md', mime: 'text/markdown', size: 18_400, category: 'requirements', excerpt: '# Expense Tracker PRD\n\nReceipt scanning with OCR, monthly budgets with alerts, and a reporting module that reconciles against the transaction ledger…' },
    { projectId: 'dev-project-0015', kind: 'url', name: 'https://staging.expenses-demo.sepyant.dev', url: 'https://staging.expenses-demo.sepyant.dev', category: 'other', note: 'Staging environment' },
  ],
  'proj-ecommerce': [
    { projectId: 'proj-ecommerce', kind: 'file', name: 'Checkout_Requirements.pdf', mime: 'application/pdf', size: 842_112, category: 'requirements', excerpt: BINARY_EXCERPT },
    { projectId: 'proj-ecommerce', kind: 'file', name: 'Payment_API_Documentation.pdf', mime: 'application/pdf', size: 1_204_558, category: 'api-doc', excerpt: BINARY_EXCERPT },
    { projectId: 'proj-ecommerce', kind: 'file', name: 'guest-checkout-flows.png', mime: 'image/png', size: 310_500, category: 'design', excerpt: BINARY_EXCERPT },
    { projectId: 'proj-ecommerce', kind: 'url', name: 'https://staging.shop-demo.sepyant.dev', url: 'https://staging.shop-demo.sepyant.dev', category: 'other', note: 'Staging environment' },
    { projectId: 'proj-ecommerce', kind: 'url', name: 'https://docs.shop-demo.example/orders-api', url: 'https://docs.shop-demo.example/orders-api', category: 'api-doc', note: 'Orders API v2 documentation' },
  ],
  'proj-banking': [
    { projectId: 'proj-banking', kind: 'file', name: 'kyc-onboarding-spec.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 210_300, category: 'spec', excerpt: BINARY_EXCERPT },
    { projectId: 'proj-banking', kind: 'file', name: 'mobile-transfers-api.yaml', mime: 'application/yaml', size: 42_100, category: 'api-doc', excerpt: 'openapi: 3.0.1\ninfo:\n  title: Mobile Transfers API\n  paths:\n    /transfers:\n      post:\n        summary: Create an inter-account transfer…' },
    { projectId: 'proj-banking', kind: 'url', name: 'https://app-bank-staging.sepyant.dev', url: 'https://app-bank-staging.sepyant.dev', category: 'other', note: 'Mobile web staging build' },
  ],
  'proj-expense': [
    { projectId: 'proj-expense', kind: 'file', name: 'expense-tracker-prd.md', mime: 'text/markdown', size: 18_400, category: 'requirements', excerpt: '# Expense Tracker PRD\n\nReceipt scanning with OCR, monthly budgets with alerts, and a reporting module that reconciles against the transaction ledger…' },
    { projectId: 'proj-expense', kind: 'url', name: 'https://staging.expenses-demo.sepyant.dev', url: 'https://staging.expenses-demo.sepyant.dev', category: 'other', note: 'Staging environment' },
  ],
};

/** Seed map: projectId → resources (only known demo projects are pre-seeded). */
export const RESOURCES_SEED: Record<string, ProjectResource[]> = Object.fromEntries(
  Object.entries(SEEDS).map(([pid, list]) => [pid, seed(pid, list)])
);

/** Empty collection for unknown project ids (honest empty state upstream). */
export function resourcesSeedFor(projectId: string): ProjectResource[] {
  return RESOURCES_SEED[projectId] || [];
}

// ------------------------------------------------------------------ helpers

export function resourceSubtitle(r: ProjectResource): string {
  if (r.kind === 'url') return r.note || r.url || r.name;
  return `${fileKindMeta(r.name)?.label || 'File'}${r.size != null ? ` · ${humanSize(r.size)}` : ''}`;
}
