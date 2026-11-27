'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Film, KeyRound, Settings, Sparkles } from 'lucide-react';
import type { ClubMemberRole, MediaItem, PostKind } from '@/db/schema';
import { uploadShortVideo } from '@/lib/media/client-upload';
import { ImageUploader } from '@/components/ImageUploader';

export interface MyClubMembershipItem {
  clubId: string;
  slug: string;
  name: string;
  universityShortName: string;
  role: ClubMemberRole;
  title: string | null;
}

export function MyClubsClient({
  memberships,
  isCampusVerified,
}: {
  memberships: MyClubMembershipItem[];
  isCampusVerified: boolean;
}) {
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState('');
  const [joinBusy, setJoinBusy] = useState(false);
  const [joinMsg, setJoinMsg] = useState<string | null>(null);
  const [joinErr, setJoinErr] = useState<string | null>(null);

  const activePostingClubs = memberships.filter((m) =>
    ['owner', 'editor', 'member'].includes(m.role)
  );
  const [selectedSlug, setSelectedSlug] = useState(activePostingClubs[0]?.slug ?? '');
  const selectedClub = activePostingClubs.find((c) => c.slug === selectedSlug) ?? activePostingClubs[0];
  const isOfficerSelected =
    selectedClub?.role === 'owner' || selectedClub?.role === 'editor';

  const [postKind, setPostKind] = useState<'nrc_moment' | 'wip_work'>('nrc_moment');
  const [headline, setHeadline] = useState('');
  const [moodTag, setMoodTag] = useState('');
  const [contentMd, setContentMd] = useState('');
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [originalityConfirmed, setOriginalityConfirmed] = useState(false);
  const [includeEval, setIncludeEval] = useState(false);
  const [videoBusy, setVideoBusy] = useState(false);
  const [postBusy, setPostBusy] = useState(false);
  const [postMsg, setPostMsg] = useState<string | null>(null);
  const [postErr, setPostErr] = useState<string | null>(null);

  async function handleRedeemCode(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    setJoinBusy(true);
    setJoinMsg(null);
    setJoinErr(null);
    try {
      const res = await fetch('/api/clubs/join-by-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: inviteCode.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || '驗證邀請碼失敗');
      setInviteCode('');
      setJoinMsg(
        json.already_member
          ? `你已是「${json.club_name}」的認證社員，已切換顯示。`
          : `加入成功！你已是「${json.club_name}」認證社員，可直接下方發文。`
      );
      router.refresh();
    } catch (err) {
      setJoinErr(err instanceof Error ? err.message : '邀請碼兌換失敗');
    } finally {
      setJoinBusy(false);
    }
  }

  async function handleShortVideoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !selectedClub) return;
    setVideoBusy(true);
    setPostErr(null);
    try {
      const videoMedia = await uploadShortVideo(selectedClub.clubId, file);
      setMediaItems((prev) => [...prev, videoMedia].slice(0, 6));
    } catch (err) {
      setPostErr(err instanceof Error ? err.message : '短影上傳失敗');
    } finally {
      setVideoBusy(false);
    }
  }

  async function handlePublishPost(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedClub) return;
    setPostErr(null);
    setPostMsg(null);
    if (!originalityConfirmed) {
      setPostErr('請先勾選原創與肖像授權聲明。');
      return;
    }
    if (mediaItems.length === 0) {
      setPostErr('請至少上傳 1 張原比例圖片或短影。');
      return;
    }

    setPostBusy(true);
    try {
      const resolvedKind: PostKind = isOfficerSelected ? postKind : 'nrc_moment';
      const res = await fetch(`/api/clubs/${selectedClub.slug}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post_kind: resolvedKind,
          headline: headline.trim(),
          content_md: contentMd.trim(),
          media_items: mediaItems,
          mood_tag: moodTag.trim() || null,
          originality_confirmed: true,
          include_in_evaluation: includeEval,
          status: 'published',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || '發布失敗');
      setHeadline('');
      setMoodTag('');
      setContentMd('');
      setMediaItems([]);
      setOriginalityConfirmed(false);
      setPostMsg('微動態已發布登上「別的聚」現場流！');
      fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: 'nrc_publish',
          club_id: selectedClub.clubId,
          target_id: json.post?.id ?? null,
          source_surface: 'my_clubs',
        }),
      }).catch(() => {});
    } catch (err) {
      setPostErr(err instanceof Error ? err.message : '發布失敗');
    } finally {
      setPostBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Membership Cards */}
      <div className="rounded-xl border border-ink-300 bg-white p-6 shadow-xs">
        <h1 className="text-xl font-bold text-ink-900">我的聚｜社團切換與日常紀錄</h1>
        <p className="mt-1 text-sm text-ink-600">
          認證社員可直接發一篇社團日常；幹部可進入管理後台發起活動或整理評鑑資料。
        </p>

        {memberships.length === 0 ? (
          <div className="mt-5 rounded-xl border border-dashed border-ink-300 bg-ink-100 p-6 text-center">
            <p className="text-sm font-semibold text-ink-800">目前尚未加入任何認證社團</p>
            <p className="mt-1 text-sm text-ink-600">
              輸入幹部給的限時邀請碼，或至社團公開頁點擊申請加入認證社員。
            </p>
          </div>
        ) : (
          <div className="mt-5 grid gap-3">
            {memberships.map((m) => (
              <div
                key={`${m.clubId}-${m.role}`}
                className="flex flex-col justify-between gap-3 rounded-xl border border-line bg-ink-100 p-4 sm:flex-row sm:items-center"
              >
                <div>
                  <span className="text-sm font-semibold text-ink-500">
                    {m.universityShortName} · {m.role.toUpperCase()}
                    {m.title ? `（${m.title}）` : ''}
                  </span>
                  <h2 className="text-base font-bold text-ink-900">{m.name}</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/clubs/${m.slug}`}
                    className="inline-flex min-h-[40px] items-center gap-1 rounded-xl border border-ink-300 bg-white px-3.5 text-sm font-semibold text-ink-800"
                  >
                    社團門面
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                  {(m.role === 'owner' || m.role === 'editor' || m.role === 'alumni') && (
                    <Link
                      href={`/clubs/${m.slug}/manage`}
                      className="inline-flex min-h-[40px] items-center gap-1 rounded-xl bg-accent-600 px-3.5 text-sm font-semibold text-white"
                    >
                      <Settings className="h-3.5 w-3.5" />
                      管理後台
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invite Code Redeem */}
      <div className="rounded-xl border border-line bg-white p-6 shadow-xs">
        <h2 className="flex items-center gap-2 text-base font-bold text-ink-900">
          <KeyRound className="h-4 w-4 text-accent-600" aria-hidden="true" />
          輸入幹部邀請碼，成為認證社員
        </h2>
        {!isCampusVerified ? (
          <p className="mt-2 text-sm text-ink-600">
            邀請碼僅限同校學生驗證使用，請先至{' '}
            <Link
              href="/me?returnTo=/my-clubs"
              className="inline-flex min-h-[44px] items-center font-bold text-accent-600 underline"
            >
              個人中心驗證學校信箱
            </Link>
            。
          </p>
        ) : (
          <form onSubmit={handleRedeemCode} className="mt-3 flex flex-wrap gap-2">
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="例如：NCUP-A1B2C3"
              className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-line-input px-3.5 py-2 text-sm uppercase"
            />
            <button
              type="submit"
              disabled={joinBusy || inviteCode.trim().length < 4}
              className="min-h-[44px] rounded-full bg-accent-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {joinBusy ? '驗證中...' : '立即加入社團'}
            </button>
          </form>
        )}
        {joinMsg && <p className="mt-2 text-sm font-semibold text-success-700">{joinMsg}</p>}
        {joinErr && <p className="mt-2 text-sm font-semibold text-danger-700">{joinErr}</p>}
      </div>

      {/* Quick Post Composer */}
      {selectedClub && (
        <form
          onSubmit={handlePublishPost}
          className="space-y-4 rounded-xl border border-ink-300 bg-white p-6 shadow-xs"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-base font-bold text-ink-900">
              <Sparkles className="h-4 w-4 text-accent-600" aria-hidden="true" />
              發一則社團日常
            </h2>
            <span className="rounded-full bg-accent-50 px-3 py-1 text-sm font-semibold text-accent-900">
              免公文格式，記錄真實的社員互動瞬間
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-semibold text-ink-700">發表社團</label>
              <select
                value={selectedClub.slug}
                onChange={(e) => setSelectedSlug(e.target.value)}
                className="min-h-[44px] w-full rounded-xl border border-line-input bg-white px-3 py-2 text-sm font-medium"
              >
                {activePostingClubs.map((c) => (
                  <option key={c.clubId} value={c.slug}>
                    {c.universityShortName} {c.name}（{c.role}）
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-ink-700">內容類型</label>
              <select
                value={isOfficerSelected ? postKind : 'nrc_moment'}
                onChange={(e) => setPostKind(e.target.value as 'nrc_moment' | 'wip_work')}
                disabled={!isOfficerSelected}
                className="min-h-[44px] w-full rounded-xl border border-line-input bg-white px-3 py-2 text-sm font-medium disabled:bg-ink-50"
              >
                <option value="nrc_moment">社員日常紀錄</option>
                {isOfficerSelected && <option value="wip_work">社團實作作品／成果</option>}
              </select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-semibold text-ink-700">一句話亮點 *</label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={120}
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="例如：暗房剛沖出第一捲底片，大家在燈下等影的那刻太酷了"
                className="w-full rounded-xl border border-line-input px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-ink-700">氛圍小標（選填）</label>
              <input
                type="text"
                maxLength={24}
                value={moodTag}
                onChange={(e) => setMoodTag(e.target.value)}
                placeholder="例如：週四練團夜"
                className="w-full rounded-xl border border-line-input px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-ink-700">補充背景（選填）</label>
            <textarea
              rows={2}
              value={contentMd}
              onChange={(e) => setContentMd(e.target.value)}
              placeholder="可以簡單補一句器材或歡迎新生一起來的原因..."
              className="w-full rounded-xl border border-line-input px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-3 rounded-xl bg-ink-50 p-4">
            <ImageUploader
              clubId={selectedClub.clubId}
              value={mediaItems}
              onChange={setMediaItems}
              maxImages={6}
              purpose="post_image"
            />
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-ink-300 bg-white px-3.5 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-50">
                <Film className="h-4 w-4 text-accent-600" aria-hidden="true" />
                {videoBusy ? '處理短影與封面中...' : '或上傳 15 秒內短影 (MP4/WebM ≤25MB)'}
                <input
                  type="file"
                  accept="video/mp4,video/webm"
                  onChange={handleShortVideoChange}
                  disabled={videoBusy || mediaItems.length >= 6}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <div className="space-y-2 text-sm text-ink-700">
            <label className="flex cursor-pointer items-center gap-2 font-semibold">
              <input
                type="checkbox"
                checked={originalityConfirmed}
                onChange={(e) => setOriginalityConfirmed(e.target.checked)}
              />
              本人確認照片／短影為原創拍攝且未侵犯肖像與著作權（必填）
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={includeEval}
                onChange={(e) => setIncludeEval(e.target.checked)}
              />
              同時標記為本學期社團評鑑成果候補
            </label>
          </div>

          {postMsg && <p className="text-sm font-semibold text-success-700">{postMsg}</p>}
          {postErr && <p className="text-sm font-semibold text-danger-700">{postErr}</p>}

          <button
            type="submit"
            disabled={postBusy || !headline.trim()}
            className="rounded-full bg-accent-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-accent-700 disabled:opacity-50"
          >
            {postBusy ? '發布中...' : '發布到社團日常與現場流'}
          </button>
        </form>
      )}
    </div>
  );
}
