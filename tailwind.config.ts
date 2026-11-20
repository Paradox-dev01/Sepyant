import type { Config } from 'tailwindcss';

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
        background: '#0b0d12',
        surface: '#12151c',
        surfaceHover: '#171b24',
        border: '#232733',
        primary: '#6d5efc',
        muted: '#8b93a7',
      },
    },
  },
  plugins: [],
};

export default config;
