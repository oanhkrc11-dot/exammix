# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

ExamMix Pro: Phase 1 of migrating a legacy single-file app (`legacy/index.html`,
~21MB, ~11.6k lines — a Vietnamese exam-tooling suite for teachers) to a
multi-user Next.js + Supabase application. The legacy file (and its sibling
variants in `legacy/`) is reference material to port *from*, not something to
edit. The full migration plan/rationale lives at
`/Users/khanhdang/.claude/plans/purring-questing-lamport.md`.

Read `README.md` before starting any feature work — it documents, per
feature, what was ported, what was deliberately *not* ported, and why
(e.g. Game Center and Academy are embedded legacy HTML/JS verbatim via
iframe, not rewritten in React; the exam room is a from-scratch Realtime
redesign with no legacy equivalent; the DOCX exam-mixer pipeline is a
mechanical AST-traced port, not a reimplementation, and is unverified
against real sample files with embedded equations/images).

## Commands

```bash
npm run dev      # start dev server (Turbopack)
npm run build    # production build
npm run start    # run production build
npm run lint      # eslint (eslint-config-next core-web-vitals + typescript)
```

There is no test suite (no test runner configured, no `*.test.ts`/`*.spec.ts`
files). Playwright is a devDependency used only for one-off inspection
scripts in `scripts/` (`inspect-legacy-ui*.mjs`) against the legacy HTML, not
for automated tests. Verify changes by running `npm run lint` and exercising
the feature via `npm run dev`.

## Architecture

- `src/app/(auth)/*` — login/register/forgot-password/reset-password routes.
- `src/app/(dashboard)/*` — one route segment per feature (question-bank,
  exam-mixer, omr, exam-room, stats, admin, gemini-ai, classroom-tools,
  academy, virtual-lab, game-center). Route group only affects layout, not URL.
- `src/app/join/[code]` — unauthenticated student entry point for the
  realtime exam room.
- `src/features/<domain>/` — Server Actions (`actions.ts`, `"use server"`)
  and queries per feature. **This is where Supabase calls live — not inside
  components.** Pattern: build a server client via
  `createClient()` from `@/lib/supabase/server`, check `auth.getUser()` for
  mutations that need an owner, throw a `new Error(message)` on Supabase
  errors (components surface these as-is), call `revalidatePath()` after
  mutations. `src/features/exam-room/public-actions.ts` is the one
  deliberate exception — unauthenticated by design for student join/submit;
  see the comment there and in `supabase/schema.sql` for the security model
  this depends on (students never get a Supabase session).
- `src/lib/supabase/` — `client.ts` (browser), `server.ts` (server
  components/actions, cookie-based), `middleware.ts` (session refresh),
  `admin.ts` (service-role client — **server-only**, used only in the admin
  feature; never import it anywhere reachable from client code), `types.ts`
  (hand-maintained `Database` type — update it manually when `schema.sql`
  changes, there's no generator wired up).
- `src/lib/logic/` — pure business logic ported from the legacy app, no
  Supabase/React dependency: `scoring.ts` (OMR grading, `gradeQuick` — also
  reused live by the exam room), `answerSheet.ts` (printable OMR sheet
  generator), `xlsx.ts` (hand-rolled XLSX writer, no external library),
  `logic/docx/legacy-mixer.ts` (the DOCX exam-mixer pipeline — treat as a
  verbatim port; don't "clean up" its structure without checking it against
  the traced legacy functions first, see README for why).
- `src/components/atoms` / `molecules` / `organisms` — design-system layers,
  in that dependency direction (organisms compose molecules/atoms, not
  reverse). `src/app/globals.css` reproduces the legacy app's exact color
  tokens/radii/shadows. Dark mode is a `.dark` class on `<html>` (toggled by
  `ThemeToggle`), not `prefers-color-scheme` — match this when adding
  themed styles.
- `supabase/schema.sql` — table definitions + RLS policies. Not idempotent
  (`create policy` has no `if not exists`): only safe to run in full against
  a fresh project. Adding new tables to an already-deployed project means
  running just the new section.
- `public/academy-games/*.html`, `public/lab-library/*.html`,
  `public/game-center/index.html` — self-contained legacy HTML blobs served
  via iframe, extracted verbatim. Don't attempt to rewrite these into React;
  that was an explicit scope decision per feature (see README). Metadata
  describing them lives in `src/lib/academy-games.ts` / `src/lib/lab-library.ts`.

## Environment / secrets

Required env vars (see `.env.local.example`): `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. The service
role key must never reach client code — it's only read inside
`src/lib/supabase/admin.ts` and action files under `src/features/admin/`.
Gemini API keys are per-user, stored in `profiles.gemini_api_key`, and read
server-side only (`src/features/gemini/actions.ts`) — never sent to the browser.
