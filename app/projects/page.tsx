import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DEV_BYPASS, DEV_USER, getDevProjects } from '@/lib/dev-bypass';
import { loadDevStoreOnce } from '@/lib/dev-store-persistence';
import ProjectsOverview from './projects-overview';

export default async function ProjectsPage() {
  // [SEPYANT 2.0] /projects is now a real projects overview (Phase 2: create,
  // organise and switch between projects) instead of an automatic redirect
  // into the most recent workspace. The original Supabase data flow and the
  // dev-bypass store are unchanged — only the redirect behaviour was
  // replaced by the overview UI.
  if (DEV_BYPASS) {
    // [DEV MOCK PERSISTENCE] hydrate the mock store from disk (first access
    // in this server process only) so crafted demo data survives restarts.
    loadDevStoreOnce();
    const devProjects = getDevProjects();
    return <ProjectsOverview userEmail={DEV_USER.email} projects={devProjects.map((p) => ({ id: p.id, name: p.name, created_at: p.created_at, description: p.description }))} />;
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, description, created_at')
    .order('created_at', { ascending: false });

  return <ProjectsOverview userEmail={user.email || ''} projects={projects || []} />;
}
