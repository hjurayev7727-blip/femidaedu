-- Telegram bot: xabar yuborish ruxsati, eslatma sozlamalari, qabul qiluvchilar va /natija statistikasi.

alter table public.profiles
  add column bot_enabled boolean not null default false,     -- foydalanuvchi botga /start bosgan va bloklamagan
  add column notify_morning boolean not null default true,   -- 08:00 — kunlik test
  add column notify_evening boolean not null default true;   -- 20:00 — streak eslatmasi

-- Foydalanuvchi eslatmalarni o'zi yoqib/o'chira oladi (bot_enabled — faqat server)
grant update (notify_morning, notify_evening) on public.profiles to authenticated;

-- Eslatma oluvchilar. morning: barcha faollar; evening: bugun hali 10 ta savol yechmagan va
-- oxirgi 7 kunda faol bo'lganlar (uzoq vaqt kirmaganlarni bezovta qilmaslik uchun).
create or replace function public.bot_recipients(p_slot text)
returns table (telegram_id bigint, full_name text, streak_days int, questions_today int, review_due int)
language sql stable security definer set search_path = public as $$
  select p.telegram_id, p.full_name, p.streak_days,
         coalesce(u.questions, 0),
         (select count(*)::int from review_queue r where r.user_id = p.id and r.due_on <= public.uz_today())
  from profiles p
  left join daily_usage u on u.user_id = p.id and u.day = public.uz_today()
  where p.telegram_id is not null and p.bot_enabled
    and case p_slot
      when 'morning' then p.notify_morning
      when 'evening' then p.notify_evening and coalesce(u.questions, 0) < 10
        and p.last_active_on >= public.uz_today() - 7
      else false
    end
  order by p.telegram_id;
$$;

-- /natija uchun qisqa statistika
create or replace function public.bot_user_stats(p_telegram bigint) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((
    select jsonb_build_object(
      'found', true,
      'user_id', p.id,
      'name', p.full_name,
      'streak', p.streak_days,
      'best', p.streak_best,
      'today', coalesce((select questions from daily_usage where user_id = p.id and day = public.uz_today()), 0),
      'due', (select count(*) from review_queue r where r.user_id = p.id and r.due_on <= public.uz_today()),
      'answered', (select count(*) from attempt_answers aa join attempts a on a.id = aa.attempt_id where a.user_id = p.id),
      'last_mock', (select jsonb_build_object('grade', grade, 'scaled', scaled_score, 'at', finished_at)
                    from attempts where user_id = p.id and mode = 'mock' and finished_at is not null
                    order by finished_at desc limit 1)
    ) from profiles p where p.telegram_id = p_telegram
  ), jsonb_build_object('found', false));
$$;

revoke execute on function public.bot_recipients(text), public.bot_user_stats(bigint) from public, anon, authenticated;
grant execute on function public.bot_recipients(text), public.bot_user_stats(bigint) to service_role;
