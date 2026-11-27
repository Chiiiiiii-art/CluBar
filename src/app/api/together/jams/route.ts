import { NextResponse } from 'next/server';
import { and, asc, eq, gt } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { clubs, interestDomains, togetherJams, universities } from '@/db/schema';
import { requireClubOfficer } from '@/lib/auth/guards';
import { AppError, handleApiError } from '@/lib/errors';

const createJamSchema = z.object({
  host_club_id: z.string().uuid(),
  domain_id: z.string().uuid(),
  title: z.string().trim().min(3, '企劃主題至少 3 字').max(120),
  summary: z.string().trim().min(10, '企劃說明至少 10 字').max(800),
  target_schools_count: z.number().int().min(2).max(20).default(2),
  needed_roles: z.array(z.string().trim().min(1).max(30)).min(1).max(6),
  collab_format: z.string().trim().min(2).max(40),
  deadline_at: z.string().datetime(),
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const domainId = url.searchParams.get('domain_id');

    const conditions = [
      eq(togetherJams.status, 'open'),
      gt(togetherJams.deadlineAt, new Date()),
    ];
    if (domainId && z.string().uuid().safeParse(domainId).success) {
      conditions.push(eq(togetherJams.domainId, domainId));
    }

    const rows = await db
      .select({
        jam: togetherJams,
        domainName: interestDomains.nameZh,
        club: {
          id: clubs.id,
          slug: clubs.slug,
          name: clubs.name,
          uniShort: universities.shortName,
        },
      })
      .from(togetherJams)
      .innerJoin(interestDomains, eq(togetherJams.domainId, interestDomains.id))
      .innerJoin(clubs, eq(togetherJams.hostClubId, clubs.id))
      .innerJoin(universities, eq(clubs.universityId, universities.id))
      .where(and(...conditions))
      .orderBy(asc(togetherJams.deadlineAt))
      .limit(30);

    return NextResponse.json({
      jams: rows.map((r) => ({
        id: r.jam.id,
        title: r.jam.title,
        summary: r.jam.summary,
        domain_id: r.jam.domainId,
        domain_name: r.domainName,
        target_schools_count: r.jam.targetSchoolsCount,
        needed_roles: r.jam.neededRoles,
        collab_format: r.jam.collabFormat,
        deadline_at: r.jam.deadlineAt.toISOString(),
        host_club: {
          id: r.club.id,
          slug: r.club.slug,
          name: r.club.name,
          university_short_name: r.club.uniShort,
        },
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = createJamSchema.parse(body);

    const { user, club } = await requireClubOfficer(parsed.host_club_id);

    const [domain] = await db
      .select({ id: interestDomains.id })
      .from(interestDomains)
      .where(eq(interestDomains.id, parsed.domain_id))
      .limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', '找不到指定興趣領域。');

    const deadlineAt = new Date(parsed.deadline_at);
    if (deadlineAt <= new Date()) {
      throw new AppError(400, 'INVALID_DEADLINE', '招募截止日期必須在未來。');
    }

    const [created] = await db
      .insert(togetherJams)
      .values({
        hostClubId: club.id,
        domainId: domain.id,
        createdBy: user.id,
        title: parsed.title,
        summary: parsed.summary,
        targetSchoolsCount: parsed.target_schools_count,
        neededRoles: parsed.needed_roles,
        collabFormat: parsed.collab_format,
        deadlineAt,
      })
      .returning();

    return NextResponse.json(
      {
        jam: {
          id: created.id,
          title: created.title,
          deadline_at: created.deadlineAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
