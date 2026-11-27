# CluBar UI 改善計畫：從「能用」到「有個性」

> **文件狀態**：提案（待決策）｜2026-11-27
> **範圍**：視覺識別與介面風格（Visual / Interaction / Voice）。資訊架構與功能流程沿用 [PRD v2](./clubar-prd-v2.md)，功能性缺陷仍以 [UX 稽核](./ux-audit-and-benchmark.md) 的 ROI 清單為準。
> **一句話**：目前的 UI 乾淨、清楚，但與任何一個 Tailwind 範本無法區分。本計畫把「社團聚 = 校園裡的一張吧台桌」這個品牌概念，系統性地落到色彩、字體、形狀、動態與文案上，同時不犧牲可讀性與無障礙。

---

## 1. 現況診斷：為什麼「沒什麼特色」

以 `localhost:3000` 首頁、活動頁 `/e/ncu-dn-01`、社團頁 `/clubs/ncu-gamedev` 實際畫面與程式碼走查：

| 面向 | 現況 | 問題 |
| :--- | :--- | :--- |
| 色彩 | 中性 zinc（`ink-*`）＋ Tailwind 預設 indigo（`accent-*`），見 [globals.css](../src/app/globals.css) | indigo-600 是 Tailwind／shadcn 的預設強調色，數以萬計的產品長這樣；與 Logo 的「黑＋米白」完全無關。 |
| 字體 | 全站單一 Noto Sans TC，標題只靠字重區分 | 沒有「聲音」。標題、內文、數字、標籤同一張臉，層級只能靠大小與粗細硬撐。 |
| 形狀 | 全部 `rounded-xl` 卡片＋細邊框，測試甚至禁用 `2xl/3xl` 圓角與 `font-extrabold` | 一致性是對的，但所有元件都長成同一種白色方塊，活動、貼文、社團、通知沒有形狀上的辨識度。 |
| 品牌資產 | Logo（啤酒杯＋紅酒杯＋吧台桌，米白於黑底）只出現在 Navbar 角落 | 最有記憶點的「吧台／聚會」意象沒有延伸到介面任何地方。 |
| 預設圖 | `ClubMark` 用 8 個隨機雜湊色塊＋一個字（如綠底「中」） | 顏色跟社團類型無關，訊號是隨機的；看起來像未完成。 |
| 動態 | 只有 `transition-colors` | 報名、收藏、追蹤等「情緒高點」沒有任何回饋，缺少 PRD 所說的「活人氛圍」。 |
| 文案 | 已做過 Smart Brevity 精簡 | 清楚但中性，沒有品牌語氣。 |

**結論**：問題不在「不好用」，而在**品牌層（brand layer）完全空白**。NN/g 把介面的品牌表達拆成三層——視覺設計（看起來如何）、內容設計（聽起來如何）、互動設計（感覺如何）[^nng-interaction-branding]；CluBar 目前三層都停在中性預設值。

---

## 2. 研究依據：權威設計指引摘要

只採用一手、具公信力的來源（標準組織、平台原廠設計規範、NN/g 研究）。

### 2.1 為什麼「有特色」值得投資
- **美感—可用性效應（NN/g）**：好看的介面會讓使用者「容忍小的可用性問題」，但**不會掩蓋嚴重問題**；功能若被美感犧牲，使用者會失去耐心[^nng-aesthetic]。→ **重設計前必須先清掉嚴重可用性缺陷**（見 §4 Phase 0）。
- **品牌即體驗（NN/g）**：多數人無法把「對品牌的感覺」與「對使用體驗的感覺」分開，UX 往往就是品牌差異化本身[^nng-brand-exp]；品牌個性應實際驅動互動、視覺與文案決策，例如活潑的品牌應該在動畫與載入中體現[^nng-brand-terms]。
- **Material 3 Expressive（Google）**：Google 稱其為設計系統史上研究最多的更新，以眼動追蹤比較 10 個 App 的表現力版本與一般版本；**18–24 歲族群特別偏好表現力設計**，且在「有活力、好玩、友善」等形容詞得分更高[^m3e-research][^m3e-benefits]。CluBar 的核心族群正是大學生，這是最直接的佐證。

