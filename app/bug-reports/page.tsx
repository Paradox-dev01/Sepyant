import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DEV_BYPASS, DEV_USER, getDevProjects } from '@/lib/dev-bypass';
import { loadDevStoreOnce } from '@/lib/dev-store-persistence';
import DocumentsView from '@/components/documents/DocumentsView';

// ============================================================================
// [SEPYANT 2.0] Bug reports route (Phase 3). The page content is
// frontend-only (client-side mock store — no Supabase / API calls); this
// server component only supplies the shared sidebar's project list + user
// email, following the same auth pattern as the other pages: dev-bypass
// branch first, original Supabase flow untouched below.
// ============================================================================

export default async function BugReportsPage() {
  if (DEV_BYPASS) {
    loadDevStoreOnce();
    return <DocumentsView scope="bug-reports" userEmail={DEV_USER.email} projects={getDevProjects().map((p) => ({ id: p.id, name: p.name }))} />;
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: projects } = await supabase.from('projects').select('id, name').order('created_at', { ascending: false });

  return <DocumentsView scope="bug-reports" userEmail={user.email || ''} projects={projects || []} />;
}
