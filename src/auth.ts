import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id';
import type { Provider } from 'next-auth/providers';
import { and, eq } from 'drizzle-orm';
import { db, isDatabaseConfigured } from '@/db';
import { oauthAccounts, universities, users } from '@/db/schema';
import { isBootstrapAdminAccount, matchesUniversityDomain } from '@/lib/validators';

async function resolveCampusMatch(email: string): Promise<string | null> {
  const allUnis = await db.select().from(universities);
  const matched = allUnis.find((u) => matchesUniversityDomain(email, u.emailDomains));
  return matched?.id ?? null;
}

const providers: Provider[] = [];

if (process.env.AUTH_MICROSOFT_ENTRA_ID_ID && process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET) {
  providers.push(
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      issuer:
        process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER ||
        'https://login.microsoftonline.com/common/v2.0',
      authorization: {
        params: {
          scope: 'openid profile email',
        },
      },
    })
  );
}

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    })
  );
}

// ponytail: dev-only credential login for local testing/Demo Day rehearsal without live OAuth secrets;
// disabled automatically in production builds unless explicitly evaluated outside prod.
if (process.env.NODE_ENV !== 'production' && process.env.ENABLE_DEV_LOGIN === 'true') {
  providers.push(
    Credentials({
      id: 'dev-login',
      name: '開發測試帳號登入',
      credentials: {
        email: { label: 'Email', type: 'email' },
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === 'string' ? credentials.email.trim().toLowerCase() : '';
        if (!email || !isDatabaseConfigured()) return null;
        const [found] = await db.select().from(users).where(eq(users.email, email)).limit(1);
        if (!found) return null;
        return {
          id: found.id,
          email: found.email,
          name: found.displayName,
          image: found.avatarUrl ?? undefined,
        };
      },
    })
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  trustHost: true,
  session: { strategy: 'jwt' },
  secret:
    process.env.AUTH_SECRET ||
    (process.env.NODE_ENV !== 'production' ? 'clubar-local-dev-secret-not-for-prod' : undefined),
  pages: {
    signIn: '/login',
  },
  logger: {
    error(error) {
      if (
        error?.name === 'JWTSessionError' ||
        error?.constructor?.name === 'JWTSessionError' ||
        String(error).includes('JWTSessionError')
      ) {
        return;
      }
      console.error('[auth][error]', error);
    },
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!account || !isDatabaseConfigured()) return false;

      if (account.provider === 'dev-login') {
        return Boolean(user?.id);
      }

      const provider = account.provider;
      const providerAccountId = account.providerAccountId;
      const rawEmail = user.email?.trim().toLowerCase();
      if (!rawEmail || !providerAccountId) return false;

      const emailVerified =
        (provider === 'google' && profile?.email_verified === true) ||
        (provider === 'microsoft-entra-id' && profile?.email_verified === true);

      // 1. Check existing linked oauth_account first
      const [existingOAuth] = await db
        .select()
        .from(oauthAccounts)
        .where(
          and(
            eq(oauthAccounts.provider, provider),
            eq(oauthAccounts.providerAccountId, providerAccountId)
          )
        )
        .limit(1);

      let userId = existingOAuth?.userId;

      if (!userId) {
        const [existingByEmail] = await db
          .select()
          .from(users)
          .where(eq(users.email, rawEmail))
          .limit(1);

        if (existingByEmail) {
          // Security rule (SRS §2.1): never auto-link to an existing email unless provider confirms email_verified === true
          if (!emailVerified) {
            return false;
          }
          userId = existingByEmail.id;
        } else {
          const isAdmin = isBootstrapAdminAccount({ email: rawEmail, emailVerified });
          const matchedUniId = emailVerified ? await resolveCampusMatch(rawEmail) : null;
          let campusEmailTaken = false;
          if (matchedUniId) {
            const [dup] = await db
              .select({ id: users.id })
              .from(users)
              .where(eq(users.campusEmail, rawEmail))
              .limit(1);
            campusEmailTaken = Boolean(dup);
          }

          const [created] = await db
            .insert(users)
            .values({
              email: rawEmail,
              displayName: user.name?.trim() || rawEmail.split('@')[0] || '使用者',
              avatarUrl: user.image ?? null,
              platformRole: isAdmin ? 'platform_admin' : 'user',
              campusEmail: matchedUniId && !campusEmailTaken ? rawEmail : null,
              universityId: matchedUniId && !campusEmailTaken ? matchedUniId : null,
              campusVerifiedAt: matchedUniId && !campusEmailTaken ? new Date() : null,
            })
            .returning({ id: users.id });

          userId = created.id;
        }

        await db
          .insert(oauthAccounts)
          .values({
            userId,
            provider,
            providerAccountId,
          })
          .onConflictDoNothing();
      }

      // Sync admin bootstrap or auto-campus verify on returning sign-ins
      if (userId) {
        const [current] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        if (current) {
          const updates: Partial<typeof users.$inferInsert> = {};
          if (
            current.platformRole !== 'platform_admin' &&
            isBootstrapAdminAccount({
              email: rawEmail,
              emailVerified,
              campusEmail: current.campusEmail,
              campusVerifiedAt: current.campusVerifiedAt,
            })
          ) {
            updates.platformRole = 'platform_admin';
          }
          if (emailVerified && !current.campusVerifiedAt) {
            const matchedUniId = await resolveCampusMatch(rawEmail);
            if (matchedUniId) {
              const [dup] = await db
                .select({ id: users.id })
                .from(users)
                .where(eq(users.campusEmail, rawEmail))
                .limit(1);
              if (!dup) {
                updates.campusEmail = rawEmail;
                updates.universityId = matchedUniId;
                updates.campusVerifiedAt = new Date();
              }
            }
          }
          if (Object.keys(updates).length > 0) {
            updates.updatedAt = new Date();
            await db.update(users).set(updates).where(eq(users.id, userId));
          }
        }
      }

      user.id = userId;
      return true;
    },
    async jwt({ token, user, account }) {
      if (user?.id) {
        token.userId = user.id;
      } else if (account?.provider && account?.providerAccountId && isDatabaseConfigured()) {
        const [linked] = await db
          .select({ userId: oauthAccounts.userId })
          .from(oauthAccounts)
          .where(
            and(
              eq(oauthAccounts.provider, account.provider),
              eq(oauthAccounts.providerAccountId, account.providerAccountId)
            )
          )
          .limit(1);
        if (linked) {
          token.userId = linked.userId;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && typeof token.userId === 'string') {
        session.user.id = token.userId;
      }
      return session;
    },
  },
});
