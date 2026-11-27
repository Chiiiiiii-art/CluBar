# 社團聚（CluBar）軟體需求規格書（SRS）

> **文件版本**：v1.0（P0 開發定案版）  
> **目標讀者**：內部前後端、AI 與資料工程開發團隊  
> **上位文件**：[clubar-prd.md](file:///c:/Users/alexl/Desktop/Programs/CluBar/clubar-prd.md)、[clubar-pitch-deck.md](file:///c:/Users/alexl/Desktop/Programs/CluBar/clubar-pitch-deck.md)、[ms-ncu-ai-competition-rules.md](file:///c:/Users/alexl/Desktop/Programs/CluBar/ms-ncu-ai-competition-rules.md)  
> **參考清單**：[microsoft-app-ai-products.md](file:///c:/Users/alexl/Desktop/Programs/CluBar/reference/microsoft-app-ai-products.md)  
> **開發目標里程碑**：2026/12/04 初審繳件（架構與核心畫面／短片）｜2026/12/30 Demo Day（P0 全流程可操作上線）

---

## 1. 系統總覽與技術架構定案

### 1.1 技術棧選型總表

| 層級 | 選用技術 | 用途與選型理由 | P1 / P2 演進路徑 |
| --- | --- | --- | --- |
| **前端與全端框架** | **Next.js 15 (App Router, TypeScript)** + Tailwind CSS | 單一 Repo 開發最快；SSR 利於社團公開頁 SEO 與社群分享 OG 預覽；Mobile-first RWD 一次涵蓋瀏覽端與管理端 | 維持不變；視需求補強 PWA 離線快取 |
| **資料庫與向量檢索** | **Supabase (PostgreSQL 16 + `pgvector` + `pg_trgm`)** | 單一資料庫同時存放關聯業務資料與貼文向量，零雙寫同步成本；內建 Transaction Pooler 適配 Serverless | 貼文超過 10,000 篇或多校複雜篩選時，檢索層可切換至 **Azure AI Search** |
| **ORM / Schema** | **Drizzle ORM** + `drizzle-kit` | 原生支援 `pgvector` 型別、無重型二進位引擎（Vercel Serverless 冷啟動快）、SQL 透明好除錯 | 維持不變 |
| **AI 語言模型與嵌入** | **Azure OpenAI Service**（`gpt-4o-mini` + `text-embedding-3-small`）<br>*並相容 **OpenRouter / DeepSeek**（環境變數切換）* | 透過 OpenAI-compatible 抽象層 + Zod 驗證，兼顧微軟競賽生態整合與開發期彈性切換（避免額度或申請卡關） | P1 可視評鑑摘要品質需求升級高階模型 |
| **媒體檔案儲存** | **Azure Blob Storage** | 存放社團頭像、封面與作品圖；採前端壓縮 + 短時效 SAS URL 直傳，避開 Vercel 4.5MB 請求上限 | P1 可加上 Azure CDN / Front Door 加速 |
| **身分驗證** | **Auth.js (NextAuth v5)**：Microsoft Entra ID + Google OAuth + `.edu.tw` 網域 OTP | 兼顧微軟校園帳號亮點與跨校零門檻；不依賴單一學校 IT 審批即能支援全台 139 所大專校院 | P1 可與中大計中對接正式校園 SSO |
| **信件發送** | **Resend**（或 Azure Communication Services Email） | 僅用於 `.edu.tw` 6 位數 OTP 驗證信（單一 `sendEmail()` 介面，可抽換） | P1 可擴充換屆／審核 Email 通知 |
| **應用程式託管** | **Vercel** | Git push 自動觸發 PR Preview，利於 5 週快速迭代與 12/30 彩排 | P1 可遷移至 **Azure App Service / Container Apps** |
| **數據分析對接** | PostgreSQL `analytics_events` 匿名事件表 + CSV 匯出 | 零 PII、免掛 GA4 Cookie 橫幅，欄位結構預先對齊 **Power BI** 匯入格式（供 P1 校方報表展示） | P1 直接接 Power BI 校方管理儀表板 |

### 1.2 系統架構圖

```mermaid
flowchart TB
    subgraph Client["使用者端（Mobile-first RWD Web）"]
        Browser["瀏覽器 / 手機掃碼<br/>別的聚 / 我的聚 / 一起聚 / 管理端"]
    end

    subgraph Vercel["Vercel（Next.js App Router）"]
        Pages["RSC 公開頁 & 互動 UI"]
        API["Route Handlers (/api/*)<br/>Auth / RBAC / Fairness / Admin"]
        AIAdapter["AI Provider Adapter<br/>(LLM + Embedding 解耦 + Zod)"]
    end

    subgraph Data["Supabase"]
        Pooler["PgBouncer (Port 6543)"]
        PG[("PostgreSQL 16<br/>關聯表 + pgvector + pg_trgm")]
    end

    subgraph Microsoft["Microsoft Azure & 外部服務"]
        Entra["Microsoft Entra ID<br/>(OAuth / SSO)"]
        Google["Google OAuth"]
        AOAI["Azure OpenAI Service<br/>(或 OpenRouter DeepSeek 切換)"]
        Blob["Azure Blob Storage<br/>(SAS Direct Upload)"]
        Mail["Email Service<br/>(.edu.tw OTP)"]
    end

    Browser -->|HTTPS| Pages
    Browser -->|HTTPS JSON| API
    Browser -.->|直傳壓縮後 WebP<br/>短時效 SAS URL| Blob
    Pages --> Pooler
    API --> Pooler
    Pooler --> PG
    API -->|OAuth| Entra
    API -->|OAuth| Google
    API -->|簽發寫入 SAS| Blob
    API -->|寄發 OTP| Mail
    API --> AIAdapter
    AIAdapter -->|Chat / Embedding| AOAI
```

### 1.3 PRD 需求追蹤矩陣（Traceability Matrix）

| PRD 編號 | 功能摘要 | SRS 對應章節 | 核心資料表 | 核心 API / 路由 |
| --- | --- | --- | --- | --- |
| 第 2 章 | 角色與權限矩陣、校園驗證 | §2、§3.1 | `users`, `oauth_accounts`, `universities`, `campus_email_otps`, `club_memberships` | `/api/auth/*`, `/api/me/campus-verify/*` |
| `FR-MY-01` | 社團公開主頁、參與機會區、認領入口 | §3.2、§5.1 | `clubs`, `club_opportunities`, `posts` | `/clubs/[slug]`, `GET /api/clubs/[slug]` |
| `FR-MY-02` | 統一成果貼文模型與發布、媒體上傳 | §3.2、§5.2、§7.1 | `posts` | `POST/PATCH/DELETE /api/clubs/[slug]/posts/*`, `/api/media/sas` |
| `FR-MY-03` | 零散紀錄（文字／PDF）快速整理成草稿 | §6.2 | `posts`（草稿由前端確認後送出） | `POST /api/ai/draft-from-raw` |
| `FR-MY-04` | 私密收藏、追蹤、分享、匿名聯絡點擊 | §3.2、§7.3 | `user_bookmarks`, `user_follows`, `analytics_events` | `/api/me/bookmarks`, `/api/me/follows`, `/api/events` |
| `FR-MY-05` | 跨屆權限繼承、雙向換屆、防刪、失聯接管 | §3.2、§4.2 | `club_memberships`, `club_handovers`, `club_applications`, `audit_logs` | `/api/clubs/[slug]/members`, `/api/clubs/[slug]/handovers/*` |
| `FR-MY-06` | 學年度成果彙整與列印 PDF / Markdown 匯出 | §7.2 | `posts`, `clubs` | `/clubs/[slug]/summary/[year]/print`, `/api/clubs/[slug]/summary/[year]/export` |
| `FR-DISC-01` | 雙軌探索入口（分類標籤＋白話需求＋推薦理由） | §6.2 | `posts` (`embedding`), `clubs` | `GET /api/discover/feed`, `POST /api/discover/query` |
| `FR-DISC-02` | 公平曝光（零虛榮指標、單社團 ≤2、不連續） | §6.2 | 應用層確定性重排模組 | `src/lib/discovery/fairness.ts` |
| `FR-DISC-03` | 克制瀏覽（上限 12 則、不足不補、結尾卡） | §6.2、§5.1 | 應用層回傳契約 | `batch_meta.is_end_of_batch = true` |
| `FR-TOG-01` | 一起聚六大分類討論流、有幫助標記 | §3.2、§5.2 | `forum_threads`, `forum_replies`, `forum_helpful_marks` | `/api/forum/threads/*`, `/api/forum/replies/*` |
| `FR-TOG-02` | 公開唯讀、社團名義發言、多社團身分切換 | §2.3、§5.2 | `club_memberships`, `forum_threads`, `forum_replies` | Server-side membership check on `acting_club_id` |
| `FR-TOG-03` | 站外延伸合作（無站內私訊） | §5.1 | `clubs.external_links` | 點擊社團標籤導向 `/clubs/[slug]` |
| `FR-GOV-01` | 名錄認領與新社團申請雙軌審核 | §4.1、§5.2 | `clubs`, `club_applications`, `notifications`, `audit_logs` | `POST /api/club-applications`, `/api/admin/applications/*` |
| `FR-GOV-02` | 先發後審、公開檢舉與管理員處置 | §4.3、§5.2 | `reports`, `posts`, `clubs`, `audit_logs`, `notifications` | `POST /api/reports`, `/api/admin/reports/*` |
| `FR-GOV-03` | 原創與素材授權勾選、示範資料標章 | §3.2、§5.2 | `posts.originality_confirmed`, `clubs.is_demo` | 發布 API 強制驗 `originality_confirmed === true` |

---

## 2. 身分驗證、校園驗證與 RBAC 權限設計

### 2.1 登入與校園驗證流程

系統以 **Auth.js (NextAuth v5)** 管理登入狀態，P0 固定採 **Stateless 加密 JWT Session**（Token 僅存 `userId`，免維護 `sessions` 資料表），並於伺服器端搭配 `users` 與 `club_memberships` 即時查詢權限，確保換屆或停權立即生效。

1. **OAuth 登入（Microsoft Entra ID + Google）與帳號綁定規則**：
   - 使用者點選登入後，選擇「使用 Microsoft 帳號（含校園信箱）」或「使用 Google 帳號」。
   - Microsoft Entra ID 採 Multi-tenant `common` 端點與最小 Scope（`openid profile email`），避免觸發校方 IT 管理員同意牆。
   - **跨 Provider 綁定安全規則**：登入回呼時先以 `(provider, provider_account_id)` 查詢 `oauth_accounts`；若尚未綁定且該 Provider 回傳已驗證之 `email`（Google 須 `email_verified === true`；Entra ID 若跨租戶未確定驗證狀態則不自動合併），才可依 `users.email` 自動關聯現有帳號，否則建立新 `users` 與 `oauth_accounts` 紀錄，防止未驗證信箱冒領撞號。
   - **首位平台管理員初始化**：環境變數 `ADMIN_EMAILS`（逗號分隔）列舉之已驗證 OAuth 信箱於登入時自動升級 `platform_role = 'platform_admin'`，並於 `scripts/seed.ts` 同步預建測試管理員帳號。
   - **非正式環境測試登入（`dev-login`）**：僅當 `NODE_ENV !== 'production'` 且 `ENABLE_DEV_LOGIN === 'true'` 時，`/login` 額外啟用開發測試帳號一鍵登入（`Credentials` Provider 查詢既有種子帳號，不接受任意未建檔信箱），Production 建置強制停用。
2. **自動校園驗證（Auto-Verify）**：
   - 登入回呼時，取出 OAuth 驗證過之 `email` 網域（取 `@` 後段並轉小寫），比對 `universities.email_domains`（支援主網域與子網域，例如 `ncu.edu.tw` 涵蓋 `cc.ncu.edu.tw`、`g.ncu.edu.tw`）。
   - 若命中白名單且該 OAuth Provider 回傳信箱已完成驗證：自動寫入 `users.campus_email`、`users.university_id`、`users.campus_verified_at = now()`，直接取得 **Verified Student** 資格。
3. **手動補驗 `.edu.tw` 校園信箱（OTP 升級）**：
   - 若使用者以私人信箱（如 `@gmail.com`）登入，身分為 **Member**，可在個人中心輸入 `.edu.tw` 校園信箱申請驗證。
   - 後端檢核網域是否存在於 `universities.email_domains`（不存在則回 `400 UNSUPPORTED_CAMPUS_DOMAIN`），生成 6 位數隨機數字碼，以 `SHA-256(otp + server_pepper)` 存入 `campus_email_otps`（TTL = 10 分鐘，最多錯誤 5 次即作廢，單一使用者每分鐘限發 1 次）。
   - 驗證成功後綁定 `campus_email`（唯一鍵約束，避免同一校園信箱無限刷分身）與 `university_id`。

### 2.2 個資最小揭露原則（Privacy Boundary）

- **強制序列化白名單**：所有公開 API（`GET /api/discover/*`、`GET /api/clubs/*`、`GET /api/forum/*`）與 RSC 傳給 Client Component 的 Props，**嚴禁包含** `users.email`、`users.campus_email`、`oauth_accounts.provider_account_id`、任何學號或 IP。
- 公開畫面中僅允許呈現：社團名稱、校名、公開外部聯絡連結，以及「一起聚」中由幹部主動選填之職稱（如「社長」、「活動長」）。

### 2.3 Server-Side RBAC 中介守衛規格

所有寫入與管理 API 必須在伺服器端執行獨立權限守衛函式（禁止僅靠前端隱藏按鈕），守衛分級如下：

| 守衛函式 | 檢查條件 | 失敗回傳 |
| --- | --- | --- |
| `requireAuth()` | 有效登入 Session | `401 UNAUTHENTICATED` |
| `requireVerifiedStudent()` | `requireAuth()` 且 `user.campus_verified_at IS NOT NULL` | `403 CAMPUS_VERIFICATION_REQUIRED` |
| `requireClubRole(clubId, ['owner', 'editor'])` | `requireVerifiedStudent()` 且 `club_memberships` 存在 `ended_at IS NULL` 之對應角色，且 `clubs.verification_status === 'verified'`（未停權） | `403 CLUB_PERMISSION_DENIED` 或 `403 CLUB_SUSPENDED` |
| `requireClubOwner(clubId)` | 同上，且 `role === 'owner'` | `403 CLUB_OWNER_REQUIRED` |
| `requireClubSummaryAccess(clubId)` | `requireAuth()` 且具備該社團現行成員（`ended_at IS NULL`）、歷屆校友（`role === 'alumni'`）或 `platform_role === 'platform_admin'` | `403 CLUB_PERMISSION_DENIED` |
| `requirePlatformAdmin()` | `requireAuth()` 且 `user.platform_role === 'platform_admin'` | `403 ADMIN_REQUIRED` |

> **權限即時生效規則**：每次敏感操作（發文、刪文、成員異動、換屆、一起聚發言）一律即時查詢 `club_memberships` 與 `clubs.verification_status`，不依賴過期 JWT Claim，確保「雙向確認換屆」與「管理員停權」於毫秒內生效。

---

## 3. 資料庫規格（PostgreSQL 16 + `pgvector`）

### 3.1 核心 ER 關聯概覽

```mermaid
erDiagram
    universities ||--o{ users : "belongs_to"
    universities ||--o{ clubs : "hosts"
    users ||--o{ club_memberships : "holds"
    clubs ||--o{ club_memberships : "has"
    clubs ||--o{ club_handovers : "transfers"
    clubs ||--o{ club_opportunities : "publishes"
    clubs ||--o{ posts : "owns"
    users ||--o{ user_bookmarks : "saves"
    posts ||--o{ user_bookmarks : "bookmarked_by"
    users ||--o{ user_follows : "follows"
    clubs ||--o{ user_follows : "followed_by"
    clubs ||--o{ forum_threads : "authors"
    forum_threads ||--o{ forum_replies : "has"
    clubs ||--o{ forum_replies : "authors"
    users ||--o{ club_applications : "submits"
    users ||--o{ reports : "files"
    users ||--o{ notifications : "receives"
```

### 3.2 完整資料表定義（DDL 規格）

開發者應以 Drizzle Schema 對應以下約束建立 Migration。所有時間戳皆採 `TIMESTAMPTZ`（UTC 儲存，前端轉 `Asia/Taipei` 顯示）；主鍵採 `UUID`（`gen_random_uuid()`）。

#### 列舉型別（Enums）

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 台灣大專標準六大社團分類（全站統一，P0 固定）
CREATE TYPE club_category AS ENUM (
  'academic',   -- 學術
  'arts',       -- 藝文
  'recreation', -- 康樂
  'sports',     -- 體育
  'service',    -- 服務
  'social'      -- 聯誼
);

CREATE TYPE platform_role AS ENUM ('user', 'platform_admin', 'school_admin'); -- school_admin 預留 P1
CREATE TYPE club_verification_status AS ENUM ('unclaimed_directory', 'pending_review', 'verified', 'suspended');
CREATE TYPE club_member_role AS ENUM ('owner', 'editor', 'alumni');
CREATE TYPE handover_status AS ENUM ('pending', 'accepted', 'rejected', 'cancelled', 'expired');
CREATE TYPE post_type AS ENUM ('work', 'event', 'workshop', 'competition'); -- 作品/活動/社課/競賽展演
CREATE TYPE post_status AS ENUM ('draft', 'published', 'hidden_by_owner', 'removed_by_admin');
CREATE TYPE forum_tag AS ENUM ('event_exp', 'equipment', 'venue', 'management', 'collab');
CREATE TYPE forum_status AS ENUM ('published', 'removed_by_admin');
CREATE TYPE application_type AS ENUM ('directory_claim', 'new_club', 'owner_takeover');
CREATE TYPE application_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE report_target_type AS ENUM ('post', 'club', 'forum_thread', 'forum_reply');
CREATE TYPE report_reason AS ENUM ('impersonation', 'copyright', 'privacy_leak', 'inappropriate', 'other');
CREATE TYPE report_status AS ENUM ('open', 'resolved_takedown', 'resolved_keep', 'resolved_suspend_club');
CREATE TYPE analytics_event_type AS ENUM (
  'discover_card_click',
  'club_page_view',
  'official_link_click',
  'opportunity_link_click',
  'club_follow',
  'post_bookmark',
  'discover_query_submit'
);
```

#### 1. 學校、使用者與校園驗證

```sql
CREATE TABLE universities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            TEXT NOT NULL UNIQUE,           -- e.g. 'NCU', 'NTUST', 'NTU'
  name            TEXT NOT NULL,                  -- e.g. '國立中央大學'
  short_name      TEXT NOT NULL,                  -- e.g. '中央大學'
  email_domains   TEXT[] NOT NULL,                -- e.g. ARRAY['ncu.edu.tw'] (比對主網域與任意子網域)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email               TEXT NOT NULL UNIQUE,       -- OAuth 主信箱（嚴禁對外公開）
  display_name        TEXT NOT NULL,
  avatar_url          TEXT,
  platform_role       platform_role NOT NULL DEFAULT 'user',
  campus_email        TEXT UNIQUE,                -- 通過驗證的 .edu.tw 信箱（嚴禁對外公開）
  university_id       UUID REFERENCES universities(id),
  campus_verified_at  TIMESTAMPTZ,
  managed_university_id UUID REFERENCES universities(id), -- P1 校方管理者預留欄位
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE oauth_accounts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider            TEXT NOT NULL,              -- 'microsoft-entra-id' | 'google'
  provider_account_id TEXT NOT NULL,              -- Provider 端不可變識別碼（嚴禁對外公開）
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_account_id)
);
CREATE INDEX idx_oauth_accounts_user ON oauth_accounts(user_id);

