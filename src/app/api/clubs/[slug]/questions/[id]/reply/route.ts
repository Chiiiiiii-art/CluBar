import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { clubQuestions, clubs, notifications, posts } from '@/db/schema';
import { requireClubOfficer } from '@/lib/auth/guards';
import { AppError, handleApiError } from '@/lib/errors';

const replySchema = z.object({
  answer_text: z.string().trim().min(2, '回覆內容至少 2 個字').max(2000),
  publish_publicly: z.boolean().default(true),
  pin_as_faq: z.boolean().default(false),
  also_publish_qa_highlight: z.boolean().default(false),
});

export async function PATCH(
  req: Request,
  context: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await context.params;
    const [club] = await db.select().from(clubs).where(eq(clubs.slug, slug)).limit(1);
    if (!club) throw new AppError(404, 'CLUB_NOT_FOUND', '找不到指定社團。');

    const { user } = await requireClubOfficer(club.id);
    const body = await req.json();
    const parsed = replySchema.parse(body);

    const updated = await db.transaction(async (tx) => {
      const [question] = await tx
        .select()
        .from(clubQuestions)
        .where(and(eq(clubQuestions.id, id), eq(clubQuestions.clubId, club.id)))
        .limit(1);

      if (!question) {
        throw new AppError(404, 'QUESTION_NOT_FOUND', '找不到指定提問。');
      }

      const nextStatus = parsed.publish_publicly ? 'published' : 'answered_private';
      const now = new Date();

      const [nextQ] = await tx
        .update(clubQuestions)
        .set({
          answerText: parsed.answer_text,
          answeredBy: user.id,
          answeredAt: now,
          status: nextStatus,
          isPinnedFaq: parsed.publish_publicly ? parsed.pin_as_faq : false,
          updatedAt: now,
        })
        .where(eq(clubQuestions.id, question.id))
        .returning();

      if (question.askerUserId) {
        await tx.insert(notifications).values({
          userId: question.askerUserId,
          type: 'question_replied',
          title: `社團回覆了你的提問｜${club.name}`,
          body: `${question.questionText.slice(0, 40)}：${parsed.answer_text.slice(0, 80)}`,
          linkUrl: `/clubs/${club.slug}`,
        });
      }

      if (parsed.publish_publicly && parsed.also_publish_qa_highlight) {
        const [existingPost] = await tx
          .select({ id: posts.id })
          .from(posts)
          .where(eq(posts.sourceQuestionId, question.id))
          .limit(1);

        if (!existingPost) {
          await tx.insert(posts).values({
            clubId: club.id,
            authorUserId: user.id,
            postKind: 'qa_highlight',
            headline: `新生 Q&A｜${question.questionText.slice(0, 80)}`,
            contentMd: `**Q：${question.questionText}**\n\n**A（${club.name} 幹部回覆）：** ${parsed.answer_text}`,
            mediaItems: [
              {
                kind: 'image',
                url: club.coverUrl || '/images/demo/moment-4x5.svg',
                width: 800,
                height: 1000,
                alt: `${club.name} Q&A 精華`,
              },
            ],
            sourceQuestionId: question.id,
            domainIds: club.domainIds,
            originalityConfirmed: true,
            includeInEvaluation: false,
            status: 'published',
            publishedAt: now,
          });
        }
      }

      return nextQ;
    });

    return NextResponse.json({
      question: {
        id: updated.id,
        status: updated.status,
        is_pinned_faq: updated.isPinnedFaq,
        answered_at: updated.answeredAt?.toISOString() ?? null,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
