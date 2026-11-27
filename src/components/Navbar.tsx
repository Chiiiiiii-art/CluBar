'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Compass, Users, User, LogIn, ShieldCheck, FolderHeart, type LucideIcon } from 'lucide-react';
import { ButtonLink, buttonClasses, cn } from '@/components/ui';

export interface NavbarUserProp {
  id: string;
  displayName: string;
  platformRole: 'user' | 'school_admin' | 'platform_admin';
  campusVerified: boolean;
}

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
}

/** Routes whose page carries its own sticky bottom action bar. */
function hasOwnBottomBar(pathname: string) {
  return pathname.startsWith('/e/');
}

export function Navbar({
  user,
  unreadCount,
}: {
  user: NavbarUserProp | null;
  unreadCount: number;
}) {
  const pathname = usePathname() ?? '/';

  // "我的聚" is the user's own workspace; public club/event/post pages belong
  // to discovery, so they keep "別的聚" highlighted.
  const isMyClubs =
    pathname.startsWith('/my-clubs') ||
    pathname === '/clubs/apply' ||
    /^\/clubs\/[^/]+\/(manage|evaluation)/.test(pathname);
  const isTogether = pathname.startsWith('/together');
  const isMe = pathname.startsWith('/me') || pathname.startsWith('/u/') || pathname.startsWith('/login');
  const isAdmin = pathname.startsWith('/admin');
  const isDiscover = !isMyClubs && !isTogether && !isMe && !isAdmin;

  const loginHref =
    pathname && pathname !== '/login' ? `/login?callbackUrl=${encodeURIComponent(pathname)}` : '/login';

  const items: NavItem[] = [
    { href: '/', label: '別的聚', icon: Compass, active: isDiscover },
    { href: '/together', label: '一起聚', icon: Users, active: isTogether },
    { href: '/my-clubs', label: '我的聚', icon: FolderHeart, active: isMyClubs },
  ];

  return (
    <>
      <header className="no-print sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex min-h-11 items-center gap-2.5" aria-label="社團聚 CluBar 首頁">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/clubar-mark.png"
                alt=""
                width={32}
                height={32}
                className="h-8 w-8 rounded-lg"
              />
              <span className="text-lg font-bold tracking-tight text-ink-900">社團聚</span>
            </Link>

            <nav className="hidden items-center gap-1 md:flex" aria-label="主導覽列">
              {items.map((it) => (
                <Link
                  key={it.href}
                  href={it.href}
                  aria-current={it.active ? 'page' : undefined}
                  className={cn(
                    'inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium transition-colors',
                    it.active ? 'bg-ink-100 text-ink-900' : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900'
                  )}
                >
                  {it.label}
                </Link>
              ))}
              {user?.platformRole === 'platform_admin' && (
                <Link
                  href="/admin"
                  aria-current={isAdmin ? 'page' : undefined}
                  className={cn(
                    'inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium transition-colors',
                    isAdmin ? 'bg-ink-100 text-ink-900' : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900'
                  )}
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
                aria-current={isMe ? 'page' : undefined}
                aria-label={unreadCount > 0 ? `${user.displayName}，${unreadCount} 則未讀通知` : undefined}
                className={buttonClasses({ variant: 'secondary', size: 'sm', className: 'relative pr-3 pl-1' })}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-100 text-ink-700">
                  <User className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="hidden max-w-[120px] truncate sm:inline">{user.displayName}</span>
                {user.campusVerified && (
                  <ShieldCheck className="h-4 w-4 text-accent-600" aria-label="已完成校園驗證" />
                )}
                {unreadCount > 0 && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-danger-600 px-1.5 text-xs font-semibold text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
            ) : (
              <div className="hidden md:block">
                <ButtonLink
                  href={loginHref}
                  aria-current={isMe ? 'page' : undefined}
                  icon={<LogIn className="h-4 w-4" aria-hidden="true" />}
                >
                  登入
                </ButtonLink>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile bottom navigation (PRD v2 §3.2) */}
      {!hasOwnBottomBar(pathname) && (
        <nav
          className="no-print fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
          aria-label="行動版底部導覽"
        >
          {[
            ...items,
            { href: user ? '/me' : loginHref, label: user ? '我' : '登入', icon: user ? User : LogIn, active: isMe },
          ].map((it) => {
            const Icon = it.icon;
            return (
              <Link
                key={it.label}
                href={it.href}
                aria-current={it.active ? 'page' : undefined}
                className={cn(
                  'relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium',
                  it.active ? 'text-ink-900' : 'text-ink-500'
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={it.active ? 2.4 : 1.8} aria-hidden="true" />
                <span>{it.label}</span>
                {it.label === '我' && unreadCount > 0 && (
                  <span className="absolute top-2 right-[calc(50%-14px)] h-2 w-2 rounded-full bg-danger-600" />
                )}
              </Link>
            );
          })}
        </nav>
      )}
    </>
  );
}
