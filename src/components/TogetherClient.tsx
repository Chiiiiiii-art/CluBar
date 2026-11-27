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

import { Notice } from '@/components/ui';
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
      if (!res.ok) throw new Error(json?.error?.message || '建立 Jam 失敗');
      setShowJamForm(false);
      setJamTitle('');
      setJamSummary('');
      const refreshed = await fetch('/api/together/jams');
      if (refreshed.ok) {
        const j = await refreshed.json();
        setJams(j.jams ?? []);
      }
      setMsg('跨校共作 Jam 徵集已公開！');
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
      <section className="rounded-xl border border-ink-300 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-accent-600" aria-hidden="true" />
              <h1 className="text-xl font-bold text-ink-900">一起聚｜跨校同好舞台</h1>
            </div>
            <p className="mt-1 text-sm text-ink-600">
              依興趣領域看跨校作品試玩、找友社合作，或向前輩請益。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['stage', '作品試玩與接力', Compass],
                ['jam', `跨校共創徵集 (${jams.length})`, Sparkles],
                ['mentors', '前輩請益與筆記', BookOpen],
              ] as const
            ).map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                onClick={() => (key === 'mentors' ? openMentorsTab() : setSubTab(key))}
                className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold ${
                  subTab === key
                    ? 'bg-accent-600 text-white'
                    : 'border border-ink-300 bg-white text-ink-700 hover:bg-ink-50'
                }`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Domain Filter Chips */}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedDomain('')}
            className={`min-h-[44px] rounded-full px-3.5 text-sm font-semibold ${
              !selectedDomain
                ? 'bg-ink-900 text-white'
                : 'bg-ink-100 text-ink-700 hover:bg-accent-100'
            }`}
          >
            全部領域
          </button>
          {domains.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setSelectedDomain(d.id)}
              className={`min-h-[44px] rounded-full px-3.5 text-sm font-semibold ${
                selectedDomain === d.id
                  ? 'bg-ink-900 text-white'
                  : 'bg-ink-100 text-ink-700 hover:bg-accent-100'
              }`}
            >
              #{d.name_zh}
            </button>
          ))}
        </div>
      </section>

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
                className="inline-flex items-center gap-1.5 rounded-full bg-accent-600 px-4 py-2 text-sm font-semibold text-white"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                {showStageForm ? '收合發表表單' : '代表社團發表作品／觀點'}
              </button>
            </div>
          )}

          {showStageForm && myMemberships.length > 0 && (
            <form
              onSubmit={handleCreateItem}
              className="space-y-3 rounded-xl border border-ink-300 bg-white p-6"
            >
              <div className="grid gap-3 sm:grid-cols-3">
                <select
                  value={clubId}
                  onChange={(e) => setClubId(e.target.value)}
                  className="rounded-xl border border-line-input px-3 py-2 text-sm"
                >
                  {myMemberships.map((m) => (
                    <option key={m.clubId} value={m.clubId}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <select
                  value={domainId}
                  onChange={(e) => setDomainId(e.target.value)}
                  className="rounded-xl border border-line-input px-3 py-2 text-sm"
                >
                  {domains.map((d) => (
                    <option key={d.id} value={d.id}>
                      #{d.name_zh}
                    </option>
                  ))}
                </select>
                <select
                  value={itemType}
                  onChange={(e) => setItemType(e.target.value as typeof itemType)}
                  className="rounded-xl border border-line-input px-3 py-2 text-sm"
                >
                  <option value="showcase">作品試玩展示</option>
                  <option value="field_log">路線／實務紀錄</option>
                  <option value="match_invite">友社友誼邀約</option>
                  <option value="reading_notes">專題書單觀點</option>
                </select>
              </div>
              <input
                required
                minLength={2}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="作品或交流主題名稱 *"
                className="w-full rounded-xl border border-line-input px-3 py-2 text-sm"
              />
              <textarea
                required
                minLength={10}
                rows={3}
                value={contentMd}
                onChange={(e) => setContentMd(e.target.value)}
                placeholder="分享製作心得、使用技術或希望友社接力討論的切入點..."
                className="w-full rounded-xl border border-line-input p-3 text-sm"
              />
              <input
                type="url"
                value={embedUrl}
                onChange={(e) => setEmbedUrl(e.target.value)}
                placeholder="選填安全預覽連結（限 itch.io / YouTube / Vimeo / SoundCloud / Figma / GitHub）"
                className="w-full rounded-xl border border-line-input px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={busy === 'create-item'}
                className="rounded-full bg-ink-900 px-5 py-2 text-sm font-semibold text-white"
              >
                送出發布
              </button>
            </form>
          )}

          {filteredItems.length === 0 ? (
            <div className="space-y-3 rounded-xl border border-dashed border-line bg-white p-8 text-center text-sm text-ink-500">
              <p>目前沒有符合此領域的作品試玩或徵集。</p>
              {selectedDomain && (
                <button
                  type="button"
                  onClick={() => setSelectedDomain('')}
                  className="inline-flex min-h-[44px] items-center rounded-full border border-ink-300 bg-white px-4 text-sm font-semibold text-ink-800 hover:bg-ink-50"
                >
                  查看全部領域
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {filteredItems.map((item) => (
                <Link
                  key={item.id}
                  href={`/together/${item.id}`}
                  className="flex flex-col gap-3 rounded-xl border border-line bg-white p-5 transition hover:border-accent-300"
                >
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="rounded-full bg-accent-100 px-2.5 py-0.5 font-bold text-accent-900">
                      #{item.domain_name}
                    </span>
                    <span className="rounded-full bg-ink-100 px-2.5 py-0.5 font-semibold text-ink-700">
                      {TOGETHER_ITEM_TYPE_LABELS[item.item_type]}
                    </span>
                    {item.embed_url && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-accent-50 px-2 py-0.5 font-semibold text-accent-700">
                        <Link2 className="h-3 w-3" aria-hidden="true" />
                        可試玩／預覽
                      </span>
                    )}
                  </div>
                  <h2 className="text-base font-bold text-ink-900">{item.title}</h2>
                  <p className="line-clamp-3 text-sm text-ink-600">{item.content_md}</p>
                  <div className="mt-auto flex items-center justify-between border-t border-line pt-3 text-sm">
                    <span className="font-semibold text-accent-700">
                      {item.club.university_short_name} · {item.club.name}
                    </span>
                    <span className="text-ink-500">回覆 {item.reply_count}</span>
                  </div>
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
                className="inline-flex items-center gap-1.5 rounded-full bg-accent-600 px-4 py-2 text-sm font-semibold text-white"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                {showJamForm ? '收合徵集表單' : '發起跨校共作企劃 (Jam)'}
              </button>
            </div>
          )}

          {showJamForm && officerClubs.length > 0 && (
            <form
              onSubmit={handleCreateJam}
              className="space-y-3 rounded-xl border border-ink-300 bg-white p-6"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <select
                  value={jamClubId}
                  onChange={(e) => setJamClubId(e.target.value)}
                  className="rounded-xl border border-line-input px-3 py-2 text-sm"
                >
                  {officerClubs.map((c) => (
                    <option key={c.clubId} value={c.clubId}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <select
                  value={jamDomainId}
                  onChange={(e) => setJamDomainId(e.target.value)}
                  className="rounded-xl border border-line-input px-3 py-2 text-sm"
                >
                  {domains.map((d) => (
                    <option key={d.id} value={d.id}>
                      #{d.name_zh}
                    </option>
                  ))}
                </select>
              </div>
              <input
                required
                value={jamTitle}
                onChange={(e) => setJamTitle(e.target.value)}
                placeholder="跨校企劃題目（如：北中南三校冬季 Game Jam 聯展）*"
                className="w-full rounded-xl border border-line-input px-3 py-2 text-sm"
              />
              <textarea
                required
                rows={3}
                value={jamSummary}
                onChange={(e) => setJamSummary(e.target.value)}
                placeholder="說明各自社團分工、預計合作模式與目標成果..."
                className="w-full rounded-xl border border-line-input p-3 text-sm"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  value={jamRoles}
                  onChange={(e) => setJamRoles(e.target.value)}
                  placeholder="招募友社專長（逗號分隔，如 美術, 配樂, 現場場控）"
                  className="rounded-xl border border-line-input px-3 py-2 text-sm"
                />
                <input
                  value={jamFormat}
                  onChange={(e) => setJamFormat(e.target.value)}
                  placeholder="合作方式（如 線上共創＋雙週末成果驗收）"
                  className="rounded-xl border border-line-input px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={busy === 'create-jam'}
                className="rounded-full bg-ink-900 px-5 py-2 text-sm font-semibold text-white"
              >
                發布跨校 Jam 徵集
              </button>
            </form>
          )}

          {filteredJams.length === 0 ? (
            <div className="space-y-3 rounded-xl border border-dashed border-line bg-white p-8 text-center text-sm text-ink-500">
              <p>此領域目前沒有開放中的跨校共創徵集。</p>
              {selectedDomain && (
                <button
                  type="button"
                  onClick={() => setSelectedDomain('')}
                  className="inline-flex min-h-[44px] items-center rounded-full border border-ink-300 bg-white px-4 text-sm font-semibold text-ink-800 hover:bg-ink-50"
                >
                  查看全部領域
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {filteredJams.map((jam) => (
                <div
                  key={jam.id}
                  className="flex flex-col gap-3 rounded-xl border border-line bg-white p-5"
                >
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="rounded-full bg-accent-100 px-2.5 py-0.5 font-bold text-accent-900">
                      #{jam.domain_name}
                    </span>
                    <span className="rounded-full bg-success-50 px-2.5 py-0.5 font-bold text-success-800">
                      目標 ≥{jam.target_schools_count} 校共創
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-ink-900">{jam.title}</h2>
                  <p className="text-sm text-ink-600">{jam.summary}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {jam.needed_roles.map((r) => (
                      <span
                        key={r}
                        className="rounded-full bg-ink-100 px-2.5 py-0.5 text-xs font-semibold text-ink-700"
                      >
                        徵求：{r}
                      </span>
                    ))}
                  </div>
                  <div className="mt-auto flex items-center justify-between border-t border-line pt-3 text-sm">
                    <Link
                      href={`/clubs/${jam.host_club.slug}`}
                      className="font-semibold text-accent-700 hover:underline"
                    >
                      主辦：{jam.host_club.university_short_name} {jam.host_club.name}
                    </Link>
                    <span className="text-ink-500">
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
          <section className="space-y-4 rounded-xl border border-line bg-white p-6">
            <h2 className="flex items-center gap-2 text-base font-bold text-ink-900">
              <HandHeart className="h-4 w-4 text-accent-600" aria-hidden="true" />
              歷屆前輩請益牆
            </h2>
            {!isCampusVerified ? (
              <p className="text-sm text-ink-600">
                為保護前輩隱私，需{' '}
                <Link
                  href="/me?returnTo=/together"
                  className="inline-flex min-h-[44px] items-center font-bold text-accent-600 underline"
                >
                  完成校園信箱驗證
                </Link>{' '}
                才可發起 1 對 1 請益（每人每日上限 3 次）。
              </p>
            ) : alumni.length === 0 ? (
              <p className="text-sm text-ink-500">目前尚無開啟請益接待的前輩名錄。</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {alumni.map((al) => (
                  <div
                    key={al.user_id}
                    className="flex flex-col justify-between gap-2 rounded-xl bg-ink-50 p-4 text-sm"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-ink-900">
                          {al.display_name}
                        </span>
                        <span className="text-ink-600">{al.university_short_name}</span>
                      </div>
                      {al.clubs.length > 0 && (
                        <p className="mt-1 text-ink-600">
                          歷任：{al.clubs.map((c) => `${c.name}${c.title ? `(${c.title})` : ''}`).join('、')}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {al.expertise_tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-white px-2.5 py-0.5 font-bold text-accent-900"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      {al.handle ? (
                        <Link
                          href={`/u/${al.handle}`}
                          className="font-bold text-accent-700 hover:underline"
                        >
                          查看成長軌跡
                        </Link>
                      ) : (
                        <span />
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setPingTarget(al);
                          setPingTag(al.expertise_tags[0] || '');
                        }}
                        className="rounded-full bg-ink-900 px-3 py-1 font-bold text-white"
                      >
                        禮貌發問請益
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {pingTarget && (
              <form
                onSubmit={handleSendPing}
                className="space-y-3 rounded-xl border border-accent-300 bg-accent-50/70 p-4 text-sm"
              >
                <p className="font-bold text-ink-900">
                  向 {pingTarget.display_name} 送出簡短請益（對方不會看到你的個人電話，將經站內與 Email 轉達）
                </p>
                <input
                  value={pingTag}
                  onChange={(e) => setPingTag(e.target.value)}
                  placeholder="想請教的領域（如 社團評鑑財務核銷）"
                  className="w-full rounded-xl border border-line-input bg-white px-3 py-2"
                />
                <textarea
                  required
                  minLength={10}
                  maxLength={500}
                  rows={3}
                  value={pingMessage}
                  onChange={(e) => setPingMessage(e.target.value)}
                  placeholder="簡述目前遇到的卡關情境與想請教的問題（10-500字）..."
                  className="w-full rounded-xl border border-line-input bg-white p-3"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={busy === 'ping'}
                    className="inline-flex items-center gap-1 rounded-full bg-accent-600 px-4 py-1.5 font-bold text-white"
                  >
                    <Send className="h-3 w-3" />
                    送出請益請求
                  </button>
                  <button
                    type="button"
                    onClick={() => setPingTarget(null)}
                    className="rounded-full border border-ink-300 bg-white px-4 py-1.5 font-bold text-ink-700"
                  >
                    取消
                  </button>
                </div>
              </form>
            )}
          </section>

          {/* Practical Resources */}
          <section className="space-y-4 rounded-xl border border-line bg-white p-6">
            <h2 className="text-base font-bold text-ink-900">
              跨校前輩實務筆記（去識別化共筆與行政備忘）
            </h2>
            {filteredResources.length === 0 ? (
              <div className="space-y-3 rounded-xl border border-dashed border-line bg-ink-50/70 p-6 text-center text-sm text-ink-600">
                <p>此領域目前還沒有跨校實務筆記。</p>
                {selectedDomain && (
                  <button
                    type="button"
                    onClick={() => setSelectedDomain('')}
                    className="inline-flex min-h-[44px] items-center rounded-full border border-ink-300 bg-white px-4 font-bold text-ink-800 hover:bg-ink-50"
                  >
                    查看全部領域
                  </button>
                )}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {filteredResources.map((r) => (
                  <article
                    key={r.id}
                    className="space-y-2 rounded-xl border border-line bg-ink-50 p-4"
                  >
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="rounded-full bg-accent-100 px-2 py-0.5 text-accent-900">
                        #{r.domain_name}
                      </span>
                      <span className="text-ink-500">來源：{r.source_university_short_name}</span>
                    </div>
                    <h3 className="text-sm font-semibold text-ink-900">{r.title}</h3>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-700">
                      {r.content_md}
                    </p>
                  </article>
                ))}
              </div>
            )}

            {isCampusVerified && (
              <form
                onSubmit={handleCreateResource}
                className="space-y-3 rounded-xl border border-dashed border-ink-300 p-4 text-sm"
              >
                <p className="font-bold text-ink-800">分享一則去識別化的社團實務秘笈</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  <select
                    value={resDomainId}
                    onChange={(e) => setResDomainId(e.target.value)}
                    className="rounded-xl border border-line-input px-3 py-2"
                  >
                    {domains.map((d) => (
                      <option key={d.id} value={d.id}>
                        #{d.name_zh}
                      </option>
                    ))}
                  </select>
                  <input
                    required
                    minLength={3}
                    value={resTitle}
                    onChange={(e) => setResTitle(e.target.value)}
                    placeholder="實務筆記標題 *"
                    className="sm:col-span-2 rounded-xl border border-line-input px-3 py-2"
                  />
                </div>
                <textarea
                  required
                  minLength={15}
                  rows={2}
                  value={resContent}
                  onChange={(e) => setResContent(e.target.value)}
                  placeholder="整理場地／器材／預算核銷實務經驗（請勿包含個人聯絡個資）..."
                  className="w-full rounded-xl border border-line-input p-3"
                />
                <button
                  type="submit"
                  disabled={busy === 'res'}
                  className="rounded-full bg-ink-900 px-4 py-1.5 font-bold text-white"
                >
                  分享實務指南
                </button>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
