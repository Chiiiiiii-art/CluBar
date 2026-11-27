import { NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { clubs, interestDomains, togetherItems, universities } from '@/db/schema';
import { requireClubMember } from '@/lib/auth/guards';
import { AppError, handleApiError } from '@/lib/errors';
import { serializePublicTogetherItem } from '@/lib/serializers';
import { embedUrlSchema, mediaItemSchema } from '@/lib/validators';

const createTogetherSchema = z.object({
  club_id: z.string().uuid(),
  domain_id: z.string().uuid(),
  item_type: z.enum(['showcase', 'rebound', 'field_log', 'match_invite', 'reading_notes']),
  parent_item_id: z.string().uuid().optional().nullable(),
  title: z.string().trim().min(2, '標題至少 2 個字').max(120),
  content_md: z.string().trim().min(10, '內容至少 10 個字').max(8000),
  media_items: z.array(mediaItemSchema).max(4).default([]),
  embed_url: embedUrlSchema.optional().nullable(),
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const domainId = url.searchParams.get('domain_id');
    const itemType = url.searchParams.get('item_type');

    const conditions = [eq(togetherItems.status, 'published')];
    if (domainId && z.string().uuid().safeParse(domainId).success) {
      conditions.push(eq(togetherItems.domainId, domainId));
    }
    if (
      itemType &&
      ['showcase', 'rebound', 'field_log', 'match_invite', 'reading_notes'].includes(itemType)
    ) {
      conditions.push(
        eq(
          togetherItems.itemType,
          itemType as 'showcase' | 'rebound' | 'field_log' | 'match_invite' | 'reading_notes'
        )
      );
    }

    const rows = await db
      .select({
        item: togetherItems,
        domainName: interestDomains.nameZh,
        club: {
          id: clubs.id,
          slug: clubs.slug,
          name: clubs.name,
          isDemo: clubs.isDemo,
          universityShortName: universities.shortName,
        },
      })
      .from(togetherItems)
      .innerJoin(interestDomains, eq(togetherItems.domainId, interestDomains.id))
      .innerJoin(clubs, eq(togetherItems.clubId, clubs.id))
      .innerJoin(universities, eq(clubs.universityId, universities.id))
      .where(and(...conditions))
      .orderBy(desc(togetherItems.lastActivityAt))
      .limit(30);

    return NextResponse.json({
      items: rows.map((r) =>
        serializePublicTogetherItem({
          ...r.item,
          domainName: r.domainName,
          club: r.club,
        })
      ),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = createTogetherSchema.parse(body);

    const { user, club } = await requireClubMember(parsed.club_id);

    const [domain] = await db
      .select({ id: interestDomains.id, nameZh: interestDomains.nameZh })
      .from(interestDomains)
      .where(eq(interestDomains.id, parsed.domain_id))
      .limit(1);
    if (!domain) {
      throw new AppError(404, 'DOMAIN_NOT_FOUND', '找不到指定興趣領域。');
    }

    if (parsed.item_type === 'rebound') {
      if (!parsed.parent_item_id) {
        throw new AppError(400, 'PARENT_ITEM_REQUIRED', '接力回應必須指定要回應的原作。');
      }
      const [parent] = await db
        .select({ id: togetherItems.id })
        .from(togetherItems)
        .where(
          and(
            eq(togetherItems.id, parsed.parent_item_id),
            eq(togetherItems.status, 'published')
          )
        )
        .limit(1);
      if (!parent) {
        throw new AppError(404, 'PARENT_ITEM_NOT_FOUND', '找不到原接力作品。');
      }
    }

    const [uni] = await db
      .select({ shortName: universities.shortName })
      .from(universities)
      .where(eq(universities.id, club.universityId))
      .limit(1);

    const [created] = await db
      .insert(togetherItems)
      .values({
        domainId: domain.id,
        itemType: parsed.item_type,
        clubId: club.id,
        authorUserId: user.id,
        parentItemId: parsed.parent_item_id ?? null,
        title: parsed.title,
        contentMd: parsed.content_md,
        mediaItems: parsed.media_items,
        embedUrl: parsed.embed_url ?? null,
      })
      .returning();

    return NextResponse.json(
      {
        item: serializePublicTogetherItem({
          ...created,
          domainName: domain.nameZh,
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
