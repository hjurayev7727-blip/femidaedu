-- Motivatsiya: reyting, nishonlar, musobaqalar.

-- Reytingda ko'rinish (o'quvchi o'zi o'chira oladi)
alter table public.profiles add column leaderboard_visible boolean not null default true;
grant update (leaderboard_visible) on public.profiles to authenticated;

-- Ommaviy ism: "Ali V." — to'liq familiya ko'rsatilmaydi (o'quvchilarning ko'pi voyaga yetmagan)
create or replace function public.public_name(p_full text) returns text
language sql immutable as $$
  select case
    when coalesce(trim(p_full), '') = '' then 'Ishtirokchi'
    when array_length(regexp_split_to_array(trim(p_full), '\s+'), 1) = 1 then trim(p_full)
    else (regexp_split_to_array(trim(p_full), '\s+'))[1] || ' ' || left((regexp_split_to_array(trim(p_full), '\s+'))[2], 1) || '.'
  end;
$$;

-- ─────────────────────────── Reyting ───────────────────────────
-- Ball = aniqlik% × 0,7 + faollik × 0,3 (v1 formulasi). Faollik = javoblar / maqsad (hafta 150, umumiy 1500), 100 dan oshmaydi.
-- Reytingga kirish: hafta — kamida 20, umumiy — kamida 100 javob.
create or replace function public.leaderboard(p_period text, p_region text default null, p_limit int default 50)
returns table (rank int, name text, region text, answered int, accuracy numeric, score numeric, is_me boolean)
language sql stable security definer set search_path = public as $$
  with params as (
    select case when p_period = 'week' then date_trunc('week', now() at time zone 'Asia/Tashkent') at time zone 'Asia/Tashkent'
                else '-infinity'::timestamptz end as since,
           case when p_period = 'week' then 150 else 1500 end as target,
           case when p_period = 'week' then 20 else 100 end as min_answers
  ),
  stats as (
    select a.user_id, count(*) as answered, count(*) filter (where aa.is_correct) as correct
    from attempt_answers aa join attempts a on a.id = aa.attempt_id, params
    where aa.is_correct is not null and aa.answered_at >= params.since
    group by a.user_id
  ),
  scored as (
    select p.id, p.full_name, p.region, s.answered, s.correct,
      round(100.0 * s.correct / s.answered, 1) as accuracy,
      round(0.7 * (100.0 * s.correct / s.answered) + 0.3 * least(100.0, 100.0 * s.answered / params.target), 1) as score
    from stats s join profiles p on p.id = s.user_id, params
    where s.answered >= params.min_answers and p.leaderboard_visible
      and (p_region is null or p.region = p_region)
  ),
  ranked as (
    select *, rank() over (order by score desc, answered desc)::int as rnk from scored
  )
  select rnk, public.public_name(full_name), region, answered::int, accuracy, score, id = auth.uid()
  from ranked
  where rnk <= p_limit or id = auth.uid()
  order by rnk, answered desc;
$$;

-- ─────────────────────────── Nishonlar ───────────────────────────
insert into public.badges (code, title, description, icon) values
  ('q_100',        '100 savol',         '100 ta savolga javob berdingiz', '✏️'),
  ('daily_7',      'Kunlik odat',       '7 ta kunlik testni yakunladingiz', '📅'),
  ('contest_top3', 'Sovrindor',         'Musobaqada top-3 ga kirdingiz', '🥇')
on conflict (code) do nothing;
update public.badges set description = 'Kamida 20 ta xatoni tuzatib, takrorlash navbatini tozaladingiz'
where code = 'no_mistakes';

-- Shartlarni tekshirib, yangi nishonlarni beradi. Qaytaradi: yangi berilgan nishon kodlari.
create or replace function public.award_badges(p_user uuid) returns text[]
language plpgsql volatile security definer set search_path = public as $$
declare
  answered int;
  p profiles%rowtype;
  earned text[] := '{}';
  code text;
