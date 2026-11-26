'use client';

import type { AnalyticsEventType } from '@/db/schema';

export function trackAnalyticsEvent(payload: {
  event_type: AnalyticsEventType;
  club_id?: string | null;
  target_id?: string | null;
  source_surface?: string | null;
}): void {
  if (typeof window === 'undefined') return;
  try {
    const body = JSON.stringify(payload);
    if (typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' });
      const sent = navigator.sendBeacon('/api/events', blob);
      if (sent) return;
    }
    void fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    });
  } catch {
    // Non-blocking anonymous analytics
  }
}
