/**
 * Returns the ROC academic year in Asia/Taipei timezone (e.g., 2026-11-25 -> 115).
 */
export function getCurrentAcademicYear(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(now);

  const year = Number(parts.find((p) => p.type === 'year')?.value ?? now.getUTCFullYear());
  const month = Number(parts.find((p) => p.type === 'month')?.value ?? now.getUTCMonth() + 1);
  const rocYear = year - 1911;
  return month >= 8 ? rocYear : rocYear - 1;
}

export function formatTaipeiDate(input: Date | string | null | undefined): string {
  if (!input) return '';
  const date = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function formatTaipeiDateTime(input: Date | string | null | undefined): string {
  if (!input) return '';
  const date = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}
