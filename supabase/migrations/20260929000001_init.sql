-- A+ Huquq 2.0 — boshlang'ich sxema
-- Xavfsizlik tamoyillari:
--   * To'g'ri javob (questions.answer) va izoh hech qachon mijozga to'g'ridan-to'g'ri berilmaydi —
--     ustun darajasidagi GRANT orqali yopilgan, tekshirish faqat serverda (service_role).
--   * Ball, urinish, obuna, to'lov jadvallariga mijoz yoza olmaydi — faqat server.
--   * profiles.role va telegram_id ni foydalanuvchi o'zi o'zgartira olmaydi.

-- ─────────────────────────── Turlar ───────────────────────────
create type public.user_role      as enum ('student', 'teacher', 'author', 'reviewer', 'admin');
create type public.user_goal      as enum ('abituriyent', 'oqituvchi', 'boshqa');
create type public.script_kind    as enum ('latin', 'cyrillic');
create type public.question_type  as enum ('single', 'multi', 'matching', 'ordering', 'fill_blank', 'case', 'open');
create type public.content_status as enum ('draft', 'review', 'published', 'archived');
create type public.content_source as enum ('import', 'author', 'ai');
create type public.attempt_mode   as enum ('practice', 'mock', 'review', 'daily', 'contest', 'assignment');
create type public.material_kind  as enum ('summary', 'video', 'flashcards', 'infographic');
create type public.payment_status as enum ('pending', 'paid', 'rejected', 'refunded');
create type public.payment_provider as enum ('manual', 'click', 'payme', 'uzum');
create type public.report_status  as enum ('open', 'accepted', 'rejected');

