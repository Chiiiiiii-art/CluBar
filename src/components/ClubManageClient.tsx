'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Archive,
  ArrowRightLeft,
  Calendar,
  Check,
  Copy,
  Download,
  FileText,
  Film,
  HelpCircle,
  KeyRound,
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

import { Notice, Tabs, buttonClasses, controlClasses, useConfirm } from '@/components/ui';
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

export function ClubManageClient({ data }: { data: ManageClubData }) {
  const confirm = useConfirm();
  const isReadOnlyAlumni = data.myRole === 'alumni';
  const canWrite = !isReadOnlyAlumni;
  const isOwner = data.myRole === 'owner';

  const [tab, setTab] = useState<
    'events' | 'posts' | 'members' | 'questions' | 'evaluation' | 'handover'
  >(isReadOnlyAlumni ? 'evaluation' : 'events');

  const [bannerMsg, setBannerMsg] = useState<string | null>(null);
  const [bannerErr, setBannerErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Events state
  const [eventsList, setEventsList] = useState(data.events);
  const [evTitle, setEvTitle] = useState('');
  const [evSummary, setEvSummary] = useState('');
  const [evDesc, setEvDesc] = useState('');
  const [evTheme, setEvTheme] = useState<
    'warm_paper' | 'campus_blue' | 'forest_trail' | 'midnight_jam'
  >('warm_paper');
  const [evMode, setEvMode] = useState<'scheduled' | 'tbd' | 'voting'>('scheduled');
  const [evStart, setEvStart] = useState('');
  const [evEnd, setEvEnd] = useState('');
  const [evLocation, setEvLocation] = useState('TBD 待定');
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
  const [aiRawText, setAiRawText] = useState('');
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
        location_text: evLocation.trim() || 'TBD 待定',
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
      setBannerMsg(`活動已發布！專屬短網址：/e/${json.event.short_code}`);
    } catch (err) {
      setBannerErr(err instanceof Error ? err.message : '建立活動失敗');
    } finally {
      setBusy(null);
    }
  }

  async function handleAiDraftSubmit(file: File | null) {
    setBusy('ai-draft');
    setBannerErr(null);
    setBannerMsg(null);
    try {
      const fd = new FormData();
      fd.append('club_id', data.club.id);
      if (aiRawText.trim()) fd.append('raw_text', aiRawText.trim());
      if (file) fd.append('file', file);

      const res = await fetch('/api/ai/draft-from-raw', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || 'AI 解析失敗');
      setAiResult(json);
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

  function applyAiToEvent() {
    if (!aiResult) return;
    const d = aiResult.draft;
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
    setTab('events');
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
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-300 bg-white p-5">
        <div>
          <p className="text-sm font-semibold text-ink-500">
            {data.club.universityName} · 您的權限：{data.myRole}
          </p>
          <h1 className="text-xl font-bold text-ink-900">{data.club.name} 管理後台</h1>
        </div>
        <Link
          href={`/clubs/${data.club.slug}`}
          className={buttonClasses({ variant: 'secondary', size: 'md' })}
        >
          查看公開門面
        </Link>
      </div>

      {isReadOnlyAlumni && (
        <div className="rounded-xl border border-accent-200 bg-accent-50 px-4 py-3 text-sm font-semibold text-accent-900">
          您目前為歷屆幹部／校友（只讀檢視權限）：可查閱私密評鑑歸檔、匯出年度成果報告與歷屆避雷便條，無法異動現任活動或成員權限。
        </div>
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
          {canWrite && (
            <form
              onSubmit={handleCreateEvent}
              className="space-y-4 rounded-xl border border-ink-300 bg-white p-6"
            >
              <h2 className="text-base font-bold text-ink-900">建立體驗活動</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="club-manage-evtitle" className="mb-1 block text-sm font-semibold text-ink-700">活動名稱 *</label>
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
                  <label htmlFor="club-manage-evtheme" className="mb-1 block text-sm font-semibold text-ink-700">主題底色</label>
                  <select id="club-manage-evtheme"
                    value={evTheme}
                    onChange={(e) => setEvTheme(e.target.value as typeof evTheme)}
                    className={`${controlClasses} min-h-11 w-full`}
                  >
                    <option value="warm_paper">暖陽松果 (Warm Paper)</option>
                    <option value="campus_blue">晴空講義 (Campus Blue)</option>
                    <option value="forest_trail">山林野營 (Forest Trail)</option>
                    <option value="midnight_jam">暗房霓虹 (Midnight Jam)</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label htmlFor="club-manage-evmode" className="mb-1 block text-sm font-semibold text-ink-700">時程模式</label>
                  <select id="club-manage-evmode"
                    value={evMode}
                    onChange={(e) => setEvMode(e.target.value as typeof evMode)}
                    className={`${controlClasses} min-h-11 w-full`}
                  >
                    <option value="scheduled">已確定時間 (Scheduled)</option>
                    <option value="tbd">先刊登再定時間 (TBD)</option>
                    <option value="voting">讓同學投票喬時間／主題 (Voting)</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="club-manage-evlocation" className="mb-1 block text-sm font-semibold text-ink-700">地點 *</label>
                  <input id="club-manage-evlocation"
                    required
                    value={evLocation}
                    onChange={(e) => setEvLocation(e.target.value)}
                    className={`${controlClasses} min-h-11 w-full`}
                  />
                </div>
                <div>
                  <label htmlFor="club-manage-evfee" className="mb-1 block text-sm font-semibold text-ink-700">單次費用 (NT$)</label>
                  <input id="club-manage-evfee"
                    type="number"
                    min={0}
                    value={evFee}
                    onChange={(e) => setEvFee(e.target.value)}
                    className={`${controlClasses} min-h-11 w-full`}
                  />
                </div>
              </div>

              {evMode === 'scheduled' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="club-manage-evstart" className="mb-1 block text-sm font-semibold text-ink-700">開始時間 *</label>
                    <input id="club-manage-evstart"
                      type="datetime-local"
                      required
                      value={evStart}
                      onChange={(e) => setEvStart(e.target.value)}
                      className={`${controlClasses} min-h-11 w-full`}
                    />
                  </div>
                  <div>
                    <label htmlFor="club-manage-evend" className="mb-1 block text-sm font-semibold text-ink-700">結束時間（選填）</label>
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
                <div className="space-y-2 rounded-xl bg-ink-50 p-4">
                  <p className="text-sm font-semibold text-ink-800">設定投票選項（最多填 3 個候選項目）：</p>
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

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="min-w-0 flex-1 space-y-1.5 *:w-full">
                  <label htmlFor="club-manage-evsummary" className="block text-sm font-medium text-ink-800">
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
                <div className="min-w-0 flex-1 space-y-1.5 *:w-full">
                  <label htmlFor="club-manage-evprenotes" className="block text-sm font-medium text-ink-800">
                    行前提醒
                  </label>
                  <input id="club-manage-evprenotes"
                    value={evPreNotes}
                    onChange={(e) => setEvPreNotes(e.target.value)}
                    placeholder="行前提醒（例如：請穿好走運動鞋、社團會提供道具）"
                    className={`${controlClasses} min-h-11`}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="min-w-0 flex-1 space-y-1.5 *:w-full">
                  <label htmlFor="club-manage-evhourscat" className="block text-sm font-medium text-ink-800">
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
                  <label htmlFor="club-manage-evhourscount" className="block text-sm font-medium text-ink-800">
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
                <div className="min-w-0 flex-1 space-y-1.5 *:w-full">
                  <label htmlFor="club-manage-evexturl" className="block text-sm font-medium text-ink-800">
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
              </div>

              <div className="min-w-0 flex-1 space-y-1.5 *:w-full">
                <label htmlFor="club-manage-evdesc" className="block text-sm font-medium text-ink-800">
                  活動介紹
                </label>
                <textarea id="club-manage-evdesc"
                  rows={3}
                  value={evDesc}
                  onChange={(e) => setEvDesc(e.target.value)}
                  placeholder="完整活動介紹 Markdown（也可從「Vision 海報 AI」分頁一鍵抽取填入）"
                  className={`${controlClasses} min-h-24 py-2.5 leading-relaxed w-full`}
                />
              </div>

              <ImageUploader
                clubId={data.club.id}
                value={evCover}
                onChange={setEvCover}
                maxImages={1}
                purpose="club_cover"
              />

              <div className="flex flex-wrap gap-4 text-sm font-medium text-ink-700">
                <label className="flex cursor-pointer items-center gap-1.5">
                  <input type="checkbox" checked={evBeginner} onChange={(e) => setEvBeginner(e.target.checked)} />
                  零基礎友善
                </label>
                <label className="flex cursor-pointer items-center gap-1.5">
                  <input type="checkbox" checked={evNonMember} onChange={(e) => setEvNonMember(e.target.checked)} />
                  非社員歡迎體驗
                </label>
                <label className="flex cursor-pointer items-center gap-1.5">
                  <input type="checkbox" checked={evCampusOnly} onChange={(e) => setEvCampusOnly(e.target.checked)} />
                  限本校 .edu.tw 報名
                </label>
                <label className="flex cursor-pointer items-center gap-1.5">
                  <input type="checkbox" checked={evIncludeEval} onChange={(e) => setEvIncludeEval(e.target.checked)} />
                  納入本學年評鑑報表
                </label>
              </div>

              <button
                type="submit"
                disabled={busy === 'create-event' || evTitle.trim().length < 2}
                className={buttonClasses({ variant: 'primary', size: 'md' })}
              >
                {busy === 'create-event' ? '建立中...' : '發布活動並產生專屬短網址'}
              </button>
            </form>
          )}

          <div className="space-y-3 rounded-xl border border-line bg-white p-5">
            <h2 className="text-base font-bold text-ink-900">近期活動清單</h2>
            {eventsList.map((ev) => (
              <div
                key={ev.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-ink-100 p-4"
              >
                <div>
                  <p className="text-sm font-semibold text-ink-900">{ev.title}</p>
                  <p className="text-sm text-ink-500">
                    模式：{ev.scheduleMode} · 狀態：{ev.status}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {canWrite && (
                    <label className="flex cursor-pointer items-center gap-1 text-sm font-semibold text-ink-700">
                      <input
                        type="checkbox"
                        checked={ev.includeInEvaluation}
                        onChange={(e) => handleToggleEvalItem('event', ev.id, e.target.checked)}
                      />
                      列入評鑑
                    </label>
                  )}
                  <Link
                    href={`/e/${ev.shortCode}`}
                    className="rounded-xl bg-white px-3 py-1.5 text-sm font-semibold text-accent-700"
                  >
                    /e/{ev.shortCode}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* POSTS & VISION AI TAB */}
      {tab === 'posts' && (
        <div className="space-y-6">
          {canWrite && (
            <>
              <div className="space-y-3 rounded-xl border border-accent-200 bg-ink-50 p-6">
                <h2 className="flex items-center gap-2 text-base font-bold text-ink-900">
                  <Sparkles className="h-4 w-4 text-accent-600" />
                  Vision AI 海報辨識 ＆ 零散文案整理（不捏造日期與費用）
                </h2>
                <div className="min-w-0 flex-1 space-y-1.5 *:w-full">
                  <label htmlFor="club-manage-airawtext" className="block text-sm font-medium text-ink-800">
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
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-ink-900 px-4 py-2 text-sm font-semibold text-white">
                    <Upload className="h-3.5 w-3.5" />
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
                  <button
                    type="button"
                    disabled={busy === 'ai-draft' || aiRawText.trim().length < 20}
                    onClick={() => handleAiDraftSubmit(null)}
                    className={buttonClasses({ variant: 'secondary', size: 'md' })}
                  >
                    僅解析文字草稿
                  </button>
                </div>

                {aiResult &&
                  (() => {
                    const preferEvent = shouldRouteDraftToEvent(aiResult.draft, aiRawText);
                    return (
                      <div className="space-y-2 rounded-xl bg-white p-4 text-sm">
                        {aiResult.degraded && (
                          <p className="font-bold text-warning-800">
                            {aiResult.warnings.join(' ')}
                          </p>
                        )}
                        <p className="font-bold text-ink-900">抽出標題：{aiResult.draft.title}</p>
                        <p className="text-ink-700">{aiResult.draft.summary}</p>
                        {preferEvent && (
                          <p className="rounded-xl border border-accent-200 bg-accent-50 px-3 py-2 font-semibold text-accent-950">
                            偵測到活動招募／時間地點資訊：建議直接「帶入建立活動」開放報名或投票時間，避免活動宣傳海報混入日常動態牆。
                          </p>
                        )}
                        {aiResult.draft.missing_beginner_fields.length > 0 && (
                          <p className="font-semibold text-accent-800">
                            新手資訊建議補填：{aiResult.draft.missing_beginner_fields.join('、')}
                          </p>
                        )}
                        {aiResult.draft.poster_text_heavy && (
                          <p className="font-semibold text-accent-800">
                            偵測到海報文字較密，建議補純文字時間地點以利搜尋與閱讀。
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2 pt-2">
                          <button
                            type="button"
                            onClick={applyAiToEvent}
                            className={`min-h-[44px] rounded-full px-4 font-bold ${
                              preferEvent
                                ? 'bg-accent-600 text-white'
                                : 'border border-ink-300 bg-white text-ink-800 hover:bg-ink-50'
                            }`}
                          >
                            帶入「建立活動」表單
                          </button>
                          <button
                            type="button"
                            onClick={applyAiToPost}
                            className={`min-h-[44px] rounded-full px-4 font-bold ${
                              preferEvent
                                ? 'border border-ink-300 bg-white text-ink-600 hover:bg-ink-50'
                                : 'bg-accent-600 text-white'
                            }`}
                          >
                            {preferEvent ? '仍要帶入「作品／日常」表單' : '帶入下方「作品／日常」表單'}
                          </button>
                        </div>
                      </div>
                    );
                  })()}
              </div>

              <form
                onSubmit={handlePublishPost}
                className="space-y-4 rounded-xl border border-line bg-white p-6"
              >
                <h2 className="text-base font-bold text-ink-900">發布社團日常／實作作品</h2>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="min-w-0 flex-1 space-y-1.5 *:w-full">
                    <label htmlFor="club-manage-postkind" className="block text-sm font-medium text-ink-800">
                      內容類型
                    </label>
                    <select id="club-manage-postkind"
                      value={postKind}
                      onChange={(e) => setPostKind(e.target.value as 'nrc_moment' | 'wip_work')}
                      className={`${controlClasses} min-h-11`}
                    >
                      <option value="wip_work">實作作品 (WIP Work)</option>
                      <option value="nrc_moment">社員日常 (NRC Moment)</option>
                    </select>
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5 *:w-full">
                    <label htmlFor="club-manage-postheadline" className="block text-sm font-medium text-ink-800">
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
                  <label htmlFor="club-manage-postcontentmd" className="block text-sm font-medium text-ink-800">
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
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-ink-300 px-3 py-1.5 text-sm font-semibold text-ink-700">
                  <Film className="h-3.5 w-3.5 text-accent-600" />
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
                <button
                  type="submit"
                  disabled={busy === 'post' || postMedia.length === 0 || !postOrig}
                  className={buttonClasses({ variant: 'primary', size: 'md' })}
                >
                  立即發布
                </button>
              </form>
            </>
          )}

          <div className="space-y-3 rounded-xl border border-line bg-white p-5">
            <h2 className="text-base font-bold text-ink-900">已發布內容與評鑑標記</h2>
            {postsList.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-ink-100 p-4"
              >
                <div>
                  <span className="text-xs font-bold text-accent-800">
                    {POST_KIND_LABELS[p.postKind].label}
                  </span>
                  <p className="text-sm font-semibold text-ink-900">{p.headline}</p>
                </div>
                <div className="flex items-center gap-3">
                  {canWrite && (
                    <label className="flex cursor-pointer items-center gap-1 text-sm font-semibold text-ink-700">
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
                    className="rounded-xl bg-white px-3 py-1.5 text-sm font-semibold text-ink-800"
                  >
                    檢視
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MEMBERS TAB */}
      {tab === 'members' && (
        <div className="space-y-6">
          {canWrite && (
            <div className="space-y-4 rounded-xl border border-line bg-white p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-base font-bold text-ink-900">
                  <KeyRound className="h-4 w-4 text-accent-600" />
                  軌一：產生社員限時邀請碼（嚴格限同校 .edu.tw）
                </h2>
                <button
                  type="button"
                  onClick={handleGenerateInviteCode}
                  disabled={busy === 'invite-code'}
                  className={buttonClasses({ variant: 'primary', size: 'sm' })}
                >
                  產生 7 天邀請碼
                </button>
              </div>
              {inviteCodes.length > 0 && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {inviteCodes.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between rounded-xl border border-line bg-ink-50 px-3 py-2 text-sm"
                    >
                      <div>
                        <span className="font-mono font-bold text-ink-900">{c.code}</span>
                        <p className="text-xs text-ink-500">
                          已使用 {c.used_count} 次 · 到期 {c.expires_at.slice(0, 10)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText(c.code)}
                        className="inline-flex items-center gap-1 font-bold text-accent-600"
                      >
                        <Copy className="h-3 w-3" />
                        複製
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {canWrite && (
            <div className="space-y-3 rounded-xl border border-line bg-white p-6">
              <h2 className="text-base font-bold text-ink-900">軌二：待審入社認證申請</h2>
              {joinRequests.length === 0 ? (
                <p className="text-sm text-ink-500">尚無待審入社申請。</p>
              ) : (
                joinRequests.map((r) => (
                  <div
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-ink-50 p-3 text-sm"
                  >
                    <div>
                      <p className="font-bold text-ink-900">{r.display_name}</p>
                      {r.note && <p className="text-ink-600">{r.note}</p>}
                    </div>
                    {r.status === 'pending' ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleReviewMemberRequest(r.id, 'approve')}
                          className="rounded-full bg-success-600 px-3 py-1 font-bold text-white"
                        >
                          核准為認證社員
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReviewMemberRequest(r.id, 'reject')}
                          className="rounded-full border border-danger-200 px-3 py-1 font-bold text-danger-700"
                        >
                          婉拒
                        </button>
                      </div>
                    ) : (
                      <span className="font-bold text-ink-600">{r.status}</span>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {canWrite && (
            <form
              onSubmit={handleAddMember}
              className="space-y-3 rounded-xl border border-line bg-white p-6"
            >
              <h2 className="text-base font-bold text-ink-900">手動新增幹部／社員</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="min-w-0 flex-1 space-y-1.5 *:w-full">
                  <label htmlFor="club-manage-targetmemberemail" className="block text-sm font-medium text-ink-800">
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
                  <label htmlFor="club-manage-targetmemberrole" className="block text-sm font-medium text-ink-800">
                    身分
                  </label>
                  <select id="club-manage-targetmemberrole"
                    value={targetMemberRole}
                    onChange={(e) => setTargetMemberRole(e.target.value as 'editor' | 'member')}
                    className={`${controlClasses} min-h-11`}
                  >
                    <option value="member">認證社員 (Member)</option>
                    {isOwner && <option value="editor">幹部 (Editor)</option>}
                  </select>
                </div>
                <div className="min-w-0 flex-1 space-y-1.5 *:w-full">
                  <label htmlFor="club-manage-targetmembertitle" className="block text-sm font-medium text-ink-800">
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
              <button
                type="submit"
                disabled={busy === 'add-member'}
                className="rounded-full bg-ink-900 px-4 py-1.5 text-sm font-semibold text-white"
              >
                確認新增
              </button>
            </form>
          )}

          <div className="space-y-2 rounded-xl border border-line bg-white p-5">
            <h2 className="text-base font-bold text-ink-900">成員與歷屆名單</h2>
            {data.members.map((m, idx) => (
              <div
                key={`${m.userId}-${idx}`}
                className="flex items-center justify-between rounded-xl bg-ink-100 px-4 py-3 text-sm"
              >
                <span className="font-bold text-ink-900">
                  {m.displayName} {m.title ? `（${m.title}）` : ''}
                </span>
                <span className="text-sm font-semibold text-ink-600">
                  {m.role} {m.endedAt ? '· 已卸任' : '· 現行有效'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* QUESTIONS & FAQ TAB */}
      {tab === 'questions' && (
        <div className="space-y-4 rounded-xl border border-line bg-white p-6">
          <h2 className="text-base font-bold text-ink-900">新生問答收件匣 ＆ 置頂 FAQ 管理</h2>
          {questionsInbox.length === 0 ? (
            <p className="text-sm text-ink-500">目前尚無提問。</p>
          ) : (
            questionsInbox.map((q) => {
              const draft = replyDrafts[q.id] ?? {
                text: '',
                pub: true,
                pin: false,
                highlight: false,
              };
              return (
                <div key={q.id} className="space-y-2 rounded-xl bg-ink-50 p-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-ink-900">
                      {q.display_asker}：{q.question_text}
                    </span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-ink-600">
                      {q.status}
                    </span>
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
                        <button
                          type="button"
                          onClick={() => handleReplyQuestion(q.id)}
                          disabled={busy === `reply-${q.id}`}
                          className={buttonClasses({ variant: 'primary', size: 'sm' })}
                        >
                          儲存並回覆
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* PRIVATE EVAL ARCHIVE & EXPORT TAB */}
      {tab === 'evaluation' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-300 bg-white p-6">
            <div>
              <h2 className="text-base font-bold text-ink-900">
                一鍵匯出年度評鑑報告（含 Co-Club 共辦實績與內部索引）
              </h2>
              <p className="text-sm text-ink-600">
                預設採計上學年 5 月 1 日至當年 5 月 31 日，僅整合有勾選「納入評鑑」之內容。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/clubs/${data.club.slug}/evaluation/print`}
                className="inline-flex items-center gap-1.5 rounded-full bg-ink-900 px-4 py-2 text-sm font-semibold text-white"
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
          </div>

          {canWrite && (
            <div className="space-y-3 rounded-xl border border-line bg-white p-6">
              <h3 className="text-sm font-semibold text-ink-900">
                上傳私密內部評鑑檔案（Private Azure 容器，至少保存 6 年）
              </h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="min-w-0 flex-1 space-y-1.5 *:w-full">
                  <label htmlFor="club-manage-archtitle" className="block text-sm font-medium text-ink-800">
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
                  <label htmlFor="club-manage-archcategory" className="block text-sm font-medium text-ink-800">
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
                  <label htmlFor="club-manage-archdate" className="block text-sm font-medium text-ink-800">
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
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-accent-600 px-4 py-2 text-sm font-semibold text-white">
                <Upload className="h-3.5 w-3.5" />
                {busy === 'arch-up' ? '上傳私密容器中...' : '選擇 PDF / DOCX / XLSX / CSV / ZIP (≤20MB)'}
                <input
                  type="file"
                  accept=".pdf,.docx,.xlsx,.csv,.zip,image/*"
                  onChange={handleArchiveUpload}
                  className="hidden"
                />
              </label>
            </div>
          )}

          <div className="space-y-2 rounded-xl border border-line bg-white p-6">
            <h3 className="text-sm font-semibold text-ink-900">社團私密檔案清冊（下載皆寫入稽核紀錄）</h3>
            {archiveFiles.length === 0 ? (
              <p className="text-sm text-ink-500">目前尚無私密評鑑歸檔檔案。</p>
            ) : (
              archiveFiles.map((f) => (
                <div
                  key={f.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-ink-50 p-3 text-sm"
                >
                  <div>
                    <p className="font-bold text-ink-900">{f.title}</p>
                    <p className="text-ink-500">
                      分類：{f.archive_category} · 發生日：{f.occurred_on} ·{' '}
                      {Math.round(f.size_bytes / 1024)} KB
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDownloadArchive(f.id)}
                    disabled={busy === `dl-${f.id}`}
                    className={buttonClasses({ variant: 'secondary', size: 'sm' })}
                  >
                    <Download className="h-3 w-3" />
                    5 分鐘簽章下載
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* HANDOVER TAB */}
      {tab === 'handover' && (
        <div className="space-y-6">
          {data.pendingHandover && (
            <div className="rounded-xl border border-warning-300 bg-warning-50 p-4 text-sm font-semibold text-warning-950">
              目前有進行中的社長交接邀請：等待 {data.pendingHandover.toUserName} 於{' '}
              {formatTaipeiDate(data.pendingHandover.expiresAt)} 前接受。
            </div>
          )}

          {isOwner && !data.pendingHandover && (
            <form
              onSubmit={handleStartHandover}
              className="space-y-4 rounded-xl border border-ink-300 bg-white p-6"
            >
              <h2 className="text-base font-bold text-ink-900">
                發起 3 步換屆交接 ＆ 撰寫下屆避雷便條
              </h2>
              <p className="text-sm text-ink-600">
                填寫下屆接任社長同校 .edu.tw 信箱，並留下場地／核銷／廠商實務備忘；對方確認後系統自動將您轉為歷屆校友保留歸檔權限。
              </p>
              <div className="min-w-0 flex-1 space-y-1.5 *:w-full">
                <label htmlFor="club-manage-handoveremail" className="block text-sm font-medium text-ink-800">
                  接任社長的學校信箱
                </label>
                <input id="club-manage-handoveremail"
                  type="email"
                  required
                  value={handoverEmail}
                  onChange={(e) => setHandoverEmail(e.target.value)}
                  placeholder="接任社長的同校 .edu.tw 信箱 *"
                  className={`${controlClasses} min-h-11 w-full`}
                />
              </div>
              <div className="min-w-0 flex-1 space-y-1.5 *:w-full">
                <label htmlFor="club-manage-venuetips" className="block text-sm font-medium text-ink-800">
                  場地與器材眉角
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
                <label htmlFor="club-manage-hoursdeadlines" className="block text-sm font-medium text-ink-800">
                  時數認證與核銷期限
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
                <label htmlFor="club-manage-contactsvendors" className="block text-sm font-medium text-ink-800">
                  常用廠商與維修窗口
                </label>
                <textarea id="club-manage-contactsvendors"
                  rows={2}
                  value={contactsVendors}
                  onChange={(e) => setContactsVendors(e.target.value)}
                  placeholder="常用廠商／器材維修窗口備忘"
                  className={`${controlClasses} min-h-24 py-2.5 leading-relaxed w-full`}
                />
              </div>
              <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 text-sm text-ink-700">
                <input
                  type="checkbox"
                  checked={shareDeid}
                  onChange={(e) => setShareDeid(e.target.checked)}
                  className="h-4 w-4 rounded accent-accent-600"
                />
                <span>
                  同意將以上去識別化經驗公開至「一起聚 → 前輩請益與筆記」（個人與社團聯絡方式不會公開）
                </span>
              </label>
              <button
                type="submit"
                disabled={busy === 'handover'}
                className={buttonClasses({ variant: 'primary', size: 'md' })}
              >
                送出交接邀請與避雷便條
              </button>
            </form>
          )}

          <div className="space-y-3 rounded-xl border border-line bg-white p-5">
            <h2 className="text-base font-bold text-ink-900">歷屆交接避雷便條（僅幹部／校友可見）</h2>
            {data.handoverNotes.length === 0 ? (
              <p className="text-sm text-ink-500">尚無交接備忘錄。</p>
            ) : (
              data.handoverNotes.map((n) => (
                <div
                  key={n.id}
                  className="space-y-1 rounded-xl bg-ink-100 p-4 text-sm text-ink-700"
                >
                  <p className="font-bold text-ink-900">記錄日期：{formatTaipeiDate(n.createdAt)}</p>
                  {n.venueTips && <p>場地眉角：{n.venueTips}</p>}
                  {n.hoursAndDeadlines && <p>時數與死線：{n.hoursAndDeadlines}</p>}
                  {n.contactsAndVendors && <p>廠商窗口：{n.contactsAndVendors}</p>}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
