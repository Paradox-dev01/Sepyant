import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// After Google login, Supabase redirects here with a ?code= param.
// We exchange it for a real session, then send the user into the app.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    const supabase = createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${origin}/projects`);
}
