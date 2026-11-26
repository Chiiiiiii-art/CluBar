import { z } from 'zod';
import { ALLOWED_EMBED_HOSTS, RESERVED_SLUGS } from './constants';

export const clubCategorySchema = z.enum([
  'academic',
  'arts',
  'recreation',
  'sports',
  'service',
  'social',
]);

export const postKindSchema = z.enum([
  'nrc_moment',
  'wip_work',
  'album_highlight',
  'qa_highlight',
]);

export const postStatusSchema = z.enum(['draft', 'published', 'hidden_by_owner']);

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
  if (base && val.startsWith(`${base}/`)) {
    return true;
  }
  const account = process.env.AZURE_STORAGE_ACCOUNT_NAME?.trim();
  const container = process.env.AZURE_STORAGE_CONTAINER_NAME?.trim() || 'clubar-media';
  if (account) {
    const fallbackBase = `https://${account}.blob.core.windows.net/${container}`;
    if (val.startsWith(`${fallbackBase}/`)) return true;
  }
  return false;
}

export function isAllowedEmbedUrl(val: string): boolean {
  try {
    const parsed = new URL(val);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return ALLOWED_EMBED_HOSTS.some(
      (allowed) => host === allowed || host.endsWith(`.${allowed}`)
    );
  } catch {
    return false;
  }
}

export const mediaUrlSchema = z
  .string()
  .trim()
  .max(600)
  .refine(isAllowedMediaUrl, '圖片來源必須為系統允許的儲存網域或示範素材路徑。');

export const embedUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine(isAllowedEmbedUrl, '僅支援 itch.io、YouTube、Vimeo、SoundCloud、Figma 或 GitHub 之 HTTPS 連結。');

export const externalLinkSchema = z.object({
  type: z.enum(['ig', 'fb', 'dc', 'line', 'email', 'website', 'form', 'other']).optional(),
  label: z.string().trim().min(1, '請填寫連結名稱').max(40),
  url: safeExternalUrlSchema,
});

export const mediaItemSchema = z.object({
  kind: z.enum(['image', 'video']).optional().default('image'),
  url: mediaUrlSchema,
  poster_url: mediaUrlSchema.optional(),
  alt: z.string().trim().max(120).optional(),
  width: z.number().int().positive().max(10000).optional(),
  height: z.number().int().positive().max(10000).optional(),
  duration_sec: z.number().positive().max(15).optional(),
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
    post_kind: z.enum(['nrc_moment', 'wip_work']),
    headline: z.string().trim().min(2, '一句話亮點至少 2 個字').max(120, '一句話亮點最多 120 字'),
    content_md: z.string().trim().max(20000).default(''),
    media_items: z
      .array(mediaItemSchema)
      .min(1, '至少需上傳 1 張原比例圖片或短影')
      .max(6, '單篇最多 6 個媒體'),
    related_event_id: z.string().uuid().optional().nullable(),
    mood_tag: z.string().trim().max(24).optional().nullable(),
    domain_ids: z.array(z.string().uuid()).max(4).default([]),
    originality_confirmed: z.boolean().default(false),
    include_in_evaluation: z.boolean().default(false),
    status: z.enum(['draft', 'published']).default('published'),
  })
  .refine((data) => data.status !== 'published' || data.originality_confirmed === true, {
    message: '發布前必須勾選「原創與肖像授權聲明」。',
    path: ['originality_confirmed'],
  });

export const eventWriteSchema = z.object({
  title: z.string().trim().min(2, '活動名稱至少 2 字').max(80),
  summary: z.string().trim().max(160).default(''),
  description_md: z.string().trim().max(12000).default(''),
  theme_preset: z.enum(['warm_paper', 'campus_blue', 'forest_trail', 'midnight_jam']).default('warm_paper'),
  cover_media: z
    .object({
      url: mediaUrlSchema,
      width: z.number().int().positive().max(10000),
      height: z.number().int().positive().max(10000),
      alt: z.string().trim().max(120).optional(),
    })
    .optional()
    .nullable(),
  schedule_mode: z.enum(['scheduled', 'tbd', 'voting']).default('scheduled'),
  starts_at: z.string().datetime().optional().nullable(),
  ends_at: z.string().datetime().optional().nullable(),
  location_text: z.string().trim().min(1).max(120).default('TBD 待定'),
  beginner_friendly: z.boolean().default(true),
  non_members_welcome: z.boolean().default(true),
  campus_only: z.boolean().default(false),
  fee_ntd: z.number().int().min(0).max(100000).default(0),
  fee_note: z.string().trim().max(120).optional().nullable(),
  learning_hours_category: z.enum(['none', 'art', 'life', 'service']).default('none'),
  learning_hours_count: z.number().min(0).max(40).default(0),
  pre_event_notes: z.string().trim().max(1000).optional().nullable(),
  capacity: z.number().int().positive().max(5000).optional().nullable(),
  external_registration_url: safeExternalUrlSchema.optional().nullable(),
  domain_ids: z.array(z.string().uuid()).max(4).default([]),
  include_in_evaluation: z.boolean().default(true),
  poll_options: z
    .array(
      z.object({
        option_type: z.enum(['time_slot', 'topic']),
        label: z.string().trim().min(1).max(80),
        starts_at: z.string().datetime().optional().nullable(),
        ends_at: z.string().datetime().optional().nullable(),
      })
    )
    .max(8)
    .optional(),
});

export const handoverPitfallNoteSchema = z.object({
  venue_tips: z.string().trim().max(2000).default(''),
  hours_and_deadlines: z.string().trim().max(2000).default(''),
  contacts_and_vendors: z.string().trim().max(2000).default(''),
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
