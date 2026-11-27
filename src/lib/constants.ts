import type {
  ClubCategory,
  LearningHoursCategory,
  PostKind,
  ReportReason,
  TogetherItemType,
} from '@/db/schema';

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

export const INTEREST_DOMAIN_SEEDS = [
  { slug: 'game-dev', nameZh: '遊戲開發', sortOrder: 1 },
  { slug: 'photo-film', nameZh: '影像攝影', sortOrder: 2 },
  { slug: 'music-live', nameZh: '音樂展演', sortOrder: 3 },
  { slug: 'craft-design', nameZh: '工藝美術', sortOrder: 4 },
  { slug: 'software-ai', nameZh: '程式與 AI', sortOrder: 5 },
  { slug: 'outdoor-mountain', nameZh: '戶外探索', sortOrder: 6 },
  { slug: 'social-service', nameZh: '社會服務', sortOrder: 7 },
  { slug: 'finance-research', nameZh: '投資與研究', sortOrder: 8 },
  { slug: 'boardgame-esports', nameZh: '桌遊電競', sortOrder: 9 },
  { slug: 'dance-stage', nameZh: '舞蹈舞台', sortOrder: 10 },
  { slug: 'sports-fitness', nameZh: '球類運動', sortOrder: 11 },
  { slug: 'language-culture', nameZh: '語言與飲食', sortOrder: 12 },
] as const;

export const DEFAULT_FAQ_TEMPLATES = [
  {
    questionText: '零基礎、沒帶器材或非本科系可以去體驗嗎？',
    answerText: '歡迎！本社團體驗社課皆提供新手引導與基本共用器材，不須先備經驗或自購裝備。',
  },
  {
    questionText: '第一次參加需要繳社費嗎？平常活動時間大概怎麼算？',
    answerText: '單次體驗活動多為免費或僅酌收材料成本，確定長期參加再依學期繳交社費；實際時段請見近期活動頁。',
  },
  {
    questionText: '學期中才看到社團，還可以中途加入嗎？',
    answerText: '可以！只要從近期可參加活動頁報名一場體驗課或現場交流，就能直接融入社團日常。',
  },
] as const;

export const POST_KIND_LABELS: Record<PostKind, { label: string; badgeClass: string }> = {
  nrc_moment: { label: '社員日常', badgeClass: 'bg-orange-50 text-orange-800' },
  wip_work: { label: '實作作品', badgeClass: 'bg-amber-50 text-amber-900' },
  album_highlight: { label: '活動精選', badgeClass: 'bg-blue-50 text-blue-800' },
  qa_highlight: { label: '問答精華', badgeClass: 'bg-emerald-50 text-emerald-800' },
};

export const LEARNING_HOURS_LABELS: Record<LearningHoursCategory, string> = {
  none: '無時數',
  art: '藝文時數',
  life: '生活知能',
  service: '服務學習',
};

export const TOGETHER_ITEM_TYPE_LABELS: Record<TogetherItemType, string> = {
  showcase: '作品試玩展示',
  rebound: 'Rebound 接力',
  field_log: '路線／實務紀錄',
  match_invite: '友社友誼邀約',
  reading_notes: '專題書單觀點',
};

export const EVENT_THEME_PRESETS: Record<
  string,
  { label: string; gradientClass: string; accentHex: string; bgHex: string }
> = {
  warm_paper: {
    label: '暖陽松果',
    gradientClass: 'from-orange-100 via-amber-50 to-orange-50',
    accentHex: '#C2410C',
    bgHex: '#FFF7ED',
  },
  campus_blue: {
    label: '晴空講義',
    gradientClass: 'from-blue-100 via-sky-50 to-indigo-50',
    accentHex: '#1D4ED8',
    bgHex: '#EFF6FF',
  },
  forest_trail: {
    label: '山林野營',
    gradientClass: 'from-emerald-100 via-teal-50 to-lime-50',
    accentHex: '#0F766E',
    bgHex: '#ECFDF5',
  },
  midnight_jam: {
    label: '暗房霓虹',
    gradientClass: 'from-slate-900 via-slate-800 to-indigo-950 text-white',
    accentHex: '#F97316',
    bgHex: '#0F172A',
  },
};

export const ALLOWED_EMBED_HOSTS = [
  'itch.io',
  'youtube.com',
  'www.youtube.com',
  'youtu.be',
  'vimeo.com',
  'player.vimeo.com',
  'soundcloud.com',
  'w.soundcloud.com',
  'figma.com',
  'www.figma.com',
  'github.com',
] as const;

export const REPORT_REASONS: Record<ReportReason, { label: string }> = {
  impersonation: { label: '冒名組織／未經授權代表社團' },
  copyright: { label: '版權或未經授權使用素材' },
  privacy_leak: { label: '揭露非公開個人資料' },
  portrait_violation: { label: '未經授權公開肖像照片' },
  inappropriate: { label: '不當、騷擾或違法內容' },
  other: { label: '其他問題' },
};

export const CURATED_INTEREST_TAGS = [
  '遊戲開發',
  '攝影',
  '音樂展演',
  '程式設計',
  '設計創作',
  '登山戶外',
  '志工服務',
  '投資研究',
  '桌遊電競',
  '舞蹈表演',
  '球類運動',
  '語言飲食',
] as const;

export const DISCOVER_EXAMPLE_PROMPTS = [
  '週四晚上想學畫畫或拍底片，零基礎可以去的',
  '下課後想流汗但沒運動基礎，非社員也能報名',
  '想找一起做遊戲或寫軟體專案的社團夥伴',
  '週末想去郊山走走或認識外籍朋友練習口說',
] as const;

export const RESERVED_SLUGS = new Set([
  'apply',
  'manage',
  'admin',
  'new',
  'api',
  'e',
  'u',
  'blend',
  'onboarding',
  'my-clubs',
  'together',
  'login',
  'me',
]);

export const DISCOVER_DEGRADED_WARNING =
  'AI 語意推薦服務暫時忙碌，已自動切換為基礎檢索結果，推薦理由暫未顯示。';
