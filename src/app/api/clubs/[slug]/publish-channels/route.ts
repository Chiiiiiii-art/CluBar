import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { clubs } from '@/db/schema';
import { requireClubOfficer } from '@/lib/auth/guards';
import { AppError, handleApiError } from '@/lib/errors';
import { assertRateLimit } from '@/lib/rate-limit';
import { encryptSecret, normalizeDiscordWebhookUrl } from '@/lib/services/publish-channels';

const putSchema = z.object({ discord_webhook_url: z.string().max(500) });

async function loadOfficerClub(slug: string) {
  const [club] = await db
    .select({ id: clubs.id, discordWebhookEnc: clubs.discordWebhookEnc })
    .from(clubs)
    .where(eq(clubs.slug, slug))
    .limit(1);
  if (!club) throw new AppError(404, 'CLUB_NOT_FOUND', '找不到指定社團。');
  const { user } = await requireClubOfficer(club.id);
  return { club, user };
}

export async function GET(_req: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const { club } = await loadOfficerClub(slug);
    return NextResponse.json({ discord_configured: Boolean(club.discordWebhookEnc) });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(req: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const { club, user } = await loadOfficerClub(slug);
    assertRateLimit(`publish-channels:${user.id}`, 10, 60 * 60 * 1000, '設定次數太多，請一小時後再試。');

    const raw = await req.text();
    const parsed = putSchema.parse(raw ? JSON.parse(raw) : {});
    const url = normalizeDiscordWebhookUrl(parsed.discord_webhook_url);
    if (!url) {
      throw new AppError(
        400,
        'INVALID_DISCORD_WEBHOOK',
        '這不是 Discord 頻道的 Webhook 網址。請到 Discord 頻道設定 → 整合 → Webhook，複製網址再貼上。'
      );
    }

    await db
      .update(clubs)
      .set({ discordWebhookEnc: encryptSecret(url), updatedAt: new Date() })
      .where(eq(clubs.id, club.id));
    return NextResponse.json({ discord_configured: true });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const { club } = await loadOfficerClub(slug);
    await db
      .update(clubs)
      .set({ discordWebhookEnc: null, updatedAt: new Date() })
      .where(eq(clubs.id, club.id));
    return NextResponse.json({ discord_configured: false });
  } catch (err) {
    return handleApiError(err);
  }
}
