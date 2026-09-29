-- Xavfsizlik tuzatishlari (ishga tushirishdan oldingi tekshiruv natijasi).
-- 1) Javob darhol oshkor qilinadigan funksiyalar faqat mashq turidagi rejimlarda ishlaydi (sinov/musobaqada — yo'q).
-- 2) telegram_id endi faqat raw_app_meta_data dan (foydalanuvchi boshqara olmaydi) olinadi.
-- 3) Musobaqa: muddatidan oldin yakunlash faqat yopadi, baholash — musobaqa tugagach (natija oldin sizib chiqmasin).
-- 4) Musobaqa javoblari (is_correct) musobaqa yakunlanguncha o'qilmaydi.
-- 5) Eskirgan streak nollanadi; reyting/natija limitlari cheklangan; chek takrori rad etiladi.

-- ─── 1 ───
create or replace function public.record_answer(
  p_user uuid, p_attempt uuid, p_question bigint, p_response jsonb,
  p_correct boolean, p_points numeric, p_time_ms int, p_limit int
) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  a attempts%rowtype;
  today date := public.uz_today();
  used int;
  intervals int[] := array[1, 3, 7, 14, 30];
  p profiles%rowtype;
begin
  select * into a from attempts where id = p_attempt and user_id = p_user for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  -- Javob darhol baholanadigan rejimlar. Sinov/musobaqada javob oshkor bo'lmasligi kerak (save_mock_answer ishlatiladi).
  if a.mode not in ('practice', 'review', 'daily', 'assignment') then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if a.finished_at is not null then return jsonb_build_object('ok', false, 'reason', 'finished'); end if;
  if not (p_question = any (a.question_ids)) then return jsonb_build_object('ok', false, 'reason', 'not_in_attempt'); end if;
  if exists (select 1 from attempt_answers where attempt_id = p_attempt and question_id = p_question) then
    return jsonb_build_object('ok', false, 'reason', 'duplicate');
  end if;

  -- Kunlik limit (atomar: parallel so'rovlar ham limitdan oshira olmaydi)
  insert into daily_usage (user_id, day) values (p_user, today) on conflict do nothing;
  update daily_usage set questions = questions + 1
   where user_id = p_user and day = today and (p_limit is null or questions < p_limit)
  returning questions into used;
  if used is null then return jsonb_build_object('ok', false, 'reason', 'limit'); end if;

  insert into attempt_answers (attempt_id, question_id, response, is_correct, points, time_ms)
  values (p_attempt, p_question, p_response, p_correct, p_points, p_time_ms);

  -- Takrorlash navbati (Leitner): xato → 1-quti (ertaga); to'g'ri → keyingi quti; 5-qutidan o'tsa — o'zlashtirildi
  if p_correct then
    update review_queue
       set box = box + 1, due_on = today + intervals[least(box + 1, 5)]
     where user_id = p_user and question_id = p_question and box < 5;
    delete from review_queue where user_id = p_user and question_id = p_question and box >= 5 and due_on <= today;
  else
    insert into review_queue (user_id, question_id, box, due_on, lapses)
    values (p_user, p_question, 1, today + 1, 1)
    on conflict (user_id, question_id) do update set box = 1, due_on = today + 1, lapses = review_queue.lapses + 1;
  end if;

  -- Streak: kuniga 10-savolga javob berilganda kun hisoblanadi
  if used = 10 then
    select * into p from profiles where id = p_user for update;
    update profiles set
      streak_days = case when p.last_active_on = today - 1 then p.streak_days + 1
                         when p.last_active_on = today then p.streak_days
                         else 1 end,
      last_active_on = today
    where id = p_user;
    update profiles set streak_best = greatest(streak_best, streak_days) where id = p_user;
  end if;

  return jsonb_build_object('ok', true, 'used_today', used);
end $$;

create or replace function public.finish_attempt(p_user uuid, p_attempt uuid) returns attempts
language plpgsql volatile security definer set search_path = public as $$
declare
  a attempts%rowtype;
begin
  update attempts t set
    finished_at = coalesce(t.finished_at, now()),
    correct_count = s.correct,
    raw_score = round(100.0 * s.points / greatest(array_length(t.question_ids, 1), 1), 2)
  from (
    select count(*) filter (where is_correct) as correct, coalesce(sum(points), 0) as points
    from attempt_answers where attempt_id = p_attempt
  ) s
  where t.id = p_attempt and t.user_id = p_user and t.mode in ('practice', 'review', 'daily', 'assignment')
  returning t.* into a;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  return a;
end $$;

create or replace function public.apply_ai_regrade(
  p_user uuid, p_attempt uuid, p_question bigint, p_correct boolean, p_feedback jsonb
) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  a attempts%rowtype;
  ans attempt_answers%rowtype;
begin
  select * into a from attempts where id = p_attempt and user_id = p_user for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if a.mode not in ('practice', 'review', 'daily', 'assignment') then return jsonb_build_object('ok', false, 'reason', 'mock'); end if; -- sinov natijasi o'zgarmaydi
  select * into ans from attempt_answers where attempt_id = p_attempt and question_id = p_question for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_answer'); end if;
  if ans.is_correct then return jsonb_build_object('ok', false, 'reason', 'already_correct'); end if;
  if ans.ai_feedback is not null then return jsonb_build_object('ok', false, 'reason', 'already_checked'); end if;

  update attempt_answers set ai_feedback = p_feedback,
    is_correct = case when p_correct then true else is_correct end,
    points = case when p_correct then 1 else points end
  where attempt_id = p_attempt and question_id = p_question;

  if p_correct then
    delete from review_queue where user_id = p_user and question_id = p_question and box = 1;
    if a.finished_at is not null then
      update attempts t set
        correct_count = s.correct,
        raw_score = round(100.0 * s.points / greatest(array_length(t.question_ids, 1), 1), 2)
      from (select count(*) filter (where is_correct) as correct, coalesce(sum(points), 0) as points
            from attempt_answers where attempt_id = p_attempt) s
      where t.id = p_attempt;
    end if;
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- ─── 2 ───
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);   -- foydalanuvchi o'zi yozishi mumkin
  app  jsonb := coalesce(new.raw_app_meta_data, '{}'::jsonb);    -- faqat server (admin API)
