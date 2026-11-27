# Task A — Phase 0.1: Which audit defects are still open? (READ-ONLY on code)

Goal: the plan says severe usability defects must be fixed before the visual redesign. Find out which items from the UX audit are still open in the CURRENT code.

Input: `docs/ux-audit-and-benchmark.md`, section 四 (ROI table, IDs `D-01`…) and section 五 (Wave 1/2/3 file specs). Git history (`git log --oneline -20`) shows UI phase 1 and phase 2 were merged after the audit, so many items may be fixed.

Do:
1. For EVERY `D-xx` item, check the current source (and, where useful, the running app at http://localhost:3000) and classify: `FIXED`, `PARTIAL`, `OPEN`, or `CANNOT VERIFY`. Give one line of evidence each (file:line, or what you observed on the page).
2. Write the result to `docs/ui-redesign/phase0-audit-status.md` (Traditional Chinese, a Markdown table: ID | 摘要 | 狀態 | 證據 | 嚴重度(Sev) | 波次). End with a short list "改版前必修" = items that are OPEN/PARTIAL with Sev ≥ 3.

Only file you may create: `docs/ui-redesign/phase0-audit-status.md`. Do not modify any code.
