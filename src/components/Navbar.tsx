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
  /** Plain-words meaning of the brand label, e.g. 別的聚 = 探索. */
  hint?: string;
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
  const isOnboarding = pathname.startsWith('/onboarding');
  const isDiscover = !isMyClubs && !isTogether && !isMe && !isAdmin && !isOnboarding;

  const loginHref =
    pathname && pathname !== '/login' ? `/login?callbackUrl=${encodeURIComponent(pathname)}` : '/login';

  const items: NavItem[] = [
    { href: '/', label: '別的聚', hint: '探索', icon: Compass, active: isDiscover },
    { href: '/together', label: '一起聚', hint: '跨校', icon: Users, active: isTogether },
    { href: '/my-clubs', label: '我的聚', hint: '我的社團', icon: FolderHeart, active: isMyClubs },
  ];

  return (
    <>
      <header className="no-print sticky top-0 z-40 border-b-2 border-border-ink bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex min-h-11 items-center gap-2.5" aria-label="社團聚 CluBar 首頁">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/clubar-mark.png"
                alt=""
                width={32}
                height={32}
                className="h-8 w-8 rounded-lg border-2 border-border-ink"
              />
              <span className="font-display text-xl font-black tracking-tight text-fg">社團聚</span>
              <span className="hidden rounded-md border-2 border-border-ink bg-spark px-2 py-0.5 font-mono text-xs font-bold text-fg sm:inline-block">
                115-1
              </span>
            </Link>

            <nav className="hidden items-center gap-1.5 md:flex" aria-label="主導覽列">
              {items.map((it) => (
                <Link
                  key={it.href}
                  href={it.href}
                  aria-current={it.active ? 'page' : undefined}
                  className={cn(
                    'inline-flex min-h-11 flex-col items-start justify-center rounded-xl border-2 px-3.5 font-display text-sm font-bold leading-tight transition-transform',
                    it.active
                      ? 'tactile-shadow-sm border-border-ink bg-spark text-fg'
                      : 'border-transparent text-fg-secondary hover:bg-surface-subtle hover:text-fg'
                  )}
                >
                  <span>{it.label}</span>
                  <span className="font-sans text-xs font-medium">
                    <span className="sr-only">：</span>
                    {it.hint}
                  </span>
                </Link>
              ))}
              {user?.platformRole === 'platform_admin' && (
                <Link
                  href="/admin"
                  aria-current={isAdmin ? 'page' : undefined}
                  className={cn(
                    'inline-flex min-h-11 items-center rounded-xl border-2 px-3.5 font-display text-sm font-bold transition-transform',
                    isAdmin
                      ? 'tactile-shadow-sm border-border-ink bg-spark text-fg'
                      : 'border-transparent text-fg-secondary hover:bg-surface-subtle hover:text-fg'
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
                <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-border-ink bg-spark text-fg">
                  <User className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="hidden max-w-[120px] truncate sm:inline">{user.displayName}</span>
                {user.campusVerified && (
                  <ShieldCheck className="h-4 w-4 text-cobalt" aria-label="已完成校園驗證" />
                )}
                {unreadCount > 0 && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-border-ink bg-brand px-1.5 text-xs font-bold text-on-brand">
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

      {/* Mobile bottom navigation */}
      {!hasOwnBottomBar(pathname) && (
        <nav
          className="no-print fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t-2 border-border-ink bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
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
                aria-label={'hint' in it && it.hint ? `${it.label}：${it.hint}` : undefined}
                aria-current={it.active ? 'page' : undefined}
                className={cn(
                  'relative flex min-h-14 flex-col items-center justify-center gap-0.5 font-display text-xs font-bold',
                  it.active ? 'bg-spark text-fg' : 'text-fg-muted'
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={it.active ? 2.5 : 1.9} aria-hidden="true" />
                <span>{it.label}</span>
                {it.label === '我' && unreadCount > 0 && (
                  <span className="absolute top-2 right-[calc(50%-14px)] h-2.5 w-2.5 rounded-full border border-border-ink bg-brand" />
                )}
              </Link>
            );
          })}
        </nav>
      )}
    </>
  );
}
