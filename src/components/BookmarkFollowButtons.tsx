'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bookmark, Heart } from 'lucide-react';

export function BookmarkButton({
  postId,
  initialBookmarked,
  isLoggedIn,
}: {
  postId: string;
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
      const res = await fetch(`/api/me/bookmarks/${postId}`, {
        method: next ? 'POST' : 'DELETE',
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
      className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors ${
        bookmarked
          ? 'border-[var(--primary)] bg-orange-50 text-[var(--primary)]'
          : 'border-[var(--border-strong)] bg-white text-slate-700 hover:bg-orange-50'
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
  isLoggedIn,
}: {
  clubId: string;
  initialFollowed: boolean;
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const [followed, setFollowed] = useState(initialFollowed);
  const [pending, setPending] = useState(false);

  const toggle = async () => {
    if (!isLoggedIn) {
      router.push(`/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    const next = !followed;
    setFollowed(next);
    setPending(true);
    try {
      const res = await fetch(`/api/me/follows/${clubId}`, {
        method: next ? 'POST' : 'DELETE',
      });
      if (!res.ok) setFollowed(!next);
    } catch {
      setFollowed(!next);
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      disabled={pending}
      onClick={toggle}
      className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
        followed
          ? 'border border-[var(--primary)] bg-orange-50 text-[var(--primary)]'
          : 'bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]'
      }`}
    >
      <Heart className={`h-4 w-4 ${followed ? 'fill-current' : ''}`} aria-hidden="true" />
      <span>{followed ? '已追蹤社團' : '追蹤社團'}</span>
    </button>
  );
}