begin
  select * into p from profiles where id = p_user;
  if not found then return '{}'; end if;
  select count(*) into answered from attempt_answers aa join attempts a on a.id = aa.attempt_id
   where a.user_id = p_user and aa.is_correct is not null;

  for code in
    select c from (values
      ('first_test',   exists (select 1 from attempts where user_id = p_user and finished_at is not null)),
      ('q_100',        answered >= 100),
      ('q_500',        answered >= 500),
      ('streak_7',     p.streak_best >= 7),
      ('streak_30',    p.streak_best >= 30),
      ('mock_a_plus',  exists (select 1 from attempts where user_id = p_user and mode = 'mock' and grade = 'A+')),
      ('daily_7',      (select count(*) from attempts where user_id = p_user and mode = 'daily' and finished_at is not null) >= 7),
      ('no_mistakes',  (select count(*) from attempt_answers aa join attempts a on a.id = aa.attempt_id
                        where a.user_id = p_user and a.mode = 'review' and aa.is_correct) >= 20
                       and not exists (select 1 from review_queue where user_id = p_user and due_on <= public.uz_today())),
      ('contest_top3', exists (select 1 from contest_entries e where e.user_id = p_user and e.rank between 1 and 3))
    ) as t(c, ok)
    where ok
  loop
    insert into user_badges (user_id, badge_code) values (p_user, code) on conflict do nothing;
    if found then earned := earned || code; end if;
  end loop;
  return earned;
end $$;

-- ─────────────────────────── Musobaqalar ───────────────────────────
alter table public.contests
  add column topic_id int references public.topics (id),
  add column finalized boolean not null default false;
alter table public.contest_entries
  add column rank int,
  add column correct int,
  add column duration_sec int;
alter table public.contests add constraint contests_window check (ends_at > starts_at);

-- Musobaqa savollari: yopiq turlar, mavzu bo'yicha yoki butun bazadan
create or replace function public.contest_pick(p_n int, p_topic int) returns bigint[]
language sql volatile security definer set search_path = public as $$
  select coalesce(array_agg(id), '{}') from (
    select id from questions
    where status = 'published' and type in ('single', 'fill_blank', 'case', 'matching')
      and (p_topic is null or topic_id in (select public.topic_subtree(p_topic)))
    order by random() limit greatest(5, least(p_n, 50))
  ) s;
$$;

create or replace function public.start_contest(p_user uuid, p_contest bigint, p_premium boolean) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  c contests%rowtype;
  existing uuid;
  new_id uuid;
begin
  select * into c from contests where id = p_contest;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if now() < c.starts_at then return jsonb_build_object('ok', false, 'reason', 'not_started'); end if;
  if now() >= c.ends_at then return jsonb_build_object('ok', false, 'reason', 'ended'); end if;
  if c.is_premium and not p_premium then return jsonb_build_object('ok', false, 'reason', 'premium'); end if;
  perform pg_advisory_xact_lock(hashtext('contest:' || p_user::text || ':' || p_contest::text));
  select attempt_id into existing from contest_entries where contest_id = p_contest and user_id = p_user;
  if existing is not null then return jsonb_build_object('ok', true, 'id', existing); end if;
  insert into attempts (user_id, mode, question_ids, deadline_at)
  values (p_user, 'contest', c.question_ids, c.ends_at) returning id into new_id;
  insert into contest_entries (contest_id, user_id, attempt_id) values (p_contest, p_user, new_id);
  return jsonb_build_object('ok', true, 'id', new_id);
end $$;

-- Sinov imtihoni kabi javob saqlash musobaqa uchun ham (baholanmaydi, javob oshkor qilinmaydi)
create or replace function public.save_mock_answer(p_user uuid, p_attempt uuid, p_question bigint, p_response jsonb)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  a attempts%rowtype;
begin
  select * into a from attempts where id = p_attempt and user_id = p_user and mode in ('mock', 'contest');
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if a.finished_at is not null then return jsonb_build_object('ok', false, 'reason', 'finished'); end if;
  if now() > a.deadline_at + interval '30 seconds' then return jsonb_build_object('ok', false, 'reason', 'expired'); end if;
  if not (p_question = any (a.question_ids)) then return jsonb_build_object('ok', false, 'reason', 'not_in_attempt'); end if;
  insert into attempt_answers (attempt_id, question_id, response)
  values (p_attempt, p_question, p_response)
  on conflict (attempt_id, question_id) do update set response = excluded.response, answered_at = now();
  return jsonb_build_object('ok', true);
end $$;

