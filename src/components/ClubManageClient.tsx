'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  Download,
  FileText,
  Plus,
  Printer,
  Settings,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
  Wand2,
} from 'lucide-react';
import type {
  ClubCategory,
  ClubMemberRole,
  ExternalLink,
  MediaItem,
  PostStatus,
  PostType,
} from '@/db/schema';
import { formatTaipeiDate, formatTaipeiDateTime } from '@/lib/academic-year';
import {
  CLUB_CATEGORY_LIST,
  CURATED_INTEREST_TAGS,
  POST_TYPES,
} from '@/lib/constants';
import { ImageUploader } from './ImageUploader';

export interface ManageClubData {
  club: {
    id: string;
    slug: string;
    name: string;
    category: ClubCategory;
    tagline: string;
    description: string;
    avatarUrl: string | null;
    coverUrl: string | null;
    externalLinks: ExternalLink[];
    verificationStatus: string;
    isDemo: boolean;
    universityName: string;
  };
  myRole: ClubMemberRole | 'platform_admin';
  myUserId: string;
  currentAcademicYear: number;
  posts: {
    id: string;
    authorUserId: string;
    academicYear: number;
    postType: PostType;
    title: string;
    summary: string;
    contentMd: string;
    tags: string[];
    mediaUrls: MediaItem[];
    externalLinks: ExternalLink[];
    collaborators: string | null;
    originalityConfirmed: boolean;
    status: PostStatus;
    publishedAt: string | null;
    updatedAt: string;
  }[];
  opportunities: {
    id: string;
    title: string;
    summary: string;
    scheduleText: string | null;
    deadlineAt: string | null;
    externalUrl: string;
    isActive: boolean;
  }[];
  members: {
    userId: string;
    displayName: string;
    role: ClubMemberRole;
    title: string | null;
    joinedAt: string;
    endedAt: string | null;
  }[];
  pendingHandover: {
    id: string;
    toUserId: string;
    toUserName: string;
    note: string | null;
    expiresAt: string;
  } | null;
}

type TabKey = 'posts' | 'opportunities' | 'profile' | 'members' | 'summary';

