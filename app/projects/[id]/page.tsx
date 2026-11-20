import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Workspace from './workspace';

export default async function ProjectPage({ params }: { params: { id: string } }) {
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
