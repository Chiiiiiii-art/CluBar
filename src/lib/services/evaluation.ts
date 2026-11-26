import { and, desc, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  clubArchiveFiles,
  clubEvents,
  clubHandoverNotes,
  clubMemberships,
  clubs,
  coClubLinks,
  eventAlbumPhotos,
  eventRsvps,
  posts,
  universities,
  users,
} from '@/db/schema';
import { LEARNING_HOURS_LABELS, POST_KIND_LABELS } from '@/lib/constants';
import { AppError } from '@/lib/errors';

export function getDefaultEvaluationWindow(now = new Date()): {
  fromDate: string;
  toDate: string;
} {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(now);

  const year = Number(parts.find((p) => p.type === 'year')?.value ?? now.getFullYear());
  const month = Number(parts.find((p) => p.type === 'month')?.value ?? now.getMonth() + 1);

  const startYear = month <= 5 ? year - 1 : year;
  const endYear = startYear + 1;
  return {
    fromDate: `${startYear}-05-01`,
    toDate: `${endYear}-05-31`,
  };
}

export interface EvaluationPack {
  club: {
    id: string;
    slug: string;
    name: string;
    category: string;
    university_name: string;
    university_short_name: string;
  };
  period: {
    from_date: string;
    to_date: string;
  };
  generated_at: string;
  active_officers: {
    display_name: string;
    role: string;
    title: string | null;
  }[];
  events: {
    id: string;
    short_code: string;
    title: string;
    starts_at: string | null;
    location_text: string;
    learning_hours_category: string;
    learning_hours_count: number;
    going_count: number;
    attended_count: number;
    is_co_hosted: boolean;
    partner_or_host_club: string | null;
  }[];
  posts: {
    id: string;
    post_kind: string;
    headline: string;
    published_at: string | null;
  }[];
  album_photos: {
    id: string;
    event_id: string;
    caption: string | null;
    preview_url: string;
    created_at: string;
  }[];
  archive_files: {
    id: string;
    category: string;
    title: string;
    occurred_on: string;
    mime_type: string;
    size_bytes: number;
  }[];
  latest_pitfall_note: {
    venue_tips: string;
    hours_and_deadlines: string;
    contacts_and_vendors: string;
  } | null;
}

