import { and, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { clubs, forumReplies, forumThreads, universities } from '@/db/schema';
import { requireClubRole } from '@/lib/auth/guards';
import { AppError, handleApiError } from '@/lib/errors';
import { serializeForumReply } from '@/lib/serializers';

const uuidSchema = z.string().uuid('無效的討論串識別碼。');

const replySchema = z.object({
  acting_club_id: z.string().uuid('請選擇要代表的社團。'),
  content_md: z.string().trim().min(4, '回覆內容至少 4 個字').max(6000),
  author_title: z.string().trim().max(30).optional().nullable(),
});

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const threadId = uuidSchema.parse(id);

    const body = await req.json();
    const parsed = replySchema.parse(body);

    const { user, club, membership } = await requireClubRole(parsed.acting_club_id, [
      'owner',
      'editor',
    ]);

    const [uni] = await db
      .select({ shortName: universities.shortName })
      .from(universities)
      .where(eq(universities.id, club.universityId))
      .limit(1);

    const reply = await db.transaction(async (tx) => {
      const [thread] = await tx
        .select({ id: forumThreads.id })
        .from(forumThreads)
        .where(and(eq(forumThreads.id, threadId), eq(forumThreads.status, 'published')))
        .limit(1);
      if (!thread) {
        throw new AppError(404, 'THREAD_NOT_FOUND', '找不到此討論串。');
      }

      const [inserted] = await tx
        .insert(forumReplies)
        .values({
          threadId,
          clubId: club.id,
          authorUserId: user.id,
          authorTitle: parsed.author_title?.trim() || membership.title || null,
          contentMd: parsed.content_md,
        })
        .returning();

      const now = new Date();
      await tx
        .update(forumThreads)
        .set({
          replyCount: sql`${forumThreads.replyCount} + 1`,
          lastActivityAt: now,
          updatedAt: now,
        })
        .where(eq(forumThreads.id, threadId));

      return inserted;
    });

    return NextResponse.json(
      {
        reply: serializeForumReply({
          ...reply,
          markedHelpfulByMe: false,
          hasHelpfulMarks: false,
          club: {
            id: club.id,
            slug: club.slug,
            name: club.name,
            isDemo: club.isDemo,
            universityShortName: uni?.shortName ?? '',
          },
        }),
      },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
