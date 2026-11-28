# Phase 0.1｜UX 稽核缺陷現況盤點（`D-01`–`D-17`，歷史快照）

> [!WARNING]
> **已棄置（DEPRECATED — Phase 0 歷史快照）**：本盤點為 2026-11-27 v1 改版前快照，已不代表最新程式碼與 v2.5 規範。最新設計規範請見 [../design/README.md](../design/README.md)。

> 盤點日期：2026-11-27｜依據：[ux-audit-and-benchmark.md](../ux-audit-and-benchmark.md) §四、§五，逐項比對目前程式碼與 `http://localhost:3000` 實機回應。

## 總覽矩陣

| ID | 摘要 | 狀態 | 證據 | 嚴重度(Sev) | 波次 |
| :--- | :--- | :--- | :--- | :---: | :---: |
| `D-01` | 首屏控制列過高、Prompt 堆疊、橫向捲軸裁切、`<select>` 歪斜 | `FIXED` | `DiscoverClient.tsx:73, 348-433` 範例改為輸入聚焦下拉且預設收合、隱藏手機分頁圖示與輔助按鈕；`globals.css:136-148` 與 `Chip.tsx:34-45` 以 `.no-scrollbar`＋`.scroll-fade-x` 隱藏捲軸；`Tabs` 與 `<select>` 皆為 `min-h-11` 對齊 | 4 | Wave 1 |
| `D-02` | 探索流等高 Grid 白洞與切頁無 Skeleton | `FIXED` | `DiscoverClient.tsx:496-502` 現場流改為 `columns-1 sm:columns-2 lg:columns-3`＋`break-inside-avoid`；`PostCard.tsx:23, 38` 依原比例渲染；`DiscoverClient.tsx:477-486` 補齊 6 欄 `Skeleton` 與精簡文案 | 3 | Wave 1 |
| `D-03` | 「有學習時數」寫死 `hours_type=life` 漏掉 `art`/`service` | `FIXED` | `DiscoverClient.tsx:157` 改送 `has_hours=true`；`events/route.ts:10-11, 44-45` 與 `service.ts:318-322` 查詢 `ne(learningHoursCategory, 'none')`；實機 `/api/discover/events?has_hours=true` 回傳 7 筆涵蓋 `life`/`art`/`service` | 4 | Wave 1 |
| `D-04` | Sticky 導覽列遮擋 Tab 焦點、Navbar 舊文案、登入缺 `callbackUrl` | `FIXED` | `globals.css:89-90, 122-123` 設定 `scroll-padding`/`scroll-margin`；`Navbar.tsx:47-53, 61-78, 126` 改為 `社團聚` 與 `我的聚`、加 `aria-current="page"` 並帶入 `callbackUrl`；實機 `/` 已無 `CluBar v2` 與 `我的社團` | 3 | Wave 1 |
| `D-05` | 活動頁 `###` 原碼外露、缺手機 Sticky CTA、`returnTo` 與假 Google 文案 | `FIXED` | `EventPageClient.tsx:554-558, 777-784, 816-821, 1423-1455` 使用 `MarkdownView`、新增行動版 Sticky 報名列、認證連結帶 `returnTo`，並依 `e/[shortCode]/page.tsx:46-56` 傳入之 `authProviders` 顯示登入文案；實機 `/e/ncu-dn-01` 無 `###` 與 `Google／微軟` | 4 | Wave 1 |
| `D-06` | 未認領社團誤顯「本週剛更新」、假 `example.com` 連結與斷尾空狀態 | `FIXED` | `clubs/[slug]/page.tsx:208-223, 254-268, 342-366` 未認領改顯示 `待認領`、過濾 `example.com` 外連並提供認領／回首頁空狀態卡；`ClubDetailClient.tsx:109-114` 帶 `returnTo`；實機 `/clubs/ncu-guitar` 顯示 `待認領` 且無 `本週剛更新` | 4 | Wave 1 |
| `D-07` | 活動海報混入現場流、`23:21` 不真實活動時間 | `FIXED` | `scripts/seed.ts:1016-1048, 1383-1557` 已移除 `dance-showcase-4x5.webp`、`astro-camp-4x5.webp` 並清除舊貼文，活動時間固定 `19:00`（台北）；實機 `/` 不含該兩張舊海報 | 3 | Wave 1 |
| `D-08` | `/together/[id]` 手機橫向溢出 `733px` | `FIXED` | `TogetherDetailClient.tsx:147, 154-160, 167, 173` 於外層、標題與 `接力回應自` 連結加上 `min-w-0`、`flex-wrap`、`break-words` 與 `[overflow-wrap:anywhere]` | 4 | Wave 2 |
| `D-09` | `/together` 空領域一片白、英文造詞難懂 | `PARTIAL` | `TogetherClient.tsx:425-437, 589-601, 786-798` 已補空領域狀態與 `查看全部領域` 按鈕，`TogetherDetailClient.tsx:221` 已去除「白名單」；但 `constants.ts:96`、`TogetherClient.tsx:194, 451, 486`、`TogetherDetailClient.tsx:132, 171` 仍留 `Rebound`／`Jam`，`MeClient.tsx:898` 仍留 `Alumni Ping` | 3 | Wave 2 |
| `D-10` | `/my-clubs` 兌換邀請碼要手動重整、造詞 `NRC`/`WIP` 未翻白話 | `FIXED` | `MyClubsClient.tsx:76-81` 兌換成功後呼叫 `router.refresh()` 並改為即時指引；`MyClubsClient.tsx:251, 281-282` 已改白話（註：`ClubManageClient.tsx:1130-1131` 仍保留 `WIP Work`／`NRC Moment`） | 3 | Wave 2 |
| `D-11` | AI 降級固定 `nrc_moment`、缺防行事曆／活動海報誤入現場流警告 | `PARTIAL` | `ClubManageClient.tsx:1061-1108` 與 `validators.ts:268-293` 在 AI 正常抽出欄位時會提示改入活動表單；但逾時降級時 `draft.ts:154-175` 仍寫死 `post_kind: 'nrc_moment'`、`poster_text_heavy: false` 與全 `null` 欄位，導致 `shouldRouteDraftToEvent` 恆為 `false`（且 `EVENT_INTENT_RE` 未含 `行事曆`/`社課表`） | 4 | Wave 2 |
| `D-12` | 交接核取方塊恆亮綠 `✓`、缺送出確認、6 分頁長頁需收合提示 | `PARTIAL` | `ClubManageClient.tsx:1686-1696` 已移除假綠 `✓`，`:638-648` 與 `:1643` 已補 `confirm()` 與信箱 `required`，活動表單改為 4 個 `<fieldset>`；但 6 分頁建立表單仍全數展開無收合機制，且交接 3 欄備忘未設必填或明確選填標示 | 4 | Wave 2 |
| `D-13` | `/me` 印出反引號、缺 `returnTo` 返回與空狀態 CTA、`/u/[handle]` 空 `(0)` | `PARTIAL` | `MeClient.tsx:385-419, 661-775` 與 `me/page.tsx:31, 235` 已移除反引號、支援 `returnTo` 返回鈕並補收藏／追蹤／社團 CTA，`u/[handle]/page.tsx:99-144` 已補 `EmptyState`；唯 `MeClient.tsx:600-601` 站內通知空狀態仍僅純文字無 CTA | 3 | Wave 2 |
| `D-14` | Onboarding 切 Step 3 不捲頂、選中色不一致、Blend 缺預覽與回探索按鈕 | `FIXED` | `OnboardingClient.tsx:39-64, 107-112, 228-259` 已統一 `<Choice>` 樣式並於切換時 `window.scrollTo` 捲頂；`BlendClient.tsx:112-114, 143-150` 已補 9:16 分享卡預覽與回探索按鈕 | 2 | Wave 2 |
| `D-15` | 全站互動熱區 `< 44×44 px` | `PARTIAL` | 共用元件 `Button`(`md`/`lg`)、`IconButton`、`FilterChip`、`Tabs`、`Input`/`Select`、`Dialog` 關閉鈕已達 `min-h-11`（`Button sm` 以 `after:-inset-1` 擴充點擊區）；但多處原生按鈕／連結／勾選框仍 `< 44px`（例：`DiscoverClient.tsx:331, 340`、`PostCard.tsx:75, 85`、`EventCard.tsx:81`、`MeClient.tsx:373, 503, 637, 953`、`ClubManageClient.tsx:1225, 1271`、`TogetherClient.tsx:716`、`AdminClient.tsx:376`、`ReportModal.tsx:93`） | 2 | Wave 2 |
| `D-16` | `/clubs/apply` 反引號與鎖定提示、`/login` 失敗遺失 `callbackUrl` 與長測試名單 | `FIXED` | `ClubApplyClient.tsx:140-150, 173` 已移除反引號、帶入 `returnTo=/clubs/apply` 並以 `Notice`＋`disabled` `<fieldset>` 鎖定表單；`login/page.tsx:72, 97, 128-187` 錯誤重導保留 `callbackUrl` 且以 `<details>` 折疊測試帳號 | 3 | Wave 3 |
| `D-17` | `/admin` 破壞性操作缺二次確認、行動版按鈕 `< 44px` | `PARTIAL` | `AdminClient.tsx:74-83, 108-115` 駁回／下架／停權已加 `confirm()`，佇列與檢舉按鈕已達 `44px`；但核准（`:73-102`）、解除停權（`:136-151`）、復原公開（`:153-168`）無確認，且 `解除停權`（`:376`）仍為 `px-3 py-1.5`（`< 44px`） | 3 | Wave 3 |

