import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireClubOfficer } from '@/lib/auth/guards';
import { AppError, handleApiError } from '@/lib/errors';
import { assertRateLimit } from '@/lib/rate-limit';
import { buildEventPromoPack, getEventRowByShortCode } from '@/lib/services/events';
import {
  buildDiscordPayload,
  decryptSecret,
  sendDiscordWebhook,
} from '@/lib/services/publish-channels';

const bodySchema = z.object({ content: z.string().trim().min(1).max(2000).optional() });

export async function POST(req: Request, context: { params: Promise<{ shortCode: string }> }) {
  try {
    const { shortCode } = await context.params;
    const { event, club, university } = await getEventRowByShortCode(shortCode);
    await requireClubOfficer(event.clubId);
    // Discord allows ~5 posts / 2s per webhook; keep officers well under it.
    assertRateLimit(`publish-discord:${club.id}`, 5, 60 * 1000, '剛剛發太多次了，請等一分鐘再發。');

    if (event.status === 'cancelled') {
      throw new AppError(409, 'EVENT_CANCELLED', '這場活動已取消，不能再發到 Discord。');
    }
    if (!club.discordWebhookEnc) {
      throw new AppError(409, 'DISCORD_NOT_CONFIGURED', '還沒設定 Discord 頻道，請先到「發布管道」貼上 Webhook 網址。');
    }

    const raw = await req.text();
    const parsed = bodySchema.parse(raw ? JSON.parse(raw) : {});

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || new URL(req.url).origin;
    const pack = buildEventPromoPack({ event, club, universityShortName: university.shortName, baseUrl });

    const payload = buildDiscordPayload(parsed.content ?? pack.discord_markdown, {
      title: `${club.name}｜${event.title}`,
      url: pack.event_url,
      description: [
        event.summary || null,
        `時間：${pack.time_text}`,
        pack.location_text ? `地點：${pack.location_text}` : null,
      ]
        .filter(Boolean)
        .join('\n'),
      imageUrl: pack.og_landscape_image_url,
    });

    await sendDiscordWebhook(decryptSecret(club.discordWebhookEnc), payload);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
