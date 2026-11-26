'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Compass,
  Users,
  Sparkles,
  User,
  LogIn,
  ShieldCheck,
  FolderHeart,
} from 'lucide-react';

export interface NavbarUserProp {
  id: string;
  displayName: string;
  platformRole: 'user' | 'school_admin' | 'platform_admin';
  campusVerified: boolean;
}

export function Navbar({
  user,
  unreadCount,
}: {
  user: NavbarUserProp | null;
  unreadCount: number;
}) {
  const pathname = usePathname();

  const isDiscover =
    pathname === '/' ||
    pathname.startsWith('/posts') ||
    pathname.startsWith('/onboarding') ||
    pathname.startsWith('/blend');
  const isTogether = pathname.startsWith('/together');
  const isMyClubs = pathname.startsWith('/my-clubs') || pathname.startsWith('/clubs');
  const isMe =
    pathname.startsWith('/me') || pathname.startsWith('/u/') || pathname.startsWith('/login');
  const isAdmin = pathname.startsWith('/admin');

  return (
    <>
      <header className="no-print sticky top-0 z-40 border-b border-[var(--border)] bg-[#FFF7ED]/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="flex items-center gap-2.5 font-bold tracking-tight text-slate-900"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand)] text-white shadow-sm">
                <Sparkles className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="flex flex-col leading-none">
                <span className="text-base font-extrabold">社團聚</span>
                <span className="text-[11px] font-medium text-slate-500">CluBar v2</span>
              </span>
            </Link>

            <nav className="hidden items-center gap-1 md:flex" aria-label="主導覽列">
              <Link
                href="/"
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  isDiscover
                    ? 'bg-orange-100 text-orange-900'
                    : 'text-slate-700 hover:bg-orange-50'
                }`}
              >
                別的聚
              </Link>
              <Link
                href="/together"
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  isTogether
                    ? 'bg-orange-100 text-orange-900'
                    : 'text-slate-700 hover:bg-orange-50'
                }`}
              >
                一起聚
              </Link>
              <Link
                href="/my-clubs"
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  isMyClubs
                    ? 'bg-orange-100 text-orange-900'
                    : 'text-slate-700 hover:bg-orange-50'
                }`}
              >
                我的社團
              </Link>
              {user?.platformRole === 'platform_admin' && (
                <Link
                  href="/admin"
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                    isAdmin
                      ? 'bg-blue-100 text-blue-900'
                      : 'text-blue-700 hover:bg-blue-50'
                  }`}
                >
                  平台治理
                </Link>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            {user ? (
              <Link
                href="/me"
                className="relative inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[var(--border-strong)] bg-white px-3.5 py-2 text-sm font-semibold text-slate-900 shadow-xs transition-colors hover:bg-orange-50"
              >
                <User className="h-4 w-4 text-[var(--primary)]" aria-hidden="true" />
                <span className="max-w-[120px] truncate">{user.displayName}</span>
                {user.campusVerified && (
                  <ShieldCheck
                    className="h-4 w-4 text-blue-600"
                    aria-label="已完成校園驗證"
                  />
                )}
                {unreadCount > 0 && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--primary)] px-1.5 text-[11px] font-bold text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
            ) : (
              <Link
                href="/login"
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-[var(--primary-hover)]"
              >
                <LogIn className="h-4 w-4" aria-hidden="true" />
                登入
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Mobile bottom 4-tab navigation (PRD v2 §3.2) */}
      <nav
        className="no-print fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-[var(--border-strong)] bg-white/95 backdrop-blur md:hidden"
        aria-label="行動版底部導覽"
      >
        <Link
          href="/"
          className={`flex min-h-[56px] flex-col items-center justify-center gap-1 py-2 text-[11px] font-semibold ${
            isDiscover ? 'text-[var(--primary)]' : 'text-slate-600'
          }`}
        >
          <Compass className="h-5 w-5" aria-hidden="true" />
          <span>別的聚</span>
        </Link>
        <Link
          href="/together"
          className={`flex min-h-[56px] flex-col items-center justify-center gap-1 py-2 text-[11px] font-semibold ${
            isTogether ? 'text-[var(--primary)]' : 'text-slate-600'
          }`}
        >
          <Users className="h-5 w-5" aria-hidden="true" />
          <span>一起聚</span>
        </Link>
        <Link
          href="/my-clubs"
          className={`flex min-h-[56px] flex-col items-center justify-center gap-1 py-2 text-[11px] font-semibold ${
            isMyClubs ? 'text-[var(--primary)]' : 'text-slate-600'
          }`}
        >
          <FolderHeart className="h-5 w-5" aria-hidden="true" />
          <span>我的社團</span>
        </Link>
        <Link
          href={user ? '/me' : '/login'}
          className={`relative flex min-h-[56px] flex-col items-center justify-center gap-1 py-2 text-[11px] font-semibold ${
            isMe ? 'text-[var(--primary)]' : 'text-slate-600'
          }`}
        >
          <User className="h-5 w-5" aria-hidden="true" />
          <span>{user ? '足跡與個人' : '登入'}</span>
          {user && unreadCount > 0 && (
            <span className="absolute top-2 right-6 h-2 w-2 rounded-full bg-[var(--primary)]" />
          )}
        </Link>
      </nav>
    </>
  );
}
