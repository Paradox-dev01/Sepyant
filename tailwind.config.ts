import type { Config } from 'tailwindcss';

// [PHASE 1] Design tokens unified with the workspace palette in lib/theme.ts
// (ported from the Figma design). These two sets had drifted apart (e.g.
// primary #6d5efc vs accent #4f6ef7, border #232733 vs #1e2330), so the auth
// and workspace surfaces rendered with slightly different colors. The values
// below now match lib/theme.ts exactly; `muted` was raised to C.fgDim for
// WCAG AA contrast on the dark background.
const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      colors: {
        // [SEPYANT 2.1] tokens resolve through the CSS custom properties in
        // app/globals.css so Tailwind surfaces (auth pages, forms) follow the
        // light/dark theme switch exactly like the inline-styled workspace.
        background: 'var(--sep-bg)',
        surface: 'var(--sep-surface)',
        surfaceHover: 'var(--sep-surface2)',
        border: 'var(--sep-border)',
        primary: 'var(--sep-accent)',
        accent: 'var(--sep-accent)', // alias — one accent, two common names
        muted: 'var(--sep-fg-dim)',
        success: 'var(--sep-success)',
        warning: 'var(--sep-warning)',
        danger: 'var(--sep-danger)',
      },
    },
  },
  plugins: [],
};

export default config;