CREATE TABLE campus_email_otps (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  campus_email    TEXT NOT NULL,
  university_id   UUID NOT NULL REFERENCES universities(id),
  otp_hash        TEXT NOT NULL,                  -- SHA-256(code + pepper)
  attempts        SMALLINT NOT NULL DEFAULT 0,
  expires_at      TIMESTAMPTZ NOT NULL,
  consumed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_otp_user_active ON campus_email_otps(user_id, created_at DESC) WHERE consumed_at IS NULL;
```

#### 2. 我的聚：社團、成員、換屆交接與參與機會

```sql
CREATE TABLE clubs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id       UUID NOT NULL REFERENCES universities(id),
  slug                TEXT NOT NULL UNIQUE,       -- 公開 URL：/clubs/{slug}，如 'ncu-photo'
  name                TEXT NOT NULL,
  category            club_category NOT NULL,
  tagline             TEXT NOT NULL DEFAULT '',   -- 一句話簡介 (<= 120 字)
  description         TEXT NOT NULL DEFAULT '',
  avatar_url          TEXT,
  cover_url           TEXT,
  -- external_links 結構: [{ "type": "ig"|"fb"|"email"|"website"|"form"|"other", "label": "...", "url": "https://..." }]
  external_links      JSONB NOT NULL DEFAULT '[]'::jsonb,
  verification_status club_verification_status NOT NULL DEFAULT 'pending_review',
  is_demo             BOOLEAN NOT NULL DEFAULT false, -- FR-GOV-03: 示範資料強制標章
  official_directory_url TEXT,                    -- 來自校方名錄之原始參考頁
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (university_id, name)
);
CREATE INDEX idx_clubs_category_status ON clubs(category, verification_status);

