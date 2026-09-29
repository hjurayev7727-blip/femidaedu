-- Mashq rejimi: savol tanlash, javobni yozish (limit + takrorlash navbati + streak), yakunlash.
-- Barcha funksiyalar faqat server (service_role) uchun — mijoz ularni chaqira olmaydi.
-- Javobning to'g'riligi serverda (TypeScript, lib/questions.ts) hisoblanadi va shu yerga beriladi.

-- O'zbekiston sanasi (kunlik limit va streak shu bo'yicha)
create or replace function public.uz_today() returns date
language sql stable as $$ select (now() at time zone 'Asia/Tashkent')::date $$;

alter table public.daily_usage alter column day set default public.uz_today();
alter table public.review_queue alter column due_on set default public.uz_today();

-- Mavzu va uning barcha ichki mavzulari
create or replace function public.topic_subtree(p_topic int) returns setof int
language sql stable as $$
  with recursive t as (
    select id from public.topics where id = p_topic
    union all
    select c.id from public.topics c join t on c.parent_id = t.id
  )
  select id from t;
$$;

-- Mashq uchun savollar: avval hali ko'rilmaganlar, keyin xato qilinganlar, keyin qolganlari (tasodifiy)
create or replace function public.pick_practice_questions(p_user uuid, p_topic int, p_n int)
returns bigint[]
language sql volatile security definer set search_path = public as $$
  with pool as (
    select q.id,
           exists (select 1 from attempt_answers aa join attempts a on a.id = aa.attempt_id
                   where a.user_id = p_user and aa.question_id = q.id) as seen,
           exists (select 1 from review_queue r where r.user_id = p_user and r.question_id = q.id) as weak
    from questions q
    where q.status = 'published'
      and q.type <> 'open'                      -- yozma savollar alohida rejimda
      and q.topic_id in (select public.topic_subtree(p_topic))
  )
  select coalesce(array_agg(id), '{}') from (
    select id from pool
    order by (case when not seen then 0 when weak then 1 else 2 end), random()
    limit greatest(1, least(p_n, 50))
  ) s;
$$;

-- Yangi mashq urinishi
create or replace function public.start_practice(p_user uuid, p_topic int, p_n int)
returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  ids bigint[] := public.pick_practice_questions(p_user, p_topic, p_n);
  new_id uuid;
begin
  if coalesce(array_length(ids, 1), 0) = 0 then
    raise exception 'no_questions' using errcode = 'P0001';
  end if;
  insert into attempts (user_id, mode, topic_id, question_ids)
  values (p_user, 'practice', p_topic, ids)
  returning id into new_id;
  return new_id;
end $$;

-- Javobni yozish. Natija: {"ok":true} yoki {"ok":false,"reason":"limit|finished|not_in_attempt|duplicate|not_found"}
-- p_limit — kunlik bepul savollar (Premium uchun null = cheksiz)
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

-- Urinishni yakunlash va natijani hisoblash (mashq: foiz)
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
  where t.id = p_attempt and t.user_id = p_user
  returning t.* into a;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  return a;
end $$;

-- Mavzular bo'yicha foydalanuvchi progressi (katalog sahifasi uchun) — RLS bilan o'zi chaqiradi
create or replace function public.my_topic_progress()
returns table (topic_id int, answered bigint, correct bigint)
language sql stable security invoker set search_path = public as $$
  select q.topic_id, count(*), count(*) filter (where aa.is_correct)
  from attempt_answers aa
  join attempts a on a.id = aa.attempt_id
  join questions q on q.id = aa.question_id
  where a.user_id = auth.uid()
  group by q.topic_id;
$$;

-- Mavzu bo'yicha e'lon qilingan savollar soni (ochiq statistik ma'lumot)
create or replace function public.topic_question_counts()
returns table (topic_id int, total bigint)
language sql stable security definer set search_path = public as $$
  select topic_id, count(*) from questions where status = 'published' and type <> 'open' group by topic_id;
$$;

revoke execute on function public.pick_practice_questions(uuid, int, int) from public, anon, authenticated;
revoke execute on function public.start_practice(uuid, int, int) from public, anon, authenticated;
revoke execute on function public.record_answer(uuid, uuid, bigint, jsonb, boolean, numeric, int, int) from public, anon, authenticated;
revoke execute on function public.finish_attempt(uuid, uuid) from public, anon, authenticated;
grant execute on function public.my_topic_progress() to authenticated;
grant execute on function public.topic_question_counts() to anon, authenticated;
grant execute on function public.pick_practice_questions(uuid, int, int), public.start_practice(uuid, int, int),
  public.record_answer(uuid, uuid, bigint, jsonb, boolean, numeric, int, int), public.finish_attempt(uuid, uuid)
  to service_role;
