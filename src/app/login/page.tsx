import { redirect } from 'next/navigation';
import { AuthError } from 'next-auth';
import { asc } from 'drizzle-orm';
import { ShieldCheck, Sparkles, Terminal } from 'lucide-react';
import { signIn } from '@/auth';
import { db, isDatabaseConfigured } from '@/db';
import { users } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/guards';
import { sanitizeInternalPath } from '@/lib/validators';

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
    <div className="mx-auto max-w-lg py-6">
      <div className="rounded-xl border border-ink-300 bg-white p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-600 text-white">
            <Sparkles className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-ink-900">登入社團聚 CluBar</h1>
            <p className="text-sm text-ink-600">
              登入後可私密收藏作品、追蹤社團，並驗證 .edu.tw 校園身分。
            </p>
          </div>
        </div>

        {params.error && (
          <div className="mt-4 rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm font-medium text-danger-800">
            登入失敗或帳號未通過驗證，請重新選擇登入方式。
          </div>
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
                className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-accent-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-700"
              >
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                <span>使用 Microsoft 帳號登入（支援校園信箱自動驗證）</span>
              </button>
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
                className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-ink-300 bg-white px-4 py-3 text-sm font-semibold text-ink-900 transition-colors hover:bg-ink-50"
              >
                <span>使用 Google 帳號登入</span>
              </button>
            </form>
          )}

          {!hasEntra && !hasGoogle && !enableDevLogin && (
            <p className="rounded-xl bg-warning-50 p-4 text-sm leading-relaxed text-warning-900">
              尚未設定 Microsoft Entra ID 或 Google OAuth 環境變數，請依 `.env.example` 設定後再進行登入。
            </p>
          )}
        </div>

        <div className="mt-6 rounded-xl bg-ink-100 p-4 text-sm leading-relaxed text-ink-700">
          <p className="font-semibold text-ink-900">隱私與最小揭露承諾</p>
          <p className="mt-1">
            您的信箱與校園驗證資訊僅用於資格判定，絕不會在公開作品卡片或社團頁面顯示。
          </p>
        </div>

        {enableDevLogin && (
          <div className="mt-6 border-t border-line pt-6">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-700">
              <Terminal className="h-4 w-4 text-accent-600" aria-hidden="true" />
              <span>開發測試帳號快速登入（僅非正式環境啟用）</span>
            </div>
            {devAccounts.length === 0 ? (
              <p className="text-sm text-ink-500">
                目前尚無可用測試帳號，請先完成資料初始化。
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {devAccounts.map((acc) => (
                  <form
                    key={acc.id}
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
                      className="flex min-h-[44px] w-full items-center justify-between gap-2 rounded-xl border border-ink-300 bg-white px-3.5 py-2 text-left text-sm transition-colors hover:bg-accent-50"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-bold text-ink-900">{acc.displayName}</p>
                        <p className="truncate text-xs text-ink-500">{acc.email}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-ink-100 px-2.5 py-0.5 text-xs font-semibold text-ink-700">
                        {acc.platformRole === 'platform_admin'
                          ? '平台管理員'
                          : acc.campusEmail
                            ? '已驗證學生'
                            : '一般會員'}
                      </span>
                    </button>
                  </form>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
