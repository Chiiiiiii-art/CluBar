import { NextResponse } from 'next/server';
import { requireClubOfficer } from '@/lib/auth/guards';
import { handleApiError } from '@/lib/errors';
import { buildEventPromoPack, getEventRowByShortCode } from '@/lib/services/events';

export async function GET(
  req: Request,
  context: { params: Promise<{ shortCode: string }> }
) {
  try {
    const { shortCode } = await context.params;
    const { event, club, university } = await getEventRowByShortCode(shortCode);
    await requireClubOfficer(event.clubId);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || new URL(req.url).origin;
    const pack = buildEventPromoPack({
      event,
      club,
      universityShortName: university.shortName,
      baseUrl,
    });

    return NextResponse.json(pack);
  } catch (err) {
    return handleApiError(err);
  }
}
