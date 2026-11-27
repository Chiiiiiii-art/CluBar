import type { MediaItem } from '@/db/schema';

const MAX_ORIGINAL_BYTES = 20 * 1024 * 1024;
const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
const MAX_VIDEO_SECONDS = 15.5;
const PREVIEW_MAX_EDGE = 1920;

interface SasResponse {
  upload_url: string;
  blob_url: string | null;
  blob_path: string;
}

async function requestSas(payload: {
  purpose: 'album_original' | 'album_preview' | 'short_video' | 'post_image';
  content_type: string;
  size_bytes: number;
  event_id?: string;
  club_id?: string;
}): Promise<SasResponse> {
  const res = await fetch('/api/media/sas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || '取得上傳授權失敗');
  }
  return data;
}

async function putBlob(uploadUrl: string, body: Blob, contentType: string): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'x-ms-blob-type': 'BlockBlob',
      'Content-Type': contentType,
    },
    body,
  });
  if (!res.ok) {
    throw new Error(`雲端儲存上傳失敗 (${res.status})`);
  }
}

function inferImageMime(file: File): string {
  if (file.type && file.type.startsWith('image/')) return file.type;
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.heic')) return 'image/heic';
  if (lower.endsWith('.heif')) return 'image/heif';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

async function renderStrippedWebpPreview(
  file: File
): Promise<{ blob: Blob; width: number; height: number } | null> {
  try {
    const bitmap = await createImageBitmap(file);
    try {
      const scale = Math.min(1, PREVIEW_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(bitmap, 0, 0, width, height);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((out) => resolve(out), 'image/webp', 0.88)
      );
      if (!blob) return null;
      return { blob, width, height };
    } finally {
      bitmap.close();
    }
  } catch {
    return null;
  }
}

export async function uploadDualAlbumPhoto(
  eventId: string,
  file: File
): Promise<{
  original_url: string;
  preview_url: string;
  width: number;
  height: number;
  mime_type: string;
  size_bytes: number;
}> {
  if (file.size > MAX_ORIGINAL_BYTES) {
    throw new Error('無損原檔大小不可超過 20 MB');
  }
  const mimeType = inferImageMime(file);
  const origSas = await requestSas({
    purpose: 'album_original',
    content_type: mimeType,
    size_bytes: file.size,
    event_id: eventId,
  });
  if (!origSas.blob_url) {
    throw new Error('原檔上傳路徑設定錯誤');
  }
  await putBlob(origSas.upload_url, file, mimeType);

  const preview = await renderStrippedWebpPreview(file);
  if (!preview) {
    // Graceful fallback when browser cannot decode HEIC/HEIF
    return {
      original_url: origSas.blob_url,
      preview_url: origSas.blob_url,
      width: 1200,
      height: 1200,
      mime_type: mimeType,
      size_bytes: file.size,
    };
  }

  const prevSas = await requestSas({
    purpose: 'album_preview',
    content_type: 'image/webp',
    size_bytes: preview.blob.size,
    event_id: eventId,
  });
  if (!prevSas.blob_url) {
    throw new Error('預覽圖上傳路徑設定錯誤');
  }
  await putBlob(prevSas.upload_url, preview.blob, 'image/webp');

  return {
    original_url: origSas.blob_url,
    preview_url: prevSas.blob_url,
    width: preview.width,
    height: preview.height,
    mime_type: mimeType,
    size_bytes: file.size,
  };
}

export async function uploadShortVideo(
  clubId: string,
  file: File
): Promise<MediaItem> {
  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error('短影大小不可超過 25 MB');
  }
  if (!['video/mp4', 'video/webm'].includes(file.type)) {
    throw new Error('短影僅支援 MP4 或 WebM 格式');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const meta = await new Promise<{
      duration: number;
      width: number;
      height: number;
      posterBlob: Blob | null;
    }>((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;

      video.onerror = () => reject(new Error('無法讀取影片中繼資料'));
      video.onloadedmetadata = () => {
        if (!Number.isFinite(video.duration) || video.duration > MAX_VIDEO_SECONDS) {
          reject(new Error('短影長度上限為 15 秒'));
          return;
        }
        const seekTo = Math.min(0.5, Math.max(0, video.duration / 2));
        video.currentTime = seekTo;
      };
      video.onseeked = () => {
        const width = Math.max(1, video.videoWidth || 720);
        const height = Math.max(1, video.videoHeight || 1280);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ duration: video.duration, width, height, posterBlob: null });
          return;
        }
        ctx.drawImage(video, 0, 0, width, height);
        canvas.toBlob(
          (posterBlob) => resolve({ duration: video.duration, width, height, posterBlob }),
          'image/webp',
          0.85
        );
      };
      video.src = objectUrl;
    });

    const videoSas = await requestSas({
      purpose: 'short_video',
      content_type: file.type,
      size_bytes: file.size,
      club_id: clubId,
    });
    if (!videoSas.blob_url) throw new Error('影片路徑設定錯誤');
    await putBlob(videoSas.upload_url, file, file.type);

    let posterUrl: string | undefined;
    if (meta.posterBlob) {
      const posterSas = await requestSas({
        purpose: 'post_image',
        content_type: 'image/webp',
        size_bytes: meta.posterBlob.size,
        club_id: clubId,
      });
      if (posterSas.blob_url) {
        await putBlob(posterSas.upload_url, meta.posterBlob, 'image/webp');
        posterUrl = posterSas.blob_url;
      }
    }

    return {
      kind: 'video',
      url: videoSas.blob_url,
      poster_url: posterUrl,
      width: meta.width,
      height: meta.height,
      duration_sec: Math.min(15, Math.max(1, Math.round(meta.duration))),
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
