'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Flag } from 'lucide-react';
import type { ReportReason, ReportTargetType } from '@/db/schema';
import { REPORT_REASONS } from '@/lib/constants';
import { Button, Dialog, Field, Notice, Select, Textarea } from '@/components/ui';

export function ReportModal({
  targetType,
  targetId,
  isLoggedIn,
  buttonLabel = '檢舉',
}: {
  targetType: ReportTargetType;
  targetId: string;
  isLoggedIn: boolean;
  buttonLabel?: string;
}) {
  const router = useRouter();
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>('inappropriate');
  const [detail, setDetail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpen = () => {
    if (!isLoggedIn) {
      router.push(`/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    setOpen(true);
    setDone(false);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_type: targetType,
          target_id: targetId,
          reason,
          detail: detail.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message || '檢舉送出失敗，請稍後再試。');
      } else {
        setDone(true);
        setDetail('');
      }
    } catch {
      setError('網路連線異常，請稍後再試。');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button variant="secondary" onClick={handleOpen} icon={<Flag className="h-4 w-4" aria-hidden="true" />}>
        {buttonLabel}
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="回報違規或侵權內容"
        footer={
          done ? (
            <Button variant="primary" onClick={() => setOpen(false)}>
              完成
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setOpen(false)}>
                取消
              </Button>
              <Button type="submit" form={formId} variant="danger" loading={submitting}>
                {submitting ? '送出中...' : '送出檢舉'}
              </Button>
            </>
          )
        }
      >
        {done ? (
          <Notice tone="success">已收到您的檢舉回報，平台管理員將會儘速檢視並依法規與社群守則處置。</Notice>
        ) : (
          <form id={formId} onSubmit={handleSubmit} className="space-y-4">
            <Field label="檢舉原因">
              {(p) => (
                <Select {...p} value={reason} onChange={(e) => setReason(e.target.value as ReportReason)}>
                  {Object.entries(REPORT_REASONS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="補充說明（選填）">
              {(p) => (
                <Textarea
                  {...p}
                  rows={3}
                  maxLength={1000}
                  value={detail}
                  onChange={(e) => setDetail(e.target.value)}
                  placeholder="請簡述問題所在或佐證連結，利於管理員快速判讀。"
                />
              )}
            </Field>
            {error && <Notice tone="danger">{error}</Notice>}
          </form>
        )}
      </Dialog>
    </>
  );
}
