import type { ClubCategory } from '@/db/schema';
import { CLUB_CATEGORY_LIST } from '@/lib/constants';

export function freshnessScore(
  publishedAt: Date | string | null | undefined,
  now: Date = new Date()
): number {
  if (!publishedAt) return 30;
  const dt = typeof publishedAt === 'string' ? new Date(publishedAt) : publishedAt;
  if (Number.isNaN(dt.getTime())) return 30;

  const days = Math.max(0, (now.getTime() - dt.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 7) return 100;
  if (days <= 30) return 100 - ((days - 7) / (30 - 7)) * 25;
  if (days >= 365) return 30;
  return 75 - ((days - 30) / (365 - 30)) * 45;
}

export function computeCombinedScore(
  relevanceScore: number,
  publishedAt: Date | string | null | undefined,
  domainBoost = 0,
  now: Date = new Date()
): number {
  return 0.8 * relevanceScore + 0.15 * freshnessScore(publishedAt, now) + 0.05 * domainBoost;
}

export function computeClubPulse(params: {
  lastActivityAt: Date | string | null | undefined;
  recentQaMedianHours?: number | null;
  now?: Date;
}): string {
  const now = params.now ?? new Date();
  if (params.lastActivityAt) {
    const dt =
      typeof params.lastActivityAt === 'string'
        ? new Date(params.lastActivityAt)
        : params.lastActivityAt;
    if (!Number.isNaN(dt.getTime())) {
      const days = (now.getTime() - dt.getTime()) / (1000 * 60 * 60 * 24);
      if (days <= 7) return '本週剛更新';
    }
  }
  if (typeof params.recentQaMedianHours === 'number' && params.recentQaMedianHours <= 24) {
    return '幹部當日回覆提問';
  }
  if (params.lastActivityAt) {
    const dt =
      typeof params.lastActivityAt === 'string'
        ? new Date(params.lastActivityAt)
        : params.lastActivityAt;
    if (!Number.isNaN(dt.getTime())) {
      const days = (now.getTime() - dt.getTime()) / (1000 * 60 * 60 * 24);
      if (days <= 30) return '近 30 天活躍';
    }
  }
  return '穩定累積紀錄中';
}

/**
 * Deterministic fairness reranker (SRS v2.0 §6.2):
 * - Ignores any external popularity / vanity numbers.
 * - Caps batch at maxBatchSize (default 12).
 * - Enforces <= maxPerClub (default 2) per club in one batch.
 * - Never places two items from the same club back-to-back.
 * - Never pads unrelated items to fill batch size.
 */
export function applyFairnessPolicy<T extends { clubId: string; finalScore: number }>(
  candidates: T[],
  options: { maxBatchSize: number; maxPerClub: number } = { maxBatchSize: 12, maxPerClub: 2 }
): T[] {
  const pool = [...candidates].sort((a, b) => b.finalScore - a.finalScore);
  const result: T[] = [];
  const clubCounts = new Map<string, number>();

  while (result.length < options.maxBatchSize && pool.length > 0) {
    const lastClubId = result.at(-1)?.clubId;
    const pickIdx = pool.findIndex(
      (item) => (clubCounts.get(item.clubId) ?? 0) < options.maxPerClub && item.clubId !== lastClubId
    );
    if (pickIdx === -1) break;

    const [picked] = pool.splice(pickIdx, 1);
    result.push(picked);
    clubCounts.set(picked.clubId, (clubCounts.get(picked.clubId) ?? 0) + 1);
  }

  return result;
}

export function pickSuggestedCategories(
  currentCategory?: ClubCategory | null,
  count = 3
): { value: ClubCategory; label: string }[] {
  return CLUB_CATEGORY_LIST.filter((c) => c.value !== currentCategory)
    .slice(0, count)
    .map(({ value, label }) => ({ value, label }));
}