### 2.2 品牌要「節制」：品牌服務內容，而不是與內容搶戲
- **Apple HIG — Branding**：強調色要「審慎使用」，品牌色用太廣會壓垮介面並稀釋效果；**品牌永遠要讓位給內容**；自訂字體可用於標題，但內文建議用為小尺寸可讀性設計的系統字體[^hig-branding]。
- **Apple HIG — Color**：同一個顏色不可代表不同意義；若品牌色標示「可互動」，就不要拿來塗非互動文字[^hig-color]。
- → 對 CluBar 特別重要：社團海報本身色彩極度豐富（見 `examples/posts/`），**介面要當「好的畫框」，而不是第二張海報**。

### 2.3 視覺層級的基本功
- **NN/g 五大視覺設計原則**：尺度（scale）、視覺層級、平衡、對比、完形（Gestalt）；層級可透過大小、明度、色彩、間距、位置建立，且**不可只靠色彩**傳遞差異（色盲使用者會漏掉）[^nng-visual]。

### 2.4 無障礙是底線，不是選配（W3C WCAG 2.2，2023-10 正式推薦標準）
- **2.4.11 Focus Not Obscured (AA)**：鍵盤焦點元素不得被作者內容（如 sticky header、底部導覽列）完全遮住[^wcag22]。CluBar 有固定頂欄＋行動版底部導覽，換皮時必須保留現有 `scroll-padding` 機制。
- **2.5.8 Target Size (AA)**：點擊目標至少 24×24 CSS px；舊有 AAA 標準為 44px[^deque-wcag22]。現有元件已以 44px 為目標，新元件須維持。
- 文字對比 4.5:1、大字 3:1（WCAG 1.4.3）照舊；**新色票每一組前景／背景都要附對比值**，比照現有 `globals.css` 註解的做法。

### 2.5 Design Token 架構（W3C DTCG）
- W3C Design Tokens Community Group 於 2025-10-28 發布第一個穩定版格式規範 **2025.10**，新增主題（theming）、現代色彩空間與跨工具互通[^dtcg]。注意它是社群群組報告，**不是 W3C 標準軌**[^dtcg-format]，但已是業界共通語言。
- → 建議採三層 token：**原始值（primitive）→ 語意（semantic）→ 元件（component）**。現在的 `ink-*`/`accent-*` 介於原始與語意之間，換品牌色或加深色模式時會牽一髮動全身。

### 2.6 色彩空間與實作（Tailwind v4 官方文件）
- Tailwind v4 以 `@theme` 定義 CSS 變數，同時產生對應的 utility class；預設色票已改用 **OKLCH** 色彩空間[^tw-theme][^tw-color]。OKLCH 的明度（L）在感知上較均勻，用它推導色階更容易控制對比，適合自訂品牌色票。

### 2.7 中文排版（W3C clreq）
- W3C《中文排版需求》指出中文字與標點原則上視為 1:1 方塊並排，標點規則應**依地區**（台灣）而非依繁簡區分[^clreq]。→ 標題用較緊行高、內文維持現有 1.7；避免為了「設計感」對中文加大字距或使用斜體。

### 2.8 深色模式：要不要做？
- NN/g：一般視力者在淺色模式表現通常較好；深色模式主要是美感偏好，「眼睛較不累」的說法缺乏穩固證據；但仍建議提供切換以照顧視障與個人偏好[^nng-dark][^nng-dark-issues]。
- → **列為第二階段可選項**，但第一階段的 token 架構就要「能支援」（語意 token 化），避免日後重工。

