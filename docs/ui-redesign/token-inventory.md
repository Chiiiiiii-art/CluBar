# CluBar Colour Token Inventory & Semantic Migration (Phase 0.4)

Date: 2026-11-27
Scope: `src/**/*.tsx` (excluding `src/app/api/og/**` PNG generators) and `src/components/ui/styles.ts`.

## 1. Pre-Migration Inventory (1,127 total occurrences, 96 distinct base utilities)

Base utility counts across `src/**/*.tsx` (except `src/app/api/og/**`) and `src/components/ui/styles.ts` (state prefixes such as `hover:`, `focus:`, `group-hover:`, `disabled:` collapsed into the base utility):

| Base utility | Count | Category | Migration target |
| :--- | ---: | :--- | :--- |
| `text-ink-900` | 161 | Neutral fg | `text-fg` |
| `bg-white` | 88 | Surface bg | `bg-surface` |
| `text-ink-600` | 86 | Neutral fg | `text-fg-muted` |
| `border-line` | 85 | Semantic border (existing) | `border-line` |
| `text-ink-800` | 75 | Neutral fg | `text-fg-body` |
| `text-ink-700` | 71 | Neutral fg | `text-fg-secondary` |
| `text-ink-500` | 59 | Neutral fg | `text-fg-subtle` (incl. `placeholder:`, `disabled:`) |
| `text-accent-600` | 44 | Brand fg | `text-brand` |
| `border-ink-300` | 41 | Neutral border | `border-border-strong` |
| `bg-ink-50` | 41 | Neutral bg | `bg-surface-subtle` |
| `bg-ink-100` | 38 | Neutral bg | `bg-surface-sunken` |
| `text-white` | 29 | Inverse fg | `text-on-brand` (15 on brand/danger/success); `text-white` (14 left on dark ink/warning/overlay) |
| `text-accent-700` | 26 | Brand fg | `text-brand-soft-fg` |
| `bg-accent-50` | 19 | Brand bg | `bg-brand-soft` |
| `text-danger-700` | 13 | Status fg | `text-danger-fg` |
| `text-success-700` | 13 | Status fg | Left on primitives |
| `text-accent-900` | 12 | Brand fg | `text-brand-soft-fg` (1 in `States.tsx`), 11 left on primitives |
| `bg-accent-100` | 10 | Brand bg | `bg-brand-soft-hover` |
| `border-accent-200` | 10 | Brand border | `border-brand/25` (1 in `States.tsx`), 9 left on primitives |
| `bg-ink-900` | 9 | Dark bg | `bg-fg` (1 in `Chip.tsx`), 8 left on primitives |
| `bg-danger-50` | 9 | Status bg | `bg-danger-soft` |
| `divide-line` | 9 | Semantic divider (existing) | `divide-line` |
| `bg-accent-600` | 9 | Brand bg | `bg-brand` |
| `bg-success-50` | 8 | Status bg | `bg-success-soft` |
| `border-ink-200` | 7 | Neutral border | `border-line` |
| `bg-warning-50` | 7 | Status bg | `bg-warning-soft` |
| `text-accent-800` | 7 | Brand fg | Left on primitives |
| `border-danger-200` | 6 | Status border | `border-danger/25` (1 in `States.tsx`), 5 left on primitives |
| `text-warning-900` | 6 | Status fg | `text-warning-fg` |
| `text-success-800` | 6 | Status fg | `text-success-fg` |
| `bg-danger-600` | 5 | Status bg | `bg-danger` |
| `border-ink-900` | 4 | Dark border | `border-fg` |
| `bg-surface` | 4 | Semantic surface (existing) | `bg-surface` |
| `bg-success-600` | 4 | Status bg | `bg-success` |
| `border-accent-600` | 4 | Brand border | `border-brand` |
| `bg-accent-700` | 4 | Brand bg | `bg-brand-hover` |
| `text-ink-400` | 4 | Neutral fg | `text-fg-subtle` (1 in `States.tsx`), 3 left on primitives |
| `border-accent-300` | 4 | Brand border | Left on primitives |
| `bg-accent-50/70` | 4 | Brand bg | `bg-brand-soft/70` |
| `bg-ink-100/40` | 4 | Neutral bg | `bg-surface-sunken/40` |
| `bg-success-700` | 3 | Status bg | Left on primitives |
| `bg-white/95` | 3 | Surface bg | `bg-surface/95` |
| `border-warning-200` | 3 | Status border | `border-warning-fg/20` (1 in `States.tsx`), 2 left on primitives |
| `text-danger-600` | 3 | Status fg | `text-danger` |
| `border-warning-300` | 2 | Status border | Left on primitives |
| `text-warning-950` | 2 | Status fg | Left on primitives |
| `border-danger-300` | 2 | Status border | Left on primitives |
| `bg-success-500` | 2 | Status bg | Left on primitives |
| `text-danger-800` | 2 | Status fg | `text-danger-fg` (1 in `States.tsx`), 1 left on primitives |
| `bg-ink-100/50` | 2 | Neutral bg | `bg-surface-sunken/50` |
| `fill-current` | 2 | Keyword | `fill-current` |
| `accent-accent-600` | 2 | Brand accent | `accent-brand` |
| `bg-ink-800` | 2 | Dark bg | Left on primitives |
| `text-accent-950` | 2 | Brand fg | Left on primitives |
| `bg-success-800` | 2 | Status bg | Left on primitives |
| `text-ink-300` | 2 | Neutral fg | Left on primitives |
| `border-line-input` | 2 | Semantic border (existing) | `border-line-input` |
| `ring-accent-600/20` | 2 | Focus ring | `ring-focus-ring/20` |
| `decoration-ink-300` | 2 | Neutral decoration | `decoration-border-strong` |
| `border-success-200` | 2 | Status border | `border-success/25` (1 in `States.tsx`), 1 left on primitives |
| `bg-ink-200` | 2 | Neutral bg | Left on primitives |
| `text-success-900` | 2 | Status fg | `text-success-fg` (1 in `States.tsx`), 1 left on primitives |
| `divide-ink-200` | 1 | Neutral divider | `divide-line` |
| `text-warning-700` | 1 | Status fg | Left on primitives |
| `text-danger-950` | 1 | Status fg | Left on primitives |
| `bg-canvas` | 1 | Semantic canvas (existing) | `bg-canvas` |
| `bg-danger-100` | 1 | Status bg | Left on primitives |
| `text-danger-900` | 1 | Status fg | Left on primitives |
| `bg-warning-600` | 1 | Status bg | Left on primitives |
| `text-warning-800` | 1 | Status fg | Left on primitives |
| `text-accent-300` | 1 | Brand fg | Left on primitives |
| `bg-white/10` | 1 | Overlay bg | Left on primitives (`hover:bg-white/10`) |
| `bg-transparent` | 1 | Keyword | `bg-transparent` |
| `border-success-400` | 1 | Status border | Left on primitives |
| `bg-success-50/70` | 1 | Status bg | `bg-success-soft/70` |
| `bg-ink-50/50` | 1 | Neutral bg | `bg-surface-subtle/50` |
| `border-success-600` | 1 | Status border | Left on primitives |
| `bg-warning-900` | 1 | Status bg | Left on primitives |
| `bg-warning-950` | 1 | Status bg | Left on primitives |
| `bg-warning-500` | 1 | Status bg | Left on primitives |
| `bg-accent-200` | 1 | Brand bg | Left on primitives |
| `bg-accent-50/50` | 1 | Brand bg | `bg-brand-soft/50` |
| `divide-ink-100` | 1 | Neutral divider | Left on primitives |
| `border-ink-100` | 1 | Neutral border | Left on primitives |
| `bg-ink-900/75` | 1 | Overlay bg | Left on primitives |
| `bg-accent-50/60` | 1 | Brand bg | `bg-brand-soft/60` |
| `border-success-300` | 1 | Status border | Left on primitives |
| `text-success-950` | 1 | Status fg | Left on primitives |
| `bg-white/90` | 1 | Surface bg | `bg-surface/90` |
| `bg-ink-200/70` | 1 | Neutral bg | Left on primitives |
| `bg-ink-900/50` | 1 | Overlay bg | Left on primitives |
| `bg-ink-50/70` | 1 | Neutral bg | `bg-surface-subtle/70` |
| `bg-accent-800` | 1 | Brand bg | `active:bg-brand-active` |
| `bg-danger-700` | 1 | Status bg | `hover:bg-danger-hover` |
| `border-danger-600` | 1 | Status border | `border-danger` |
| `border-transparent` | 1 | Keyword | `border-transparent` |