export async function buildClubEvaluationPack(params: {
  clubId: string;
  fromDate?: string;
  toDate?: string;
}): Promise<EvaluationPack> {
  const defaults = getDefaultEvaluationWindow();
  const fromDate = params.fromDate || defaults.fromDate;
  const toDate = params.toDate || defaults.toDate;
  const fromTs = new Date(`${fromDate}T00:00:00+08:00`);
  const toTs = new Date(`${toDate}T23:59:59+08:00`);

  const [clubRow] = await db
    .select({
      club: clubs,
      university: universities,
    })
    .from(clubs)
    .innerJoin(universities, eq(clubs.universityId, universities.id))
    .where(eq(clubs.id, params.clubId))
    .limit(1);

  if (!clubRow) {
    throw new AppError(404, 'CLUB_NOT_FOUND', '找不到指定社團。');
  }

  const officers = await db
    .select({
      displayName: users.displayName,
      role: clubMemberships.role,
      title: clubMemberships.title,
    })
    .from(clubMemberships)
    .innerJoin(users, eq(clubMemberships.userId, users.id))
    .where(
      and(
        eq(clubMemberships.clubId, params.clubId),
        isNull(clubMemberships.endedAt),
        inArray(clubMemberships.role, ['owner', 'editor'])
      )
    );

  // Owned events flagged for evaluation
  const ownedEvents = await db
    .select()
    .from(clubEvents)
    .where(
      and(
        eq(clubEvents.clubId, params.clubId),
        eq(clubEvents.includeInEvaluation, true),
        or(
          and(gte(clubEvents.startsAt, fromTs), lte(clubEvents.startsAt, toTs)),
          and(
            isNull(clubEvents.startsAt),
            gte(clubEvents.createdAt, fromTs),
            lte(clubEvents.createdAt, toTs)
          )
        )
      )
    )
    .orderBy(desc(clubEvents.startsAt), desc(clubEvents.createdAt));

  // Co-hosted events where this club accepted partnership and enabled partnerIncludeEval
  const coHostedPartnerLinks = await db
    .select({
      link: coClubLinks,
      event: clubEvents,
      hostClubName: clubs.name,
    })
    .from(coClubLinks)
    .innerJoin(clubEvents, eq(coClubLinks.targetId, clubEvents.id))
    .innerJoin(clubs, eq(coClubLinks.hostClubId, clubs.id))
    .where(
      and(
        eq(coClubLinks.targetType, 'event'),
        eq(coClubLinks.partnerClubId, params.clubId),
        eq(coClubLinks.status, 'accepted'),
        eq(coClubLinks.partnerIncludeEval, true),
        or(
          and(gte(clubEvents.startsAt, fromTs), lte(clubEvents.startsAt, toTs)),
          and(
            isNull(clubEvents.startsAt),
            gte(clubEvents.createdAt, fromTs),
            lte(clubEvents.createdAt, toTs)
          )
        )
      )
    );

  // Also check accepted co-hosts on owned events for co-host display
  const ownedEventIds = ownedEvents.map((e) => e.id);
  const ownedCoHosts =
    ownedEventIds.length > 0
      ? await db
          .select({
            targetId: coClubLinks.targetId,
            partnerName: clubs.name,
          })
          .from(coClubLinks)
          .innerJoin(clubs, eq(coClubLinks.partnerClubId, clubs.id))
          .where(
            and(
              eq(coClubLinks.targetType, 'event'),
              inArray(coClubLinks.targetId, ownedEventIds),
              eq(coClubLinks.status, 'accepted')
            )
          )
      : [];

  const allEventIds = Array.from(
    new Set([...ownedEventIds, ...coHostedPartnerLinks.map((c) => c.event.id)])
  );

  const rsvpCountsMap = new Map<string, { going: number; attended: number }>();
  if (allEventIds.length > 0) {
    const rsvpAgg = await db
      .select({
        eventId: eventRsvps.eventId,
        goingCount: sql<number>`count(*) filter (where ${eventRsvps.status} = 'going')::int`,
        attendedCount: sql<number>`count(*) filter (where ${eventRsvps.attended} = true)::int`,
      })
      .from(eventRsvps)
      .where(inArray(eventRsvps.eventId, allEventIds))
      .groupBy(eventRsvps.eventId);

    for (const row of rsvpAgg) {
      rsvpCountsMap.set(row.eventId, {
        going: row.goingCount,
        attended: row.attendedCount,
      });
    }
  }

  const evalEvents: EvaluationPack['events'] = [
    ...ownedEvents.map((e) => {
      const counts = rsvpCountsMap.get(e.id) ?? { going: 0, attended: 0 };
      const partner = ownedCoHosts.find((c) => c.targetId === e.id)?.partnerName ?? null;
      return {
        id: e.id,
        short_code: e.shortCode,
        title: e.title,
        starts_at: e.startsAt?.toISOString() ?? null,
        location_text: e.locationText,
        learning_hours_category: e.learningHoursCategory,
        learning_hours_count: Number(e.learningHoursCount || 0),
        going_count: counts.going,
        attended_count: counts.attended,
        is_co_hosted: Boolean(partner),
        partner_or_host_club: partner,
      };
    }),
    ...coHostedPartnerLinks.map(({ event: e, hostClubName }) => {
      const counts = rsvpCountsMap.get(e.id) ?? { going: 0, attended: 0 };
      return {
        id: e.id,
        short_code: e.shortCode,
        title: e.title,
        starts_at: e.startsAt?.toISOString() ?? null,
        location_text: e.locationText,
        learning_hours_category: e.learningHoursCategory,
        learning_hours_count: Number(e.learningHoursCount || 0),
        going_count: counts.going,
        attended_count: counts.attended,
        is_co_hosted: true,
        partner_or_host_club: hostClubName,
      };
    }),
  ];

  // Posts flagged for evaluation
  const evalPosts = await db
    .select()
    .from(posts)
    .where(
      and(
        eq(posts.clubId, params.clubId),
        eq(posts.includeInEvaluation, true),
        eq(posts.status, 'published'),
        gte(posts.publishedAt, fromTs),
        lte(posts.publishedAt, toTs)
      )
    )
    .orderBy(desc(posts.publishedAt));

  // Album photos flagged for evaluation (owned or co-hosted events)
  const evalPhotos =
    allEventIds.length > 0
      ? await db
          .select()
          .from(eventAlbumPhotos)
          .where(
            and(
              inArray(eventAlbumPhotos.eventId, allEventIds),
              eq(eventAlbumPhotos.includeInEvaluation, true),
              inArray(eventAlbumPhotos.status, ['approved_album', 'featured_stream'])
            )
          )
          .orderBy(desc(eventAlbumPhotos.createdAt))
      : [];

  // Private archive files metadata index
  const archiveRows = await db
    .select()
    .from(clubArchiveFiles)
    .where(
      and(
        eq(clubArchiveFiles.clubId, params.clubId),
        gte(clubArchiveFiles.occurredOn, fromDate),
        lte(clubArchiveFiles.occurredOn, toDate)
      )
    )
    .orderBy(desc(clubArchiveFiles.occurredOn));

  const [latestNote] = await db
    .select()
    .from(clubHandoverNotes)
    .where(eq(clubHandoverNotes.clubId, params.clubId))
    .orderBy(desc(clubHandoverNotes.createdAt))
    .limit(1);

  return {
    club: {
      id: clubRow.club.id,
      slug: clubRow.club.slug,
      name: clubRow.club.name,
      category: clubRow.club.category,
      university_name: clubRow.university.name,
      university_short_name: clubRow.university.shortName,
    },
    period: {
      from_date: fromDate,
      to_date: toDate,
    },
    generated_at: new Date().toISOString(),
    active_officers: officers.map((o) => ({
      display_name: o.displayName,
      role: o.role,
      title: o.title,
    })),
    events: evalEvents,
    posts: evalPosts.map((p) => ({
      id: p.id,
      post_kind: p.postKind,
      headline: p.headline,
      published_at: p.publishedAt?.toISOString() ?? null,
    })),
    album_photos: evalPhotos.map((ph) => ({
      id: ph.id,
      event_id: ph.eventId,
      caption: ph.caption,
      preview_url: ph.previewUrl,
      created_at: ph.createdAt.toISOString(),
    })),
    archive_files: archiveRows.map((f) => ({
      id: f.id,
      category: f.archiveCategory,
      title: f.title,
      occurred_on: f.occurredOn,
      mime_type: f.mimeType,
      size_bytes: f.sizeBytes,
    })),
    latest_pitfall_note: latestNote
      ? {
          venue_tips: latestNote.venueTips,
          hours_and_deadlines: latestNote.hoursAndDeadlines,
          contacts_and_vendors: latestNote.contactsAndVendors,
        }
      : null,
  };
}

