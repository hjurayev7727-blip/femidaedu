-- O'qituvchi: taklif havolasini yangilash; muddati o'tgan vazifani boshlab bo'lmaydi.

-- Havola begona qo'lga tushsa — o'qituvchi yangi kod oladi, eski havola darhol ishlamay qoladi.
-- Kod server tomonda tasodifiy yaratiladi (o'qituvchi taxmin qilinadigan kod qo'ya olmaydi).
create or replace function public.regenerate_invite(p_group bigint) returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  code text := substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
begin
  if not public.can_manage_group(p_group) then raise exception 'forbidden' using errcode = '42501'; end if;
  update groups set invite_code = code where id = p_group;
  return code;
end $$;
revoke execute on function public.regenerate_invite(bigint) from public, anon;
grant execute on function public.regenerate_invite(bigint) to authenticated;

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
  -- Muddat o'tgan: yangi urinish boshlanmaydi (boshlangani yuqorida davom ettirildi)
  if asg.due_at is not null and now() > asg.due_at then return jsonb_build_object('ok', false, 'reason', 'overdue'); end if;
  if asg.topic_id is null then return jsonb_build_object('ok', false, 'reason', 'no_topic'); end if;

  ids := public.pick_practice_questions(p_user, asg.topic_id, coalesce(asg.question_count, 10));
  if coalesce(array_length(ids, 1), 0) = 0 then return jsonb_build_object('ok', false, 'reason', 'no_questions'); end if;
  insert into attempts (user_id, mode, topic_id, assignment_id, question_ids)
  values (p_user, 'assignment', asg.topic_id, p_assignment, ids)
  returning id into new_id;
  return jsonb_build_object('ok', true, 'id', new_id);
end $$;
