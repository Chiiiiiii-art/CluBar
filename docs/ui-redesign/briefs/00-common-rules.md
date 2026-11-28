> **[DEPRECATED — v1 Historical Brief]** Superseded by v2.5 (`docs/design/README.md` & `docs/ui-redesign/v2-tactile-research.md`). Do NOT treat `docs/ui-redesign-plan.md` or these briefs as current design spec.

# Common rules for every Gemini task (read first)

You are executing one task from `docs/ui-redesign-plan.md` (the UI redesign plan, written in Traditional Chinese). Read that plan before you start.

- Project: Next.js 15 + React 19 + Tailwind CSS v4, design tokens in `src/app/globals.css`, shared UI kit in `src/components/ui/`. A dev server is already running at http://localhost:3000 — do NOT start or stop it.
- Touch ONLY the files your task lists. Never edit `docs/clubar-srs.md` (it has the user's uncommitted work), `.env*`, `package.json`, or lockfiles. Do not install dependencies.
- Never run `git commit`, `git push`, `git checkout`, `git reset`, `git stash` or anything that changes branches or history. Leave changes uncommitted.
- Do not delete files you did not create.
- Use subagents in parallel where the work splits cleanly.
- When finished, reply in English with a SHORT report (max ~25 lines): files created/changed, commands run and their results (pass/fail), anything you could not do and why. No narration.
