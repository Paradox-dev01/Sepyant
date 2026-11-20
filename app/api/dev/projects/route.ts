import { NextRequest, NextResponse } from 'next/server';
import { DEV_BYPASS, createDevProject, getDevProjects } from '@/lib/dev-bypass';
import { loadDevStoreOnce, saveDevStore } from '@/lib/dev-store-persistence';

// ============================================================================
// [FRONTEND-FIRST DEV BYPASS] — dev-only helper route for the mock project
// store. Client components cannot mutate server-module state directly, so
// this route stands in for the Supabase insert while auth/backend are
// bypassed. It answers 404 unless the dev bypass flag is active, and is
// unreachable in production (flag requires NODE_ENV=development).
// Full restore: delete this file together with lib/dev-bypass.ts.
// ============================================================================

export async function GET() {
  if (!DEV_BYPASS) {
    return NextResponse.json({ error: 'Not available' }, { status: 404 });
  }
  loadDevStoreOnce();
  return NextResponse.json({ projects: getDevProjects(), devMock: true });
}

export async function POST(req: NextRequest) {
  if (!DEV_BYPASS) {
    return NextResponse.json({ error: 'Not available' }, { status: 404 });
  }
  loadDevStoreOnce();

  let body: { name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const name = body?.name?.trim();
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const project = createDevProject(name);
  // [DEV MOCK PERSISTENCE] keep the crafted demo scenario across restarts.
  saveDevStore();
  return NextResponse.json({ project, devMock: true });
}
