import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { THEME_INIT_SCRIPT } from '@/lib/theme';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jbmono' });

export const metadata: Metadata = {
  title: 'Sepyant',
  description: 'AI-Powered Manual QA Workspace',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      {/*
        [SEPYANT 2.1] No-flash theming: apply the stored light/dark choice to
        <html data-theme> before first paint. suppressHydrationWarning covers
        the attribute this script adds during hydration.
      */}
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="font-sans">{children}</body>
    </html>
  );
}
