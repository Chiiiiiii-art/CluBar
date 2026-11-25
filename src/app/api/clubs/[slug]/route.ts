import { and, desc, eq, gt, isNull, or } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { clubOpportunities, clubs, posts, universities } from '@/db/schema';
import { requireClubOwner } from '@/lib/auth/guards';
import { AppError, handleApiError } from '@/lib/errors';
import {
  serializePublicClub,
  serializePublicOpportunity,
  serializePublicPost,
} from '@/lib/serializers';
import {
  clubCategorySchema,
  externalLinkSchema,
  mediaUrlSchema,
  postTypeSchema,
} from '@/lib/validators';

const patchClubSchema = z.object({
  tagline: z.string().trim().max(120).optional(),
  description: z.string().trim().max(4000).optional(),
  category: clubCategorySchema.optional(),
  avatar_url: mediaUrlSchema.nullable().optional(),
  cover_url: mediaUrlSchema.nullable().optional(),
  external_links: z.array(externalLinkSchema).max(8).optional(),
});

export async function GET(
  req: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const url = new URL(req.url);
    const yearParam = url.searchParams.get('year');
    const postTypeParam = url.searchParams.get('post_type');

    const [clubRow] = await db
      .select({
        club: clubs,
        university: {
          id: universities.id,
          code: universities.code,
          name: universities.name,
          shortName: universities.shortName,
        },
      })
      .from(clubs)
      .innerJoin(universities, eq(clubs.universityId, universities.id))
      .where(eq(clubs.slug, slug))
      .limit(1);

    if (!clubRow || clubRow.club.verificationStatus === 'pending_review') {
      throw new AppError(404, 'CLUB_NOT_FOUND', '找不到指定社團。');
    }

    const now = new Date();
    const opportunities = await db
      .select()
      .from(clubOpportunities)
      .where(
        and(
          eq(clubOpportunities.clubId, clubRow.club.id),
          eq(clubOpportunities.isActive, true),
          or(isNull(clubOpportunities.deadlineAt), gt(clubOpportunities.deadlineAt, now))
        )
      )
      .orderBy(desc(clubOpportunities.createdAt));

    const postConditions = [
      eq(posts.clubId, clubRow.club.id),
      eq(posts.status, 'published'),
    ];
    if (yearParam) {
      const year = z.coerce.number().int().min(100).max(150).parse(yearParam);
      postConditions.push(eq(posts.academicYear, year));
    }
    if (postTypeParam) {
      postConditions.push(eq(posts.postType, postTypeSchema.parse(postTypeParam)));
    }

    const postRows = await db
      .select()
      .from(posts)
      .where(and(...postConditions))
      .orderBy(desc(posts.publishedAt), desc(posts.createdAt));

    return NextResponse.json({
      club: serializePublicClub({
        ...clubRow.club,
        university: clubRow.university,
      }),
      opportunities: opportunities.map(serializePublicOpportunity),
      posts: postRows.map((p) =>
        serializePublicPost({
          ...p,
          club: {
            id: clubRow.club.id,
            slug: clubRow.club.slug,
            name: clubRow.club.name,
            category: clubRow.club.category,
            avatarUrl: clubRow.club.avatarUrl,
            verificationStatus: clubRow.club.verificationStatus,
            isDemo: clubRow.club.isDemo,
            universityShortName: clubRow.university.shortName,
          },
        })
      ),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const [clubRow] = await db
      .select({
        club: clubs,
        university: {
          id: universities.id,
          code: universities.code,
          name: universities.name,
          shortName: universities.shortName,
        },
      })
      .from(clubs)
      .innerJoin(universities, eq(clubs.universityId, universities.id))
      .where(eq(clubs.slug, slug))
      .limit(1);

    if (!clubRow) {
      throw new AppError(404, 'CLUB_NOT_FOUND', '找不到指定社團。');
    }

    await requireClubOwner(clubRow.club.id);

    const body = await req.json();
    const parsed = patchClubSchema.parse(body);

    const [updated] = await db
      .update(clubs)
      .set({
        ...(parsed.tagline !== undefined ? { tagline: parsed.tagline } : {}),
        ...(parsed.description !== undefined ? { description: parsed.description } : {}),
        ...(parsed.category !== undefined ? { category: parsed.category } : {}),
        ...(parsed.avatar_url !== undefined ? { avatarUrl: parsed.avatar_url } : {}),
        ...(parsed.cover_url !== undefined ? { coverUrl: parsed.cover_url } : {}),
        ...(parsed.external_links !== undefined ? { externalLinks: parsed.external_links } : {}),
        updatedAt: new Date(),
      })
      .where(eq(clubs.id, clubRow.club.id))
      .returning();

    return NextResponse.json({
      club: serializePublicClub({
        ...updated,
        university: clubRow.university,
      }),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
