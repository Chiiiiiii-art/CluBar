import { and, desc, eq, lt } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db, isDatabaseConfigured } from '@/db';
import { clubs, forumThreads, universities } from '@/db/schema';
import { requireClubRole } from '@/lib/auth/guards';
import { handleApiError } from '@/lib/errors';
import { serializeForumThread } from '@/lib/serializers';
import {
  clubCategorySchema,
  forumTagSchema,
  mediaItemSchema,
  safeExternalUrlSchema,
} from '@/lib/validators';

const listQuerySchema = z.object({
  category: clubCategorySchema.optional(),
  tag: forumTagSchema.optional(),
  cursor: z.string().datetime().optional(),
});

const createThreadSchema = z.object({
  acting_club_id: z.string().uuid('請選擇要代表的社團。'),
  category: clubCategorySchema,
  discussion_tag: forumTagSchema,
  title: z.string().trim().min(4, '標題至少 4 個字').max(100),
  content_md: z.string().trim().min(10, '內容至少 10 個字').max(10000),
  author_title: z.string().trim().max(30).optional().nullable(),
  media_urls: z.array(mediaItemSchema).max(4).default([]),
  external_url: safeExternalUrlSchema.optional().nullable().or(z.literal('')),
});

export async function GET(req: Request) {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ threads: [], next_cursor: null });
    }

    const url = new URL(req.url);
    const parsed = listQuerySchema.parse({
      category: url.searchParams.get('category') || undefined,
      tag: url.searchParams.get('tag') || undefined,
      cursor: url.searchParams.get('cursor') || undefined,
    });

    const conditions = [eq(forumThreads.status, 'published')];
    if (parsed.category) conditions.push(eq(forumThreads.category, parsed.category));
    if (parsed.tag) conditions.push(eq(forumThreads.discussionTag, parsed.tag));
    if (parsed.cursor) conditions.push(lt(forumThreads.lastActivityAt, new Date(parsed.cursor)));

    const limit = 20;
    const rows = await db
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
      .where(and(...conditions))
      .orderBy(desc(forumThreads.lastActivityAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore
      ? items[items.length - 1]?.thread.lastActivityAt.toISOString() ?? null
      : null;

    return NextResponse.json({
      threads: items.map((r) => serializeForumThread({ ...r.thread, club: r.club })),
      next_cursor: nextCursor,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = createThreadSchema.parse(body);

    const { user, club, membership } = await requireClubRole(parsed.acting_club_id, [
      'owner',
      'editor',
    ]);

    const [uni] = await db
      .select({ shortName: universities.shortName })
      .from(universities)
      .where(eq(universities.id, club.universityId))
      .limit(1);

    const [created] = await db
      .insert(forumThreads)
      .values({
        category: parsed.category,
        discussionTag: parsed.discussion_tag,
        clubId: club.id,
        authorUserId: user.id,
        authorTitle: parsed.author_title?.trim() || membership.title || null,
        title: parsed.title,
        contentMd: parsed.content_md,
        mediaUrls: parsed.media_urls,
        externalUrl: parsed.external_url ? parsed.external_url : null,
      })
      .returning();

    return NextResponse.json(
      {
        thread: serializeForumThread({
          ...created,
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
