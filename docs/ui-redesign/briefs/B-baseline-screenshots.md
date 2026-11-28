> **[DEPRECATED — v1 Historical Brief]** Superseded by v2.5 (`docs/design/README.md`).

# Task B — Phase 0.3: Visual baseline screenshots

Goal: capture the CURRENT look of key pages before any redesign, for before/after comparison and regression checks.

Pages (logged-out is fine): `/`, `/?tab=events` (or however the 近期活動 tab is reached — check `DiscoverClient`), `/e/ncu-dn-01`, `/e/ncu-art-01`, `/clubs/ncu-gamedev`, `/clubs/ncu-guitar`, `/onboarding`, `/together`, `/login`, `/u/xiaoming-ncu`, `/clubs/apply`. Skip any that 404 and note it.

Viewports: 390×844 (mobile) and 1440×900 (desktop).

Recommended method (no new dependencies): Microsoft Edge headless is installed at `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`:
`msedge --headless=new --disable-gpu --hide-scrollbars --window-size=390,844 --screenshot=<abs path>.png http://localhost:3000/...`
Use `--virtual-time-budget=8000` so images load. Also take a full-height variant for mobile if you can (e.g. a tall window such as 390×3000) — name it `*-full.png`.

Output:
- PNGs in `.ui-baseline/` at the repo root, named `<page-slug>-<mobile|desktop>[-full].png`.
- Add the line `.ui-baseline/` to `.gitignore` (append only).
- `.ui-baseline/README.md` listing each file, URL, viewport, and capture time.
- Open 2–3 of the PNGs yourself to confirm they are not blank/error pages; report any that are.

Only files you may create/change: `.ui-baseline/**`, and append one line to `.gitignore`.