### 2.9 怎麼驗證「有特色」不是自嗨
- **Microsoft Desirability Toolkit（NN/g 推薦用法）**：事先決定品牌想傳達的形容詞，從 118 字詞中挑 15–25 個（含反義詞）讓受測者選出最能描述設計的 5 個，再計算命中率[^nng-desirability][^nng-reaction-words]。
- NN/g 同時提醒：受測者容易為了禮貌稱讚外觀，**要看行為而不是聽評語**[^nng-aesthetic]——所以要搭配既有的 [易用性測試腳本](./ux-usability-test-script.md) 一起跑。

---

## 3. 設計方向：「社團吧台」（The Campus Bar）

### 3.1 品牌概念
Logo 已經講好了故事：**一張吧台桌，一杯啤酒、一杯紅酒——不同的人坐在一起**。社團聚不是公布欄，而是「下課後大家會聚過去的那張桌子」。

**品牌形容詞（草案，Phase 0 與團隊確認）**

| 要成為 | 不要成為 |
| :--- | :--- |
| 溫暖（warm） | 冰冷、官方 |
| 有活力（lively） | 吵雜、廉價 |
| 歡迎新人（welcoming） | 小圈圈、排外 |
| 有質感（crafted） | 模板感、千篇一律 |
| 可信賴（trustworthy） | 花俏、不可靠 |

這組詞同時是 §5 Desirability 測試的目標詞。

### 3.2 視覺語彙（具體做法）

**A. 色彩：從 Logo 長出來，而不是從 Tailwind 預設選**
- **底色**：由冷灰白 `#fafafa` 改為 Logo 的**米白紙色**（暖色中性，約 `oklch(97% 0.01 85)`），卡片表面用更淺的米白或純白。
- **墨色**：由 zinc 改為帶一點暖棕的**濃縮咖啡黑**，取代純中性灰，讓整站「有溫度」。
- **單一招牌強調色**：候選「吧台燈琥珀」或「酒紅」（Phase 1 二選一，見 §4）。依 HIG，只用在主要行動（報名、追蹤、發布）與當前狀態，**不拿來塗裝飾**。
- **六大領域色（學術／藝文／康樂／體育／服務／聯誼）**：為 [constants.ts](../src/lib/constants.ts) 已有的 6 個領域各定一組柔和色（底色＋文字色，皆 ≥ 4.5:1）。用在領域標籤、`ClubMark` 預設圖、無封面卡片的底色——**讓顏色帶有意義**，取代現在的隨機雜湊色。
- 全部以 OKLCH 定義，維持「同一階明度 → 對比可預測」。

**B. 字體：給標題一個「聲音」**
- **內文**維持 Noto Sans TC（符合 HIG「內文用為小字可讀性設計的字體」）。
- **標題／Display** 引入第二套字體，兩個候選在 Phase 1 測：
  1. **Noto Serif TC（思源宋體）**：像酒館菜單、雜誌刊頭，質感、成熟。
  2. **jf open 粉圓（OFL 授權）**：圓潤、友善、年輕，與 Logo 的圓角線條一致。
- 只用於頁面標題、活動標題、Blend 分享卡、空狀態標語；**不用於按鈕、表單、長段落**。
- 建立固定字級階梯（例：12／14／16／20／24／32／40），並為數字（日期、時間）設定等寬數字 `tabular-nums`。

**C. 形狀：讓不同物件長得不一樣**
目前全部都是白色圓角卡片；改為「一種物件一種形狀語言」，取自吧台情境：

| 物件 | 形狀隱喻 | 做法 |
| :--- | :--- | :--- |
| 活動（Event） | **票根** | 卡片側邊的打孔缺口＋虛線分隔「時間地點」與「報名」區，一眼看出「這是可以參加的東西」。 |
| 社團（Club） | **杯墊** | `ClubMark` 改為圓形杯墊樣式＋領域色＋細外框環。 |
| 社員日常（Post） | **拍立得／原圖** | 維持原圖比例、極少邊框，讓照片自己說話（呼應 PRD「不強迫裁切」）。 |
| 標籤（Chip） | **菜單標籤** | 較小圓角、領域色底，與按鈕的形狀明顯區分。 |

