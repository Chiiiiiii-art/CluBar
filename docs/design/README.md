# CluBar 設計規範

> 讓之後所有開發（人或 AI）都朝同一個方向。**動 UI 之前先讀 01，再依工作內容讀其他篇。**
> 狀態：v2.5（2026-11-28）｜方向：精修潮流貼紙風（Soft Neubrutalism × 非圓形模切貼紙 × `Chiron GoRound TC`）

| # | 文件 | 回答什麼問題 |
| :--- | :--- | :--- |
| 01 | [品牌與設計原則](./01-brand.md) | 我們是誰、要給人什麼感覺、什麼絕對不做 |
| 02 | [Design Tokens](./02-tokens.md) | 每個顏色、字體、圓角、硬陰影與彈簧動態的用途與限制 |
| 03 | [元件指南](./03-components.md) | 每個共用元件什麼時候用、什麼時候不用 |
| 04 | [頁面與 UX 模式](./04-patterns.md) | 每個空間的版面與互動規則 |
| 05 | [文案與語氣](./05-voice.md) | 怎麼寫、精簡日常口語、用詞表 |
| 06 | [無障礙檢核表](./06-accessibility.md) | 交付前要逐項勾選的 WCAG 2.2 AA 項目 |

**研究依據（現行）**：
- [v2 視覺重設研究報告](../ui-redesign/v2-tactile-research.md)（含反 AI 模板策略、12 個案例拆解、OKLCH 驗證）

**視覺對照（現行定案）**：[v2.5 整合原型](../ui-redesign/style-tiles-v2/01-modern-tactile-v2.html)（[並排控制台](../ui-redesign/style-tiles-v2/index.html)）

**已棄置的 v1 歷史文件（DEPRECATED — 僅供溯源，請勿作為視覺／文案依據）**：
- [價值主張對齊（v1 吧台版，已棄置）](./research/00-value-proposition-alignment.md)
- [設計參考分析（v1 舊版，已棄置）](./research/reference-analysis.md)
- [UI 改善計畫（v1 舊版，已棄置）](../ui-redesign-plan.md)
- [UX 稽核報告（Phase 1-2 功能缺陷清單，視覺已取代）](../ux-audit-and-benchmark.md)
- [v1 吧台原型（style-tiles/，已棄置）](../ui-redesign/style-tiles/index.html)

## 真實來源的優先順序

1. 程式碼：`src/app/globals.css`（token 值）、`src/components/ui/`（元件）、`tests/ui-design-tokens.test.ts`（守門）
2. 本規範
3. 原型與研究文件

程式碼與規範不一致時，先判斷哪個是對的，然後修正另一個——不要讓兩者長期分歧。

## 自動守門

`npm test` 會檢查：原始色階、hex 色碼、低於 12px 的字、規範外的圓角、`window.confirm()`、`ui/` 內使用原始色階、表單控制項的無障礙名稱。**新增規範時，能自動檢查的就加進測試。**

## 修改規範

- 小修（錯字、補例子）：直接改。
- 改原則、品牌色、字體、形容詞：先更新 [UI 改善計畫 §7 決策紀錄（歷史決策日誌）](../ui-redesign-plan.md) 或 [v2 研究報告](../ui-redesign/v2-tactile-research.md)，再同步本規範。
