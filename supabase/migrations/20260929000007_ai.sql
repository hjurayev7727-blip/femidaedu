-- AI: kunlik limit, yozma javobni AI qayta tekshiruvi natijasini yozish.

-- Kunlik AI so'rovlar limiti (atomar). p_limit null — cheksiz (xodimlar).
create or replace function public.consume_ai_quota(p_user uuid, p_limit int) returns boolean
language plpgsql volatile security definer set search_path = public as $$
declare
  used int;
begin
  insert into daily_usage (user_id, day) values (p_user, public.uz_today()) on conflict do nothing;
  update daily_usage set ai_calls = ai_calls + 1
   where user_id = p_user and day = public.uz_today() and (p_limit is null or ai_calls < p_limit)
  returning ai_calls into used;
  return used is not null;
end $$;

-- AI qayta tekshiruvi: faqat o'z urinishidagi, xato deb baholangan va hali AI ko'rmagan javob.
-- AI "to'g'ri" desa — javob to'g'ri deb belgilanadi, takrorlash navbatidan olinadi, natija qayta hisoblanadi.
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
  if a.mode = 'mock' then return jsonb_build_object('ok', false, 'reason', 'mock'); end if; -- sinov natijasi o'zgarmaydi
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

revoke execute on function public.consume_ai_quota(uuid, int), public.apply_ai_regrade(uuid, uuid, bigint, boolean, jsonb)
  from public, anon, authenticated;
grant execute on function public.consume_ai_quota(uuid, int), public.apply_ai_regrade(uuid, uuid, bigint, boolean, jsonb)
  to service_role;
