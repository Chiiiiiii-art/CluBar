import type { Metadata, Viewport } from 'next';
import { Noto_Sans_TC } from 'next/font/google';
import { and, count, eq, isNull } from 'drizzle-orm';
import { db, isDatabaseConfigured } from '@/db';
import { notifications } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/guards';
import { Navbar, type NavbarUserProp } from '@/components/Navbar';
import { ConfirmProvider } from '@/components/ui/Dialog';
import './globals.css';

const notoSansTC = Noto_Sans_TC({
  // CJK fonts are split into unicode-range slices by Google Fonts; preloading
  // would fetch every slice, so let the browser request only what it renders.
  preload: false,
  display: 'swap',
  variable: '--font-noto-tc',
});

export const viewport: Viewport = {
  themeColor: '#ffffff',
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
    <html lang="zh-Hant" className={notoSansTC.variable}>
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
