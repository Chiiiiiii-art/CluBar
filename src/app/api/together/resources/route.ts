import { NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { interestDomains, practicalResources, universities } from '@/db/schema';
import { requireVerifiedStudent } from '@/lib/auth/guards';
import { AppError, handleApiError } from '@/lib/errors';

const createResourceSchema = z.object({
  domain_id: z.string().uuid(),
  title: z.string().trim().min(3, '標題至少 3 個字').max(120),
  content_md: z.string().trim().min(15, '實務經驗內容至少 15 字').max(4000),
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const domainId = url.searchParams.get('domain_id');

    const conditions = [eq(practicalResources.status, 'published')];
    if (domainId && z.string().uuid().safeParse(domainId).success) {
      conditions.push(eq(practicalResources.domainId, domainId));
    }

    const rows = await db
      .select({
        resource: practicalResources,
        domainName: interestDomains.nameZh,
        uniShort: universities.shortName,
      })
      .from(practicalResources)
      .innerJoin(interestDomains, eq(practicalResources.domainId, interestDomains.id))
      .leftJoin(universities, eq(practicalResources.sourceUniversityId, universities.id))
      .where(and(...conditions))
      .orderBy(desc(practicalResources.createdAt))
      .limit(30);

    return NextResponse.json({
      resources: rows.map((r) => ({
        id: r.resource.id,
        domain_id: r.resource.domainId,
        domain_name: r.domainName,
        source_university_short_name: r.uniShort ?? '跨校去識別',
        title: r.resource.title,
        content_md: r.resource.contentMd,
        created_at: r.resource.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireVerifiedStudent();
    const body = await req.json();
    const parsed = createResourceSchema.parse(body);

    const [domain] = await db
      .select({ id: interestDomains.id })
      .from(interestDomains)
      .where(eq(interestDomains.id, parsed.domain_id))
      .limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', '找不到指定領域。');

    const [created] = await db
      .insert(practicalResources)
      .values({
        domainId: domain.id,
        sourceUniversityId: user.universityId,
        title: parsed.title,
        contentMd: parsed.content_md,
      })
      .returning();

    return NextResponse.json(
      {
        resource: {
          id: created.id,
          title: created.title,
          created_at: created.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
