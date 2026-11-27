import { and, eq, isNull } from 'drizzle-orm';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '../src/db/schema';
import {
  DEFAULT_FAQ_TEMPLATES,
  INTEREST_DOMAIN_SEEDS,
} from '../src/lib/constants';

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
    // 1. Universities (8 indicator universities)
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
    const getUni = (code: string) => {
      const u = allUnis.find((x) => x.code === code);
      if (!u) throw new Error(`Missing university ${code}`);
      return u;
    };

    // 2. Interest Domains (12 fine-grained domains)
    for (const d of INTEREST_DOMAIN_SEEDS) {
      await db.insert(schema.interestDomains).values(d).onConflictDoNothing();
    }
    const allDomains = await db.select().from(schema.interestDomains);
    const getDomain = (slug: string) => {
      const d = allDomains.find((x) => x.slug === slug);
      if (!d) throw new Error(`Missing domain ${slug}`);
      return d;
    };

    // 3. Users covering platform_admin, school_admin, owner, editor, member, alumni, verified, unverified
    const now = new Date();
    const userSeed: (typeof schema.users.$inferInsert)[] = [
      {
        email: 'admin@clubar.edu.tw',
        displayName: 'CluBar 平台管理員',
        handle: 'clubar-admin',
        platformRole: 'platform_admin',
        campusEmail: 'admin@ncu.edu.tw',
        universityId: getUni('NCU').id,
        campusVerifiedAt: now,
      },
      {
        email: 'ncu-osa@ncu.edu.tw',
        displayName: '陳承辦（中大課外組）',
        handle: 'ncu-osa',
        platformRole: 'school_admin',
        campusEmail: 'ncu-osa@ncu.edu.tw',
        universityId: getUni('NCU').id,
        managedUniversityId: getUni('NCU').id,
        campusVerifiedAt: now,
      },
      {
        email: 'ncu-photo-owner@ncu.edu.tw',
        displayName: '林柏翰（攝影社社長）',
        handle: 'bohan-photo',
        platformRole: 'user',
        campusEmail: 'ncu-photo-owner@ncu.edu.tw',
        universityId: getUni('NCU').id,
        campusVerifiedAt: now,
      },
      {
        email: 'ncu-photo-editor@ncu.edu.tw',
        displayName: '陳映彤（攝影社副社）',
        handle: 'yingtong-photo',
        platformRole: 'user',
        campusEmail: 'ncu-photo-editor@ncu.edu.tw',
        universityId: getUni('NCU').id,
        campusVerifiedAt: now,
      },
      {
        email: 'ncu-photo-member@ncu.edu.tw',
        displayName: '周子軒（攝影社社員）',
        handle: 'zixuan-photo',
        platformRole: 'user',
        campusEmail: 'ncu-photo-member@ncu.edu.tw',
        universityId: getUni('NCU').id,
        campusVerifiedAt: now,
        portfolioVisibility: 'public',
      },
      {
        email: 'ncu-alumni@ncu.edu.tw',
        displayName: '張宇翔（113 屆校友）',
        handle: 'yuxiang-alumni',
        platformRole: 'user',
        campusEmail: 'ncu-alumni@ncu.edu.tw',
        universityId: getUni('NCU').id,
        campusVerifiedAt: now,
        alumniPingEnabled: true,
        alumniExpertiseTags: ['中大教研借用', '評鑑簡報', '暗房設備維護'],
        portfolioVisibility: 'public',
      },
      {
        email: 'ncu-csie-owner@ncu.edu.tw',
        displayName: '黃子恩（創遊與開源社長）',
        handle: 'zien-dev',
        platformRole: 'user',
        campusEmail: 'ncu-csie-owner@ncu.edu.tw',
        universityId: getUni('NCU').id,
        campusVerifiedAt: now,
        talentDiscoveryOptIn: true,
        portfolioVisibility: 'public',
      },
      {
        email: 'ncu-gamedev-alumni@ncu.edu.tw',
        displayName: '李冠霖（遊戲社校友）',
        handle: 'guanlin-ta',
        platformRole: 'user',
        campusEmail: 'ncu-gamedev-alumni@ncu.edu.tw',
        universityId: getUni('NCU').id,
        campusVerifiedAt: now,
        alumniPingEnabled: true,
        alumniExpertiseTags: ['遊戲音效', 'Unity Shader', 'GameJam 籌備'],
      },
      {
        email: 'ntust-photo-owner@ntust.edu.tw',
        displayName: '吳佳穎（臺科大攝影社長）',
        handle: 'jiaying-ntust',
        platformRole: 'user',
        campusEmail: 'ntust-photo-owner@ntust.edu.tw',
        universityId: getUni('NTUST').id,
        campusVerifiedAt: now,
        alumniPingEnabled: true,
        alumniExpertiseTags: ['聯展場地動線', '海報印刷'],
      },
      {
        email: 'nthu-maker-owner@nthu.edu.tw',
        displayName: '蔡承翰（清大創客社長）',
        handle: 'chenghan-nthu',
        platformRole: 'user',
        campusEmail: 'nthu-maker-owner@nthu.edu.tw',
        universityId: getUni('NTHU').id,
        campusVerifiedAt: now,
      },
      {
        email: 'student-verified@ncu.edu.tw',
        displayName: '王小明（中大新生）',
        handle: 'xiaoming-ncu',
        platformRole: 'user',
        campusEmail: 'student-verified@ncu.edu.tw',
        universityId: getUni('NCU').id,
        campusVerifiedAt: now,
      },
      {
        email: 'student-member@gmail.com',
        displayName: '許同學（一般會員）',
        handle: 'xu-guest',
        platformRole: 'user',
        campusEmail: null,
        universityId: null,
        campusVerifiedAt: null,
      },
    ];
    for (const u of userSeed) {
      await db.insert(schema.users).values(u).onConflictDoNothing();
    }
    const allUsers = await db.select().from(schema.users);
    const getUser = (email: string) => {
      const u = allUsers.find((x) => x.email === email);
      if (!u) throw new Error(`Missing user ${email}`);
      return u;
    };

    // 4. Clubs (14 verified + 2 unclaimed directory)
    const clubSpecs: {
      uniCode: string;
      slug: string;
      name: string;
      category: schema.ClubCategory;
      domainSlugs: string[];
      tagline: string;
      description: string;
      status: schema.ClubVerificationStatus;
      ownerEmail?: string;
      extraLinks?: schema.ExternalLink[];
    }[] = [
      {
        uniCode: 'NCU',
        slug: 'ncu-gamedev',
        name: '中央大學遊戲創作社（創遊社）',
        category: 'academic',
        domainSlugs: ['game-dev', 'software-ai', 'craft-design'],
        tagline: '程式、美術、企劃與音效組隊做出能真正遊玩的獨立遊戲原型！',
        description: '中大型跨領域實作社群代表：每學期舉辦零基礎 Unity/Godot 工作坊、48 小時 GameJam 與跨校作品試玩展。',
        status: 'verified',
        ownerEmail: 'ncu-csie-owner@ncu.edu.tw',
        extraLinks: [
          { type: 'dc', label: 'Discord 社群伺服器', url: 'https://discord.com' },
          { type: 'ig', label: 'Instagram @ncu.gamedev', url: 'https://instagram.com' },
        ],
      },
      {
        uniCode: 'NCU',
        slug: 'ncu-photo',
        name: '中央大學攝影研究社',
        category: 'arts',
        domainSlugs: ['photo-film', 'craft-design'],
        tagline: '從黑白暗房沖洗到街拍紀實，用鏡頭記錄松果校園的光影日常。',
        description: '備有完整暗房設備與外拍課程，歡迎零基礎新生拿手機或相機一起認識校園與光影。',
        status: 'verified',
        ownerEmail: 'ncu-photo-owner@ncu.edu.tw',
        extraLinks: [
          { type: 'ig', label: 'Instagram @ncu.photo', url: 'https://instagram.com' },
          { type: 'email', label: '社團信箱', url: 'mailto:ncu-photo@clubar.example.com' },
        ],
      },
      {
        uniCode: 'NCU',
        slug: 'ncu-csie',
        name: '中大軟體開源研究社',
        category: 'academic',
        domainSlugs: ['software-ai', 'game-dev'],
        tagline: '從零打造校園數位工具、全端讀書會與黑客松實戰小隊。',
        description: '帶大一新生從 Git、TypeScript 到 AI 應用實戰做出真正有同學校友使用的工具。',
        status: 'verified',
        ownerEmail: 'ncu-csie-owner@ncu.edu.tw',
        extraLinks: [{ type: 'website', label: 'GitHub 組織', url: 'https://github.com' }],
      },
      {
        uniCode: 'NCU',
        slug: 'ncu-mountaineering',
        name: '中大山林登山社',
        category: 'sports',
        domainSlugs: ['outdoor-mountain', 'sports-fitness'],
        tagline: '從郊山健行、負重訓練到百岳縱走的安全戶外探索。',
        description: '重視登山安全、地圖判位與體能循序培養，新手也能從半日郊山安全出發。',
        status: 'verified',
        ownerEmail: 'ncu-photo-owner@ncu.edu.tw',
        extraLinks: [
          { type: 'website', label: 'Linktree @ncumt', url: 'https://linktr.ee/ncumt' },
        ],
      },
      {
        uniCode: 'NCU',
        slug: 'ncu-boardgame',
        name: '中大桌遊策略研習社',
        category: 'recreation',
        domainSlugs: ['boardgame-esports', 'language-culture'],
        tagline: '超過 120 款派對與策略桌遊，下課舒壓又能自然認識跨系新朋友。',
        description: '每週四晚間開桌，專人教學規則，不必自帶朋友就能輕鬆併桌破冰。',
        status: 'verified',
        ownerEmail: 'ncu-photo-editor@ncu.edu.tw',
      },
      {
        uniCode: 'NCU',
        slug: 'ncu-edu-service',
        name: '中大偏鄉數位教育服務團',
        category: 'service',
        domainSlugs: ['social-service', 'software-ai'],
        tagline: '把程式積木、科學實驗與陪伴帶進桃園復興與偏鄉小學。',
        description: '提供服務學習時數與完整行前教案培訓，週末與寒暑假出隊。',
        status: 'verified',
        ownerEmail: 'ncu-csie-owner@ncu.edu.tw',
        extraLinks: [
          { type: 'ig', label: 'Instagram @ncu_gf', url: 'https://www.instagram.com/ncu_gf/' },
        ],
      },
      {
        uniCode: 'NCU',
        slug: 'ncu-intl',
        name: '中大國際文化交流社',
        category: 'social',
        domainSlugs: ['language-culture'],
        tagline: '連結本地生與外籍交換生的料理之夜、咖啡角與文化沙龍。',
        description: '不用出國就能認識來自九個國家的朋友，練習外語零壓力。',
        status: 'verified',
        ownerEmail: 'ncu-photo-editor@ncu.edu.tw',
      },
      {
        uniCode: 'NCU',
        slug: 'ncu-art',
        name: '中大松風美術與插畫社',
        category: 'arts',
        domainSlugs: ['craft-design', 'photo-film'],
        tagline: '水彩、電繪、似顏繪擺攤與自由速寫的暖心創作空間。',
        description: '週四晚間自由畫室與基礎透視工作坊，備有畫具不用另外買。',
        status: 'verified',
        ownerEmail: 'ncu-photo-editor@ncu.edu.tw',
      },
      {
        uniCode: 'NCU',
        slug: 'ncu-fintech',
        name: '中大證券與產業研究社',
        category: 'academic',
        domainSlugs: ['finance-research'],
        tagline: '財報拆解、總經讀書會與模擬投資組合實務討論。',
        description: '用白話案例拆解半導體、AI 與金融科技產業脈動，歡迎非財金系參與。',
        status: 'verified',
        ownerEmail: 'ncu-csie-owner@ncu.edu.tw',
      },
      {
        uniCode: 'NTUST',
        slug: 'ntust-photo',
        name: '臺科大光影攝影社',
        category: 'arts',
        domainSlugs: ['photo-film', 'craft-design'],
        tagline: '城市夜拍、棚拍布光與跨校聯合影展策畫基地。',
        description: '專注人像棚燈與都市建築紀實攝影。',
        status: 'verified',
        ownerEmail: 'ntust-photo-owner@ntust.edu.tw',
      },
      {
        uniCode: 'NTHU',
        slug: 'nthu-maker',
        name: '清大創客智造社',
        category: 'academic',
        domainSlugs: ['craft-design', 'software-ai', 'game-dev'],
        tagline: '3D 列印、雷射切割與嵌入式硬體的動手做實驗室。',
        description: '開放所有科系同學製作實體裝置與遊戲互動控制器。',
        status: 'verified',
        ownerEmail: 'nthu-maker-owner@nthu.edu.tw',
      },
      {
        uniCode: 'NTU',
        slug: 'ntu-band',
        name: '臺大熱音與獨立樂團研習社',
        category: 'arts',
        domainSlugs: ['music-live', 'dance-stage'],
        tagline: '從樂器入門、編曲錄音到草地不插電音樂夜的音樂聚落。',
        description: '定期舉辦跨校練團交流與 Livehouse 聲音工程教學。',
        status: 'verified',
        ownerEmail: 'ntust-photo-owner@ntust.edu.tw',
      },
      {
        uniCode: 'NCKU',
        slug: 'ncku-badminton',
        name: '成大羽球入門與交流社',
        category: 'sports',
        domainSlugs: ['sports-fitness'],
        tagline: '零基礎友善！下課後流汗揮拍與雙打輪轉練習。',
        description: '分級分場照顧初學者與進階球友。',
        status: 'verified',
        ownerEmail: 'nthu-maker-owner@nthu.edu.tw',
      },
      {
        uniCode: 'NTNU',
        slug: 'ntnu-dance',
        name: '臺師大自由律動與街舞社',
        category: 'sports',
        domainSlugs: ['dance-stage', 'music-live'],
        tagline: '從零基礎節奏律動到跨校聯合成果展演。',
        description: '強調友善包容的排練文化與身心舒展。',
        status: 'verified',
        ownerEmail: 'nthu-maker-owner@nthu.edu.tw',
      },
      // Real NCU showcase clubs + 2 unclaimed directory clubs
      {
        uniCode: 'NCU',
        slug: 'ncu-astronomy',
        name: '中央大學天文社',
        category: 'academic',
        domainSlugs: ['photo-film', 'outdoor-mountain'],
        tagline: '從太極草皮路邊天文夜到冬季觀星園，帶大家看見松果校園上空的銀河。',
        description: '無論你是天文小白或自有器材愛好者，週二社課與戶外觀測都歡迎免費旁聽與認識星空。',
        status: 'verified',
        ownerEmail: 'ncu-photo-owner@ncu.edu.tw',
        extraLinks: [
          { type: 'ig', label: 'Instagram @ncuastroclub', url: 'https://www.instagram.com/ncuastroclub/' },
        ],
      },
      {
        uniCode: 'NCU',
        slug: 'ncu-coffee',
        name: '中央大學咖啡研習社',
        category: 'recreation',
        domainSlugs: ['language-culture', 'craft-design'],
        tagline: '手沖、賽風壺、烘豆香氣與濾掛 DIY 的暖心社課聚落。',
        description: '從生豆火候到自己封存濾掛咖啡，零經驗也能在據德樓公共空間輕鬆體驗手沖樂趣。',
        status: 'verified',
        ownerEmail: 'ncu-photo-editor@ncu.edu.tw',
        extraLinks: [
          { type: 'ig', label: 'Instagram @ncu_coffee_official', url: 'https://www.instagram.com/ncu_coffee_official/' },
        ],
      },
      {
        uniCode: 'NCU',
        slug: 'ncu-dance',
        name: '中央大學熱舞社（NCUPD）',
        category: 'sports',
        domainSlugs: ['dance-stage', 'music-live'],
        tagline: '從零基礎體驗社課到社內 Battle《搖晃的紅酒盃》與大講堂小成舞台。',
        description: '涵蓋 HipHop、Popping、Locking、Waacking 與 Girls 等舞風，每週志道樓開跳，非社員也可單堂體驗。',
        status: 'verified',
        ownerEmail: 'ncu-photo-editor@ncu.edu.tw',
        extraLinks: [
          { type: 'ig', label: 'Instagram @ncupd_35th', url: 'https://www.instagram.com/ncupd_35th/' },
        ],
      },
      {
        uniCode: 'NCU',
        slug: 'ncu-cat',
        name: '中央大學喵喵社',
        category: 'service',
        domainSlugs: ['social-service'],
        tagline: '守護松果校園裡的每隻小生命：TNR 節紮、校園減速宣導與親人貓咪送養。',
        description: '透過校園送養會、義賣募資與減速運動，陪伴校園浪貓安心生活與找家。',
        status: 'verified',
        ownerEmail: 'ncu-csie-owner@ncu.edu.tw',
        extraLinks: [
          { type: 'ig', label: 'Instagram @ncu_catsoq', url: 'https://www.instagram.com/ncu_catsoq/' },
        ],
      },
      {
        uniCode: 'NCU',
        slug: 'ncu-ieee',
        name: '中央大學 IEEE 學生分會',
        category: 'academic',
        domainSlugs: ['software-ai', 'finance-research'],
        tagline: '邀請資電系友與業界工程師返校分享 AI 工作流與職涯經驗。',
        description: '透過線上論壇與企業演講串聯半導體、AI 產品開發與研究方向，協助同學探索未來職涯。',
        status: 'verified',
        ownerEmail: 'ncu-csie-owner@ncu.edu.tw',
        extraLinks: [
          { type: 'ig', label: 'Instagram @ieee_ncu_student_branch', url: 'https://www.instagram.com/ieee_ncu_student_branch/' },
        ],
      },
      {
        uniCode: 'NCU',
        slug: 'ncu-guitar',
        name: '中央大學吉他社',
        category: 'arts',
        domainSlugs: ['music-live'],
        tagline: '校方名錄預載社團：木吉他彈唱與指彈交流（等待幹部認領）。',
        description: '',
        status: 'unclaimed_directory',
      },
      {
        uniCode: 'NCU',
        slug: 'ncu-film',
        name: '中央大學電影研究社',
        category: 'arts',
        domainSlugs: ['photo-film', 'language-culture'],
        tagline: '校方名錄預載社團：映後座談與影展選片（等待幹部認領）。',
        description: '',
        status: 'unclaimed_directory',
      },
    ];

    for (const c of clubSpecs) {
      const domainIds = c.domainSlugs.map((s) => getDomain(s).id);
      await db
        .insert(schema.clubs)
        .values({
          universityId: getUni(c.uniCode).id,
          slug: c.slug,
          name: c.name,
          category: c.category,
          domainIds,
          tagline: c.tagline,
          description: c.description,
          coverUrl: '/images/demo/cover.svg',
          avatarUrl: `/images/demo/${c.category}.svg`,
          externalLinks: c.extraLinks ?? [],
          verificationStatus: c.status,
          isDemo: true,
          lastActivityAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          lastHandoverAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
          officialDirectoryUrl:
            c.status === 'unclaimed_directory' ? 'https://club.adm.ncu.edu.tw/clubs' : null,
        })
        .onConflictDoNothing();

      if (c.status === 'verified') {
        await db
          .update(schema.clubs)
          .set({
            domainIds,
            tagline: c.tagline,
            description: c.description,
            verificationStatus: 'verified',
            officialDirectoryUrl: null,
          })
          .where(
            and(
              eq(schema.clubs.slug, c.slug),
              eq(schema.clubs.isDemo, true),
              eq(schema.clubs.verificationStatus, 'unclaimed_directory')
            )
          );
      }

      // Clean legacy placeholder "社團示範頁面" / example.com links on re-seed
      const [existingClubRow] = await db
        .select({ id: schema.clubs.id, externalLinks: schema.clubs.externalLinks })
        .from(schema.clubs)
        .where(eq(schema.clubs.slug, c.slug))
        .limit(1);
      if (
        existingClubRow?.externalLinks?.some(
          (l) => l.label === '社團示範頁面' || l.url.includes('example.com')
        )
      ) {
        await db
          .update(schema.clubs)
          .set({ externalLinks: c.extraLinks ?? [] })
          .where(eq(schema.clubs.id, existingClubRow.id));
      }
    }

    const allClubs = await db.select().from(schema.clubs);
    const getClub = (slug: string) => {
      const c = allClubs.find((x) => x.slug === slug);
      if (!c) throw new Error(`Missing club ${slug}`);
      return c;
    };

    // 5. Memberships: Owners, Editor, Member, Alumni
    for (const c of clubSpecs) {
      if (!c.ownerEmail) continue;
      const club = getClub(c.slug);
      const owner = getUser(c.ownerEmail);
      const existing = await db
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
      if (existing.length === 0) {
        await db.insert(schema.clubMemberships).values({
          clubId: club.id,
          userId: owner.id,
          role: 'owner',
          title: '社長',
        });
      }
    }

    const photoClub = getClub('ncu-photo');
    const gameClub = getClub('ncu-gamedev');
    await db
      .insert(schema.clubMemberships)
      .values([
        {
          clubId: photoClub.id,
          userId: getUser('ncu-photo-editor@ncu.edu.tw').id,
          role: 'editor',
          title: '副社長兼暗房長',
        },
        {
          clubId: photoClub.id,
          userId: getUser('ncu-photo-member@ncu.edu.tw').id,
          role: 'member',
          title: '認證社員',
        },
        {
          clubId: gameClub.id,
          userId: getUser('ncu-photo-member@ncu.edu.tw').id,
          role: 'member',
          title: '美術組社員',
        },
      ])
      .onConflictDoNothing();

    // Alumni historical records
    const existingPhotoAlumni = await db
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
    if (existingPhotoAlumni.length === 0) {
      await db.insert(schema.clubMemberships).values({
        clubId: photoClub.id,
        userId: getUser('ncu-alumni@ncu.edu.tw').id,
        role: 'alumni',
        title: '113 屆社長',
        endedAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000),
      });
    }

    // 6. Default pre-filled FAQs (3 per verified club)
    for (const c of clubSpecs.filter((x) => x.status === 'verified')) {
      const club = getClub(c.slug);
      const existingFaqs = await db
        .select({ id: schema.clubQuestions.id })
        .from(schema.clubQuestions)
        .where(eq(schema.clubQuestions.clubId, club.id))
        .limit(1);
      if (existingFaqs.length === 0) {
        const owner = getUser(c.ownerEmail!);
        await db.insert(schema.clubQuestions).values(
          DEFAULT_FAQ_TEMPLATES.map((tpl) => ({
            clubId: club.id,
            isAnonymous: true,
            questionText: tpl.questionText,
            answerText: tpl.answerText,
            answeredBy: owner.id,
            answeredAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            status: 'published' as const,
            isPinnedFaq: true,
          }))
        );
      }
    }

    // 7. Events (12 events across scheduled / tbd / voting / completed + real NCU posters)
    const existingEvents = await db.select().from(schema.clubEvents);
    const eventSpecs: {
      shortCode: string;
      clubSlug: string;
      title: string;
      summary: string;
      descriptionMd: string;
      themePreset: string;
      coverMedia?: schema.EventCoverMedia;
      scheduleMode: schema.EventScheduleMode;
      startsDaysOffset: number | null;
      locationText: string;
      beginnerFriendly: boolean;
      nonMembersWelcome: boolean;
      campusOnly: boolean;
      feeNtd: number;
      feeNote?: string;
      hoursCat: schema.LearningHoursCategory;
      hoursCount: string;
      domainSlugs: string[];
      status: schema.EventStatus;
      pollOptions?: { type: 'time_slot' | 'topic'; label: string; offsetDays: number }[];
    }[] = [
      {
        shortCode: 'ncu-gd-01',
        clubSlug: 'ncu-gamedev',
        title: 'Unity 2D 小遊戲零基礎體驗夜：兩小時做出你的第一隻會跳的角色',
        summary: '不用寫過程式、不用自備高階筆電，現場組隊直接玩出原型！',
        descriptionMd: '### 活動亮點\n專為非資工、想嘗試做遊戲的新生設計，從角色移動到音效觸發一次帶完。',
        themePreset: 'midnight_jam',
        scheduleMode: 'scheduled',
        startsDaysOffset: 3,
        locationText: '中大工程五館 A205',
        beginnerFriendly: true,
        nonMembersWelcome: true,
        campusOnly: false,
        feeNtd: 0,
        hoursCat: 'life',
        hoursCount: '2.0',
        domainSlugs: ['game-dev', 'software-ai'],
        status: 'open',
      },
      {
        shortCode: 'ncu-ph-01',
        clubSlug: 'ncu-photo',
        title: '黑白底片暗房體驗夜（第二梯）：手沖銀鹽明信片帶回家',
        summary: '藥水與相紙社團全包，零基礎學長姐一對一帶進紅燈暗房。',
        descriptionMd: '現場提供 135 底片相機與藥水，體驗親手顯影的魔法。',
        themePreset: 'warm_paper',
        scheduleMode: 'scheduled',
        startsDaysOffset: 5,
        locationText: '中大據德樓 B1 暗房',
        beginnerFriendly: true,
        nonMembersWelcome: true,
        campusOnly: true,
        feeNtd: 100,
        hoursCat: 'art',
        hoursCount: '2.5',
        domainSlugs: ['photo-film', 'craft-design'],
        status: 'open',
      },
      {
        shortCode: 'ncu-art-01',
        clubSlug: 'ncu-art',
        title: '週四晚間自由水彩速寫＆無壓力畫室（喬時間投票中）',
        summary: '教室申請中！先來投你想畫的主題與最方便下課時段。',
        descriptionMd: '水彩紙與顏料現場準備好，來挑一個下課後的療癒時段一起塗鴉。',
        themePreset: 'warm_paper',
        scheduleMode: 'voting',
        startsDaysOffset: null,
        locationText: '中大志希館一樓（TBD 投票中）',
        beginnerFriendly: true,
        nonMembersWelcome: true,
        campusOnly: false,
        feeNtd: 0,
        hoursCat: 'art',
        hoursCount: '2.0',
        domainSlugs: ['craft-design'],
        status: 'open',
        pollOptions: [
          { type: 'time_slot', label: '下週四 19:00–21:00', offsetDays: 7 },
          { type: 'time_slot', label: '下週五 18:30–20:30', offsetDays: 8 },
          { type: 'time_slot', label: '隔週二 19:00–21:00', offsetDays: 12 },
        ],
      },
      {
        shortCode: 'ncu-mt-01',
        clubSlug: 'ncu-mountaineering',
        title: '新手友善！週末硬漢嶺半日郊山健行與登山杖實操',
        summary: '免重裝、領隊押後，專為沒爬過山的大一新生與跨系朋友設計。',
        descriptionMd: '集合搭捷運轉公車出發，下午四點前下山喝豆花。',
        themePreset: 'forest_trail',
        scheduleMode: 'scheduled',
        startsDaysOffset: 9,
        locationText: '中大後門集合出發',
        beginnerFriendly: true,
        nonMembersWelcome: true,
        campusOnly: false,
        feeNtd: 50,
        hoursCat: 'life',
        hoursCount: '4.0',
        domainSlugs: ['outdoor-mountain', 'sports-fitness'],
        status: 'open',
      },
      {
        shortCode: 'ncu-bg-01',
        clubSlug: 'ncu-boardgame',
        title: '週四派對桌遊開桌夜：阿瓦隆與卡坦島新手專桌',
        summary: '不用自己找咖！一到現場就幫你配好歡樂併桌與桌長教規則。',
        descriptionMd: '下課直接帶杯飲料過來放鬆聊聊天、玩兩局就熟了。',
        themePreset: 'campus_blue',
        scheduleMode: 'scheduled',
        startsDaysOffset: 2,
        locationText: '中大遊藝館 203',
        beginnerFriendly: true,
        nonMembersWelcome: true,
        campusOnly: false,
        feeNtd: 0,
        hoursCat: 'none',
        hoursCount: '0.0',
        domainSlugs: ['boardgame-esports'],
        status: 'open',
      },
      {
        shortCode: 'ncu-svc-01',
        clubSlug: 'ncu-edu-service',
        title: '桃園復興偏鄉小學週末科學營籌備說明會（地點待定）',
        summary: '想拿服務學習時數又想實際陪伴孩子嗎？來聽本學期出隊計畫！',
        descriptionMd: '說明出隊日期、教案分工與師資培訓時數認證方式。',
        themePreset: 'forest_trail',
        scheduleMode: 'tbd',
        startsDaysOffset: null,
        locationText: '中大綜教館（TBD 待定）',
        beginnerFriendly: true,
        nonMembersWelcome: true,
        campusOnly: true,
        feeNtd: 0,
        hoursCat: 'service',
        hoursCount: '6.0',
        domainSlugs: ['social-service'],
        status: 'open',
      },
      {
        shortCode: 'ncu-intl-01',
        clubSlug: 'ncu-intl',
        title: '異國料理與語言交換之夜：手包水餃 × 印度香料奶茶',
        summary: '與 9 國交換生一起做晚餐，英文不用流利也能玩得很開心！',
        descriptionMd: '食材費現場均攤，歡迎帶一首喜歡的歌來交換播放清單。',
        themePreset: 'warm_paper',
        scheduleMode: 'scheduled',
        startsDaysOffset: 6,
        locationText: '中大國際交流交誼廳',
        beginnerFriendly: true,
        nonMembersWelcome: true,
        campusOnly: false,
        feeNtd: 120,
        hoursCat: 'life',
        hoursCount: '2.0',
        domainSlugs: ['language-culture'],
        status: 'open',
      },
      {
        shortCode: 'ncu-ph-00',
        clubSlug: 'ncu-photo',
        title: '中大湖秋日街拍散步與構圖講評（已圓滿結束）',
        summary: '活動後無損相簿已開啟！參加同學快上傳今天的原圖底片感照片。',
        descriptionMd: '上週末 24 位同學一起走遍松林與百花川，相簿池開放上傳原圖精選！',
        themePreset: 'warm_paper',
        scheduleMode: 'scheduled',
        startsDaysOffset: -4,
        locationText: '中大湖畔涼亭',
        beginnerFriendly: true,
        nonMembersWelcome: true,
        campusOnly: false,
        feeNtd: 0,
        hoursCat: 'art',
        hoursCount: '2.0',
        domainSlugs: ['photo-film'],
        status: 'completed',
      },
      {
        shortCode: 'ncu-dn-01',
        clubSlug: 'ncu-dance',
        title: 'HipHop 零基礎體驗社課｜雙朱教學強強聯手',
        summary: '兩位 34 屆 HipHop 教學手把手帶跳，零基礎也能體驗律動與舞台爆發力！',
        descriptionMd: `這次的HipHop體驗社課，我們邀請到的是
🔥Pupu學長X朱家昀學姐🔥

**朱家昀學姐**
- 34屆H教學
- 2024 College High HIPHOP
- 2025社內盃八強
- 2025四中五校Rookie組季軍
- 2026新學校

**Pupu學長**
- 34屆H教學
- 2024 College High HIPHOP
- 2025社內盃冠軍
- 2025四中五校 Rookie 組
- 2025四中五校 亞軍一般組best8
- 講幹話比賽亞軍
- 國小書法比賽佳作
- 能閉著眼睛從南京三民走到Sugar
- 長興國小附設幼兒園太陽班

第一堂的Hip Hop體驗社課由兩位Hip Hop雙朱教學強強聯手
別看這兩個人在舞台下悶騷害羞的模樣
站上舞台上他們的爆發力可是十分強大的💥💥💥
同一種舞風
兩個人跳舞都充滿個人特色😎
但總能讓人驚呼「哇！太帥了吧🫪」

想看看這兩個人跳舞時會擦出什麼火花嗎🔥
那你們一定要來參加這次的體驗社課！

- 時間 | 9/22（二）20:00-22:00
- 地點｜中央大學 志道樓二樓`,
        themePreset: 'midnight_jam',
        coverMedia: {
          url: '/images/examples/event-dance-trial.webp',
          width: 927,
          height: 1162,
          alt: '中央熱舞社 HipHop 體驗社課海報',
        },
        scheduleMode: 'scheduled',
        startsDaysOffset: 2,
        locationText: '中央大學志道樓二樓',
        beginnerFriendly: true,
        nonMembersWelcome: true,
        campusOnly: false,
        feeNtd: 0,
        hoursCat: 'none',
        hoursCount: '0.0',
        domainSlugs: ['dance-stage', 'music-live'],
        status: 'open',
      },
      {
        shortCode: 'ncu-cf-01',
        clubSlug: 'ncu-coffee',
        title: '咖啡社期初社大：手沖／賽風體驗 × DIY 濾掛咖啡',
        summary: '分梯帶你認識咖啡日常與沖煮體驗，現場免費參加還送自己做的濾掛包！',
        descriptionMd: `萬眾矚目的咖啡社期初社大來啦✨

- 活動時間｜9/8(二) 19:00
- 地點｜據德樓一樓＆二樓公共空間和據會
- 報名截止時間｜9/7(一)23:59

活動內容&方式：
為了讓大家有更好的活動品質，我們將分梯次進行，每個梯次皆會照順序帶領大家體驗以下關卡！
1. 咖啡社的日常
2. 咖啡沖煮體驗(手沖/賽風)
3. DIY活動——製作專屬於自己的濾掛咖啡

期初社大體驗價：免費！！
本學期社費：750元
參加期初社大與早鳥入社還可以各折抵50元！

────────

- Event time｜September 8th (Tuesday) 7:00 PM
- Location｜據德樓1F&2F
- Registration deadline｜September 7th (Monday) 11:59 PM
- Cost｜$0

除了認識我們、體驗不同的咖啡，還能在結束後獲得自己製作的濾掛咖啡！！
這麼好康的活動肯定要報名的！
快來填寫表單，我們期初社大見！`,
        themePreset: 'warm_paper',
        coverMedia: {
          url: '/images/examples/event-coffee-welcome.webp',
          width: 860,
          height: 1182,
          alt: '中央咖啡社期初社大海報',
        },
        scheduleMode: 'scheduled',
        startsDaysOffset: 4,
        locationText: '據德樓 1F & 2F 公共空間',
        beginnerFriendly: true,
        nonMembersWelcome: true,
        campusOnly: false,
        feeNtd: 0,
        hoursCat: 'none',
        hoursCount: '0.0',
        domainSlugs: ['craft-design', 'language-culture'],
        status: 'open',
      },
      {
        shortCode: 'ncu-ie-01',
        clubSlug: 'ncu-ieee',
        title: '2026 資電系友論壇：資訊科技業工作者的 AI 日常',
        summary: '103 級電機系友 PM 實戰拆解排程自動化、Skills 與多任務平行化工作流。',
        descriptionMd: `2026 中央資電系友論壇
✨本次邀請中央電機系友陳冠雯學姐，以「資訊科技業工作者的 AI 日常」為題，分享科技業第一線如何把 AI 真正融入日常工作流！

🔥經歷豐富
🔹103 級中央電機學士畢業
🔹具 5 年產品經理經驗
🔹目前擔任新創 Infra、AI 產品經理

從 AI 的底層運作概念談起，一步步帶你解鎖排程自動化、文件共編、瀏覽器操作到多任務平行化的 Subagent 實戰用法，揭開付費版 Claude 的高階玩法。

**演講亮點:**
- **AI的基本組成**: System Prompt、Tools、MCP、Skills、Plugin是什麼
- **讓AI定時工作**: 用排程與Skills自動整理每日資訊
- **讓AI直接動手**: 從Chat到Cowork, Claude in Chrome 操作瀏覽器, Cloudflare 部署個人應用
- **把任務分出去(任務平行化)**: Agent概念, 什麼工作適合交給Subagent, 以及如何建立

📅 日期：11/28 (六)
⏰ 時間：早上 10:00-12:00
💻參與方式：Google Meet 線上演講（無需報名，免費聽講！）
連結請參閱圖片，掃描側邊 QR Code`,
        themePreset: 'campus_blue',
        coverMedia: {
          url: '/images/examples/event-ieee-ai-talk.webp',
          width: 871,
          height: 1158,
          alt: 'IEEE 中央資電系友論壇 AI 工作日常海報',
        },
        scheduleMode: 'scheduled',
        startsDaysOffset: 5,
        locationText: 'Google Meet 線上演講',
        beginnerFriendly: true,
        nonMembersWelcome: true,
        campusOnly: false,
        feeNtd: 0,
        hoursCat: 'none',
        hoursCount: '0.0',
        domainSlugs: ['software-ai'],
        status: 'open',
      },
      {
        shortCode: 'ncu-as-01',
        clubSlug: 'ncu-astronomy',
        title: '第五次社課《望遠鏡載台》：赤道儀與經緯儀操作實務',
        summary: '張永欣講師帶你從零認識望遠鏡載台構造，全程參與可領取 2 小時學習時數。',
        descriptionMd: `為什麼大型望遠鏡不用赤道儀?
一般的折返式望遠鏡，要如何操作赤道儀/經緯儀幫助觀測?
載台、經緯儀、赤道儀的關係是什麼?

——第五次社課——
《望遠鏡載台》
講者：張永欣老師
地點：管理學院二館107教室
時間：11/10（二）19:30-21:30

────────

這周的社課 我們很榮幸能邀請到 張永欣 講師講解載台在望遠鏡的功能
如果對望遠鏡的構造沒有概念，載台是主鏡到腳架中間的銜接段，除了穩定望遠鏡的功能以外，通常會有兩種儀器: 赤道儀跟經緯儀建在載台裡，至於它們的功能跟原理......小編還是不要班門弄斧，交給專業的講師解答吧~

不論你是天文小白，還是自有設備的愛好者，都歡迎來一起聽講座!

(偷偷跟你說，錯過這次，就要等講師從墨西哥回來了，心動不如行動，來!)

⭐️備註：
1. 非天文社社員者，本次社課將酌收50元講師費。
2. 社課全程參與者，可獲得一小時自我探索時數和一小時生活知能時數。`,
        themePreset: 'midnight_jam',
        coverMedia: {
          url: '/images/examples/event-astro-mount.webp',
          width: 1182,
          height: 1187,
          alt: '中央天文社望遠鏡載台社課海報',
        },
        scheduleMode: 'scheduled',
        startsDaysOffset: 6,
        locationText: '管理學院二館 107 教室',
        beginnerFriendly: true,
        nonMembersWelcome: true,
        campusOnly: false,
        feeNtd: 50,
        feeNote: '非天文社社員酌收 50 元講師費',
        hoursCat: 'life',
        hoursCount: '2.0',
        domainSlugs: ['photo-film', 'outdoor-mountain'],
        status: 'open',
      },
    ];

    const eveningAtOffset = (days: number, hourTaipei = 19): Date => {
      const base = new Date();
      base.setUTCDate(base.getUTCDate() + days);
      // 19:00 Asia/Taipei (UTC+8) = 11:00 UTC
      base.setUTCHours(hourTaipei - 8, 0, 0, 0);
      return base;
    };

    const refreshShowcaseEventCodes = new Set(['ncu-dn-01', 'ncu-cf-01', 'ncu-ie-01', 'ncu-as-01']);

    for (const ev of eventSpecs) {
      const existingEv = existingEvents.find((x) => x.shortCode === ev.shortCode);
      const startsAt =
        ev.startsDaysOffset !== null ? eveningAtOffset(ev.startsDaysOffset, 19) : null;
      const endsAt = startsAt ? new Date(startsAt.getTime() + 2 * 60 * 60 * 1000) : null;

      if (existingEv) {
        const patch: Partial<typeof schema.clubEvents.$inferInsert> = {};
        if (ev.coverMedia && existingEv.coverMedia?.url?.startsWith('/images/demo/')) {
          patch.coverMedia = ev.coverMedia;
        }
        if (refreshShowcaseEventCodes.has(ev.shortCode) && existingEv.descriptionMd !== ev.descriptionMd) {
          patch.descriptionMd = ev.descriptionMd;
          patch.summary = ev.summary;
        }
        if (
          existingEv.startsAt &&
          startsAt &&
          existingEv.startsAt.getUTCMinutes() !== 0
        ) {
          patch.startsAt = startsAt;
          patch.endsAt = endsAt;
        }
        if (Object.keys(patch).length > 0) {
          await db
            .update(schema.clubEvents)
            .set(patch)
            .where(eq(schema.clubEvents.id, existingEv.id));
        }
        continue;
      }
      const club = getClub(ev.clubSlug);
      const spec = clubSpecs.find((x) => x.slug === ev.clubSlug)!;
      const creator = getUser(spec.ownerEmail!);

      const [inserted] = await db
        .insert(schema.clubEvents)
        .values({
          clubId: club.id,
          createdBy: creator.id,
          shortCode: ev.shortCode,
          title: ev.title,
          summary: ev.summary,
          descriptionMd: ev.descriptionMd,
          themePreset: ev.themePreset,
          coverMedia: ev.coverMedia ?? {
            url: '/images/demo/event-16x9.svg',
            width: 1280,
            height: 720,
            alt: ev.title,
          },
          scheduleMode: ev.scheduleMode,
          startsAt,
          endsAt,
          locationText: ev.locationText,
          beginnerFriendly: ev.beginnerFriendly,
          nonMembersWelcome: ev.nonMembersWelcome,
          campusOnly: ev.campusOnly,
          feeNtd: ev.feeNtd,
          feeNote: ev.feeNote ?? null,
          learningHoursCategory: ev.hoursCat,
          learningHoursCount: ev.hoursCount,
          domainIds: ev.domainSlugs.map((s) => getDomain(s).id),
          status: ev.status,
          includeInEvaluation: true,
        })
        .returning();

      if (ev.pollOptions && ev.pollOptions.length > 0) {
        await db.insert(schema.eventPollOptions).values(
          ev.pollOptions.map((opt) => {
            const s = eveningAtOffset(opt.offsetDays, 19);
            return {
              eventId: inserted.id,
              optionType: opt.type,
              label: opt.label,
              startsAt: s,
              endsAt: new Date(s.getTime() + 2 * 60 * 60 * 1000),
            };
          })
        );
      }
    }

    const allEvents = await db.select().from(schema.clubEvents);
    const getEvent = (shortCode: string) => {
      const e = allEvents.find((x) => x.shortCode === shortCode);
      if (!e) throw new Error(`Missing event ${shortCode}`);
      return e;
    };

    // Sample RSVPs + Completed Album Photo + Co-Club Link
    const completedPhotoEv = getEvent('ncu-ph-00');
    const verifiedStudent = getUser('student-verified@ncu.edu.tw');
    const photoMember = getUser('ncu-photo-member@ncu.edu.tw');
    const photoOwner = getUser('ncu-photo-owner@ncu.edu.tw');

    await db
      .insert(schema.eventRsvps)
      .values([
        {
          eventId: completedPhotoEv.id,
          userId: verifiedStudent.id,
          status: 'going',
          privacyMode: 'public_to_attendees',
          displayAlias: '愛拍松果的小明',
          attended: true,
          attendedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        },
        {
          eventId: completedPhotoEv.id,
          userId: photoMember.id,
          status: 'going',
          privacyMode: 'private_count_only',
          attended: true,
          attendedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        },
        {
          eventId: getEvent('ncu-gd-01').id,
          userId: verifiedStudent.id,
          status: 'going',
          privacyMode: 'public_to_attendees',
        },
      ])
      .onConflictDoNothing();

    const existingAlbum = await db
      .select()
      .from(schema.eventAlbumPhotos)
      .where(eq(schema.eventAlbumPhotos.eventId, completedPhotoEv.id))
      .limit(1);

    let featuredAlbumId: string | null = existingAlbum[0]?.id ?? null;
    if (existingAlbum.length === 0) {
      const insertedAlbum = await db
        .insert(schema.eventAlbumPhotos)
        .values([
          {
            eventId: completedPhotoEv.id,
            uploaderUserId: verifiedStudent.id,
            originalUrl: '/images/demo/moment-4x5.svg',
            previewUrl: '/images/demo/moment-4x5.svg',
            width: 800,
            height: 1000,
            mimeType: 'image/svg+xml',
            sizeBytes: 1200,
            caption: '百花川午後陽光灑在底片相機上的一刻',
            status: 'featured_stream',
            consentConfirmed: true,
            curatedBy: photoOwner.id,
            includeInEvaluation: true,
          },
          {
            eventId: completedPhotoEv.id,
            uploaderUserId: photoMember.id,
            originalUrl: '/images/demo/moment-1x1.svg',
            previewUrl: '/images/demo/moment-1x1.svg',
            width: 900,
            height: 900,
            mimeType: 'image/svg+xml',
            sizeBytes: 1200,
            caption: '待機講評中（等待幹部審核精選）',
            status: 'pending_review',
            consentConfirmed: true,
          },
        ])
        .returning();
      featuredAlbumId = insertedAlbum[0]?.id ?? null;
    }

    // Co-Club Link: ncu-gamedev x ncu-art
    await db
      .insert(schema.coClubLinks)
      .values({
        targetType: 'event',
        targetId: getEvent('ncu-gd-01').id,
        hostClubId: gameClub.id,
        partnerClubId: getClub('ncu-art').id,
        status: 'accepted',
        partnerIncludeEval: true,
        invitedBy: getUser('ncu-csie-owner@ncu.edu.tw').id,
        respondedBy: getUser('ncu-photo-editor@ncu.edu.tw').id,
        respondedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      })
      .onConflictDoNothing();

    // 8. Living Stream Posts (Curated Real NCU Showcase + Baseline Mixed Aspect Ratios)
    const existingPosts = await db
      .select({ id: schema.posts.id, clubId: schema.posts.clubId, headline: schema.posts.headline })
      .from(schema.posts);

    const curatedRealPosts: {
      clubSlug: string;
      authorEmail: string;
      kind: schema.PostKind;
      headline: string;
      contentMd: string;
      daysAgo: number;
      relatedShortCode?: string;
      media: schema.MediaItem;
    }[] = [
      {
        clubSlug: 'ncu-art',
        authorEmail: 'ncu-photo-editor@ncu.edu.tw',
        kind: 'wip_work',
        headline: '期初社課廣告顏料星空畫作分享，零基礎也能畫出漸層夜色',
        contentMd: `9/15美術社期初社大課程！！！
本次課程是——體驗廣告顏料畫天空
不必擔心自己零基礎，畫的開心就好。
- 📅 日期：9/15 19:00～21:00
- 📍 地點：據德樓B1右側美術社辦
- 🎓（有藝文時數2小時）

────────

**課後紀錄 & 下次社課預告**
畫星空🌃，下次社課就是素描了，希望大家會喜歡。下次座位會夠的。
- ⏳ 時間: 9/22（二）7:00～9:00
- 🔺 地點: 據德樓B1 美術社社辦
- 🎨 內容: 素描
下次記得帶社費來350元，如果有困難再跟我們講👍`,
        daysAgo: 0,
        relatedShortCode: 'ncu-art-01',
        media: {
          kind: 'image',
          url: '/images/examples/art-work-3x4.webp',
          width: 526,
          height: 701,
          alt: '美術社廣告顏料星空作品實拍',
        },
      },
      {
        clubSlug: 'ncu-art',
        authorEmail: 'ncu-photo-editor@ncu.edu.tw',
        kind: 'nrc_moment',
        headline: '9/15 美術社期初社團大會：廣告顏料天空繪畫與社長備課現場',
        contentMd: `9/15晚上七點
美術社期初社團大會！
會和大家介紹與討論本學期活動內容
還會進行廣告顏料天空繪畫
有興趣的同學歡迎參加喔～
附上社長凌亂的備課筆記（？）
想講的內容太多了，好像講不完耶完蛋。`,
        daysAgo: 1,
        relatedShortCode: 'ncu-art-01',
        media: {
          kind: 'image',
          url: '/images/examples/art-welcome-4x3.webp',
          width: 720,
          height: 540,
          alt: '美術社期初社大現場教室實況',
        },
      },
      {
        clubSlug: 'ncu-gamedev',
        authorEmail: 'ncu-csie-owner@ncu.edu.tw',
        kind: 'album_highlight',
        headline: '《活俠傳》鳥熊團隊來中大分享：小團隊如何打磨角色與劇本',
        contentMd: `劇本社課｜《活俠傳》原始鳥熊來啦！
《活俠傳》的角色為什麼這麼鮮明？劇情與台詞是怎麼構思出來的？
這次社課邀請到《活俠傳》開發團隊「原始鳥熊」的熊與鳥來到中央，
分享小團隊如何發想劇本、塑造角色，以及實際開發過程中的經驗。
想寫劇情、做遊戲企劃的各位 ，千萬不要錯過！

- 社課時間：11/11（三）19:00–21:00
- 社課地點：教學研究大樓 4 樓 ideaNCU 會議室

※ 非社員參與本社課酌收 150 報名費
※ 鑒於保護著作權和講者意願，活動途中禁止錄影或拍照`,
        daysAgo: 1,
        relatedShortCode: 'ncu-gd-01',
        media: {
          kind: 'image',
          url: '/images/examples/gamedev-demo-16x9.webp',
          width: 1200,
          height: 675,
          alt: '創遊社活俠傳劇本社課活動畫面',
        },
      },
      {
        clubSlug: 'ncu-gamedev',
        authorEmail: 'ncu-photo-member@ncu.edu.tw',
        kind: 'wip_work',
        headline: '創遊 × 音遊聯合交流：國產獨立音遊《Estella》從 0.5 推到 1',
        contentMd: `🎮【創遊 × 音遊聯合社課】從 0.5 推到 1！
國產獨立音遊《Estella》企劃 & 參展實戰經驗座談
遊戲試玩版做出來了，但該怎麼讓玩家看見？
想把心血結晶帶去 G-Eight 等電玩展擺攤，事前又該準備些什麼？
本次社課特別邀請到 Estella 團隊的核心企劃之一 —— DragonL 來到中央分享！✨

🎵 **關於《Estella》**
獨立 PC 音遊，操作結合 maimai 與 osu! 的八邊形判定，支援鍵鼠雙棲玩法。
目前已於 Steam 釋出試玩版，預計於 2027/01/29 正式上市！
👉 [Steam 商店頁面](https://store.steampowered.com/app/3380100/Estella/?l=tchinese)

━━━━━━━━━━━━━━━

📌 **本次分享內容**
1️⃣ **遊戲設計與製作流程**：從零構思特色音遊玩法與系統架構的開發脈絡
2️⃣ **從 0.5 推到 1 的關鍵**：完成原型後，如何一步步打磨內容、邁向正式營運
3️⃣ **作品宣傳與曝光策略**：獨立團隊資源有限，該如何對外公開作品、吸引玩家目光？
4️⃣ **電玩展參展全攻略**：哪些展覽適合獨立遊戲？展前要準備哪些物資與試玩版？參展實際能帶來什麼效益？

- 🗓 時間｜11/25（三）19:00–22:00
- 📍 地點｜中央大學 教學研究大樓 4F ideaNCU
- 💻 備註｜歡迎攜帶筆電或筆記用具，現場亦有交流時間

💰 **入場費用**
・創遊社社員及前社員：免費
・非社員：酌收報名費 150 元
・合作社團：當日請出示 DC 身分組以享優惠

⚡ **一句話總結：**
週三晚上 7 點，教研 4F ideaNCU，Estella 企劃來教你怎麼搞宣傳跟參展，想來就來！
#中央大學 #創遊社 #音遊社 #Estella #獨立遊戲 #音樂遊戲 #遊戲開發 #社課`,
        daysAgo: 2,
        relatedShortCode: 'ncu-gd-01',
        media: {
          kind: 'image',
          url: '/images/examples/gamedev-estella-wide.webp',
          width: 500,
          height: 261,
          alt: '國產獨立音遊 Estella 遊戲畫面',
        },
      },
      {
        clubSlug: 'ncu-coffee',
        authorEmail: 'ncu-photo-editor@ncu.edu.tw',
        kind: 'nrc_moment',
        headline: '自己烘出專屬風味：據德樓夜晚的手沖與烘豆現場',
        contentMd: `一爐炭火，一抹豆香，
青煙微起，風味初成。

這一次，咖啡社邀你親手入席烘豆之境，
從生豆入鍋、火候掌握，到香氣綻放，
一步步體會咖啡由青澀轉為醇厚的變化。

在水墨般的夜色裡，
以雙手翻動豆香，
烘出屬於自己的風味，
也封存成一包只屬於你的濾掛咖啡。

- 🗓 時間：5/6（三）19:00
- 📍 地點：咖啡社社辦

邀君共赴一場豆香與火候的雅集。`,
        daysAgo: 1,
        relatedShortCode: 'ncu-cf-01',
        media: {
          kind: 'image',
          url: '/images/examples/coffee-roast-4x5.webp',
          width: 947,
          height: 1187,
          alt: '中央咖啡社社員手搖烘豆實況',
        },
      },
      {
        clubSlug: 'ncu-astronomy',
        authorEmail: 'ncu-photo-owner@ncu.edu.tw',
        kind: 'nrc_moment',
        headline: '太極草皮路邊天文夜：架起望遠鏡帶全校同學看中秋月面',
        contentMd: `但願人長久，千里共嬋娟。
中秋佳節將至，身為大學生的大家幾乎都會返鄉與家人同聚。為了這個別具意義的節日，天文社將舉辦一次在月光下的觀測活動，邀請大家與我們一同望向天空，一覽明月的皓潔、一起體會在中秋節觀賞夜空的美妙。在欣賞夜空之前，更多的大型活動資訊也將釋出，千萬不能錯過了喔！

~~~**第二次社課 & 路邊天文**~~~
- 地點：文學二館107教室、太極草皮(小木屋鬆餅對面)
- 時間：9/22(二) 19:00～21:30
- 全程參加者將核發生活知能跟自我探索時數各一小時。
- 備註：如當天遇雲或雨，不適合觀測，則會改在室內進行社課。

────────

With the Mid-Autumn Festival just around the corner, many university students will be heading home to reunite with their families. To celebrate this meaningful occasion, the Astronomy Club will be hosting a special moonlight observation event! 🔭✨

We invite everyone to look up at the night sky with us, admire the brightness and beauty of the full moon, and experience the magic of stargazing during the Mid-Autumn Festival. 🌕🌌

Before we begin our night of stargazing, we’ll also be revealing more information about some of our upcoming major events — so make sure you don’t miss out! 👀✨

- 📍 Location: 文二107 & Taichi Lawn
- 📅 Date: September 22 (Tue)
- 🕖 Time: 19:00–21:30
- 🎓 Participants who attend the entire session will receive **1 hour of Life Skills & Knowledge credit and 1 hour of Self-Exploration credit.**
- ⚠️ **Weather Notice:** If clouds or rain make outdoor observation unsuitable, the session will be moved indoors and held as a regular club session.`,
        daysAgo: 3,
        relatedShortCode: 'ncu-as-01',
        media: {
          kind: 'image',
          url: '/images/examples/astro-sidewalk-1x1.webp',
          width: 1080,
          height: 1080,
          alt: '太極草皮路邊天文夜觀測現場',
        },
      },
      {
        clubSlug: 'ncu-mountaineering',
        authorEmail: 'ncu-photo-owner@ncu.edu.tw',
        kind: 'wip_work',
        headline: '《浪漫巡山員》講座紀實：從海拔 0 到 3000 公尺的無痕山林',
        contentMd: `【走進山林，我們留下了什麼？｜從巡山員的第一線觀察，認識無痕山林與生態保育】

講師介紹：林業及自然保育署臺中分署森林護管員（巡山員），曾於鞍馬山工作站第一線服務多年，長年守護第一線高山與中級山林。著有登山紀實暢銷著作《浪漫巡山員：從海拔0到3000公尺，熱血堅毅的台灣山林守護者》。
擅長以第一線視角分享深山巡護日常，並深入探討高山垃圾危機、野生動物習性改變及無痕山林（LNT）倫理。

────────

- 🧑‍🏫 講師：張維純（阿步）
- ⏰ 時間：11/27（五）18:50進場 19:00開始
- 📍 地點：登山社社窩（據德樓B1)
- 🎁 時數：人文藝術 2小時`,
        daysAgo: 2,
        relatedShortCode: 'ncu-mt-01',
        media: {
          kind: 'image',
          url: '/images/examples/mountain-patrol-4x5.webp',
          width: 947,
          height: 1190,
          alt: '中央登山社浪漫巡山員講座紀錄',
        },
      },
      {
        clubSlug: 'ncu-edu-service',
        authorEmail: 'ncu-csie-owner@ncu.edu.tw',
        kind: 'qa_highlight',
        headline: '出隊學長訪談：身體的疲憊終將轉換成心靈上的富足',
        contentMd: `這次我們的採訪對象是李秉倫學長！

大二進入基服的李秉倫學長是在室友鼓勵下進入基服的大家庭，看著室友在基服的投入與成長，讓他萌生了進入基服的想法。好在時間不晚，在這裡，他同樣遇上了一群知心、溫暖的朋友，踏上了喜歡的舞台，他說：「在這裡彷彿找到了存在的意義」、「和一群人一起創造回憶，那些身體的疲憊終將轉換成心靈上的富足。」

談到了出隊印象最深刻的事，學長提到了當時出隊時，他帶的大一不小心打壞了學校的電風扇，身為現場的組頭，他卻沒有意識到事情的嚴重性，也沒有主動向隊長回報，事後回想，他坦言自己身為榜樣，應該更有責任感、更進入狀況。在聽到自己帶的大一們沒有出下一隊時，學長也真誠地說：「雖然可惜，但帶他們這麼久了，我會永遠支持他們的決定」

對還在猶豫要不要加入基服的同學，學長表示：「大家可能會覺得我們的宣傳標語有點假有點浮誇，但當你進來之後，我想八九成的人都能感受到這份溫暖，如果你還在猶豫，覺得我們可能廣告不實，我還是要說一句，加就對了！因為只有親身參與，才會知道這一切是不是真的。」`,
        daysAgo: 1,
        relatedShortCode: 'ncu-svc-01',
        media: {
          kind: 'image',
          url: '/images/examples/service-interview-4x5.webp',
          width: 927,
          height: 1166,
          alt: '基服社學長人物採訪紀錄',
        },
      },
      {
        clubSlug: 'ncu-cat',
        authorEmail: 'ncu-csie-owner@ncu.edu.tw',
        kind: 'nrc_moment',
        headline: '協尋與守護校園小生命：麵茶與花花健康檢查紀錄',
        contentMd: `⊹ ࣪ ˖ ୨ৎ協尋貓咪主人 ୨ৎ ⊹ ࣪ ˖

- 現名：麵茶（左下）、花花（右下）
- 狀態：健康
- 結紮：還沒
- 預防針：尚未做過健康檢查

最近有在學校內發現新的貓咪，初步檢查貓咪尚未結紮，想尋找看看是否為走失貓咪～請大家幫忙多多轉發 讓他們回家🏠
若在結紮後仍未有主人出面帶回，我們將開放認養 ≽^•༚• ྀི≼`,
        daysAgo: 2,
        media: {
          kind: 'image',
          url: '/images/examples/cat-adoption-4x5.webp',
          width: 918,
          height: 1162,
          alt: '中央喵喵社校園貓咪健康守護紀錄',
        },
      },
      {
        clubSlug: 'ncu-cat',
        authorEmail: 'ncu-csie-owner@ncu.edu.tw',
        kind: 'nrc_moment',
        headline: '開車騎車放慢速，守護校園小動物',
        contentMd: `最近校園裡發生了讓人難過的事，有貓咪不幸被車撞倒了……😿

校園不只是我們學習的地方，也是許多小生命安居的家🐾為了不讓遺憾再次發生，我們想邀請大家一起發起減速運動：

> 「開車騎車放慢速，守護校園小動物。」

進入校園時，請鬆開一點油門、多留意一下周遭與車底。您腳下的一個小動作，就能拯救一個無價的生命。🐕🐈‍⬛

讓我們一起用溫柔的速度，守護身邊每一個可愛的小生命吧！🐈`,
        daysAgo: 1,
        media: {
          kind: 'image',
          url: '/images/examples/cat-slowdown-4x5.webp',
          width: 928,
          height: 1166,
          alt: '中央喵喵社校園行車減速守護小動物倡議',
        },
      },
      {
        clubSlug: 'ncu-dance',
        authorEmail: 'ncu-photo-editor@ncu.edu.tw',
        kind: 'album_highlight',
        headline: '｜中央熱舞35屆熱舞小成｜EUPHORIA ✨ 把寶藏鎖進九月裡',
        contentMd: `｜中央熱舞35屆熱舞小成｜EUPHORIA ✨
倒數14天🪎

回憶剛開學
充滿了期待的日子總是閃閃發亮💫
青澀懵懂的時光一去不復返
一瞬即逝的回憶，就和她的心一樣💗
總是抓不住🌀🌀🌀

如同寶藏般的回憶是最難得珍貴的✨
就讓我們一起鎖進🔒
把開學那時候所有的酸甜苦辣
全部鎖進九月裡

- 日期｜12/10（四）
- 時間｜18:00進場 18:30開始
- 地點｜中央大學大講堂`,
        daysAgo: 0,
        relatedShortCode: 'ncu-dn-01',
        media: {
          kind: 'image',
          url: '/images/examples/dance-euphoria-4x5.webp',
          width: 938,
          height: 1162,
          alt: '中央熱舞35屆小成 EUPHORIA 合照',
        },
      },
    ];

    // Clean up legacy poster-like posts from prior seed runs (AS-04)
    const legacyPostHeadlines = [
      '冬季觀星園大觀名單出爐，準備一起上山看滿天銀河',
      '第 35 屆社內盃《搖晃的紅酒盃》Battle 開跳，菜鳥老鳥同場飆舞',
    ];
    for (const oldHeadline of legacyPostHeadlines) {
      const legacy = existingPosts.find((p) => p.headline === oldHeadline);
      if (legacy) {
        await db.delete(schema.posts).where(eq(schema.posts.id, legacy.id));
      }
    }

    for (const item of curatedRealPosts) {
      const club = getClub(item.clubSlug);
      const matched = existingPosts.find(
        (p) => p.clubId === club.id && p.headline === item.headline
      );
      const relEvent = item.relatedShortCode ? getEvent(item.relatedShortCode) : null;
      if (matched) {
        await db
          .update(schema.posts)
          .set({
            contentMd: item.contentMd,
            mediaItems: [item.media],
            relatedEventId: relEvent?.id ?? null,
          })
          .where(eq(schema.posts.id, matched.id));
        continue;
      }
      const author = getUser(item.authorEmail);
      const pubAt = new Date(Date.now() - item.daysAgo * 24 * 60 * 60 * 1000);
      await db.insert(schema.posts).values({
        clubId: club.id,
        authorUserId: author.id,
        postKind: item.kind,
        headline: item.headline,
        contentMd: item.contentMd,
        mediaItems: [item.media],
        relatedEventId: relEvent?.id ?? null,
        moodTag: item.kind === 'nrc_moment' ? '社課現場' : null,
        domainIds: club.domainIds,
        originalityConfirmed: true,
        includeInEvaluation: item.kind === 'wip_work' || item.kind === 'album_highlight',
        status: 'published',
        publishedAt: pubAt,
      });
    }

    if (existingPosts.length === 0) {
      const mediaPool: schema.MediaItem[] = [
        { kind: 'image', url: '/images/demo/moment-4x5.svg', width: 800, height: 1000, alt: '社團現場直拍 4:5' },
        { kind: 'image', url: '/images/demo/moment-1x1.svg', width: 900, height: 900, alt: '作品細節方圖 1:1' },
        { kind: 'image', url: '/images/demo/moment-3x4.svg', width: 750, height: 1000, alt: '工作坊實況 3:4' },
        { kind: 'image', url: '/images/demo/event-16x9.svg', width: 1280, height: 720, alt: '活動花絮橫圖 16:9' },
      ];

      const streamBlueprints: {
        clubSlug: string;
        authorEmail: string;
        kind: schema.PostKind;
        headline: string;
        contentMd: string;
        daysAgo: number;
        relatedShortCode?: string;
        mediaIdx: number;
      }[] = [
        {
          clubSlug: 'ncu-gamedev',
          authorEmail: 'ncu-photo-member@ncu.edu.tw',
          kind: 'nrc_moment',
          headline: '深夜趕 GameJam 主角跳躍手感，美術組剛畫完超可愛史萊姆',
          contentMd: '今天社員在社辦一起把碰撞判定調順了！歡迎想畫像素圖或做音效的同學週四來看看。',
          daysAgo: 1,
          relatedShortCode: 'ncu-gd-01',
          mediaIdx: 0,
        },
        {
          clubSlug: 'ncu-gamedev',
          authorEmail: 'ncu-csie-owner@ncu.edu.tw',
          kind: 'wip_work',
          headline: '《松果守衛戰》Shader 光影測試原型可試玩囉',
          contentMd: '結合 2D 法線貼圖與動態燈光，週末試玩開放回饋。',
          daysAgo: 4,
          relatedShortCode: 'ncu-gd-01',
          mediaIdx: 1,
        },
        {
          clubSlug: 'ncu-gamedev',
          authorEmail: 'ncu-csie-owner@ncu.edu.tw',
          kind: 'qa_highlight',
          headline: '問答精華：完全不會寫程式只喜歡畫圖也能進創遊社嗎？',
          contentMd: '社長回覆：我們超過 40% 社員是美術、音樂或企劃組，組隊時程式與美術永遠最搶手！',
          daysAgo: 7,
          mediaIdx: 2,
        },
        {
          clubSlug: 'ncu-photo',
          authorEmail: 'ncu-photo-member@ncu.edu.tw',
          kind: 'nrc_moment',
          headline: '第一次進紅燈暗房顯影，看著影像慢慢浮出來的瞬間超感動',
          contentMd: '謝謝副社長手把手教我調顯影液溫度，新手真的不用怕。',
          daysAgo: 2,
          relatedShortCode: 'ncu-ph-01',
          mediaIdx: 2,
        },
        {
          clubSlug: 'ncu-photo',
          authorEmail: 'ncu-photo-owner@ncu.edu.tw',
          kind: 'album_highlight',
          headline: '中大湖秋日街拍精選：百花川午後穿過松樹的金色逆光',
          contentMd: '活動共享相簿無損原圖精選，歡迎來社辦看實體放大照片。',
          daysAgo: 3,
          relatedShortCode: 'ncu-ph-01',
          mediaIdx: 0,
        },
        {
          clubSlug: 'ncu-photo',
          authorEmail: 'ncu-photo-editor@ncu.edu.tw',
          kind: 'wip_work',
          headline: '《夜色松林》期中銀鹽暗房作品裝裱進行中',
          contentMd: '這週六日我們在藝文空間試擺作品順序，經過都可以來聊聊。',
          daysAgo: 10,
          mediaIdx: 1,
        },
      ];

      // Expand across all remaining 12 verified clubs (3 each = 36 total + 6 above = 42 posts)
      for (const c of clubSpecs.filter((x) => x.status === 'verified')) {
        const club = getClub(c.slug);
        const owner = getUser(c.ownerEmail!);
        const relatedEv = allEvents.find((e) => e.clubId === club.id);
        const kinds: schema.PostKind[] = ['nrc_moment', 'wip_work', 'qa_highlight'];
        for (let i = 0; i < 3; i++) {
          const kind = kinds[i]!;
          const headline =
            kind === 'nrc_moment'
              ? `${club.name.replace('國立', '')}日常：今晚社課大家一起動手做超歡樂`
              : kind === 'wip_work'
                ? `${club.name.replace('國立', '')}階段成果分享與社員筆記`
                : `新手常問：沒經驗也能輕鬆融入${club.name.slice(0, 6)}的節奏嗎？`;
          streamBlueprints.push({
            clubSlug: c.slug,
            authorEmail: owner.email,
            kind,
            headline,
            contentMd: `### 社團日常現場\n${club.tagline}\n\n歡迎從體驗活動認識我們的真實互動節奏。`,
            daysAgo: 3 + i * 6,
            relatedShortCode: relatedEv?.shortCode,
            mediaIdx: (i + club.name.length) % mediaPool.length,
          });
        }
      }

      for (const item of streamBlueprints) {
        const club = getClub(item.clubSlug);
        const author = getUser(item.authorEmail);
        const relEvent = item.relatedShortCode ? getEvent(item.relatedShortCode) : null;
        const pubAt = new Date(Date.now() - item.daysAgo * 24 * 60 * 60 * 1000);
        await db.insert(schema.posts).values({
          clubId: club.id,
          authorUserId: author.id,
          postKind: item.kind,
          headline: item.headline,
          contentMd: item.contentMd,
          mediaItems: [mediaPool[item.mediaIdx]!],
          relatedEventId: relEvent?.id ?? null,
          sourceAlbumPhotoId:
            item.kind === 'album_highlight' && item.clubSlug === 'ncu-photo'
              ? featuredAlbumId
              : null,
          moodTag: item.kind === 'nrc_moment' ? '日常微紀錄' : null,
          domainIds: club.domainIds,
          originalityConfirmed: true,
          includeInEvaluation: item.kind === 'wip_work' || item.kind === 'album_highlight',
          status: 'published',
          publishedAt: pubAt,
        });
      }
    }

    // 9. Together Items (6+ items including 1 Rebound), Jams (2), Practical Resources (3)
    const existingTogether = await db.select({ id: schema.togetherItems.id }).from(schema.togetherItems);
    if (existingTogether.length === 0) {
      const [parentGameShowcase] = await db
        .insert(schema.togetherItems)
        .values({
          domainId: getDomain('game-dev').id,
          itemType: 'showcase',
          clubId: gameClub.id,
          authorUserId: getUser('ncu-csie-owner@ncu.edu.tw').id,
          title: '《松果跑酷》WebGL 試玩版：48 小時 GameJam 成品與程式美術分工復盤',
          contentMd:
            '這次我們拆成 1 位程式＋2 位美術＋1 位音效，直接內嵌試玩連結歡迎友社試玩給手感建議！',
          mediaItems: [
            { kind: 'image', url: '/images/demo/event-16x9.svg', width: 1280, height: 720 },
          ],
          embedUrl: 'https://itch.io',
        })
        .returning();

      await db.insert(schema.togetherItems).values([
        {
          domainId: getDomain('game-dev').id,
          itemType: 'rebound',
          clubId: getClub('nthu-maker').id,
          authorUserId: getUser('nthu-maker-owner@nthu.edu.tw').id,
          parentItemId: parentGameShowcase.id,
          title: 'Rebound：清大創客替《松果跑酷》改作實體大按鈕控制器接力版',
          contentMd: '我們拿 ESP32 接了兩顆大型街機按鈕模擬跳躍與衝刺，現場試玩超有感！',
          mediaItems: [
            { kind: 'image', url: '/images/demo/moment-1x1.svg', width: 900, height: 900 },
          ],
          embedUrl: 'https://github.com',
        },
        {
          domainId: getDomain('photo-film').id,
          itemType: 'showcase',
          clubId: getClub('ntust-photo').id,
          authorUserId: getUser('ntust-photo-owner@ntust.edu.tw').id,
          title: '臺科大 × 雙北高架橋夜間長曝光布光參數對照整理',
          contentMd: '實測 35mm 與 50mm 鏡頭搭配不同 ND 減光鏡的車軌曝光秒數。',
          mediaItems: [
            { kind: 'image', url: '/images/demo/moment-4x5.svg', width: 800, height: 1000 },
          ],
        },
        {
          domainId: getDomain('outdoor-mountain').id,
          itemType: 'field_log',
          clubId: getClub('ncu-mountaineering').id,
          authorUserId: getUser('ncu-photo-owner@ncu.edu.tw').id,
          title: '北部新手郊山路線實測：大棟山接大同山撤退點與水源筆記',
          contentMd: '總長 6.5 公里適合大一體能測試，沿途兩處涼亭可躲雨。',
          mediaItems: [
            { kind: 'image', url: '/images/demo/moment-3x4.svg', width: 750, height: 1000 },
          ],
        },
        {
          domainId: getDomain('sports-fitness').id,
          itemType: 'match_invite',
          clubId: getClub('ncku-badminton').id,
          authorUserId: getUser('nthu-maker-owner@nthu.edu.tw').id,
          title: '尋求中北部羽球社舉辦新手組分級友誼交流賽',
          contentMd: '預計 12 月中旬舉辦，提供雙打讓分規則範本，歡迎各校羽球社接洽！',
          mediaItems: [],
        },
        {
          domainId: getDomain('finance-research').id,
          itemType: 'reading_notes',
          clubId: getClub('ncu-fintech').id,
          authorUserId: getUser('ncu-csie-owner@ncu.edu.tw').id,
          title: '跨校專題書單交換：給非商管背景同學的 4 本產業分析入門書',
          contentMd: '整理我們這學期讀書會反應最好的四本實務書單與簡報模板。',
          mediaItems: [],
        },
      ]);

      await db.insert(schema.togetherJams).values([
        {
          hostClubId: gameClub.id,
          domainId: getDomain('game-dev').id,
          createdBy: getUser('ncu-csie-owner@ncu.edu.tw').id,
          title: '2026 北區大專 Winter GameJam：跨校隨機組隊 48 小時創作挑戰',
          summary: '徵求音樂、美術、Unity/Godot 程式同學跨校混合組隊，線上線下同步開跑！',
          targetSchoolsCount: 4,
          neededRoles: ['遊戲美術', '音效配樂', 'Unity/Godot 程式'],
          collabFormat: '線上 Discord 同步 ＋ 週末實體試玩展',
          deadlineAt: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
          status: 'open',
        },
        {
          hostClubId: getClub('ntust-photo').id,
          domainId: getDomain('photo-film').id,
          createdBy: getUser('ntust-photo-owner@ntust.edu.tw').id,
          title: '《校園裡的深夜亮燈》三校聯合底片接力攝影展徵件',
          summary: '每校徵集 10 幅紀實攝影作品共同線上線下聯展並交換暗房沖洗經驗。',
          targetSchoolsCount: 3,
          neededRoles: ['底片攝影師', '展覽視覺設計'],
          collabFormat: '各校分區展覽 ＋ 聯合線上作品牆',
          deadlineAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          status: 'open',
        },
      ]);

      await db.insert(schema.practicalResources).values([
        {
          domainId: getDomain('game-dev').id,
          sourceUniversityId: getUni('NCU').id,
          title: '跨校 GameJam 場地與外校人員入校報備避雷清單（去識別化）',
          contentMd: '1. 夜間借用教室須於活動前 14 個工作天送總務處駐警隊夜間登記。\n2. 延長線負載勿串接高瓦數熱水壺。',
        },
        {
          domainId: getDomain('photo-film').id,
          sourceUniversityId: getUni('NTUST').id,
          title: '暗房廢液清運與學校環安衛窗口申請流程彙整',
          contentMd: '定影液含銀離子不可直接倒入水槽，每學期末可向環安中心預約統一回收桶。',
        },
        {
          domainId: getDomain('social-service').id,
          sourceUniversityId: getUni('NCU').id,
          title: '校外偏鄉出隊保險名冊與服務學習時數系統核銷時程檢查表',
          contentMd: '保險名單須提前 7 日送出；時數核銷建議於活動結束後 10 日內完成簽到匯入。',
        },
      ]);
    }

    // 10. Private Handover Note + Sample Archive File for ncu-photo
    const existingNotes = await db
      .select({ id: schema.clubHandoverNotes.id })
      .from(schema.clubHandoverNotes)
      .where(eq(schema.clubHandoverNotes.clubId, photoClub.id))
      .limit(1);
    if (existingNotes.length === 0) {
      await db.insert(schema.clubHandoverNotes).values({
        clubId: photoClub.id,
        authorUserId: getUser('ncu-alumni@ncu.edu.tw').id,
        venueTips: '據德樓 B1 暗房鑰匙需向課外組借備份，假日需提前週五下午領取。',
        hoursAndDeadlines: '藝文時數名單須於活動後兩週內上傳學務處系統；年度評鑑區間為 5/1 至隔年 5/31。',
        contactsAndVendors: '相紙與藥水固定向中壢光華材料行叫貨，報「中大攝影社」有學生價。',
      });
    }

    const existingArchive = await db
      .select({ id: schema.clubArchiveFiles.id, title: schema.clubArchiveFiles.title })
      .from(schema.clubArchiveFiles)
      .where(eq(schema.clubArchiveFiles.clubId, photoClub.id))
      .limit(1);
    if (existingArchive.length === 0) {
      await db.insert(schema.clubArchiveFiles).values({
        clubId: photoClub.id,
        uploadedBy: photoOwner.id,
        archiveCategory: 'finance_ledger',
        title: '115 學年度上學期社費收支與暗房藥水採購清冊',
        description: '僅供社團內部交接與年度評鑑備查，不對外公開。',
        blobPath: `archive/${photoClub.id}/demo-finance-ledger.pdf`,
        mimeType: 'application/pdf',
        sizeBytes: 245760,
        occurredOn: '2026-10-15',
      });
    } else if (existingArchive[0]?.title.includes('（私密存檔示範）')) {
      await db
        .update(schema.clubArchiveFiles)
        .set({ title: '115 學年度上學期社費收支與暗房藥水採購清冊' })
        .where(eq(schema.clubArchiveFiles.id, existingArchive[0].id));
    }

    console.log('Seed v2 complete (idempotent).');
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error('Seed v2 failed:', err);
  process.exit(1);
});
