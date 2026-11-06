# ExamMix Pro (Next.js + Supabase)

Phase 1 of the migration from the legacy single-file `legacy/index.html` app
to a real multi-user Next.js + Supabase application. See
`/Users/khanhdang/.claude/plans/purring-questing-lamport.md` for the full
migration plan and rationale.

## Phase 1 scope

Auth (email/password + Google), Dashboard, Ngân hàng câu hỏi, Trộn đề thi,
Chấm điểm nhanh (OMR) + in phiếu trả lời, Thống kê, Admin (user management +
system stats).

## Phòng thi trực tuyến (Realtime exam room)

The legacy LAN exam room depended on a companion desktop EXE running a local
HTTP server — no equivalent exists in a pure web app, so this was rebuilt on
Supabase Realtime instead of ported. Design decision: students still get
their exam content exactly as before (teacher distributes the Word file
produced by Trộn đề thi — this was **not** rebuilt as an in-browser
question-rendering UI, which would be a much larger project involving
converting Word content, including equations/images, to a web format).
What's new is the session itself: a teacher creates a room with one or more
exam-code answer keys, gets a join code + QR, opens the room, and watches a
live (Supabase Realtime-subscribed) roster as students join via `/join/<code>`,
type in their answer string (same model as the OMR grader), and submit —
scored instantly with the same `gradeQuick` logic, with results mirrored into
`exam_results` so they also show up in Thống kê. See `src/features/exam-room/`
(teacher actions, authenticated) and `src/features/exam-room/public-actions.ts`
(student join/submit, deliberately unauthenticated — see the comment there
and in `supabase/schema.sql` for the security model).

A future iteration of the exam room could pull answer keys directly from a
saved exam-mixer config instead of requiring the teacher to re-type them.

## Gemini AI

`/gemini-ai`: each user pastes their own Gemini API key (stored in
`profiles.gemini_api_key`); `generateWithGemini` in
`src/features/gemini/actions.ts` fetches it server-side and calls the
Gemini API from the server — the key never reaches the browser, unlike the
legacy app's direct client-side fetch to the same endpoint. The model id is
a constant at the top of that file (`GEMINI_MODEL`); bump it if Google
retires the current one. Generated text can be saved straight into the
question bank as a quick-and-dirty capture (freeform content/answer, not
auto-parsed into structured questions).

## Lớp học LIVE

`/classroom-tools`: the legacy "LIVE classroom" was always single-device,
local-only UI (no real networking despite the name) — confirmed before
porting. Rebuilt as a tabbed toolkit: roster + spin-the-wheel (rosters now
in a real `classes` table instead of per-browser localStorage, so they
follow the teacher across devices), scoreboard + buzzer (4 teams, Q/W/E/R
hotkeys), countdown timer, and a quiz mode that pulls straight from the
existing Ngân hàng câu hỏi (an improvement over the legacy version, which
required a separate `.docx` parse just for this). Not ported: Presentation
Studio (slide builder) and the Whiteboard panel — lower-value, skipped.

## Học viện tri thức

`/academy`: this turned out to be a game portal, not a lesson library — 18
self-contained offline arcade quiz games (math, physics, literature,
finance, etc.), one per subject, bundled as base64 blobs inside one giant
JS constant in the legacy file. Extracted verbatim (no content rewritten)
to `public/academy-games/*.html`, served via iframe; `src/lib/academy-games.ts`
holds the real menu metadata (icon/name/description) pulled from the source.

## Phòng thí nghiệm ảo

`/virtual-lab`: ~330 builtin Vật lí (physics) simulations/mini-games,
mechanically extracted the same way as the academy games (self-contained
HTML blobs, just spread across ~20 JS functions instead of one constant) to
`public/lab-library/*.html`, with metadata in `src/lib/lab-library.ts`.
Teachers can also add their own labs — upload an `.html` file or paste a
link — stored in the new `custom_labs` table (`content_html` or
`content_url`, never both; see the check constraint in `schema.sql`). The
legacy "license" and "deleted builtin lab" bookkeeping were confirmed
purely cosmetic/non-blocking and were not ported.

## Game Center

`/game-center`: 13 real mini-games (not a bundled file like the two
features above) with their own DOM/CSS animation engines, sharing one
question bank. Per an explicit product decision, this was embedded as the
original HTML/CSS/JS verbatim (`public/game-center/index.html`, served via
iframe) rather than rewritten in React — porting 13 distinct game engines
properly would be a much larger separate effort.

