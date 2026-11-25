import type { Metadata } from 'next';
import { Noto_Sans_TC, Plus_Jakarta_Sans } from 'next/font/google';
import { and, count, eq, isNull } from 'drizzle-orm';
import { db, isDatabaseConfigured } from '@/db';
import { notifications } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/guards';
import { Navbar, type NavbarUserProp } from '@/components/Navbar';
import './globals.css';

const notoSansTc = Noto_Sans_TC({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-sans',
  display: 'swap',
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: '社團聚 CluBar｜大專校園社團探索與交流平台',
  description:
    '從作品與成果認識陌生社團、跨屆保存組織資產、跨校同領域實務交流的校園社團平台。',
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
    <html lang="zh-Hant" className={`${notoSansTc.variable} ${plusJakarta.variable}`}>
      <body className="min-h-screen bg-[var(--bg)] text-[var(--fg)]">
        <Navbar user={navUser} unreadCount={unreadCount} />
        <main className="mx-auto min-h-[calc(100vh-4rem)] max-w-6xl px-4 pt-6 pb-24 sm:px-6 md:pb-12">
          {children}
        </main>
      </body>
    </html>
  );
}
