import { CalendarClock, MapPinOff, Vote } from 'lucide-react';
import { Badge } from '@/components/ui';

const TBD_NOTE = /[（(]\s*(?:tbd|待定)[^）)]*[）)]|\btbd\b|待定|投票中/gi;

/** Location still open: the schema default 'TBD 待定', or a place with a "(TBD …)" note. */
export function isLocationTbd(locationText: string | null | undefined): boolean {
  const t = (locationText ?? '').trim();
  return t === '' || /tbd|待定/i.test(t);
}

/** The known part of a location ("中大綜教館（TBD 待定）" -> "中大綜教館"); the badge says the rest. */
export function settledLocation(locationText: string | null | undefined): string {
  return (locationText ?? '').replace(TBD_NOTE, '').replace(/\s+/g, ' ').trim();
}

/**
 * Unsettled time/place as short stickers instead of sentences in the meta line,
 * so "still open" reads in half a second.
 */
export function EventStatusTags({
  scheduleMode,
  startsAt,
  locationText,
}: {
  scheduleMode: string;
  startsAt: string | Date | null | undefined;
  locationText?: string | null;
}) {
  const tags: { key: string; label: string; icon: React.ReactNode }[] = [];
  const icon = 'h-3.5 w-3.5';
  if (scheduleMode === 'voting') {
    tags.push({ key: 'voting', label: '喬時間', icon: <Vote className={icon} aria-hidden="true" /> });
  } else if (scheduleMode === 'tbd' || !startsAt) {
    tags.push({ key: 'tbd', label: '時間待定', icon: <CalendarClock className={icon} aria-hidden="true" /> });
  }
  if (locationText !== undefined && isLocationTbd(locationText)) {
    tags.push({ key: 'loc', label: '地點待定', icon: <MapPinOff className={icon} aria-hidden="true" /> });
  }
  if (tags.length === 0) return null;
  return (
    <span className="flex flex-wrap gap-1.5">
      {tags.map((t) => (
        <Badge key={t.key} tone="warning" icon={t.icon}>
          {t.label}
        </Badge>
      ))}
    </span>
  );
}
