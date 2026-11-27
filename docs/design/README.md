# CluBar 設計規範

> 讓之後所有開發（人或 AI）都朝同一個方向。**動 UI 之前先讀 01，再依工作內容讀其他篇。**
> 狀態：v1.0（2026-11-27）｜方向：A 吧台燈琥珀 × 思源宋體

| # | 文件 | 回答什麼問題 |
| :--- | :--- | :--- |
| 01 | [品牌與設計原則](./01-brand.md) | 我們是誰、要給人什麼感覺、什麼絕對不做 |
| 02 | [Design Tokens](./02-tokens.md) | 每個顏色、字體、圓角、動態的用途與限制 |
| 03 | [元件指南](./03-components.md) | 每個共用元件什麼時候用、什麼時候不用 |
| 04 | [頁面與 UX 模式](./04-patterns.md) | 每個空間的版面與互動規則 |
| 05 | [文案與語氣](./05-voice.md) | 怎麼寫、哪裡可以用吧台語氣、用詞表 |
| 06 | [無障礙檢核表](./06-accessibility.md) | 交付前要逐項勾選的 WCAG 2.2 AA 項目 |

**證據層**（每條規則的「為什麼」）：
- [價值主張對齊](./research/00-value-proposition-alignment.md)
- [設計參考分析（依功能）](./research/reference-analysis.md)
- [UI 改善計畫](../ui-redesign-plan.md)、[UX 稽核](../ux-audit-and-benchmark.md)

**視覺對照**：[方向 A 原型](../ui-redesign/style-tiles/a-amber-serif.html)

## 真實來源的優先順序

1. 程式碼：`src/app/globals.css`（token 值）、`src/components/ui/`（元件）、`tests/ui-design-tokens.test.ts`（守門）
2. 本規範
3. 原型與研究文件

程式碼與規範不一致時，先判斷哪個是對的，然後修正另一個——不要讓兩者長期分歧。

## 自動守門

`npm test` 會檢查：原始色階、hex 色碼、低於 12px 的字、超過 bold 的字重、規範外的圓角、`window.confirm()`、`ui/` 內使用原始色階、表單控制項的無障礙名稱。**新增規範時，能自動檢查的就加進測試。**

## 修改規範

- 小修（錯字、補例子）：直接改。
- 改原則、品牌色、字體、形容詞：先在 [UI 改善計畫 §7 決策紀錄](../ui-redesign-plan.md) 記下決定與理由，再改規範。
