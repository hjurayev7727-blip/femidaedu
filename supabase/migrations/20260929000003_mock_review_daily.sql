-- Sinov imtihoni (mock), takrorlash va kunlik test.
-- Barcha yozuvchi funksiyalar faqat service_role uchun.

-- Mock rejasi: [{n, part, q, points, kind}] — ball slotga tegishli (lib/mock.ts)
alter table public.attempts add column plan jsonb;

-- Yozma (qisqa javobli) savollar avtomatik tekshiriladi — mashqqa ham qo'shiladi
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
      and q.topic_id in (select public.topic_subtree(p_topic))
  )
  select coalesce(array_agg(id), '{}') from (
    select id from pool
    order by (case when not seen then 0 when weak then 1 else 2 end), random()
    limit greatest(1, least(p_n, 50))
  ) s;
$$;

create or replace function public.topic_question_counts()
returns table (topic_id int, total bigint)
language sql stable security definer set search_path = public as $$
  select topic_id, count(*) from questions where status = 'published' group by topic_id;
$$;

-- ─────────────────────────── Sinov imtihoni ───────────────────────────
-- Joriy oyda (Toshkent vaqti) boshlangan sinovlar soni
create or replace function public.mocks_this_month(p_user uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from attempts
  where user_id = p_user and mode = 'mock'
    and date_trunc('month', started_at at time zone 'Asia/Tashkent') = date_trunc('month', now() at time zone 'Asia/Tashkent');
$$;

-- Reja serverda (lib/mock.ts) tuziladi; bu yerda oylik limit atomar tekshiriladi
create or replace function public.create_mock(p_user uuid, p_template int, p_plan jsonb, p_monthly_limit int)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  t exam_templates%rowtype;
  ids bigint[];
  new_id uuid;
begin
  -- bir foydalanuvchining parallel so'rovlarini ketma-ket qilish (limit ikki marta o'tib ketmasin)
  perform pg_advisory_xact_lock(hashtext('mock:' || p_user::text));

  select * into t from exam_templates where id = p_template and is_active;
  if not found then return jsonb_build_object('ok', false, 'reason', 'template'); end if;

  -- tugallanmagan va vaqti o'tmagan sinov bo'lsa — o'shani davom ettiradi
  select id into new_id from attempts
   where user_id = p_user and mode = 'mock' and finished_at is null and deadline_at > now()
   order by started_at desc limit 1;
  if new_id is not null then return jsonb_build_object('ok', true, 'id', new_id, 'resumed', true); end if;

  if p_monthly_limit is not null and public.mocks_this_month(p_user) >= p_monthly_limit then
    return jsonb_build_object('ok', false, 'reason', 'limit');
  end if;

  select array_agg((e ->> 'q')::bigint order by ord) into ids
  from jsonb_array_elements(p_plan) with ordinality as x(e, ord);
  if coalesce(array_length(ids, 1), 0) = 0 then return jsonb_build_object('ok', false, 'reason', 'plan'); end if;

  insert into attempts (user_id, mode, template_id, question_ids, plan, deadline_at)
  values (p_user, 'mock', p_template, ids, p_plan, now() + make_interval(mins => t.duration_min))
  returning id into new_id;

  update daily_usage set mocks = mocks + 1 where user_id = p_user and day = public.uz_today();
  if not found then insert into daily_usage (user_id, mocks) values (p_user, 1); end if;

  return jsonb_build_object('ok', true, 'id', new_id, 'resumed', false);
end $$;

