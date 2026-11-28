'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Archive,
  ArrowRightLeft,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  Download,
  FileText,
  Film,
  HelpCircle,
  KeyRound,
  Megaphone,
  Pin,
  Printer,
  Sparkles,
  Upload,
  Users,
} from 'lucide-react';
import type {
  ArchiveFileCategory,
  ClubCategory,
  ClubMemberRole,
  LearningHoursCategory,
  MediaItem,
  PostKind,
  PostStatus,
} from '@/db/schema';
import { formatTaipeiDate } from '@/lib/academic-year';
import { shouldRouteDraftToEvent } from '@/lib/validators';
import { uploadShortVideo } from '@/lib/media/client-upload';
import { POST_KIND_LABELS } from '@/lib/constants';
import { ImageUploader } from '@/components/ImageUploader';
import { PublishPanel } from '@/components/publish/PublishPanel';
import { startFlow } from '@/lib/flow';

import {
  Badge,
  Button,
  ButtonLink,
  Card,
  Dialog,
  Field,
  Input,
  Notice,
  PageHeader,
  Tabs,
  buttonClasses,
  controlClasses,
  useConfirm,
} from '@/components/ui';
export interface ManageClubData {
  club: {
    id: string;
    slug: string;
    name: string;
    category: ClubCategory;
    tagline: string;
    description: string;
    verificationStatus: string;
    universityName: string;
  };
  myRole: ClubMemberRole | 'platform_admin';
  posts: {
    id: string;
    postKind: PostKind;
    headline: string;
    status: PostStatus;
    includeInEvaluation: boolean;
    pinnedAt: string | null;
    publishedAt: string | null;
  }[];
  events: {
    id: string;
    shortCode: string;
    title: string;
    scheduleMode: string;
    startsAt: string | null;
    status: string;
    includeInEvaluation: boolean;
  }[];
  members: {
    userId: string;
    displayName: string;
    role: ClubMemberRole;
    title: string | null;
    endedAt: string | null;
  }[];
  pendingHandover: {
    id: string;
    toUserName: string;
    expiresAt: string;
  } | null;
  handoverNotes: {
    id: string;
    venueTips: string;
    hoursAndDeadlines: string;
    contactsAndVendors: string;
    createdAt: string;
  }[];
}

interface VisionDraftState {
  degraded: boolean;
  warnings: string[];
  draft: {
    title: string;
    summary: string;
    content_md: string;
    post_kind: 'nrc_moment' | 'wip_work';
    extracted_event: {
      starts_at_hint?: string | null;
      location_text?: string | null;
      fee_ntd?: number | null;
      beginner_friendly?: boolean | null;
      non_members_welcome?: boolean | null;
      learning_hours_hint?: string | null;
    };
    missing_beginner_fields: string[];
    poster_text_heavy: boolean;
  };
}

const ROLE_LABEL: Record<string, string> = {
  owner: '社長',
  editor: '幹部',
  member: '認證社員',
  alumni: '歷屆校友',
  platform_admin: '平台管理員',
};
const SCHEDULE_MODE_LABEL: Record<string, string> = {
  scheduled: '已定時間',
  tbd: '時間待定',
  voting: '投票喬時間中',
};
const JOIN_STATUS_LABEL: Record<string, string> = {
  pending: '待審',
  approved: '已核准',
  rejected: '已婉拒',
};
const QUESTION_STATUS_LABEL: Record<string, string> = {
  pending_reply: '待回覆',
  answered_private: '已私下回覆',
  published: '已公開',
  hidden: '已隱藏',
};
const ARCHIVE_CATEGORY_LABEL: Record<string, string> = {
  meeting_minutes: '會議記錄',
  finance_ledger: '經費收支核銷',
  equipment_inventory: '財產器材清冊',
  evaluation_evidence: '評鑑佐證文件',
  other: '其他密件',
};
const MANAGE_TABS = ['events', 'posts', 'members', 'questions', 'evaluation', 'handover'] as const;
type ManageTab = (typeof MANAGE_TABS)[number];

const EVENT_STATUS_LABEL: Record<string, string> = {
  draft: '草稿',
  open: '開放報名',
  completed: '已結束',
  cancelled: '已取消',
};