> 需同步修改 [tests/ui-design-tokens.test.ts](../tests/ui-design-tokens.test.ts) 的圓角、字重規則：不是放寬，而是改成「只允許新 token 中定義的值」。

**D. 動態：只在情緒高點出現**
- 報名成功、收藏、追蹤、Blend 結果揭曉，各給一個 200–400ms 的小回饋（例如報名成功時票根「蓋章」、追蹤時杯墊輕微「碰杯」位移）。
- 建立 `duration-*`／`ease-*` 動態 token；沿用現有 `prefers-reduced-motion` 全域降級。
- **不做**：載入時大範圍進場動畫、視差、無意義的 hover 漂浮。

**E. 插圖與空狀態**
- 以 Logo 的**粗圓角單線條**畫風延伸一小組圖示插圖（空杯＝還沒有活動、兩張椅子＝還沒有成員、乾杯＝報名成功），用於 [States.tsx](../src/components/ui/States.tsx) 的空狀態與錯誤頁。
- 讓插圖成為品牌「簽名」，比換顏色更有記憶點。

**F. 文案語氣**
- 在既有 Smart Brevity 基礎上加一點吧台語氣，但**只用於標題、空狀態、成功訊息**；表單、錯誤、治理後台維持中性精準。
- 例：首頁「今天哪裡有聚？」、空狀態「這張桌子還空著——第一個坐下吧」、報名成功「位子幫你留好了」。

### 3.3 一套系統，兩種溫度
| 區域 | 頁面 | 品牌表現強度 |
| :--- | :--- | :--- |
| **前台（會被分享、第一印象）** | 探索首頁、活動頁、社團頁、Onboarding、Blend、個人足跡 | **高**：Display 字體、票根／杯墊形狀、動態、插圖 |
| **工作區（每天要用、要效率）** | 社團管理、我的社團、一起聚 | **中**：色彩與字體一致，形狀與動態收斂 |
| **治理後台** | `/admin`、評鑑列印 | **低**：只換色彩 token，維持高密度與中性 |

這符合 HIG「品牌讓位給內容」與 NN/g「不要讓美感犧牲功能」的原則。

---

## 4. 執行計畫

### Phase 0｜事前準備（約 1 週，**必須先做**）
1. **清掉嚴重可用性缺陷**：逐條核對 [UX 稽核](./ux-audit-and-benchmark.md) Wave 1（`D-01`～`D-06` 等）在 Phase 2 合併後的實際狀態，仍未修的高嚴重度項目先修。理由：美感無法掩蓋大問題（§2.1）。
2. **確認品牌形容詞**：與團隊對齊 §3.1 的 5 組「要／不要」，這是後續所有決策與測試的判準。
3. **建立視覺基準線**：用瀏覽器在 `390×844`、`1440×900` 兩個視口，對約 10 個核心頁面截圖存檔，作為前後對比與回歸檢查依據。
4. **Token 架構重構（零視覺變化）**：在 `globals.css` 加入語意層（如 `surface`、`surface-raised`、`text-primary`、`text-muted`、`brand`、`on-brand`、`domain-academic` …），元件改用語意 token。此步驟畫面應**完全不變**，用來確保 Phase 2 換皮只需改一處，並為深色模式鋪路。
5. **字體可行性檢查**：確認候選字體授權（OFL）、`next/font` 子集與 `unicode-range` 切片可行，量測對 LCP 的影響（CJK 字體檔很大，現有 `preload: false` 策略需沿用）。