-- Javobni saqlash (baholanmaydi, o'zgartirish mumkin). Vaqt tugagach 30 soniya muhlat.
create or replace function public.save_mock_answer(p_user uuid, p_attempt uuid, p_question bigint, p_response jsonb)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  a attempts%rowtype;
begin
  select * into a from attempts where id = p_attempt and user_id = p_user and mode = 'mock';
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if a.finished_at is not null then return jsonb_build_object('ok', false, 'reason', 'finished'); end if;
  if now() > a.deadline_at + interval '30 seconds' then return jsonb_build_object('ok', false, 'reason', 'expired'); end if;
  if not (p_question = any (a.question_ids)) then return jsonb_build_object('ok', false, 'reason', 'not_in_attempt'); end if;

  insert into attempt_answers (attempt_id, question_id, response)
  values (p_attempt, p_question, p_response)
  on conflict (attempt_id, question_id) do update set response = excluded.response, answered_at = now();
  return jsonb_build_object('ok', true);
end $$;

-- Yakunlash: baholash natijalari serverda (lib/mock.ts + lib/questions.ts) hisoblanib beriladi.
-- p_results: [{"q": id, "correct": bool, "points": num}]
create or replace function public.finish_mock(
  p_user uuid, p_attempt uuid, p_results jsonb, p_raw numeric, p_scaled numeric, p_grade text,
  p_correct int, p_breakdown jsonb
) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  a attempts%rowtype;
  today date := public.uz_today();
begin
  select * into a from attempts where id = p_attempt and user_id = p_user and mode = 'mock' for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if a.finished_at is not null then return jsonb_build_object('ok', true, 'already', true); end if;

  update attempt_answers aa set is_correct = (r ->> 'correct')::boolean, points = (r ->> 'points')::numeric
  from jsonb_array_elements(p_results) r
  where aa.attempt_id = p_attempt and aa.question_id = (r ->> 'q')::bigint;

  -- Xato javoblar takrorlash navbatiga
  insert into review_queue (user_id, question_id, box, due_on, lapses)
  select p_user, aa.question_id, 1, today + 1, 1
  from attempt_answers aa where aa.attempt_id = p_attempt and aa.is_correct = false
  on conflict (user_id, question_id) do update set box = 1, due_on = today + 1, lapses = review_queue.lapses + 1;

  update attempts set finished_at = now(), raw_score = p_raw, scaled_score = p_scaled, grade = p_grade,
    correct_count = p_correct, breakdown = p_breakdown
  where id = p_attempt;
  return jsonb_build_object('ok', true, 'already', false);
end $$;

-- ─────────────────────────── Takrorlash ───────────────────────────
create or replace function public.start_review(p_user uuid, p_n int)
returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  ids bigint[];
  new_id uuid;
begin
  select coalesce(array_agg(question_id), '{}') into ids from (
    select r.question_id from review_queue r join questions q on q.id = r.question_id
    where r.user_id = p_user and r.due_on <= public.uz_today() and q.status = 'published'
    order by r.due_on, r.box, random()
    limit greatest(1, least(p_n, 50))
  ) s;
  if coalesce(array_length(ids, 1), 0) = 0 then raise exception 'no_questions' using errcode = 'P0001'; end if;
  insert into attempts (user_id, mode, question_ids) values (p_user, 'review', ids) returning id into new_id;
  return new_id;
end $$;

-- ─────────────────────────── Kunlik test ───────────────────────────
-- Kun bo'yicha hamma uchun bir xil 10 ta savol (musobaqa ruhi, reytingda solishtirish mumkin)
create or replace function public.daily_question_ids(p_day date) returns bigint[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(id), '{}') from (
    select id from questions
    where status = 'published' and type in ('single', 'fill_blank', 'case', 'matching')
    order by md5(id::text || p_day::text)
    limit 10
  ) s;
$$;

create or replace function public.start_daily(p_user uuid)
returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  today date := public.uz_today();
  existing uuid;
  ids bigint[] := public.daily_question_ids(today);
begin
  perform pg_advisory_xact_lock(hashtext('daily:' || p_user::text));
  select id into existing from attempts
   where user_id = p_user and mode = 'daily' and (started_at at time zone 'Asia/Tashkent')::date = today
   limit 1;
  if existing is not null then return existing; end if;
  if coalesce(array_length(ids, 1), 0) = 0 then raise exception 'no_questions' using errcode = 'P0001'; end if;
  insert into attempts (user_id, mode, question_ids) values (p_user, 'daily', ids) returning id into existing;
  return existing;
end $$;

-- Mijoz uchun: bugun takrorlanadigan savollar soni va oylik sinovlar (o'zi haqida)
create or replace function public.my_review_due() returns int
language sql stable security invoker set search_path = public as $$
  select count(*)::int from review_queue where user_id = auth.uid() and due_on <= public.uz_today();
$$;

revoke execute on function public.mocks_this_month(uuid), public.create_mock(uuid, int, jsonb, int),
  public.save_mock_answer(uuid, uuid, bigint, jsonb),
  public.finish_mock(uuid, uuid, jsonb, numeric, numeric, text, int, jsonb),
  public.start_review(uuid, int), public.daily_question_ids(date), public.start_daily(uuid)
  from public, anon, authenticated;
grant execute on function public.mocks_this_month(uuid), public.create_mock(uuid, int, jsonb, int),
  public.save_mock_answer(uuid, uuid, bigint, jsonb),
  public.finish_mock(uuid, uuid, jsonb, numeric, numeric, text, int, jsonb),
  public.start_review(uuid, int), public.daily_question_ids(date), public.start_daily(uuid)
  to service_role;
grant execute on function public.my_review_due() to authenticated;
