import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DEV_BYPASS } from '@/lib/dev-bypass';

export default async function Home() {
  // [FRONTEND-FIRST DEV BYPASS] skip the Supabase session check while auth is
  // bypassed in development. The original logic below is untouched.
  if (DEV_BYPASS) redirect('/projects');

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  redirect(user ? '/projects' : '/login');
}