### Phase 1｜方向探索與驗證（約 1–1.5 週）
1. **Moodboard**：蒐集吧台、咖啡館菜單、票券、杯墊、校園社團海報的視覺參考。
2. **2–3 張 Style Tile**：同一套內容、不同變數（強調色 琥珀 vs 酒紅；標題 宋體 vs 粉圓），套在**最關鍵的兩個畫面**——探索首頁、活動頁（手機版）。以靜態 HTML 原型呈現，不動正式程式碼。
3. **Desirability 測試**：5–8 位目標使用者（含非社員新生），每人看 2–3 個方向，從約 20 個字詞（含 §3.1 的正反詞）中各選 5 個；計算目標詞命中率，並記錄「第一眼最想點什麼」。
4. **決策**：選定一個方向，輸出定稿 token 值（附對比數據）。

### Phase 2｜Foundations（約 1 週）
- 色彩（OKLCH 原始色階＋語意 token＋6 個領域色）、字體與字級、圓角／陰影／間距、動態 token。
- 更新 `tests/ui-design-tokens.test.ts`：允許新 token、禁止回到舊 indigo、新增「每組前景／背景對比 ≥ 4.5:1」自動檢查。

### Phase 3｜元件（約 1.5 週）
依使用頻率：`Button`、`Chip`、`Badge`、`Card` → `ClubMark`（杯墊＋領域色）→ `EventCard`（票根）→ `PostCard` → `Navbar`（含行動版底部列）→ `Tabs`、`Dialog`、`Field` → `States`（插圖空狀態、骨架屏）。

### Phase 4｜頁面（約 2 週，依流量與第一印象排序）
1. 探索首頁（`DiscoverClient`）
2. 活動頁（`EventPageClient`）＋ OG 分享圖（`api/og`，維持字面色值但改用新色票）
3. 社團頁（`ClubDetailClient`）
4. Onboarding ＋ Blend 分享卡（最適合放大品牌表現、也最會被外流分享）
5. 個人足跡 `/me`、`/u/[handle]`
6. 一起聚、我的社團
7. 社團管理、平台治理（只換 token）

### Phase 5｜驗證（與 Phase 4 並行，收尾 0.5 週）
- **無障礙**：對比全數 AA；鍵盤巡覽確認焦點不被頂欄／底部列遮擋（WCAG 2.4.11）；點擊目標 ≥ 24px（目標 44px）。
- **效能**：LCP、CLS 與 Phase 0 基準比較，不得明顯退步。
- **易用性回歸**：以既有測試腳本跑 5 人，任務成功率不得低於改版前。
- **Desirability 複測**：正式版再測一次，目標詞命中率需高於改版前。

---

## 5. 成功指標

| 指標 | 量測方式 | 目標 |
| :--- | :--- | :--- |
| 品牌辨識 | Desirability 測試：至少選中 1 個目標正向詞的受測者比例 | ≥ 80%，且負向詞（冰冷、模板感）明顯下降 |
| 可用性不退步 | 易用性測試任務成功率 | ≥ 改版前 |
| 無障礙 | 對比檢查、鍵盤巡覽 | 100% 符合 WCAG 2.2 AA 相關準則 |
| 效能 | LCP / CLS（手機版首頁、活動頁） | 不劣於 Phase 0 基準 |
| 一致性 | token 守門測試 | 0 個違規 |

---

## 6. 風險與對策

| 風險 | 對策 |
| :--- | :--- |
| 品牌色與社團海報搶戲 | 招牌色只用在行動按鈕；底色用低彩度米白，讓海報成為主角（HIG：品牌讓位給內容）。 |
| CJK Display 字體拖慢載入 | 只用於少量標題；`display: swap`＋不預載；必要時僅子集化常用字。 |
| 「吧台」意象讓人聯想到飲酒，校方觀感疑慮 | 視覺上強調「桌子／聚在一起」而非酒精；插圖以咖啡杯、茶杯、杯墊為主，避免酒瓶。**需團隊確認**。 |
| 一次改太多造成回歸 | Phase 0 token 重構先行；每個 Phase 獨立 PR、附前後截圖。 |
| 受測者礙於禮貌給好評 | Desirability 與行為任務一起測，以行為為準（NN/g）。 |