export function ClubManageClient({ data }: { data: ManageClubData }) {
  const router = useRouter();
  const isReadOnlyAlumni = data.myRole === 'alumni';
  const isOwner = data.myRole === 'owner';
  const isSuspended = data.club.verificationStatus === 'suspended';
  const canEdit = !isReadOnlyAlumni && !isSuspended && data.myRole !== 'platform_admin';

  const [tab, setTab] = useState<TabKey>(isReadOnlyAlumni ? 'summary' : 'posts');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ---- Post Form & AI Drawer ----
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [postTitle, setPostTitle] = useState('');
  const [postType, setPostType] = useState<PostType>('work');
  const [postYear, setPostYear] = useState(data.currentAcademicYear);
  const [postSummary, setPostSummary] = useState('');
  const [postContentMd, setPostContentMd] = useState('');
  const [postTags, setPostTags] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState('');
  const [postMedia, setPostMedia] = useState<MediaItem[]>([]);
  const [postLinks, setPostLinks] = useState<ExternalLink[]>([]);
  const [postCollaborators, setPostCollaborators] = useState('');
  const [originalityConfirmed, setOriginalityConfirmed] = useState(false);
  const [postBusy, setPostBusy] = useState(false);

  // AI Quick Organize state
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [rawText, setRawText] = useState('');
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMsg, setAiMsg] = useState<string | null>(null);

  // Soft-delete confirm modal
  const [deleteTargetPost, setDeleteTargetPost] = useState<{ id: string; title: string } | null>(
    null
  );

  // ---- Opportunities state ----
  const [oppTitle, setOppTitle] = useState('');
  const [oppSummary, setOppSummary] = useState('');
  const [oppSchedule, setOppSchedule] = useState('');
  const [oppDeadline, setOppDeadline] = useState('');
  const [oppUrl, setOppUrl] = useState('');
  const [oppBusy, setOppBusy] = useState(false);

  // ---- Profile state ----
  const [clubCategory, setClubCategory] = useState<ClubCategory>(data.club.category);
  const [clubTagline, setClubTagline] = useState(data.club.tagline);
  const [clubDesc, setClubDesc] = useState(data.club.description);
  const [clubAvatar, setClubAvatar] = useState<MediaItem[]>(
    data.club.avatarUrl ? [{ url: data.club.avatarUrl, alt: `${data.club.name} 頭像` }] : []
  );
  const [clubCover, setClubCover] = useState<MediaItem[]>(
    data.club.coverUrl ? [{ url: data.club.coverUrl, alt: `${data.club.name} 封面` }] : []
  );
  const [clubLinks, setClubLinks] = useState<ExternalLink[]>(data.club.externalLinks);
  const [profileBusy, setProfileBusy] = useState(false);

  // ---- Members & Handover state ----
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberTitle, setNewMemberTitle] = useState('幹部');
  const [handoverTargetId, setHandoverTargetId] = useState('');
  const [handoverEmail, setHandoverEmail] = useState('');
  const [handoverNote, setHandoverNote] = useState('');
  const [memberBusy, setMemberBusy] = useState(false);

  // ---- Summary Year ----
  const availableYears = Array.from(
    new Set([data.currentAcademicYear, ...data.posts.map((p) => p.academicYear)])
  ).sort((a, b) => b - a);
  const [summaryYear, setSummaryYear] = useState(availableYears[0] ?? data.currentAcademicYear);

  const resetPostForm = () => {
    setEditingPostId(null);
    setPostTitle('');
    setPostType('work');
    setPostYear(data.currentAcademicYear);
    setPostSummary('');
    setPostContentMd('');
    setPostTags([]);
    setPostMedia([]);
    setPostLinks([]);
    setPostCollaborators('');
    setOriginalityConfirmed(false);
  };

  const loadPostIntoForm = (p: ManageClubData['posts'][number]) => {
    setEditingPostId(p.id);
    setPostTitle(p.title);
    setPostType(p.postType);
    setPostYear(p.academicYear);
    setPostSummary(p.summary);
    setPostContentMd(p.contentMd);
    setPostTags(p.tags);
    setPostMedia(p.mediaUrls);
    setPostLinks(p.externalLinks);
    setPostCollaborators(p.collaborators ?? '');
    setOriginalityConfirmed(p.originalityConfirmed);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const runAiOrganize = async (e: React.FormEvent) => {
    e.preventDefault();
    setAiBusy(true);
    setAiMsg(null);
    setError(null);
    try {
      const fd = new FormData();
      fd.set('club_id', data.club.id);
      if (rawText.trim()) fd.set('raw_text', rawText.trim());
      if (rawFile) fd.set('file', rawFile);

      const res = await fetch('/api/ai/draft-from-raw', {
        method: 'POST',
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) {
        setAiMsg(json?.error?.message || 'AI 整理失敗，已保留您的原始文字。');
        return;
      }

      const d = json.draft;
      setEditingPostId(null);
      setPostTitle(d.title);
      setPostType(d.post_type);
      setPostSummary(d.summary);
      setPostContentMd(d.content_md);
      setPostTags(d.suggested_tags ?? []);
      setOriginalityConfirmed(false);
      setAiDrawerOpen(false);
      setNotice(
        `AI 已將零散紀錄整理為草稿填入下方表單${
          json.warnings?.length ? `（${json.warnings.join(' ')}）` : ''
        }，請審閱微調並勾選授權聲明後再發布。`
      );
    } catch {
      setAiMsg('網路連線異常，已保留原始輸入，請稍後重試。');
    } finally {
      setAiBusy(false);
    }
  };

  const submitPost = async (targetStatus: 'draft' | 'published') => {
    setPostBusy(true);
    setError(null);
    setNotice(null);
    try {
      const payload = {
        title: postTitle,
        post_type: postType,
        academic_year: Number(postYear),
        summary: postSummary.trim() || undefined,
        content_md: postContentMd,
        tags: postTags,
        media_urls: postMedia,
        external_links: postLinks.filter((l) => l.label.trim() && l.url.trim()),
        collaborators: postCollaborators.trim() || null,
        originality_confirmed: originalityConfirmed,
        status: targetStatus,
      };

      const url = editingPostId
        ? `/api/clubs/${data.club.slug}/posts/${editingPostId}`
        : `/api/clubs/${data.club.slug}/posts`;
      const method = editingPostId ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message || '儲存貼文失敗。');
        return;
      }
      setNotice(targetStatus === 'published' ? '成果貼文已發布公開！' : '已儲存為草稿。');
      resetPostForm();
      router.refresh();
    } catch {
      setError('網路連線異常。');
    } finally {
      setPostBusy(false);
    }
  };

  const confirmSoftDeletePost = async () => {
    if (!deleteTargetPost) return;
    setPostBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/clubs/${data.club.slug}/posts/${deleteTargetPost.id}`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ confirm: true }),
        }
      );
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message || '下架失敗。');
        return;
      }
      setDeleteTargetPost(null);
      setNotice('已下架該篇貼文（保留歷屆稽核軌跡，必要時可聯繫管理員復原）。');
      router.refresh();
    } finally {
      setPostBusy(false);
    }
  };

  const createOpportunity = async (e: React.FormEvent) => {
    e.preventDefault();
    setOppBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/clubs/${data.club.slug}/opportunities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: oppTitle,
          summary: oppSummary,
          schedule_text: oppSchedule.trim() || null,
          deadline_at: oppDeadline ? new Date(`${oppDeadline}T23:59:59+08:00`).toISOString() : null,
          external_url: oppUrl,
          is_active: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message || '新增參與機會失敗。');
        return;
      }
      setOppTitle('');
      setOppSummary('');
      setOppSchedule('');
      setOppDeadline('');
      setOppUrl('');
      setNotice('已新增參與機會至社團公開主頁！');
      router.refresh();
    } finally {
      setOppBusy(false);
    }
  };

  const deleteOpportunity = async (id: string) => {
    setOppBusy(true);
    try {
      await fetch(`/api/clubs/${data.club.slug}/opportunities/${id}`, { method: 'DELETE' });
      router.refresh();
    } finally {
      setOppBusy(false);
    }
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/clubs/${data.club.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: clubCategory,
          tagline: clubTagline,
          description: clubDesc,
          avatar_url: clubAvatar[0]?.url ?? null,
          cover_url: clubCover[0]?.url ?? null,
          external_links: clubLinks.filter((l) => l.label.trim() && l.url.trim()),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message || '更新社團資料失敗。');
        return;
      }
      setNotice('社團基本資料與聯絡連結已更新！');
      router.refresh();
    } finally {
      setProfileBusy(false);
    }
  };

  const addMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setMemberBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/clubs/${data.club.slug}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_campus_email_or_id: newMemberEmail,
          role: 'editor',
          title: newMemberTitle,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message || '新增幹部失敗。');
        return;
      }
      setNewMemberEmail('');
      setNotice(`已指派 ${json.member.display_name} 為現任幹部。`);
      router.refresh();
    } finally {
      setMemberBusy(false);
    }
  };

  const removeMember = async (userId: string, archiveAsAlumni: boolean) => {
    setMemberBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/clubs/${data.club.slug}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, archive_as_alumni: archiveAsAlumni }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message || '移除幹部失敗。');
        return;
      }
      setNotice(archiveAsAlumni ? '已將幹部轉列為歷屆校友（保留只讀權）。' : '已移除幹部權限。');
      router.refresh();
    } finally {
      setMemberBusy(false);
    }
  };

  const initiateHandover = async (e: React.FormEvent) => {
    e.preventDefault();
    setMemberBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/clubs/${data.club.slug}/handovers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(handoverTargetId ? { to_user_id: handoverTargetId } : {}),
          ...(handoverEmail.trim() ? { to_campus_email: handoverEmail.trim() } : {}),
          note: handoverNote.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message || '發起換屆交接失敗。');
        return;
      }
      setHandoverNote('');
      setHandoverEmail('');
      setNotice('已發送社長交接邀請！對方於個人中心確認接受後，權限將自動完成交接。');
      router.refresh();
    } finally {
      setMemberBusy(false);
    }
  };

  const cancelHandover = async (handoverId: string) => {
    setMemberBusy(true);
    try {
      const res = await fetch(`/api/handovers/${handoverId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      });
      if (res.ok) {
        setNotice('已撤回社長交接邀請。');
        router.refresh();
      }
    } finally {
      setMemberBusy(false);
    }
  };

  const activeEditors = data.members.filter((m) => m.endedAt === null && m.role === 'editor');
  const summaryPosts = data.posts.filter(
    (p) => p.academicYear === summaryYear && p.status === 'published'
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="flex flex-col justify-between gap-4 rounded-3xl border border-[var(--border-strong)] bg-white p-5 shadow-xs sm:flex-row sm:items-center sm:p-6">
        <div>
          <p className="text-xs font-bold text-slate-500">
            {data.club.universityName} ｜{' '}
            {data.myRole === 'owner'
              ? '現任社長管理權限'
              : data.myRole === 'editor'
                ? '現任幹部編輯權限'
                : data.myRole === 'alumni'
                  ? '歷屆校友只讀權限'
                  : '平台管理員檢視'}
          </p>
          <h1 className="mt-1 text-2xl font-extrabold text-slate-900">
            {data.club.name} 管理後台
          </h1>
        </div>
        <Link
          href={`/clubs/${data.club.slug}`}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50"
        >
          <span>查看公開主頁</span>
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </section>

      {isSuspended && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-red-300 bg-red-50 p-4 text-xs text-red-950">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
          <span>
            此社團目前處於停權狀態，暫停新增與編輯貼文或參與機會；仍可檢視學年度成果彙整。
          </span>
        </div>
      )}

      {notice && (
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-900">
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-xs font-bold text-red-900">
          {error}
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2">
        {!isReadOnlyAlumni && data.myRole !== 'platform_admin' && (
          <>
            <button
              type="button"
              onClick={() => setTab('posts')}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold ${
                tab === 'posts'
                  ? 'bg-[var(--primary)] text-white'
                  : 'border border-[var(--border-strong)] bg-white text-slate-700'
              }`}
            >
              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              <span>成果貼文與快速整理</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('opportunities')}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold ${
                tab === 'opportunities'
                  ? 'bg-[var(--primary)] text-white'
                  : 'border border-[var(--border-strong)] bg-white text-slate-700'
              }`}
            >
              <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
              <span>參與機會招募</span>
            </button>
          </>
        )}
        {isOwner && (
          <>
            <button
              type="button"
              onClick={() => setTab('profile')}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold ${
                tab === 'profile'
                  ? 'bg-[var(--primary)] text-white'
                  : 'border border-[var(--border-strong)] bg-white text-slate-700'
              }`}
            >
              <Settings className="h-3.5 w-3.5" aria-hidden="true" />
              <span>基本資料與連結</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('members')}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold ${
                tab === 'members'
                  ? 'bg-[var(--primary)] text-white'
                  : 'border border-[var(--border-strong)] bg-white text-slate-700'
              }`}
            >
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              <span>幹部與雙向換屆</span>
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => setTab('summary')}
          className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold ${
            tab === 'summary'
              ? 'bg-[#2563EB] text-white'
              : 'border border-[var(--border-strong)] bg-white text-slate-700'
          }`}
        >
          <Printer className="h-3.5 w-3.5" aria-hidden="true" />
          <span>學年度成果總覽</span>
        </button>
      </div>

      {/* TAB 1: POSTS & AI QUICK DRAFT */}
      {tab === 'posts' && canEdit && (
        <div className="space-y-6">
          {/* AI Quick Organize Drawer */}
          <section className="rounded-3xl border border-orange-300 bg-gradient-to-r from-orange-50 to-white p-5 shadow-xs">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[var(--primary)]">
                  <Wand2 className="h-4 w-4" aria-hidden="true" />
                  <span>零散紀錄快速整理成貼文草稿（FR-MY-03）</span>
                </div>
                <p className="text-xs text-slate-600">
                  貼上活動企劃書、IG 舊貼文、筆記或上傳 PDF/TXT/MD（≤ 4 MB），AI 會產出可編輯草稿並填入表單，由您確認後再發布。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAiDrawerOpen((v) => !v)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[var(--primary)] px-4 py-2 text-xs font-bold text-white hover:bg-[var(--primary-hover)]"
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{aiDrawerOpen ? '收合整理工具' : '打開快速整理'}</span>
              </button>
            </div>

            {aiDrawerOpen && (
              <form onSubmit={runAiOrganize} className="mt-4 space-y-3 border-t border-orange-200 pt-4">
                <textarea
                  rows={5}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="直接貼上社團活動紀錄、會議摘要或宣傳文案（至少 20 字）..."
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <input
                    type="file"
                    accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
                    onChange={(e) => setRawFile(e.target.files?.[0] ?? null)}
                    className="text-xs text-slate-700"
                  />
                  <button
                    type="submit"
                    disabled={aiBusy}
                    className="rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {aiBusy ? 'AI 整理草稿中...' : '一鍵整理成草稿'}
                  </button>
                </div>
                {aiMsg && (
                  <p className="rounded-xl bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-950">
                    {aiMsg}
                  </p>
                )}
              </form>
            )}
          </section>

          {/* Post Form */}
          <section className="rounded-3xl border border-[var(--border-strong)] bg-white p-5 shadow-xs sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-slate-900">
                {editingPostId ? '編輯成果貼文' : '新增成果貼文'}
              </h2>
              {editingPostId && (
                <button
                  type="button"
                  onClick={resetPostForm}
                  className="text-xs font-semibold text-slate-600 underline"
                >
                  改為新增貼文
                </button>
              )}
            </div>

            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-bold text-slate-700">標題（必填）</label>
                  <input
                    type="text"
                    value={postTitle}
                    onChange={(e) => setPostTitle(e.target.value)}
                    placeholder="例如：115-1 期末暗房銀鹽攝影展回顧"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">分類（必填）</label>
                  <select
                    value={postType}
                    onChange={(e) => setPostType(e.target.value as PostType)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    {Object.entries(POST_TYPES).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">民國學年度</label>
                  <input
                    type="number"
                    min={100}
                    max={150}
                    value={postYear}
                    onChange={(e) => setPostYear(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  一句話摘要（選填，留白將自動由內文前 140 字擷取）
                </label>
                <input
                  type="text"
                  maxLength={200}
                  value={postSummary}
                  onChange={(e) => setPostSummary(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  成果正文（必填，支援 Markdown）
                </label>
                <textarea
                  rows={7}
                  value={postContentMd}
                  onChange={(e) => setPostContentMd(e.target.value)}
                  placeholder="記錄活動流程、作品亮點、學習收穫或社員心得..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  興趣與主題標籤（最多 8 個）
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {CURATED_INTEREST_TAGS.map((tag) => {
                    const active = postTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() =>
                          setPostTags((prev) =>
                            active
                              ? prev.filter((t) => t !== tag)
                              : prev.length < 8
                                ? [...prev, tag]
                                : prev
                          )
                        }
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          active
                            ? 'bg-[var(--primary)] text-white'
                            : 'bg-[var(--muted)] text-slate-700'
                        }`}
                      >
                        #{tag}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customTagInput}
                    onChange={(e) => setCustomTagInput(e.target.value)}
                    placeholder="自訂標籤（輸入後按新增）"
                    className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const clean = customTagInput.trim();
                      if (clean && !postTags.includes(clean) && postTags.length < 8) {
                        setPostTags([...postTags, clean]);
                        setCustomTagInput('');
                      }
                    }}
                    className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700"
                  >
                    新增標籤
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">合作單位（選填）</label>
                <input
                  type="text"
                  maxLength={200}
                  value={postCollaborators}
                  onChange={(e) => setPostCollaborators(e.target.value)}
                  placeholder="例如：臺科大攝影社、中大課外活動組"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700">
                  成果圖片（最多 6 張）
                </label>
                <ImageUploader
                  clubId={data.club.id}
                  value={postMedia}
                  onChange={setPostMedia}
                />
              </div>

              {/* External Links */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">
                    外部作品或影音連結（選填）
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setPostLinks((prev) =>
                        prev.length < 5 ? [...prev, { label: '', url: '' }] : prev
                      )
                    }
                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-700"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>新增連結</span>
                  </button>
                </div>
                {postLinks.map((link, idx) => (
                  <div key={idx} className="grid gap-2 sm:grid-cols-5">
                    <input
                      type="text"
                      placeholder="名稱（如 YouTube 影片）"
                      value={link.label}
                      onChange={(e) =>
                        setPostLinks((prev) =>
                          prev.map((l, i) => (i === idx ? { ...l, label: e.target.value } : l))
                        )
                      }
                      className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs sm:col-span-2"
                    />
                    <input
                      type="url"
                      placeholder="https://..."
                      value={link.url}
                      onChange={(e) =>
                        setPostLinks((prev) =>
                          prev.map((l, i) => (i === idx ? { ...l, url: e.target.value } : l))
                        )
                      }
                      className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs sm:col-span-2"
                    />
                    <button
                      type="button"
                      onClick={() => setPostLinks((prev) => prev.filter((_, i) => i !== idx))}
                      className="rounded-xl border border-slate-200 px-2 py-1.5 text-xs text-red-600"
                    >
                      移除
                    </button>
                  </div>
                ))}
              </div>

              <label className="flex items-start gap-2.5 rounded-2xl border border-slate-200 bg-[var(--muted)] p-3.5 text-xs text-slate-800">
                <input
                  type="checkbox"
                  checked={originalityConfirmed}
                  onChange={(e) => setOriginalityConfirmed(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  <strong>原創與素材授權確認（發布必勾）：</strong>
                  內容為社團原創或已取得合法授權使用，且不含未經同意揭露之非公開個人資料。
                </span>
              </label>

              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  disabled={postBusy}
                  onClick={() => void submitPost('draft')}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-800 hover:bg-slate-50"
                >
                  儲存草稿
                </button>
                <button
                  type="button"
                  disabled={postBusy}
                  onClick={() => void submitPost('published')}
                  className="rounded-xl bg-[var(--primary)] px-5 py-2.5 text-xs font-bold text-white hover:bg-[var(--primary-hover)] disabled:opacity-50"
                >
                  {postBusy ? '處理中...' : '確認發布公開'}
                </button>
              </div>
            </div>
          </section>

          {/* Existing Posts List */}
          <section className="rounded-3xl border border-[var(--border)] bg-white p-5 shadow-xs sm:p-6">
            <h2 className="mb-4 text-base font-extrabold text-slate-900">
              社團歷來貼文管理（共 {data.posts.length} 篇）
            </h2>
            <div className="space-y-3">
              {data.posts.map((p) => {
                const canDelete =
                  isOwner || (p.status === 'draft' && p.authorUserId === data.myUserId);
                return (
                  <div
                    key={p.id}
                    className="flex flex-col justify-between gap-3 rounded-2xl border border-[var(--border)] p-4 sm:flex-row sm:items-center"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span
                          className={`rounded-full px-2.5 py-0.5 font-bold ${
                            p.status === 'published'
                              ? 'bg-emerald-100 text-emerald-900'
                              : p.status === 'draft'
                                ? 'bg-slate-200 text-slate-800'
                                : 'bg-red-100 text-red-900'
                          }`}
                        >
                          {p.status === 'published'
                            ? '已發布'
                            : p.status === 'draft'
                              ? '草稿'
                              : p.status === 'hidden_by_owner'
                                ? '社長已下架'
                                : '管理員下架'}
                        </span>
                        <span className="font-semibold text-slate-600">
                          {p.academicYear} 學年 · {POST_TYPES[p.postType].label}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-slate-900">{p.title}</p>
                      <p className="text-xs text-slate-500">
                        更新於 {formatTaipeiDateTime(p.updatedAt)}
                      </p>
                    </div>

                    <div className="flex shrink-0 gap-2">
                      {p.status === 'published' && (
                        <Link
                          href={`/posts/${p.id}`}
                          className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
                        >
                          查看
                        </Link>
                      )}
                      {p.status !== 'removed_by_admin' && (
                        <button
                          type="button"
                          onClick={() => loadPostIntoForm(p)}
                          className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-orange-50"
                        >
                          編輯
                        </button>
                      )}
                      {canDelete && p.status !== 'hidden_by_owner' && p.status !== 'removed_by_admin' && (
                        <button
                          type="button"
                          onClick={() => setDeleteTargetPost({ id: p.id, title: p.title })}
                          className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>下架</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* TAB 2: OPPORTUNITIES */}
      {tab === 'opportunities' && canEdit && (
        <div className="space-y-6">
          <form
            onSubmit={createOpportunity}
            className="space-y-4 rounded-3xl border border-[var(--border-strong)] bg-white p-5 shadow-xs sm:p-6"
          >
            <h2 className="text-lg font-extrabold text-slate-900">新增近期參與機會／體驗招募</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                type="text"
                required
                placeholder="標題（如：秋季底片暗房體驗社課旁聽）"
                value={oppTitle}
                onChange={(e) => setOppTitle(e.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="text"
                placeholder="時間／地點（如：每週三 19:00 志希館）"
                value={oppSchedule}
                onChange={(e) => setOppSchedule(e.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <input
              type="text"
              required
              maxLength={160}
              placeholder="一句話說明（≤ 160 字）"
              value={oppSummary}
              onChange={(e) => setOppSummary(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                type="url"
                required
                placeholder="外部報名表單或聯絡連結（https:// 或 mailto:）"
                value={oppUrl}
                onChange={(e) => setOppUrl(e.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="date"
                value={oppDeadline}
                onChange={(e) => setOppDeadline(e.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={oppBusy}
              className="rounded-xl bg-[var(--primary)] px-5 py-2 text-xs font-bold text-white hover:bg-[var(--primary-hover)]"
            >
              新增參與機會
            </button>
          </form>

          <section className="rounded-3xl border border-[var(--border)] bg-white p-5 shadow-xs">
            <h3 className="mb-3 text-base font-extrabold text-slate-900">目前參與機會項目</h3>
            {data.opportunities.length === 0 ? (
              <p className="text-xs text-slate-500">尚未建立任何參與機會（公開主頁將自動收合此區塊）。</p>
            ) : (
              <div className="space-y-3">
                {data.opportunities.map((o) => (
                  <div
                    key={o.id}
                    className="flex flex-col justify-between gap-2 rounded-2xl border border-[var(--border)] p-4 sm:flex-row sm:items-center"
                  >
                    <div>
                      <p className="text-sm font-bold text-slate-900">{o.title}</p>
                      <p className="text-xs text-slate-600">{o.summary}</p>
                    </div>
                    <button
                      type="button"
                      disabled={oppBusy}
                      onClick={() => void deleteOpportunity(o.id)}
                      className="shrink-0 rounded-xl border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50"
                    >
                      刪除
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 3: CLUB PROFILE */}
      {tab === 'profile' && isOwner && (
        <form
          onSubmit={saveProfile}
          className="space-y-4 rounded-3xl border border-[var(--border-strong)] bg-white p-5 shadow-xs sm:p-6"
        >
          <h2 className="text-lg font-extrabold text-slate-900">編輯社團公開資料與聯絡管道</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">社團分類</label>
              <select
                value={clubCategory}
                onChange={(e) => setClubCategory(e.target.value as ClubCategory)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {CLUB_CATEGORY_LIST.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">
                一句話簡介（≤ 120 字）
              </label>
              <input
                type="text"
                maxLength={120}
                value={clubTagline}
                onChange={(e) => setClubTagline(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">社團詳細介紹</label>
            <textarea
              rows={5}
              value={clubDesc}
              onChange={(e) => setClubDesc(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700">
                社團頭像（選填）
              </label>
              <ImageUploader
                clubId={data.club.id}
                value={clubAvatar}
                onChange={setClubAvatar}
                maxImages={1}
                purpose="club_avatar"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700">
                公開主頁封面圖（選填）
              </label>
              <ImageUploader
                clubId={data.club.id}
                value={clubCover}
                onChange={setClubCover}
                maxImages={1}
                purpose="club_cover"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700">
                公開外部聯絡與社群連結（IG / FB / Email / 表單）
              </label>
              <button
                type="button"
                onClick={() =>
                  setClubLinks((prev) => [...prev, { type: 'website', label: '', url: '' }])
                }
                className="text-xs font-bold text-blue-700"
              >
                + 新增連結
              </button>
            </div>
            {clubLinks.map((l, idx) => (
              <div key={idx} className="grid gap-2 sm:grid-cols-5">
                <input
                  type="text"
                  placeholder="標籤（如 Instagram）"
                  value={l.label}
                  onChange={(e) =>
                    setClubLinks((prev) =>
                      prev.map((item, i) => (i === idx ? { ...item, label: e.target.value } : item))
                    )
                  }
                  className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs sm:col-span-2"
                />
                <input
                  type="url"
                  placeholder="https://... 或 mailto:..."
                  value={l.url}
                  onChange={(e) =>
                    setClubLinks((prev) =>
                      prev.map((item, i) => (i === idx ? { ...item, url: e.target.value } : item))
                    )
                  }
                  className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs sm:col-span-2"
                />
                <button
                  type="button"
                  onClick={() => setClubLinks((prev) => prev.filter((_, i) => i !== idx))}
                  className="rounded-xl border border-slate-200 px-2 py-1.5 text-xs text-red-600"
                >
                  移除
                </button>
              </div>
            ))}
          </div>

          <button
            type="submit"
            disabled={profileBusy}
            className="rounded-xl bg-[var(--primary)] px-5 py-2.5 text-xs font-bold text-white hover:bg-[var(--primary-hover)]"
          >
            {profileBusy ? '儲存中...' : '儲存社團資料'}
          </button>
        </form>
      )}

      {/* TAB 4: MEMBERS & HANDOVER */}
      {tab === 'members' && isOwner && (
        <div className="space-y-6">
          <section className="rounded-3xl border border-[var(--border-strong)] bg-white p-5 shadow-xs sm:p-6">
            <h2 className="mb-3 text-lg font-extrabold text-slate-900">指派幹部（Editor）</h2>
            <form onSubmit={addMember} className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                required
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
                placeholder="輸入已完成 .edu.tw 驗證之幹部校園信箱"
                className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="text"
                value={newMemberTitle}
                onChange={(e) => setNewMemberTitle(e.target.value)}
                placeholder="職稱（如 活動長）"
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm sm:w-36"
              />
              <button
                type="submit"
                disabled={memberBusy}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--primary)] px-4 py-2 text-xs font-bold text-white hover:bg-[var(--primary-hover)]"
              >
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                <span>新增幹部</span>
              </button>
            </form>

            <div className="mt-5 space-y-2.5">
              {data.members.map((m) => (
                <div
                  key={`${m.userId}-${m.role}-${m.joinedAt}`}
                  className="flex flex-col justify-between gap-2 rounded-2xl border border-[var(--border)] p-3.5 sm:flex-row sm:items-center"
                >
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      {m.displayName}{' '}
                      <span className="text-xs font-semibold text-slate-600">
                        （
                        {m.role === 'owner'
                          ? '現任社長'
                          : m.role === 'editor'
                            ? '現任幹部'
                            : '歷屆校友'}
                        {m.title ? ` · ${m.title}` : ''}）
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-500">
                      加入：{formatTaipeiDate(m.joinedAt)}
                      {m.endedAt ? ` ｜ 卸任：${formatTaipeiDate(m.endedAt)}` : ''}
                    </p>
                  </div>
                  {m.endedAt === null && m.role === 'editor' && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={memberBusy}
                        onClick={() => void removeMember(m.userId, true)}
                        className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        卸任轉為歷屆校友
                      </button>
                      <button
                        type="button"
                        disabled={memberBusy}
                        onClick={() => void removeMember(m.userId, false)}
                        className="rounded-xl border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                      >
                        移除
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Handover Section */}
          <section className="rounded-3xl border border-orange-300 bg-orange-50/60 p-5 shadow-xs sm:p-6">
            <h2 className="text-lg font-extrabold text-slate-900">雙向確認換屆交接（FR-MY-05）</h2>
            <p className="mt-1 text-xs text-slate-600">
              發起移交後，對方須於 7 天內在個人中心確認接受；完成後新社長即刻接手，您將轉為歷屆校友（保留只讀成果彙整權限），社團貼文完整保留不中斷。
            </p>

            {data.pendingHandover ? (
              <div className="mt-4 flex flex-col justify-between gap-3 rounded-2xl border border-orange-200 bg-white p-4 sm:flex-row sm:items-center">
                <div className="text-xs">
                  <p className="text-sm font-bold text-slate-900">
                    等待「{data.pendingHandover.toUserName}」確認接受交接
                  </p>
                  <p className="mt-0.5 text-slate-500">
                    有效期限：{formatTaipeiDateTime(data.pendingHandover.expiresAt)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={memberBusy}
                  onClick={() => void cancelHandover(data.pendingHandover!.id)}
                  className="rounded-xl border border-red-300 bg-white px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-50"
                >
                  撤回交接邀請
                </button>
              </div>
            ) : (
              <form onSubmit={initiateHandover} className="mt-4 space-y-3 rounded-2xl bg-white p-4">
                {activeEditors.length > 0 && (
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">
                      從現任幹部選擇接任社長
                    </label>
                    <select
                      value={handoverTargetId}
                      onChange={(e) => setHandoverTargetId(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                    >
                      <option value="">— 改用下方校園信箱指定其他驗證學生 —</option>
                      {activeEditors.map((ed) => (
                        <option key={ed.userId} value={ed.userId}>
                          {ed.displayName} {ed.title ? `(${ed.title})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {!handoverTargetId && (
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">
                      或輸入接任者 `.edu.tw` 校園信箱
                    </label>
                    <input
                      type="email"
                      required={!handoverTargetId}
                      value={handoverEmail}
                      onChange={(e) => setHandoverEmail(e.target.value)}
                      placeholder="new-president@ncu.edu.tw"
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">
                    交接備註（選填）
                  </label>
                  <input
                    type="text"
                    maxLength={400}
                    value={handoverNote}
                    onChange={(e) => setHandoverNote(e.target.value)}
                    placeholder="例如：116 學年度社長權限移交"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <button
                  type="submit"
                  disabled={memberBusy}
                  className="rounded-xl bg-[var(--primary)] px-5 py-2 text-xs font-bold text-white hover:bg-[var(--primary-hover)]"
                >
                  發起社長權限移交邀請
                </button>
              </form>
            )}
          </section>
        </div>
      )}

      {/* TAB 5: ACADEMIC YEAR SUMMARY */}
      {tab === 'summary' && (
        <section className="space-y-4 rounded-3xl border border-[var(--border-strong)] bg-white p-5 shadow-xs sm:p-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-extrabold text-slate-900">學年度成果總覽</h2>
              <select
                value={summaryYear}
                onChange={(e) => setSummaryYear(Number(e.target.value))}
                className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold"
              >
                {availableYears.map((y) => (
                  <option key={y} value={y}>
                    {y} 學年度
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap gap-2">
              <a
                href={`/api/clubs/${data.club.slug}/summary/${summaryYear}/export?format=md`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span>下載 Markdown</span>
              </a>
              <Link
                href={`/clubs/${data.club.slug}/summary/${summaryYear}/print`}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
              >
                <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                <span>開啟列印／另存 PDF 報告</span>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="rounded-2xl bg-[var(--muted)] p-3 text-center">
              <p className="text-xs text-slate-600">總公開貼文</p>
              <p className="mt-1 text-xl font-extrabold text-slate-900">{summaryPosts.length}</p>
            </div>
            {Object.entries(POST_TYPES).map(([k, m]) => (
              <div key={k} className="rounded-2xl border border-[var(--border)] p-3 text-center">
                <p className="text-xs text-slate-600">{m.label}</p>
                <p className="mt-1 text-xl font-extrabold text-slate-900">
                  {summaryPosts.filter((p) => p.postType === k).length}
                </p>
              </div>
            ))}
          </div>

          <div className="space-y-2.5">
            {summaryPosts.length === 0 ? (
              <p className="text-xs text-slate-500">此學年度尚無已發布成果貼文。</p>
            ) : (
              summaryPosts.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-2xl border border-[var(--border)] p-3.5"
                >
                  <div>
                    <span className="text-xs font-bold text-[var(--primary)]">
                      {POST_TYPES[p.postType].label}
                    </span>
                    <Link
                      href={`/posts/${p.id}`}
                      className="ml-2 text-sm font-bold text-slate-900 hover:underline"
                    >
                      {p.title}
                    </Link>
                    <p className="mt-0.5 text-xs text-slate-600">{p.summary}</p>
                  </div>
                  <span className="shrink-0 text-xs text-slate-500">
                    {formatTaipeiDate(p.publishedAt)}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {/* 2-Step Soft Delete Confirmation Modal */}
      {deleteTargetPost && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-extrabold text-slate-900">確認下架這篇社團成果？</h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              即將下架「<strong>{deleteTargetPost.title}</strong>
              」。為保護社團跨屆歷史資產，貼文不會從資料庫永久抹除，必要時可聯繫平台管理員協助復原。
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTargetPost(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700"
              >
                取消
              </button>
              <button
                type="button"
                disabled={postBusy}
                onClick={() => void confirmSoftDeletePost()}
                className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700"
              >
                確認下架
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
