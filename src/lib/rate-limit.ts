import { AppError } from './errors';

// ponytail: P0 in-memory sliding window limiter (ceiling ~100 RPS per serverless instance;
// upgrade path for P1 multi-instance exactness: Upstash Redis Ratelimit).
const buckets = new Map<string, number[]>();

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || 'unknown';
  }
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const cutoff = now - windowMs;
  const timestamps = (buckets.get(key) ?? []).filter((t) => t > cutoff);

  if (timestamps.length >= limit) {
    buckets.set(key, timestamps);
    return { allowed: false, remaining: 0 };
  }

  timestamps.push(now);
  buckets.set(key, timestamps);

  // Periodic cleanup to avoid unbounded map growth in long-lived servers
  if (buckets.size > 5000) {
    for (const [k, list] of buckets.entries()) {
      if (list.every((t) => t <= cutoff)) buckets.delete(k);
    }
  }

  return { allowed: true, remaining: Math.max(0, limit - timestamps.length) };
}

export function assertRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  message = '操作過於頻繁，請稍候再試。'
): void {
  const res = checkRateLimit(key, limit, windowMs);
  if (!res.allowed) {
    throw new AppError(429, 'RATE_LIMITED', message);
  }
}
