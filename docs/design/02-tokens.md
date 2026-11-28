# 02｜Design Tokens

> **唯一的值來源是 [`src/app/globals.css`](../../src/app/globals.css) 的 `@theme`。** 本頁說明每個 token 的用途與限制；兩者不一致時以程式碼為準，並修正本頁。
> 架構：原始值（primitive）→ 語意（semantic）→ 元件。元件只能用語意 token（由 `tests/ui-design-tokens.test.ts` 守門）。

## 1. 色彩（100% sRGB 色域內 OKLCH）

### 1.1 中性與表面

| 語意 token | 值（OKLCH） | Hex | 用途 | 限制 |
| :--- | :--- | :--- | :--- | :--- |
| `canvas` | `oklch(97.4% 0.008 85)` | `#f9f6f0` | 頁面底色（暖點陣紙） | 搭配 `.bg-dot-paper` |
| `surface` | `oklch(99.6% 0.002 85)` | `#fefefc` | 卡片、表單、對話框 | 卡片不可巢狀 |
| `surface-subtle` | `oklch(94.2% 0.012 82)` | `#f0ebe3` | 次要區塊、票根底、骨架 | — |
| `surface-sunken` | `oklch(91.5% 0.014 82)` | `#e7e1d7` | 凹陷區、分段底 | — |
| `fg` | `oklch(19% 0.022 260)` | `#0e141e` | 標題、主要文字、硬陰影基準 | 對 canvas 17.12:1 |
| `fg-body` | `oklch(28% 0.022 260)` | `#232933` | 內文、表單標籤 | 對 surface ≥ 13:1 |
| `fg-secondary` | `oklch(33% 0.020 260)` | `#2f3640` | 次要內文 | 對 surface 12.07:1 |
| `fg-muted` | `oklch(41.5% 0.020 260)` | `#454c57` | 說明、時間、次要資訊 | 對 canvas 8.03:1 |
| `fg-subtle` | `oklch(45.5% 0.020 260)` | `#505762` | 最淺可讀文字 | 對 surface-subtle 6.14:1 |
| `fg-faint` | `oklch(62% 0.018 260)` | — | 純裝飾性圖示 | **不可用於文字** |
| `border-ink` | 同 `fg` | `#0e141e` | 前台貼紙、按鈕、票根 `2px` 墨框 | 高表現力專用；後台表格改用 `line` |
| `line` | `oklch(86% 0.012 82)` | `#d4cec3` | 工作區／後台分隔線與細框 | — |
| `line-input` | `oklch(53% 0.020 260)` | `#656c78` | 輸入框邊框 | 對 surface 5.24:1（WCAG 1.4.11） |

### 1.2 品牌與跳色（Soft Neubrutalism 三角配色）

| 語意 token | 值（OKLCH） | Hex | 用途 | 對比 |
| :--- | :--- | :--- | :--- | :--- |
| `brand` | `oklch(54.5% 0.210 27)` | `#ce1a1f` | 熾熱朱紅：頁面主要行動按鈕 | `on-brand` 在上 5.48:1 |
| `brand-hover` | `oklch(48.0% 0.195 27)` | `#b20111` | 主要按鈕 hover | 7.16:1 |
| `on-brand` | `oklch(99.6% 0.002 85)` | `#fefefc` | 品牌色／鈷藍上的白字 | — |
| `brand-soft` | `oklch(94.5% 0.024 32)` | `#fde7e3` | 柔和強調底（提示框） | — |
| `brand-soft-fg` | `oklch(42.0% 0.155 27)` | `#8f1617` | `brand-soft` 上文字、品牌連結 | 對 brand-soft 7.72:1 |
| `spark` | `oklch(92.0% 0.135 98)` | `#fce575` | 檸檬亮黃：貼紙高光、目前選取態、情境捷徑 | `fg` 在上 14.60:1 |
| `cobalt` | `oklch(49.0% 0.165 258)` | `#155cbb` | 電光鈷藍：焦點環、精選面板、連結強調 | 對 surface 6.34:1 |
| `focus-ring` | 同 `cobalt` | `#155cbb` | `:focus-visible` 3px 外框 | 在朱紅／亮黃旁依然明顯 |

### 1.3 六大領域色（貼紙與扇貝徽章專用）

**底色＋文字色成對使用，不可拆開。**

| 領域 | 底色（`*-soft`） | 文字色 | 實測對比 |
| :--- | :--- | :--- | :--- |
| 學術 | `oklch(91.5% 0.042 250)` `#cfe6ff` | `oklch(30% 0.095 255)` `#032d5c` | 10.70:1 |
| 藝文 | `oklch(90.5% 0.068 335)` `#fdcff2` | `oklch(30% 0.125 335)` `#500646` | 10.57:1 |
| 康樂 | `oklch(92.0% 0.124 95)` `#fee480` | `oklch(25% 0.050 70)` `#311d03` | 12.71:1 |
| 體育 | `oklch(91.0% 0.043 28)` `#fdd7d2` | `oklch(33% 0.125 28)` `#670a09` | 9.75:1 |
| 服務 | `oklch(91.0% 0.082 152)` `#b9f2c7` | `oklch(28% 0.069 155)` `#003219` | 11.28:1 |
| 聯誼 | `oklch(91.0% 0.062 198)` `#b1eff0` | `oklch(28% 0.048 200)` `#003032` | 11.22:1 |

## 2. 字體

| Token | 字體 | 用在 |
| :--- | :--- | :--- |
| `font-display` | `Chiron GoRound TC`（700–900）＋ `Bricolage Grotesque` 備援 | 頁面大標、導覽品牌、貼文與活動標題、空狀態標語 |
| `font-sans` | `Noto Sans TC`（400–700） | 內文、表單、說明 |
| `font-mono` | `JetBrains Mono`（500–700） | 日期時間、票券編號、價格標籤（自動搭 `tabular-nums`） |

- 字級下限 `12px`（`text-xs`）；字重範圍 `400`–`900`（`font-extrabold`/`font-black` 僅用於 `font-display`）。

## 3. 形狀與硬陰影（非圓形貼紙語彙）

| 物件 | 形狀與邊框 | 陰影 |
| :--- | :--- | :--- |
| 社團標誌（`ClubMark`） | **扇貝波浪模切貼紙（Scalloped SVG）**＋領域色＋深墨描邊 | `2px 2px 0` 硬投影 |
| 領域篩選貼紙（`FilterChip`） | **混搭輪廓**（膠囊、斜切 `14px 4px`、方圓角 `10px`、微傾角）＋ `2px` 墨框 | `2px 2px 0`（hover 抬升 `3px 3px 0`） |
| 活動卡（`EventCard`） | 票根造型：`.ticket-stub` `2px` 深墨虛線＋兩側半圓缺口 | `3px 3px 0` 硬陰影 |
| 貼文卡（`PostCard`） | `rounded-2xl` `2px` 墨框＋原比例圖片＋左上／右上角標貼紙 | `3px 3px 0`（hover `5px 5px 0`） |
| 個人頭像（`ClubMark round`） | `rounded-full`＋`2px` 墨框（與非圓形社團貼紙區隔） | — |

## 4. 動態（彈簧物理回饋）

- `ease-spring`: `cubic-bezier(0.34, 1.56, 0.64, 1)`（hover 微抬、按鈕點擊 `translate(2px, 2px)` 硬陰影塌陷、報名成功 320ms 蓋章動畫 `.animate-stamp`）。
- `prefers-reduced-motion: reduce` 時降為無位移（保留全域規則）。
