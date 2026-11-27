import crypto from 'node:crypto';
import {
  BlobSASPermissions,
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
} from '@azure/storage-blob';
import { AppError } from '@/lib/errors';

export type UploadPurpose =
  | 'post_image'
  | 'club_avatar'
  | 'club_cover'
  | 'evidence'
  | 'album_original'
  | 'album_preview'
  | 'short_video'
  | 'archive_file';

const IMAGE_BASIC_MIME: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

const ALBUM_ORIG_MIME: Record<string, string> = {
  ...IMAGE_BASIC_MIME,
  'image/heic': 'heic',
  'image/heif': 'heif',
};

const VIDEO_MIME: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};

const ARCHIVE_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/csv': 'csv',
  'application/zip': 'zip',
  'application/x-zip-compressed': 'zip',
};

const MB = 1024 * 1024;

function getPurposeSpec(purpose: UploadPurpose): {
  containerType: 'public' | 'private';
  mimeMap: Record<string, string>;
  maxBytes: number;
  folder: string;
} {
  switch (purpose) {
    case 'album_original':
      return {
        containerType: 'public',
        mimeMap: ALBUM_ORIG_MIME,
        maxBytes: 20 * MB,
        folder: 'albums/orig',
      };
    case 'album_preview':
      return {
        containerType: 'public',
        mimeMap: IMAGE_BASIC_MIME,
        maxBytes: 5 * MB,
        folder: 'albums/prev',
      };
    case 'short_video':
      return {
        containerType: 'public',
        mimeMap: VIDEO_MIME,
        maxBytes: 25 * MB,
        folder: 'videos',
      };
    case 'archive_file':
      return {
        containerType: 'private',
        mimeMap: ARCHIVE_MIME,
        maxBytes: 20 * MB,
        folder: 'archive',
      };
    case 'post_image':
      return {
        containerType: 'public',
        mimeMap: IMAGE_BASIC_MIME,
        maxBytes: 5 * MB,
        folder: 'posts',
      };
    case 'club_avatar':
      return {
        containerType: 'public',
        mimeMap: IMAGE_BASIC_MIME,
        maxBytes: 5 * MB,
        folder: 'clubs/avatars',
      };
    case 'club_cover':
      return {
        containerType: 'public',
        mimeMap: IMAGE_BASIC_MIME,
        maxBytes: 5 * MB,
        folder: 'clubs/covers',
      };
    case 'evidence':
      return {
        containerType: 'public',
        mimeMap: IMAGE_BASIC_MIME,
        maxBytes: 5 * MB,
        folder: 'evidence',
      };
  }
}

function getStorageCredentials() {
  const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME?.trim();
  const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY?.trim();
  const publicContainer = process.env.AZURE_STORAGE_CONTAINER_NAME?.trim() || 'clubar-media';
  const privateContainer =
    process.env.AZURE_STORAGE_PRIVATE_CONTAINER_NAME?.trim() || 'clubar-private-archive';
  const publicBase = process.env.AZURE_STORAGE_PUBLIC_BASE_URL?.trim().replace(/\/+$/, '');

  if (!accountName || !accountKey || !publicBase) {
    throw new AppError(
      503,
      'MEDIA_STORAGE_NOT_CONFIGURED',
      '雲端媒體儲存服務尚未設定完成，暫時無法上傳檔案（可改用示範圖或外部連結）。'
    );
  }

  return { accountName, accountKey, publicContainer, privateContainer, publicBase };
}

export function createMediaUploadSas(params: {
  purpose: UploadPurpose;
  scopeId: string;
  contentType: string;
  sizeBytes: number;
}): {
  upload_url: string;
  blob_url: string | null;
  blob_path: string;
  container: 'public' | 'private';
  expires_at: string;
} {
  const spec = getPurposeSpec(params.purpose);
  const ext = spec.mimeMap[params.contentType];
  if (!ext) {
    throw new AppError(400, 'UNSUPPORTED_MEDIA_TYPE', '上傳檔案格式不符允許白名單。');
  }
  if (params.sizeBytes <= 0 || params.sizeBytes > spec.maxBytes) {
    const limitMb = Math.round(spec.maxBytes / MB);
    throw new AppError(400, 'FILE_TOO_LARGE', `單檔大小不得超過 ${limitMb} MB。`);
  }

  const { accountName, accountKey, publicContainer, privateContainer, publicBase } =
    getStorageCredentials();

  const containerName = spec.containerType === 'private' ? privateContainer : publicContainer;
  const blobPath = `${spec.folder}/${params.scopeId}/${crypto.randomUUID()}.${ext}`;
  const startsOn = new Date(Date.now() - 60 * 1000);
  const expiresOn = new Date(Date.now() + 5 * 60 * 1000);

  const credential = new StorageSharedKeyCredential(accountName, accountKey);
  const sasToken = generateBlobSASQueryParameters(
    {
      containerName,
      blobName: blobPath,
      permissions: BlobSASPermissions.parse('cw'),
      startsOn,
      expiresOn,
      contentType: params.contentType,
    },
    credential
  ).toString();

  const uploadUrl = `https://${accountName}.blob.core.windows.net/${containerName}/${blobPath}?${sasToken}`;
  const blobUrl = spec.containerType === 'public' ? `${publicBase}/${blobPath}` : null;

  return {
    upload_url: uploadUrl,
    blob_url: blobUrl,
    blob_path: blobPath,
    container: spec.containerType,
    expires_at: expiresOn.toISOString(),
  };
}

let privateContainerReady: Promise<void> | null = null;

export async function ensurePrivateArchiveContainer(): Promise<void> {
  if (!privateContainerReady) {
    privateContainerReady = (async () => {
      const { accountName, accountKey, privateContainer } = getStorageCredentials();
      const credential = new StorageSharedKeyCredential(accountName, accountKey);
      const client = new BlobServiceClient(
        `https://${accountName}.blob.core.windows.net`,
        credential
      );
      await client.getContainerClient(privateContainer).createIfNotExists();
    })().catch((err) => {
      privateContainerReady = null;
      throw err;
    });
  }
  return privateContainerReady;
}

export function createPrivateArchiveReadSas(params: {
  blobPath: string;
  downloadFilename?: string;
}): { download_url: string; expires_at: string } {
  const safePath = params.blobPath.replace(/^\/+/, '');
  if (!safePath || safePath.includes('..') || !safePath.startsWith('archive/')) {
    throw new AppError(400, 'INVALID_ARCHIVE_PATH', '非法的私密檔案路徑。');
  }

  const { accountName, accountKey, privateContainer } = getStorageCredentials();
  const startsOn = new Date(Date.now() - 60 * 1000);
  const expiresOn = new Date(Date.now() + 5 * 60 * 1000);
  const credential = new StorageSharedKeyCredential(accountName, accountKey);

  const sasToken = generateBlobSASQueryParameters(
    {
      containerName: privateContainer,
      blobName: safePath,
      permissions: BlobSASPermissions.parse('r'),
      startsOn,
      expiresOn,
      contentDisposition: params.downloadFilename
        ? `attachment; filename="${encodeURIComponent(params.downloadFilename)}"`
        : undefined,
    },
    credential
  ).toString();

  return {
    download_url: `https://${accountName}.blob.core.windows.net/${privateContainer}/${safePath}?${sasToken}`,
    expires_at: expiresOn.toISOString(),
  };
}