export function ClubManageClient({ data }: { data: ManageClubData }) {
  const confirm = useConfirm();
  const isReadOnlyAlumni = data.myRole === 'alumni';
  const canWrite = !isReadOnlyAlumni;
  const isOwner = data.myRole === 'owner';
  const isOfficer = isOwner || data.myRole === 'editor';

  const [tab, setTab] = useState<ManageTab>(isReadOnlyAlumni ? 'evaluation' : 'events');

  const [bannerMsg, setBannerMsg] = useState<string | null>(null);
  const [bannerErr, setBannerErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Events state
  const [eventsList, setEventsList] = useState(data.events);

  // Publish center (docs/one-stop-publish-solution.md phase 1)
  type PublishTarget = { id: string; shortCode: string; title: string };
  const [justCreated, setJustCreated] = useState<PublishTarget | null>(null);
  const [publishTarget, setPublishTarget] = useState<PublishTarget | null>(null);
  const [discordConfigured, setDiscordConfigured] = useState(false);
  const [webhookInput, setWebhookInput] = useState('');
  const [webhookEditing, setWebhookEditing] = useState(false);
  const [webhookError, setWebhookError] = useState<string | null>(null);
  const [bioLinkCopied, setBioLinkCopied] = useState(false);
  const [origin, setOrigin] = useState(process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, '') ?? '');
  const latestPublishable = eventsList.find((ev) => ev.status !== 'cancelled') ?? null;
  const bioLink = `${origin}/clubs/${data.club.slug}`;

  useEffect(() => {
    if (!origin) setOrigin(window.location.origin);
    // Deep links: ?tab=<tab> picks a tab; ?new=event opens the create-event form with focus.
    const params = new URLSearchParams(window.location.search);
    const wantedTab = params.get('tab');
    if (canWrite && params.get('new') === 'event') {
      openCreateEvent();
    } else if (canWrite && wantedTab && MANAGE_TABS.includes(wantedTab as ManageTab) && wantedTab !== tab) {
      void switchTab(wantedTab as ManageTab);
    }
    if (!isOfficer) return;
    fetch(`/api/clubs/${data.club.slug}/publish-channels`)
      .then((res) => (res.ok ? res.json() : null))
      .then((j) => j && setDiscordConfigured(Boolean(j.discord_configured)))
      .catch(() => {});
    // Deep link: /clubs/<slug>/manage?publish=<shortCode> opens the publish panel directly.
    const code = new URLSearchParams(window.location.search).get('publish');
    const target = code ? data.events.find((ev) => ev.shortCode === code) : null;
    if (target) setPublishTarget({ id: target.id, shortCode: target.shortCode, title: target.title });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openPublishSettings() {
    setPublishTarget(null);
    setTab('events');
    setTimeout(() => document.getElementById('publish-channels')?.scrollIntoView({ behavior: 'smooth' }), 50);
  }

  async function handleSaveWebhook(e: React.FormEvent) {
    e.preventDefault();
    setBusy('webhook');
    setWebhookError(null);
    try {
      const res = await fetch(`/api/clubs/${data.club.slug}/publish-channels`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discord_webhook_url: webhookInput.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || '保存失敗');
      setDiscordConfigured(true);
      setWebhookInput('');
      setWebhookEditing(false);
    } catch (err) {
      setWebhookError(err instanceof Error ? err.message : '保存失敗');
    } finally {
      setBusy(null);
    }
  }

  async function handleRemoveWebhook() {
    const ok = await confirm({
      title: '移除 Discord 頻道？',
      description: '之後要發到 Discord，得重新到頻道設定複製一次 Webhook 網址貼上。',
      confirmLabel: '移除頻道',
    });
    if (!ok) return;
    setBusy('webhook');
    setWebhookError(null);
    try {
      const res = await fetch(`/api/clubs/${data.club.slug}/publish-channels`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || '移除失敗');
      setDiscordConfigured(false);
    } catch (err) {
      setWebhookError(err instanceof Error ? err.message : '移除失敗');
    } finally {
      setBusy(null);
    }
  }
  // D-12: the 4-section create form starts collapsed once the club has events.
  const [eventFormOpen, setEventFormOpen] = useState(data.events.length === 0);
  // U-11: AI only drafts. After an AI fill the officer must confirm time and place before publishing.
  const [aiFilledEvent, setAiFilledEvent] = useState(false);
  const [aiFieldsConfirmed, setAiFieldsConfirmed] = useState(false);
  const [evTitle, setEvTitle] = useState('');
  const [evSummary, setEvSummary] = useState('');
  const [evDesc, setEvDesc] = useState('');
  const [evTheme, setEvTheme] = useState<
    'warm_paper' | 'campus_blue' | 'forest_trail' | 'midnight_jam'
  >('warm_paper');
  const [evMode, setEvMode] = useState<'scheduled' | 'tbd' | 'voting'>('scheduled');
  const [evStart, setEvStart] = useState('');
  const [evEnd, setEvEnd] = useState('');
  const [evLocation, setEvLocation] = useState('');
  const [evHideLocation, setEvHideLocation] = useState(false);
  const [evFee, setEvFee] = useState('0');
  const [evBeginner, setEvBeginner] = useState(true);
  const [evNonMember, setEvNonMember] = useState(true);
  const [evCampusOnly, setEvCampusOnly] = useState(false);
  const [evHoursCat, setEvHoursCat] = useState<LearningHoursCategory>('none');
  const [evHoursCount, setEvHoursCount] = useState('0');
  const [evPreNotes, setEvPreNotes] = useState('');
  const [evExtUrl, setEvExtUrl] = useState('');
  const [evIncludeEval, setEvIncludeEval] = useState(true);
  const [evCover, setEvCover] = useState<MediaItem[]>([]);
  const [pollLabels, setPollLabels] = useState(['週三 19:00 體驗場', '週五 19:00 體驗場', '']);

  // Posts + Vision AI state
  const [postsList, setPostsList] = useState(data.posts);
  const pinnedCount = postsList.filter((p) => p.pinnedAt).length;

  // U-05: pin up to 4 representative works to the top of the public club page.
  async function handleTogglePin(postId: string, pinned: boolean) {
    setBannerErr(null);
    setBusy(`pin-${postId}`);
    try {
      const res = await fetch(`/api/clubs/${data.club.slug}/posts/${postId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinned }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || '更新代表作失敗');
      setPostsList((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, pinnedAt: pinned ? new Date().toISOString() : null } : p))
      );
    } catch (err) {
      setBannerErr(err instanceof Error ? err.message : '更新代表作失敗');
    } finally {
      setBusy(null);
    }
  }
  const [aiRawText, setAiRawText] = useState('');
  const [evAiRawText, setEvAiRawText] = useState('');
  const [aiResult, setAiResult] = useState<VisionDraftState | null>(null);
  const [postKind, setPostKind] = useState<'nrc_moment' | 'wip_work'>('wip_work');
  const [postHeadline, setPostHeadline] = useState('');
  const [postContentMd, setPostContentMd] = useState('');
  const [postMedia, setPostMedia] = useState<MediaItem[]>([]);
  const [postOrig, setPostOrig] = useState(false);
  const [postEval, setPostEval] = useState(false);

  // Members, Invites, Requests
  const [inviteCodes, setInviteCodes] = useState<
    { id: string; code: string; expires_at: string; used_count: number; max_uses: number | null }[]
  >([]);
  const [joinRequests, setJoinRequests] = useState<
    { id: string; display_name: string; note: string | null; status: string; created_at: string }[]
  >([]);
  const [targetMemberEmail, setTargetMemberEmail] = useState('');
  const [targetMemberRole, setTargetMemberRole] = useState<'editor' | 'member'>('member');
  const [targetMemberTitle, setTargetMemberTitle] = useState('');

  // Q&A Inbox
  const [questionsInbox, setQuestionsInbox] = useState<
    {
      id: string;
      display_asker: string;
      question_text: string;
      answer_text: string | null;
      status: string;
      is_pinned_faq: boolean;
    }[]
  >([]);
  const [replyDrafts, setReplyDrafts] = useState<
    Record<string, { text: string; pub: boolean; pin: boolean; highlight: boolean }>
  >({});

  // Private Eval Archive
  const [archiveFiles, setArchiveFiles] = useState<
    {
      id: string;
      archive_category: ArchiveFileCategory;
      title: string;
      occurred_on: string;
      mime_type: string;
      size_bytes: number;
    }[]
  >([]);
  const [archTitle, setArchTitle] = useState('');
  const [archCategory, setArchCategory] = useState<ArchiveFileCategory>('meeting_minutes');
  const [archDate, setArchDate] = useState(new Date().toISOString().slice(0, 10));

  // Handover
  const [handoverEmail, setHandoverEmail] = useState('');
  const [venueTips, setVenueTips] = useState('');
  const [hoursDeadlines, setHoursDeadlines] = useState('');
  const [contactsVendors, setContactsVendors] = useState('');
  const [shareDeid, setShareDeid] = useState(false);

  async function switchTab(next: typeof tab) {
    setTab(next);
    setBannerErr(null);
    setBannerMsg(null);
    if (next === 'members') {
      const [codesRes, reqRes] = await Promise.all([
        fetch(`/api/clubs/${data.club.slug}/invite-code`),
        fetch(`/api/clubs/${data.club.slug}/member-requests`),
      ]);
      if (codesRes.ok) {
        const j = await codesRes.json();
        setInviteCodes(j.invite_codes ?? []);
      }
      if (reqRes.ok) {
        const j = await reqRes.json();
        setJoinRequests(j.requests ?? []);
      }
    } else if (next === 'questions') {
      const res = await fetch(`/api/clubs/${data.club.slug}/questions?scope=inbox`);
      if (res.ok) {
        const j = await res.json();
        const inbox = j.inbox ?? [];
        setQuestionsInbox(inbox);
        const init: typeof replyDrafts = {};
        for (const q of inbox) {
          init[q.id] = {
            text: q.answer_text ?? '',
            pub: true,
            pin: q.is_pinned_faq,
            highlight: false,
          };
        }
        setReplyDrafts(init);
      }
    } else if (next === 'evaluation') {
      const res = await fetch(`/api/clubs/${data.club.slug}/archive-files`);
      if (res.ok) {
        const j = await res.json();
        setArchiveFiles(j.files ?? []);
      }
    }
  }

  async function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault();
    setBusy('create-event');
    setBannerErr(null);
    setBannerMsg(null);
    try {
      const cover = evCover[0];
      const payload = {
        title: evTitle.trim(),
        summary: evSummary.trim(),
        description_md: evDesc.trim(),
        theme_preset: evTheme,
        cover_media: cover
          ? {
              url: cover.url,
              width: cover.width ?? 1280,
              height: cover.height ?? 720,
              alt: cover.alt ?? evTitle.trim(),
            }
          : null,
        schedule_mode: evMode,
        starts_at: evMode === 'scheduled' && evStart ? new Date(evStart).toISOString() : null,
        ends_at: evMode === 'scheduled' && evEnd ? new Date(evEnd).toISOString() : null,
        location_text: evLocation.trim() || '地點待定',
        share_hide_location: evHideLocation,
        beginner_friendly: evBeginner,
        non_members_welcome: evNonMember,
        campus_only: evCampusOnly,
        fee_ntd: Math.max(0, Number(evFee) || 0),
        learning_hours_category: evHoursCat,
        learning_hours_count: Math.max(0, Number(evHoursCount) || 0),
        pre_event_notes: evPreNotes.trim() || null,
        external_registration_url: evExtUrl.trim() || null,
        include_in_evaluation: evIncludeEval,
        poll_options:
          evMode === 'voting'
            ? pollLabels
                .map((l) => l.trim())
                .filter(Boolean)
                .map((label) => ({ option_type: 'topic' as const, label }))
            : undefined,
      };
      const res = await fetch(`/api/clubs/${data.club.slug}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || '建立活動失敗');
      setEventsList((prev) => [
        {
          id: json.event.id,
          shortCode: json.event.short_code,
          title: json.event.title,
          scheduleMode: evMode,
          startsAt: payload.starts_at,
          status: json.event.status,
          includeInEvaluation: evIncludeEval,
        },
        ...prev,
      ]);
      setEvTitle('');
      setEvSummary('');
      setEvDesc('');
      setEvCover([]);
      setAiFilledEvent(false);
      setAiFieldsConfirmed(false);
      setJustCreated({ id: json.event.id, shortCode: json.event.short_code, title: json.event.title });
      setEventFormOpen(false);
    } catch (err) {
      setBannerErr(err instanceof Error ? err.message : '建立活動失敗');
    } finally {
      setBusy(null);
    }
  }

  // Opens the create-event form on the events tab and focuses its first field.
  function openCreateEvent() {
    setTab('events');
    setEventFormOpen(true);
    startFlow('officer_publish', 'create_form');
    setTimeout(() => {
      const title = document.getElementById('club-manage-evtitle');
      title?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      title?.focus({ preventScroll: true });
    }, 50);
  }

  // target 'event' (events-tab entry) fills the event form directly; 'post' shows the posts-tab result card.
  async function handleAiDraftSubmit(file: File | null, target: 'post' | 'event' = 'post') {
    const rawText = target === 'event' ? evAiRawText : aiRawText;
    if (target === 'event') startFlow('officer_publish', 'create_form');
    setBusy(target === 'event' ? 'ai-draft-event' : 'ai-draft');
    setBannerErr(null);
    setBannerMsg(null);
    try {
      const fd = new FormData();
      fd.append('club_id', data.club.id);
      if (rawText.trim()) fd.append('raw_text', rawText.trim());
      if (file) fd.append('file', file);

      const res = await fetch('/api/ai/draft-from-raw', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || 'AI 解析失敗');
      if (target === 'event') applyAiToEvent(json);
      else setAiResult(json);
    } catch (err) {
      setBannerErr(err instanceof Error ? err.message : 'AI 解析失敗');
    } finally {
      setBusy(null);
    }
  }

  function applyAiToPost() {
    if (!aiResult) return;
    setPostHeadline(aiResult.draft.title.slice(0, 120));
    setPostContentMd(aiResult.draft.content_md);
    setPostKind(aiResult.draft.post_kind);
    setBannerMsg('已帶入上方貼文表單，上傳圖片與確認原創後即可發布。');
  }

  function applyAiToEvent(result: VisionDraftState | null = aiResult) {
    if (!result) return;
    const d = result.draft;
    setEvTitle(d.title.slice(0, 80));
    setEvSummary(d.summary.slice(0, 160));
    setEvDesc(d.content_md);
    if (d.extracted_event.location_text) setEvLocation(d.extracted_event.location_text);
    if (typeof d.extracted_event.fee_ntd === 'number') {
      setEvFee(String(d.extracted_event.fee_ntd));
    }
    if (typeof d.extracted_event.beginner_friendly === 'boolean') {
      setEvBeginner(d.extracted_event.beginner_friendly);
    }
    if (typeof d.extracted_event.non_members_welcome === 'boolean') {
      setEvNonMember(d.extracted_event.non_members_welcome);
    }
    if (!d.extracted_event.starts_at_hint) setEvMode('tbd');
    openCreateEvent();
    setAiFilledEvent(true);
    setAiFieldsConfirmed(false);
    setBannerMsg('已將海報／文案解析欄位帶入活動建立表單，請補齊正確時間後送出！');
  }

  async function handlePublishPost(e: React.FormEvent) {
    e.preventDefault();
    setBusy('post');
    setBannerErr(null);
    setBannerMsg(null);
    try {
      const res = await fetch(`/api/clubs/${data.club.slug}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post_kind: postKind,
          headline: postHeadline.trim(),
          content_md: postContentMd.trim(),
          media_items: postMedia,
          originality_confirmed: postOrig,
          include_in_evaluation: postEval,
          status: 'published',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || '發布失敗');
      setPostsList((prev) => [
        {
          id: json.post.id,
          postKind: json.post.post_kind,
          headline: json.post.headline,
          status: 'published',
          includeInEvaluation: postEval,
          pinnedAt: null,
          publishedAt: json.post.published_at,
        },
        ...prev,
      ]);
      setPostHeadline('');
      setPostContentMd('');
      setPostMedia([]);
      setPostOrig(false);
      setBannerMsg('內容已發布！');
    } catch (err) {
      setBannerErr(err instanceof Error ? err.message : '發布失敗');
    } finally {
      setBusy(null);
    }
  }

  async function handleVideoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy('video');
    setBannerErr(null);
    try {
      const item = await uploadShortVideo(data.club.id, file);
      setPostMedia((prev) => [...prev, item].slice(0, 6));
    } catch (err) {
      setBannerErr(err instanceof Error ? err.message : '短影上傳失敗');
    } finally {
      setBusy(null);
    }
  }

  async function handleGenerateInviteCode() {
    setBusy('invite-code');
    setBannerErr(null);
    try {
      const res = await fetch(`/api/clubs/${data.club.slug}/invite-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expires_in_days: 7, max_uses: 50 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || '產生邀請碼失敗');
      setInviteCodes((prev) => [
        { ...json.invite_code, used_count: 0, max_uses: 50 },
        ...prev,
      ]);
      setBannerMsg(`新邀請碼已產生：${json.invite_code.code}`);
    } catch (err) {
      setBannerErr(err instanceof Error ? err.message : '失敗');
    } finally {
      setBusy(null);
    }
  }

  async function handleReviewMemberRequest(id: string, decision: 'approve' | 'reject') {
    setBusy(`req-${id}`);
    try {
      const res = await fetch(`/api/clubs/${data.club.slug}/member-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      if (res.ok) {
        setJoinRequests((prev) =>
          prev.map((r) => (r.id === id ? { ...r, status: decision === 'approve' ? 'approved' : 'rejected' } : r))
        );
      }
    } finally {
      setBusy(null);
    }
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    setBusy('add-member');
    setBannerErr(null);
    try {
      const res = await fetch(`/api/clubs/${data.club.slug}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_campus_email_or_id: targetMemberEmail.trim(),
          role: targetMemberRole,
          title: targetMemberTitle.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || '新增成員失敗');
      setTargetMemberEmail('');
      setTargetMemberTitle('');
      setBannerMsg(`已新增 ${json.member.display_name}（${json.member.role}）！`);
    } catch (err) {
      setBannerErr(err instanceof Error ? err.message : '新增失敗');
    } finally {
      setBusy(null);
    }
  }

  async function handleReplyQuestion(qId: string) {
    const draft = replyDrafts[qId];
    if (!draft?.text.trim()) return;
    setBusy(`reply-${qId}`);
    setBannerErr(null);
    try {
      const res = await fetch(`/api/clubs/${data.club.slug}/questions/${qId}/reply`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answer_text: draft.text.trim(),
          publish_publicly: draft.pub,
          pin_as_faq: draft.pin,
          also_publish_qa_highlight: draft.highlight,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || '回覆失敗');
      setQuestionsInbox((prev) =>
        prev.map((q) =>
          q.id === qId
            ? {
                ...q,
                answer_text: draft.text.trim(),
                status: json.question.status,
                is_pinned_faq: json.question.is_pinned_faq,
              }
            : q
        )
      );
      setBannerMsg('問題已回覆！');
    } catch (err) {
      setBannerErr(err instanceof Error ? err.message : '回覆失敗');
    } finally {
      setBusy(null);
    }
  }

  async function handleArchiveUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!archTitle.trim()) {
      setBannerErr('請先輸入檔案標題再選擇檔案上傳。');
      return;
    }
    setBusy('arch-up');
    setBannerErr(null);
    try {
      const sasRes = await fetch('/api/media/sas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purpose: 'archive_file',
          club_id: data.club.id,
          content_type: file.type || 'application/pdf',
          size_bytes: file.size,
        }),
      });
      const sas = await sasRes.json();
      if (!sasRes.ok) throw new Error(sas?.error?.message || '取得密件上傳憑證失敗');

      const putRes = await fetch(sas.upload_url, {
        method: 'PUT',
        headers: { 'x-ms-blob-type': 'BlockBlob', 'Content-Type': file.type || 'application/pdf' },
        body: file,
      });
      if (!putRes.ok) throw new Error('私人容器寫入失敗');

      const saveRes = await fetch(`/api/clubs/${data.club.slug}/archive-files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          archive_category: archCategory,
          title: archTitle.trim(),
          blob_path: sas.blob_path,
          mime_type: file.type || 'application/pdf',
          size_bytes: file.size,
          occurred_on: archDate,
        }),
      });
      const saved = await saveRes.json();
      if (!saveRes.ok) throw new Error(saved?.error?.message || '歸檔紀錄建立失敗');

      setArchiveFiles((prev) => [
        {
          id: saved.file.id,
          archive_category: archCategory,
          title: archTitle.trim(),
          occurred_on: archDate,
          mime_type: file.type || 'application/pdf',
          size_bytes: file.size,
        },
        ...prev,
      ]);
      setArchTitle('');
      setBannerMsg('內部評鑑檔案已加密歸檔（僅幹部／歷屆／校方承辦憑限時簽章存取）。');
    } catch (err) {
      setBannerErr(err instanceof Error ? err.message : '歸檔失敗');
    } finally {
      setBusy(null);
    }
  }

  async function handleDownloadArchive(id: string) {
    setBusy(`dl-${id}`);
    try {
      const res = await fetch(`/api/clubs/${data.club.slug}/archive-files/${id}/download`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || '無法取得限時下載憑證');
      window.open(json.download_url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setBannerErr(err instanceof Error ? err.message : '下載失敗');
    } finally {
      setBusy(null);
    }
  }

  async function handleToggleEvalItem(kind: 'event' | 'post', id: string, nextVal: boolean) {
    const res = await fetch(`/api/clubs/${data.club.slug}/evaluation/batch-select`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        kind === 'event'
          ? { events: [{ id, include: nextVal }] }
          : { posts: [{ id, include: nextVal }] }
      ),
    });
    if (res.ok) {
      if (kind === 'event') {
        setEventsList((prev) =>
          prev.map((e) => (e.id === id ? { ...e, includeInEvaluation: nextVal } : e))
        );
      } else {
        setPostsList((prev) =>
          prev.map((p) => (p.id === id ? { ...p, includeInEvaluation: nextVal } : p))
        );
      }
    }
  }

  async function handleStartHandover(e: React.FormEvent) {
    e.preventDefault();
    if (
      !(await confirm({
        title: '發起社長交接？',
        description: `對方（${handoverEmail.trim()}）接受後，社長管理權限會正式移交。`,
        confirmLabel: '發起交接',
      }))
    ) {
      return;
    }
    setBusy('handover');
    setBannerErr(null);
    try {
      const res = await fetch(`/api/clubs/${data.club.slug}/handovers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to_campus_email: handoverEmail.trim(),
          pitfall_note: {
            venue_tips: venueTips.trim(),
            hours_and_deadlines: hoursDeadlines.trim(),
            contacts_and_vendors: contactsVendors.trim(),
          },
          share_deidentified: shareDeid,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || '發起交接失敗');
      setBannerMsg('社長交接邀請與避雷便條已送出！待接任人於個人中心確認後生效。');
      setHandoverEmail('');
    } catch (err) {
      setBannerErr(err instanceof Error ? err.message : '發起交接失敗');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${data.club.name} 管理後台`}
        description={`${data.club.universityName} · 您的權限：${ROLE_LABEL[data.myRole] ?? data.myRole}`}
        action={
          <div className="flex flex-wrap gap-2">
            {isOfficer && latestPublishable && (
              <Button
                variant="soft"
                icon={<Megaphone className="h-4 w-4" aria-hidden="true" />}
                onClick={() => setPublishTarget(latestPublishable)}
              >
                發布最新活動
              </Button>
            )}
            <ButtonLink href={`/clubs/${data.club.slug}`} variant="secondary">
              查看公開門面
            </ButtonLink>
          </div>
        }
      />

      <Dialog
        open={Boolean(publishTarget)}
        onClose={() => setPublishTarget(null)}
        title={publishTarget ? `發布「${publishTarget.title}」` : ''}
        description="文案都幫你寫好了，可以先改再發。"
        className="sm:max-w-2xl"
      >
        {publishTarget && (
          <PublishPanel
            shortCode={publishTarget.shortCode}
            clubId={data.club.id}
            clubSlug={data.club.slug}
            eventId={publishTarget.id}
            title={publishTarget.title}
            discordConfigured={discordConfigured}
            onOpenSettings={openPublishSettings}
          />
        )}
      </Dialog>

      {isReadOnlyAlumni && (
        <Notice tone="info">
          您目前為歷屆幹部／校友（只讀檢視權限）：可查閱私密評鑑歸檔、匯出年度成果報告與歷屆避雷便條，無法異動現任活動或成員權限。
        </Notice>
      )}

      {bannerMsg && (
        <Notice tone="success">{bannerMsg}</Notice>
      )}
      {bannerErr && (
        <Notice tone="danger">{bannerErr}</Notice>
      )}

      <Tabs
        variant="underline"
        label="社團管理分頁"
        idPrefix="manage"
        value={tab}
        onChange={(next) => void switchTab(next)}
        items={[
          { id: 'events', label: '活動', icon: <Calendar className="h-4 w-4" aria-hidden="true" /> },
          { id: 'posts', label: '發文', icon: <FileText className="h-4 w-4" aria-hidden="true" /> },
          { id: 'members', label: '成員', icon: <Users className="h-4 w-4" aria-hidden="true" /> },
          { id: 'questions', label: '問答', icon: <HelpCircle className="h-4 w-4" aria-hidden="true" /> },
          { id: 'evaluation', label: '評鑑', icon: <Archive className="h-4 w-4" aria-hidden="true" /> },
          { id: 'handover', label: '換屆交接', icon: <ArrowRightLeft className="h-4 w-4" aria-hidden="true" /> },
        ]}
      />

      {/* EVENTS TAB */}
      {tab === 'events' && (
        <div className="space-y-6">
          {justCreated && (
            <Card className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="flex items-center gap-2 font-display text-base font-bold text-fg">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-success-fg" aria-hidden="true" />
                    「{justCreated.title}」已發布，接著發到各平台
                  </h2>
                  <p className="mt-0.5 text-sm text-fg-muted">文案都幫你寫好了，可以先改再發。</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setJustCreated(null)}>
                  先不用
                </Button>
              </div>
              <PublishPanel
                shortCode={justCreated.shortCode}
                clubId={data.club.id}
                clubSlug={data.club.slug}
                eventId={justCreated.id}
                title={justCreated.title}
                discordConfigured={discordConfigured}
                onOpenSettings={openPublishSettings}
              />
            </Card>
          )}
          {canWrite && (
            <details
              open={eventFormOpen}
              onToggle={(e) => setEventFormOpen(e.currentTarget.open)}
              className="group tactile-card rounded-2xl bg-surface"
            >
              <summary
                onClick={() => {
                  if (!eventFormOpen) startFlow('officer_publish', 'create_form');
                }}
                className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-6 py-3 [&::-webkit-details-marker]:hidden">
                <span>
                  <span className="block font-display text-base font-bold text-fg">建立體驗活動</span>
                  <span className="block text-sm text-fg-muted">
                    分四步填寫：基本資訊、時間地點、參加條件、內容與報名
                  </span>
                </span>
                <ChevronDown
                  className="h-5 w-5 shrink-0 text-fg-muted transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
            <form
              onSubmit={handleCreateEvent}
              onInput={() => startFlow('officer_publish', 'create_form')}
              className="border-t-2 border-line px-6 pb-6"
            >
              <div className="mt-4 space-y-3 rounded-xl bg-surface-subtle p-4">
                <div className="min-w-0 space-y-1.5 *:w-full">
                  <label htmlFor="club-manage-ev-airawtext" className="flex items-center gap-2 font-display text-sm font-bold text-fg">
                    <Sparkles className="h-4 w-4 text-brand" aria-hidden="true" />
                    貼上文案或海報，自動填表
                  </label>
                  <p className="text-sm text-fg-muted">貼 LINE 公告或上傳海報，幫你填好下面的欄位；不會自己編日期和費用。</p>
                  <textarea
                    id="club-manage-ev-airawtext"
                    rows={3}
                    value={evAiRawText}
                    onChange={(e) => setEvAiRawText(e.target.value)}
                    placeholder="貼上活動公告、筆記或企劃文字（至少 20 字）"
                    className={`${controlClasses} min-h-24 w-full py-2.5 leading-relaxed`}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant="secondary"
                    loading={busy === 'ai-draft-event'}
                    disabled={evAiRawText.trim().length < 20}
                    onClick={() => handleAiDraftSubmit(null, 'event')}
                  >
                    用這段文字填表
                  </Button>
                  <label
                    className={buttonClasses({
                      variant: 'secondary',
                      size: 'md',
                      className: 'cursor-pointer focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus-ring',
                    })}
                  >
                    <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                    {busy === 'ai-draft-event' ? '解析中...' : '上傳海報圖／PDF'}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,.pdf,.txt,.md"
                      disabled={busy === 'ai-draft-event'}
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        e.target.value = '';
                        if (f) handleAiDraftSubmit(f, 'event');
                      }}
                      className="sr-only"
                    />
                  </label>
                </div>
              </div>
              {aiFilledEvent && (
                <div className="mt-4">
                  <Notice tone="warning">
                    AI 先幫你填好了，但海報可能讀錯。請逐一確認時間、地點與費用，並加一句你自己的話再發布。
                  </Notice>
                </div>
              )}
              <div className="mt-4 divide-y divide-line">
                <fieldset className="min-w-0 space-y-4 pb-6">
                  <legend className="font-display text-sm font-bold text-fg">基本資訊</legend>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="club-manage-evtitle" className="mb-1 block text-sm font-semibold text-fg-secondary">活動名稱 *</label>
                      <input id="club-manage-evtitle"
                        required
                        minLength={2}
                        maxLength={80}
                        value={evTitle}
                        onChange={(e) => setEvTitle(e.target.value)}
                        placeholder="例如：零基礎底片沖洗之夜"
                        className={`${controlClasses} min-h-11 w-full`}
                      />
                    </div>
                    <div>
                      <label htmlFor="club-manage-evtheme" className="mb-1 block text-sm font-semibold text-fg-secondary">主題底色</label>
                      <select id="club-manage-evtheme"
                        value={evTheme}
                        onChange={(e) => setEvTheme(e.target.value as typeof evTheme)}
                        className={`${controlClasses} min-h-11 w-full`}
                      >
                        <option value="warm_paper">暖陽松果</option>
                        <option value="campus_blue">晴空講義</option>
                        <option value="forest_trail">山林野營</option>
                        <option value="midnight_jam">暗房霓虹</option>
                      </select>
                    </div>
                  </div>

                  <div className="min-w-0 flex-1 space-y-1.5 *:w-full">
                    <label htmlFor="club-manage-evsummary" className="block text-sm font-medium text-fg-body">
                      亮點摘要
                    </label>
                    <input id="club-manage-evsummary"
                      value={evSummary}
                      onChange={(e) => setEvSummary(e.target.value)}
                      maxLength={160}
                      placeholder="一句話亮點摘要（將顯示在探索頁與分享預覽卡）"
                      className={`${controlClasses} min-h-11`}
                    />
                  </div>

                  <ImageUploader
                    clubId={data.club.id}
                    value={evCover}
                    onChange={setEvCover}
                    maxImages={1}
                    purpose="club_cover"
                  />
                </fieldset>

                <fieldset className="min-w-0 space-y-4 py-6">
                  <legend className="font-display text-sm font-bold text-fg">時間與地點</legend>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="club-manage-evmode" className="mb-1 block text-sm font-semibold text-fg-secondary">時程模式</label>
                      <select id="club-manage-evmode"
                        value={evMode}
                        onChange={(e) => setEvMode(e.target.value as typeof evMode)}
                        className={`${controlClasses} min-h-11 w-full`}
                      >
                        <option value="scheduled">已確定時間</option>
                        <option value="tbd">先刊登再定時間</option>
                        <option value="voting">讓同學投票喬時間／主題</option>
                      </select>
                    </div>
                  </div>

                  {evMode === 'scheduled' && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label htmlFor="club-manage-evstart" className="mb-1 block text-sm font-semibold text-fg-secondary">開始時間 *</label>
                        <input id="club-manage-evstart"
                          type="datetime-local"
                          required
                          value={evStart}
                          onChange={(e) => setEvStart(e.target.value)}
                          className={`${controlClasses} min-h-11 w-full`}
                        />
                      </div>
                      <div>
                        <label htmlFor="club-manage-evend" className="mb-1 block text-sm font-semibold text-fg-secondary">結束時間（選填）</label>
                        <input id="club-manage-evend"
                          type="datetime-local"
                          value={evEnd}
                          onChange={(e) => setEvEnd(e.target.value)}
                          className={`${controlClasses} min-h-11 w-full`}
                        />
                      </div>
                    </div>
                  )}

                  {evMode === 'voting' && (
                    <div className="space-y-2 rounded-xl bg-surface-subtle p-4">
                      <p className="text-sm font-semibold text-fg-body">設定投票選項（最多填 3 個候選項目）：</p>
                      {pollLabels.map((lbl, idx) => (
                        <input aria-label="投票選項"
                          key={idx}
                          value={lbl}
                          onChange={(e) =>
                            setPollLabels((prev) => prev.map((v, i) => (i === idx ? e.target.value : v)))
                          }
                          placeholder={`投票選項 ${idx + 1}`}
                          className={`${controlClasses} min-h-11 w-full`}
                        />
                      ))}
                    </div>
                  )}

                  <div>
                    <label htmlFor="club-manage-evlocation" className="mb-1 block text-sm font-semibold text-fg-secondary">地點</label>
                    <input id="club-manage-evlocation"
                      placeholder="還沒定可以先留空"
                      value={evLocation}
                      onChange={(e) => setEvLocation(e.target.value)}
                      className={`${controlClasses} min-h-11 w-full`}
                    />
                    <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-fg-secondary">
                      <input
                        type="checkbox"
                        checked={evHideLocation}
                        onChange={(e) => setEvHideLocation(e.target.checked)}
                        className="h-4 w-4 rounded accent-brand"
                      />
                      分享圖與連結預覽不顯示地點（例如在社辦或私人場地）
                    </label>
                  </div>
                </fieldset>

                <fieldset className="min-w-0 space-y-4 py-6">
                  <legend className="font-display text-sm font-bold text-fg">參加條件</legend>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="club-manage-evfee" className="mb-1 block text-sm font-semibold text-fg-secondary">單次費用 (NT$)</label>
                      <input id="club-manage-evfee"
                        type="number"
                        min={0}
                        value={evFee}
                        onChange={(e) => setEvFee(e.target.value)}
                        className={`${controlClasses} min-h-11 w-full`}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm font-medium text-fg-secondary">
                    <label className="flex min-h-11 cursor-pointer items-center gap-1.5">
                      <input type="checkbox" checked={evBeginner} onChange={(e) => setEvBeginner(e.target.checked)} />
                      零基礎友善
                    </label>
                    <label className="flex min-h-11 cursor-pointer items-center gap-1.5">
                      <input type="checkbox" checked={evNonMember} onChange={(e) => setEvNonMember(e.target.checked)} />
                      非社員歡迎體驗
                    </label>
                    <label className="flex min-h-11 cursor-pointer items-center gap-1.5">
                      <input type="checkbox" checked={evCampusOnly} onChange={(e) => setEvCampusOnly(e.target.checked)} />
                      限本校 .edu.tw 報名
                    </label>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="min-w-0 flex-1 space-y-1.5 *:w-full">
                      <label htmlFor="club-manage-evhourscat" className="block text-sm font-medium text-fg-body">
                        學習時數
                      </label>
                      <select id="club-manage-evhourscat"
                        value={evHoursCat}
                        onChange={(e) => setEvHoursCat(e.target.value as LearningHoursCategory)}
                        className={`${controlClasses} min-h-11`}
                      >
                        <option value="none">無認證時數</option>
                        <option value="art">可認證藝文時數</option>
                        <option value="life">可認證生活知能時數</option>
                        <option value="service">可認證服務學習時數</option>
                      </select>
                    </div>
                    <div className="min-w-0 flex-1 space-y-1.5 *:w-full">
                      <label htmlFor="club-manage-evhourscount" className="block text-sm font-medium text-fg-body">
                        時數（小時）
                      </label>
                      <input id="club-manage-evhourscount"
                        type="number"
                        step="0.5"
                        min={0}
                        value={evHoursCount}
                        onChange={(e) => setEvHoursCount(e.target.value)}
                        placeholder="時數小時數"
                        className={`${controlClasses} min-h-11`}
                      />
                    </div>
                  </div>

                  <div className="min-w-0 flex-1 space-y-1.5 *:w-full">
                    <label htmlFor="club-manage-evprenotes" className="block text-sm font-medium text-fg-body">
                      行前提醒
                    </label>
                    <input id="club-manage-evprenotes"
                      value={evPreNotes}
                      onChange={(e) => setEvPreNotes(e.target.value)}
                      placeholder="行前提醒（例如：請穿好走運動鞋、社團會提供道具）"
                      className={`${controlClasses} min-h-11`}
                    />
                  </div>
                </fieldset>

                <fieldset className="min-w-0 space-y-4 pt-6">
                  <legend className="font-display text-sm font-bold text-fg">詳細內容與報名</legend>
                  <div className="min-w-0 flex-1 space-y-1.5 *:w-full">
                    <label htmlFor="club-manage-evdesc" className="block text-sm font-medium text-fg-body">
                      活動介紹
                    </label>
                    <textarea id="club-manage-evdesc"
                      rows={3}
                      value={evDesc}
                      onChange={(e) => setEvDesc(e.target.value)}
                      placeholder="完整活動介紹 Markdown（也可用「AI 海報辨識」一鍵帶入）"
                      className={`${controlClasses} min-h-24 py-2.5 leading-relaxed w-full`}
                    />
                  </div>

                  <div className="min-w-0 flex-1 space-y-1.5 *:w-full">
                    <label htmlFor="club-manage-evexturl" className="block text-sm font-medium text-fg-body">
                      外部報名表單（選填）
                    </label>
                    <input id="club-manage-evexturl"
                      type="url"
                      value={evExtUrl}
                      onChange={(e) => setEvExtUrl(e.target.value)}
                      placeholder="選填：外部報名 Google 表單網址"
                      className={`${controlClasses} min-h-11`}
                    />
                  </div>

                  <label className="flex min-h-11 cursor-pointer items-center gap-1.5 text-sm font-medium text-fg-secondary">
                    <input type="checkbox" checked={evIncludeEval} onChange={(e) => setEvIncludeEval(e.target.checked)} />
                    納入本學年評鑑報表
                  </label>
                </fieldset>
              </div>

              {aiFilledEvent && (
                <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-2.5 text-sm font-medium text-fg-body">
                  <input
                    type="checkbox"
                    checked={aiFieldsConfirmed}
                    onChange={(e) => setAiFieldsConfirmed(e.target.checked)}
                    className="h-4 w-4 rounded accent-brand"
                  />
                  我已確認 AI 填入的時間、地點與費用正確
                </label>
              )}
              <div className="mt-6 border-t border-line pt-6">
                <Button
                  type="submit"
                  size="lg"
                  disabled={
                    busy === 'create-event' || evTitle.trim().length < 2 || (aiFilledEvent && !aiFieldsConfirmed)
                  }
                  className="w-full sm:w-auto"
                >
                  {busy === 'create-event' ? '建立中...' : '發布活動並產生專屬短網址'}
                </Button>
              </div>
            </form>
            </details>
          )}

          <Card className="space-y-3">
            <h2 className="font-display text-base font-bold text-fg">近期活動清單</h2>
            {eventsList.map((ev) => (
              <div
                key={ev.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-subtle p-4"
              >
                <div>
                  <p className="text-sm font-semibold text-fg">{ev.title}</p>
                  <p className="text-sm text-fg-subtle">
                    {SCHEDULE_MODE_LABEL[ev.scheduleMode] ?? ev.scheduleMode} · {EVENT_STATUS_LABEL[ev.status] ?? ev.status}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {canWrite && (
                    <label className="flex cursor-pointer items-center gap-1 text-sm font-semibold text-fg-secondary">
                      <input
                        type="checkbox"
                        checked={ev.includeInEvaluation}
                        onChange={(e) => handleToggleEvalItem('event', ev.id, e.target.checked)}
                      />
                      列入評鑑
                    </label>
                  )}
                  {isOfficer && ev.status !== 'cancelled' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Megaphone className="h-3.5 w-3.5" aria-hidden="true" />}
                      onClick={() => setPublishTarget({ id: ev.id, shortCode: ev.shortCode, title: ev.title })}
                    >
                      發布到各平台
                    </Button>
                  )}
                  <Link
                    href={`/e/${ev.shortCode}`}
                    className={buttonClasses({ variant: 'secondary', size: 'sm' })}
                  >
                    看活動頁
                  </Link>
                </div>
              </div>
            ))}
          </Card>

          {isOfficer && (
            <Card id="publish-channels" className="scroll-mt-24 space-y-5">
              <div>
                <h2 className="font-display text-base font-bold text-fg">發布管道</h2>
                <p className="mt-0.5 text-sm text-fg-muted">設定一次，之後每場活動都能直接發。</p>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-bold text-fg-body">Discord 公告頻道</h3>
                {discordConfigured && !webhookEditing ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-subtle p-4">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-sm font-semibold text-success-fg">
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                        已設定 Discord 頻道
                      </p>
                      <p className="mt-0.5 break-all text-sm text-fg-muted">
                        Webhook 網址已加密保存（discord.com/api/webhooks/••••），不會再顯示。
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" size="sm" onClick={() => setWebhookEditing(true)}>
                        更換頻道
                      </Button>
                      <Button variant="ghost" size="sm" loading={busy === 'webhook'} onClick={handleRemoveWebhook}>
                        移除頻道
                      </Button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSaveWebhook} className="space-y-3">
                    <Field
                      label="頻道 Webhook 網址"
                      hint="在 Discord 頻道設定 → 整合 → Webhook → 新 Webhook，按「複製 Webhook 網址」後貼上。"
                      error={webhookError}
                    >
                      {(props) => (
                        <Input
                          {...props}
                          type="url"
                          inputMode="url"
                          autoComplete="off"
                          placeholder="https://discord.com/api/webhooks/…"
                          value={webhookInput}
                          onChange={(e) => setWebhookInput(e.target.value)}
                        />
                      )}
                    </Field>
                    <div className="flex flex-wrap gap-2">
                      <Button type="submit" loading={busy === 'webhook'} disabled={!webhookInput.trim()}>
                        保存 Discord 頻道
                      </Button>
                      {webhookEditing && (
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setWebhookEditing(false);
                            setWebhookInput('');
                            setWebhookError(null);
                          }}
                        >
                          取消
                        </Button>
                      )}
                    </div>
                  </form>
                )}
                {discordConfigured && !webhookEditing && webhookError && (
                  <p className="text-sm font-medium text-danger-fg">{webhookError}</p>
                )}
              </div>

              <div className="border-t border-line pt-5">
                <Field label="放到 IG 個人簡介的連結" hint="社團頁會列出所有近期活動，IG 簡介放這一條就夠了。">
                  {(props) => (
                    <div className="flex flex-wrap gap-2 sm:flex-nowrap">
                      <Input {...props} readOnly value={bioLink} onFocus={(e) => e.currentTarget.select()} />
                      <Button
                        variant="secondary"
                        icon={<Copy className="h-4 w-4" aria-hidden="true" />}
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(bioLink);
                            setBioLinkCopied(true);
                          } catch {
                            setBioLinkCopied(false);
                          }
                        }}
                      >
                        {bioLinkCopied ? '已複製' : '複製連結'}
                      </Button>
                    </div>
                  )}
                </Field>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* POSTS & VISION AI TAB */}
      {tab === 'posts' && (
        <div className="space-y-6">
          {canWrite && (
            <>
              <Card className="space-y-3">
                <h2 className="flex items-center gap-2 font-display text-base font-bold text-fg">
                  <Sparkles className="h-4 w-4 text-brand" aria-hidden="true" />
                  AI 海報辨識與文案整理（不會捏造日期與費用）
                </h2>
                <div className="min-w-0 flex-1 space-y-1.5 *:w-full">
                  <label htmlFor="club-manage-airawtext" className="block text-sm font-medium text-fg-body">
                    貼上公告、筆記或企劃
                  </label>
                  <textarea id="club-manage-airawtext"
                    rows={3}
                    value={aiRawText}
                    onChange={(e) => setAiRawText(e.target.value)}
                    placeholder="貼上活動零散筆記、LINE 公告或上傳海報／企劃 PDF (≤4MB)..."
                    className={`${controlClasses} min-h-24 py-2.5 leading-relaxed w-full`}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <label className={buttonClasses({ variant: 'secondary', size: 'md', className: 'cursor-pointer' })}>
                    <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                    {busy === 'ai-draft' ? '解析中...' : '上傳海報圖 / PDF 自動辨識'}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,.pdf,.txt,.md"
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        e.target.value = '';
                        if (f) handleAiDraftSubmit(f);
                      }}
                      className="hidden"
                    />
                  </label>
                  <Button
                    variant="secondary"
                    disabled={busy === 'ai-draft' || aiRawText.trim().length < 20}
                    onClick={() => handleAiDraftSubmit(null)}
                  >
                    僅解析文字草稿
                  </Button>
                </div>

                {aiResult &&
                  (() => {
                    const preferEvent = shouldRouteDraftToEvent(aiResult.draft, aiRawText);
                    return (
                      <div className="space-y-2 rounded-xl bg-surface-subtle p-4 text-sm">
                        {aiResult.degraded && (
                          <p className="font-bold text-warning-fg">
                            {aiResult.warnings.join(' ')}
                          </p>
                        )}
                        <p className="font-bold text-fg">抽出標題：{aiResult.draft.title}</p>
                        <p className="text-fg-secondary">{aiResult.draft.summary}</p>
                        {preferEvent && (
                          <p className="rounded-xl bg-brand-soft px-3 py-2 font-semibold text-brand-soft-fg">
                            偵測到活動招募／時間地點資訊：建議直接「帶入建立活動」開放報名或投票時間，避免活動宣傳海報混入日常動態牆。
                          </p>
                        )}
                        {aiResult.degraded && !preferEvent && (
                          <p className="rounded-xl bg-warning-soft px-3 py-2 font-semibold text-warning-fg">
                            AI 這次沒能讀懂素材內容。如果這是活動宣傳海報或社課行事曆，請改按「帶入建立活動」；日常動態牆只放社員的現場紀錄。
                          </p>
                        )}
                        {aiResult.draft.missing_beginner_fields.length > 0 && (
                          <p className="font-semibold text-brand-soft-fg">
                            新手資訊建議補填：{aiResult.draft.missing_beginner_fields.join('、')}
                          </p>
                        )}
                        {aiResult.draft.poster_text_heavy && (
                          <p className="font-semibold text-brand-soft-fg">
                            偵測到海報文字較密，建議補純文字時間地點以利搜尋與閱讀。
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2 pt-2">
                          <Button
                            variant={preferEvent ? 'primary' : 'secondary'}
                            onClick={() => applyAiToEvent()}
                          >
                            帶入「建立活動」表單
                          </Button>
                          <Button
                            variant={preferEvent ? 'secondary' : 'primary'}
                            onClick={applyAiToPost}
                          >
                            {preferEvent ? '仍要帶入「作品／日常」表單' : '帶入下方「作品／日常」表單'}
                          </Button>
                        </div>
                      </div>
                    );
                  })()}
              </Card>

              <form
                onSubmit={handlePublishPost}
                className="tactile-card space-y-4 rounded-2xl bg-surface p-5 sm:p-6"
              >
                <h2 className="font-display text-base font-bold text-fg">發布社團日常／實作作品</h2>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="min-w-0 flex-1 space-y-1.5 *:w-full">
                    <label htmlFor="club-manage-postkind" className="block text-sm font-medium text-fg-body">
                      內容類型
                    </label>
                    <select id="club-manage-postkind"
                      value={postKind}
                      onChange={(e) => setPostKind(e.target.value as 'nrc_moment' | 'wip_work')}
                      className={`${controlClasses} min-h-11`}
                    >
                      <option value="wip_work">實作作品</option>
                      <option value="nrc_moment">社員日常</option>
                    </select>
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5 *:w-full">
                    <label htmlFor="club-manage-postheadline" className="block text-sm font-medium text-fg-body">
                      一句話亮點
                    </label>
                    <input id="club-manage-postheadline"
                      required
                      minLength={2}
                      maxLength={120}
                      value={postHeadline}
                      onChange={(e) => setPostHeadline(e.target.value)}
                      placeholder="一句話亮點標題 *"
                      className={`${controlClasses} min-h-11 sm:col-span-2`}
                    />
                  </div>
                </div>
                <div className="min-w-0 flex-1 space-y-1.5 *:w-full">
                  <label htmlFor="club-manage-postcontentmd" className="block text-sm font-medium text-fg-body">
                    內容
                  </label>
                  <textarea id="club-manage-postcontentmd"
                    rows={3}
                    value={postContentMd}
                    onChange={(e) => setPostContentMd(e.target.value)}
                    placeholder="內容 Markdown..."
                    className={`${controlClasses} min-h-24 py-2.5 leading-relaxed w-full`}
                  />
                </div>
                <ImageUploader
                  clubId={data.club.id}
                  value={postMedia}
                  onChange={setPostMedia}
                  maxImages={6}
                  purpose="post_image"
                />
                <label className={buttonClasses({ variant: 'secondary', size: 'md', className: 'cursor-pointer' })}>
                  <Film className="h-3.5 w-3.5" aria-hidden="true" />
                  上傳 ≤15 秒短影 (MP4/WebM)
                  <input
                    type="file"
                    accept="video/mp4,video/webm"
                    onChange={handleVideoUpload}
                    className="hidden"
                  />
                </label>
                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="flex cursor-pointer items-center gap-1.5 font-semibold">
                    <input type="checkbox" checked={postOrig} onChange={(e) => setPostOrig(e.target.checked)} />
                    原創與肖像授權聲明（必勾）
                  </label>
                  <label className="flex cursor-pointer items-center gap-1.5">
                    <input type="checkbox" checked={postEval} onChange={(e) => setPostEval(e.target.checked)} />
                    收進評鑑成果
                  </label>
                </div>
                <Button
                  type="submit"
                  disabled={busy === 'post' || postMedia.length === 0 || !postOrig} variant="primary" size="md">
                  立即發布
                </Button>
              </form>
            </>
          )}

          <Card className="space-y-3">
            <h2 className="font-display text-base font-bold text-fg">已發布內容與評鑑標記</h2>
            {postsList.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-subtle p-4"
              >
                <div>
                  <span className="text-xs font-bold text-brand-soft-fg">
                    {POST_KIND_LABELS[p.postKind].label}
                    {p.pinnedAt && <span className="ml-2 text-brand-soft-fg">・代表作</span>}
                  </span>
                  <p className="text-sm font-semibold text-fg">{p.headline}</p>
                </div>
                <div className="flex items-center gap-3">
                  {isOfficer && p.status === 'published' && (
                    <Button
                      
                      aria-pressed={Boolean(p.pinnedAt)}
                      disabled={busy === `pin-${p.id}` || (!p.pinnedAt && pinnedCount >= 4)}
                      onClick={() => void handleTogglePin(p.id, !p.pinnedAt)} variant={p.pinnedAt ? 'soft' : 'secondary'} size="sm">
                      <Pin className="h-3.5 w-3.5" aria-hidden="true" />
                      {p.pinnedAt ? '取消代表作' : '設為代表作'}
                    </Button>
                  )}
                  {canWrite && (
                    <label className="flex cursor-pointer items-center gap-1 text-sm font-semibold text-fg-secondary">
                      <input
                        type="checkbox"
                        checked={p.includeInEvaluation}
                        onChange={(e) => handleToggleEvalItem('post', p.id, e.target.checked)}
                      />
                      列入評鑑
                    </label>
                  )}
                  <Link
                    href={`/posts/${p.id}`}
                    className="rounded-xl px-3 py-1.5 text-sm font-semibold text-fg-body underline-offset-4 hover:underline"
                  >
                    檢視
                  </Link>
                </div>
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* MEMBERS TAB */}
      {tab === 'members' && (
        <div className="space-y-6">
          {canWrite && (
            <Card className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 font-display text-base font-bold text-fg">
                  <KeyRound className="h-4 w-4 text-brand" />
                  產生社員限時邀請碼（限同校 .edu.tw）
                </h2>
                <Button
                  
                  onClick={handleGenerateInviteCode}
                  disabled={busy === 'invite-code'} variant="primary" size="sm">
                  產生 7 天邀請碼
                </Button>
              </div>
              {inviteCodes.length > 0 && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {inviteCodes.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between rounded-xl bg-surface-subtle px-3 py-2 text-sm"
                    >
                      <div>
                        <span className="font-mono font-bold text-fg">{c.code}</span>
                        <p className="text-xs text-fg-subtle">
                          已使用 {c.used_count} 次 · 到期 {c.expires_at.slice(0, 10)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigator.clipboard.writeText(c.code)}
                        aria-label={`複製邀請碼 ${c.code}`}
                      >
                        <Copy className="h-3 w-3" aria-hidden="true" />
                        複製
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {canWrite && (
            <Card className="space-y-3">
              <h2 className="font-display text-base font-bold text-fg">待審的入社申請</h2>
              {joinRequests.length === 0 ? (
                <p className="text-sm text-fg-subtle">尚無待審入社申請。</p>
              ) : (
                joinRequests.map((r) => (
                  <div
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-subtle p-3 text-sm"
                  >
                    <div>
                      <p className="font-bold text-fg">{r.display_name}</p>
                      {r.note && <p className="text-fg-muted">{r.note}</p>}
                    </div>
                    {r.status === 'pending' ? (
                      <div className="flex gap-2">
                        <Button
                          
                          onClick={() => handleReviewMemberRequest(r.id, 'approve')} variant="soft" size="sm">
                          核准為認證社員
                        </Button>
                        <Button
                          
                          onClick={() => handleReviewMemberRequest(r.id, 'reject')} variant="secondary" size="sm" className="text-danger-fg">
                          婉拒
                        </Button>
                      </div>
                    ) : (
                      <span className="font-bold text-fg-muted">{JOIN_STATUS_LABEL[r.status] ?? r.status}</span>
                    )}
                  </div>
                ))
              )}
            </Card>
          )}

          {canWrite && (
            <form
              onSubmit={handleAddMember}
              className="tactile-card space-y-3 rounded-2xl bg-surface p-5 sm:p-6"
            >
              <h2 className="font-display text-base font-bold text-fg">手動新增幹部／社員</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="min-w-0 flex-1 space-y-1.5 *:w-full">
                  <label htmlFor="club-manage-targetmemberemail" className="block text-sm font-medium text-fg-body">
                    對方的學校信箱
                  </label>
                  <input id="club-manage-targetmemberemail"
                    required
                    value={targetMemberEmail}
                    onChange={(e) => setTargetMemberEmail(e.target.value)}
                    placeholder="對方同校 .edu.tw 信箱"
                    className={`${controlClasses} min-h-11`}
                  />
                </div>
                <div className="min-w-0 flex-1 space-y-1.5 *:w-full">
                  <label htmlFor="club-manage-targetmemberrole" className="block text-sm font-medium text-fg-body">
                    身分
                  </label>
                  <select id="club-manage-targetmemberrole"
                    value={targetMemberRole}
                    onChange={(e) => setTargetMemberRole(e.target.value as 'editor' | 'member')}
                    className={`${controlClasses} min-h-11`}
                  >
                    <option value="member">認證社員</option>
                    {isOwner && <option value="editor">幹部</option>}
                  </select>
                </div>
                <div className="min-w-0 flex-1 space-y-1.5 *:w-full">
                  <label htmlFor="club-manage-targetmembertitle" className="block text-sm font-medium text-fg-body">
                    職稱（選填）
                  </label>
                  <input id="club-manage-targetmembertitle"
                    value={targetMemberTitle}
                    onChange={(e) => setTargetMemberTitle(e.target.value)}
                    placeholder="職稱（如 教學長／社員）"
                    className={`${controlClasses} min-h-11`}
                  />
                </div>
              </div>
              <Button
                type="submit"
                disabled={busy === 'add-member'} variant="primary" size="md">
                確認新增
              </Button>
            </form>
          )}

          <Card className="space-y-2">
            <h2 className="font-display text-base font-bold text-fg">成員與歷屆名單</h2>
            {data.members.map((m, idx) => (
              <div
                key={`${m.userId}-${idx}`}
                className="flex items-center justify-between rounded-xl bg-surface-subtle px-4 py-3 text-sm"
              >
                <span className="font-bold text-fg">
                  {m.displayName} {m.title ? `（${m.title}）` : ''}
                </span>
                <span className="text-sm font-semibold text-fg-muted">
                  {ROLE_LABEL[m.role] ?? m.role} {m.endedAt ? '· 已卸任' : '· 現行有效'}
                </span>
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* QUESTIONS & FAQ TAB */}
      {tab === 'questions' && (
        <Card className="space-y-4">
          <h2 className="font-display text-base font-bold text-fg">新生提問與常見問答</h2>
          {questionsInbox.length === 0 ? (
            <p className="text-sm text-fg-subtle">目前尚無提問。</p>
          ) : (
            questionsInbox.map((q) => {
              const draft = replyDrafts[q.id] ?? {
                text: '',
                pub: true,
                pin: false,
                highlight: false,
              };
              return (
                <div key={q.id} className="space-y-2 rounded-xl bg-surface-subtle p-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-fg">
                      {q.display_asker}：{q.question_text}
                    </span>
                    <Badge>{QUESTION_STATUS_LABEL[q.status] ?? q.status}</Badge>
                  </div>
                  {canWrite && (
                    <>
                      <textarea aria-label="回覆內容"
                        rows={2}
                        value={draft.text}
                        onChange={(e) =>
                          setReplyDrafts((prev) => ({
                            ...prev,
                            [q.id]: { ...draft, text: e.target.value },
                          }))
                        }
                        placeholder="輸入社團幹部回覆..."
                        className={`${controlClasses} min-h-24 py-2.5 leading-relaxed w-full`}
                      />
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap gap-3">
                          <label className="flex cursor-pointer items-center gap-1">
                            <input
                              type="checkbox"
                              checked={draft.pub}
                              onChange={(e) =>
                                setReplyDrafts((prev) => ({
                                  ...prev,
                                  [q.id]: { ...draft, pub: e.target.checked },
                                }))
                              }
                            />
                            公開於社團 FAQ
                          </label>
                          <label className="flex cursor-pointer items-center gap-1">
                            <input
                              type="checkbox"
                              checked={draft.pin}
                              onChange={(e) =>
                                setReplyDrafts((prev) => ({
                                  ...prev,
                                  [q.id]: { ...draft, pin: e.target.checked },
                                }))
                              }
                            />
                            置頂精華
                          </label>
                          <label className="flex cursor-pointer items-center gap-1">
                            <input
                              type="checkbox"
                              checked={draft.highlight}
                              onChange={(e) =>
                                setReplyDrafts((prev) => ({
                                  ...prev,
                                  [q.id]: { ...draft, highlight: e.target.checked },
                                }))
                              }
                            />
                            同步推文至現場流
                          </label>
                        </div>
                        <Button
                          
                          onClick={() => handleReplyQuestion(q.id)}
                          disabled={busy === `reply-${q.id}`} variant="primary" size="sm">
                          儲存並回覆
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </Card>
      )}

      {/* PRIVATE EVAL ARCHIVE & EXPORT TAB */}
      {tab === 'evaluation' && (
        <div className="space-y-6">
          <Card className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-bold text-fg">
                一鍵匯出年度評鑑報告（含共同舉辦的活動與內部索引）
              </h2>
              <p className="text-sm text-fg-muted">
                預設採計上學年 5 月 1 日至當年 5 月 31 日，僅整合有勾選「納入評鑑」之內容。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/clubs/${data.club.slug}/evaluation/print`}
                className={buttonClasses({ variant: 'primary', size: 'md' })}
              >
                <Printer className="h-3.5 w-3.5" />
                開啟列印版 / 另存 PDF
              </Link>
              <a
                href={`/api/clubs/${data.club.slug}/evaluation/export?format=markdown`}
                className={buttonClasses({ variant: 'secondary', size: 'md' })}
              >
                <Download className="h-3.5 w-3.5" />
                下載 Markdown (.md)
              </a>
            </div>
          </Card>

          {canWrite && (
            <Card className="space-y-3">
              <h3 className="font-display text-sm font-bold text-fg">
                上傳私密內部評鑑檔案（私密保存，至少 6 年）
              </h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="min-w-0 flex-1 space-y-1.5 *:w-full">
                  <label htmlFor="club-manage-archtitle" className="block text-sm font-medium text-fg-body">
                    檔案標題
                  </label>
                  <input id="club-manage-archtitle"
                    value={archTitle}
                    onChange={(e) => setArchTitle(e.target.value)}
                    placeholder="檔案標題（如 115-1 期末大會會議記錄）*"
                    className={`${controlClasses} min-h-11`}
                  />
                </div>
                <div className="min-w-0 flex-1 space-y-1.5 *:w-full">
                  <label htmlFor="club-manage-archcategory" className="block text-sm font-medium text-fg-body">
                    檔案類型
                  </label>
                  <select id="club-manage-archcategory"
                    value={archCategory}
                    onChange={(e) => setArchCategory(e.target.value as ArchiveFileCategory)}
                    className={`${controlClasses} min-h-11`}
                  >
                    <option value="meeting_minutes">會議記錄</option>
                    <option value="finance_ledger">經費收支核銷</option>
                    <option value="equipment_inventory">財產器材清冊</option>
                    <option value="evaluation_evidence">評鑑佐證文件</option>
                    <option value="other">其他密件</option>
                  </select>
                </div>
                <div className="min-w-0 flex-1 space-y-1.5 *:w-full">
                  <label htmlFor="club-manage-archdate" className="block text-sm font-medium text-fg-body">
                    日期
                  </label>
                  <input id="club-manage-archdate"
                    type="date"
                    value={archDate}
                    onChange={(e) => setArchDate(e.target.value)}
                    className={`${controlClasses} min-h-11`}
                  />
                </div>
              </div>
              <label className={buttonClasses({ variant: 'primary', size: 'md', className: 'cursor-pointer' })}>
                <Upload className="h-3.5 w-3.5" />
                {busy === 'arch-up' ? '上傳私密容器中...' : '選擇 PDF / DOCX / XLSX / CSV / ZIP (≤20MB)'}
                <input
                  type="file"
                  accept=".pdf,.docx,.xlsx,.csv,.zip,image/*"
                  onChange={handleArchiveUpload}
                  className="hidden"
                />
              </label>
            </Card>
          )}

          <Card className="space-y-2">
            <h3 className="font-display text-sm font-bold text-fg">社團私密檔案清冊（下載皆寫入稽核紀錄）</h3>
            {archiveFiles.length === 0 ? (
              <p className="text-sm text-fg-subtle">目前尚無私密評鑑歸檔檔案。</p>
            ) : (
              archiveFiles.map((f) => (
                <div
                  key={f.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-subtle p-3 text-sm"
                >
                  <div>
                    <p className="font-bold text-fg">{f.title}</p>
                    <p className="text-fg-subtle">
                      分類：{ARCHIVE_CATEGORY_LABEL[f.archive_category] ?? f.archive_category} · 發生日：{f.occurred_on} ·{' '}
                      {Math.round(f.size_bytes / 1024)} KB
                    </p>
                  </div>
                  <Button
                    
                    onClick={() => handleDownloadArchive(f.id)}
                    disabled={busy === `dl-${f.id}`} variant="secondary" size="sm">
                    <Download className="h-3 w-3" />
                    5 分鐘簽章下載
                  </Button>
                </div>
              ))
            )}
          </Card>
        </div>
      )}

      {/* HANDOVER TAB */}
      {tab === 'handover' && (
        <div className="space-y-6">
          {data.pendingHandover && (
            <Notice tone="warning">
              目前有進行中的社長交接邀請：等待 {data.pendingHandover.toUserName} 於{' '}
              {formatTaipeiDate(data.pendingHandover.expiresAt)} 前接受。
            </Notice>
          )}

          {isOwner && !data.pendingHandover && (
            <form
              onSubmit={handleStartHandover}
              className="tactile-card space-y-4 rounded-2xl bg-surface p-5 sm:p-6"
            >
              <h2 className="font-display text-base font-bold text-fg">
                發起 3 步換屆交接 ＆ 撰寫下屆避雷便條
              </h2>
              <p className="text-sm text-fg-muted">
                只有接任社長的信箱是必填。三則備忘都可以先空著，之後再補；對方確認後，系統會自動把您轉為歷屆校友並保留歸檔權限。
              </p>
              <div className="min-w-0 flex-1 space-y-1.5 *:w-full">
                <label htmlFor="club-manage-handoveremail" className="block text-sm font-medium text-fg-body">
                  接任社長的學校信箱
                  <span className="ml-1 font-normal text-fg-muted">（必填）</span>
                </label>
                <input id="club-manage-handoveremail"
                  type="email"
                  required
                  value={handoverEmail}
                  onChange={(e) => setHandoverEmail(e.target.value)}
                  placeholder="例如 s1234567@cc.ncu.edu.tw"
                  className={`${controlClasses} min-h-11 w-full`}
                />
              </div>
              <div className="min-w-0 flex-1 space-y-1.5 *:w-full">
                <label htmlFor="club-manage-venuetips" className="block text-sm font-medium text-fg-body">
                  場地與器材眉角
                  <span className="ml-1 font-normal text-fg-muted">（選填）</span>
                </label>
                <textarea id="club-manage-venuetips"
                  rows={2}
                  value={venueTips}
                  onChange={(e) => setVenueTips(e.target.value)}
                  placeholder="場地申請與器材眉角（例如：活動中心投影機借用要提前一週）"
                  className={`${controlClasses} min-h-24 py-2.5 leading-relaxed w-full`}
                />
              </div>
              <div className="min-w-0 flex-1 space-y-1.5 *:w-full">
                <label htmlFor="club-manage-hoursdeadlines" className="block text-sm font-medium text-fg-body">
                  時數認證與核銷期限
                  <span className="ml-1 font-normal text-fg-muted">（選填）</span>
                </label>
                <textarea id="club-manage-hoursdeadlines"
                  rows={2}
                  value={hoursDeadlines}
                  onChange={(e) => setHoursDeadlines(e.target.value)}
                  placeholder="學習時數認證與經費核銷死線"
                  className={`${controlClasses} min-h-24 py-2.5 leading-relaxed w-full`}
                />
              </div>
              <div className="min-w-0 flex-1 space-y-1.5 *:w-full">
                <label htmlFor="club-manage-contactsvendors" className="block text-sm font-medium text-fg-body">
                  常用廠商與維修窗口
                  <span className="ml-1 font-normal text-fg-muted">（選填）</span>
                </label>
                <textarea id="club-manage-contactsvendors"
                  rows={2}
                  value={contactsVendors}
                  onChange={(e) => setContactsVendors(e.target.value)}
                  placeholder="常用廠商／器材維修窗口備忘"
                  className={`${controlClasses} min-h-24 py-2.5 leading-relaxed w-full`}
                />
              </div>
              <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 text-sm text-fg-secondary">
                <input
                  type="checkbox"
                  checked={shareDeid}
                  onChange={(e) => setShareDeid(e.target.checked)}
                  className="h-4 w-4 rounded accent-brand"
                />
                <span>
                  同意將以上去識別化經驗公開至「一起聚 → 前輩請益與筆記」（個人與社團聯絡方式不會公開）
                </span>
              </label>
              <Button
                type="submit"
                disabled={busy === 'handover'} variant="primary" size="md">
                送出交接邀請與避雷便條
              </Button>
            </form>
          )}

          <Card className="space-y-3">
            <h2 className="font-display text-base font-bold text-fg">歷屆交接避雷便條（僅幹部／校友可見）</h2>
            {data.handoverNotes.length === 0 ? (
              <p className="text-sm text-fg-subtle">尚無交接備忘錄。</p>
            ) : (
              data.handoverNotes.map((n) => (
                <div
                  key={n.id}
                  className="space-y-1 rounded-xl bg-surface-subtle p-4 text-sm text-fg-secondary"
                >
                  <p className="font-bold text-fg">記錄日期：{formatTaipeiDate(n.createdAt)}</p>
                  {n.venueTips && <p>場地眉角：{n.venueTips}</p>}
                  {n.hoursAndDeadlines && <p>時數與死線：{n.hoursAndDeadlines}</p>}
                  {n.contactsAndVendors && <p>廠商窗口：{n.contactsAndVendors}</p>}
                </div>
              ))
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
