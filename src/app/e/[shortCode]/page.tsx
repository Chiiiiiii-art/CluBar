import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/guards';
import { getPublicEventDetail } from '@/lib/services/events';
import { EventPageClient } from '@/components/EventPageClient';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ shortCode: string }>;
}): Promise<Metadata> {
  const { shortCode } = await params;
  const view = await getPublicEventDetail(shortCode, null);
  if (!view) {
    return { title: '找不到活動｜CluBar' };
  }
  const ogUrl = `/api/og/events/${view.detail.short_code}`;
  return {
    title: `${view.detail.title}｜${view.detail.club.name}｜CluBar`,
    description:
      view.detail.summary ||
      `${view.detail.club.university_short_name} ${view.detail.club.name} 主辦活動`,
    openGraph: {
      title: `${view.detail.title}｜${view.detail.club.name}`,
      description: view.detail.summary || view.detail.location_text,
      images: [{ url: ogUrl, width: 1200, height: 630 }],
    },
  };
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ shortCode: string }>;
}) {
  const { shortCode } = await params;
  const viewer = await getCurrentUser().catch(() => null);
  const view = await getPublicEventDetail(shortCode, viewer);

  if (!view) {
    notFound();
  }

  return (
    <EventPageClient
      initialData={view}
      viewer={
        viewer
          ? {
              isLoggedIn: true,
              isCampusVerified: Boolean(viewer.campusVerifiedAt),
              universityId: viewer.universityId,
            }
          : {
              isLoggedIn: false,
              isCampusVerified: false,
              universityId: null,
            }
      }
    />
  );
}
