import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DEV_BYPASS, DEV_USER, getDevProjects } from '@/lib/dev-bypass';
import { loadDevStoreOnce } from '@/lib/dev-store-persistence';
import ConversationThread from '@/components/conversations/ConversationThread';

// ============================================================================
// [SEPYANT 2.0] Single conversation thread (Phase 2). Frontend-only content;
// this server page only supplies the shared shell props following the exact
// auth pattern used across the app.
// ============================================================================

export default async function ConversationPage({ params }: { params: { id: string } }) {
  if (DEV_BYPASS) {
    loadDevStoreOnce();
    return <ConversationThread id={params.id} userEmail={DEV_USER.email} projects={getDevProjects().map((p) => ({ id: p.id, name: p.name }))} />;
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: projects } = await supabase.from('projects').select('id, name').order('created_at', { ascending: false });

  return <ConversationThread id={params.id} userEmail={user.email || ''} projects={projects || []} />;
}
