# Task D — Phase 1.2: Three style-tile prototypes (static HTML, new files only)

Goal: let the team SEE and test the "社團吧台 (The Campus Bar)" direction from `docs/ui-redesign-plan.md` §3 before any production code changes. Read §3 carefully — it defines the concept, colour, type, shape, motion, illustration and voice rules. Also look at `public/brand/clubar-logo-1024.webp` (cream line-art on near-black: beer mug + wine glass on a bar table).

Build three variants that share layout and content and differ only in the variables:

| Variant | Signature accent | Display (headline) font |
| --- | --- | --- |
| A | 吧台燈琥珀 amber | Noto Serif TC (Google Fonts) |
| B | 酒紅 wine red | Noto Serif TC |
| C | 吧台燈琥珀 amber | jf open 粉圓 / jf-openhuninn (OFL; load from a public CDN such as jsDelivr; if no CDN works, say so and fall back to a rounded alternative, naming it) |

Shared by all: cream paper canvas (≈ oklch(97% 0.01 85)), warm espresso ink instead of zinc grey, body font Noto Sans TC, six domain colours (學術／藝文／康樂／體育／服務／聯誼) as soft background + text pairs, define all colours in OKLCH.

Each variant is ONE self-contained HTML file showing, side by side at 390px phone width:
1. **探索首頁 (Discover) mobile**: top bar with logo (`/brand/clubar-mark.png` → use relative path `../../../public/brand/clubar-mark.png`), headline 「今天哪裡有聚？」, domain chips, 2-column masonry of 4–6 cards mixing: event cards in the **ticket-stub** shape (punched notch + dashed divider between time/place and the RSVP action), and post cards that keep the original image ratio (use images from `public/images/examples/*.webp` via relative paths). Include one club mark in the **coaster** style (circle, domain colour, thin outer ring) with no cover image.
2. **活動頁 (Event page) mobile**: cover image, display-font title, key facts (date, place, 零基礎可/非社員可參加/免費 chips), sticky bottom RSVP bar with the accent primary button.
3. **Empty state + success**: a small line-art illustration in the logo's thick rounded-stroke style drawn as inline SVG (empty coffee cup: 「這張桌子還空著——第一個坐下吧」) and an RSVP-success toast 「位子幫你留好了」 with a 200–400ms stamp animation that is disabled under `prefers-reduced-motion`.
4. **Token sheet**: swatches with OKLCH values, and the WCAG contrast ratio of every text/background pair you used. Every text pair must be ≥ 4.5:1 (≥ 3:1 only for ≥ 24px text). Compute ratios with a small throwaway Node script (do not add dependencies) and print the numbers in the page.

Rules: Traditional Chinese UI copy (use realistic content: 中央大學熱舞社 HipHop 零基礎體驗社課, 創遊社 GameJam, 咖啡社 烘豆…). Interactive targets ≥ 44px. Visible focus ring. Brand accent ONLY on primary actions/current state (Apple HIG: branding defers to content). No external JS frameworks; Tailwind CDN is NOT allowed — plain CSS with custom properties.

Files to create (only these):
- `docs/ui-redesign/style-tiles/a-amber-serif.html`
- `docs/ui-redesign/style-tiles/b-wine-serif.html`
- `docs/ui-redesign/style-tiles/c-amber-rounded.html`
- `docs/ui-redesign/style-tiles/index.html` (links to the three, one-paragraph description each, in Traditional Chinese)

Self-check before reporting: screenshot each file with headless Edge (`"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new --disable-gpu --window-size=1400,1800 --virtual-time-budget=8000 --screenshot=<abs>.png file:///<abs path>`), save to `docs/ui-redesign/style-tiles/_preview/<variant>.png`, open them, and fix anything broken (missing images, fonts not loading, overflow). Report the contrast table minimums per variant.