Note: `src/components/ui/ClubMark.tsx` also held 8 inline hex swatches (`#4338ca`, `#0f766e`, `#b45309`, `#be123c`, `#6d28d9`, `#1d4ed8`, `#047857`, `#52525b`), now moved to `:root` custom properties `--color-mark-1` through `--color-mark-8` in `src/app/globals.css`.

## 2. Semantic Token Set (25 new + 4 existing = 29 in `@theme`)

| Semantic token | Primitive mapping | Resolved hex | Purpose |
| :--- | :--- | :--- | :--- |
| `canvas` *(existing)* | `#fafafa` | `#fafafa` | Page background |
| `surface` *(existing)* | `#ffffff` | `#ffffff` | Cards, dialogs, inputs, popovers |
| `line` *(existing)* | `#e4e4e7` | `#e4e4e7` | Hairline borders & dividers |
| `line-input` *(existing)* | `#a1a1aa` | `#a1a1aa` | Form control borders |
| `fg` | `var(--color-ink-900)` | `#18181b` | Primary text, headings, selected dark chip/tab border |
| `fg-body` | `var(--color-ink-800)` | `#27272a` | Body copy, field labels, secondary button text |
| `fg-secondary` | `var(--color-ink-700)` | `#3f3f46` | Chips, neutral badges, ghost buttons, metadata |
| `fg-muted` | `var(--color-ink-600)` | `#52525b` | Descriptions, subtitles, inactive tabs |
| `fg-subtle` | `var(--color-ink-500)` | `#71717a` | Placeholders, disabled text, captions, subtle icons |
| `surface-subtle` | `var(--color-ink-50)` | `#fafafa` | Subtle inset containers & secondary hover fill |
| `surface-sunken` | `var(--color-ink-100)` | `#f4f4f5` | Tracks, skeletons, neutral badges, disabled input bg |
| `border-strong` | `var(--color-ink-300)` | `#d4d4d8` | Hover borders, dashed empty-state borders |
| `brand` | `var(--color-accent-600)` | `#4f46e5` | Primary CTA fill, brand text/icons, active border |
| `brand-hover` | `var(--color-accent-700)` | `#4338ca` | Primary CTA hover fill |
| `brand-active` | `var(--color-accent-800)` | `#3730a3` | Primary CTA active fill |
| `on-brand` | `#ffffff` | `#ffffff` | Text/icons on solid brand/status/dark fills |
| `brand-soft` | `var(--color-accent-50)` | `#eef2ff` | Soft brand tint background |
| `brand-soft-hover` | `var(--color-accent-100)` | `#e0e7ff` | Soft brand hover background |
| `brand-soft-fg` | `var(--color-accent-700)` | `#4338ca` | Foreground on `brand-soft` |
| `focus-ring` | `var(--color-accent-600)` | `#4f46e5` | Focus outline & focus ring |
| `success` | `var(--color-success-600)` | `#059669` | Solid success fill & border |
| `success-soft` | `var(--color-success-50)` | `#ecfdf5` | Soft success background |
| `success-fg` | `var(--color-success-800)` | `#065f46` | Foreground on `success-soft` |
| `warning-soft` | `var(--color-warning-50)` | `#fffbeb` | Soft warning background |
| `warning-fg` | `var(--color-warning-900)` | `#78350f` | Foreground on `warning-soft` |
| `danger` | `var(--color-danger-600)` | `#dc2626` | Solid danger fill, required `*`, invalid border |
| `danger-hover` | `var(--color-danger-700)` | `#b91c1c` | Danger hover fill |
| `danger-soft` | `var(--color-danger-50)` | `#fef2f2` | Soft danger background |
| `danger-fg` | `var(--color-danger-700)` | `#b91c1c` | Foreground on `danger-soft` & error text |

