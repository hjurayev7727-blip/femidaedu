-- AI ustoz (V3, 5-qism): modda/tushuncha tushuntirish, kazus tahlili, xatolardan test, o'quv reja.
-- Faqat ta'lim maqsadida; kontekst bazadagi moddalardan olinadi (RAG). Bepul: haftasiga 10 ta savol.

-- ─────────────────────────── Suhbatlar ───────────────────────────
create table public.tutor_threads (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  mode        text not null check (mode in ('explain', 'case')),
  title       text not null check (char_length(title) <= 120),
  article_id  bigint references public.articles (id) on delete set null,   -- moddadan boshlangan suhbat
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index tutor_threads_user_idx on public.tutor_threads (user_id, updated_at desc);

create table public.tutor_messages (
  id           bigserial primary key,
  thread_id    uuid not null references public.tutor_threads (id) on delete cascade,
  role         text not null check (role in ('user', 'assistant')),
  content      text not null check (char_length(content) <= 12000),
  article_ids  bigint[] not null default '{}',              -- javobga manba bo'lgan moddalar
  created_at   timestamptz not null default now()
);
create index tutor_messages_thread_idx on public.tutor_messages (thread_id, id);

-- O'quv reja (har foydalanuvchida bitta faol reja)
create table public.study_plans (
  user_id     uuid primary key references public.profiles (id) on delete cascade,
  goal        jsonb not null,          -- { target: 'sertifikat'|'soha', field, exam_date, minutes_per_day, level }
  plan        jsonb not null,          -- { summary, weeks: [{ week, focus, days: [{ day, tasks: [...] }] }] }
  created_at  timestamptz not null default now()
);

-- Haftalik AI ustoz limiti (ai_weekly jadvaliga ustun)
alter table public.ai_weekly add column tutor int not null default 0;

alter table public.tutor_threads  enable row level security;
alter table public.tutor_messages enable row level security;
alter table public.study_plans    enable row level security;
create policy tthreads_own on public.tutor_threads for select to authenticated using (user_id = auth.uid());
create policy tmessages_own on public.tutor_messages for select to authenticated
  using (exists (select 1 from tutor_threads t where t.id = thread_id and t.user_id = auth.uid()));
create policy plans_own on public.study_plans for select to authenticated using (user_id = auth.uid());
grant select on public.tutor_threads, public.tutor_messages, public.study_plans to authenticated;
grant all on public.tutor_threads, public.tutor_messages, public.study_plans to service_role;
grant usage, select on all sequences in schema public to service_role;
create trigger tutor_threads_touch before update on public.tutor_threads for each row execute function public.touch_updated_at();

-- ─────────────────────────── Moddalarni qidirish (RAG) ───────────────────────────
create index articles_fts_idx on public.articles
  using gin (to_tsvector('simple', coalesce(title, '') || ' ' || body));

/**
 * Savol bo'yicha tegishli moddalar: to'liq matnli qidiruv (har so'z prefiks bilan, OR) — sarlavhadagi moslik ustun.
 * O'zbek so'z qo'shimchalari uchun so'zning dastlabki 5 harfi prefiks sifatida olinadi ("shartnomasi" → "shart:*").
 */
create or replace function public.search_articles(p_query text, p_field text default null, p_limit int default 6)
returns table (id bigint, document_id int, number text, title text, body text, doc_title text, field_slug text, rank real)
language sql stable security definer set search_path = public as $$
  with words as (
    select distinct left(w, 5) as w
    from regexp_split_to_table(lower(translate(coalesce(p_query, ''), '‘’ʼʻ`''', '')), '[^a-zа-яёўқғҳ0-9]+') as w
    where char_length(w) >= 4
    limit 12
  ), q as (
    select to_tsquery('simple', string_agg(w || ':*', ' | ')) as tsq from words having count(*) > 0
  )
  select a.id, a.document_id, a.number, a.title, a.body, d.short_title, f.slug,
         (ts_rank(to_tsvector('simple', coalesce(a.title, '') || ' ' || a.body), q.tsq)
          + 2 * ts_rank(to_tsvector('simple', coalesce(a.title, '')), q.tsq))::real as rank
  from q, articles a
  join documents d on d.id = a.document_id
  left join fields f on f.id = d.field_id
  where a.status <> 'repealed'
    and to_tsvector('simple', coalesce(a.title, '') || ' ' || a.body) @@ q.tsq
    and (p_field is null or f.slug = p_field)
  order by rank desc, a.id
  limit least(greatest(p_limit, 1), 20)
$$;

-- Foydalanuvchining zaif moddalari (xatolardan test va o'quv reja uchun): kamida 1 xato, o'zlashtirilmagan
create or replace function public.weak_articles(p_user uuid, p_limit int default 20)
returns table (article_id bigint, number text, title text, document_id int, doc_title text, field_slug text, seen int, correct int)
language sql stable security definer set search_path = public as $$
  select a.id, a.number, a.title, a.document_id, d.short_title, f.slug, p.seen, p.correct
  from article_progress p
  join articles a on a.id = p.article_id and a.status <> 'repealed'
  join documents d on d.id = a.document_id
  left join fields f on f.id = d.field_id
  where p.user_id = p_user and p.seen > p.correct and not public.article_mastered(p.seen, p.correct)
  order by (p.seen - p.correct) desc, p.last_at desc
  limit least(greatest(p_limit, 1), 40)
$$;

-- Haftalik AI ustoz limiti (atomar). Qaytaradi: shu haftadagi tartib raqami yoki null
create or replace function public.consume_tutor_quota(p_user uuid, p_limit int) returns int
language plpgsql volatile security definer set search_path = public as $$
declare
  used int;
begin
  insert into ai_weekly (user_id, week) values (p_user, public.uz_week()) on conflict do nothing;
  update ai_weekly set tutor = tutor + 1
   where user_id = p_user and week = public.uz_week() and (p_limit is null or tutor < p_limit)
  returning tutor into used;
  return used;
end $$;

create or replace function public.refund_tutor_quota(p_user uuid) returns void
language sql volatile security definer set search_path = public as $$
  update ai_weekly set tutor = greatest(tutor - 1, 0) where user_id = p_user and week = public.uz_week()
$$;

do $$
declare f text;
begin
  foreach f in array array['search_articles(text, text, int)', 'weak_articles(uuid, int)', 'consume_tutor_quota(uuid, int)', 'refund_tutor_quota(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