The embedded page's own "Tải file Word lên" button is **not functional** in
this port — it depends on a WMF/EMF image-decoding closure
(`classroomQuestionFromParsed`/`classroomBuildMediaContext`) that wasn't
traced/ported (a separate, large effort akin to the exam-mixer port). Per
another explicit decision, this was worked around instead of fixed: `/game-center`'s
page (`GameCenterLoader`) fetches the teacher's own Ngân hàng câu hỏi and
writes it into `localStorage['gc_bank_v96_sample_standard']` — the exact key
the embedded page reads on load — via `buildGameCenterBank()` in
`src/lib/logic/gameCenterBank.ts`. This works because the iframe is
same-origin, so it shares `localStorage` with the parent page; no changes to
the embedded file were needed. MCQ questions are heuristically detected (a
freeform "A. ... B. ... C. ... D. ..." pattern in `content` plus a single
A-D `answer`) since the question bank never stored options as separate
fields (neither did the legacy app's); anything that doesn't match that
pattern loads as Game Center's "short answer" type instead.

## Setup

1. **Create a Supabase project** at <https://supabase.com>.
2. **Run the schema**: open the SQL editor and run `supabase/schema.sql`
   (on a fresh project — the `create policy` statements aren't idempotent,
   so re-running the whole file against a project that already has it
   applied will error on duplicate policies; if you're adding the exam-room
   tables to an already-deployed project, run only section 5 of the file).
3. **Enable Google OAuth**: Supabase dashboard → Authentication → Providers →
   Google. You'll need a Google OAuth client ID/secret from the
   [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   (Authorized redirect URI: `https://<your-project>.supabase.co/auth/v1/callback`).
4. **Copy env vars**: `cp .env.local.example .env.local` and fill in, from
   Project Settings → API Keys:
   - `NEXT_PUBLIC_SUPABASE_URL` — the Project URL.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the **anon key** on older projects, or
     the **Publishable key** (`sb_publishable_...`) on newer ones that use
     Supabase's renamed key system. Either works, same env var.
   - `SUPABASE_SERVICE_ROLE_KEY` — the **service role key** (older), or the
     **Secret key** (`sb_secret_...`) under a "Secret keys" section on newer
     projects — create one there if none exists yet. **Never** expose this
     to the client; it's only used server-side in the admin area
     (`src/lib/supabase/admin.ts`).
5. **Install deps and run**:
   ```bash
   npm install
   npm run dev
   ```
6. **Promote your first admin** (after registering/logging in once):
   ```sql
   update public.profiles set role = 'admin' where id = '<your-auth-user-uuid>';
   ```
   Find the UUID in Supabase → Authentication → Users.

## Project structure

- `src/components/atoms` / `molecules` / `organisms` — design-system layers.
- `src/features/<domain>` — Server Actions + queries per feature (auth,
  question-bank, exam-mixer, omr, stats, admin). This is where API calls
  live, not inside components.
- `src/lib/supabase` — browser/server/middleware/admin Supabase clients.
- `src/lib/logic` — pure business logic ported from the legacy app:
  `scoring.ts` (OMR grading formula), `answerSheet.ts` (printable sheet
  generator), `xlsx.ts` (hand-rolled XLSX writer), `docx/legacy-mixer.ts`
  (the DOCX exam-mixer pipeline — see note below).
- `supabase/schema.sql` — table definitions + RLS policies.

## About `src/lib/logic/docx/legacy-mixer.ts`

The legacy exam-mixer's DOCX parsing/shuffling pipeline is extremely
intricate (MathType/OLE preservation, clustered questions, English-exam
block detection, Word run-split quirks) — far too complex and risky to
hand-rewrite without real sample files to test against. Per an explicit
product decision, this file is a **mechanical, verbatim port** of the real
functions from `legacy/index.html` (traced via an AST-based call-graph
closure, not manual guessing) rather than a reimplementation. Before trusting
it with real exam files, verify it against actual sample `.docx` files with
embedded equations/images — this has not yet been tested against real Word
output.

## Design tokens

`src/app/globals.css` reproduces the legacy app's color palette, radii, and
shadows exactly (see the plan file for the extracted hex values). Dark mode
is a `.dark` class on `<html>`, toggled by `ThemeToggle`, matching the
legacy `body.dark` behavior rather than relying on
`prefers-color-scheme`.