- `src/components/ui/**` and `src/components/ui/styles.ts`: 100% migrated (enforced by `tests/ui-design-tokens.test.ts`).
- `src/components/*.tsx` and `src/app/**/*.tsx`: 1,007 / 1,127 (~89.4%) colour utility occurrences on semantic tokens + CSS keywords (`fill-current`, `bg-transparent`, `border-transparent`); 120 rare or non-1:1 occurrences left on primitives.

## 3. Left on Primitives

Every primitive colour utility remaining in `src/components/*.tsx` and `src/app/**/*.tsx` after 1:1 migration:

### `src/app/admin/page.tsx`
- `:26` `border-danger-200`

### `src/app/clubs/[slug]/evaluation/print/page.tsx`
- `:36` `border-danger-200`

### `src/app/clubs/[slug]/manage/page.tsx`
- `:63` `border-danger-200`
- `:70` `bg-ink-900`, `text-white`

### `src/app/clubs/[slug]/page.tsx`
- `:152` `border-warning-300`
- `:153` `text-warning-950`
- `:154` `text-warning-700`
- `:172` `border-danger-300`, `text-danger-950`
- `:217` `bg-success-500`
- `:318` `text-accent-800`
- `:336` `text-accent-900`

### `src/app/posts/[id]/page.tsx`
- `:165` `text-accent-900`

### `src/components/AdminClient.tsx`
- `:183` `text-accent-900`
- `:186` `bg-danger-100`, `text-danger-900`
- `:224` `text-accent-800`
- `:268` `hover:bg-success-700`
- `:277` `border-danger-300`
- `:302` `text-danger-800`
- `:335` `bg-warning-600`, `text-white`

