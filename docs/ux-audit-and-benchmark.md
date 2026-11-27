# CluBar UI/UX 實機稽核、4 標竿對標與 ROI 改善規格書（Phase 1–2 Checkpoint Gate）

> **驗證範圍與誠實揭露（Evidence & Validity Statement）**：  
> - **實機瀏覽器雙視口走查（`390×844` 手機 ＋ `1440×900` 桌機）**：已完成 `/`, `近期可參加`, `/onboarding`, `/blend/Gdhzir3B`, `/posts/[id]`, `/clubs/ncu-gamedev`, `/clubs/ncu-guitar`（`U1`）, `/e/ncu-dn-01`, `/e/ncu-art-01`, `/e/ncu-ph-01`, `/login`, `/me`, `/u/xiaoming-ncu`, `/u/zien-dev`, `/my-clubs`, `/clubs/ncu-gamedev/manage`, `/together`, `/together/[id]`, `/clubs/apply`。  
> - **工具超時補證項目**：內建 `webview_browser` 於第 2 支稽核尾巴發生 `OP_TIMEOUT`，且雙分頁併發測試造成 Cookie 互相覆寫；因此 **`/admin`** 改以直接審查 [AdminClient.tsx](file:///c:/Users/alexl/Desktop/Programs/CluBar/src/components/AdminClient.tsx) 與 [admin/page.tsx](file:///c:/Users/alexl/Desktop/Programs/CluBar/src/app/admin/page.tsx) 補齊，**Vision AI 海報防呆（`U4`）** 與 **學習時數篩選（`hours_type`）** 改以 `npx tsx` 直接呼叫服務層函式取得真實回傳。  
> - **尚未進行真人試營運實測**：所有結論來自客觀 DOM 量測、故障注入與程式碼走查，尚待未來 5 人 Think Aloud 實測校準。

---

## 一、實機與程式碼稽核總覽（Phase 1 Evidence）

### 1.1 雙視口量化基線（`http://localhost:3000`）

| 頁面／視口 | 水平溢位（`scrollWidth - innerWidth`） | 首屏被控制區吃掉高度 | `< 44×44 px` 互動目標數 | 關鍵視覺與排版問題 |
| :--- | :--- | :--- | :--- | :--- |
| **`/`（`390×844`）** | `0px`（`body=375.2px`），但領域標籤條內部橫向溢出並顯示醜陋 Windows 捲軸裁切底線 | **`501.6px`（佔首屏 `59.4%`）**，第一張卡片從 `y=501.6px` 才開始 | **56 個**（Header `36px`、Tabs/Select/搜尋 `40px`、Prompt 膠囊 `26.1px`、卡片內文連結 `16–38.5px`） | `中央大學 ▼` `<select>` 下方出現多餘空白；4 條 Prompt 膠囊垂直堆疊佔滿半屏；`N` 浮標與底部導覽列局部遮疊。 |
| **`/`（`1440×900`）** | `0px`（`body=1424.8px`），領域標籤條仍顯示橫向捲軸裁切 `#語言與飲食` | 第一張卡片起點 `y=365.3px` | **48 個** | 3 欄均高 CSS Grid 使 `16:9` 寬卡底部拉出 **`~248px` 空洞**；實圖檢查發現 `dance-showcase-4x5.webp`（IG 三格切圖裁字）與 `astro-camp-4x5.webp`（報名開始海報）視覺上屬活動宣傳海報，與 `AS-04` 衝突。 |
| **`/onboarding`（`390×844`）** | `0px` | Step 2 正常 | Step 2 有 **15 個**（領域/氛圍 `40px`）、Step 3 活動連結 `16px` | Step 2 第 1 題橘框 vs 第 3 題藍框視覺不一致；進 Step 3 不自動捲回頂部；`/blend/[code]` 無分享圖卡預覽也無回探索動線。 |
| **`/e/[shortCode]`（`390×844`）** | `0px` | — | 報名鈕 `42px`、行事曆鈕 `30px`、投票鈕 `30px`、Push 連結 `16px` | `description_md` 直接印出原始 Markdown `### 社課資訊`（未用 `MarkdownView`）；未驗證校籍時「前往完成校園認證」連回 `/me` **遺失原活動 `callbackUrl`**；訪客鈕寫「Google／微軟登入」但 `/login` 未設定 Google。 |
| **`/clubs/ncu-guitar`（`U1` 冷啟動）** | `0px` | — | `申請認領社團` `32px`、外連 `34px` | 0 貼文未認領社團卻顯示綠燈 **`本週剛更新`**、導出假連結 `example.com/ncu-guitar`，底部突兀斷尾無空狀態引導。 |
| **`/my-clubs` & `/me` & `/u/[handle]`** | `0px` | — | `/my-clubs` **24–27 個**；`/me` **31–34 個**；`/u/` **1–22 個** | `/my-clubs` 邀請碼成功後叫人「手動重新整理」；`/me` 直接印出反引號 `` `.edu.tw` ``、空白收藏/追蹤無引導按鈕；`/u/xiaoming-ncu` 空白欄只寫 `(0)` 無說明。 |
| **`/clubs/ncu-gamedev/manage`** | `0px`（6 分頁全過） | — | **31–33 個**（Tab `40px`、輔助鈕 `28–34px`、Checkbox `13×13`） | AI 解析降級時（`熱舞社行事曆.png` 實測）預設 `post_kind: "nrc_moment"` 且與活動表單並列按鈕，**無防海報誤發現場流警告**；交接分頁未勾選去識別化卻固定顯示綠色 `✓`（`line 1558`），送出交接缺 `required` 與二次確認保護。 |
| **`/together` & `/together/[id]`** | **`/together/[id]` 手機溢出 `733px`（`maxRight=1123.2px`）** | — | `/together` **17–20 個**；詳情頁 **8 個** | `/together` 選到 0 筆領域（如 `#音樂展演`）時下方一片全白無提示；`/together/[id]` `接力回應自` 連結在手機未換行撐爆版面；充斥 `Rebound`、`Alumni Ping`、`開啟白名單作品連結` 黑話。 |
| **`/clubs/apply` & `/admin`** | `/clubs/apply` `0px`（`/admin` 程式碼審查） | — | `/clubs/apply` **9–12 個** | `/clubs/apply` 未驗證警告印出反引號 `` `.edu.tw` ``，送出按鈕 disabled 但全表單仍可自由輸入毫無提前鎖定提示；`/admin` 核准／下架／停權按鈕未見確認防護且行動版按鈕皆 `py-2`（`<44px`）。 |

---

### 1.2 七大非理想狀態（`U1–U7`）驗證矩陣

| 狀態編號 | 檢測結論 | 實證發現（含檔案位置） |
| :--- | :--- | :--- |
| **`U1` 空白冷啟動** | **未通過（多處斷鏈）** | • [clubs/[slug]/page.tsx](file:///c:/Users/alexl/Desktop/Programs/CluBar/src/app/clubs/%5Bslug%5D/page.tsx#L204-L206)：`unclaimed_directory`（`ncu-guitar`）0 貼文卻顯示綠燈「本週剛更新」，且底部無空狀態導引。<br>• [MeClient.tsx](file:///c:/Users/alexl/Desktop/Programs/CluBar/src/components/MeClient.tsx#L777-L856)：收藏、追蹤、通知空白狀態只有純文字，缺少前往 `/` 探索之 CTA。<br>• [u/[handle]/page.tsx](file:///c:/Users/alexl/Desktop/Programs/CluBar/src/app/u/%5Bhandle%5D/page.tsx#L103-L147)：空經歷只顯示 `(0)`，無說明。 |
| **`U2` 零結果與過度篩選** | **部分通過（有嚴重缺陷）** | • `/` 探索流搜尋 0 筆能 1 鍵重置；但 [DiscoverClient.tsx](file:///c:/Users/alexl/Desktop/Programs/CluBar/src/components/DiscoverClient.tsx#L164) 將「有學習時數」寫死為 `hours_type=life`（漏掉 `art` 與 `service`），且實測曾出現 HTTP 500 錯誤橫幅（單純呼叫 `getDiscoverEvents({ hoursType: 'life' })` 正常回傳 4 筆，研判為高併發池耗盡或組合查詢觸發）。<br>• [TogetherClient.tsx](file:///c:/Users/alexl/Desktop/Programs/CluBar/src/components/TogetherClient.tsx#L439)：`filteredItems` 為空時**完全空白**，無任何提示或重置鈕。 |
| **`U3` 載入與慢網等待** | **未通過** | [DiscoverClient.tsx](file:///c:/Users/alexl/Desktop/Programs/CluBar/src/components/DiscoverClient.tsx#L114-L179)：切換分頁、篩選或點擊「換下一批」時僅按鈕改字，卡片區**無 Skeleton 骨架屏**，舊卡片滯留直到畫面突兀替換；當總數僅 12 則時換下一批仍顯示相同前幾則造成「沒反應」體感。 |
| **`U4` AI 降級與貼文分流防呆** | **未通過（`AS-04` 漏洞）** | 以 `熱舞社行事曆.png` ＋ `"熱舞社 11 月社課行事曆"` 實測 `generateVisionOrRawDraft`：逾時降級保留原字與 `degraded: true`，但 [draft.ts](file:///c:/Users/alexl/Desktop/Programs/CluBar/src/lib/ai/draft.ts#L164) 固定填 `post_kind: 'nrc_moment'`，且 [ClubManageClient.tsx](file:///c:/Users/alexl/Desktop/Programs/CluBar/src/components/ClubManageClient.tsx#L1026-L1041) 並列提供「帶入作品／日常表單」，**缺少阻擋或提醒行事曆／活動海報勿進 `探索現場流` 的引導**。 |
| **`U5` 認證／驗證回跳接續** | **未通過** | • [EventPageClient.tsx](file:///c:/Users/alexl/Desktop/Programs/CluBar/src/components/EventPageClient.tsx#L799-L804)：未驗證校籍時「前往完成校園認證」直接跳 `/me`（**未帶 `callbackUrl`**），驗證完迷失在 `/me` 回不去原活動。<br>• [Navbar.tsx](file:///c:/Users/alexl/Desktop/Programs/CluBar/src/components/Navbar.tsx#L127-L133)：右上角與底部「登入」按鈕未帶當前頁面 `callbackUrl`。<br>• [login/page.tsx](file:///c:/Users/alexl/Desktop/Programs/CluBar/src/app/login/page.tsx#L160)：`DevLoginFailed` 重導向遺失 `callbackUrl`；活動頁寫「Google／微軟登入」與實際 OAuth 設定不一致。 |
| **`U6` 破壞性操作與防呆** | **未通過** | • [ClubManageClient.tsx](file:///c:/Users/alexl/Desktop/Programs/CluBar/src/components/ClubManageClient.tsx#L1552-L1567)：交接同意書未勾選卻恆亮綠色 `✓`（`line 1558`），且送出交接／`/admin` 停權與下架皆無二次確認。<br>• [MyClubsClient.tsx](file:///c:/Users/alexl/Desktop/Programs/CluBar/src/components/MyClubsClient.tsx#L68-L70)：兌換邀請碼後叫使用者「請重新整理頁面」，未呼叫 `router.refresh()`。 |
| **`U7` 溢出、熱區、Markdown 與 WCAG 2.2** | **未通過（多項指標超標）** | • `/together/[id]` 手機橫向溢出 **`733px`**（`TogetherDetailClient.tsx#L140` 未斷行）。<br>• 桌機 `Tab` 焦點 4 度被 `64.8px` Sticky Header 遮擋；手機卡片連結延伸進 `57px` 底部導覽列後方（缺 `scroll-margin`）。<br>• 全站幾乎所有輔助膠囊／連結高度落在 `16–40px`，遠低於 `NFR-USAB-01`（`≥ 44×44 px`）。<br>• [EventPageClient.tsx](file:///c:/Users/alexl/Desktop/Programs/CluBar/src/components/EventPageClient.tsx#L764)、[MeClient.tsx](file:///c:/Users/alexl/Desktop/Programs/CluBar/src/components/MeClient.tsx#L397)、[ClubApplyClient.tsx](file:///c:/Users/alexl/Desktop/Programs/CluBar/src/components/ClubApplyClient.tsx#L133) 直接印出原始 `###` 與 `` ` `` 字元。 |

---

### 1.3 實務跨系統維度評估

- **Frontstage × Backstage 平衡**：前台為了降低學生焦慮需要「費用、零基礎、非社員、時間地點」，目前全由 [ClubManageClient.tsx](file:///c:/Users/alexl/Desktop/Programs/CluBar/src/components/ClubManageClient.tsx#L734-L923) 超過 20 個欄位平鋪承受，且分頁與活動列表、AI 抽欄位分成 6 個長分頁，缺少「海報／文字貼上一鍵流向活動表單並自動標出缺漏欄位」的滑順銜接。
- **時間維度（Day 1 / Day 90 / Day 365）**：
  - *Day 1*：首屏 59.4% 被控制列與 4 條冗長 Prompt 佔滿，加上系統造詞過多，新訪客需要極高注意力才能開始探索。
  - *Day 90*：社員在 `/my-clubs` 發文無法直覺看到最新發出去的結果與快速編輯；`/me` 的工具設定（行事曆訂閱、推播、足跡網址）混在同一長頁。
  - *Day 365*：評鑑匯出與 3 步交接雖然已經做進後台分頁，但「避雷便條」未做防誤觸保護且有假勾選符號，容易讓倦怠期幹部誤送出或不敢勾。

---

## 二、4 主力標竿任務對標矩陣（Phase 2 Benchmark）

依 **NN/g Competitive Usability Evaluations** 與 **Jakob's Law**，鎖定 **4 個主力標竿**（外加 `Partiful` 僅對照兩項局部活動互動）：

| CluBar 任務群組 | 對標標竿 | 標竿為何有效（我們要採納的通用慣例） | 明確剔除的反模式 | CluBar 差異化落點 |
| :--- | :--- | :--- | :--- | :--- |
| **1. `別的聚` 視覺探索流** | **Cosmos.so** | • **真 Masonry 瀑布流**（CSS `columns` 或多欄瀑布）依原圖自然高度緊密排列，徹底消滅 CSS Grid 橫圖卡片底下的 `248px` 白洞。<br>• **極簡來源識別**：卡片僅留原比例圖＋一句重點＋「學校 · 社團＋脈搏點」，移除雜訊標籤與分數。 | 剔除讚數、收藏數、瀏覽數、演算法爆款推播（`AS-02`）。 | 「單批 ≤ 12 則、單社團 ≤ 2 則、不連發」公平露出機制 ＋ 底部單行活動門牌導流。 |
| **2. `別的聚` 行動搜尋與篩選** | **Airbnb** | • **首屏高度克制**：把雙分頁＋搜尋膠囊＋單列橫向類別壓縮，隱藏原生捲軸醜邊、把範例提示與多層篩選收進可展開抽屜／切換條，讓 `390×844` 首屏至少露出 **1.2 張內容卡片**。<br>• **零結果防死路**：清楚標示目前啟用的條件標籤＋一鍵清除所有條件。 | 剔除一進站就把 6 層工具牆全攤開壓垮首屏、或無結果不交代原因。 | 相容自然語言白話搜尋與 AI 失敗無痛降級（`degraded` 提示 Banner）。 |
| **3. `我的聚` 門面與活動 RSVP** | **Luma**<br>（＋ **Partiful** 局部：投票喬時間 & 活動後相簿） | • **Luma 式頁面層級與狀態切換**：活動頁上方呈現核心時間／地點／門檻安檢與 **行動版 Sticky 主行動鈕**；報名後主按鈕切換為「管理報名／加行事曆／現場提醒」。Markdown 內文正常排版渲染。<br>• **Partiful 局部互動**：`TBD`/投票喬時間無壓單鍵表態、活動後免裝 App 網頁相簿收集。 | 剔除強制 App 下載、簡訊驗證與計數 Boops 貼紙（`AS-02`, `AS-06`, `AS-07`）。 | 兩段式名單隱私自選（「讓同場參加者看見我」vs「完全匿名僅計總數」）。 |
| **4. `我的聚` 管理端 × `一起聚` 共創** | **Linear** | • **漸進揭露與即時狀態同步**：工作區分區聚焦、長列表收合與清楚群組；編輯／兌換邀請碼／審核完成立即更新狀態（`router.refresh()` + 樂觀反饋），絕不叫使用者手動 F5。<br>• **不可逆安全網（Good Friction）**：交接、停權、下架前給清晰確認與正確 Checkbox 狀態顯示。 | 剔除無確認破壞性按鈕、未勾選卻顯示綠色打勾的錯誤視覺回饋。 | AI 海報抽取自動偵測活動性質並導流至 `建立活動`，防堵海報污染日常探索流（`AS-04`）。 |

---

## 三、Smart Brevity 全站微文案翻新對照表

> 嚴格遵守 [smart-brevity](file:///C:/Users/alexl/.gemini/config/skills/smart-brevity/SKILL.md)：**保留 `別的聚`、`一起聚`、`我的聚` 原詞**；其餘全面執行「篩選不濃縮」「消滅內部造詞」「結論先講」「不設死板字數上限」。

| 頁面／位置 | 現有文案（問題：造詞／重複／原生語法外露） | Smart Brevity 改寫版（人話＋單一判斷＋下一步） |
| :--- | :--- | :--- |
| [Navbar.tsx](file:///c:/Users/alexl/Desktop/Programs/CluBar/src/components/Navbar.tsx#L55-L89) | `CluBar v2` ／ 導覽寫 `我的社團` | 副標改 `CluBar`（拿掉 `v2`）；導覽統一改 **`我的聚`**（與三聚命名一致） |
| [DiscoverClient.tsx](file:///c:/Users/alexl/Desktop/Programs/CluBar/src/components/DiscoverClient.tsx#L280-L365) | `30 秒免註冊測出你的校園興趣 Blend`、`開始適性破冰`、`興趣 Blend`、`TBD 喬時間中` | **`30 秒挑出適合你的社團`**（副標：「選學校和偏好，直接看對應社團與體驗課。」）<br>按鈕：**`開始挑選`** ／ 頂部入口：**`興趣測驗`** ／ 篩選晶片：**`時間投票中`** |
| [DiscoverClient.tsx](file:///c:/Users/alexl/Desktop/Programs/CluBar/src/components/DiscoverClient.tsx#L550-L556) | `本批次呈現 12 則（單社團最多 2 則・不連發・零讚粉排行）逛累了可直接切換分頁看活動，或約朋友測一場雙人興趣 Blend。` | **`已看 12 則，每個社團最多顯示 2 則、不依讚數排序`**<br>副標：**`換下一批，或去「近期可參加」挑體驗活動。`** |
| [OnboardingClient.tsx](file:///c:/Users/alexl/Desktop/Programs/CluBar/src/components/OnboardingClient.tsx#L140) & [BlendClient.tsx](file:///c:/Users/alexl/Desktop/Programs/CluBar/src/components/BlendClient.tsx#L72) | `免登入適性破冰（步驟 1 / 3）`、`CluBar 校園興趣 Blend`、`邀朋友 Blend` | **`找社團小測驗（步驟 1 / 3）`**<br>**`社團品味合拍邀請`** ／ 按鈕：**`生成好友合拍圖卡`** |
| [MyClubsClient.tsx](file:///c:/Users/alexl/Desktop/Programs/CluBar/src/components/MyClubsClient.tsx#L67-L69) & `#L249` | `重新整理即可發文記錄日常`、`1-Step 記錄社團日常 (NRC)`、`實作成果／作品 (WIP Work)` | **`加入成功！現在就能選擇社團發文。`**（系統自動刷新）<br>**`發一則社團日常`** ／ 選項：**`社員日常照片或短影`**、**`作品與社課成果`** |
| [TogetherClient.tsx](file:///c:/Users/alexl/Desktop/Programs/CluBar/src/components/TogetherClient.tsx#L280-L289) & [TogetherDetailClient.tsx](file:///c:/Users/alexl/Desktop/Programs/CluBar/src/components/TogetherDetailClient.tsx#L183) | `作品試玩與 Rebound`、`跨校共作 Jam`、`開啟白名單作品連結`、`Rebound 接力衍生牆` | **`作品展示與接力創作`**、**`跨校合辦募集`**、**`請益學長姐與避雷筆記`**<br>按鈕：**`開啟外部作品試玩`**、區塊：**`他校接力延伸作品`** |
| [MeClient.tsx](file:///c:/Users/alexl/Desktop/Programs/CluBar/src/components/MeClient.tsx#L397-L400) & [u/[handle]/page.tsx](file:///c:/Users/alexl/Desktop/Programs/CluBar/src/app/u/%5Bhandle%5D/page.tsx#L68) | ``驗證大專校院 `.edu.tw`...``、`實質歷練 1D Portfolio`、`尚未收藏任何作品...`（無按鈕） | **`驗證學校信箱（.edu.tw）`**（去除反引號，保留清楚理由：「解鎖發問、社員身分與幹部管理；信箱絕不公開。」）<br>**`大學社團參與紀錄 wall`**（或 **`個人社團紀錄`**）＋ 空狀態補 **`去別的聚逛逛 →`** 按鈕 |
| [ClubDetailClient.tsx](file:///c:/Users/alexl/Desktop/Programs/CluBar/src/app/clubs/%5Bslug%5D/page.tsx#L154-L164) | 0 貼文未認領社團寫 `本週剛更新`＋`校方名錄預載社團...` | 未認領社團拿掉「本週剛更新」，改標 **`待認領校方名錄`**；空狀態直白說明：**`這個社團還沒建立主頁。你是幹部嗎？認領後即可放上活動與作品。`** |

---

## 四、ROI 計分與 Wave 1 / Wave 2 / Wave 3 缺陷待辦清單

$$\text{ROI Score} = \frac{\text{Funnel Reach (1–3)} \times \text{Severity (1–4)} \times \text{Retention/Supply Leverage (1–2)}}{\text{Effort (S=1, M=2, L=3)}}$$

| ID | 頁面／元件 | 缺陷摘要（含對應 U1–U7／Heuristic） | Reach | Sev | Lev | Eff | ROI | 波次 |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **`D-01`** | `DiscoverClient` / `PostCard` | 首屏控制列吃掉 59.4%（`501.6px`）、Prompt 堆 4 行、橫向捲軸裁切 `#語言與飲食`、`central` select 歪斜（H#8 + `U7`） | 3 | 4 | 2 | 2 | **12.0** | **Wave 1** |
| **`D-02`** | `DiscoverClient` / `PostCard` | CSS Grid 拉出 `~248px` 白洞；應改自然瀑布流（CSS `columns`）＋補齊切頁 Skeleton 佔位（`U3` + `CLS`） | 3 | 3 | 2 | 2 | **9.0** | **Wave 1** |
| **`D-03`** | `DiscoverClient` + `events/route.ts` | 「有學習時數」寫死 `hours_type=life` 漏掉 `art`/`service`，並於 `service.ts` 補支援 `has_hours=true`（`U2`） | 3 | 4 | 1 | 1 | **12.0** | **Wave 1** |
| **`D-04`** | `globals.css` / `Navbar` | `Tab` 焦點被 `64.8px` header 與 `57px` 底部導覽遮擋；`Navbar` 寫 `我的社團` 與 `CluBar v2`；未帶 `callbackUrl`（`U5`+`U7`） | 3 | 3 | 2 | 1 | **18.0** | **Wave 1** |
| **`D-05`** | `EventPageClient` | `description_md` 未用 `MarkdownView` 印出 `###`；缺行動 Sticky CTA；`前往完成校園認證` 遺失 `callbackUrl`；未設 Google OAuth 卻宣稱支援（`U5`+`U7`） | 3 | 4 | 2 | 2 | **12.0** | **Wave 1** |
| **`D-06`** | `clubs/[slug]/page.tsx` | 未認領社團（`ncu-guitar`）顯示綠燈「本週剛更新」、假連結與斷尾空狀態（`U1` + 可信度） | 2 | 4 | 2 | 1 | **16.0** | **Wave 1** |
| **`D-07`** | `scripts/seed.ts` | `dance-showcase-4x5.webp`（切圖裁字）與 `astro-camp-4x5.webp`（報名海報）混入 `探索現場流` 違反 `AS-04` 視覺原則；活動時間顯示 `23:21` 不真實 | 3 | 3 | 2 | 1 | **18.0** | **Wave 1** |
| **`D-08`** | `TogetherDetailClient` | `/together/[id]` 手機橫向溢出 **`733px`**（`接力回應自` 連結未斷行）（`U7` P0 破版） | 2 | 4 | 1 | 1 | **8.0** | **Wave 2** |
| **`D-09`** | `TogetherClient` | `/together` 空領域顯示全白無提示／重置鈕（`U2`）；英文造詞（`Rebound`/`Jam`/`Alumni Ping`）難懂（H#2） | 2 | 3 | 2 | 1 | **12.0** | **Wave 2** |
| **`D-10`** | `MyClubsClient` | 兌換邀請碼後要人手動重新整理，未自動 `router.refresh()`；造詞 `NRC`/`WIP` 未翻白話 | 2 | 3 | 2 | 1 | **12.0** | **Wave 2** |
| **`D-11`** | `ClubManageClient` + `draft.ts` | AI 降級固定設 `post_kind: 'nrc_moment'` 且與活動按鈕並列，無防行事曆／活動海報誤入現場流警告（`U4` + `AS-04`） | 2 | 4 | 2 | 2 | **8.0** | **Wave 2** |
| **`D-12`** | `ClubManageClient` | 交接核取方塊未勾選卻恆亮綠色 `✓`（`line 1558`）；缺送出確認安全網；6 分頁長頁需更清楚收合提示（`U6`） | 2 | 4 | 2 | 2 | **8.0** | **Wave 2** |
| **`D-13`** | `MeClient` + `u/[handle]` | `/me` 印出原始 `` `.edu.tw` ``、支援從活動頁帶入 `returnTo` 回跳按鈕、空白收藏/追蹤補 CTA；`/u/[handle]` 空 `(0)` 補引導（`U1`+`U5`+`U7`） | 2 | 3 | 2 | 2 | **6.0** | **Wave 2** |
| **`D-14`** | `OnboardingClient` / `BlendClient` | Step 3 不捲回頂部、Step 2 選中色不一致（橘 vs 藍）；Blend 頁缺圖卡預覽與回到探索按鈕 | 2 | 2 | 2 | 1 | **8.0** | **Wave 2** |
| **`D-15`** | 全站互動元件 | 全面拉高關鍵按鈕／晶片／連結熱區至 **`≥ 44×44 px`**（解決首頁 56 個、管理頁 33 個、活動頁多處小熱區）（`U7` / `NFR-USAB-01`） | 3 | 2 | 2 | 2 | **6.0** | **Wave 2** |
| **`D-16`** | `ClubApplyClient` / `login` | `/clubs/apply` 印出 `` `.edu.tw` ``、未驗證時表單無鎖定引導；`/login` 失敗重導遺失 `callbackUrl` 與長測試名單收斂（`U5`+`U6`） | 1 | 3 | 1 | 1 | **3.0** | **Wave 3** |
| **`D-17`** | `AdminClient` | 核准／駁回／下架／停權補齊不可逆二次確認（`U6`）與行動版熱區 `≥ 44px`（`U7`） | 1 | 3 | 1 | 1 | **3.0** | **Wave 3** |

---

## 五、實證版 Phase 3 修改檔案規格（Checkpoint Gate）

待核准 Phase 3 后，嚴格依 **Wave 1 → Wave 2 → Wave 3** 修改以下已確認之檔案（不新增肥大套件）：

### Wave 1（首屏降噪、瀑布流、核心轉換與 `AS-04` 修正）
1. **[globals.css](file:///c:/Users/alexl/Desktop/Programs/CluBar/src/app/globals.css)**（`D-04`, `D-01`）：補齊 `html, body { scroll-padding-top: 5rem; scroll-padding-bottom: 5rem; }` 與 `.no-scrollbar` 隱藏橫向晶片條醜陋滾動條並保留滑動；確保 `:focus-visible` 不被 Sticky Navbar 遮擋。
2. **[Navbar.tsx](file:///c:/Users/alexl/Desktop/Programs/CluBar/src/components/Navbar.tsx)**（`D-04`）：移除 `CluBar v2` 字樣；桌機與手機底部導覽「`我的社團`」統一為「`我的聚`」；補齊 `aria-current="page"`；「登入」連結帶入當前 `pathname` 作為 `callbackUrl`。
3. **[DiscoverClient.tsx](file:///c:/Users/alexl/Desktop/Programs/CluBar/src/components/DiscoverClient.tsx)** + **[events/route.ts](file:///c:/Users/alexl/Desktop/Programs/CluBar/src/app/api/discover/events/route.ts)** + **[service.ts](file:///c:/Users/alexl/Desktop/Programs/CluBar/src/lib/discovery/service.ts)**（`D-01`, `D-02`, `D-03`, `D-15`）：
   - 壓縮頂部控制列（合併提示膠囊為可收合單行「不知道怎麼搜？試試問一句」、修正 `<select>` 高度對齊與無捲軸晶片條、將首頁預設收攏讓手機 `390×844` 首屏露出卡片）。
   - `探索現場流` 從均高 Grid 改為 CSS `columns-1 sm:columns-2 lg:columns-3` 搭配 `break-inside-avoid`（消除 248px 白洞並保持原生比例）。
   - 加入載入中 Skeleton 骨架屏佔位（`U3`），並於「有學習時數」改送 `has_hours=true`（對應全部 `art`/`life`/`service` 非 `'none'` 活動）。
   - 套用 Smart Brevity 改寫 Onboarding 邀請與分頁文案。
4. **[PostCard.tsx](file:///c:/Users/alexl/Desktop/Programs/CluBar/src/components/PostCard.tsx)** & **[EventCard.tsx](file:///c:/Users/alexl/Desktop/Programs/CluBar/src/components/EventCard.tsx)**（`D-02`, `D-15`）：確保卡片熱區、間距、觸控高度與視覺對齊一致（`≥ 44px` 互動目標）。
5. **[EventPageClient.tsx](file:///c:/Users/alexl/Desktop/Programs/CluBar/src/components/EventPageClient.tsx)** + **[e/[shortCode]/page.tsx](file:///c:/Users/alexl/Desktop/Programs/CluBar/src/app/e/%5BshortCode%5D/page.tsx)**（`D-05`, `D-15`）：
   - 以 `MarkdownView` 取代純文字渲染 `detail.description_md`（修復 `###` 原碼外露）。
   - 新增手機版 Sticky Bottom 報名 CTA 條（Luma 風格）。
   - 「前往完成校園認證」連結帶入 `/me?returnTo=/e/${detail.short_code}`（`U5`）。
   - 依伺服器實際設定傳入 `authProviders` 旗標，動態正確顯示登入按鈕文案（不宣稱未啟用之 OAuth）。
6. **[clubs/[slug]/page.tsx](file:///c:/Users/alexl/Desktop/Programs/CluBar/src/app/clubs/%5Bslug%5D/page.tsx)** + **[ClubDetailClient.tsx](file:///c:/Users/alexl/Desktop/Programs/CluBar/src/components/ClubDetailClient.tsx)**（`D-06`, `D-15`）：`unclaimed_directory` 社團隱藏「本週剛更新」假綠燈、過濾假示範外連、補上具引導行動之空白狀態卡片，並加上 `returnTo` 驗證帶回。
7. **[scripts/seed.ts](file:///c:/Users/alexl/Desktop/Programs/CluBar/scripts/seed.ts)**（`D-07`）：將誤入 `探索現場流` 的海報類圖（`dance-showcase-4x5.webp` 切圖與 `astro-camp-4x5.webp` 報名海報）換成純現場照片／作品圖，並將活動示範時間固定為合理社課晚間時段（例如 `19:00`）。

### Wave 2（供給減負、AI 防呆分流、跨校溢出修復與回跳接續）
8. **[TogetherDetailClient.tsx](file:///c:/Users/alexl/Desktop/Programs/CluBar/src/components/TogetherDetailClient.tsx)** & **[TogetherClient.tsx](file:///c:/Users/alexl/Desktop/Programs/CluBar/src/components/TogetherClient.tsx)**（`D-08`, `D-09`, `D-15`）：修復手機 `733px` 橫向溢位（`break-words min-w-0`）、補齊空領域狀態卡與 1 鍵清除鈕、全面 Smart Brevity 化（移除 `Rebound`/`Alumni Ping`/`白名單連結` 生硬黑話）。
9. **[MyClubsClient.tsx](file:///c:/Users/alexl/Desktop/Programs/CluBar/src/components/MyClubsClient.tsx)**（`D-10`, `D-15`）：邀請碼兌換成功呼叫 `router.refresh()` 即時更新社團清單；補齊原創勾選行內視覺提示與 Smart Brevity 化；拉高觸控區 `≥ 44px`。
10. **[ClubManageClient.tsx](file:///c:/Users/alexl/Desktop/Programs/CluBar/src/components/ClubManageClient.tsx)** + **[draft.ts](file:///c:/Users/alexl/Desktop/Programs/CluBar/src/lib/ai/draft.ts)**（`D-11`, `D-12`, `D-15`）：
    - Vision AI 與降級邏輯判斷若包含活動時間／地點／海報密度特徵，於 UI 主推薦「帶入建立活動表單」並明確警告「純活動／行事曆海報請改發活動，勿直接投入探索現場流」（`AS-04`）。
    - 移除交接 Checkbox 無條件顯示綠色 `✓` 的 Bug（`line 1558`），加上送出交接確認視窗／二次確認防呆（`U6`）與明確必填標示。
11. **[MeClient.tsx](file:///c:/Users/alexl/Desktop/Programs/CluBar/src/components/MeClient.tsx)** + **[me/page.tsx](file:///c:/Users/alexl/Desktop/Programs/CluBar/src/app/me/page.tsx)** + **[u/[handle]/page.tsx](file:///c:/Users/alexl/Desktop/Programs/CluBar/src/app/u/%5Bhandle%5D/page.tsx)**（`D-13`, `D-15`）：讀取 `returnTo` query param 並在驗證成功／頁面頂部顯示一鍵返回原活動／社團按鈕（`U5`）；清除 `` `.edu.tw` `` 原生反引號；替空白收藏／追蹤／經歷補齊引導 CTA；拉高熱區 `≥ 44px`。
12. **[OnboardingClient.tsx](file:///c:/Users/alexl/Desktop/Programs/CluBar/src/components/OnboardingClient.tsx)** & **[BlendClient.tsx](file:///c:/Users/alexl/Desktop/Programs/CluBar/src/components/BlendClient.tsx)**（`D-14`, `D-15`）：切 Step 自動 `window.scrollTo({ top: 0, behavior: 'smooth' })`、統一選中視覺規範、Blend 頁加上 9:16 預覽縮圖與回到探索按鈕、Chip 拉高至 `44px`。

### Wave 3（申請、登入與治理長尾收斂）
13. **[ClubApplyClient.tsx](file:///c:/Users/alexl/Desktop/Programs/CluBar/src/components/ClubApplyClient.tsx)**（`D-16`）：清除 `` `.edu.tw` `` 反引號、`前往驗證` 帶入 `?returnTo=/clubs/apply`、未驗證狀態清晰收合未解鎖表單或加上明顯提示、熱區 `≥ 44px`。
14. **[login/page.tsx](file:///c:/Users/alexl/Desktop/Programs/CluBar/src/app/login/page.tsx)**（`D-16`）：錯誤重導保留 `callbackUrl`、12 筆測試帳號改為摺疊展開或兩欄緊湊卡片。
15. **[AdminClient.tsx](file:///c:/Users/alexl/Desktop/Programs/CluBar/src/components/AdminClient.tsx)**（`D-17`）：駁回／下架／停權操作補齊防誤觸確認（`window.confirm` 或 inline 雙步驟確認 `U6`）、分頁與按鈕拉高至 `≥ 44px`。
