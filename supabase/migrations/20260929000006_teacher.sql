-- O'qituvchi paneli: guruhga qo'shilish, guruh statistikasi, zaif mavzular, vazifalar.
-- O'qituvchi funksiyalari security definer + ichida egalik tekshiruvi (o'qituvchi faqat o'z guruhini ko'radi).

-- Guruh egasi yoki admin
create or replace function public.can_manage_group(p_group bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from groups where id = p_group and teacher_id = auth.uid())
      or public.current_role_is('admin');
$$;

-- Taklif kodi bo'yicha guruh haqida ochiq ma'lumot (qo'shilish sahifasi uchun)
create or replace function public.group_by_invite(p_code text)
returns table (id bigint, name text, teacher_name text, members int, grants_premium boolean)
language sql stable security definer set search_path = public as $$
  select g.id, g.name, p.full_name, (select count(*)::int from group_members m where m.group_id = g.id), g.grants_premium
  from groups g join profiles p on p.id = g.teacher_id
  where g.invite_code = p_code;
$$;

-- Qo'shilish (server orqali)
create or replace function public.join_group(p_user uuid, p_code text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  g groups%rowtype;
begin
  select * into g from groups where invite_code = p_code;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if g.teacher_id = p_user then return jsonb_build_object('ok', false, 'reason', 'own'); end if;
  insert into group_members (group_id, user_id) values (g.id, p_user) on conflict do nothing;
  return jsonb_build_object('ok', true, 'group_id', g.id, 'name', g.name);
end $$;

-- O'quvchilar statistikasi (oxirgi 7 kun va umumiy)
create or replace function public.group_stats(p_group bigint)
returns table (
  user_id uuid, full_name text, telegram_username text, joined_at timestamptz,
  streak_days int, last_active_on date,
  answered_7d int, correct_7d int, answered_total int, correct_total int,
  review_due int, last_mock_grade text, last_mock_scaled numeric
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.can_manage_group(p_group) then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
  select p.id, p.full_name, p.telegram_username, m.joined_at, p.streak_days, p.last_active_on,
    coalesce(s.a7, 0)::int, coalesce(s.c7, 0)::int, coalesce(s.at, 0)::int, coalesce(s.ct, 0)::int,
    (select count(*)::int from review_queue r where r.user_id = p.id and r.due_on <= public.uz_today()),
    lm.grade, lm.scaled_score
  from group_members m
  join profiles p on p.id = m.user_id
  left join lateral (
    select count(*) filter (where aa.answered_at > now() - interval '7 days') as a7,
           count(*) filter (where aa.answered_at > now() - interval '7 days' and aa.is_correct) as c7,
           count(*) filter (where aa.is_correct is not null) as at,
           count(*) filter (where aa.is_correct) as ct
    from attempts a join attempt_answers aa on aa.attempt_id = a.id
    where a.user_id = p.id
  ) s on true
  left join lateral (
    select x.grade, x.scaled_score from attempts x
    where x.user_id = p.id and x.mode = 'mock' and x.finished_at is not null
    order by x.finished_at desc limit 1
  ) lm on true
  where m.group_id = p_group
  order by p.full_name;
end $$;

-- Guruhning zaif mavzulari (oxirgi 30 kun, kamida 10 ta javob bo'lgan hujjatlar)
create or replace function public.group_weak_topics(p_group bigint)
returns table (document_number int, title text, answered int, correct int, students int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.can_manage_group(p_group) then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
  select d.number, d.short_title, count(*)::int, count(*) filter (where aa.is_correct)::int, count(distinct a.user_id)::int
  from group_members m
  join attempts a on a.user_id = m.user_id
  join attempt_answers aa on aa.attempt_id = a.id and aa.is_correct is not null
  join questions q on q.id = aa.question_id
  join documents d on d.id = q.document_id
  where m.group_id = p_group and aa.answered_at > now() - interval '30 days'
  group by d.number, d.short_title
  having count(*) >= 10
  order by count(*) filter (where aa.is_correct)::numeric / count(*), count(*) desc;
end $$;

-- Vazifani boshlash: guruh a'zosi uchun bitta urinish (davom ettirish yoki natija)
create or replace function public.start_assignment(p_user uuid, p_assignment bigint)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  asg assignments%rowtype;
  existing uuid;
  ids bigint[];
  new_id uuid;
begin
  select * into asg from assignments where id = p_assignment;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if not exists (select 1 from group_members where group_id = asg.group_id and user_id = p_user) then
    return jsonb_build_object('ok', false, 'reason', 'not_member');
  end if;
  perform pg_advisory_xact_lock(hashtext('asg:' || p_user::text || ':' || p_assignment::text));
  select id into existing from attempts where user_id = p_user and assignment_id = p_assignment order by started_at limit 1;
  if existing is not null then return jsonb_build_object('ok', true, 'id', existing); end if;
  if asg.topic_id is null then return jsonb_build_object('ok', false, 'reason', 'no_topic'); end if;

  ids := public.pick_practice_questions(p_user, asg.topic_id, coalesce(asg.question_count, 10));
  if coalesce(array_length(ids, 1), 0) = 0 then return jsonb_build_object('ok', false, 'reason', 'no_questions'); end if;
  insert into attempts (user_id, mode, topic_id, assignment_id, question_ids)
  values (p_user, 'assignment', asg.topic_id, p_assignment, ids)
  returning id into new_id;
  return jsonb_build_object('ok', true, 'id', new_id);
end $$;

-- Vazifa bajarilishi (o'qituvchi uchun)
create or replace function public.assignment_progress(p_assignment bigint)
returns table (user_id uuid, full_name text, status text, correct int, total int, score numeric, finished_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare
  gid bigint;
begin
  select group_id into gid from assignments where id = p_assignment;
  if gid is null or not public.can_manage_group(gid) then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
  select p.id, p.full_name,
    case when a.id is null then 'new' when a.finished_at is null then 'started' else 'done' end,
    a.correct_count, coalesce(array_length(a.question_ids, 1), 0), a.raw_score, a.finished_at
  from group_members m
  join profiles p on p.id = m.user_id
  left join lateral (select * from attempts t where t.user_id = m.user_id and t.assignment_id = p_assignment order by started_at limit 1) a on true
  where m.group_id = gid
  order by (a.finished_at is null), a.raw_score desc nulls last, p.full_name;
end $$;

-- O'quvchining vazifalari (bosh sahifa uchun)
create or replace function public.my_assignments()
returns table (id bigint, title text, group_name text, topic_title text, question_count int, due_at timestamptz,
               attempt_id uuid, finished boolean, score numeric)
language sql stable security definer set search_path = public as $$
  select s.id, s.title, g.name, t.title, s.question_count, s.due_at, a.id, a.finished_at is not null, a.raw_score
  from assignments s
  join groups g on g.id = s.group_id
  join group_members m on m.group_id = g.id and m.user_id = auth.uid()
  left join topics t on t.id = s.topic_id
  left join lateral (select * from attempts x where x.user_id = auth.uid() and x.assignment_id = s.id order by started_at limit 1) a on true
  where s.created_at > now() - interval '60 days'
  order by (a.finished_at is not null), s.due_at nulls last, s.created_at desc;
$$;

-- Admin: foydalanuvchiga rol berish va Premium sovg'a qilish
create or replace function public.admin_set_role(p_admin uuid, p_user uuid, p_role public.user_role) returns boolean
language plpgsql volatile security definer set search_path = public as $$
begin
  if not exists (select 1 from profiles where id = p_admin and role = 'admin') then return false; end if;
  if p_admin = p_user and p_role <> 'admin' then return false; end if; -- o'zini admin'likdan tushirib qo'ymasin
  update profiles set role = p_role where id = p_user;
  return found;
end $$;

create or replace function public.admin_grant_premium(p_admin uuid, p_user uuid, p_months int) returns boolean
language plpgsql volatile security definer set search_path = public as $$
declare
  base timestamptz;
begin
  if not exists (select 1 from profiles where id = p_admin and role = 'admin') then return false; end if;
  if p_months not between 1 and 24 then return false; end if;
  select greatest(now(), coalesce(max(ends_at), now())) into base from subscriptions where user_id = p_user;
  insert into subscriptions (user_id, plan, starts_at, ends_at, source) values (p_user, 'promo', base, base + make_interval(months => p_months), 'promo');
  return true;
end $$;

create or replace function public.admin_set_group_premium(p_admin uuid, p_group bigint, p_on boolean) returns boolean
language plpgsql volatile security definer set search_path = public as $$
begin
  if not exists (select 1 from profiles where id = p_admin and role = 'admin') then return false; end if;
  update groups set grants_premium = p_on where id = p_group;
  return found;
end $$;

-- O'qituvchi o'z guruhidagi vazifa bo'yicha a'zo urinishini ko'ra oladi (RLS allaqachon teaches() orqali ruxsat beradi)

revoke execute on function public.join_group(uuid, text), public.start_assignment(uuid, bigint),
  public.admin_set_role(uuid, uuid, public.user_role), public.admin_grant_premium(uuid, uuid, int),
  public.admin_set_group_premium(uuid, bigint, boolean) from public, anon, authenticated;
grant execute on function public.join_group(uuid, text), public.start_assignment(uuid, bigint),
  public.admin_set_role(uuid, uuid, public.user_role), public.admin_grant_premium(uuid, uuid, int),
  public.admin_set_group_premium(uuid, bigint, boolean) to service_role;

revoke execute on function public.group_by_invite(text), public.group_stats(bigint), public.group_weak_topics(bigint),
  public.assignment_progress(bigint), public.my_assignments(), public.can_manage_group(bigint) from public, anon;
grant execute on function public.group_by_invite(text), public.group_stats(bigint), public.group_weak_topics(bigint),
  public.assignment_progress(bigint), public.my_assignments(), public.can_manage_group(bigint) to authenticated;
