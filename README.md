# ExamMix Pro (Next.js + Supabase)

Phase 1 of the migration from the legacy single-file `legacy/index.html` app
to a real multi-user Next.js + Supabase application. See
`/Users/khanhdang/.claude/plans/purring-questing-lamport.md` for the Phase 1
plan and `/Users/khanhdang/.claude/plans/parsed-greeting-pebble.md` for the
Phase 2 UI/UX-reconciliation plan described below.

## Phase 1 scope (superseded — see Phase 2)

Original Phase 1 scope was Auth, Dashboard, Ngân hàng câu hỏi, Trộn đề thi,
Chấm điểm nhanh (OMR) + in phiếu trả lời, Thống kê, Admin. Several of these
(`Ngân hàng câu hỏi`, `Chấm điểm nhanh`, `Thống kê`, `Admin`) were Next.js-only
additions with **no tab in the legacy app's own nav** — confirmed by grepping
`Exam_mix_6_nov.html`'s nav markup, which only has: Trang chủ, Trộn đề thi,
Lớp học LIVE, Học viện tri thức, Phòng thí nghiệm ảo, Gemini AI, Game Center.
Phase 2 (below) removed those extra pages/routes to bring the app back to
exactly the legacy feature set, and is now reconciling each remaining page's
UI/UX against the legacy reference file one feature at a time.

## Phase 2 — UI/UX reconciliation against `Exam_mix_6_nov.html`

The original legacy file this app was ported from turned out to be an older
snapshot; `/Users/khanhdang/Projects/exam_mix/Exam_mix_6_nov.html` (not in
`legacy/`, different hash from every file there) is the current/authoritative
reference. A feature-by-feature audit against it found that most of Phase
1's "ported" features only carried over the core logic, not the full
UI/UX — see the Phase 2 plan file for the complete dossier. Status so far:

- **Done**: sidebar/route pruned to the legacy 7-tab set (dashboard +
  6 features); `src/app/(dashboard)/dashboard` cleaned to drop the
  Next.js-only "Tổng quan của bạn" stats section.
- **Done — Trộn đề thi**: `ExamMixerPanel` was a single flat form exposing
  ~4 of the legacy screen's ~25 controls. Rebuilt into Easy/Advanced modes
  with the full header-metadata block, the "chọn câu trước khi trộn"
  question selector, custom/auto exam-code settings, fixed-item locking,
  full output-format selection (Word/merged/answer-key Word/Excel/TNMaker
  QR/print manifest, bundled into one ZIP via `buildExportZip`), the author
  guide, and the "kiểm định nâng cao" verification panel (source inspection,
  self-tests, session save/restore, report/log download). All of this reuses
  options `buildVariant`/`analyzeSourceXml` already accepted (em217SelectedIds,
  fixedQuestionNums, fixedTFItems, header injection, etc.) — see
  `src/lib/logic/docx/generate.ts`, `mixerSession.ts`, `questionPicker.ts`.
  **Explicitly deferred** (not silently dropped — flagged here like the
  Presentation Studio/Whiteboard exclusions below): legacy's
  `exammixSpaceAudit` (safe whitespace/label auto-fix with undo),
  `em175Review` (option-label integrity review), and
  `exammixRunIntegritySelfTest` (the real OOXML-level A–D/Đ–S recognizer
  self-test, distinct from the lightweight `runIntegrityTests` ported here)
  were not ported — they mutate `document.xml` directly and need the same
  careful AST-traced porting `legacy-mixer.ts` got, with real sample `.docx`
  files to verify against. The "tải bản sao Word bôi vàng câu lỗi" highlighted
  download is deferred for the same reason. `buildMergedDocxBlob` (used by
  "Đề ghép Word"/"File ghép ĐỂ IN") is new code (concatenates each variant's
  body into one document) rather than a port — verify it against a real
  multi-variant source file before relying on it for printing.
- **Not started**: Lớp học LIVE (missing Presentation Studio, an
  undocumented "Active Lesson 2.0" 5E lesson player, Whiteboard, "Chia nhóm
  nhanh", "Câu hỏi ngẫu nhiên"), Học viện tri thức (missing the grade-level
  curriculum/Question Registry/Game Show builder layer beneath the 18-game
  shelf), Phòng thí nghiệm ảo (missing lesson-grouped navigation), Gemini AI
  (missing the "xu ExamMix" coin system, docx-context "generate similar
  exam" flow, and the sibling Matrix AI generator), Game Center (UI already
  matches legacy verbatim; only the native Word-upload parser is still a
  workaround). See the Phase 2 plan file for the full per-feature dossier.

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
     to the client; it's only used server-side (`src/lib/supabase/admin.ts`).
5. **Install deps and run**:
   ```bash
   npm install
   npm run dev
   ```

## Project structure

- `src/components/atoms` / `molecules` / `organisms` — design-system layers.
- `src/features/<domain>` — Server Actions + queries per feature (auth,
  exam-mixer, classroom, academy, virtual-lab, gemini, game-center). This is
  where API calls live, not inside components. `features/question-bank`
  has no page of its own anymore (see Phase 2 above) but its Server Actions
  are still a real dependency of classroom-tools, game-center, and the
  Gemini "Lưu vào ngân hàng câu hỏi" button — don't delete it.
- `src/lib/supabase` — browser/server/middleware clients (no more
  `admin.ts` consumer now that the admin page is gone — kept for when an
  admin surface is reintroduced, since the `profiles.role` column and RLS
  policies for it are still in `schema.sql`).
- `src/lib/logic` — pure business logic ported from the legacy app:
  `answerSheet.ts` (printable sheet generator), `xlsx.ts` (hand-rolled XLSX
  writer), `docx/legacy-mixer.ts` (the DOCX exam-mixer pipeline — see note
  below), `docx/generate.ts`/`mixerSession.ts`/`questionPicker.ts` (Phase 2
  orchestration/UI-state glue around legacy-mixer.ts, not ports themselves).
  `scoring.ts` (OMR's `gradeQuick`) was removed along with OMR/exam-room —
  re-port it from `Exam_mix_6_nov.html:8945` if either feature comes back.
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