## 改版前必修（OPEN / PARTIAL 且 Sev ≥ 3）

1. **`D-11`（Sev 4 / Wave 2）**：補齊 AI 視覺解析逾時降級（`draft.ts` `buildFallbackDraft`）與關鍵字規則（`validators.ts` `EVENT_INTENT_RE` 納入行事曆／社課表等詞彙），避免活動海報在降級時無警告落入 `nrc_moment` 探索現場流（`AS-04`）。
2. **`D-12`（Sev 4 / Wave 2）**：為 `ClubManageClient` 6 分頁長表單（活動／發文／成員）補上可收合區塊或清楚進度／摺疊提示，並釐清交接備忘錄 3 個文字欄的必填／選填狀態。
3. **`D-09`（Sev 3 / Wave 2）**：清除 `TogetherClient`、`TogetherDetailClient`、`constants.ts` 殘留的 `Rebound`／`Jam` 與 `MeClient.tsx:898` 的 `Alumni Ping` 內部造詞，統一改為白話中文。
4. **`D-13`（Sev 3 / Wave 2）**：替 `MeClient.tsx:600-601` 站內通知空狀態補上導回探索或活動頁的 CTA 按鈕。
5. **`D-17`（Sev 3 / Wave 3）**：將 `AdminClient.tsx:376`「解除停權」按鈕補齊 `min-h-[44px]` 觸控高度，並評估為「核准申請／復原公開／解除停權」補上確認提示。
