import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DEV_BYPASS, DEV_USER, getDevProjects } from '@/lib/dev-bypass';
import { loadDevStoreOnce } from '@/lib/dev-store-persistence';
import QualityDashboard from '@/components/dashboard/QualityDashboard';

// ============================================================================
// [DASHBOARD] AI Test Quality Dashboard route.
//
// The dashboard CONTENT is frontend-only (static mock dataset in
// lib/dashboard-mock.ts — no Supabase / API calls). This page only supplies
// the shared sidebar's project list + user email, following the exact same
// auth pattern as the other pages: dev-bypass branch first, original
// Supabase flow untouched below it.
// ============================================================================

export default async function DashboardPage() {
  // [FRONTEND-FIRST DEV BYPASS] sidebar gets the dev store's project list and
  // the fake dev user; no Supabase client is created.
  if (DEV_BYPASS) {
    loadDevStoreOnce();
    return (
      <QualityDashboard
        projects={getDevProjects().map((p) => ({ id: p.id, name: p.name }))}
        userEmail={DEV_USER.email}
      />
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: projects } = await supabase
    .from('projects')
    .select('id, name')
    .order('created_at', { ascending: false });

  return <QualityDashboard projects={projects || []} userEmail={user.email || ''} />;
}
