'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, CalendarPlus, Film, KeyRound, Settings, Sparkles } from 'lucide-react';
import type { ClubMemberRole, MediaItem, PostKind } from '@/db/schema';
import { uploadShortVideo } from '@/lib/media/client-upload';
import { ImageUploader } from '@/components/ImageUploader';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  ClubMark,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  Textarea,
  buttonClasses,
  controlClasses,
} from '@/components/ui';

const ROLE_LABELS: Partial<Record<ClubMemberRole, string>> = {
  owner: '社長',
  editor: '幹部',
  member: '社員',
  alumni: '校友',
};

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
  const [postedId, setPostedId] = useState<string | null>(null);
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
    setPostedId(null);
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
      setPostedId(json.post?.id ?? null);
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
      <PageHeader title="我的聚" description="切換你的社團、發一則社團日常；幹部可以進管理頁辦活動。" />

      {/* Memberships: one divided list, one primary action per row at most */}
      {memberships.length === 0 ? (
        <EmptyState
          icon={<KeyRound />}
          title="還沒加入任何社團"
          description="輸入幹部給你的邀請碼，或到社團頁申請加入。"
        />
      ) : (
        <Card padded={false}>
          <ul className="divide-y-2 divide-line">
          {memberships.map((m) => {
            const isOfficer = m.role === 'owner' || m.role === 'editor';
            const canManage = isOfficer || m.role === 'alumni';
            return (
              <li key={`${m.clubId}-${m.role}`} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:flex-nowrap sm:px-5">
                <ClubMark name={m.name} seed={m.slug} size="md" />
                <Link href={`/clubs/${m.slug}`} className="min-w-[10rem] flex-1 py-1 hover:underline">
                  <p className="truncate text-base font-semibold text-fg">{m.name}</p>
                  <p className="truncate text-sm text-fg-muted">
                    {m.universityShortName} · {m.title || ROLE_LABELS[m.role] || m.role}
                  </p>
                </Link>
                {canManage ? (
                  <div className="ml-auto flex shrink-0 gap-2">
                    {isOfficer && (
                      <ButtonLink
                        href={`/clubs/${m.slug}/manage?new=event`}
                        variant="soft"
                        size="sm"
                        icon={<CalendarPlus className="h-4 w-4" aria-hidden="true" />}
                        aria-label={`幫${m.name}發活動`}
                      >
                        發活動
                      </ButtonLink>
                    )}
                    <ButtonLink
                      href={`/clubs/${m.slug}/manage`}
                      variant="secondary"
                      size="sm"
                      icon={<Settings className="h-4 w-4" aria-hidden="true" />}
                      aria-label={`管理${m.name}`}
                    >
                      管理
                    </ButtonLink>
                  </div>
                ) : (
                  <ArrowRight className="h-4 w-4 shrink-0 text-fg-subtle" aria-hidden="true" />
                )}
              </li>
            );
          })}
          </ul>
        </Card>
      )}

      {/* Invite Code Redeem */}
      <Card>
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-fg">
          <KeyRound className="h-4 w-4 text-brand-soft-fg" aria-hidden="true" />
          輸入幹部邀請碼，成為認證社員
        </h2>
        {!isCampusVerified ? (
          <p className="mt-2 text-sm text-fg-muted">
            邀請碼僅限同校學生驗證使用，請先至{' '}
            <Link
              href="/me?returnTo=/my-clubs"
              className="inline-flex min-h-[44px] items-center font-bold text-brand-soft-fg underline"
            >
              個人中心驗證學校信箱
            </Link>
            。
          </p>
        ) : (
          <form onSubmit={handleRedeemCode} className="mt-3 flex flex-wrap gap-2">
            <input
              aria-label="邀請碼"
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="例如：NCUP-A1B2C3"
              className={`${controlClasses} min-h-11 min-w-0 flex-1 font-mono uppercase`}
            />
            <Button type="submit" variant="primary" loading={joinBusy} disabled={inviteCode.trim().length < 4}>
              {joinBusy ? '驗證中...' : '立即加入社團'}
            </Button>
          </form>
        )}
        {joinMsg && <p className="mt-2 text-sm font-semibold text-success-fg">{joinMsg}</p>}
        {joinErr && <p className="mt-2 text-sm font-semibold text-danger-fg">{joinErr}</p>}
      </Card>

      {/* Quick Post Composer */}
      {selectedClub && (
        <Card>
          <form onSubmit={handlePublishPost} className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold text-fg">
                <Sparkles className="h-4 w-4 text-brand-soft-fg" aria-hidden="true" />
                發一則社團日常
              </h2>
              <Badge tone="accent">免公文格式，記錄真實的社員互動瞬間</Badge>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="發表社團">
                {(p) => (
                  <Select {...p} value={selectedClub.slug} onChange={(e) => setSelectedSlug(e.target.value)}>
                    {activePostingClubs.map((c) => (
                      <option key={c.clubId} value={c.slug}>
                        {c.universityShortName} {c.name}（{ROLE_LABELS[c.role] ?? '社員'}）
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="內容類型">
                {(p) => (
                  <Select
                    {...p}
                    value={isOfficerSelected ? postKind : 'nrc_moment'}
                    onChange={(e) => setPostKind(e.target.value as 'nrc_moment' | 'wip_work')}
                    disabled={!isOfficerSelected}
                  >
                    <option value="nrc_moment">社員日常紀錄</option>
                    {isOfficerSelected && <option value="wip_work">社團實作作品／成果</option>}
                  </Select>
                )}
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="一句話亮點（必填）" className="sm:col-span-2">
                {(p) => (
                  <Input
                    {...p}
                    type="text"
                    required
                    minLength={2}
                    maxLength={120}
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                    placeholder="例如：暗房剛沖出第一捲底片，大家在燈下等影的那刻太酷了"
                  />
                )}
              </Field>
              <Field label="氛圍小標（選填）">
                {(p) => (
                  <Input
                    {...p}
                    type="text"
                    maxLength={24}
                    value={moodTag}
                    onChange={(e) => setMoodTag(e.target.value)}
                    placeholder="例如：週四練團夜"
                  />
                )}
              </Field>
            </div>

            <Field label="補充背景（選填）">
              {(p) => (
                <Textarea
                  {...p}
                  rows={2}
                  value={contentMd}
                  onChange={(e) => setContentMd(e.target.value)}
                  placeholder="可以簡單補一句器材或歡迎新生一起來的原因..."
                />
              )}
            </Field>

            <div className="space-y-3 rounded-xl bg-surface-subtle p-4">
              <ImageUploader
                clubId={selectedClub.clubId}
                value={mediaItems}
                onChange={setMediaItems}
                maxImages={6}
                purpose="post_image"
              />
              <label
                className={buttonClasses({
                  variant: 'secondary',
                  size: 'md',
                  className: 'cursor-pointer focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus-ring',
                })}
              >
                <Film className="h-4 w-4" aria-hidden="true" />
                {videoBusy ? '處理短影與封面中...' : '或上傳 15 秒內短影（MP4／WebM，25MB 內）'}
                <input
                  type="file"
                  accept="video/mp4,video/webm"
                  onChange={handleShortVideoChange}
                  disabled={videoBusy || mediaItems.length >= 6}
                  className="sr-only"
                />
              </label>
            </div>

            <div className="space-y-1 text-sm text-fg-secondary">
              <label className="flex min-h-11 cursor-pointer items-center gap-2 font-semibold">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-brand"
                  checked={originalityConfirmed}
                  onChange={(e) => setOriginalityConfirmed(e.target.checked)}
                />
                本人確認照片／短影為原創拍攝且未侵犯肖像與著作權（必填）
              </label>
              <label className="flex min-h-11 cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-brand"
                  checked={includeEval}
                  onChange={(e) => setIncludeEval(e.target.checked)}
                />
                同時標記為本學期社團評鑑成果候補（選填）
              </label>
            </div>

            {postMsg && (
              <p className="flex flex-wrap items-center gap-x-2 text-sm font-semibold text-success-fg">
                {postMsg}
                {postedId && (
                  <Link
                    href={`/posts/${postedId}`}
                    className="inline-flex min-h-11 items-center gap-1 font-bold text-fg underline"
                  >
                    去看這則貼文
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                )}
              </p>
            )}
            {postErr && <p className="text-sm font-semibold text-danger-fg">{postErr}</p>}

            <Button type="submit" variant="primary" loading={postBusy} disabled={!headline.trim()}>
              {postBusy ? '發布中...' : '發布到社團日常與現場流'}
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
