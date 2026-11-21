// Self-hosted fonts (bundled locally) — avoids a render-blocking request to Google Fonts
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/dm-sans/700.css';
import '@fontsource/plus-jakarta-sans/400.css';
import '@fontsource/plus-jakarta-sans/500.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';
import '@fontsource/plus-jakarta-sans/800.css';
import './globals.css';
import { cookies } from 'next/headers';
import { Poppins } from 'next/font/google';
import AuthInitializer from '@/components/auth/AuthInitializer';
import PlatformConfigInitializer from '@/components/auth/PlatformConfigInitializer';
import { SessionHintProvider } from '@/components/auth/SessionHint';

// Dashboard typeface. next/font downloads it at build time and serves it from this app,
// so there is no runtime request to Google. Used only inside .dashboard-shell.
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-poppins',
});

export const metadata = {
  title: 'Elevate — Learn without limits',
  description: 'A modern learning experience for ambitious minds.',
};

export default function RootLayout({ children }) {
  // Lets the first server-rendered header show "Log in" to guests right away (see SessionHint).
  const hasSession = cookies().has('hasSession');

  return (
    <html lang="en" className={poppins.variable}>
      <body>
        <AuthInitializer />
        <PlatformConfigInitializer />
        <SessionHintProvider hasSession={hasSession}>{children}</SessionHintProvider>
      </body>
    </html>
  );
}
