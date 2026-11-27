'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bookmark, Heart } from 'lucide-react';
import type { FollowMode } from '@/db/schema';

import { controlClasses } from '@/components/ui';
const FOLLOW_MODE_LABELS: Record<FollowMode, string> = {
  all: '全動態追蹤中',
  events_only: '只追活動中',
};

export function BookmarkButton({
  targetType = 'post',
  targetId,
  initialBookmarked,
  isLoggedIn,
}: {
  targetType?: 'post' | 'event';
  targetId: string;
  initialBookmarked: boolean;
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [pending, setPending] = useState(false);

  const toggle = async () => {
    if (!isLoggedIn) {
      router.push(`/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    const next = !bookmarked;
    setBookmarked(next);
    setPending(true);
    try {
      const res = await fetch('/api/me/bookmarks', {
        method: next ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_type: targetType, target_id: targetId }),
      });
      if (!res.ok) setBookmarked(!next);
    } catch {
      setBookmarked(!next);
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      disabled={pending}
      onClick={toggle}
      className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-semibold transition-colors ${
        bookmarked
          ? 'border-brand bg-brand-soft text-brand'
          : 'border-border-strong bg-surface text-fg-secondary hover:bg-brand-soft'
      }`}
    >
      <Bookmark className={`h-3.5 w-3.5 ${bookmarked ? 'fill-current' : ''}`} aria-hidden="true" />
      <span>{bookmarked ? '已私密收藏' : '私密收藏'}</span>
    </button>
  );
}

export function FollowButton({
  clubId,
  initialFollowed,
  initialMode = 'all',
  isLoggedIn,
}: {
  clubId: string;
  initialFollowed: boolean;
  initialMode?: FollowMode;
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const [followed, setFollowed] = useState(initialFollowed);
  const [followMode, setFollowMode] = useState<FollowMode>(initialMode);
  const [pending, setPending] = useState(false);

  const toggle = async (nextMode?: FollowMode) => {
    if (!isLoggedIn) {
      router.push(`/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    const targetMode = nextMode ?? followMode;
    const shouldDelete = !nextMode && followed;
    setPending(true);
    try {
      const res = await fetch(`/api/me/follows/${clubId}`, {
        method: shouldDelete ? 'DELETE' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: shouldDelete ? undefined : JSON.stringify({ follow_mode: targetMode }),
      });
      if (res.ok) {
        setFollowed(!shouldDelete);
        if (!shouldDelete) setFollowMode(targetMode);
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="inline-flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        disabled={pending}
        onClick={() => toggle()}
        className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
          followed
            ? 'border border-brand bg-brand-soft text-brand'
            : 'bg-brand text-on-brand hover:bg-brand-hover'
        }`}
      >
        <Heart className={`h-4 w-4 ${followed ? 'fill-current' : ''}`} aria-hidden="true" />
        <span>{followed ? FOLLOW_MODE_LABELS[followMode] : '追蹤社團'}</span>
      </button>
      {followed && (
        <select
          aria-label="選擇追蹤篩選模式"
          disabled={pending}
          value={followMode}
          onChange={(e) => toggle(e.target.value as FollowMode)}
          className={`${controlClasses} min-h-11`}
        >
          <option value="all">只看：全動態</option>
          <option value="events_only">只看：新活動</option>
        </select>
      )}
    </div>
  );
}
