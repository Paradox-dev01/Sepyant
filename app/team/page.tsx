import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DEV_BYPASS, DEV_USER, getDevProjects } from '@/lib/dev-bypass';
import { loadDevStoreOnce } from '@/lib/dev-store-persistence';
import TeamView from '@/components/team/TeamView';

// ============================================================================
// [SEPYANT 2.0] Team collaboration route (Phase 6). The page content is
// frontend-only (client-side mock store — no Supabase / API calls); this
// server component only supplies the shared sidebar's project list + user
// email, following the same auth pattern as the other pages: dev-bypass
// branch first, original Supabase flow untouched below.
// ============================================================================

export default async function TeamPage() {
  if (DEV_BYPASS) {
    loadDevStoreOnce();
    return <TeamView userEmail={DEV_USER.email} projects={getDevProjects().map((p) => ({ id: p.id, name: p.name }))} />;
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: projects } = await supabase.from('projects').select('id, name').order('created_at', { ascending: false });

  return <TeamView userEmail={user.email || ''} projects={projects || []} />;
}
