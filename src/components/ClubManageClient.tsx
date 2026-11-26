'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Calendar, FileText, Settings, Users } from 'lucide-react';
import type { ClubCategory, ClubMemberRole, PostKind, PostStatus } from '@/db/schema';
import { formatTaipeiDate } from '@/lib/academic-year';
import { POST_KIND_LABELS } from '@/lib/constants';

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

export function ClubManageClient({ data }: { data: ManageClubData }) {
  const [tab, setTab] = useState<'events' | 'posts' | 'members' | 'handover'>('events');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-[var(--border-strong)] bg-white p-5 shadow-xs">
        <div>
          <p className="text-xs font-semibold text-slate-500">
            {data.club.universityName} · 您的角色：{data.myRole}
          </p>
          <h1 className="text-xl font-extrabold text-slate-900">{data.club.name} 管理後台</h1>
        </div>
        <Link
          href={`/clubs/${data.club.slug}`}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50"
        >
          查看公開門面
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { key: 'events', label: '活動引擎', icon: Calendar },
          { key: 'posts', label: '日常與作品', icon: FileText },
          { key: 'members', label: '社員與幹部', icon: Users },
          { key: 'handover', label: '交接與避雷便條', icon: Settings },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key as typeof tab)}
              className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-4 text-xs font-bold ${
                tab === t.key
                  ? 'bg-[var(--primary)] text-white'
                  : 'border border-[var(--border-strong)] bg-white text-slate-700'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'events' && (
        <div className="space-y-3 rounded-3xl border border-[var(--border)] bg-white p-5">
          <h2 className="text-base font-extrabold text-slate-900">近期活動清單</h2>
          {data.events.map((ev) => (
            <div
              key={ev.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[var(--muted)] p-4"
            >
              <div>
                <p className="text-sm font-bold text-slate-900">{ev.title}</p>
                <p className="text-xs text-slate-500">
                  模式：{ev.scheduleMode} · 狀態：{ev.status}
                </p>
              </div>
              <Link
                href={`/e/${ev.shortCode}`}
                className="rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-blue-700"
              >
                /e/{ev.shortCode}
              </Link>
            </div>
          ))}
        </div>
      )}

      {tab === 'posts' && (
        <div className="space-y-3 rounded-3xl border border-[var(--border)] bg-white p-5">
          <h2 className="text-base font-extrabold text-slate-900">現場流與作品牆</h2>
          {data.posts.map((p) => (
            <div
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[var(--muted)] p-4"
            >
              <div>
                <span className="text-[11px] font-bold text-orange-800">
                  {POST_KIND_LABELS[p.postKind].label}
                </span>
                <p className="text-sm font-bold text-slate-900">{p.headline}</p>
                <p className="text-xs text-slate-500">
                  狀態：{p.status} · 收進評鑑：{p.includeInEvaluation ? '是' : '否'}
                </p>
              </div>
              <Link
                href={`/posts/${p.id}`}
                className="rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-slate-800"
              >
                檢視
              </Link>
            </div>
          ))}
        </div>
      )}

      {tab === 'members' && (
        <div className="space-y-2 rounded-3xl border border-[var(--border)] bg-white p-5">
          <h2 className="text-base font-extrabold text-slate-900">成員與歷屆名單</h2>
          {data.members.map((m, idx) => (
            <div
              key={`${m.userId}-${idx}`}
              className="flex items-center justify-between rounded-2xl bg-[var(--muted)] px-4 py-3 text-sm"
            >
              <span className="font-bold text-slate-900">
                {m.displayName} {m.title ? `（${m.title}）` : ''}
              </span>
              <span className="text-xs font-semibold text-slate-600">
                {m.role} {m.endedAt ? '· 已卸任' : '· 現行有效'}
              </span>
            </div>
          ))}
        </div>
      )}

      {tab === 'handover' && (
        <div className="space-y-3 rounded-3xl border border-[var(--border)] bg-white p-5">
          <h2 className="text-base font-extrabold text-slate-900">歷屆交接避雷便條（僅幹部可見）</h2>
          {data.handoverNotes.map((n) => (
            <div key={n.id} className="space-y-1 rounded-2xl bg-[var(--muted)] p-4 text-xs text-slate-700">
              <p className="font-bold text-slate-900">記錄日期：{formatTaipeiDate(n.createdAt)}</p>
              {n.venueTips && <p>場地眉角：{n.venueTips}</p>}
              {n.hoursAndDeadlines && <p>時數與死線：{n.hoursAndDeadlines}</p>}
              {n.contactsAndVendors && <p>廠商窗口：{n.contactsAndVendors}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
