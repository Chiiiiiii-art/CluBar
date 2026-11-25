import crypto from 'node:crypto';
import {
  BlobSASPermissions,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
} from '@azure/storage-blob';
import { AppError } from '@/lib/errors';

const ALLOWED_MIME_EXT: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

export type UploadPurpose = 'post_image' | 'club_avatar' | 'club_cover' | 'evidence';

export function createMediaUploadSas(params: {
  purpose: UploadPurpose;
  scopeId: string;
  contentType: string;
  sizeBytes: number;
}): { upload_url: string; blob_url: string; expires_at: string } {
  const ext = ALLOWED_MIME_EXT[params.contentType];
  if (!ext) {
    throw new AppError(400, 'UNSUPPORTED_MEDIA_TYPE', '僅支援 WebP、JPG 與 PNG 圖片格式。');
  }
  if (params.sizeBytes <= 0 || params.sizeBytes > 5 * 1024 * 1024) {
    throw new AppError(400, 'FILE_TOO_LARGE', '單張圖片大小不得超過 5 MB。');
  }

  const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME?.trim();
  const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY?.trim();
  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME?.trim() || 'clubar-media';
  const publicBase = process.env.AZURE_STORAGE_PUBLIC_BASE_URL?.trim().replace(/\/+$/, '');

  if (!accountName || !accountKey || !publicBase) {
    throw new AppError(
      503,
      'MEDIA_STORAGE_NOT_CONFIGURED',
      '雲端圖片儲存服務尚未設定完成，暫時無法上傳圖片（可直接貼上社團外部作品連結）。'
    );
  }

  const folderMap: Record<UploadPurpose, string> = {
    post_image: 'posts',
    club_avatar: 'clubs/avatars',
    club_cover: 'clubs/covers',
    evidence: 'evidence',
  };

  const blobName = `${folderMap[params.purpose]}/${params.scopeId}/${crypto.randomUUID()}.${ext}`;
  const startsOn = new Date(Date.now() - 60 * 1000);
  const expiresOn = new Date(Date.now() + 5 * 60 * 1000);

  const credential = new StorageSharedKeyCredential(accountName, accountKey);
  const sasToken = generateBlobSASQueryParameters(
    {
      containerName,
      blobName,
      permissions: BlobSASPermissions.parse('cw'),
      startsOn,
      expiresOn,
      contentType: params.contentType,
    },
    credential
  ).toString();

  const blobUrl = `${publicBase}/${blobName}`;
  const uploadUrl = `https://${accountName}.blob.core.windows.net/${containerName}/${blobName}?${sasToken}`;

  return {
    upload_url: uploadUrl,
    blob_url: blobUrl,
    expires_at: expiresOn.toISOString(),
  };
}
