'use client';

import { useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import type { MediaItem } from '@/db/schema';
import { buttonClasses } from '@/components/ui';

async function compressToWebp(file: File): Promise<{
  blob: Blob;
  width: number;
  height: number;
}> {
  const bitmap = await createImageBitmap(file);
  const maxWidth = 1920;
  const scale = bitmap.width > maxWidth ? maxWidth / bitmap.width : 1;
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('無法初始化瀏覽器圖片壓縮畫布。');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/webp', 0.82)
  );
  if (!blob) throw new Error('圖片壓縮失敗。');
  return { blob, width, height };
}

export function ImageUploader({
  clubId,
  value,
  onChange,
  maxImages = 6,
  purpose = 'post_image',
}: {
  clubId: string;
  value: MediaItem[];
  onChange: (items: MediaItem[]) => void;
  maxImages?: number;
  purpose?: 'post_image' | 'club_avatar' | 'club_cover';
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;

    const remaining = maxImages - value.length;
    if (remaining <= 0) {
      setError(`最多僅能上傳 ${maxImages} 張圖片。`);
      return;
    }

    setUploading(true);
    setError(null);
    const nextList = [...value];

    try {
      for (const file of files.slice(0, remaining)) {
        if (file.size > 5 * 1024 * 1024) {
          throw new Error(`「${file.name}」原始檔案超過 5 MB 上限。`);
        }

        const { blob, width, height } = await compressToWebp(file);
        const sasRes = await fetch('/api/media/sas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            purpose,
            club_id: clubId,
            content_type: 'image/webp',
            size_bytes: blob.size,
          }),
        });
        const sasJson = await sasRes.json();
        if (!sasRes.ok) {
          throw new Error(sasJson?.error?.message || '無法取得圖片上傳憑證。');
        }

        const putRes = await fetch(sasJson.upload_url, {
          method: 'PUT',
          headers: {
            'x-ms-blob-type': 'BlockBlob',
            'Content-Type': 'image/webp',
          },
          body: blob,
        });
        if (!putRes.ok) {
          throw new Error('圖片直傳雲端儲存失敗，請確認儲存區 CORS 設定。');
        }

        nextList.push({
          url: sasJson.blob_url,
          alt: file.name.replace(/\.[^.]+$/, ''),
          width,
          height,
        });
      }
      onChange(nextList);
    } catch (err) {
      setError(err instanceof Error ? err.message : '圖片上傳失敗。');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className={buttonClasses({
            variant: 'secondary',
            size: 'md',
            className: 'cursor-pointer focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus-ring',
          })}>
          <ImagePlus className="h-4 w-4 text-brand" aria-hidden="true" />
          <span>{uploading ? '壓縮上傳中...' : `上傳圖片（${value.length}/${maxImages}）`}</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple={maxImages > 1}
            disabled={uploading || value.length >= maxImages}
            onChange={handleFiles}
            className="sr-only"
          />
        </label>
        <span className="text-sm text-fg-subtle">
          支援 JPG / PNG / WebP（自動壓縮至 ≤1920px WebP 並移除 GPS 座標）
        </span>
      </div>

      {error && (
        <p className="rounded-xl bg-warning-soft px-3 py-2 text-sm font-medium text-warning-fg">
          {error}
        </p>
      )}

      {value.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {value.map((item, idx) => (
            <div
              key={`${item.url}-${idx}`}
              className="relative overflow-hidden rounded-xl border-2 border-border-ink bg-surface-sunken"
            >
              <img
                src={item.url}
                alt={item.alt || `圖片 ${idx + 1}`}
                className="h-auto w-full"
              />
              <button
                type="button"
                onClick={() => onChange(value.filter((_, i) => i !== idx))}
                aria-label="移除此圖片"
                className="absolute top-1 right-1 inline-flex h-11 w-11 items-center justify-center rounded-xl border-2 border-border-ink bg-surface text-fg hover:bg-danger-soft"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
