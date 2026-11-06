-- ExamMix Phase 1 schema. Run against a fresh Supabase project
-- (SQL editor or `supabase db push`). Idempotent via IF NOT EXISTS where
-- practical.

-- 1. Profiles -----------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'teacher' check (role in ('teacher', 'admin')),
  display_name text,
  gemini_api_key text, -- Phase 2: per-user Gemini key, stored as pasted.
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

create policy "profiles_select_own_or_admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid());

create policy "profiles_update_admin" on public.profiles
  for update using (public.is_admin());

-- New auth user -> profile row.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. Questions (Ngân hàng câu hỏi) --------------------------------------
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null default '',
  topic text not null default '',
  type text not null default '',
  content text not null default '',
  answer text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists questions_user_id_idx on public.questions(user_id);

alter table public.questions enable row level security;

create policy "questions_select_own_or_admin" on public.questions
  for select using (user_id = auth.uid() or public.is_admin());

create policy "questions_insert_own" on public.questions
  for insert with check (user_id = auth.uid());

create policy "questions_update_own" on public.questions
  for update using (user_id = auth.uid());

create policy "questions_delete_own" on public.questions
  for delete using (user_id = auth.uid());

-- 3. Exam results (Thống kê / OMR quick-grade) --------------------------
create table if not exists public.exam_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  student_name text not null default '',
  class_name text not null default '',
  exam_code text not null default '',
  correct integer not null default 0,
  total integer not null default 0,
  score numeric not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists exam_results_user_id_idx on public.exam_results(user_id);

alter table public.exam_results enable row level security;

create policy "exam_results_select_own_or_admin" on public.exam_results
  for select using (user_id = auth.uid() or public.is_admin());

create policy "exam_results_insert_own" on public.exam_results
  for insert with check (user_id = auth.uid());

create policy "exam_results_delete_own" on public.exam_results
  for delete using (user_id = auth.uid());

-- 4. Exam mixer configs (Trộn đề thi) ------------------------------------
create table if not exists public.exam_mix_configs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Cấu hình trộn đề',
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists exam_mix_configs_user_id_idx on public.exam_mix_configs(user_id);

alter table public.exam_mix_configs enable row level security;

create policy "exam_mix_configs_select_own_or_admin" on public.exam_mix_configs
  for select using (user_id = auth.uid() or public.is_admin());

create policy "exam_mix_configs_insert_own" on public.exam_mix_configs
  for insert with check (user_id = auth.uid());

create policy "exam_mix_configs_update_own" on public.exam_mix_configs
  for update using (user_id = auth.uid());

create policy "exam_mix_configs_delete_own" on public.exam_mix_configs
  for delete using (user_id = auth.uid());

-- 5. Exam rooms (Phòng thi trực tuyến — Supabase Realtime rebuild of the
--    legacy LAN exam room). Students never authenticate; all participant
--    reads/writes go through Server Actions using the service-role client,
--    so there are deliberately NO insert/update/delete policies for
--    exam_room_participants below — only the service role (which bypasses
--    RLS) can write, while teachers can only SELECT their own room's roster.
create table if not exists public.exam_rooms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Phòng thi',
  join_code text not null unique,
  status text not null default 'draft' check (status in ('draft', 'open', 'closed')),
  duration_minutes integer not null default 45,
  scale numeric not null default 10,
  auto_submit boolean not null default true,
  show_score_after_submit boolean not null default true,
  started_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists exam_rooms_user_id_idx on public.exam_rooms(user_id);
create index if not exists exam_rooms_join_code_idx on public.exam_rooms(join_code);

alter table public.exam_rooms enable row level security;

create policy "exam_rooms_select_own_or_admin" on public.exam_rooms
  for select using (user_id = auth.uid() or public.is_admin());
create policy "exam_rooms_insert_own" on public.exam_rooms
  for insert with check (user_id = auth.uid());
create policy "exam_rooms_update_own" on public.exam_rooms
  for update using (user_id = auth.uid());
create policy "exam_rooms_delete_own" on public.exam_rooms
  for delete using (user_id = auth.uid());

