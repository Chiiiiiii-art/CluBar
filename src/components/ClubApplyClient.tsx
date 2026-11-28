'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import type { ClubCategory } from '@/db/schema';
import { CLUB_CATEGORIES, CLUB_CATEGORY_LIST } from '@/lib/constants';

import {
  Button,
  ButtonLink,
  Card,
  Field,
  Input,
  Notice,
  PageHeader,
  Select,
  Tabs,
  Textarea,
  tabPanelProps,
} from '@/components/ui';
export interface DirectoryClubOption {
  id: string;
  slug: string;
  name: string;
  category: ClubCategory;
  verification_status: 'unclaimed_directory' | 'verified' | 'suspended';
  university_id: string;
  university_short_name: string;
}

type ApplyTab = 'directory_claim' | 'new_club' | 'owner_takeover';

export function ClubApplyClient({
  universities,
  initialDirectory,
  preselectedClaimSlug,
  campusVerified,
}: {
  universities: { id: string; name: string; short_name: string }[];
  initialDirectory: DirectoryClubOption[];
  preselectedClaimSlug?: string;
  campusVerified: boolean;
}) {
  const preClaim = initialDirectory.find(
    (c) => c.slug === preselectedClaimSlug && c.verification_status === 'unclaimed_directory'
  );

  const [tab, setTab] = useState<ApplyTab>('directory_claim');
  const [searchText, setSearchText] = useState('');
  const [selectedClubId, setSelectedClubId] = useState(preClaim?.id ?? '');

  // new_club fields
  const [uniId, setUniId] = useState(universities[0]?.id ?? '');
  const [proposedName, setProposedName] = useState('');
  const [proposedSlug, setProposedSlug] = useState('');
  const [proposedCategory, setProposedCategory] = useState<ClubCategory>('academic');

  // shared evidence
  const [evidenceText, setEvidenceText] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  const filteredDirectory = initialDirectory.filter((c) => {
    const matchesStatus =
      tab === 'directory_claim'
        ? c.verification_status === 'unclaimed_directory'
        : c.verification_status !== 'unclaimed_directory';
    if (!matchesStatus) return false;
    if (!searchText.trim()) return true;
    const q = searchText.trim().toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.university_short_name.toLowerCase().includes(q) ||
      c.slug.toLowerCase().includes(q)
    );
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSubmittedId(null);

    try {
      const payload =
        tab === 'new_club'
          ? {
              type: 'new_club',
              proposed_university_id: uniId,
              proposed_name: proposedName,
              proposed_slug: proposedSlug.toLowerCase(),
              proposed_category: proposedCategory,
              evidence_text: evidenceText,
              evidence_urls: evidenceUrl.trim() ? [evidenceUrl.trim()] : [],
            }
          : {
              type: tab,
              target_club_id: selectedClubId,
              evidence_text: evidenceText,
              evidence_urls: evidenceUrl.trim() ? [evidenceUrl.trim()] : [],
            };

      const res = await fetch('/api/club-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message || '提交申請失敗。');
        return;
      }
      setSubmittedId(json.application.id);
      setEvidenceText('');
      setEvidenceUrl('');
      setProposedName('');
      setProposedSlug('');
    } catch {
      setError('網路連線異常，請稍後再試。');
    } finally {
      setSubmitting(false);
    }
  };

  const switchTab = (next: ApplyTab) => {
    setTab(next);
    if (next !== 'new_club') setSelectedClubId('');
    setError(null);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="申請社團開頁"
        description="認領校方名錄社團、建立新社團，或申請接管失聯的社團。所有申請都會由平台管理員核對幹部佐證後才開通。"
      />

      {!campusVerified && (
        <Notice
          tone="warning"
          title="須先完成校園信箱（.edu.tw）驗證才可送出申請"
          action={
            <ButtonLink href="/me?returnTo=/clubs/apply" variant="secondary" size="sm">
              前往驗證
            </ButtonLink>
          }
        />
      )}

      {submittedId && (
        <Notice tone="success" title="已送出社團申請">
          申請單編號：<code className="break-all">{submittedId}</code>。審核結果會發送到你的個人中心通知。
        </Notice>
      )}

      <Card>
        <Tabs<ApplyTab>
          label="申請類型"
          idPrefix="club-apply"
          variant="underline"
          value={tab}
          onChange={switchTab}
          items={[
            { id: 'directory_claim', label: '認領名錄社團' },
            { id: 'new_club', label: '申請新社團' },
            { id: 'owner_takeover', label: '接管申訴' },
          ]}
        />

        <form onSubmit={handleSubmit} {...tabPanelProps('club-apply', tab)} className="mt-6">
          <fieldset disabled={!campusVerified} className="min-w-0 space-y-8 disabled:opacity-60">
            <section className="space-y-4" aria-labelledby="club-apply-info-heading">
              <h2 id="club-apply-info-heading" className="font-display text-base font-bold text-fg">
                社團資料
              </h2>
              {tab === 'new_club' ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="所屬大專校院">
                      {(p) => (
                        <Select {...p} value={uniId} onChange={(e) => setUniId(e.target.value)}>
                          {universities.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name}
                            </option>
                          ))}
                        </Select>
                      )}
                    </Field>
                    <Field label="社團分類">
                      {(p) => (
                        <Select
                          {...p}
                          value={proposedCategory}
                          onChange={(e) => setProposedCategory(e.target.value as ClubCategory)}
                        >
                          {CLUB_CATEGORY_LIST.map((c) => (
                            <option key={c.value} value={c.value}>
                              {c.label}
                            </option>
                          ))}
                        </Select>
                      )}
                    </Field>
                  </div>

                  <Field label="社團正式名稱" required>
                    {(p) => (
                      <Input
                        {...p}
                        type="text"
                        minLength={2}
                        maxLength={60}
                        value={proposedName}
                        onChange={(e) => setProposedName(e.target.value)}
                        placeholder="例如：中央大學數位創作研習社"
                      />
                    )}
                  </Field>

                  <Field
                    label="公開網址代碼"
                    required
                    hint={
                      <>
                        社團主頁網址將為：
                        <code className="break-all">/clubs/{proposedSlug || 'your-club-slug'}</code>
                      </>
                    }
                  >
                    {(p) => (
                      <Input
                        {...p}
                        type="text"
                        pattern="^[a-z0-9][a-z0-9-]{2,48}[a-z0-9]$"
                        value={proposedSlug}
                        onChange={(e) => setProposedSlug(e.target.value.toLowerCase())}
                        placeholder="例如：ncu-digital-art（4–50 字小寫英文、數字或連字號）"
                        className="font-mono"
                      />
                    )}
                  </Field>
                </>
              ) : (
                <div className="space-y-3">
                  <Field
                    label={
                      tab === 'directory_claim'
                        ? '搜尋並選擇要認領的名錄社團'
                        : '搜尋並選擇要申訴接管的社團'
                    }
                  >
                    {(p) => (
                      <div className="relative">
                        <Search
                          className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-fg-subtle"
                          aria-hidden="true"
                        />
                        <Input
                          {...p}
                          type="text"
                          value={searchText}
                          onChange={(e) => setSearchText(e.target.value)}
                          placeholder="輸入校名或社團名稱篩選"
                          className="pl-9"
                        />
                      </div>
                    )}
                  </Field>

                  {filteredDirectory.length === 0 ? (
                    <p className="text-sm text-fg-muted">
                      找不到符合的社團。若你的社團不在名錄中，請改選「申請新社團」。
                    </p>
                  ) : (
                    <div
                      role="radiogroup"
                      aria-label="社團清單"
                      className="max-h-64 divide-y divide-line overflow-y-auto rounded-xl border border-line"
                    >
                      {filteredDirectory.map((c) => (
                        <label
                          key={c.id}
                          className={`flex min-h-14 cursor-pointer items-center gap-3 px-3 py-2.5 text-sm transition-colors ${
                            selectedClubId === c.id ? 'bg-surface-subtle' : 'hover:bg-surface-subtle'
                          }`}
                        >
                          <input
                            type="radio"
                            name="target_club_id"
                            value={c.id}
                            checked={selectedClubId === c.id}
                            onChange={() => setSelectedClubId(c.id)}
                            required
                            className="h-4 w-4 shrink-0 accent-brand"
                          />
                          <span className="min-w-0">
                            <span className="block break-words font-medium text-fg">
                              {c.university_short_name} · {c.name}
                            </span>
                            <span className="block break-all text-sm text-fg-muted">
                              {CLUB_CATEGORIES[c.category].label} ｜ <code>/clubs/{c.slug}</code>
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>

            <section className="space-y-4" aria-labelledby="club-apply-evidence-heading">
              <h2 id="club-apply-evidence-heading" className="font-display text-base font-bold text-fg">
                幹部身分佐證
              </h2>
              <Field
                label="幹部身分或交接說明"
                required
                hint="至少 10 字。請說明你的幹部職稱、本屆幹部名單、課外活動組核備資訊，或接管原因。"
              >
                {(p) => (
                  <Textarea
                    {...p}
                    rows={4}
                    minLength={10}
                    maxLength={2000}
                    value={evidenceText}
                    onChange={(e) => setEvidenceText(e.target.value)}
                  />
                )}
              </Field>

              <Field label="佐證連結（選填）" hint="例如學校名錄頁面、官方粉專或雲端證明文件網址。">
                {(p) => (
                  <Input
                    {...p}
                    type="url"
                    value={evidenceUrl}
                    onChange={(e) => setEvidenceUrl(e.target.value)}
                    placeholder="https://..."
                  />
                )}
              </Field>
            </section>

            {error && <Notice tone="danger">{error}</Notice>}

            <Button type="submit" size="lg" block loading={submitting} disabled={!campusVerified}>
              {submitting ? '提交中...' : '送出社團申請'}
            </Button>
          </fieldset>
        </form>
      </Card>
    </div>
  );
}
