import { z } from 'zod';
import { RESERVED_SLUGS } from './constants';

export const clubCategorySchema = z.enum([
  'academic',
  'arts',
  'recreation',
  'sports',
  'service',
  'social',
]);

export const postTypeSchema = z.enum(['work', 'event', 'workshop', 'competition']);
export const postStatusSchema = z.enum(['draft', 'published', 'hidden_by_owner']);
export const forumTagSchema = z.enum([
  'event_exp',
  'equipment',
  'venue',
  'management',
  'collab',
]);

export const safeExternalUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine((val) => {
    try {
      const parsed = new URL(val);
      return (
        parsed.protocol === 'https:' ||
        parsed.protocol === 'http:' ||
        parsed.protocol === 'mailto:'
      );
    } catch {
      return false;
    }
  }, '連結僅支援 https://、http:// 或 mailto: 格式。');

export function isAllowedMediaUrl(val: string): boolean {
  if (val.startsWith('/images/demo/') && !val.includes('..')) {
    return /^\/images\/demo\/[a-zA-Z0-9._-]+$/.test(val);
  }
  const base = process.env.AZURE_STORAGE_PUBLIC_BASE_URL?.trim().replace(/\/+$/, '');
  if (!base) return false;
  return val.startsWith(`${base}/`);
}

export const mediaUrlSchema = z
  .string()
  .trim()
  .max(600)
  .refine(isAllowedMediaUrl, '圖片來源必須為系統允許的儲存網域或示範素材路徑。');

export const externalLinkSchema = z.object({
  type: z.enum(['ig', 'fb', 'email', 'website', 'form', 'other']).optional(),
  label: z.string().trim().min(1, '請填寫連結名稱').max(40),
  url: safeExternalUrlSchema,
});

export const mediaItemSchema = z.object({
  url: mediaUrlSchema,
  alt: z.string().trim().max(120).optional(),
  width: z.number().int().positive().max(10000).optional(),
  height: z.number().int().positive().max(10000).optional(),
});

export const slugSchema = z
  .string()
  .trim()
  .regex(
    /^[a-z0-9][a-z0-9-]{2,48}[a-z0-9]$/,
    '社團代碼須為 4–50 字小寫英數字或連字號（不得以連字號開頭或結尾）。'
  )
  .refine((slug) => !RESERVED_SLUGS.has(slug), '此社團代碼為系統保留字，請改用其他名稱。');

export const postWriteSchema = z
  .object({
    title: z.string().trim().min(2, '標題至少 2 個字').max(100, '標題最多 100 字'),
    post_type: postTypeSchema,
    academic_year: z.number().int().min(100).max(150).optional(),
    summary: z.string().trim().max(200).optional(),
    content_md: z.string().trim().min(10, '正文至少 10 個字').max(20000),
    tags: z.array(z.string().trim().min(1).max(24)).max(8).default([]),
    media_urls: z.array(mediaItemSchema).max(6, '單篇最多 6 張圖片').default([]),
    external_links: z.array(externalLinkSchema).max(5).default([]),
    collaborators: z.string().trim().max(200).optional().nullable(),
    originality_confirmed: z.boolean().default(false),
    status: z.enum(['draft', 'published']).default('draft'),
  })
  .refine((data) => data.status !== 'published' || data.originality_confirmed === true, {
    message: '發布前必須勾選「原創或已取得合法授權，且不含未經同意揭露之非公開個人資料」。',
    path: ['originality_confirmed'],
  });

export const opportunityWriteSchema = z.object({
  title: z.string().trim().min(2).max(80),
  summary: z.string().trim().min(4).max(160),
  schedule_text: z.string().trim().max(80).optional().nullable(),
  deadline_at: z.string().datetime().optional().nullable(),
  external_url: safeExternalUrlSchema,
  is_active: z.boolean().default(true),
});

export function stripMarkdownSummary(md: string, maxLen = 140): string {
  const plain = md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length <= maxLen) return plain;
  return `${plain.slice(0, maxLen - 1).trimEnd()}…`;
}

export function extractEmailDomain(email: string): string | null {
  const idx = email.lastIndexOf('@');
  if (idx <= 0 || idx === email.length - 1) return null;
  return email.slice(idx + 1).trim().toLowerCase();
}

export function matchesUniversityDomain(email: string, emailDomains: string[]): boolean {
  const domain = extractEmailDomain(email);
  if (!domain) return false;
  return emailDomains.some((raw) => {
    const allowed = raw.trim().toLowerCase();
    return domain === allowed || domain.endsWith(`.${allowed}`);
  });
}

export function getAdminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isBootstrapAdminAccount(params: {
  email?: string | null;
  emailVerified?: boolean;
  campusEmail?: string | null;
  campusVerifiedAt?: Date | null;
}): boolean {
  const admins = getAdminEmails();
  if (params.emailVerified && params.email && admins.has(params.email.trim().toLowerCase())) {
    return true;
  }
  if (
    params.campusVerifiedAt &&
    params.campusEmail &&
    admins.has(params.campusEmail.trim().toLowerCase())
  ) {
    return true;
  }
  return false;
}