-- ─────────────────────────── Profil ───────────────────────────
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  full_name     text not null default '',
  avatar_url    text,
  role          public.user_role not null default 'student',
  goal          public.user_goal,
  region        text,
  script        public.script_kind not null default 'latin',
  telegram_id   bigint unique,
  telegram_username text,
  streak_days   int not null default 0,
  streak_best   int not null default 0,
  last_active_on date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- auth.users ga yangi foydalanuvchi qo'shilganda profil avtomatik yaratiladi
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (id, full_name, avatar_url, telegram_id, telegram_username)
  values (
    new.id,
    coalesce(meta ->> 'full_name', meta ->> 'name', ''),
    coalesce(meta ->> 'avatar_url', meta ->> 'picture'),
    nullif(meta ->> 'telegram_id', '')::bigint,
    meta ->> 'telegram_username'
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Rol tekshiruvchi yordamchilar (RLS ichida rekursiyasiz ishlashi uchun security definer)
create or replace function public.current_role_is(variadic roles public.user_role[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = any (roles));
$$;

-- ─────────────────────────── Kontent ───────────────────────────
-- 52 ta tavsiya etilgan qonunchilik hujjati
create table public.documents (
  id          serial primary key,
  number      int not null unique,                 -- ro'yxatdagi № (1–52)
  code        text not null unique,                -- v1 dagi kod: BAYROQ, SAYLOV, JK1 …
  title       text not null,
  short_title text,
  lex_url     text,
  priority    char(1) check (priority in ('A', 'B', 'C')),
  module      int check (module between 1 and 5),
  adopted_on  date,
  revised_on  date
);

-- Spetsifikatsiya bo'limlari (1.1 … 3.10) — rasmiy tafsilotdan
create table public.spec_sections (
  code   text primary key,                         -- '1.1', '3.7'
  parent text,                                     -- '1', '2', '3'
  title  text not null,
  sort   int not null default 0
);

create table public.topics (
  id          serial primary key,
  parent_id   int references public.topics (id) on delete cascade,
  document_id int references public.documents (id) on delete set null,
  spec_code   text references public.spec_sections (code) on delete set null,
  title       text not null,
  slug        text not null unique,
  sort        int not null default 0
);
create index topics_parent_idx on public.topics (parent_id);

create table public.articles (
  id          bigserial primary key,
  document_id int not null references public.documents (id) on delete cascade,
  number      text not null,                       -- '28', '245-1'
  title       text,
  body        text not null,
  revised_on  date,
  unique (document_id, number)
);

create table public.questions (
  id           bigserial primary key,
  type         public.question_type not null,
  stem         text not null,                      -- savol matni
  context      text,                               -- kazus sharti / raqamlangan fikrlar
  payload      jsonb not null default '{}'::jsonb, -- variantlar, juftliklar, qismlar (javobsiz!)
  answer       jsonb not null,                     -- MAXFIY: faqat server o'qiydi
  explanation  text,                               -- MAXFIY: javobdan keyin server qaytaradi
  rubric       jsonb,                              -- ochiq javob uchun baholash mezoni (AI)
  article_ids  bigint[] not null default '{}',
  source_note  text,                               -- manba (javobni oshkor qilmasligi kerak)
  topic_id     int references public.topics (id) on delete set null,
  document_id  int references public.documents (id) on delete set null,
  difficulty   smallint not null default 2 check (difficulty between 1 and 3),
  irt_b        real,                               -- kalibrlangan qiyinlik (keyinroq)
  cognitive    text check (cognitive in ('quyi', 'yuqori')),
  status       public.content_status not null default 'draft',
  source       public.content_source not null default 'author',
  legacy_key   text unique,                        -- v1 importi uchun (takror importdan himoya)
  author_id    uuid references public.profiles (id) on delete set null,
  reviewer_id  uuid references public.profiles (id) on delete set null,
  version      int not null default 1,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index questions_topic_idx on public.questions (topic_id) where status = 'published';
create index questions_doc_idx on public.questions (document_id) where status = 'published';
create index questions_status_idx on public.questions (status);
create trigger questions_touch before update on public.questions
  for each row execute function public.touch_updated_at();

create table public.materials (
  id        bigserial primary key,
  topic_id  int references public.topics (id) on delete cascade,
  kind      public.material_kind not null,
  title     text not null,
  body      text,                                  -- markdown yoki flashcard JSON
  url       text,                                  -- video havolasi
  is_premium boolean not null default false,
  status    public.content_status not null default 'draft',
  sort      int not null default 0
);

-- ─────────────────────────── Imtihon ───────────────────────────
-- Shablon: rasmiy spetsifikatsiya chiqqanda faqat shu yangilanadi
create table public.exam_templates (
  id           serial primary key,
  slug         text not null unique,
  title        text not null,
  duration_min int not null,
  -- { "sections":[{from,to,kind,types}], "closed_difficulty_mix":{…}, "points":{…} }
  blueprint    jsonb not null,
  raw_max      numeric(6,2) not null,              -- birlamchi maksimal ball (100)
  scale_max    numeric(6,2) not null,              -- shkala maksimumi (75)
  -- [{ "grade":"A+", "min":70 }, …]
  grades       jsonb not null,
  is_active    boolean not null default true
);

create table public.attempts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  mode         public.attempt_mode not null,
  template_id  int references public.exam_templates (id),
  topic_id     int references public.topics (id),
  assignment_id bigint,
  question_ids bigint[] not null,
  started_at   timestamptz not null default now(),
  deadline_at  timestamptz,
  finished_at  timestamptz,
  raw_score    numeric(6,2),
  scaled_score numeric(6,2),
  grade        text,
  correct_count int,
  breakdown    jsonb                               -- bo'lim/mavzu bo'yicha foizlar
);
create index attempts_user_idx on public.attempts (user_id, started_at desc);

create table public.attempt_answers (
  attempt_id  uuid not null references public.attempts (id) on delete cascade,
  question_id bigint not null references public.questions (id),
  response    jsonb not null,
  is_correct  boolean,
  points      numeric(5,2) not null default 0,
  time_ms     int,
  ai_feedback jsonb,                               -- { score, comment, missing[] }
  answered_at timestamptz not null default now(),
  primary key (attempt_id, question_id)
);

-- Takrorlash navbati (Leitner: 1 → 3 → 7 → 14 kun)
create table public.review_queue (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  question_id bigint not null references public.questions (id) on delete cascade,
  box         smallint not null default 1 check (box between 1 and 5),
  due_on      date not null default current_date,
  lapses      int not null default 0,
  primary key (user_id, question_id)
);
create index review_due_idx on public.review_queue (user_id, due_on);

-- Freemium limiti
create table public.daily_usage (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  day        date not null default current_date,
  questions  int not null default 0,
  mocks      int not null default 0,
  ai_calls   int not null default 0,
  primary key (user_id, day)
);

-- ─────────────────────────── To'lov ───────────────────────────
create table public.subscriptions (
  id         bigserial primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  plan       text not null default 'premium',
  starts_at  timestamptz not null default now(),
  ends_at    timestamptz not null,
  source     text not null default 'payment'     -- payment | group | promo
);
create index subscriptions_user_idx on public.subscriptions (user_id, ends_at desc);

create table public.payments (
  id           bigserial primary key,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  provider     public.payment_provider not null,
  amount_uzs   int not null check (amount_uzs > 0),
  months       int not null default 1,
  status       public.payment_status not null default 'pending',
  external_id  text,
  receipt_path text,                               -- qo'lda to'lov cheki (Storage)
  reviewed_by  uuid references public.profiles (id),
  created_at   timestamptz not null default now(),
  paid_at      timestamptz,
  unique (provider, external_id)
);

-- ─────────────────────────── O'qituvchi guruhlari ───────────────────────────
create table public.groups (
  id          bigserial primary key,
  teacher_id  uuid not null references public.profiles (id) on delete cascade,
  name        text not null,
  invite_code text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 10),
  grants_premium boolean not null default false,  -- "Kurs guruhi" a'zolariga Premium
  created_at  timestamptz not null default now()
);

create table public.group_members (
  group_id  bigint not null references public.groups (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user_idx on public.group_members (user_id);

create table public.assignments (
  id          bigserial primary key,
  group_id    bigint not null references public.groups (id) on delete cascade,
  title       text not null,
  mode        public.attempt_mode not null,
  topic_id    int references public.topics (id),
  template_id int references public.exam_templates (id),
  question_count int,
  due_at      timestamptz,
  created_at  timestamptz not null default now()
);
alter table public.attempts
  add constraint attempts_assignment_fk foreign key (assignment_id) references public.assignments (id) on delete set null;

-- Premium: faol obuna YOKI Premium beradigan guruhga ("Kurs guruhi") a'zolik
create or replace function public.is_premium() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.subscriptions s
                 where s.user_id = auth.uid() and now() between s.starts_at and s.ends_at)
      or exists (select 1 from public.group_members gm join public.groups g on g.id = gm.group_id
                 where gm.user_id = auth.uid() and g.grants_premium);
$$;

create or replace function public.teaches(student uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.group_members gm join public.groups g on g.id = gm.group_id
    where gm.user_id = student and g.teacher_id = auth.uid()
  );
$$;

create or replace function public.member_of(gid bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.group_members where group_id = gid and user_id = auth.uid());
$$;

-- ─────────────────────────── Motivatsiya ───────────────────────────
create table public.badges (
  code        text primary key,
  title       text not null,
  description text not null,
  icon        text
);

create table public.user_badges (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  badge_code text not null references public.badges (code) on delete cascade,
  earned_at  timestamptz not null default now(),
  primary key (user_id, badge_code)
);

create table public.contests (
  id          bigserial primary key,
  title       text not null,
  template_id int references public.exam_templates (id),
  question_ids bigint[],
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  is_premium  boolean not null default true
);

create table public.contest_entries (
  contest_id bigint not null references public.contests (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  attempt_id uuid references public.attempts (id) on delete set null,
  score      numeric(6,2),
  primary key (contest_id, user_id)
);

-- ─────────────────────────── Sifat va xarajat ───────────────────────────
create table public.reports (
  id          bigserial primary key,
  question_id bigint not null references public.questions (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  message     text not null check (char_length(message) between 3 and 1000),
  status      public.report_status not null default 'open',
  created_at  timestamptz not null default now()
);

create table public.ai_usage (
  id          bigserial primary key,
  user_id     uuid references public.profiles (id) on delete set null,
  purpose     text not null,                       -- grade_open | explain | generate
  model       text not null,
  input_tokens  int not null,
  output_tokens int not null,
  created_at  timestamptz not null default now()
);

-- ═══════════════════════════ Ruxsatlar (RLS + GRANT) ═══════════════════════════
alter table public.profiles        enable row level security;
alter table public.documents       enable row level security;
alter table public.spec_sections   enable row level security;
alter table public.topics          enable row level security;
alter table public.articles        enable row level security;
alter table public.questions       enable row level security;
alter table public.materials       enable row level security;
alter table public.exam_templates  enable row level security;
alter table public.attempts        enable row level security;
alter table public.attempt_answers enable row level security;
alter table public.review_queue    enable row level security;
alter table public.daily_usage     enable row level security;
alter table public.subscriptions   enable row level security;
alter table public.payments        enable row level security;
alter table public.groups          enable row level security;
alter table public.group_members   enable row level security;
alter table public.assignments     enable row level security;
alter table public.badges          enable row level security;
alter table public.user_badges     enable row level security;
alter table public.contests        enable row level security;
alter table public.contest_entries enable row level security;
alter table public.reports         enable row level security;
alter table public.ai_usage        enable row level security;

-- Supabase standart holatda anon/authenticated ga hamma narsani GRANT qiladi —
-- biz avval hammasini tortib olib, keyin kerakligini aniq beramiz.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

-- Profil: o'zi va uning o'qituvchisi o'qiydi; faqat xavfsiz ustunlarni o'zgartiradi
grant select on public.profiles to authenticated;
grant update (full_name, avatar_url, goal, region, script) on public.profiles to authenticated;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.teaches(id) or public.current_role_is('admin'));
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Ochiq ma'lumotnoma jadvallari (landing sahifasi uchun anon ham o'qiydi)
grant select on public.documents, public.spec_sections, public.topics, public.badges, public.exam_templates
  to anon, authenticated;
create policy documents_read on public.documents for select using (true);
create policy spec_read on public.spec_sections for select using (true);
create policy topics_read on public.topics for select using (true);
create policy badges_read on public.badges for select using (true);
create policy templates_read on public.exam_templates for select using (is_active);

grant select on public.articles to authenticated;
create policy articles_read on public.articles for select to authenticated using (true);

-- Savollar: faqat e'lon qilinganlari va faqat javobsiz ustunlar
grant select (id, type, stem, context, payload, topic_id, document_id, difficulty, cognitive, article_ids)
  on public.questions to authenticated;
create policy questions_read on public.questions for select to authenticated
  using (status = 'published');

grant select on public.materials to authenticated;
create policy materials_read on public.materials for select to authenticated
  using (status = 'published' and (not is_premium or public.is_premium()));

-- Natijalar: o'zi yoki o'qituvchisi o'qiydi; yozish faqat serverda
grant select on public.attempts, public.attempt_answers, public.review_queue, public.daily_usage,
  public.subscriptions, public.payments, public.user_badges, public.contest_entries to authenticated;
create policy attempts_read on public.attempts for select to authenticated
  using (user_id = auth.uid() or public.teaches(user_id));
create policy attempt_answers_read on public.attempt_answers for select to authenticated
  using (exists (select 1 from public.attempts a where a.id = attempt_id
                 and (a.user_id = auth.uid() or public.teaches(a.user_id))));
create policy review_read on public.review_queue for select to authenticated using (user_id = auth.uid());
create policy usage_read on public.daily_usage for select to authenticated using (user_id = auth.uid());
create policy subs_read on public.subscriptions for select to authenticated using (user_id = auth.uid());
create policy payments_read on public.payments for select to authenticated using (user_id = auth.uid());
create policy user_badges_read on public.user_badges for select to authenticated
  using (user_id = auth.uid() or public.teaches(user_id));
create policy contest_entries_read on public.contest_entries for select to authenticated using (true);

grant select on public.contests to anon, authenticated;
create policy contests_read on public.contests for select using (true);

-- Guruhlar: o'qituvchi o'z guruhini boshqaradi, a'zo ko'radi
grant select, delete on public.groups to authenticated;
grant insert (teacher_id, name) on public.groups to authenticated;
grant usage on sequence public.groups_id_seq to authenticated;
create policy groups_read on public.groups for select to authenticated
  using (teacher_id = auth.uid() or public.member_of(id));
create policy groups_write on public.groups for insert to authenticated
  with check (teacher_id = auth.uid() and public.current_role_is('teacher', 'admin'));
create policy groups_update on public.groups for update to authenticated
  using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
create policy groups_delete on public.groups for delete to authenticated using (teacher_id = auth.uid());

grant select, delete on public.group_members to authenticated;
create policy members_read on public.group_members for select to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.groups g where g.id = group_id and g.teacher_id = auth.uid()));
-- o'qituvchi chiqarib yuboradi yoki o'quvchi o'zi chiqadi; qo'shilish — taklif kodi bilan serverda
create policy members_delete on public.group_members for delete to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.groups g where g.id = group_id and g.teacher_id = auth.uid()));

grant select, insert, update, delete on public.assignments to authenticated;
grant usage on sequence public.assignments_id_seq to authenticated;
create policy assignments_read on public.assignments for select to authenticated
  using (public.member_of(group_id) or exists (select 1 from public.groups g where g.id = group_id and g.teacher_id = auth.uid()));
create policy assignments_write on public.assignments for all to authenticated
  using (exists (select 1 from public.groups g where g.id = group_id and g.teacher_id = auth.uid()))
  with check (exists (select 1 from public.groups g where g.id = group_id and g.teacher_id = auth.uid()));

-- Shikoyat: o'quvchi yuboradi va o'zinikini ko'radi
grant select, insert (question_id, user_id, message) on public.reports to authenticated;
grant usage on sequence public.reports_id_seq to authenticated;
create policy reports_read on public.reports for select to authenticated using (user_id = auth.uid());
create policy reports_insert on public.reports for insert to authenticated with check (user_id = auth.uid());

-- ai_usage: mijozga umuman ochilmaydi (faqat service_role)

-- grants_premium ni faqat admin (server) yoqadi — o'qituvchi o'zi Premium "tarqata" olmasin
grant update (name) on public.groups to authenticated;

grant execute on function public.is_premium() to authenticated;
