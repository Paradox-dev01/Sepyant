import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import NewProjectForm from './new-project-form';

export default async function ProjectsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, description, created_at')
    .order('created_at', { ascending: false });

  // If they already have a project, skip straight to the workspace.
  if (projects && projects.length > 0) {
    redirect(`/projects/${projects[0].id}`);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-[#0e1016] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="w-9 h-9 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center mx-auto mb-3">
            <span className="text-primary text-sm font-bold">S</span>
          </div>
          <h1 className="text-xl font-semibold">Welcome to Sepyant</h1>
          <p className="text-muted text-sm mt-1">Create your first project to get started</p>
        </div>
        <NewProjectForm />
      </div>
    </div>
  );
}