export function renderEvaluationMarkdown(pack: EvaluationPack): string {
  const lines: string[] = [
    `# ${pack.club.university_name} ${pack.club.name} — 社團評鑑暨活動成果報告`,
    ``,
    `- 評鑑區間：${pack.period.from_date} ～ ${pack.period.to_date}`,
    `- 匯出時間：${pack.generated_at}`,
    `- 認證幹部：${
      pack.active_officers
        .map((o) => `${o.display_name}${o.title ? `（${o.title}）` : ''}`)
        .join('、') || '（無紀錄）'
    }`,
    ``,
    `## 一、年度活動辦理實績（共 ${pack.events.length} 場）`,
    ``,
  ];

  if (pack.events.length === 0) {
    lines.push('（此區間尚無勾選納入評鑑之活動）', '');
  } else {
    pack.events.forEach((ev, idx) => {
      const hoursStr =
        ev.learning_hours_category !== 'none' && ev.learning_hours_count > 0
          ? `｜${LEARNING_HOURS_LABELS[ev.learning_hours_category as keyof typeof LEARNING_HOURS_LABELS] ?? ev.learning_hours_category} ${ev.learning_hours_count} 小時`
          : '';
      const coStr = ev.is_co_hosted
        ? `（Co-Club 共辦：${ev.partner_or_host_club ?? '友社'}）`
        : '';
      lines.push(
        `${idx + 1}. **${ev.title}** ${coStr}`,
        `   - 時間：${ev.starts_at ?? '未排定'}｜地點：${ev.location_text}`,
        `   - 參與：報名 ${ev.going_count} 人／實到簽到 ${ev.attended_count} 人${hoursStr}`
      );
    });
    lines.push('');
  }

  lines.push(`## 二、精選日常紀錄與作品精華（共 ${pack.posts.length} 篇）`, '');
  if (pack.posts.length === 0) {
    lines.push('（尚無勾選納入評鑑之成果貼文）', '');
  } else {
    pack.posts.forEach((p, idx) => {
      const kindLabel =
        POST_KIND_LABELS[p.post_kind as keyof typeof POST_KIND_LABELS]?.label ?? p.post_kind;
      lines.push(`${idx + 1}. [${kindLabel}] ${p.headline}（${p.published_at ?? '未標記'}）`);
    });
    lines.push('');
  }

  lines.push(
    `## 三、活動精選影像紀錄（共 ${pack.album_photos.length} 張）`,
    '',
    ...pack.album_photos.map(
      (ph, idx) => `${idx + 1}. ${ph.caption || '活動現場紀實'}（${ph.created_at}）`
    ),
    ''
  );

  lines.push(`## 四、社團內部檔案與財產會議清冊（共 ${pack.archive_files.length} 份）`, '');
  if (pack.archive_files.length === 0) {
    lines.push('（尚無此區間內之內部評鑑歸檔檔案）', '');
  } else {
    pack.archive_files.forEach((f, idx) => {
      lines.push(
        `${idx + 1}. [${f.category}] ${f.title}（發生日：${f.occurred_on}，${Math.round(
          f.size_bytes / 1024
        )} KB）`
      );
    });
    lines.push('');
  }

  if (pack.latest_pitfall_note) {
    lines.push(
      `## 五、社團傳承與行政避雷備忘錄`,
      '',
      `- **場地申請技巧**：${pack.latest_pitfall_note.venue_tips || '無'}`,
      `- **時數認證／經費核銷死線**：${pack.latest_pitfall_note.hours_and_deadlines || '無'}`,
      `- **關鍵窗口與廠商**：${pack.latest_pitfall_note.contacts_and_vendors || '無'}`,
      ''
    );
  }

  return lines.join('\n');
}
