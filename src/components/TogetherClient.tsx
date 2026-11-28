'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Compass,
  HandHeart,
  Link2,
  Plus,
  Send,
  Sparkles,
  Users,
} from 'lucide-react';
import { TOGETHER_ITEM_TYPE_LABELS } from '@/lib/constants';
import type { PublicTogetherItemDTO } from '@/lib/serializers';

import {
  Badge,
  Button,
  ChipRow,
  EmptyState,
  FilterChip,
  Notice,
  PageHeader,
  Tabs,
  buttonClasses,
  controlClasses,
} from '@/components/ui';

export interface TogetherJamDTO {
  id: string;
  title: string;
  summary: string;
  domain_id: string;
  domain_name: string;
  target_schools_count: number;
  needed_roles: string[];
  collab_format: string;
  deadline_at: string;
  host_club: {
    id: string;
    slug: string;
    name: string;
    university_short_name: string;
  };
}

export interface PracticalResourceDTO {
  id: string;
  domain_id: string;
  domain_name: string;
  source_university_short_name: string;
  title: string;
  content_md: string;
  created_at: string;
}

export interface AlumniMentorDTO {
  user_id: string;
  display_name: string;
  handle: string | null;
  university_short_name: string;
  expertise_tags: string[];
  clubs: { slug: string; name: string; title: string | null; role: string }[];
}

const DOMAIN_TINTS = [
  'bg-domain-academic-soft',
  'bg-domain-arts-soft',
  'bg-domain-recreation-soft',
  'bg-domain-sports-soft',
  'bg-domain-service-soft',
  'bg-domain-social-soft',
];

