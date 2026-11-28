import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Huninn, JetBrains_Mono, Noto_Sans_TC } from 'next/font/google';
import { and, count, eq, isNull } from 'drizzle-orm';
import { db, isDatabaseConfigured } from '@/db';
import { notifications } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/guards';
import { Navbar, type NavbarUserProp } from '@/components/Navbar';
import { ConfirmProvider } from '@/components/ui/Dialog';
import './globals.css';

const notoSansTC = Noto_Sans_TC({
  preload: false,
  display: 'swap',
  variable: '--font-noto-tc',
});

const bricolageGrotesque = Bricolage_Grotesque({
  weight: ['700', '800'],
  preload: false,
  display: 'swap',
  variable: '--font-bricolage',
});

const huninn = Huninn({
  weight: ['400'],
  preload: false,
  display: 'swap',
  variable: '--font-huninn',
});

const jetbrainsMono = JetBrains_Mono({
  weight: ['500', '700'],
  preload: false,
  display: 'swap',
  variable: '--font-jetbrains-mono',
});

export const viewport: Viewport = {
  themeColor: '#f9f6f0',
};

export const metadata: Metadata = {
  title: '社團聚 CluBar｜大專校園社團探索與交流平台',
  description:
    '從現場日常與體驗活動認識陌生社團、跨屆保存組織資產、跨校同領域實務交流的校園社團平台。',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let navUser: NavbarUserProp | null = null;
  let unreadCount = 0;

  if (isDatabaseConfigured()) {
    try {
      const user = await getCurrentUser();
      if (user) {
        navUser = {
          id: user.id,
          displayName: user.displayName,
          platformRole: user.platformRole,
          campusVerified: Boolean(user.campusVerifiedAt),
        };
        const [unreadRow] = await db
          .select({ total: count() })
          .from(notifications)
          .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));
        unreadCount = Number(unreadRow?.total ?? 0);
      }
    } catch {
      // Allow graceful rendering even before migrations run
    }
  }

  return (
    <html
      lang="zh-Hant"
      className={`${notoSansTC.variable} ${bricolageGrotesque.variable} ${huninn.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Chiron+GoRound+TC:wght@500;700;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-canvas text-fg">
        <ConfirmProvider>
          <Navbar user={navUser} unreadCount={unreadCount} />
          <main className="mx-auto min-h-[calc(100vh-4rem)] max-w-6xl px-4 pt-6 pb-24 sm:px-6 md:pb-12">
            {children}
          </main>
        </ConfirmProvider>
      </body>
    </html>
  );
}