CREATE TABLE club_memberships (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id         UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role            club_member_role NOT NULL,
  title           TEXT,                           -- 選填職稱（如「社長」「活動長」）
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at        TIMESTAMPTZ                     -- 現行有效成員 (owner/editor) 為 NULL；卸任、移除或轉為 alumni 一律設 ended_at = now()
);
-- 關鍵約束 1：每個社團同一時間最多只有一位現任社長（防止併發交接產生雙社長）
CREATE UNIQUE INDEX uq_club_single_active_owner
  ON club_memberships(club_id)
  WHERE role = 'owner' AND ended_at IS NULL;
-- 關鍵約束 2：同一使用者在同一社團僅一筆現行有效 (owner/editor) 紀錄；卸任後仍可再次受指派
CREATE UNIQUE INDEX uq_club_active_member
  ON club_memberships(club_id, user_id)
  WHERE ended_at IS NULL;

CREATE TABLE club_handovers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id         UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  from_user_id    UUID NOT NULL REFERENCES users(id),
  to_user_id      UUID NOT NULL REFERENCES users(id),
  status          handover_status NOT NULL DEFAULT 'pending',
  note            TEXT,
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (from_user_id <> to_user_id)
);
-- 同一社團同時最多一筆待確認之換屆邀請
CREATE UNIQUE INDEX uq_club_pending_handover
  ON club_handovers(club_id)
  WHERE status = 'pending';

CREATE TABLE club_opportunities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id         UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  summary         TEXT NOT NULL,                  -- 一句話說明 (<= 160 字)
  schedule_text   TEXT,                           -- 例如「每週三 19:00 志希館」或「報名至 12/20」
  deadline_at     TIMESTAMPTZ,                    -- 過期自動不顯示於公開頁
  external_url    TEXT NOT NULL,                  -- 外部報名或聯絡連結（驗 https:// 或 mailto:）
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_opportunities_club_active ON club_opportunities(club_id, is_active, deadline_at);
```

#### 3. 成果貼文（含 `pgvector` 向量索引）與私密輕互動

```sql
CREATE TABLE posts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id               UUID NOT NULL REFERENCES clubs(id) ON DELETE RESTRICT, -- 資產歸屬社團，禁止隨個人刪除
  author_user_id        UUID NOT NULL REFERENCES users(id),                    -- 稽核記錄用，不代表個人所有權
  academic_year         SMALLINT NOT NULL,         -- 民國學年度，如 115（區間建議 100..150）
  post_type             post_type NOT NULL,        -- work / event / workshop / competition
  title                 TEXT NOT NULL,
  summary               TEXT NOT NULL DEFAULT '',  -- 供探索卡片與 LLM 精篩使用（<= 200 字）
  content_md            TEXT NOT NULL,
  tags                  TEXT[] NOT NULL DEFAULT '{}',
  -- media_urls: [{ "url": "https://<account>.blob.core.windows.net/...", "alt": "", "width": 1200, "height": 800 }]
  media_urls            JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- external_links: [{ "label": "YouTube 成果影片", "url": "https://..." }]
  external_links        JSONB NOT NULL DEFAULT '[]'::jsonb,
  collaborators         TEXT,
  originality_confirmed BOOLEAN NOT NULL DEFAULT false,
  status                post_status NOT NULL DEFAULT 'draft',
  embedding             vector(1536),              -- 對應 text-embedding-3-small；若切換他牌維度須同步遷移
  embedding_updated_at  TIMESTAMPTZ,
  published_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- 強制約束：未勾選原創授權不得為 published
  CHECK (status <> 'published' OR originality_confirmed = true)
);
CREATE INDEX idx_posts_club_year_status ON posts(club_id, academic_year DESC, published_at DESC);
CREATE INDEX idx_posts_published_recent ON posts(published_at DESC) WHERE status = 'published';
CREATE INDEX idx_posts_tags_gin ON posts USING GIN (tags);
CREATE INDEX idx_posts_title_trgm ON posts USING GIN (title gin_trgm_ops); -- 降級關鍵字檢索用
CREATE INDEX idx_posts_embedding_hnsw ON posts USING hnsw (embedding vector_cosine_ops)
  WHERE status = 'published' AND embedding IS NOT NULL;

-- 私密收藏與追蹤：嚴禁在任何公開查詢 COUNT(*) 曝光給前端
CREATE TABLE user_bookmarks (
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

CREATE TABLE user_follows (
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  club_id     UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, club_id)
);
```

#### 4. 一起聚：跨校交流討論流

```sql
CREATE TABLE forum_threads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category        club_category NOT NULL,         -- 固定六大分類板
  discussion_tag  forum_tag NOT NULL,
  club_id         UUID NOT NULL REFERENCES clubs(id), -- 強制代表認證社團發言
  author_user_id  UUID NOT NULL REFERENCES users(id),
  author_title    TEXT,                           -- 選填幹部職稱
  title           TEXT NOT NULL,
  content_md      TEXT NOT NULL,
  media_urls      JSONB NOT NULL DEFAULT '[]'::jsonb,
  external_url    TEXT,
  status          forum_status NOT NULL DEFAULT 'published',
  reply_count     INTEGER NOT NULL DEFAULT 0,     -- 僅顯示討論串回覆則數，不用於跨帖熱門排行
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_forum_threads_cat_activity ON forum_threads(category, last_activity_at DESC)
  WHERE status = 'published';

CREATE TABLE forum_replies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id       UUID NOT NULL REFERENCES forum_threads(id) ON DELETE CASCADE,
  club_id         UUID NOT NULL REFERENCES clubs(id),
  author_user_id  UUID NOT NULL REFERENCES users(id),
  author_title    TEXT,
  content_md      TEXT NOT NULL,
  status          forum_status NOT NULL DEFAULT 'published',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_forum_replies_thread ON forum_replies(thread_id, created_at ASC)
  WHERE status = 'published';

-- 僅記錄個人「有幫助」標記與顯示去數值化肯定提示；嚴禁公開顯示具體總數或用於排序
CREATE TABLE forum_helpful_marks (
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reply_id    UUID NOT NULL REFERENCES forum_replies(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, reply_id)
);
```

#### 5. 治理、通知、稽核與匿名轉換事件

```sql
CREATE TABLE club_applications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type              application_type NOT NULL,    -- directory_claim / new_club / owner_takeover
  applicant_user_id UUID NOT NULL REFERENCES users(id),
  target_club_id    UUID REFERENCES clubs(id),    -- directory_claim 與 owner_takeover 必填
  -- new_club 時填寫下列申請資料
  proposed_university_id UUID REFERENCES universities(id),
  proposed_name     TEXT,
  proposed_slug     TEXT,                         -- new_club 必填：英數連字號格式 ^[a-z0-9][a-z0-9-]{2,48}[a-z0-9]$
  proposed_category club_category,
  evidence_text     TEXT NOT NULL,                -- 佐證說明（幹部名單、官方信箱、交接證明等）
  evidence_urls     JSONB NOT NULL DEFAULT '[]'::jsonb,
  status            application_status NOT NULL DEFAULT 'pending',
  reviewer_user_id  UUID REFERENCES users(id),
  review_note       TEXT,
  reviewed_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_applications_status ON club_applications(status, created_at ASC);
CREATE UNIQUE INDEX uq_pending_club_application
  ON club_applications(applicant_user_id, target_club_id)
  WHERE status = 'pending' AND target_club_id IS NOT NULL;
