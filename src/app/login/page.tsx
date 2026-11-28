import { redirect } from 'next/navigation';
import { AuthError } from 'next-auth';
import { asc } from 'drizzle-orm';
import { ShieldCheck } from 'lucide-react';
import { signIn } from '@/auth';
import { db, isDatabaseConfigured } from '@/db';
import { users } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/guards';
import { sanitizeInternalPath } from '@/lib/validators';

import { Card, Notice, buttonClasses } from '@/components/ui';
export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const user = await getCurrentUser().catch(() => null);
  const params = await searchParams;
  const callbackUrl = sanitizeInternalPath(params.callbackUrl, '/');

  if (user?.id) {
    redirect(callbackUrl);
  }

  const hasEntra = Boolean(
    process.env.AUTH_MICROSOFT_ENTRA_ID_ID && process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET
  );
  const hasGoogle = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
  const enableDevLogin =
    process.env.NODE_ENV !== 'production' && process.env.ENABLE_DEV_LOGIN === 'true';

  const devAccounts =
    enableDevLogin && isDatabaseConfigured()
      ? await db
          .select({
            id: users.id,
            email: users.email,
            displayName: users.displayName,
            platformRole: users.platformRole,
            campusEmail: users.campusEmail,
          })
          .from(users)
          .orderBy(asc(users.createdAt))
          .limit(12)
          .catch(() => [])
      : [];

  return (
    <Card className="mx-auto my-8 max-w-sm sm:my-12">
      <h1 className="font-display text-2xl font-black text-fg">登入社團聚</h1>
      <p className="mt-2 text-base text-fg-muted">
        登入後可收藏作品、追蹤社團，並驗證 .edu.tw 校園身分。
      </p>

      {params.error && (
        <Notice tone="danger" className="mt-6">
          登入失敗或帳號未通過驗證，請重新選擇登入方式。
        </Notice>
      )}

      <div className="mt-6 space-y-3">
        {hasEntra && (
          <form
            action={async () => {
              'use server';
              try {
                await signIn('microsoft-entra-id', { redirectTo: callbackUrl });
              } catch (err) {
                if (err instanceof AuthError) {
                  redirect(`/login?error=OAuthFailed&callbackUrl=${encodeURIComponent(callbackUrl)}`);
                }
                throw err;
              }
            }}
          >
            <button
              type="submit"
              className={buttonClasses({ variant: 'primary', size: 'lg', block: true })}
            >
              <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>使用 Microsoft 帳號登入</span>
            </button>
            <p className="mt-1.5 text-center text-sm text-fg-muted">支援校園信箱自動驗證</p>
          </form>
        )}

        {hasGoogle && (
          <form
            action={async () => {
              'use server';
              try {
                await signIn('google', { redirectTo: callbackUrl });
              } catch (err) {
                if (err instanceof AuthError) {
                  redirect(`/login?error=OAuthFailed&callbackUrl=${encodeURIComponent(callbackUrl)}`);
                }
                throw err;
              }
            }}
          >
            <button
              type="submit"
              className={buttonClasses({
                variant: hasEntra ? 'secondary' : 'primary',
                size: 'lg',
                block: true,
              })}
            >
              <span>使用 Google 帳號登入</span>
            </button>
          </form>
        )}

        {!hasEntra && !hasGoogle && !enableDevLogin && (
          <Notice tone="warning">
            尚未設定 Microsoft Entra ID 或 Google OAuth 環境變數，請依 .env.example 設定後再進行登入。
          </Notice>
        )}
      </div>

      <p className="mt-6 text-sm leading-relaxed text-fg-muted">
        你的信箱與校園驗證資訊僅用於資格判定，不會顯示在公開的作品卡片或社團頁面。
      </p>

      {enableDevLogin && (
        <details className="group mt-8 border-t border-line pt-2">
          <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 text-sm font-medium text-fg-secondary hover:text-fg">
            <span>開發測試帳號（僅非正式環境）</span>
            <span
              aria-hidden="true"
              className="text-fg-subtle transition-transform group-open:rotate-90"
            >
              ›
            </span>
          </summary>
          {devAccounts.length === 0 ? (
            <p className="mt-2 text-sm text-fg-muted">目前尚無可用測試帳號，請先完成資料初始化。</p>
          ) : (
            <ul className="mt-2 divide-y divide-line overflow-hidden rounded-xl border-2 border-line">
              {devAccounts.map((acc) => (
                <li key={acc.id}>
                  <form
                    action={async () => {
                      'use server';
                      try {
                        await signIn('dev-login', {
                          email: acc.email,
                          redirectTo: callbackUrl,
                        });
                      } catch (err) {
                        if (err instanceof AuthError) {
                          redirect(
                            `/login?error=DevLoginFailed&callbackUrl=${encodeURIComponent(callbackUrl)}`
                          );
                        }
                        throw err;
                      }
                    }}
                  >
                    <button
                      type="submit"
                      className="flex min-h-14 w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-surface-subtle"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-fg">
                          {acc.displayName}
                        </span>
                        <span className="block truncate text-sm font-normal text-fg-muted">
                          {acc.email}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-normal text-fg-muted">
                        {acc.platformRole === 'platform_admin'
                          ? '平台管理員'
                          : acc.campusEmail
                            ? '已驗證學生'
                            : '一般會員'}
                      </span>
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </details>
      )}
    </Card>
  );
}
