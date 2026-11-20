import Link from 'next/link';

// ============================================================================
// [SEPYANT] Branded 404 — replaces the unbranded Next.js default error page.
// Follows the auth-page design language (gradient background, surface card,
// brand mark) so every reachable screen carries the SEPYANT identity.
// ============================================================================

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-[var(--sep-bg)] px-4">
      <div className="w-full max-w-sm bg-surface border border-border rounded-xl p-8 shadow-2xl shadow-black/20 dark:shadow-black/40 text-center">
        <div className="w-9 h-9 mx-auto rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center mb-3">
          <span className="text-primary text-sm font-bold">S</span>
        </div>
        <h1 className="text-3xl font-semibold">404</h1>
        <p className="text-sm mt-2 font-medium">This page could not be found.</p>
        <p className="text-muted text-sm mt-1">
          The link may be outdated, or the resource was moved or deleted.
        </p>
        <Link
          href="/projects"
          className="mt-6 inline-block w-full bg-primary hover:bg-primary/90 text-white rounded-lg py-2.5 text-sm font-medium transition-colors"
        >
          Back to your projects
        </Link>
      </div>
    </div>
  );
}