---

## 7. 決策紀錄（2026-11-27 定案）

1. **品牌形容詞**（§3.1）：照草案採用。
2. **「吧台」概念**：採用。它只是設計語彙（色彩、形狀、插圖、文案），不涉及產品內容。
3. **深色模式**：本輪不做。語意 token 層已完成，日後要加時只需另一組 token 值。
4. **測試對象**：暫不招募外部受測者，由產品負責人親自試用。§4 Phase 1 的 Desirability 測試與 Phase 5 的易用性回歸改為自評：仍以 §3.1 的形容詞表與既有測試腳本當作檢核清單。
5. **視覺方向**：選定 **A：吧台燈琥珀 × 思源宋體**。酒紅（B）因為容易被讀成「酒」、也會縮小受眾而淘汰（參考 Pinkoi 品牌更新）。完整規範見 [docs/design/](./design/README.md)。

---

## 參考來源

[^nng-aesthetic]: Nielsen Norman Group, *The Aesthetic-Usability Effect*. https://www.nngroup.com/articles/aesthetic-usability-effect/
[^nng-interaction-branding]: Nielsen Norman Group, *Interaction Branding*. https://www.nngroup.com/articles/interaction-branding/
[^nng-brand-terms]: Nielsen Norman Group, *UX Brand Terms Defined*. https://www.nngroup.com/articles/ux-brand-terms-defined/
[^nng-brand-exp]: Nielsen Norman Group, *Brand Experience and UX*. https://www.nngroup.com/articles/brand-experience-ux/
[^nng-visual]: Nielsen Norman Group, *5 Principles of Visual Design in UX*. https://www.nngroup.com/articles/principles-visual-design/ ；*Visual Hierarchy*. https://www.nngroup.com/articles/visual-hierarchy-ux-definition/
[^nng-dark]: Nielsen Norman Group, *Dark Mode vs. Light Mode*. https://www.nngroup.com/articles/dark-mode/
[^nng-dark-issues]: Nielsen Norman Group, *Dark Mode: Users and Issues*. https://nngroup.com/articles/dark-mode-users-issues
[^nng-desirability]: Nielsen Norman Group, *Using the Microsoft Desirability Toolkit*. https://www.nngroup.com/articles/microsoft-desirability-toolkit/
[^nng-reaction-words]: Nielsen Norman Group, *Desirability Reaction Words*. https://www.nngroup.com/articles/desirability-reaction-words/
[^m3e-research]: Google Design, *Better, Easier, Emotional UX*（Material 3 Expressive 研究）. https://design.google/library/expressive-material-design-google-research
[^m3e-benefits]: Android Developers, *Benefits of expressive design*. https://developer.android.com/design/ui/wear/guides/get-started/benefits
[^hig-branding]: Apple Human Interface Guidelines, *Branding*. https://developer.apple.com/design/human-interface-guidelines/branding
[^hig-color]: Apple Human Interface Guidelines, *Color*. https://developer.apple.com/design/human-interface-guidelines/color
[^wcag22]: W3C WAI, *What's New in WCAG 2.2*. https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/
[^deque-wcag22]: Deque University, *WCAG 2.2 Updates*. https://dequeuniversity.com/resources/wcag-2.2
[^dtcg]: W3C Design Tokens Community Group, *Design Tokens specification reaches first stable version*（2025-10-28）. https://w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/
[^dtcg-format]: W3C DTCG, *Design Tokens Format Module 2025.10*. https://www.w3.org/community/reports/design-tokens/CG-FINAL-format-20251028/
[^tw-theme]: Tailwind CSS, *Theme variables*. https://tailwindcss.com/docs/theme
[^tw-color]: Tailwind CSS, *Colors*. https://tailwindcss.com/docs/color
[^clreq]: W3C, *Requirements for Chinese Text Layout*（Group Note Draft, 2026-03-26）. https://www.w3.org/TR/2026/DNOTE-clreq-20260326/
