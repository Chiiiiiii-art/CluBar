import { and, count, eq, isNull } from 'drizzle-orm';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '../src/db/schema';
import { buildPostEmbeddingText, generateEmbedding } from '../src/lib/ai/client';
import { CLUB_CATEGORIES, POST_TYPES } from '../src/lib/constants';
import { stripMarkdownSummary } from '../src/lib/validators';

for (const envFile of ['.env.local', '.env']) {
  try {
    process.loadEnvFile(envFile);
  } catch {
    // Ignore missing env file
  }
}

async function main() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DIRECT_URL or DATABASE_URL must be set to run scripts/seed.ts.');
  }

  const sql = postgres(url, { prepare: false, max: 1 });
  const db = drizzle(sql, { schema });

  try {
    // 1. Universities
    const uniSeed = [
      { code: 'NCU', name: '國立中央大學', shortName: '中央大學', emailDomains: ['ncu.edu.tw'] },
      { code: 'NTUST', name: '國立臺灣科技大學', shortName: '臺科大', emailDomains: ['ntust.edu.tw'] },
      { code: 'NTHU', name: '國立清華大學', shortName: '清華大學', emailDomains: ['nthu.edu.tw'] },
      { code: 'NYCU', name: '國立陽明交通大學', shortName: '陽明交大', emailDomains: ['nycu.edu.tw'] },
      { code: 'NTU', name: '國立臺灣大學', shortName: '臺灣大學', emailDomains: ['ntu.edu.tw'] },
      { code: 'NCKU', name: '國立成功大學', shortName: '成功大學', emailDomains: ['ncku.edu.tw'] },
      { code: 'NCCU', name: '國立政治大學', shortName: '政治大學', emailDomains: ['nccu.edu.tw'] },
      { code: 'NTNU', name: '國立臺灣師範大學', shortName: '臺師大', emailDomains: ['ntnu.edu.tw'] },
    ];

    for (const u of uniSeed) {
      await db.insert(schema.universities).values(u).onConflictDoNothing();
    }

    const allUnis = await db.select().from(schema.universities);
    const uniByCode = new Map(allUnis.map((u) => [u.code, u]));
    const getUni = (code: string) => {
      const u = uniByCode.get(code);
      if (!u) throw new Error(`Missing university ${code}`);
      return u;
    };

    // 2. Users (covering every role)
    const now = new Date();
    const userSeed = [
      {
        email: 'admin@clubar.edu.tw',
        displayName: 'CluBar 平台管理員',
        platformRole: 'platform_admin' as const,
        campusEmail: 'admin@ncu.edu.tw',
        universityId: getUni('NCU').id,
        campusVerifiedAt: now,
      },
      {
        email: 'ncu-photo-owner@ncu.edu.tw',
        displayName: '林柏翰（攝影社社長）',
        platformRole: 'user' as const,
        campusEmail: 'ncu-photo-owner@ncu.edu.tw',
        universityId: getUni('NCU').id,
        campusVerifiedAt: now,
      },
      {
        email: 'ncu-photo-editor@ncu.edu.tw',
        displayName: '陳映彤（攝影社副社）',
        platformRole: 'user' as const,
        campusEmail: 'ncu-photo-editor@ncu.edu.tw',
        universityId: getUni('NCU').id,
        campusVerifiedAt: now,
      },
      {
        email: 'ncu-alumni@ncu.edu.tw',
        displayName: '張宇翔（歷屆校友）',
        platformRole: 'user' as const,
        campusEmail: 'ncu-alumni@ncu.edu.tw',
        universityId: getUni('NCU').id,
        campusVerifiedAt: now,
      },
      {
        email: 'ncu-csie-owner@ncu.edu.tw',
        displayName: '黃子恩（開源社社長）',
        platformRole: 'user' as const,
        campusEmail: 'ncu-csie-owner@ncu.edu.tw',
        universityId: getUni('NCU').id,
        campusVerifiedAt: now,
      },
      {
        email: 'ntust-photo-owner@ntust.edu.tw',
        displayName: '吳佳穎（臺科大攝影社長）',
        platformRole: 'user' as const,
        campusEmail: 'ntust-photo-owner@ntust.edu.tw',
        universityId: getUni('NTUST').id,
        campusVerifiedAt: now,
      },
      {
        email: 'nthu-maker-owner@nthu.edu.tw',
        displayName: '蔡承翰（清大創客社長）',
        platformRole: 'user' as const,
        campusEmail: 'nthu-maker-owner@nthu.edu.tw',
        universityId: getUni('NTHU').id,
        campusVerifiedAt: now,
      },
      {
        email: 'student-verified@ncu.edu.tw',
        displayName: '王小明（已驗證學生）',
        platformRole: 'user' as const,
        campusEmail: 'student-verified@ncu.edu.tw',
        universityId: getUni('NCU').id,
        campusVerifiedAt: now,
      },
      {
        email: 'student-member@gmail.com',
        displayName: '許同學（一般會員）',
        platformRole: 'user' as const,
        campusEmail: null,
        universityId: null,
        campusVerifiedAt: null,
      },
    ];

    for (const u of userSeed) {
      await db.insert(schema.users).values(u).onConflictDoNothing();
    }

    const allUsers = await db.select().from(schema.users);
    const userByEmail = new Map(allUsers.map((u) => [u.email, u]));
    const getUser = (email: string) => {
      const u = userByEmail.get(email);
      if (!u) throw new Error(`Missing user ${email}`);
      return u;
    };

    // 3. Clubs (14 verified across all 6 categories + 2 unclaimed directory clubs)
    const clubSpecs: {
      uniCode: string;
      slug: string;
      name: string;
      category: schema.ClubCategory;
      tagline: string;
      description: string;
      status: schema.ClubVerificationStatus;
      ownerEmail?: string;
      extraLinks?: schema.ExternalLink[];
    }[] = [
      {
        uniCode: 'NCU',
        slug: 'ncu-photo',
        name: '中央大學攝影研究社',
        category: 'arts',
        tagline: '從底片暗房沖洗到街拍紀實，用鏡頭記錄松果校園的光影日常。',
        description:
          '創立於中大校園，備有完整黑白暗房與數位輸出設備。每學期舉辦外拍工作坊、暗房體驗夜與期末成果展，歡迎零基礎新生一起拿相機走進生活。',
        status: 'verified',
        ownerEmail: 'ncu-photo-owner@ncu.edu.tw',
        extraLinks: [
          { type: 'ig', label: 'Instagram @ncu.photo.demo', url: 'https://instagram.com' },
          { type: 'email', label: '社團信箱', url: 'mailto:ncu-photo-demo@clubar.example.com' },
        ],
      },
      {
        uniCode: 'NTUST',
        slug: 'ntust-photo',
        name: '臺科大光影攝影社',
        category: 'arts',
        tagline: '城市夜拍、人像棚燈與建築幾何攝影的實戰創作基地。',
        description: '結合設計與工程背景同學，專注棚燈布光、展覽策畫與跨校影像交流。',
        status: 'verified',
        ownerEmail: 'ntust-photo-owner@ntust.edu.tw',
        extraLinks: [{ type: 'website', label: '歷屆線上影展', url: 'https://example.com/ntust-photo' }],
      },
      {
        uniCode: 'NTU',
        slug: 'ntu-film',
        name: '臺大底片與影像創作社',
        category: 'arts',
        tagline: '135/120 底片沖掃、短片劇本與獨立紀錄片放映聚會。',
        description: '每週定期舉辦小規模看片討論與暗房實作，累積校園獨立影像創作者社群。',
        status: 'verified',
        ownerEmail: 'ntust-photo-owner@ntust.edu.tw',
      },
      {
        uniCode: 'NCU',
        slug: 'ncu-csie',
        name: '中大軟體開源研究社',
        category: 'academic',
        tagline: '從零打造校園數位工具、全端專案讀書會與黑客松實戰。',
        description:
          '我們相信寫程式最好的學法是一起做真實有人用的產品！每學期組隊開發校園工具、舉辦 Git / TypeScript / AI 應用工作坊。',
        status: 'verified',
        ownerEmail: 'ncu-csie-owner@ncu.edu.tw',
        extraLinks: [
          { type: 'website', label: 'GitHub 開源組織', url: 'https://github.com' },
          { type: 'form', label: '專案認領登記', url: 'https://example.com/ncu-csie-join' },
        ],
      },
      {
        uniCode: 'NTHU',
        slug: 'nthu-maker',
        name: '清大創客智造社',
        category: 'academic',
        tagline: '3D 列印、雷射切割與嵌入式物聯網的動手做實驗室。',
        description: '開放所有科系同學使用創客機台，從原型設計到機器人競賽一步步實作完成。',
        status: 'verified',
        ownerEmail: 'nthu-maker-owner@nthu.edu.tw',
      },
      {
        uniCode: 'NCU',
        slug: 'ncu-ai-lab',
        name: '中大資料科學與 AI 社',
        category: 'academic',
        tagline: '結合 RAG 應用、資料視覺化與企業真實題目的跨領域社群。',
        description: '帶領商管、理學院與資電同學合作完成 AI 應用小專題並參與校內外競賽。',
        status: 'verified',
        ownerEmail: 'ncu-csie-owner@ncu.edu.tw',
      },
      {
        uniCode: 'NCU',
        slug: 'ncu-mountaineering',
        name: '中大山林登山社',
        category: 'sports',
        tagline: '從郊山健行、負重訓練到百岳縱走的安全戶外探索。',
        description: '重視登山安全、地圖判位與體能循序培養，新手也能從一日郊山安全踏出第一步。',
        status: 'verified',
        ownerEmail: 'ncu-photo-owner@ncu.edu.tw',
      },
      {
        uniCode: 'NCKU',
        slug: 'ncku-badminton',
        name: '成大羽球入門與交流社',
        category: 'sports',
        tagline: '零基礎友善！下課後輕鬆流汗、基本握拍與雙打輪轉練習。',
        description: '分組教學照顧新手與進階球友，每週兩晚在體育館開心揮拍交朋友。',
        status: 'verified',
        ownerEmail: 'nthu-maker-owner@nthu.edu.tw',
      },
      {
        uniCode: 'NCU',
        slug: 'ncu-boardgame',
        name: '中大桌遊策略研習社',
        category: 'recreation',
        tagline: '超過 120 款派對與策略桌遊，下課舒壓又能認識跨系新朋友。',
        description: '每週四晚間定期開桌，新手專人帶規則教學，期中還有桌遊設計工作坊。',
        status: 'verified',
        ownerEmail: 'ncu-photo-editor@ncu.edu.tw',
      },
      {
        uniCode: 'NCCU',
        slug: 'nccu-tea',
        name: '政大茶藝與手沖咖啡社',
        category: 'recreation',
        tagline: '在一杯手沖與台灣烏龍茶香裡放慢節奏、認識同好。',
        description: '從產區風味品評到露營手沖器具實作，歡迎喜歡生活美學的同學加入。',
        status: 'verified',
        ownerEmail: 'ntust-photo-owner@ntust.edu.tw',
      },
      {
        uniCode: 'NCU',
        slug: 'ncu-edu-service',
        name: '中大偏鄉數位教育服務團',
        category: 'service',
        tagline: '把程式積木、科學實驗與陪伴帶進桃園復興與偏鄉小學。',
        description: '結合週末實體營隊與線上課後伴讀，讓大學生專業轉化為孩子的學習火種。',
        status: 'verified',
        ownerEmail: 'ncu-csie-owner@ncu.edu.tw',
      },
      {
        uniCode: 'NTUST',
        slug: 'ntust-eco',
        name: '臺科大永續校園行動社',
        category: 'service',
        tagline: '推動二手物交換市集、校園減塑與碳盤查公民科學。',
        description: '用實際設計思考與社區營造改善校園日常浪費，累積可量化的永續行動成果。',
        status: 'verified',
        ownerEmail: 'ntust-photo-owner@ntust.edu.tw',
      },
      {
        uniCode: 'NCU',
        slug: 'ncu-intl',
        name: '中大國際文化交流社',
        category: 'social',
        tagline: '連結本地生與外籍交換生的語言交換、料理之夜與文化沙龍。',
        description: '不用出國就能練習外語、了解不同國家飲食與校園生活，打造友善雙語社交圈。',
        status: 'verified',
        ownerEmail: 'ncu-photo-editor@ncu.edu.tw',
      },
      {
        uniCode: 'NTNU',
        slug: 'ntnu-host',
        name: '臺師大活動主持與聯誼社',
        category: 'social',
        tagline: '訓練舞台表達、活動企劃主持與跨校聯誼破冰遊戲設計。',
        description: '提供新生大量上台練習與活動控場實戰，幫助內向同學也能自信開口交流。',
        status: 'verified',
        ownerEmail: 'nthu-maker-owner@nthu.edu.tw',
      },
      // 2 unclaimed directory clubs for FR-GOV-01 claim demo
      {
        uniCode: 'NCU',
        slug: 'ncu-astronomy',
        name: '中央大學天文社',
        category: 'academic',
        tagline: '來自校方名錄之天文觀測與星空攝影社團（等待幹部認領）。',
        description: '',
        status: 'unclaimed_directory',
      },
      {
        uniCode: 'NCU',
        slug: 'ncu-coffee',
        name: '中央大學咖啡研習社',
        category: 'recreation',
        tagline: '來自校方名錄之手沖、拉花與烘焙交流社團（等待幹部認領）。',
        description: '',
        status: 'unclaimed_directory',
      },
    ];

    for (const c of clubSpecs) {
      await db
        .insert(schema.clubs)
        .values({
          universityId: getUni(c.uniCode).id,
          slug: c.slug,
          name: c.name,
          category: c.category,
          tagline: c.tagline,
          description: c.description,
          coverUrl: '/images/demo/cover.svg',
          avatarUrl: `/images/demo/${c.category}.svg`,
          externalLinks: c.extraLinks ?? [
            { type: 'website', label: '社團示範頁面', url: `https://example.com/${c.slug}` },
          ],
          verificationStatus: c.status,
          isDemo: true,
          officialDirectoryUrl:
            c.status === 'unclaimed_directory'
              ? 'https://club.adm.ncu.edu.tw/clubs'
              : null,
        })
        .onConflictDoNothing();
    }

    const allClubs = await db.select().from(schema.clubs);
    const clubBySlug = new Map(allClubs.map((c) => [c.slug, c]));
    const getClub = (slug: string) => {
      const c = clubBySlug.get(slug);
      if (!c) throw new Error(`Missing club ${slug}`);
      return c;
    };

    // 4. Memberships (owners, editors, alumni)
    for (const spec of clubSpecs) {
      if (!spec.ownerEmail) continue;
      const club = getClub(spec.slug);
      const ownerUser = getUser(spec.ownerEmail);
      const existingOwner = await db
        .select()
        .from(schema.clubMemberships)
        .where(
          and(
            eq(schema.clubMemberships.clubId, club.id),
            eq(schema.clubMemberships.role, 'owner'),
            isNull(schema.clubMemberships.endedAt)
          )
        )
        .limit(1);
      if (existingOwner.length === 0) {
        await db
          .insert(schema.clubMemberships)
          .values({
            clubId: club.id,
            userId: ownerUser.id,
            role: 'owner',
            title: '社長',
          })
          .onConflictDoNothing();
      }
    }

    // Add editor + alumni to ncu-photo for handover & summary demos
    const photoClub = getClub('ncu-photo');
    await db
      .insert(schema.clubMemberships)
      .values({
        clubId: photoClub.id,
        userId: getUser('ncu-photo-editor@ncu.edu.tw').id,
        role: 'editor',
        title: '副社長兼暗房長',
      })
      .onConflictDoNothing();

    const existingAlumni = await db
      .select()
      .from(schema.clubMemberships)
      .where(
        and(
          eq(schema.clubMemberships.clubId, photoClub.id),
          eq(schema.clubMemberships.userId, getUser('ncu-alumni@ncu.edu.tw').id),
          eq(schema.clubMemberships.role, 'alumni')
        )
      )
      .limit(1);
    if (existingAlumni.length === 0) {
      await db.insert(schema.clubMemberships).values({
        clubId: photoClub.id,
        userId: getUser('ncu-alumni@ncu.edu.tw').id,
        role: 'alumni',
        title: '113 屆社長',
        endedAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000),
      });
    }

    // 5. Posts (3 per verified club = 42 posts across 114 & 115 academic years)
    const postBlueprints: Record<
      string,
      {
        title: string;
        type: schema.PostType;
        year: number;
        tags: string[];
        daysAgo: number;
        body: string;
      }[]
    > = {
      'ncu-photo': [
        {
          title: '松果底片暗房體驗夜：零基礎新手的第一卷黑白底片沖洗',
          type: 'workshop',
          year: 115,
          tags: ['攝影', '設計創作'],
          daysAgo: 4,
          body: '### 為什麼從黑白底片開始？\n\n很多同學想學拍底片卻擔心成本高或不知道怎麼顯影。這次社課從相機裝片、測光口訣一路帶到暗房顯影與定影，每位新手都在兩小時內完成自己親手洗出的底片並帶走明信片作品。',
        },
        {
          title: '《夜色松林》115 期中校園攝影聯展作品集',
          type: 'work',
          year: 115,
          tags: ['攝影', '設計創作'],
          daysAgo: 18,
          body: '### 展覽亮點\n\n集結 18 位社員於百花川、中大湖與老街拍攝的 42 幅銀鹽與數位紀實作品，搭配創作者手寫拍攝筆記，記錄通勤與深夜趕專題的校園片刻。',
        },
        {
          title: '大溪老街紀實外拍與構圖講評紀錄',
          type: 'event',
          year: 114,
          tags: ['攝影'],
          daysAgo: 95,
          body: '### 活動回顧\n\n利用週末上午光線柔和時段帶隊前往大溪老街進行街拍任務，分組交換觀察視角並於返校後舉辦一對一構圖講評。',
        },
      ],
      'ntust-photo': [
        {
          title: '城市天際線長曝光：夜間車軌與低光拍攝技巧彙整',
          type: 'workshop',
          year: 115,
          tags: ['攝影', '設計創作'],
          daysAgo: 7,
          body: '整理腳架穩定、快門線使用、ISO 雜訊控制與 RAW 檔白平衡後製實戰筆記，適合剛入手無反相機的同學快速上手夜拍。',
        },
        {
          title: '台科校園人物故事計畫《做設計的雙手》',
          type: 'work',
          year: 115,
          tags: ['攝影'],
          daysAgo: 25,
          body: '走訪工坊與實驗室，拍攝同學打磨木作、焊接電路與深夜調色模型的專注瞬間。',
        },
        {
          title: '北部大專聯合棚拍燈光交流日',
          type: 'event',
          year: 114,
          tags: ['攝影', '語言文化'],
          daysAgo: 130,
          body: '邀請三校攝影社共同實測柔光罩與雙燈人像布光配置，並公開棚燈器材清單供友社參考。',
        },
      ],
      'ntu-film': [
        {
          title: '120 中片幅街拍特輯：慢下來看城市的十二個視角',
          type: 'work',
          year: 115,
          tags: ['攝影', '戲劇電影'],
          daysAgo: 12,
          body: '一卷只有 12 張的限制，反而讓我們在按下快門前更仔細觀察光影和街角人物的互動。',
        },
        {
          title: '獨立短片收音與剪輯工作坊筆記',
          type: 'workshop',
          year: 115,
          tags: ['戲劇電影', '音樂'],
          daysAgo: 35,
          body: '示範指向性麥克風收音技巧、現場環境音降噪與 DaVinci Resolve 基礎調色流程。',
        },
        {
          title: '春季校內草地露天放映會籌備紀錄',
          type: 'event',
          year: 114,
          tags: ['戲劇電影'],
          daysAgo: 160,
          body: '從公開播映授權洽談到戶外音響電壓計算的完整籌備經驗紀錄。',
        },
      ],
      'ncu-csie': [
        {
          title: '從零開發「校園選課共筆平台」TypeScript 全端實戰',
          type: 'work',
          year: 115,
          tags: ['程式設計', '設計創作'],
          daysAgo: 3,
          body: '### 專案背景\n\n由 5 位大一到大三社員組成小隊，使用 Next.js、PostgreSQL 與 Tailwind CSS 在八週內完成可實際服務全校的開源專案，歡迎想找一起做軟體專案夥伴的同學加入下期小隊！',
        },
        {
          title: 'Git 團隊協作與 CI/CD 自動化新手工作坊',
          type: 'workshop',
          year: 115,
          tags: ['程式設計'],
          daysAgo: 20,
          body: '透過模擬多人衝突解謎關卡，帶大家不再害怕 merge conflict 與 Pull Request Code Review。',
        },
        {
          title: '2025 校園黑客松獲獎作品《無障礙教室導航》',
          type: 'competition',
          year: 114,
          tags: ['程式設計', '志工服務'],
          daysAgo: 110,
          body: '整合校內無障礙坡道與電梯即時狀態，獲得評審特別獎與校務創新提案肯定。',
        },
      ],
      'nthu-maker': [
        {
          title: '自動澆水與土壤濕度感測陽台模組開源設計',
          type: 'work',
          year: 115,
          tags: ['創客手作', '程式設計'],
          daysAgo: 9,
          body: '結合 ESP32、3D 列印防水外殼與簡易手機儀表板，材料總成本不到新台幣 400 元。',
        },
        {
          title: '雷射切割壓克力夜燈手作體驗課',
          type: 'workshop',
          year: 115,
          tags: ['創客手作', '設計創作'],
          daysAgo: 28,
          body: '零設計基礎也能一小時學會向量描邊，完成專屬個人文字圖案的小夜燈。',
        },
        {
          title: '全國自走車競速賽參賽心得與感測器校準',
          type: 'competition',
          year: 114,
          tags: ['創客手作', '程式設計'],
          daysAgo: 140,
          body: '分享紅外線循跡陣列在高反光比賽場地下的 PID 調參經驗。',
        },
      ],
      'ncu-ai-lab': [
        {
          title: '用開源向量資料庫打造系所法規與修課問答小助手',
          type: 'work',
          year: 115,
          tags: ['程式設計'],
          daysAgo: 6,
          body: '實測文件切片長度與檢索重排策略，將跨院轉系規定查詢時間從 20 分鐘縮短到 10 秒內。',
        },
        {
          title: 'Python 資料清理與視覺化圖表實戰社課',
          type: 'workshop',
          year: 115,
          tags: ['程式設計'],
          daysAgo: 24,
          body: '以台灣公開交通與氣象數據為題，帶非資工系同學畫出清晰易懂的互動統計圖。',
        },
        {
          title: '微軟校園 AI 創新應用提案松入圍經驗分享',
          type: 'competition',
          year: 114,
          tags: ['程式設計', '設計創作'],
          daysAgo: 80,
          body: '整理從痛點訪談、PRD 收斂到 3 分鐘 Pitch Demo 的專案節奏控管訣竅。',
        },
      ],
      'ncu-mountaineering': [
        {
          title: '新手友善！觀音山半日健行與登山杖使用教學',
          type: 'event',
          year: 115,
          tags: ['登山戶外'],
          daysAgo: 5,
          body: '專為沒爬過山、想在下課或週末流汗接觸大自然的同學設計，全程領隊押後、裝備輕便即可出發。',
        },
        {
          title: '奇萊南華二日輕裝行前訓練與高山症預防講座',
          type: 'workshop',
          year: 115,
          tags: ['登山戶外'],
          daysAgo: 22,
          body: '示範洋蔥式穿法、無痕山林原則與離線等高線地圖判讀。',
        },
        {
          title: '114 冬季合歡北峰雪季裝備檢整紀錄',
          type: 'work',
          year: 114,
          tags: ['登山戶外'],
          daysAgo: 150,
          body: '記錄冰爪試穿與營地防風繩結實作，建立安全戶外隊伍文化。',
        },
      ],
      'ncku-badminton': [
        {
          title: '零基礎新生歡樂揮拍夜：正確握拍與發高遠球入門',
          type: 'workshop',
          year: 115,
          tags: ['球類運動'],
          daysAgo: 8,
          body: '沒打過羽球完全沒關係！由學長姐分場一對一調整發球與步伐，下課後一起流汗超舒壓。',
        },
        {
          title: '新生盃趣味混雙交流賽花絮',
          type: 'event',
          year: 115,
          tags: ['球類運動'],
          daysAgo: 29,
          body: '採用分級讓分制度讓初學者也能享受拉鋸對打的樂趣。',
        },
        {
          title: '南區四校羽球社聯誼友誼賽成果',
          type: 'competition',
          year: 114,
          tags: ['球類運動'],
          daysAgo: 115,
          body: '累積超過 60 位社員上場實戰並互相錄影檢討站位輪轉。',
        },
      ],
      'ncu-boardgame': [
        {
          title: '週四桌遊開箱夜：《璀璨寶石》與陣營心機局歡樂實錄',
          type: 'event',
          year: 115,
          tags: ['桌遊電競'],
          daysAgo: 10,
          body: '不用自帶朋友！每次聚會都有親切桌長協助併桌與講解規則，最適合想自然認識新同學的你。',
        },
        {
          title: '校園原創桌遊原型測試工作坊',
          type: 'work',
          year: 115,
          tags: ['桌遊電競', '設計創作'],
          daysAgo: 32,
          body: '社員自製 3 款以校園生活為題的紙牌機制遊戲，現場試玩並回饋數值平衡。',
        },
        {
          title: '期中桌遊馬拉松與減壓茶會',
          type: 'event',
          year: 114,
          tags: ['桌遊電競'],
          daysAgo: 105,
          body: '期中考後週末舉辦四小時輕鬆派對遊戲專場。',
        },
      ],
      'nccu-tea': [
        {
          title: '手沖咖啡入門：濾杯水流控制與淺焙果香萃取體驗',
          type: 'workshop',
          year: 115,
          tags: ['創客手作', '語言文化'],
          daysAgo: 11,
          body: '比較 V60 與聰明濾杯的風味差異，讓宿舍也能沖出穩定好喝的日常咖啡。',
        },
        {
          title: '草地野餐茶席與台灣高山茶品評會',
          type: 'event',
          year: 115,
          tags: ['語言文化'],
          daysAgo: 38,
          body: '邀請在地茶農分享製茶故事並體驗冷泡與熱沖的層次變化。',
        },
        {
          title: '期末咖啡拉花趣味交流賽作品牆',
          type: 'competition',
          year: 114,
          tags: ['創客手作'],
          daysAgo: 135,
          body: '紀錄社員從打奶泡到完成愛心與鬱金香拉花的進步軌跡。',
        },
      ],
      'ncu-edu-service': [
        {
          title: '復興區小學週末科學營：自製水火箭與生態觀察筆記',
          type: 'event',
          year: 115,
          tags: ['志工服務', '創客手作'],
          daysAgo: 14,
          body: '24 位志工籌備一個月的教案正式上線，看見孩子們發射水火箭時的笑容是最好的回饋。',
        },
        {
          title: '偏鄉線上伴讀志工培訓與溝通技巧講義',
          type: 'workshop',
          year: 115,
          tags: ['志工服務'],
          daysAgo: 42,
          body: '建立標準化陪伴守則與課程教材共備資料夾，讓每一屆志工都能無痛接軌。',
        },
        {
          title: '114 學年度寒假教育服務隊成果紀錄冊',
          type: 'work',
          year: 114,
          tags: ['志工服務'],
          daysAgo: 180,
          body: '完整彙整五天四夜課程表、預算明細與在地國小師長回饋。',
        },
      ],
      'ntust-eco': [
        {
          title: '校園二手物循環市集：兩天讓 380 件好物找到新主人',
          type: 'event',
          year: 115,
          tags: ['志工服務', '設計創作'],
          daysAgo: 16,
          body: '整合免費交換區與舊衣改造縫紉攤位，大幅減少學期末搬宿垃圾量。',
        },
        {
          title: '校園咖啡渣再製除臭磚手作實作',
          type: 'work',
          year: 115,
          tags: ['志工服務', '創客手作'],
          daysAgo: 45,
          body: '向校內咖啡店回收咖啡渣烘乾定型，做成可重複使用的環保除濕除臭磚。',
        },
        {
          title: '跨校綠色生活策展提案交流紀錄',
          type: 'workshop',
          year: 114,
          tags: ['志工服務'],
          daysAgo: 165,
          body: '分享如何用簡單問卷與行為設計提高同學自備環保杯比例。',
        },
      ],
      'ncu-intl': [
        {
          title: '異國料理之夜：與交換生一起包水餃、做印度香料奶茶',
          type: 'event',
          year: 115,
          tags: ['語言文化'],
          daysAgo: 13,
          body: '來自 9 個國家的同學在宿舍交誼廳分享家鄉料理，邊吃邊聊各地大學文化，英文不用很流利也能玩得很開心！',
        },
        {
          title: '英語咖啡角與口說破冰指南',
          type: 'workshop',
          year: 115,
          tags: ['語言文化'],
          daysAgo: 36,
          body: '設計趣味話題卡，幫助害羞不敢開口說英文的同學跨出第一步。',
        },
        {
          title: '大溪文化一日輕旅行交換生導覽紀錄',
          type: 'work',
          year: 114,
          tags: ['語言文化', '攝影'],
          daysAgo: 120,
          body: '由本地社員設計雙語導覽手冊並全程陪走紀錄。',
        },
      ],
      'ntnu-host': [
        {
          title: '零怯場上台表達：三分鐘破冰遊戲與主持控場工作坊',
          type: 'workshop',
          year: 115,
          tags: ['語言文化', '舞蹈表演'],
          daysAgo: 15,
          body: '從聲音共鳴、眼神互動到突發冷場救援實練，適合想培養自信與主持能力的同學。',
        },
        {
          title: '北區三校聯合迎新晚會主持與企劃復盤',
          type: 'event',
          year: 115,
          tags: ['舞蹈表演', '音樂'],
          daysAgo: 40,
          body: '公開當晚 Flow 流程表與音控場控分工清單，供各校活動組參考。',
        },
        {
          title: '校園活動司儀手冊 2.0 數位版',
          type: 'work',
          year: 114,
          tags: ['語言文化'],
          daysAgo: 145,
          body: '整理典禮串場詞範本與麥克風架設檢查表，讓新手幹部不再手忙腳亂。',
        },
      ],
    };

    for (const [slug, blueprints] of Object.entries(postBlueprints)) {
      const club = getClub(slug);
      const spec = clubSpecs.find((s) => s.slug === slug)!;
      const author = getUser(spec.ownerEmail!);
      const existingPosts = await db
        .select({
          id: schema.posts.id,
          title: schema.posts.title,
          embedding: schema.posts.embedding,
        })
        .from(schema.posts)
        .where(eq(schema.posts.clubId, club.id));
      const existingByTitle = new Map(existingPosts.map((p) => [p.title, p]));

      for (const bp of blueprints) {
        const existing = existingByTitle.get(bp.title);
        if (existing && existing.embedding !== null) continue;
        const pubDate = new Date(Date.now() - bp.daysAgo * 24 * 60 * 60 * 1000);
        const summary = stripMarkdownSummary(bp.body, 140);
        const uni = getUni(spec.uniCode);

        const embedding = await generateEmbedding(
          buildPostEmbeddingText({
            universityShortName: uni.shortName,
            clubName: club.name,
            categoryLabel: CLUB_CATEGORIES[club.category].label,
            postTypeLabel: POST_TYPES[bp.type].label,
            title: bp.title,
            summary,
            tags: bp.tags,
            contentMd: bp.body,
          })
        );

        if (existing) {
          if (embedding) {
            await db
              .update(schema.posts)
              .set({ embedding, embeddingUpdatedAt: now })
              .where(eq(schema.posts.id, existing.id));
          }
          continue;
        }

        await db.insert(schema.posts).values({
          clubId: club.id,
          authorUserId: author.id,
          academicYear: bp.year,
          postType: bp.type,
          title: bp.title,
          summary,
          contentMd: bp.body,
          tags: bp.tags,
          mediaUrls: [{ url: `/images/demo/${club.category}.svg`, alt: bp.title, width: 800, height: 500 }],
          externalLinks: [],
          originalityConfirmed: true,
          status: 'published',
          embedding,
          embeddingUpdatedAt: embedding ? now : null,
          publishedAt: pubDate,
        });
      }
    }

    // 6. Opportunities (12 active)
    const oppSeeds: { slug: string; title: string; summary: string; schedule: string }[] = [
      {
        slug: 'ncu-photo',
        title: '週三暗房底片沖洗體驗旁聽',
        summary: '免自備相機與底片，現場借用底片機與藥水體驗手工顯影。',
        schedule: '每週三 19:00 志希館地下室暗房',
      },
      {
        slug: 'ncu-csie',
        title: '下學期開源校園工具小隊招募',
        summary: '歡迎前端、UI 設計、後端或完全零基礎想學寫網頁的新生一起組隊！',
        schedule: '每週二 19:30 工程五館 A204',
      },
      {
        slug: 'ncu-mountaineering',
        title: '新手郊山一日體驗隊報名',
        summary: '輕鬆步調走訪桃園小百岳，含行前裝備借用說明。',
        schedule: '隔週六 08:00 中大校門口集合',
      },
      {
        slug: 'ncu-boardgame',
        title: '週四晚間新手友善桌遊夜',
        summary: '免帶夥伴、專人教規則，下課後直接來玩。',
        schedule: '每週四 18:30 學生活動中心',
      },
      {
        slug: 'ncu-intl',
        title: '週五跨文化料理與語言交換沙龍',
        summary: '想練英文日文或認識外籍同學歡迎自由報名參加。',
        schedule: '每週五 18:30 遊藝館',
      },
      {
        slug: 'ntust-photo',
        title: '台北城市夜拍外拍小團',
        summary: '實際操作夜間長曝光與構圖技巧，歡迎跨校攝影同好交流。',
        schedule: '每月雙週六 18:00 捷運北門站集合',
      },
    ];

    for (const o of oppSeeds) {
      const club = getClub(o.slug);
      const existing = await db
        .select({ id: schema.clubOpportunities.id })
        .from(schema.clubOpportunities)
        .where(
          and(
            eq(schema.clubOpportunities.clubId, club.id),
            eq(schema.clubOpportunities.title, o.title)
          )
        )
        .limit(1);
      if (existing.length === 0) {
        await db.insert(schema.clubOpportunities).values({
          clubId: club.id,
          title: o.title,
          summary: o.summary,
          scheduleText: o.schedule,
          deadlineAt: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
          externalUrl: `https://example.com/${o.slug}/apply`,
          isActive: true,
        });
      }
    }

    // 7. Cross-campus Forum Threads + Replies (6 categories, >= 2 universities interacting)
    const threadSeeds: {
      slug: string;
      authorEmail: string;
      authorTitle: string;
      category: schema.ClubCategory;
      tag: schema.ForumTag;
      title: string;
      body: string;
      replies: { slug: string; authorEmail: string; title: string; body: string }[];
    }[] = [
      {
        slug: 'ncu-photo',
        authorEmail: 'ncu-photo-owner@ncu.edu.tw',
        authorTitle: '社長',
        category: 'arts',
        tag: 'equipment',
        title: '請問各校攝影社如何維護公用底片相機與防潮箱管理？',
        body: '我們目前有 8 台借給新生體驗的 SLR 機身，常遇到測光電池忘記關閉或鏡頭發霉問題，想請教各校的借用押金或點交檢核表做法。',
        replies: [
          {
            slug: 'ntust-photo',
            authorEmail: 'ntust-photo-owner@ntust.edu.tw',
            title: '社長',
            body: '我們在機身貼 QR Code 點交表單，歸還時必須當場拆電池並拍一張防潮箱濕度計照片上傳，這學期漏關電源問題少了一半以上！',
          },
          {
            slug: 'ntu-film',
            authorEmail: 'ntust-photo-owner@ntust.edu.tw',
            title: '器材組',
            body: '補充建議可以準備矽膠乾燥劑替換包給外拍借出的同學帶著，遇到雨天外拍特別有用。',
          },
        ],
      },
      {
        slug: 'ncu-csie',
        authorEmail: 'ncu-csie-owner@ncu.edu.tw',
        authorTitle: '社長',
        category: 'academic',
        tag: 'event_exp',
        title: '如何讓非資訊科系新生也能跟上學期中的小專題實作？',
        body: '往年直接教 Git 和 React 很容易在第三週流失非本科生，今年嘗試改成「先組隊挑校園問題再按需補課」，想交流各校技術社團的留存率作法。',
        replies: [
          {
            slug: 'nthu-maker',
            authorEmail: 'nthu-maker-owner@nthu.edu.tw',
            title: '社長',
            body: '我們這兩年把軟體和硬體組混編，讓設計或人文同學負責介面原型與使用者訪談，成就感很高、幾乎不會半途退社！',
          },
        ],
      },
      {
        slug: 'ncu-mountaineering',
        authorEmail: 'ncu-photo-owner@ncu.edu.tw',
        authorTitle: '領隊',
        category: 'sports',
        tag: 'management',
        title: '初學者體能訓練菜單與郊山安全領隊比建議',
        body: '整理我們這學期採用的 1:5 領隊壓後比例與行前雨備退場SOP，歡迎各校山社或球類社分享新手帶隊經驗。',
        replies: [
          {
            slug: 'ncku-badminton',
            authorEmail: 'nthu-maker-owner@nthu.edu.tw',
            title: '教學長',
            body: '體育性社團真的很需要明確的新手分級，我們也在課前公告建議穿搭與暖身時段，新手報到率明顯提高。',
          },
        ],
      },
      {
        slug: 'ncu-boardgame',
        authorEmail: 'ncu-photo-editor@ncu.edu.tw',
        authorTitle: '幹部',
        category: 'recreation',
        tag: 'venue',
        title: '社辦空間不足時如何與學校協調晚上開放公共教室？',
        body: '週四社課常常超過 35 人，想請問他校康樂性社團都是提前多久申請教室或如何協調場地燈光管理。',
        replies: [
          {
            slug: 'nccu-tea',
            authorEmail: 'ntust-photo-owner@ntust.edu.tw',
            title: '活動長',
            body: '建議先整理過去三個月的出席照片與場地清潔紀錄給課外組看，通常會更容易批核晚上大型階梯教室外的討論空間。',
          },
        ],
      },
      {
        slug: 'ncu-edu-service',
        authorEmail: 'ncu-csie-owner@ncu.edu.tw',
        authorTitle: '團長',
        category: 'service',
        tag: 'collab',
        title: '誠徵北部大專服務性社團交換偏鄉營隊教案與保險經驗',
        body: '今年我們準備了 6 套不插電運算思維教案，歡迎他校偏鄉服務團直接參考改寫或聯合出隊！',
        replies: [
          {
            slug: 'ntust-eco',
            authorEmail: 'ntust-photo-owner@ntust.edu.tw',
            title: '社長',
            body: '我們有循環手作教案可以交換！待會點進你們社團主頁用信箱聯繫細談合作。',
          },
        ],
      },
      {
        slug: 'ncu-intl',
        authorEmail: 'ncu-photo-editor@ncu.edu.tw',
        authorTitle: '活動組',
        category: 'social',
        tag: 'event_exp',
        title: '雙語活動讓本地生跟外籍生真正聊起來的破冰設計',
        body: '以前大家常常各聊各的，後來改用「家鄉零食盲測＋小卡任務」強制混組，效果出奇地好！',
        replies: [
          {
            slug: 'ntnu-host',
            authorEmail: 'nthu-maker-owner@nthu.edu.tw',
            title: '社長',
            body: '這個機制超棒，建議活動開始前 10 分鐘一定要有一位雙語主持人先示範怎麼出糗開玩笑，大家壓力就會瞬間降下來。',
          },
        ],
      },
    ];

    for (const ts of threadSeeds) {
      const existing = await db
        .select({ id: schema.forumThreads.id })
        .from(schema.forumThreads)
        .where(eq(schema.forumThreads.title, ts.title))
        .limit(1);
      if (existing.length > 0) continue;

      const club = getClub(ts.slug);
      const author = getUser(ts.authorEmail);

      const [thread] = await db
        .insert(schema.forumThreads)
        .values({
          category: ts.category,
          discussionTag: ts.tag,
          clubId: club.id,
          authorUserId: author.id,
          authorTitle: ts.authorTitle,
          title: ts.title,
          contentMd: ts.body,
          replyCount: ts.replies.length,
        })
        .returning();

      for (const r of ts.replies) {
        const rClub = getClub(r.slug);
        const rAuthor = getUser(r.authorEmail);
        await db.insert(schema.forumReplies).values({
          threadId: thread.id,
          clubId: rClub.id,
          authorUserId: rAuthor.id,
          authorTitle: r.title,
          contentMd: r.body,
        });
      }
    }

    // 8. Sample anonymous analytics events (only if empty)
    const [evtCount] = await db.select({ total: count() }).from(schema.analyticsEvents);
    if (Number(evtCount?.total ?? 0) === 0) {
      await db.insert(schema.analyticsEvents).values([
        {
          eventType: 'discover_query_submit',
          universityId: getUni('NCU').id,
          sourceSurface: 'discover_nl',
        },
        {
          eventType: 'discover_card_click',
          universityId: getUni('NCU').id,
          clubId: photoClub.id,
          category: 'arts',
          sourceSurface: 'discover_nl',
        },
        {
          eventType: 'club_page_view',
          universityId: getUni('NCU').id,
          clubId: photoClub.id,
          category: 'arts',
          sourceSurface: 'club_page',
        },
        {
          eventType: 'official_link_click',
          universityId: getUni('NCU').id,
          clubId: photoClub.id,
          category: 'arts',
          sourceSurface: 'club_page',
        },
        {
          eventType: 'opportunity_link_click',
          universityId: getUni('NCU').id,
          clubId: getClub('ncu-csie').id,
          category: 'academic',
          sourceSurface: 'club_page',
        },
      ]);
    }

    console.log(
      `Seed completed: ${allUnis.length} universities, ${allClubs.length} clubs, posts & cross-campus forum ready.`
    );
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
