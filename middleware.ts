import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { DEV_BYPASS } from '@/lib/dev-bypass';

export async function middleware(request: NextRequest) {
  // [FRONTEND-FIRST DEV BYPASS] skip the Supabase session refresh entirely
  // while auth is bypassed in development. Original behavior below untouched.
  if (DEV_BYPASS) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request: { headers: request.headers } });

  // Read env vars into safe constants (no non-null assertions).
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If either is missing (or empty), skip Supabase auth entirely so the app
  // still loads on localhost instead of crashing here at client creation.
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
      '[middleware] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are missing or empty — skipping Supabase auth middleware. Add them to .env.local and restart the dev server.'
    );
    return NextResponse.next();
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          request.cookies.set({ name, value: '', ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