-- Ishtirokchi urinishini yakunlash (baholash natijasi serverda hisoblanadi). Qayta chaqirish xavfsiz.
create or replace function public.finish_contest_attempt(p_attempt uuid, p_results jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  a attempts%rowtype;
  n_correct int;
begin
  select * into a from attempts where id = p_attempt and mode = 'contest' for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if a.finished_at is not null then return jsonb_build_object('ok', true, 'already', true); end if;
  update attempt_answers aa set is_correct = (r ->> 'correct')::boolean, points = case when (r ->> 'correct')::boolean then 1 else 0 end
  from jsonb_array_elements(p_results) r
  where aa.attempt_id = p_attempt and aa.question_id = (r ->> 'q')::bigint;
  select count(*) filter (where is_correct) into n_correct from attempt_answers where attempt_id = p_attempt;
  update attempts set finished_at = least(now(), deadline_at), correct_count = n_correct,
    raw_score = round(100.0 * n_correct / greatest(array_length(question_ids, 1), 1), 2)
  where id = p_attempt;
  update contest_entries set correct = n_correct, score = n_correct,
    duration_sec = extract(epoch from (least(now(), a.deadline_at) - a.started_at))::int
  where attempt_id = p_attempt;
  return jsonb_build_object('ok', true, 'already', false);
end $$;

-- Musobaqa tugagach o'rinlarni hisoblaydi (to'g'ri javoblar ↓, vaqt ↑). Barcha urinishlar yakunlangan bo'lishi kerak.
create or replace function public.finalize_contest(p_contest bigint) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  c contests%rowtype;
begin
  select * into c from contests where id = p_contest for update;
  if not found or now() < c.ends_at then return jsonb_build_object('ok', false, 'reason', 'not_ended'); end if;
  if c.finalized then return jsonb_build_object('ok', true, 'already', true); end if;
  if exists (select 1 from contest_entries e join attempts a on a.id = e.attempt_id
             where e.contest_id = p_contest and a.finished_at is null) then
    return jsonb_build_object('ok', false, 'reason', 'unfinished');
  end if;
  update contest_entries e set rank = r.rnk from (
    select user_id, rank() over (order by coalesce(correct, 0) desc, coalesce(duration_sec, 2147483647))::int as rnk
    from contest_entries where contest_id = p_contest
  ) r where e.contest_id = p_contest and e.user_id = r.user_id;
  update contests set finalized = true where id = p_contest;
  return jsonb_build_object('ok', true, 'already', false);
end $$;

-- Natijalar: faqat musobaqa yakunlangach (oldin — bo'sh)
create or replace function public.contest_results(p_contest bigint, p_limit int default 100)
returns table (rank int, name text, correct int, total int, duration_sec int, is_me boolean)
language sql stable security definer set search_path = public as $$
  select e.rank, public.public_name(p.full_name), e.correct, array_length(c.question_ids, 1), e.duration_sec, e.user_id = auth.uid()
  from contest_entries e
  join contests c on c.id = e.contest_id and c.finalized
  join profiles p on p.id = e.user_id
  where e.contest_id = p_contest and (e.rank <= p_limit or e.user_id = auth.uid())
  order by e.rank, e.duration_sec;
$$;

-- Ishtirokchilar soni (musobaqa davomida ham)
create or replace function public.contest_participants(p_contest bigint) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from contest_entries where contest_id = p_contest;
$$;

-- contest_entries: foydalanuvchi faqat o'zinikini ko'radi (reyting — contest_results orqali)
drop policy if exists contest_entries_read on public.contest_entries;
create policy contest_entries_read on public.contest_entries for select to authenticated using (user_id = auth.uid());
-- contests: savollar ro'yxati (question_ids) mijozga ochilmasin — musobaqa oldidan savollar sizib chiqmasin
revoke select on public.contests from anon, authenticated;
grant select (id, title, starts_at, ends_at, is_premium, topic_id, finalized) on public.contests to anon, authenticated;

revoke execute on function public.award_badges(uuid), public.contest_pick(int, int), public.start_contest(uuid, bigint, boolean),
  public.finish_contest_attempt(uuid, jsonb), public.finalize_contest(bigint) from public, anon, authenticated;
grant execute on function public.award_badges(uuid), public.contest_pick(int, int), public.start_contest(uuid, bigint, boolean),
  public.finish_contest_attempt(uuid, jsonb), public.finalize_contest(bigint) to service_role;
revoke execute on function public.leaderboard(text, text, int), public.contest_results(bigint, int), public.contest_participants(bigint) from public, anon;
grant execute on function public.leaderboard(text, text, int), public.contest_results(bigint, int), public.contest_participants(bigint) to authenticated;
