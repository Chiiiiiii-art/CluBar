import { NextResponse } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { clubEvents, clubs, eventAlbumPhotos, posts } from '@/db/schema';
import { requireClubOfficer } from '@/lib/auth/guards';
import { AppError, handleApiError } from '@/lib/errors';

const batchSelectSchema = z.object({
  events: z
    .array(z.object({ id: z.string().uuid(), include: z.boolean() }))
    .max(100)
    .default([]),
  posts: z
    .array(z.object({ id: z.string().uuid(), include: z.boolean() }))
    .max(100)
    .default([]),
  album_photos: z
    .array(z.object({ id: z.string().uuid(), include: z.boolean() }))
    .max(100)
    .default([]),
});

export async function POST(
  req: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const [club] = await db.select().from(clubs).where(eq(clubs.slug, slug)).limit(1);
    if (!club) throw new AppError(404, 'CLUB_NOT_FOUND', '找不到指定社團。');

    await requireClubOfficer(club.id);
    const body = await req.json();
    const parsed = batchSelectSchema.parse(body);

    const updatedCounts = await db.transaction(async (tx) => {
      let eventsUpdated = 0;
      let postsUpdated = 0;
      let photosUpdated = 0;

      for (const item of parsed.events) {
        const res = await tx
          .update(clubEvents)
          .set({ includeInEvaluation: item.include, updatedAt: new Date() })
          .where(and(eq(clubEvents.id, item.id), eq(clubEvents.clubId, club.id)))
          .returning({ id: clubEvents.id });
        eventsUpdated += res.length;
      }

      for (const item of parsed.posts) {
        const res = await tx
          .update(posts)
          .set({ includeInEvaluation: item.include, updatedAt: new Date() })
          .where(and(eq(posts.id, item.id), eq(posts.clubId, club.id)))
          .returning({ id: posts.id });
        postsUpdated += res.length;
      }

      if (parsed.album_photos.length > 0) {
        const ownedEvents = await tx
          .select({ id: clubEvents.id })
          .from(clubEvents)
          .where(eq(clubEvents.clubId, club.id));
        const ownedEventIds = ownedEvents.map((e) => e.id);
        if (ownedEventIds.length > 0) {
          for (const item of parsed.album_photos) {
            const res = await tx
              .update(eventAlbumPhotos)
              .set({ includeInEvaluation: item.include })
              .where(
                and(
                  eq(eventAlbumPhotos.id, item.id),
                  inArray(eventAlbumPhotos.eventId, ownedEventIds)
                )
              )
              .returning({ id: eventAlbumPhotos.id });
            photosUpdated += res.length;
          }
        }
      }

      return { eventsUpdated, postsUpdated, photosUpdated };
    });

    return NextResponse.json({ updated: updatedCounts });
  } catch (err) {
    return handleApiError(err);
  }
}
