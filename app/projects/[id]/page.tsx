import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DEV_BYPASS, DEV_USER, getDevProject, getDevProjects, getDevTestPlans } from '@/lib/dev-bypass';
import { loadDevStoreOnce } from '@/lib/dev-store-persistence';
import Workspace from './workspace';

export default async function ProjectPage({ params }: { params: { id: string } }) {
  // [FRONTEND-FIRST DEV BYPASS] serve mock workspace data from the in-memory
  // dev store instead of Supabase. The original data flow below is untouched.
  if (DEV_BYPASS) {
    // [DEV MOCK PERSISTENCE] hydrate the mock store from disk (first access
    // in this server process only) so crafted demo data survives restarts.
    loadDevStoreOnce();
    const devProject = getDevProject(params.id);
    if (!devProject) redirect('/projects');

    return (
      <Workspace
        project={{ id: devProject.id, name: devProject.name }}
        allProjects={getDevProjects().map((p) => ({ id: p.id, name: p.name }))}
        initialTestPlans={getDevTestPlans(devProject.id)}
        userEmail={DEV_USER.email}
      />
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: project } = await supabase
    .from('projects')
    .select('id, name')
    .eq('id', params.id)
    .single();

  if (!project) redirect('/projects');

  const { data: allProjects } = await supabase
    .from('projects')
    .select('id, name')
    .order('created_at', { ascending: false });

  const { data: testPlans } = await supabase
    .from('test_plans')
    .select(
      `id, content_json, created_at,
       requirements ( raw_content ),
       test_scenarios (
         id, title, description, priority,
         test_cases ( id, title, preconditions, steps_json, test_data, expected_result, priority, severity, status, approved, needs_verification )
       )`
    )
    .eq('project_id', project.id)
    .order('created_at', { ascending: true });

  return (
    <Workspace
      project={project}
      allProjects={allProjects || []}
      initialTestPlans={testPlans || []}
      userEmail={user.email || ''}
    />
  );
}