create table if not exists public.exam_room_variants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.exam_rooms(id) on delete cascade,
  code text not null,
  answer_key text not null,
  created_at timestamptz not null default now(),
  unique (room_id, code)
);

alter table public.exam_room_variants enable row level security;

create policy "exam_room_variants_select_own_or_admin" on public.exam_room_variants
  for select using (
    exists (
      select 1 from public.exam_rooms r
      where r.id = room_id and (r.user_id = auth.uid() or public.is_admin())
    )
  );
create policy "exam_room_variants_insert_own" on public.exam_room_variants
  for insert with check (
    exists (select 1 from public.exam_rooms r where r.id = room_id and r.user_id = auth.uid())
  );
create policy "exam_room_variants_delete_own" on public.exam_room_variants
  for delete using (
    exists (select 1 from public.exam_rooms r where r.id = room_id and r.user_id = auth.uid())
  );

create table if not exists public.exam_room_participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.exam_rooms(id) on delete cascade,
  client_token uuid not null default gen_random_uuid(),
  display_name text not null default '',
  class_name text not null default '',
  variant_code text not null default '',
  status text not null default 'joined' check (status in ('joined', 'submitted')),
  student_answers text,
  correct integer,
  total integer,
  score numeric,
  joined_at timestamptz not null default now(),
  submitted_at timestamptz
);

create index if not exists exam_room_participants_room_id_idx on public.exam_room_participants(room_id);

alter table public.exam_room_participants enable row level security;
alter table public.exam_room_participants replica identity full;

create policy "exam_room_participants_select_own_or_admin" on public.exam_room_participants
  for select using (
    exists (
      select 1 from public.exam_rooms r
      where r.id = room_id and (r.user_id = auth.uid() or public.is_admin())
    )
  );

-- Enable Realtime change feeds for the live teacher roster view.
alter publication supabase_realtime add table public.exam_room_participants;

-- 6. Classes (Lớp học LIVE roster — the legacy classroom toolkit stored
--    rosters in localStorage per-browser; this moves them to a real table so
--    a teacher's class lists follow them across devices). Scoreboard/buzzer/
--    timer state is intentionally NOT persisted here — it's genuinely
--    per-lesson ephemeral in the legacy app too, kept client-side only.
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Lớp học',
  students jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists classes_user_id_idx on public.classes(user_id);

alter table public.classes enable row level security;

create policy "classes_select_own_or_admin" on public.classes
  for select using (user_id = auth.uid() or public.is_admin());
create policy "classes_insert_own" on public.classes
  for insert with check (user_id = auth.uid());
create policy "classes_update_own" on public.classes
  for update using (user_id = auth.uid());
create policy "classes_delete_own" on public.classes
  for delete using (user_id = auth.uid());

-- 7. Custom labs (Phòng thí nghiệm ảo — teacher-added simulations on top of
--    the 329 bundled builtin ones, which ship as static files + a metadata
--    list in the app itself, not in this table). Either content_html
--    (an uploaded .html file's contents) or content_url (an external link)
--    is set, never both.
create table if not exists public.custom_labs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'lab' check (kind in ('lab', 'game')),
  subject text not null default '',
  grade text not null default '',
  title text not null default '',
  description text not null default '',
  content_html text,
  content_url text,
  created_at timestamptz not null default now(),
  constraint custom_labs_content_check check (
    (content_html is not null and content_url is null) or
    (content_html is null and content_url is not null)
  )
);

create index if not exists custom_labs_user_id_idx on public.custom_labs(user_id);

alter table public.custom_labs enable row level security;

create policy "custom_labs_select_own_or_admin" on public.custom_labs
  for select using (user_id = auth.uid() or public.is_admin());
create policy "custom_labs_insert_own" on public.custom_labs
  for insert with check (user_id = auth.uid());
create policy "custom_labs_update_own" on public.custom_labs
  for update using (user_id = auth.uid());
create policy "custom_labs_delete_own" on public.custom_labs
  for delete using (user_id = auth.uid());

-- 8. Promote the first admin manually, e.g.:
-- update public.profiles set role = 'admin' where id = '<your-auth-user-uuid>';