CREATE UNIQUE INDEX uq_pending_new_club_slug
  ON club_applications(proposed_slug)
  WHERE status = 'pending' AND proposed_slug IS NOT NULL;

CREATE TABLE reports (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id  UUID NOT NULL REFERENCES users(id),
  target_type       report_target_type NOT NULL,
  target_id         UUID NOT NULL,
  reason            report_reason NOT NULL,
  detail            TEXT,
  status            report_status NOT NULL DEFAULT 'open',
  handler_user_id   UUID REFERENCES users(id),
  resolution_note   TEXT,
  resolved_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_reports_status ON reports(status, created_at ASC);

CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,                      -- 'handover_invite' | 'handover_resolved' | 'application_result' | 'moderation_notice'
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  link_url    TEXT,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, created_at DESC) WHERE read_at IS NULL;

CREATE TABLE audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id   UUID REFERENCES users(id),
  action          TEXT NOT NULL,                  -- e.g. 'club.handover.accepted', 'club.takeover.approved', 'post.removed_by_admin'
  target_type     TEXT NOT NULL,
  target_id       UUID NOT NULL,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_target ON audit_logs(target_type, target_id, created_at DESC);

-- 匿名轉換事件表（零 PII：嚴禁存 user_id、IP、User-Agent；可直接匯出 CSV 接 Power BI）
CREATE TABLE analytics_events (
  id            BIGSERIAL PRIMARY KEY,
  event_type    analytics_event_type NOT NULL,
  university_id UUID REFERENCES universities(id),
  club_id       UUID REFERENCES clubs(id) ON DELETE SET NULL,
  post_id       UUID REFERENCES posts(id) ON DELETE SET NULL,
  category      club_category,
  source_surface TEXT,                            -- 'discover_topic' | 'discover_nl' | 'club_page' | 'forum'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_analytics_type_time ON analytics_events(event_type, created_at DESC);
```

---

## 4. 核心業務狀態機與原子交易規格

### 4.1 社團開頁與認證生命週期（`FR-GOV-01`）

```mermaid
stateDiagram-v2
    [*] --> unclaimed_directory : 匯入校方名錄 (NCU)
    [*] --> pending_review : 新設/他校社團申請 (new_club)
    unclaimed_directory --> verified : 管理員核准認領 (directory_claim)\n建立申請者為 Owner
    pending_review --> verified : 管理員核准開頁\n建立申請者為 Owner
    pending_review --> [*] : 管理員駁回（回饋原因，不公開建頁）
    verified --> suspended : 檢舉處置「暫停社團發文權限」
    suspended --> verified : 管理員解除停權
```

- **防重複認領與重名防撞規則**：
  - 送出 `directory_claim` 時，伺服器於 Transaction 內檢查 `clubs.verification_status === 'unclaimed_directory'` 且無現行 `owner`；若已有現任社長，回傳 `409 CLUB_ALREADY_CLAIMED`，前端引導改走「聯繫現任社長加為幹部」或「社長失聯接管申訴（`owner_takeover`）」。
  - 送出 `new_club` 時，必須驗證 `proposed_slug` 符合 `/^[a-z0-9][a-z0-9-]{2,48}[a-z0-9]$/`、非系統保留字（`apply`, `manage`, `admin`, `new`, `api`），且於 `clubs` 與 `pending` 申請中皆無重名 `(university_id, name)` 或重複 `slug`（否則回 `409 CLUB_NAME_OR_SLUG_TAKEN`）。
- **停權狀態（`suspended`）顯示與權限邊界**：
  - 社團處於 `suspended` 時，禁止新增／編輯貼文、參與機會與「一起聚」發文回覆（`403 CLUB_SUSPENDED`），且自「別的聚」探索推薦流自動排除；`/clubs/[slug]` 公開頁仍可開啟（維持既有外部連結可達並顯示非違規之已發布貼文），頁首顯示「此社團目前暫停發布與更新權限」橫幅，直到平台管理員透過 `PATCH /api/admin/clubs/[id]/status` 解除停權。

### 4.2 社長雙向確認換屆與失聯接管（`FR-MY-05`）

```mermaid
stateDiagram-v2
    [*] --> pending : 現任社長發起移交\n(expires_at = +7天，發站內通知)
    pending --> accepted : 受邀人點「接受交接」\n(單一 DB Transaction 完成角色切換)
    pending --> cancelled : 現任社長撤回邀請
    pending --> rejected : 受邀人婉拒邀請
    pending --> expired : 超過 7 天未確認（讀寫時惰性檢查）
```

- **惰性過期前置清理規則（防止唯一索引撞車）**：
  - 凡讀取待確認交接、發起新交接（`POST /api/clubs/[slug]/handovers`）或回應交接前，伺服器於 Transaction 內**優先執行**：
    `UPDATE club_handovers SET status = 'expired', resolved_at = now() WHERE club_id = $1 AND status = 'pending' AND expires_at <= now();`
    確保超過 7 天之過期邀請即時釋放 `uq_club_pending_handover` 唯一索引。
- **接受交接之原子交易（Atomic Transaction）**：
  1. 先執行上述過期清理，再鎖定 `club_handovers` 該筆紀錄（`SELECT ... FOR UPDATE`），驗證 `status = 'pending'`、`to_user_id = currentUser.id`、`expires_at > now()`，且受邀人仍為 `Verified Student`。
  2. 將原社長（`from_user_id`）現行 `club_memberships`（`ended_at IS NULL`）更新為 `role = 'alumni', ended_at = now()`（退出現役索引並保留歷屆成果彙整只讀權限）。
  3. 針對新社長（`to_user_id`）：若該社團已有 `ended_at IS NULL` 之幹部紀錄則直接更新為 `role = 'owner'`，否則插入新紀錄 `role = 'owner', ended_at = NULL`（完整保留歷屆成員軌跡且遵守 `uq_club_active_member`）。
  4. 更新 `club_handovers.status = 'accepted', resolved_at = now()`。
  5. 寫入 `audit_logs`（`club.handover.accepted`）並建立雙方 `notifications`。
- **防刪與復原規則**：
  - API 層不實作「批次刪除貼文」端點。
  - 現任社長刪除單篇貼文須帶 `confirm: true`（前端二次確認框），伺服器僅將 `posts.status` 改為 `'hidden_by_owner'`（軟下架，不執行實體 `DELETE`），使平台管理員必要時可透過 `PATCH /api/admin/posts/[id]/status` 檢視與復原。
- **失聯接管（`owner_takeover`）**：管理員核准 `club_applications(type='owner_takeover')` 時，於單一 Transaction 先把逾期 `pending` 交接設為 `expired`，將原社長（`role = 'owner' AND ended_at IS NULL`）轉為 `role = 'alumni', ended_at = now()`、申請人升為現行 `'owner'`（`ended_at = NULL`），並寫入不可刪除之 `audit_logs`。

### 4.3 先發後審與檢舉處置（`FR-GOV-02`）

```mermaid
stateDiagram-v2
    [*] --> open : 登入使用者提交檢舉
    open --> resolved_keep : 管理員判定保留
    open --> resolved_takedown : 管理員下架單篇內容\n(status='removed_by_admin')
    open --> resolved_suspend_club : 管理員暫停社團發文權限\n(club='suspended')
```

- 任一處置完成皆必須於同一 Transaction 寫入 `audit_logs`，且若涉及下架或停權，強制建立通知給該社團現任社長（`notifications.type = 'moderation_notice'`），載明原因與申訴窗口。

---

## 5. 前端路由與 REST API 契約規格

### 5.1 Next.js App Router 頁面架構

| 路由路徑 | 裝置優先 | 存取權限 | 核心內容 |
| --- | --- | --- | --- |
| `/` | Mobile-first | 公開 | **別的聚**：頂部白話需求探索欄（附 3–4 個範例提示按鈕）＋六大分類／興趣標籤篩選＋有限批次作品流（≤12 則）＋強制結尾卡（無無限捲動） |
| `/clubs/[slug]` | Mobile-first | 公開 | **我的聚（公開頁）**：社團識別區（含認證標章／示範標章、外部聯絡連結）、獨立「近期參與機會／招募」區、可篩選分類與學年度之成果貼文牆；未認領社團顯示認領入口 |
| `/posts/[id]` | Mobile-first | 公開 | 貼文詳情頁（多圖瀏覽、Markdown 內文、外部連結、私密收藏／分享／檢舉按鈕、1 點擊直達所屬社團主頁；**零公開按讚／收藏／觀看數**） |
| `/together` | Mobile-first | 公開唯讀 | **一起聚**：六大分類板切換＋討論串列表；認證社團幹部可見「代表社團發起討論」按鈕 |
| `/together/[threadId]` | Mobile-first | 公開唯讀 | 討論串詳情＋線性回覆串（作者標示「校名＋社團名」可點擊進社團頁、有幫助標記）；認證幹部可選社團身分回覆 |
| `/login` | Mobile-first | 公開 | 登入入口：Microsoft Entra ID / Google OAuth 按鈕；非正式環境且啟用 `ENABLE_DEV_LOGIN` 時顯示測試帳號快速切換面板 |
| `/me` | Mobile-first | Member+ | 個人中心：私密收藏清單、追蹤中社團、所屬社團管理入口、`.edu.tw` 校園驗證狀態、通知中心（含換屆邀請接受／婉拒按鈕） |
| `/clubs/[slug]/manage` | Desktop 優先（相容手機） | Editor / Owner | 社團管理後台：基本資料與聯絡連結編輯、參與機會管理、成果貼文列表（草稿／已發布）、新增貼文（含「零散紀錄快速整理」抽屜）、成員管理與換屆交接（Owner）、學年度成果總覽（Alumni 可唯讀） |
| `/clubs/[slug]/summary/[year]/print` | Print / A4 | Alumni / Editor / Owner / Admin | 專用列印版學年度成果彙整頁（`@media print` 優化排版＋「列印 / 另存 PDF」與「下載 Markdown」按鈕） |
| `/clubs/apply` | RWD | Verified Student | 名錄社團認領查詢／新社團開頁申請／社長失聯接管申訴表單 |
| `/admin` | Desktop 優先 | Platform Admin | 極簡治理後台：社團申請審核佇列、檢舉處置佇列、匿名轉換指標彙總與 CSV 匯出（供 Power BI 使用） |

### 5.2 標準 API 回應與錯誤格式

所有 `/api/*` 回傳 JSON，錯誤回應統一格式：

```json
{
  "error": {
    "code": "CAMPUS_VERIFICATION_REQUIRED",
    "message": "此操作須先完成大專校院 .edu.tw 校園信箱驗證。",
    "details": {}
  }
}
```

### 5.3 核心 API 端點規格表

> **RSC 與 API 資料邊界原則（YAGNI）**：各頁面首次載入所需之讀取清單（如 `/me` 收藏與通知、`/clubs/[slug]/manage` 草稿列表、`/posts/[id]` 詳情、`/clubs/[slug]/summary/[year]/print` 彙整）優先由 **Next.js Server Components（RSC）** 直接透過 Drizzle 查詢並套用同套個資序列化白名單，不額外重複撰寫純畫面用 `GET /api/*` 端點；下表集中列出供 Client 互動、篩選搜尋與寫入操作之 API。

#### 認證與個人中心

| Method & Path | 權限 | 請求重點 | 回應重點 / 關鍵錯誤碼 |
| --- | --- | --- | --- |
| `GET/POST /api/auth/[...nextauth]` | 公開 | Auth.js OAuth 流程（Microsoft Entra ID, Google） | 加密 JWT Session Cookie |
| `POST /api/me/campus-verify/request` | Member | `{ campus_email }` | 寄發 6 位數 OTP；`400 UNSUPPORTED_CAMPUS_DOMAIN`, `409 CAMPUS_EMAIL_IN_USE`, `429 RATE_LIMITED` |
| `POST /api/me/campus-verify/confirm` | Member | `{ campus_email, code }` | 升級為 Verified Student，回 `{ university_name, verified_at }`；`400 OTP_INVALID_OR_EXPIRED` |
| `GET /api/me` | Member | — | 個人狀態、所屬社團角色清單、未讀通知數 |
| `POST/DELETE /api/me/bookmarks/[postId]` | Member | — | 新增／移除私密收藏（冪等） |
| `POST/DELETE /api/me/follows/[clubId]` | Member | — | 追蹤／取消追蹤社團（冪等） |
| `PATCH /api/me/notifications/[id]/read` | Member | — | 標記單則通知已讀 |

#### 別的聚（探索）

| Method & Path | 權限 | 請求重點 | 回應重點 / 關鍵錯誤碼 |
| --- | --- | --- | --- |
| `GET /api/discover/feed` | 公開 | `?category=&tag=&university_id=` | 軌道 A：依時間新鮮度計算 `finalScore` 並經 `applyFairnessPolicy` 重排；回 `{ items: DiscoverCard[], batch_meta: { count, cap: 12, is_end_of_batch: true, suggested_categories } }`（嚴禁回傳任何虛榮計數） |
| `POST /api/discover/query` | 公開 | `{ query: string (2..300字), university_id? }` | `{ items: DiscoverCardWithReason[], degraded: boolean, warning_message?: string, batch_meta }`；單 IP 限流 15 req/min |

#### 我的聚（社團、貼文、換屆、匯出與 AI 整理）

| Method & Path | 權限 | 請求重點 | 回應重點 / 關鍵錯誤碼 |
| --- | --- | --- | --- |
| `GET /api/universities` | 公開 | — | 支援之大專校院清單（供 `/clubs/apply` 與篩選使用） |
| `GET /api/clubs/directory` | 公開 | `?q=&university_id=&status=` | 名錄與社團搜尋結果（支援未認領名錄認領查詢，不含個資） |
| `GET /api/clubs/[slug]` | 公開 | `?year=&post_type=` | 社團公開資料（含 `is_demo`、`verification_status`）、有效參與機會清單、已發布貼文列表 |
| `PATCH /api/clubs/[slug]` | Owner | 簡介、頭像／封面 URL、外部聯絡連結 | 更新後社團資料 |
| `POST/PATCH/DELETE /api/clubs/[slug]/opportunities`（另提供 `/opportunities/[opportunityId]`） | Editor / Owner | 標題、一句話說明、時間、截止日、外部連結 | 參與機會物件 |
| `POST /api/clubs/[slug]/posts` | Editor / Owner | 標題、分類、`academic_year`（預設 `getCurrentAcademicYear()`）、`summary`（省略時自動擷取去除 Markdown 之 `content_md` 前 140 字）、內文、標籤、圖片 URLs、`status`、`originality_confirmed` | 若 `status='published'` 且未勾授權回 `400 ORIGINALITY_REQUIRED`；發布成功同步/非同步產生 `embedding` |
| `PATCH /api/clubs/[slug]/posts/[postId]` | Editor / Owner | 貼文欄位更新（標題／內文／標籤異動時重算 `embedding`；`summary` 空值時自動補齊） | 更新後貼文 |
| `DELETE /api/clubs/[slug]/posts/[postId]` | Owner（或草稿作者） | `{ confirm: true }` | 軟下架為 `hidden_by_owner`；未帶 `confirm: true` 回 `400 CONFIRMATION_REQUIRED` |
| `POST /api/ai/draft-from-raw` | Editor / Owner | `multipart/form-data`（`raw_text` 或單一 `.pdf`/`.txt`/`.md` ≤ 4MB）＋ `club_id` | `{ draft: { title, post_type, summary, content_md, suggested_tags }, warnings?: string[] }`；掃描 PDF 回 `422 PDF_NO_EXTRACTABLE_TEXT` |
| `POST /api/media/sas` | Verified Student | `{ purpose: 'post_image'\|'club_avatar'\|'club_cover'\|'evidence', content_type: 'image/webp'\|'image/jpeg'\|'image/png', size_bytes, club_id? }` | `{ upload_url, blob_url, expires_at }`（5 分鐘短時效寫入 SAS；限單檔 ≤ 5MB） |
| `POST /api/clubs/[slug]/members` | Owner | `{ user_campus_email_or_id, role: 'editor', title? }` | 指派幹部（目標須為 Verified Student；未找到或未驗證統一回 `400 TARGET_NOT_ELIGIBLE` 防探測信箱） |
| `DELETE /api/clubs/[slug]/members` | Owner | `{ user_id, archive_as_alumni?: boolean }` | 移除幹部（`ended_at = now()`；若 `archive_as_alumni=true` 同步改 `role='alumni'` 保留歷屆彙整只讀權） |
| `POST /api/clubs/[slug]/handovers` | Owner | `{ to_user_id?, to_campus_email?, note? }`（擇一必填） | 先清理逾期邀請再建 7 天有效邀請＋通知受邀人；目標非 Verified Student 統一回 `400 TARGET_NOT_ELIGIBLE`；仍有有效 pending 回 `409 HANDOVER_ALREADY_PENDING` |
| `POST /api/handovers/[id]/respond` | 受邀人 / 原社長 | `{ action: 'accept' \| 'reject' \| 'cancel' }` | 原子交易切換 Owner (`ended_at = now(), role='alumni'`) ↔ 新 Owner＋寫入 `audit_logs` |
| `GET /api/clubs/[slug]/summary/[year]/export` | `requireClubSummaryAccess` | `?format=md` | 回傳 `Content-Type: text/markdown; charset=utf-8` 附件下載 |

#### 一起聚（跨校交流）

| Method & Path | 權限 | 請求重點 | 回應重點 / 關鍵錯誤碼 |
| --- | --- | --- | --- |
| `GET /api/forum/threads` | 公開 | `?category=academic&tag=&cursor=` | 依 `last_activity_at DESC` 分頁回傳（不含跨帖熱度排行） |
| `POST /api/forum/threads` | Verified Club Editor/Owner | `{ acting_club_id, category, discussion_tag, title, content_md, author_title?, media_urls?, external_url? }` | 伺服器驗證 `acting_club_id` 權限與 `verified` 狀態 |
| `GET /api/forum/threads/[id]` | 公開 | — | 討論串＋線性回覆串（含所屬校名、社名、slug；回覆僅含布林欄位 `marked_helpful_by_me` 與 `has_helpful_marks`，嚴禁輸出 `helpful_count` 數字） |
| `POST /api/forum/threads/[id]/replies` | Verified Club Editor/Owner | `{ acting_club_id, content_md, author_title? }` | 新增回覆並遞增 `reply_count`、更新 `last_activity_at` |
| `POST/DELETE /api/forum/replies/[id]/helpful` | Member | — | 標記／取消「有幫助的經驗」（前端僅顯示自身標記與非數值化肯定提示） |

#### 治理、檢舉與匿名轉換事件

| Method & Path | 權限 | 請求重點 | 回應重點 / 關鍵錯誤碼 |
| --- | --- | --- | --- |
| `POST /api/club-applications` | Verified Student | `{ type, target_club_id?, proposed_university_id?, proposed_name?, proposed_slug?, proposed_category?, evidence_text, evidence_urls }` | 提交名錄認領／新社團申請／失聯接管；重複認領回 `409 CLUB_ALREADY_CLAIMED`、重名或重複 slug 回 `409 CLUB_NAME_OR_SLUG_TAKEN` |
| `POST /api/reports` | Member | `{ target_type, target_id, reason, detail? }` | 建立檢舉紀錄 |
| `POST /api/events` | 公開 | `{ event_type, club_id?, post_id?, category?, source_surface? }` | 後端依 `club_id`/`post_id` 自動補齊 `university_id` 寫入 `analytics_events`（無 PII，回 `204`；單 IP 限流 60 req/min） |
| `GET /api/admin/applications` | Platform Admin | `?status=pending` | 申請審核佇列 |
| `POST /api/admin/applications/[id]/review` | Platform Admin | `{ action: 'approve'\|'reject', review_note }` | 核准同時原子開通社團／指派 Owner＋寫入稽核與通知 |
| `GET /api/admin/reports` | Platform Admin | `?status=open` | 檢舉處置佇列 |
| `POST /api/admin/reports/[id]/resolve` | Platform Admin | `{ resolution: 'keep'\|'takedown'\|'suspend_club', resolution_note }` | 處置內容／社團＋寫入稽核與通知社長 |
| `PATCH /api/admin/clubs/[id]/status` | Platform Admin | `{ action: 'unsuspend', note }` | 解除 `suspended` 恢復為 `verified`＋寫入稽核與通知社長 |
| `PATCH /api/admin/posts/[id]/status` | Platform Admin | `{ action: 'restore', note }` | 將 `hidden_by_owner` / `removed_by_admin` 復原為 `published`＋寫入稽核與通知社長 |
| `GET /api/admin/analytics/export` | Platform Admin | `?from=&to=&format=csv` | 匯出匿名轉換統計 CSV（直接對齊 Power BI 欄位） |

---

## 6. AI 管線、Prompt 契約與公平演算法規格

### 6.1 AI Provider 抽象層（支援 Azure OpenAI 與 OpenRouter / DeepSeek 切換）

為防止競賽期間 Azure 額度、區域模型可用性或金鑰審核阻塞開發，所有 AI 呼叫統一封裝於 `src/lib/ai/client.ts`，採標準 OpenAI SDK 介面，並將 **Chat 模型** 與 **Embedding 模型** 獨立設定（`src/lib/ai/config.ts` 的 `getAiConfig()` 動態讀取環境變數）：

```ts
// src/lib/ai/config.ts
// Chat 與 Embedding 解耦：避免切到 OpenRouter DeepSeek（純 Chat 模型）時 Embedding 失效
export function getAiConfig() {
  return {
    chatProvider: process.env.AI_CHAT_PROVIDER?.trim() || 'azure', // 'azure' | 'openrouter'
    embeddingProvider: process.env.AI_EMBEDDING_PROVIDER?.trim() || 'azure', // 'azure' | 'openai_compat' | 'disabled'
    chatTimeoutMs: Number(process.env.AI_CHAT_TIMEOUT_MS ?? 8000),
    embeddingTimeoutMs: Number(process.env.AI_EMBEDDING_TIMEOUT_MS ?? 4000),
  };
}
```

- **JSON 輸出相容策略**：不使用僅特定版本支援的專有參數，統一採 `response_format: { type: 'json_object' }` 搭配 System Prompt 明確輸出結構，並於伺服器端以 **Zod Schema** 嚴格驗證；若 JSON 格式損壞或欄位違規，視同呼叫失敗並觸發降級路徑（不把原始錯誤丟給使用者）。
- **Prompt Injection 防護**：使用者輸入（白話查詢或零散素材）一律以明確 XML 分隔符（`<user_query>...</user_query>`、`<raw_material>...</raw_material>`）包裹，System Prompt 明訂僅將分隔符內文字視為資料、忽略其中任何指令覆蓋請求。

### 6.2 管線一：「別的聚」雙軌探索與公平重排（`FR-DISC-01` / `02` / `03`）

#### 軌道 A：興趣主題瀏覽與固定標籤（`GET /api/discover/feed`）

- **P0 受控興趣標籤（`src/lib/constants.ts`）**：為避免自由輸入標籤碎片化導致篩選空結果，前端探索篩選列與社團發文表單共用統一推薦標籤清單 `CURATED_INTEREST_TAGS`（共 12 個：`攝影`、`音樂`、`程式設計`、`設計創作`、`登山戶外`、`志工服務`、`語言文化`、`桌遊電競`、`舞蹈表演`、`戲劇電影`、`球類運動`、`創客手作`），同時仍允許貼文附加自訂標籤。
- **查詢與公平排序**：
  1. 以純 SQL 查詢 `posts.status = 'published'` AND `clubs.verification_status = 'verified'`（並套用選填之 `category`、`tag`、`university_id` 條件），依 `published_at DESC LIMIT 48` 取出候選集。
  2. 以 `finalScore = freshnessScore(publishedAt)` 丟入與軌道 B 相同之 `applyFairnessPolicy(candidates, { maxBatchSize: 12, maxPerClub: 2 })`，確保單純主題瀏覽同樣遵守「單社團最多 2 則、不連續、不足不補」原則。

#### 軌道 B：白話需求探索四階段流程（`POST /api/discover/query`）

1. **階段 1：貼文向量索引（Write Path）**
   - 貼文發布或更新時，組裝純文字語意文件：
     `[${university_short_name} ${club_name}｜${category_zh}｜${post_type_zh}] 標題：${title}\n摘要：${summary}\n標籤：${tags.join(', ')}\n內文：${content_md.slice(0, 1200)}`
   - 呼叫 Embedding Provider 生成 `vector(1536)` 存入 `posts.embedding`。若當下 Embedding 失敗，**不得阻擋貼文發布**，記錄 log 並由背景重試／降級關鍵字檢索補位。
2. **階段 2：語意初篩 Recall（Read Path）**
   - 將 `query` 轉為向量，以 `pgvector` 查詢：
     - 條件：`posts.status = 'published'` AND `clubs.verification_status = 'verified'`（若指定 `university_id` 則加篩）。
     - 相似度門檻：`1 - (embedding <=> query_vec) >= 0.32`（`ponytail:` 門檻值於種子資料入庫後實測微調，上限取 `LIMIT 30`）。
   - 若 Embedding Provider 逾時或停用（`disabled`），直接降級走 PostgreSQL 關鍵字檢索（`title`、`summary`、`tags`、`clubs.name` 之 `ILIKE` / `pg_trgm`），並標記 `degraded = true`。
3. **階段 3：LLM 精篩與推薦理由生成**
   - 將 Top-K（最多 25 篇）精簡候選集送給 Chat 模型（`temperature: 0.2`，`AbortController` 逾時 **8,000 ms**；System Prompt 引導理由控制在 40 字內）。
   - **Zod 輸出契約**：
     ```ts
     const DiscoverLLMResponseSchema = z.object({
       recommendations: z.array(z.object({
         post_id: z.string().uuid(),
         relevance_score: z.number().int().min(0).max(100), // < 55 一律剔除
         reason: z.string().trim().min(4).max(120).transform((s) =>
           s.length > 48 ? `${s.slice(0, 45)}…` : s
         ), // 寬容接收後截斷，避免字數略超導致整批誤判失敗
       })),
     });
     ```
   - 嚴格白名單過濾：回傳的 `post_id` 必須存在於本次送出的候選集（防止幻覺捏造 ID），且 `relevance_score >= 55`。
4. **階段 4：確定性公平重排與克制截斷（`lib/discovery/fairness.ts`）**
   - **禁止依賴 LLM 遵守公平規則**，完全由下列可單元測試之演算法強制執行：
     ```ts
     // 綜合分（嚴禁引入任何追蹤數、收藏數、點擊數）
     // finalScore = 0.85 * relevanceScore + 0.15 * freshnessScore(publishedAt)
     // freshnessScore: 30天內 100 分，之後線性遞減至 365 天 30 分（保底 30 分，保留經典作品）

     export function applyFairnessPolicy<T extends { clubId: string; finalScore: number }>(
       candidates: T[],
       options = { maxBatchSize: 12, maxPerClub: 2 }
     ): T[] {
       const pool = [...candidates].sort((a, b) => b.finalScore - a.finalScore);
       const result: T[] = [];
       const clubCounts = new Map<string, number>();

       while (result.length < options.maxBatchSize && pool.length > 0) {
         const lastClubId = result.at(-1)?.clubId;
         // 優先挑選「未達單社團上限」且「不等於上一篇社團」之最高分項目
         let pickIdx = pool.findIndex(
           (item) => (clubCounts.get(item.clubId) ?? 0) < options.maxPerClub && item.clubId !== lastClubId
         );
         // 若剩餘項目全部同一個社團（無法避免連續），為遵守不連續規則直接停止，不硬湊數
         if (pickIdx === -1) break;

         const [picked] = pool.splice(pickIdx, 1);
         result.push(picked);
         clubCounts.set(picked.clubId, (clubCounts.get(picked.clubId) ?? 0) + 1);
       }
       return result; // 若僅 3 篇合格就回傳 3 篇，絕不補塞無關貼文
     }
     ```
   - **降級警告契約**：若階段 2 或階段 3 任一 AI 呼叫失敗／逾時／Zod 解析失敗，自動退回純向量或關鍵字候選集並執行相同 `applyFairnessPolicy()`，回傳：
     - `degraded: true`
     - `warning_message: "AI 語意推薦服務暫時忙碌，已自動切換為基礎檢索結果，推薦理由暫未顯示。"`
     - 前端必須在結果流頂部以醒目但不阻斷瀏覽之 Banner（Alert）呈現此警告。

### 6.3 管線二：「我的聚」零散紀錄快速整理（`FR-MY-03`）

- **輸入驗證**：
  - 純文字：`raw_text` 去除前後空白後須介於 20–12,000 字元。
  - 檔案上傳：僅接受 `.pdf`、`.txt`、`.md`，單檔上限 **4 MB**（安全低於 Vercel 4.5 MB Payload 限制）。
  - PDF 抽取：使用 `unpdf`（純 JS、無原生 Canvas 依賴，適用 Vercel Serverless）抽取純文字；若抽取結果 `< 30` 字元，判定為掃描圖檔並回傳 `422 PDF_NO_EXTRACTABLE_TEXT`（提示：「此 PDF 疑似為掃描圖片檔，系統無法讀取文字，請改直接貼上活動文案。」）。超過 12,000 字元自動截斷並於回應附帶 `warnings: ["素材過長，已截取前 12,000 字元進行整理"]`。
- **Zod 輸出契約**：
  ```ts
  const DraftFromRawSchema = z.object({
    title: z.string().min(4).max(60),
    post_type: z.enum(['work', 'event', 'workshop', 'competition']),
    summary: z.string().min(15).max(160),
    content_md: z.string().min(30).max(4000),
    suggested_tags: z.array(z.string().min(1).max(16)).max(5),
  });
  ```
- **人工把關強制約束**：此端點只回傳 JSON 草稿給前端表單預填，**絕不直接寫入 `published` 貼文**；幹部檢視微調並手動勾選 `originality_confirmed` 後，才走標準 `POST /api/clubs/[slug]/posts` 發布。若 AI 逾時（預設 12s）或失敗，明確提示錯誤並保留幹部已貼入之原始文字以便手動編輯，不清空表單。

---

## 7. 媒體儲存、學年度匯出與匿名轉換規格

### 7.1 圖片上傳規格（Vercel 4.5MB 避坑設計）

1. **限制**：單篇貼文最多 **6 張** 圖片；原始檔上限 5 MB；支援 JPG / PNG / WebP。
2. **前端壓縮**：選檔後先於瀏覽器端壓縮並縮放至最寬 `1920px`、格式轉 `image/webp`（品質 0.82，預期單張 < 400KB），同時去除 EXIF GPS 座標資訊（保護校園拍攝地點隱私）。
3. **短時效 SAS 直傳與渲染流程**：
   - 前端呼叫 `POST /api/media/sas`（驗證權限、MIME 白名單與大小）。
   - 後端生成唯一路徑（如 `posts/{club_id}/{uuid}.webp`）與 **5 分鐘有效、僅限 `Write/Create` 權限** 之 Azure Blob SAS URL 回傳。
   - 前端直接 `PUT` 至 Azure Blob Storage（不經過 Vercel Serverless Function Body，徹底規避 4.5 MB 上限；**須事先於 Azure Storage Account 設定 CORS，見 §8.4**）。
   - 儲存貼文時，後端驗證 `media_urls` 內所有 URL 僅允許自家設定之 `AZURE_STORAGE_PUBLIC_BASE_URL` 網域白名單，或專案內建示範素材靜態路徑 `/images/demo/*`（嚴禁路徑穿越與外部任意網址注入）。
   - 前端顯示直接使用標準 `<img>` 搭配 `loading="lazy"`（`ponytail:` 圖片已於上傳前壓縮為 < 400KB WebP，不透過 Next.js `<Image>` 代理以免耗盡 Vercel Image Optimization 免費額度）。

### 7.2 學年度成果彙整與匯出（`FR-MY-06`）

- **民國學年度預設公式**：統一由共用函式 `getCurrentAcademicYear(now = new Date())` 計算（轉為 `Asia/Taipei` 時區後，`rocYear = year - 1911`，`month >= 8 ? rocYear : rocYear - 1`；例如 `2026/11/25` → `115` 學年度），禁止寫死常數。
- **專用列印報告頁（`/clubs/[slug]/summary/[year]/print`）**：
  - Server Component 撈取該社團指定學年度（預設民國 `115` 學年度）所有 `status = 'published'` 貼文，依 `post_type`（作品／活動／社課／競賽展演）分組，呈現統計摘要（總篇數、各類篇數）與結構化清單（日期、標題、摘要、標籤、外部連結與精選縮圖）。
  - 採用獨立 `@media print` CSS：`@page { size: A4; margin: 16mm; }`、隱藏導覽列與按鈕、`break-inside: avoid` 避免單篇卡片被腰斬。使用者點擊「列印／另存 PDF」呼叫 `window.print()`，零後端記憶體負擔且原生支援繁體中文字型。
- **Markdown 下載（`GET /api/clubs/[slug]/summary/[year]/export?format=md`）**：
  - 伺服器組裝乾淨之 Markdown 文件（含社團基本資料、學年度、分組清單與公開連結），設定 `Content-Disposition: attachment; filename="clubar-{slug}-{year}.md"`，方便幹部貼入中大社團評鑑檔案。

### 7.3 匿名轉換追蹤與 Power BI 對接（`FR-MY-04`、第 7 章）

- **前端觸發時機**：
  - 探索卡片點擊進貼文或社團頁 → `discover_card_click`
  - 點擊社團外部聯絡連結（IG/FB/Email）→ `official_link_click`（使用 `navigator.sendBeacon` 避免跳轉中斷請求）
  - 點擊參與機會報名連結 → `opportunity_link_click`
  - 收藏／追蹤成功 → 由後端對應 API 順帶寫入 `post_bookmark` / `club_follow`（不記錄 `user_id`）。
- **Power BI CSV 匯出欄位**：`date, university_name, club_name, category, event_type, source_surface, event_count`（按日彙總輸出），賽前可直接匯入 Power BI Desktop 產出「中大單校社團探索轉換與活躍分布」示範圖表。

---

## 8. 非功能性需求、安全性與 Vercel / Supabase 避坑規範

### 8.1 效能與逾時目標

| 操作項目 | P95 目標延遲 | 硬逾時／降級策略 |
| --- | --- | --- |
| 公開頁首屏（`/`, `/clubs/[slug]`, `/together`） | ≤ 1.2 s | RSC + 輕量快取（`revalidate = 30` 或按需 `revalidatePath`） |
| 「別的聚」主題分類篩選（軌道 A） | ≤ 500 ms | 純 SQL 索引查詢 |
| 「別的聚」白話需求探索（軌道 B） | ≤ 4.5 s | Embedding 4s + LLM 8s 逾時；逾時觸發降級結果＋警告 Banner，總計必於 Vercel 函式硬逾時前完成 |
| 「我的聚」零散紀錄整理草稿 | ≤ 8.0 s | LLM 12s 逾時；失敗回錯誤提示並保留原始輸入 |

### 8.2 安全性檢核清單（必做底線）

1. **輸入驗證**：所有 API Body / Query 一律經 **Zod** 驗證；外部連結欄位（`external_links`、`external_url`）強制白名單協定僅允 `https:`、`http:` 或 `mailto:`（嚴禁 `javascript:`、`data:` 造成 XSS）。
2. **Markdown 渲染防 XSS**：所有 `content_md` 渲染使用 `react-markdown`（不啟用 `rehype-raw` 解析原始 HTML），或經 `rehype-sanitize` 消毒。
3. **API 限流（Rate Limiting）**：對高成本／敏感／公開寫入端點（`/api/discover/query`、`/api/ai/draft-from-raw`、`/api/me/campus-verify/request`、`/api/reports`、`/api/events`）實作速率限制。
   - `ponytail:` P0 可採輕量 Postgres 計數或記憶體滑動視窗（註：Vercel 多實例下記憶體限流非全域精準，已知上限約單機 100 RPS；P1 上線前升級 Upstash Redis Ratelimit）。
4. **CSRF 與 Cookie 安全**：Auth.js 預設啟用 `HttpOnly`、`SameSite=Lax`、`Secure`（Production）。
5. **資料庫連線池（Supabase + Vercel 關鍵坑位）**：
   - Runtime（`DATABASE_URL`）一律連線至 Supabase **Transaction Pooler（Port 6543）**（程式端 `postgres` 客戶端已強制傳入 `{ prepare: false }`），避免 Serverless 併發打爆 Postgres 連線上限。
   - Migration（`DIRECT_URL`）透過 `npm run db:migrate`（`scripts/migrate.ts` 執行 `drizzle/0000_init.sql` 並記錄 `_clubar_migrations`，自動讀取 `.env.local`）執行；連線至 Supabase Direct Port 5432 或 **Session Pooler Port 5432**（IPv4 網路環境建議使用 Session Pooler，含 `pgvector` HNSW 與 `pg_trgm` GIN 自訂索引請以 SQL Migration 管理，勿用 `drizzle-kit push` 覆蓋）。

### 8.3 環境變數清單（`.env.example` 契約）

```bash
# Database (Supabase: Runtime port 6543 with Transaction Pooler, Migration port 5432 Direct/Session)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/clubar"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/clubar"

# Auth.js & Bootstrap Admin
AUTH_SECRET=""
AUTH_URL="http://localhost:3000"
AUTH_MICROSOFT_ENTRA_ID_ID=""
AUTH_MICROSOFT_ENTRA_ID_SECRET=""
AUTH_MICROSOFT_ENTRA_ID_ISSUER="https://login.microsoftonline.com/common/v2.0"
AUTH_GOOGLE_ID=""
AUTH_GOOGLE_SECRET=""
OTP_HASH_PEPPER=""
ADMIN_EMAILS=""                     # 逗號分隔；登入時自動賦予 platform_admin

# Dev-only quick seeded-account login (MUST be false or omitted in production)
ENABLE_DEV_LOGIN="true"

# AI Layer (Azure OpenAI 預設 / OpenRouter DeepSeek 熱切換)
AI_CHAT_PROVIDER="azure"            # azure | openrouter
AI_EMBEDDING_PROVIDER="azure"       # azure | openai_compat | disabled
AI_CHAT_TIMEOUT_MS="8000"
AI_EMBEDDING_TIMEOUT_MS="4000"

AZURE_OPENAI_ENDPOINT=""
AZURE_OPENAI_API_KEY=""
AZURE_OPENAI_API_VERSION="2024-10-21"
AZURE_OPENAI_CHAT_DEPLOYMENT="gpt-4o-mini"
AZURE_OPENAI_EMBEDDING_DEPLOYMENT="text-embedding-3-small"

OPENROUTER_API_KEY=""
OPENROUTER_CHAT_MODEL="deepseek/deepseek-chat-v3-0324"

# Azure Blob Storage
AZURE_STORAGE_ACCOUNT_NAME=""
AZURE_STORAGE_ACCOUNT_KEY=""
AZURE_STORAGE_CONTAINER_NAME="clubar-media"
AZURE_STORAGE_PUBLIC_BASE_URL="https://<account>.blob.core.windows.net/clubar-media"

# Email (.edu.tw OTP)
EMAIL_PROVIDER="resend"             # resend | console (本機開發直接印出 OTP)
RESEND_API_KEY=""
EMAIL_FROM="noreply@clubar.example.com"
```

### 8.4 外部服務前置設定檢查（Infra & CORS Checklist）

| 服務 | 開工必備設定 | 未設定會導致的故障 |
| --- | --- | --- |
| **Supabase PostgreSQL** | 啟用 `vector` 與 `pg_trgm` Extension；取得 Port `6543` 與 `5432` 兩組連線字串 | Migration 失敗或 Serverless 連線數爆表 |
| **Azure Blob Storage** | 1. 建立公開可讀容器（Blob Public Access）<br>2. **設定 CORS**：Allowed Origins 含 `http://localhost:3000` 與 Vercel 網域、Allowed Methods 含 `PUT,OPTIONS`、Allowed Headers `*` | 瀏覽器直傳 `PUT` 報 CORS error 無法傳圖 |
| **Microsoft Entra ID** | 註冊 Multi-tenant（`common`）App，設定 Redirect URI `/api/auth/callback/microsoft-entra-id` | 微軟校園帳號登入卡死 |
| **Google OAuth** | 建立 OAuth Client，設定 Redirect URI `/api/auth/callback/google` | Google 登入失敗 |
| **AI / Email** | 開發初期可暫用 `OPENROUTER_API_KEY` + `EMAIL_PROVIDER="console"` 解耦 | 不受限 Azure 額度與網域 DNS 驗證即可開工 |

---

## 9. 種子資料與 P0 驗收測試清單

### 9.1 種子資料腳本規格（`scripts/seed.ts`）

為滿足 PRD 第 6 章與 12/30 Demo Day 展示需求，種子腳本必須具冪等性（可重複執行不重複建資料），至少包含：
- **學校名錄**：至少預載中央大學（`ncu.edu.tw`）及 5–10 所台灣指標大專校院（含跨校交流示範校，如臺科大 `ntust.edu.tw`、清大 `nthu.edu.tw` 等）。
- **示範角色與管理員**：至少預建 1 名 `platform_admin` 帳號（並搭配 `ADMIN_EMAILS`），以及各示範社團之 `owner`、`editor`、`alumni` 測試關聯資料。
- **社團覆蓋**：涵蓋台灣大專 **六大社團分類**（每類至少 2 個社團，合計 ≥ 12 個有貼文之活躍社團），外加至少 2 筆 `unclaimed_directory` 名錄社團（示範認領流程）；非真實合作社團一律設 `is_demo = true`。
- **成果貼文**：總計 ≥ 36 篇（實作預置 42 篇，涵蓋 114 與 115 學年度；若已設定 Embedding Provider 金鑰則一併寫入 `embedding`，未設定時保留 `null` 並由關鍵字降級檢索補位），確保任一白話查詢與六大分類篩選皆有足夠樣本可驗證公平排序與不洗版規則。
- **一起聚討論串**：至少 6 篇跨校討論串（含至少 2 所不同學校社團互回經驗）。

### 9.2 必過自動化檢查與 Demo Day 驗收測試

> **最低自動化檢查標準**：上線前至少須具備下列 5 項獨立可執行測試（本專案於 `tests/` 使用 Node 內建 `node:test` + `assert/strict` 實作前 4 項自動化測試，經 `npm test` 執行並自動讀取 `.env.local`）：

1. **公平重排單元測試（`fairness.test.ts`）**：
   - 輸入 10 篇全屬同一高產社團＋3 篇他社貼文，驗證輸出中單社團 ≤ 2 則、同一個社團絕不連續、不補塞低相關貼文。
   - 驗證輸入資料變更任何外部熱度數值不影響排序結果。
2. **AI 降級路徑測試（`discover-fallback.test.ts`）**：
   - 模擬 Chat 模型逾時與回傳非法 JSON，驗證 API 不拋 500、正常回傳降級結果且 `degraded === true` 與 `warning_message` 非空。
3. **跨屆雙向換屆整合測試（`handover.test.ts`）**：
   - 驗證接受交接後：新社長立即擁有編輯與成員管理權、原社長自動降為 `alumni` 且嘗試編輯／刪文回 `403`、既有貼文公開顯示完全不變、併發接受同一交接不產生雙社長。
4. **RBAC 與原創授權邊界測試（`authz.test.ts`）**：
   - 驗證一般登入學生嘗試於「一起聚」發文回 `403`；未勾選 `originality_confirmed` 發布貼文回 `400`；公開貼文與社團 API 回應物件深度掃描不含 `email`、`campus_email`、按讚數或追蹤總數欄位。
5. **Demo Day 4 條主路徑端對端手測（對應 PRD §6.2）**：
   - 路徑 A：未登入於手機寬度（390px）輸入白話查詢 → 見推薦理由卡片（無虛榮指標）→ 滑至底部見結尾卡 → 點進陌生社團頁。
   - 路徑 B：於社團頁看參與機會與歷屆成果 → 登入後私密收藏、追蹤、點擊官方聯絡連結（確認 `analytics_events` 寫入且無 PII）。
   - 路徑 C：幹部上傳／貼入零散活動紀錄 → 一鍵產出草稿 → 微調勾選原創授權發布 → 開啟 115 學年度成果列印頁另存 PDF ＋ 示範社長發起／接受雙向交接。
   - 路徑 D：認證幹部於「一起聚」切換社團身分發文／回覆 → 點擊他校社團名稱跳轉至其「我的聚」公開頁。

---

## 10. 已知簡化與 P1 / P2 演進對照（Intentional Simplifications）

| 模組 | P0 務實簡化方案 | 已知上限（Ceiling） | P1 / P2 升級路徑 |
| --- | --- | --- | --- |
| 語意檢索 | Supabase `pgvector` HNSW 索引 | 單表約 1–5 萬篇內表現良好，缺複雜多語詞法權重 | 接軌 **Azure AI Search**（BM25 + Vector 混合檢索） |
| 速率限制 | 輕量應用層／DB 計數 | Serverless 多實例非嚴格全域同步 | 導入 Upstash Redis Ratelimit |
| 評鑑報表 | `@media print` 另存 PDF ＋ Markdown | 依賴瀏覽器列印引擎，未套校方專屬 Word 表單 | P1 取得中大課外組官方範本後提供 DOCX/PDF 固定套表 |
| 數據儀表板 | `analytics_events` 匯出 CSV 手動匯入 Power BI | 非即時連動 | P1 校方管理者端直接內嵌 **Power BI Embedded** |
| 校園 SSO | Entra ID `common` + `.edu.tw` OTP | 需多一步收信（非微軟校園帳號） | P1 簽署校方合作後對接中大計中正式 SSO / 學務處名錄同步 |

---

## 11. P0 兩階段實作排程（2026/11/25 → 12/04 初審 → 12/30 Demo Day）

| 階段 | 時程 | 交付目標 | 實作範圍與切割原則 |
| --- | --- | --- | --- |
| **Milestone A（初審核心閉環）** | 11/25 – 12/03 | 12/04 初審 PPT＋可操作畫面／短片 | 1. 專案骨架＋Drizzle Schema/Migration＋`scripts/seed.ts`（含 42 篇貼文）<br>2. 簡化登入（先接單一 OAuth＋`EMAIL_PROVIDER="console"`＋`ENABLE_DEV_LOGIN` 測試帳號）<br>3. **別的聚**（`/`、`POST /api/discover/query`、`GET /api/discover/feed`、`/posts/[id]`）<br>4. **我的聚**公開頁（`/clubs/[slug]`）＋管理發文／AI 整理草稿（`/clubs/[slug]/manage`）<br>5. **一起聚**討論串（`/together`、`/together/[threadId]`） |
| **Milestone B（Demo Day 完整 P0）** | 12/05 – 12/30 | 12/30 全流程無阻現場 Demo | 1. 補齊雙 OAuth（Entra ID + Google）與 `.edu.tw` Resend OTP（程式碼已就緒，待設定雲端金鑰）<br>2. Azure Blob CORS + 前端壓縮 SAS 直傳（程式碼已就緒，待設定雲端 CORS）<br>3. 雙向確認換屆、`owner_takeover`、`/clubs/apply`、`/clubs/[slug]/summary/[year]/print` & `.md`（已完成）<br>4. `/admin` 審核／檢舉／解封與 Power BI CSV 匯出（已完成）<br>5. 完成 §9.2 全部 5 項自動化測試與 Demo Day 彩排（前 4 項自動化測試已建立，待接妥 AI 金鑰後執行 4 路徑手測彩排） |
