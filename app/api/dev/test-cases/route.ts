import { NextRequest, NextResponse } from 'next/server';
import { DEV_BYPASS, deleteDevTestCase, updateDevTestCase, type DevCaseFields } from '@/lib/dev-bypass';
import { loadDevStoreOnce, saveDevStore } from '@/lib/dev-store-persistence';

// ============================================================================
// [FRONTEND-FIRST DEV BYPASS] — dev-only mock persistence for test-case edits,
// approvals and deletes. Stands in for the Supabase `test_cases` update/delete
// that persistCaseUpdate/persistCaseDelete perform in the real flow, so the
// demo's review curation survives browser refreshes exactly like the real app.
// Answers 404 unless the dev bypass flag is active (production can never
// enable it: the flag requires NODE_ENV=development). Full restore: delete
// this file together with lib/dev-bypass.ts and lib/dev-store-persistence.ts.
// ============================================================================

type CaseBody = {
  projectId?: string;
  caseId?: string;
  fields?: {
    title?: string;
    steps_json?: string[];
    expected_result?: string;
    approved?: boolean;
  };
};

function validate(body: CaseBody | null | undefined): { error: string; status: number } | null {
  if (!body?.caseId) return { error: 'caseId is required', status: 400 };
  if (body.fields !== undefined) {
    const f = body.fields;
    const keys = Object.keys(f);
    const allowed = ['title', 'steps_json', 'expected_result', 'approved'];
    if (keys.length === 0 || keys.some((k) => !allowed.includes(k))) {
      return { error: 'fields must contain title, steps_json, expected_result and/or approved', status: 400 };
    }
    if (f.title !== undefined && typeof f.title !== 'string') return { error: 'title must be a string', status: 400 };
    if (f.steps_json !== undefined && (!Array.isArray(f.steps_json) || f.steps_json.some((s) => typeof s !== 'string'))) {
      return { error: 'steps_json must be an array of strings', status: 400 };
    }
    if (f.expected_result !== undefined && typeof f.expected_result !== 'string') {
      return { error: 'expected_result must be a string', status: 400 };
    }
    if (f.approved !== undefined && typeof f.approved !== 'boolean') {
      return { error: 'approved must be a boolean', status: 400 };
    }
  }
  return null;
}

export async function PATCH(req: NextRequest) {
  if (!DEV_BYPASS) {
    return NextResponse.json({ error: 'Not available' }, { status: 404 });
  }
  let body: CaseBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const invalid = validate(body);
  if (invalid) return NextResponse.json({ error: invalid.error }, { status: invalid.status });
  if (!body.fields) return NextResponse.json({ error: 'fields are required for PATCH' }, { status: 400 });

  loadDevStoreOnce();
  const ok = updateDevTestCase(body.caseId!, body.fields as DevCaseFields);
  if (!ok) return NextResponse.json({ error: 'Test case not found' }, { status: 404 });
  saveDevStore();
  return NextResponse.json({ ok: true, devMock: true });
}

export async function DELETE(req: NextRequest) {
  if (!DEV_BYPASS) {
    return NextResponse.json({ error: 'Not available' }, { status: 404 });
  }
  let body: CaseBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const invalid = validate(body);
  if (invalid) return NextResponse.json({ error: invalid.error }, { status: invalid.status });

  loadDevStoreOnce();
  const ok = deleteDevTestCase(body.caseId!);
  if (!ok) return NextResponse.json({ error: 'Test case not found' }, { status: 404 });
  saveDevStore();
  return NextResponse.json({ ok: true, devMock: true });
}
