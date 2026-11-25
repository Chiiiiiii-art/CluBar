import { and, asc, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import {
  clubs,
  forumHelpfulMarks,
  forumReplies,
  forumThreads,
  universities,
} from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/guards';
import { AppError, handleApiError } from '@/lib/errors';
import { serializeForumReply, serializeForumThread } from '@/lib/serializers';

const uuidSchema = z.string().uuid('無效的討論串識別碼。');

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const threadId = uuidSchema.parse(id);
    const currentUser = await getCurrentUser();

    const [threadRow] = await db
      .select({
        thread: forumThreads,
        club: {
          id: clubs.id,
          slug: clubs.slug,
          name: clubs.name,
          isDemo: clubs.isDemo,
          universityShortName: universities.shortName,
        },
      })
      .from(forumThreads)
      .innerJoin(clubs, eq(forumThreads.clubId, clubs.id))
      .innerJoin(universities, eq(clubs.universityId, universities.id))
      .where(and(eq(forumThreads.id, threadId), eq(forumThreads.status, 'published')))
      .limit(1);

    if (!threadRow) {
      throw new AppError(404, 'THREAD_NOT_FOUND', '找不到此討論串。');
    }

    const replyRows = await db
      .select({
        reply: forumReplies,
        club: {
          id: clubs.id,
          slug: clubs.slug,
          name: clubs.name,
          isDemo: clubs.isDemo,
          universityShortName: universities.shortName,
        },
      })
      .from(forumReplies)
      .innerJoin(clubs, eq(forumReplies.clubId, clubs.id))
      .innerJoin(universities, eq(clubs.universityId, universities.id))
      .where(and(eq(forumReplies.threadId, threadId), eq(forumReplies.status, 'published')))
      .orderBy(asc(forumReplies.createdAt));

    const markedReplyIds = new Set<string>();
    const repliesWithMarks = new Set<string>();
    if (replyRows.length > 0) {
      const replyIds = replyRows.map((r) => r.reply.id);
      const anyMarks = await db
        .selectDistinct({ replyId: forumHelpfulMarks.replyId })
        .from(forumHelpfulMarks)
        .where(inArray(forumHelpfulMarks.replyId, replyIds));
      for (const m of anyMarks) repliesWithMarks.add(m.replyId);

      if (currentUser) {
        const marks = await db
          .select({ replyId: forumHelpfulMarks.replyId })
          .from(forumHelpfulMarks)
          .where(
            and(
              eq(forumHelpfulMarks.userId, currentUser.id),
              inArray(forumHelpfulMarks.replyId, replyIds)
            )
          );
        for (const m of marks) markedReplyIds.add(m.replyId);
      }
    }

    return NextResponse.json({
      thread: serializeForumThread({ ...threadRow.thread, club: threadRow.club }),
      replies: replyRows.map((r) =>
        serializeForumReply({
          ...r.reply,
          markedHelpfulByMe: markedReplyIds.has(r.reply.id),
          hasHelpfulMarks: repliesWithMarks.has(r.reply.id),
          club: r.club,
        })
      ),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