### `src/components/BlendClient.tsx`
- `:124` `text-success-700`

### `src/components/ClubDetailClient.tsx`
- `:167` `text-success-700`
- `:213` `bg-ink-900`, `text-white`, `hover:bg-ink-800`
- `:217` `text-success-700`

### `src/components/ClubManageClient.tsx`
- `:694` `border-accent-200`, `text-accent-900`
- `:1017` `border-accent-200`
- `:1065` `text-warning-800`
- `:1072` `border-accent-200`, `text-accent-950`
- `:1077` `text-accent-800`
- `:1082` `text-accent-800`
- `:1207` `text-accent-800`
- `:1303` `hover:bg-success-700`, `active:bg-success-800`
- `:1310` `border-danger-200`
- `:1620` `border-warning-300`, `text-warning-950`

### `src/components/DiscoverClient.tsx`
- `:323` `bg-ink-900`, `text-white`
- `:324` `text-accent-300`
- `:327` `text-ink-300`
- `:340` `text-ink-300`, `hover:bg-white/10`, `hover:text-white`
- `:426` `text-ink-400`

### `src/components/EventCard.tsx`
- `:95` `text-ink-400`

### `src/components/EventPageClient.tsx`
- `:654` `border-success-200`
- `:663` `text-accent-800`, `border-accent-200`
- `:669` `border-accent-200`, `text-accent-800`
- `:673` `border-warning-200`
- `:717` `border-success-400`
- `:725` `text-success-700`
- `:752` `border-success-600`, `text-success-700`
- `:813` `border-warning-200`
- `:818` `bg-warning-900`, `text-white`, `hover:bg-warning-950`
- `:893` `bg-warning-500`, `text-white`
- `:947` `bg-accent-200`, `text-accent-950`
- `:1032` `border-accent-300`
- `:1100` `border-danger-200`
- `:1192` `divide-ink-100`
- `:1230` `border-ink-100`
- `:1349` `text-success-700`
- `:1384` `text-accent-900`

### `src/components/ImageUploader.tsx`
- `:155` `bg-ink-900/75`, `text-white`

### `src/components/MarkdownView.tsx`
- `:23` `border-accent-300`
- `:41` `hover:text-accent-900`

### `src/components/MeClient.tsx`
- `:386` `border-success-300`, `text-success-950`
- `:390` `bg-success-700`, `text-white`, `hover:bg-success-800`
- `:398` `border-accent-200`
- `:476` `border-accent-200`
- `:516` `border-accent-300`
- `:532` `border-accent-200`
- `:610` `border-accent-200`
- `:637` `hover:bg-ink-200`
- `:910` `text-success-700`
- `:959` `text-success-700`

### `src/components/MyClubsClient.tsx`
- `:195` `text-ink-400`
- `:238` `text-success-700`
- `:253` `text-accent-900`
- `:367` `text-success-700`

### `src/components/OnboardingClient.tsx`
- `:77` `bg-ink-200`
- `:317` `text-success-700`

### `src/components/PostCard.tsx`
- `:59` `group-hover:bg-ink-200/70`
- `:97` `bg-success-500`

### `src/components/PrintTriggerButton.tsx`
- `:10` `bg-ink-900`, `text-white`, `hover:bg-ink-800`

### `src/components/ReportModal.tsx`
- `:81` `bg-ink-900/50`
- `:101` `text-success-900`

### `src/components/ShareButton.tsx`
- `:28` `text-success-700`
- `:29` `text-success-700`

### `src/components/TogetherClient.tsx`
- `:418` `bg-ink-900`, `text-white`
- `:447` `text-accent-900`
- `:582` `bg-ink-900`, `text-white`
- `:610` `text-accent-900`
- `:692` `text-accent-900`
- `:716` `bg-ink-900`, `text-white`
- `:729` `border-accent-300`
- `:807` `text-accent-900`
- `:875` `bg-ink-900`, `text-white`

## Review notes (Claude, 2026-11-27)

- Gemini's first pass changed 8 values in `src/components/ui/States.tsx` (EmptyState icon tint, Notice borders/text). Restored to the exact original colours via new semantic tokens: `fg-faint` (ink-400, decorative only), `notice-{info,warning,danger,success}-border`, `notice-{info,danger,success}-fg`.
- Verified by script: all 794 class swaps in the diff resolve to identical colour values (`bg-white`→`bg-surface` and `text-white`→`text-on-brand` are both `#ffffff`).
- `npm run typecheck` pass; `npm test` 38/38 pass.
- Screenshot diff vs `.ui-baseline/before/`: 22 of 33 identical; the rest differ only by the Next.js dev indicator, the dismissible onboarding banner, or baseline captures that were blank.
