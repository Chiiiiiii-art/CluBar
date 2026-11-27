import { NextResponse } from 'next/server';
import { and, desc, eq, isNull, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { clubMemberships, clubQuestions, clubs } from '@/db/schema';
import { getCurrentUser, requireVerifiedStudent } from '@/lib/auth/guards';
import { AppError, handleApiError } from '@/lib/errors';
import { assertRateLimit } from '@/lib/rate-limit';
import { serializePublicQuestion } from '@/lib/serializers';

const askSchema = z.object({
  question_text: z.string().trim().min(5, '問題內容至少 5 個字').max(500, '問題最多 500 字'),
  is_anonymous: z.boolean().default(true),
  display_alias: z.string().trim().max(30).optional().nullable(),
});

export async function GET(
  req: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const [club] = await db.select().from(clubs).where(eq(clubs.slug, slug)).limit(1);
    if (!club) throw new AppError(404, 'CLUB_NOT_FOUND', '找不到指定社團。');

    const url = new URL(req.url);
    const scopeInbox = url.searchParams.get('scope') === 'inbox';

    const published = await db
      .select()
      .from(clubQuestions)
      .where(
        and(eq(clubQuestions.clubId, club.id), eq(clubQuestions.status, 'published'))
      )
      .orderBy(desc(clubQuestions.isPinnedFaq), desc(clubQuestions.answeredAt))
      .limit(50);

    let inboxQuestions: {
      id: string;
      display_asker: string;
      question_text: string;
      answer_text: string | null;
      status: string;
      is_pinned_faq: boolean;
      created_at: string;
    }[] = [];

    if (scopeInbox) {
      const viewer = await getCurrentUser().catch(() => null);
      if (viewer) {
        const [officer] = await db
          .select({ id: clubMemberships.id })
          .from(clubMemberships)
          .where(
            and(
              eq(clubMemberships.clubId, club.id),
              eq(clubMemberships.userId, viewer.id),
              isNull(clubMemberships.endedAt),
              inArray(clubMemberships.role, ['owner', 'editor'])
            )
          )
          .limit(1);

        if (officer) {
          const allRows = await db
            .select()
            .from(clubQuestions)
            .where(eq(clubQuestions.clubId, club.id))
            .orderBy(desc(clubQuestions.createdAt))
            .limit(80);

          inboxQuestions = allRows.map((q) => ({
            id: q.id,
            display_asker: q.isAnonymous
              ? '匿名同學'
              : q.displayAlias?.trim() || '校園發問者',
            question_text: q.questionText,
            answer_text: q.answerText,
            status: q.status,
            is_pinned_faq: q.isPinnedFaq,
            created_at: q.createdAt.toISOString(),
          }));
        }
      }
    }

    return NextResponse.json({
      questions: published.map((q) => serializePublicQuestion(q)),
      ...(scopeInbox ? { inbox: inboxQuestions } : {}),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(
  req: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const user = await requireVerifiedStudent();
    assertRateLimit(`club-question:${user.id}`, 10, 60 * 60 * 1000, '提問過於頻繁，請稍後再試。');

    const { slug } = await context.params;
    const [club] = await db.select().from(clubs).where(eq(clubs.slug, slug)).limit(1);
    if (!club || club.verificationStatus !== 'verified') {
      throw new AppError(404, 'CLUB_NOT_FOUND', '找不到指定認證社團。');
    }

    const body = await req.json();
    const parsed = askSchema.parse(body);

    const [created] = await db
      .insert(clubQuestions)
      .values({
        clubId: club.id,
        askerUserId: user.id,
        isAnonymous: parsed.is_anonymous,
        displayAlias: parsed.is_anonymous ? null : parsed.display_alias?.trim() || user.displayName,
        questionText: parsed.question_text,
        status: 'pending_reply',
      })
      .returning();

    return NextResponse.json(
      {
        question: {
          id: created.id,
          status: created.status,
          created_at: created.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
