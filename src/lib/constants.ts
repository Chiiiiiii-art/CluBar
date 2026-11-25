import type { ClubCategory, ForumTag, PostType, ReportReason } from '@/db/schema';

export const CLUB_CATEGORIES: Record<
  ClubCategory,
  { label: string; shortDesc: string; badgeClass: string }
> = {
  academic: {
    label: '學術',
    shortDesc: '程式、天文、語言、研究與專業技能',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  arts: {
    label: '藝文',
    shortDesc: '攝影、音樂、設計、戲劇與文學創作',
    badgeClass: 'bg-orange-50 text-orange-800 border-orange-200',
  },
  recreation: {
    label: '康樂',
    shortDesc: '登山、露營、桌遊、手作與生活興趣',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  sports: {
    label: '體育',
    shortDesc: '球類、武術、舞蹈運動與體能訓練',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  service: {
    label: '服務',
    shortDesc: '偏鄉教育、環境永續與社會公益',
    badgeClass: 'bg-teal-50 text-teal-800 border-teal-200',
  },
  social: {
    label: '聯誼',
    shortDesc: '系友交流、跨校聯誼與國際文化',
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-200',
  },
};

export const CLUB_CATEGORY_LIST = Object.entries(CLUB_CATEGORIES).map(([value, meta]) => ({
  value: value as ClubCategory,
  ...meta,
}));

export const POST_TYPES: Record<PostType, { label: string; badgeClass: string }> = {
  work: { label: '作品', badgeClass: 'bg-orange-100 text-orange-900' },
  event: { label: '活動', badgeClass: 'bg-blue-100 text-blue-900' },
  workshop: { label: '社課', badgeClass: 'bg-amber-100 text-amber-900' },
  competition: { label: '競賽展演', badgeClass: 'bg-emerald-100 text-emerald-900' },
};

export const FORUM_TAGS: Record<ForumTag, { label: string }> = {
  event_exp: { label: '活動經驗' },
  equipment: { label: '資源器材' },
  venue: { label: '場地展演' },
  management: { label: '社團經營' },
  collab: { label: '尋找交流' },
};

export const REPORT_REASONS: Record<ReportReason, { label: string }> = {
  impersonation: { label: '冒名組織／未經授權代表社團' },
  copyright: { label: '版權或未經授權使用素材' },
  privacy_leak: { label: '揭露非公開個人資料' },
  inappropriate: { label: '不當、騷擾或違法內容' },
  other: { label: '其他問題' },
};

export const CURATED_INTEREST_TAGS = [
  '攝影',
  '音樂',
  '程式設計',
  '設計創作',
  '登山戶外',
  '志工服務',
  '語言文化',
  '桌遊電競',
  '舞蹈表演',
  '戲劇電影',
  '球類運動',
  '創客手作',
] as const;

export const DISCOVER_EXAMPLE_PROMPTS = [
  '想學拍底片又想認識新朋友',
  '下課後想流汗但沒運動基礎',
  '想找一起做軟體專案的夥伴',
  '週末想去山林走走或露營體驗',
] as const;

export const RESERVED_SLUGS = new Set(['apply', 'manage', 'admin', 'new', 'api']);

export const DISCOVER_DEGRADED_WARNING =
  'AI 語意推薦服務暫時忙碌，已自動切換為基礎檢索結果，推薦理由暫未顯示。';
