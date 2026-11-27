# AGENTS.md — CluBar 開發指示

給所有在這個專案寫程式的 AI 代理（Claude、Gemini／Antigravity、Codex 等）與人類開發者。

## 專案

社團聚（CluBar）：大專社團的內容探索與交流平台。Next.js 15（App Router）＋ React 19 ＋ Tailwind CSS v4 ＋ Drizzle（Postgres）。介面語言為繁體中文（台灣）。

- 產品：[docs/clubar-prd-v2.md](docs/clubar-prd-v2.md)、[docs/clubar-srs-v2.md](docs/clubar-srs-v2.md)、[docs/clubar-pitch-deck.md](docs/clubar-pitch-deck.md)
- **設計規範：[docs/design/README.md](docs/design/README.md)——動任何 UI 之前必讀。**

## 動 UI 前的必讀順序

1. [docs/design/01-brand.md](docs/design/01-brand.md)：品牌概念、形容詞、七條原則、絕對不做的事
2. 依工作內容讀 [02-tokens](docs/design/02-tokens.md)、[03-components](docs/design/03-components.md)、[04-patterns](docs/design/04-patterns.md)、[05-voice](docs/design/05-voice.md)
3. 交付前對照 [06-accessibility](docs/design/06-accessibility.md)

## 不可違反的規則

1. **顏色只用語意 token**（`globals.css` 的 `@theme`）。不寫 hex、不用 Tailwind 原始色階（`bg-zinc-100`、`text-indigo-600`）；`src/components/ui/` 內也不可用 `ink-*`／`accent-*` 等原始色階。由 `tests/ui-design-tokens.test.ts` 守門。
2. **先用 `src/components/ui/` 的共用元件**；沒有才新增，新增時補 [03-components](docs/design/03-components.md)。
3. **不顯示人氣數字**：按讚、追蹤、人數、排名、契合度百分比都不出現在介面上。
4. **圖片不裁切**：作品與海報保留原始比例。
5. **品牌琥珀色只用於主要行動與目前選取狀態**；一個區塊最多一個 `primary` 按鈕。
6. **介面文字全中文白話**，不出現內部英文代號或原始列舉值（`owner`、`scheduled`、`Rebound`）。
7. **不可逆操作用 `useConfirm()`**，禁用 `window.confirm()`；可復原的操作用「復原」提示。
8. 點擊目標 ≥ 44px；表單控制項都要有可讀名稱。

## 指令

```bash
npm run dev         # http://localhost:3000
npm run typecheck   # tsc --noEmit
npm test            # node:test，含設計 token 守門
```

交付前 `npm run typecheck` 與 `npm test` 必須通過。

## 工作習慣

- 不改與任務無關的檔案；不在 `main` 上直接做大改動，先開分支。
- 不提交 `.env*`、憑證。
- 改到畫面時，在行動版（390×844）與桌機（1440×900）都看一次。
- 規範沒寫到、或規範與需求衝突時：回到 [01-brand](docs/design/01-brand.md) 的原則判斷，並在交付說明中寫出你的判斷，必要時補進規範。
