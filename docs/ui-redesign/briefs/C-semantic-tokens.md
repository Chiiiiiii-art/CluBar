> **[DEPRECATED — v1 Historical Brief]** Superseded by v2.5 (`docs/design/02-tokens.md`).

# Task C — Phase 0.4: Semantic token layer, ZERO visual change

Goal: per `docs/ui-redesign-plan.md` §2.5 and §4 Phase 0 step 4, add a semantic token layer so that the later re-skin (new colours, maybe dark mode) is a change in ONE place. The rendered UI must look exactly the same after this task.

Current state: `src/app/globals.css` `@theme` defines primitive-ish scales `ink-*`, `accent-*`, `success-*`, `warning-*`, `danger-*` and singles `canvas`, `surface`, `line`, `line-input`. Components use them directly as Tailwind utilities (`bg-accent-600`, `text-ink-500`, …). `tests/ui-design-tokens.test.ts` guards token use.

Do:
1. Inventory how colour utilities are used across `src/**/*.tsx` and `src/components/ui/styles.ts` (count each distinct `{bg,text,border,ring,…}-{scale}-{step}` use). Save the inventory to `docs/ui-redesign/token-inventory.md`.
2. Design a SMALL semantic set (aim for ≤ 25 tokens) that covers ≥ 90% of uses, e.g. `fg` / `fg-muted` / `fg-subtle`, `bg-canvas` / `surface` / `surface-sunken`, `border` / `border-strong`, `brand` / `brand-hover` / `brand-active` / `on-brand` / `brand-soft` / `brand-soft-fg`, `focus-ring`, plus status `*-soft` / `*-fg` pairs. Define them in `globals.css` `@theme` as `var(--color-…)` references to the existing primitives, so values are unchanged. Document the mapping in a comment block.
3. Migrate `src/components/ui/**` and `src/components/ui/styles.ts` fully to the semantic tokens. Migrate page/feature components (`src/components/*.tsx`, `src/app/**`) where the mapping is 1:1 and unambiguous; leave rare one-off uses on primitives and list them in the inventory doc as "left on primitives".
4. `src/components/ui/ClubMark.tsx` hard-codes hex swatches — leave its behaviour, but move the hex values into CSS custom properties in `globals.css` (`--color-mark-1` … `--color-mark-8`) and reference them.
5. Update `tests/ui-design-tokens.test.ts` so it still passes and ADD a rule that `src/components/ui/**` must not use primitive scale utilities (`ink-`, `accent-`, `success-`, `warning-`, `danger-` followed by a number).
6. Verify: `npm run typecheck` and `npm test` both pass. Do NOT take screenshots and do NOT run anything with BypassSandbox — the supervisor will capture after-screenshots and compare them with the baseline in `.ui-baseline/before/`. Instead, list in your report every place where you are not 100% sure the resolved colour is identical to before.

Files you may change: `src/app/globals.css`, `src/components/**`, `src/app/**/*.tsx`, `tests/ui-design-tokens.test.ts`; create `docs/ui-redesign/token-inventory.md`. Do not change layout, spacing, copy or behaviour.
