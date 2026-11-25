import { notFound } from 'next/navigation';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { db, isDatabaseConfigured } from '@/db';
import {
  clubMemberships,
  clubs,
  forumHelpfulMarks,
  forumReplies,
  forumThreads,
  universities,
} from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/guards';
import { serializeForumReply, serializeForumThread } from '@/lib/serializers';
import { ThreadDetailClient } from '@/components/ThreadDetailClient';
import type { OfficerClubOption } from '@/components/TogetherClient';

export const dynamic = 'force-dynamic';

export default async function TogetherThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  if (!isDatabaseConfigured()) notFound();
  const { threadId } = await params;

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(threadId)) {
    notFound();
  }

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

  if (!threadRow) notFound();

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

  const markedIds = new Set<string>();
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
      for (const m of marks) markedIds.add(m.replyId);
    }
  }

  let officerClubs: OfficerClubOption[] = [];
  if (currentUser?.campusVerifiedAt) {
    officerClubs = await db
      .select({
        club_id: clubs.id,
        club_name: clubs.name,
        university_short_name: universities.shortName,
        default_title: clubMemberships.title,
      })
      .from(clubMemberships)
      .innerJoin(clubs, eq(clubMemberships.clubId, clubs.id))
      .innerJoin(universities, eq(clubs.universityId, universities.id))
      .where(
        and(
          eq(clubMemberships.userId, currentUser.id),
          isNull(clubMemberships.endedAt),
          inArray(clubMemberships.role, ['owner', 'editor']),
          eq(clubs.verificationStatus, 'verified')
        )
      );
  }

  return (
    <ThreadDetailClient
      thread={serializeForumThread({ ...threadRow.thread, club: threadRow.club })}
      initialReplies={replyRows.map((r) =>
        serializeForumReply({
          ...r.reply,
          markedHelpfulByMe: markedIds.has(r.reply.id),
          hasHelpfulMarks: repliesWithMarks.has(r.reply.id),
          club: r.club,
        })
      )}
      officerClubs={officerClubs}
      isLoggedIn={Boolean(currentUser)}
    />
  );
}