export function TogetherClient({
  domains,
  initialItems,
  initialJams,
  initialResources,
  myMemberships,
  isCampusVerified,
}: {
  domains: { id: string; slug: string; name_zh: string }[];
  initialItems: PublicTogetherItemDTO[];
  initialJams: TogetherJamDTO[];
  initialResources: PracticalResourceDTO[];
  myMemberships: { clubId: string; slug: string; name: string; role: string }[];
  isCampusVerified: boolean;
}) {
  const [subTab, setSubTab] = useState<'stage' | 'jam' | 'mentors'>('stage');
  const [selectedDomain, setSelectedDomain] = useState('');
  const [items, setItems] = useState(initialItems);
  const [jams, setJams] = useState(initialJams);
  const [resources, setResources] = useState(initialResources);
  const [alumni, setAlumni] = useState<AlumniMentorDTO[]>([]);
  const [alumniLoaded, setAlumniLoaded] = useState(false);

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // New stage item composer
  const [showStageForm, setShowStageForm] = useState(false);
  const [clubId, setClubId] = useState(myMemberships[0]?.clubId ?? '');
  const [domainId, setDomainId] = useState(domains[0]?.id ?? '');
  const [itemType, setItemType] = useState<
    'showcase' | 'field_log' | 'match_invite' | 'reading_notes'
  >('showcase');
  const [title, setTitle] = useState('');
  const [contentMd, setContentMd] = useState('');
  const [embedUrl, setEmbedUrl] = useState('');

  // New Jam composer (officers)
  const officerClubs = myMemberships.filter((m) => ['owner', 'editor'].includes(m.role));
  const [showJamForm, setShowJamForm] = useState(false);
  const [jamClubId, setJamClubId] = useState(officerClubs[0]?.clubId ?? '');
  const [jamDomainId, setJamDomainId] = useState(domains[0]?.id ?? '');
  const [jamTitle, setJamTitle] = useState('');
  const [jamSummary, setJamSummary] = useState('');
  const [jamFormat, setJamFormat] = useState('跨校線上週會＋實體合展');
  const [jamRoles, setJamRoles] = useState('美術設計, 音效配樂');

  // Alumni ping modal state
  const [pingTarget, setPingTarget] = useState<AlumniMentorDTO | null>(null);
  const [pingTag, setPingTag] = useState('');
  const [pingMessage, setPingMessage] = useState('');

  // Resource composer
  const [resTitle, setResTitle] = useState('');
  const [resContent, setResContent] = useState('');
  const [resDomainId, setResDomainId] = useState(domains[0]?.id ?? '');

  const filteredItems = selectedDomain
    ? items.filter((item) => item.domain_id === selectedDomain)
    : items;
  const filteredJams = selectedDomain
    ? jams.filter((j) => j.domain_id === selectedDomain)
    : jams;
  const filteredResources = selectedDomain
    ? resources.filter((r) => r.domain_id === selectedDomain)
    : resources;

  async function openMentorsTab() {
    setSubTab('mentors');
    if (isCampusVerified && !alumniLoaded) {
      const res = await fetch('/api/together/alumni');
      if (res.ok) {
        const j = await res.json();
        setAlumni(j.alumni ?? []);
        setAlumniLoaded(true);
      }
    }
  }

  async function handleCreateItem(e: React.FormEvent) {
    e.preventDefault();
    setBusy('create-item');
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch('/api/together/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          club_id: clubId,
          domain_id: domainId,
          item_type: itemType,
          title: title.trim(),
          content_md: contentMd.trim(),
          embed_url: embedUrl.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || '發表失敗');
      setItems((prev) => [json.item, ...prev]);
      setTitle('');
      setContentMd('');
      setEmbedUrl('');
      setShowStageForm(false);
      setMsg('已發布至跨校同好實作舞台！');
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : '發表失敗');
    } finally {
      setBusy(null);
    }
  }

  async function handleCreateJam(e: React.FormEvent) {
    e.preventDefault();
    setBusy('create-jam');
    setErr(null);
    setMsg(null);
    try {
      const deadline = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString();
      const res = await fetch('/api/together/jams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host_club_id: jamClubId,
          domain_id: jamDomainId,
          title: jamTitle.trim(),
          summary: jamSummary.trim(),
          target_schools_count: 2,
          needed_roles: jamRoles
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          collab_format: jamFormat.trim(),
          deadline_at: deadline,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || '建立共作企劃失敗');
      setShowJamForm(false);
      setJamTitle('');
      setJamSummary('');
      const refreshed = await fetch('/api/together/jams');
      if (refreshed.ok) {
        const j = await refreshed.json();
        setJams(j.jams ?? []);
      }
      setMsg('跨校共作企劃已公開徵集！');
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : '建立失敗');
    } finally {
      setBusy(null);
    }
  }

  async function handleSendPing(e: React.FormEvent) {
    e.preventDefault();
    if (!pingTarget) return;
    setBusy('ping');
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/together/alumni/${pingTarget.user_id}/ping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain_id: domains[0]?.id,
          expertise_tag: pingTag || pingTarget.expertise_tags[0] || '社團傳承',
          message: pingMessage.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || '送出請益失敗');
      setPingTarget(null);
      setPingMessage('');
      setMsg(`已禮貌寄出請益通知給 ${pingTarget.display_name}（每天上限 3 次）。`);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : '送出失敗');
    } finally {
      setBusy(null);
    }
  }

  async function handleCreateResource(e: React.FormEvent) {
    e.preventDefault();
    setBusy('res');
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch('/api/together/resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain_id: resDomainId,
          title: resTitle.trim(),
          content_md: resContent.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || '分享實務指南失敗');
      setResTitle('');
      setResContent('');
      const refresh = await fetch('/api/together/resources');
      if (refresh.ok) {
        const j = await refresh.json();
        setResources(j.resources ?? []);
      }
      setMsg('匿名實務指南已發布至跨校清單！');
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : '失敗');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <PageHeader title="一起聚" description="跨校看同好作品、找友社合作，或向學長姐請益。" />
        <Tabs
          variant="underline"
          label="一起聚分頁"
          idPrefix="together"
          value={subTab}
          onChange={(key) => (key === 'mentors' ? openMentorsTab() : setSubTab(key))}
          items={[
            { id: 'stage', label: '作品與接力', icon: <Compass className="h-4 w-4" aria-hidden="true" /> },
            { id: 'jam', label: `跨校合作（${jams.length}）`, icon: <Sparkles className="h-4 w-4" aria-hidden="true" /> },
            { id: 'mentors', label: '請益與筆記', icon: <BookOpen className="h-4 w-4" aria-hidden="true" /> },
          ]}
        />
        <ChipRow aria-label="興趣領域">
          <FilterChip selected={!selectedDomain} onClick={() => setSelectedDomain('')}>
            全部
          </FilterChip>
          {domains.map((d, idx) => (
            <FilterChip
              key={d.id}
              shapeIndex={idx + 1}
              tintClass={`${DOMAIN_TINTS[idx % DOMAIN_TINTS.length]} hover:bg-spark/60`}
              selected={selectedDomain === d.id}
              onClick={() => setSelectedDomain(d.id)}
            >
              {d.name_zh}
            </FilterChip>
          ))}
        </ChipRow>
      </div>

      {msg && (
        <Notice tone="success">{msg}</Notice>
      )}
      {err && (
        <Notice tone="danger">{err}</Notice>
      )}

      {/* SUBTAB 1: STAGE */}
      {subTab === 'stage' && (
        <div className="space-y-4">
          {myMemberships.length > 0 && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowStageForm((v) => !v)}
                className={buttonClasses({ variant: showStageForm ? 'secondary' : 'primary', size: 'md' })}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                {showStageForm ? '收合發表表單' : '代表社團發表作品／觀點'}
              </button>
            </div>
          )}

          {showStageForm && myMemberships.length > 0 && (
            <form
              onSubmit={handleCreateItem}
              className="space-y-3 rounded-2xl border-2 border-line bg-surface p-5 sm:p-6"
            >
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="min-w-0 flex-1 space-y-1.5 *:w-full">
                  <label htmlFor="together-clubid" className="block text-sm font-medium text-fg-body">
                    代表社團
                  </label>
                  <select id="together-clubid"
                    value={clubId}
                    onChange={(e) => setClubId(e.target.value)}
                    className={`${controlClasses} min-h-11`}
                  >
                    {myMemberships.map((m) => (
                      <option key={m.clubId} value={m.clubId}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="min-w-0 flex-1 space-y-1.5 *:w-full">
                  <label htmlFor="together-domainid" className="block text-sm font-medium text-fg-body">
                    興趣領域
                  </label>
                  <select id="together-domainid"
                    value={domainId}
                    onChange={(e) => setDomainId(e.target.value)}
                    className={`${controlClasses} min-h-11`}
                  >
                    {domains.map((d) => (
                      <option key={d.id} value={d.id}>
                        #{d.name_zh}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="min-w-0 flex-1 space-y-1.5 *:w-full">
                  <label htmlFor="together-itemtype" className="block text-sm font-medium text-fg-body">
                    類型
                  </label>
                  <select id="together-itemtype"
                    value={itemType}
                    onChange={(e) => setItemType(e.target.value as typeof itemType)}
                    className={`${controlClasses} min-h-11`}
                  >
                    <option value="showcase">作品試玩展示</option>
                    <option value="field_log">路線／實務紀錄</option>
                    <option value="match_invite">友社友誼邀約</option>
                    <option value="reading_notes">專題書單觀點</option>
                  </select>
                </div>
              </div>
              <div className="min-w-0 flex-1 space-y-1.5 *:w-full">
                <label htmlFor="together-title" className="block text-sm font-medium text-fg-body">
                  標題
                </label>
                <input id="together-title"
                  required
                  minLength={2}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="作品或交流主題名稱 *"
                  className={`${controlClasses} min-h-11 w-full`}
                />
              </div>
              <div className="min-w-0 flex-1 space-y-1.5 *:w-full">
                <label htmlFor="together-contentmd" className="block text-sm font-medium text-fg-body">
                  內容
                </label>
                <textarea id="together-contentmd"
                  required
                  minLength={10}
                  rows={3}
                  value={contentMd}
                  onChange={(e) => setContentMd(e.target.value)}
                  placeholder="分享製作心得、使用技術或希望友社接力討論的切入點..."
                  className={`${controlClasses} min-h-24 py-2.5 leading-relaxed w-full`}
                />
              </div>
              <div className="min-w-0 flex-1 space-y-1.5 *:w-full">
                <label htmlFor="together-embedurl" className="block text-sm font-medium text-fg-body">
                  預覽連結（選填）
                </label>
                <input id="together-embedurl"
                  type="url"
                  value={embedUrl}
                  onChange={(e) => setEmbedUrl(e.target.value)}
                  placeholder="選填安全預覽連結（限 itch.io / YouTube / Vimeo / SoundCloud / Figma / GitHub）"
                  className={`${controlClasses} min-h-11 w-full`}
                />
              </div>
              <Button type="submit" loading={busy === 'create-item'}>
                送出發布
              </Button>
            </form>
          )}

          {filteredItems.length === 0 ? (
            <EmptyState
              title="目前沒有符合此領域的作品或徵集"
              action={
                selectedDomain ? (
                  <Button variant="secondary" onClick={() => setSelectedDomain('')}>
                    查看全部領域
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {filteredItems.map((item) => (
                <Link
                  key={item.id}
                  href={`/together/${item.id}`}
                  className="tactile-card tactile-card-interactive tactile-press flex min-w-0 flex-col gap-3 rounded-2xl bg-surface p-5 text-left"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="accent">#{item.domain_name}</Badge>
                    <Badge>{TOGETHER_ITEM_TYPE_LABELS[item.item_type]}</Badge>
                    {item.embed_url && (
                      <Badge icon={<Link2 className="h-3 w-3" aria-hidden="true" />}>可試玩／預覽</Badge>
                    )}
                  </div>
                  <h2 className="font-display text-base font-bold text-fg">{item.title}</h2>
                  <p className="line-clamp-3 text-sm text-fg-muted">{item.content_md}</p>
                  <p className="mt-auto border-t-2 border-line pt-3 text-sm font-semibold text-brand-soft-fg">
                    {item.club.university_short_name} · {item.club.name}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 2: CROSS-CAMPUS JAMS */}
      {subTab === 'jam' && (
        <div className="space-y-4">
          {officerClubs.length > 0 && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowJamForm((v) => !v)}
                className={buttonClasses({ variant: showJamForm ? 'secondary' : 'primary', size: 'md' })}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                {showJamForm ? '收合徵集表單' : '發起跨校共作企劃'}
              </button>
            </div>
          )}

          {showJamForm && officerClubs.length > 0 && (
            <form
              onSubmit={handleCreateJam}
              className="space-y-3 rounded-2xl border-2 border-line bg-surface p-5 sm:p-6"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="min-w-0 flex-1 space-y-1.5 *:w-full">
                  <label htmlFor="together-jamclubid" className="block text-sm font-medium text-fg-body">
                    發起社團
                  </label>
                  <select id="together-jamclubid"
                    value={jamClubId}
                    onChange={(e) => setJamClubId(e.target.value)}
                    className={`${controlClasses} min-h-11`}
                  >
                    {officerClubs.map((c) => (
                      <option key={c.clubId} value={c.clubId}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="min-w-0 flex-1 space-y-1.5 *:w-full">
                  <label htmlFor="together-jamdomainid" className="block text-sm font-medium text-fg-body">
                    興趣領域
                  </label>
                  <select id="together-jamdomainid"
                    value={jamDomainId}
                    onChange={(e) => setJamDomainId(e.target.value)}
                    className={`${controlClasses} min-h-11`}
                  >
                    {domains.map((d) => (
                      <option key={d.id} value={d.id}>
                        #{d.name_zh}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="min-w-0 flex-1 space-y-1.5 *:w-full">
                <label htmlFor="together-jamtitle" className="block text-sm font-medium text-fg-body">
                  企劃題目
                </label>
                <input id="together-jamtitle"
                  required
                  value={jamTitle}
                  onChange={(e) => setJamTitle(e.target.value)}
                  placeholder="跨校企劃題目（如：北中南三校冬季 Game Jam 聯展）*"
                  className={`${controlClasses} min-h-11 w-full`}
                />
              </div>
              <div className="min-w-0 flex-1 space-y-1.5 *:w-full">
                <label htmlFor="together-jamsummary" className="block text-sm font-medium text-fg-body">
                  合作說明
                </label>
                <textarea id="together-jamsummary"
                  required
                  rows={3}
                  value={jamSummary}
                  onChange={(e) => setJamSummary(e.target.value)}
                  placeholder="說明各自社團分工、預計合作模式與目標成果..."
                  className={`${controlClasses} min-h-24 py-2.5 leading-relaxed w-full`}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="min-w-0 flex-1 space-y-1.5 *:w-full">
                  <label htmlFor="together-jamroles" className="block text-sm font-medium text-fg-body">
                    招募專長
                  </label>
                  <input id="together-jamroles"
                    value={jamRoles}
                    onChange={(e) => setJamRoles(e.target.value)}
                    placeholder="招募友社專長（逗號分隔，如 美術, 配樂, 現場場控）"
                    className={`${controlClasses} min-h-11`}
                  />
                </div>
                <div className="min-w-0 flex-1 space-y-1.5 *:w-full">
                  <label htmlFor="together-jamformat" className="block text-sm font-medium text-fg-body">
                    合作方式
                  </label>
                  <input id="together-jamformat"
                    value={jamFormat}
                    onChange={(e) => setJamFormat(e.target.value)}
                    placeholder="合作方式（如 線上共創＋雙週末成果驗收）"
                    className={`${controlClasses} min-h-11`}
                  />
                </div>
              </div>
              <Button type="submit" loading={busy === 'create-jam'}>
                發布跨校共作徵集
              </Button>
            </form>
          )}

          {filteredJams.length === 0 ? (
            <EmptyState
              title="此領域目前沒有開放中的跨校共創徵集"
              action={
                selectedDomain ? (
                  <Button variant="secondary" onClick={() => setSelectedDomain('')}>
                    查看全部領域
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {filteredJams.map((jam) => (
                <div
                  key={jam.id}
                  className="flex min-w-0 flex-col gap-3 rounded-2xl border-2 border-line bg-surface p-5 text-left"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="accent">#{jam.domain_name}</Badge>
                    <Badge tone="success">目標 ≥{jam.target_schools_count} 校共創</Badge>
                  </div>
                  <h2 className="font-display text-base font-bold text-fg">{jam.title}</h2>
                  <p className="text-sm text-fg-muted">{jam.summary}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {jam.needed_roles.map((r) => (
                      <Badge key={r}>徵求：{r}</Badge>
                    ))}
                  </div>
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t-2 border-line pt-3 text-sm">
                    <Link
                      href={`/clubs/${jam.host_club.slug}`}
                      className="inline-flex min-h-11 items-center font-semibold text-brand-soft-fg hover:underline"
                    >
                      主辦：{jam.host_club.university_short_name} {jam.host_club.name}
                    </Link>
                    <span className="font-mono tabular-nums text-fg-subtle">
                      截止 {jam.deadline_at.slice(0, 10)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 3: ALUMNI MENTORS & PRACTICAL RESOURCES */}
      {subTab === 'mentors' && (
        <div className="space-y-6">
          {/* Alumni Ping Directory */}
          <section className="space-y-4 rounded-2xl border-2 border-line bg-surface p-5 sm:p-6">
            <h2 className="flex items-center gap-2 font-display text-base font-bold text-fg">
              <HandHeart className="h-4 w-4 text-brand" aria-hidden="true" />
              歷屆前輩請益牆
            </h2>
            {!isCampusVerified ? (
              <p className="text-sm text-fg-muted">
                為保護前輩隱私，需{' '}
                <Link
                  href="/me?returnTo=/together"
                  className="inline-flex min-h-[44px] items-center font-bold text-brand underline"
                >
                  完成校園信箱驗證
                </Link>{' '}
                才可發起 1 對 1 請益（每人每日上限 3 次）。
              </p>
            ) : alumni.length === 0 ? (
              <p className="text-sm text-fg-subtle">目前尚無開啟請益接待的前輩名錄。</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {alumni.map((al) => (
                  <div
                    key={al.user_id}
                    className="flex flex-col justify-between gap-2 rounded-xl bg-surface-subtle p-4 text-sm"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-fg">
                          {al.display_name}
                        </span>
                        <span className="text-fg-muted">{al.university_short_name}</span>
                      </div>
                      {al.clubs.length > 0 && (
                        <p className="mt-1 text-fg-muted">
                          歷任：{al.clubs.map((c) => `${c.name}${c.title ? `(${c.title})` : ''}`).join('、')}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {al.expertise_tags.map((tag) => (
                          <Badge key={tag}>#{tag}</Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      {al.handle ? (
                        <Link
                          href={`/u/${al.handle}`}
                          className="font-bold text-brand-soft-fg hover:underline"
                        >
                          查看成長軌跡
                        </Link>
                      ) : (
                        <span />
                      )}
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setPingTarget(al);
                          setPingTag(al.expertise_tags[0] || '');
                        }}
                      >
                        禮貌發問請益
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {pingTarget && (
              <form
                onSubmit={handleSendPing}
                className="space-y-3 rounded-xl bg-brand-soft p-4 text-sm"
              >
                <p className="font-bold text-fg">
                  向 {pingTarget.display_name} 送出簡短請益（對方不會看到你的個人電話，將經站內與 Email 轉達）
                </p>
                <div className="min-w-0 flex-1 space-y-1.5 *:w-full">
                  <label htmlFor="together-pingtag" className="block text-sm font-medium text-fg-body">
                    想請教的領域
                  </label>
                  <input id="together-pingtag"
                    value={pingTag}
                    onChange={(e) => setPingTag(e.target.value)}
                    placeholder="想請教的領域（如 社團評鑑財務核銷）"
                    className={`${controlClasses} min-h-11 w-full`}
                  />
                </div>
                <div className="min-w-0 flex-1 space-y-1.5 *:w-full">
                  <label htmlFor="together-pingmessage" className="block text-sm font-medium text-fg-body">
                    問題描述
                  </label>
                  <textarea id="together-pingmessage"
                    required
                    minLength={10}
                    maxLength={500}
                    rows={3}
                    value={pingMessage}
                    onChange={(e) => setPingMessage(e.target.value)}
                    placeholder="簡述目前遇到的卡關情境與想請教的問題（10-500字）..."
                    className={`${controlClasses} min-h-24 py-2.5 leading-relaxed w-full`}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={busy === 'ping'}
                    className={buttonClasses({ variant: 'primary', size: 'sm' })}
                  >
                    <Send className="h-3 w-3" aria-hidden="true" />
                    送出請益請求
                  </button>
                  <button
                    type="button"
                    onClick={() => setPingTarget(null)}
                    className={buttonClasses({ variant: 'secondary', size: 'sm' })}
                  >
                    取消
                  </button>
                </div>
              </form>
            )}
          </section>

          {/* Practical Resources */}
          <section className="space-y-4 rounded-2xl border-2 border-line bg-surface p-5 sm:p-6">
            <h2 className="font-display text-base font-bold text-fg">
              跨校前輩實務筆記（去識別化共筆與行政備忘）
            </h2>
            {filteredResources.length === 0 ? (
              <EmptyState
                title="此領域目前還沒有跨校實務筆記"
                action={
                  selectedDomain ? (
                    <Button variant="secondary" onClick={() => setSelectedDomain('')}>
                      查看全部領域
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {filteredResources.map((r) => (
                  <article
                    key={r.id}
                    className="space-y-2 rounded-xl bg-surface-subtle p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
                      <Badge tone="accent">#{r.domain_name}</Badge>
                      <span className="text-fg-subtle">來源：{r.source_university_short_name}</span>
                    </div>
                    <h3 className="font-display text-sm font-bold text-fg">{r.title}</h3>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg-secondary">
                      {r.content_md}
                    </p>
                  </article>
                ))}
              </div>
            )}

            {isCampusVerified && (
              <form
                onSubmit={handleCreateResource}
                className="space-y-3 rounded-xl border-2 border-dashed border-line p-4 text-sm"
              >
                <p className="font-bold text-fg-body">分享一則去識別化的社團實務秘笈</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="min-w-0 flex-1 space-y-1.5 *:w-full">
                    <label htmlFor="together-resdomainid" className="block text-sm font-medium text-fg-body">
                      興趣領域
                    </label>
                    <select id="together-resdomainid"
                      value={resDomainId}
                      onChange={(e) => setResDomainId(e.target.value)}
                      className={`${controlClasses} min-h-11`}
                    >
                      {domains.map((d) => (
                        <option key={d.id} value={d.id}>
                          #{d.name_zh}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5 *:w-full">
                    <label htmlFor="together-restitle" className="block text-sm font-medium text-fg-body">
                      筆記標題
                    </label>
                    <input id="together-restitle"
                      required
                      minLength={3}
                      value={resTitle}
                      onChange={(e) => setResTitle(e.target.value)}
                      placeholder="實務筆記標題 *"
                      className={`${controlClasses} min-h-11 sm:col-span-2`}
                    />
                  </div>
                </div>
                <div className="min-w-0 flex-1 space-y-1.5 *:w-full">
                  <label htmlFor="together-rescontent" className="block text-sm font-medium text-fg-body">
                    筆記內容
                  </label>
                  <textarea id="together-rescontent"
                    required
                    minLength={15}
                    rows={2}
                    value={resContent}
                    onChange={(e) => setResContent(e.target.value)}
                    placeholder="整理場地／器材／預算核銷實務經驗（請勿包含個人聯絡個資）..."
                    className={`${controlClasses} min-h-24 py-2.5 leading-relaxed w-full`}
                  />
                </div>
                <Button type="submit" loading={busy === 'res'}>
                  分享實務指南
                </Button>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