begin
  insert into public.profiles (id, full_name, avatar_url, telegram_id, telegram_username)
  values (
    new.id,
    left(coalesce(meta ->> 'full_name', meta ->> 'name', ''), 80),
    coalesce(meta ->> 'avatar_url', meta ->> 'picture'),
    nullif(app ->> 'telegram_id', '')::bigint,
    app ->> 'telegram_username'
  );
  return new;
end $$;

-- ─── 3 ───
alter table public.contest_entries add column finished_at timestamptz;

-- Ishtirokchi muddatidan oldin tugatdi: faqat yopiladi (baholanmaydi)
create or replace function public.close_contest_attempt(p_user uuid, p_attempt uuid) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  a attempts%rowtype;
begin
  select * into a from attempts where id = p_attempt and user_id = p_user and mode = 'contest' for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if a.finished_at is null then
    update attempts set finished_at = least(now(), deadline_at) where id = p_attempt;
    update contest_entries set finished_at = least(now(), a.deadline_at),
      duration_sec = extract(epoch from (least(now(), a.deadline_at) - a.started_at))::int
    where attempt_id = p_attempt;
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- Baholash — faqat musobaqa tugagach (finalizeIfEnded). Qayta chaqirish xavfsiz.
create or replace function public.finish_contest_attempt(p_attempt uuid, p_results jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  a attempts%rowtype;
  e contest_entries%rowtype;
  n_correct int;
begin
  select * into a from attempts where id = p_attempt and mode = 'contest' for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  select * into e from contest_entries where attempt_id = p_attempt;
  if exists (select 1 from contests c where c.id = e.contest_id and now() < c.ends_at) then
    return jsonb_build_object('ok', false, 'reason', 'not_ended');
  end if;
  if e.correct is not null then return jsonb_build_object('ok', true, 'already', true); end if;

  update attempt_answers aa set is_correct = (r ->> 'correct')::boolean, points = case when (r ->> 'correct')::boolean then 1 else 0 end
  from jsonb_array_elements(p_results) r
  where aa.attempt_id = p_attempt and aa.question_id = (r ->> 'q')::bigint;
  update attempt_answers set is_correct = false, points = 0 where attempt_id = p_attempt and is_correct is null;
  select count(*) filter (where is_correct) into n_correct from attempt_answers where attempt_id = p_attempt;

  update attempts set finished_at = coalesce(finished_at, deadline_at), correct_count = n_correct,
    raw_score = round(100.0 * n_correct / greatest(array_length(question_ids, 1), 1), 2)
  where id = p_attempt;
  update contest_entries set correct = n_correct, score = n_correct,
    finished_at = coalesce(finished_at, a.deadline_at),
    duration_sec = coalesce(duration_sec, extract(epoch from (a.deadline_at - a.started_at))::int)
  where attempt_id = p_attempt;
  return jsonb_build_object('ok', true, 'already', false);
end $$;

create or replace function public.finalize_contest(p_contest bigint) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  c contests%rowtype;
begin
  select * into c from contests where id = p_contest for update;
  if not found or now() < c.ends_at then return jsonb_build_object('ok', false, 'reason', 'not_ended'); end if;
  if c.finalized then return jsonb_build_object('ok', true, 'already', true); end if;
  if exists (select 1 from contest_entries where contest_id = p_contest and correct is null) then
    return jsonb_build_object('ok', false, 'reason', 'ungraded');
  end if;
  update contest_entries e set rank = r.rnk from (
    select user_id, rank() over (order by coalesce(correct, 0) desc, coalesce(duration_sec, 2147483647))::int as rnk
    from contest_entries where contest_id = p_contest
  ) r where e.contest_id = p_contest and e.user_id = r.user_id;
  update contests set finalized = true where id = p_contest;
  return jsonb_build_object('ok', true, 'already', false);
end $$;

-- ─── 4 ─── musobaqa javoblari va natija ustunlari yakunlanguncha yopiq
drop policy if exists attempt_answers_read on public.attempt_answers;
create policy attempt_answers_read on public.attempt_answers for select to authenticated
  using (exists (
    select 1 from public.attempts a
    where a.id = attempt_id
      and (a.user_id = auth.uid() or public.teaches(a.user_id))
      and (a.mode <> 'contest' or exists (
        select 1 from public.contest_entries e join public.contests c on c.id = e.contest_id
        where e.attempt_id = a.id and c.finalized))
  ));
revoke select on public.contest_entries from authenticated;
grant select (contest_id, user_id, attempt_id, rank, finished_at) on public.contest_entries to authenticated;

-- ─── 5 ───
create or replace function public.reset_stale_streaks() returns int
language sql volatile security definer set search_path = public as $$
  with u as (
    update profiles set streak_days = 0
    where streak_days > 0 and (last_active_on is null or last_active_on < public.uz_today() - 1)
    returning 1
  ) select count(*)::int from u;
$$;

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
      ('daily_7',      (select count(*) from attempts where user_id = p_user and mode = 'daily' and finished_at is not null and coalesce(correct_count, 0) > 0) >= 7),
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
  where rnk <= least(greatest(p_limit, 1), 100) or id = auth.uid()
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

create or replace function public.contest_results(p_contest bigint, p_limit int default 100)
returns table (rank int, name text, correct int, total int, duration_sec int, is_me boolean)
language sql stable security definer set search_path = public as $$
  select e.rank, public.public_name(p.full_name), e.correct, array_length(c.question_ids, 1), e.duration_sec, e.user_id = auth.uid()
  from contest_entries e
  join contests c on c.id = e.contest_id and c.finalized
  join profiles p on p.id = e.user_id
  where e.contest_id = p_contest and (e.rank <= least(greatest(p_limit, 1), 100) or e.user_id = auth.uid())
  order by e.rank, e.duration_sec;
$$;

alter table public.payments add column receipt_sha256 text;
create unique index payments_receipt_unique on public.payments (receipt_sha256)
  where receipt_sha256 is not null and status in ('pending', 'paid');

drop function public.create_manual_payment(uuid, text, text);
create or replace function public.create_manual_payment(p_user uuid, p_plan text, p_receipt text, p_sha256 text)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  pl plans%rowtype;
  new_id bigint;
begin
  select * into pl from plans where code = p_plan and is_active;
  if not found then return jsonb_build_object('ok', false, 'reason', 'plan'); end if;
  if exists (select 1 from payments where user_id = p_user and status = 'pending' and provider = 'manual') then
    return jsonb_build_object('ok', false, 'reason', 'pending');
  end if;
  if exists (select 1 from payments where receipt_sha256 = p_sha256 and status in ('pending', 'paid')) then
    return jsonb_build_object('ok', false, 'reason', 'duplicate_receipt');
  end if;
  insert into payments (user_id, provider, amount_uzs, months, status, receipt_path, plan_code, receipt_sha256)
  values (p_user, 'manual', pl.price_uzs, pl.months, 'pending', p_receipt, pl.code, p_sha256)
  returning id into new_id;
  return jsonb_build_object('ok', true, 'id', new_id);
end $$;

revoke execute on function public.close_contest_attempt(uuid, uuid), public.reset_stale_streaks(),
  public.create_manual_payment(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.close_contest_attempt(uuid, uuid), public.reset_stale_streaks(),
  public.create_manual_payment(uuid, text, text, text) to service_role;
