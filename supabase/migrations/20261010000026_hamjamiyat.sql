-- Hamjamiyat Telegram guruhi (@huquq_klubi muhokama guruhi): botning AI javoblari limiti va kunlik post (takrorsiz).
-- Guruh a'zolarining ko'pchiligida profil yo'q — shuning uchun Telegram ID bo'yicha. Faqat server (service_role).

-- Kunlik javoblar: telegram_id = 0 — butun guruh bo'yicha jami
create table public.community_usage (
  chat_id     bigint not null,
  day         date not null default public.uz_today(),
  telegram_id bigint not null,
  answers     int not null default 0,
  primary key (chat_id, day, telegram_id)
);

-- Kunlik post: (guruh, sana) bo'yicha bitta qator — cron ikki marta chaqirilsa ham ikkinchi post chiqmaydi
create table public.community_posts (
  chat_id    bigint not null,
  day        date not null,
  created_at timestamptz not null default now(),
  primary key (chat_id, day)
);

alter table public.community_usage enable row level security;
alter table public.community_posts enable row level security;
revoke all on public.community_usage, public.community_posts from anon, authenticated;
grant all on public.community_usage, public.community_posts to service_role;

-- Atomar: foydalanuvchi va guruh limitidan biri tugagan bo'lsa false (hisob o'zgarmaydi)
create or replace function public.consume_community_quota(p_chat bigint, p_user bigint, p_user_limit int, p_chat_limit int)
returns boolean
language plpgsql volatile security definer set search_path = public as $$
declare
  d date := public.uz_today();
  total int;
  mine int;
begin
  if p_user is null or p_user <= 0 then return false; end if;
  insert into community_usage (chat_id, day, telegram_id) values (p_chat, d, 0), (p_chat, d, p_user) on conflict do nothing;
  -- Har doim avval guruh qatori qulflanadi — parallel so'rovlarda deadlock bo'lmaydi
  select answers into total from community_usage where chat_id = p_chat and day = d and telegram_id = 0 for update;
  select answers into mine from community_usage where chat_id = p_chat and day = d and telegram_id = p_user for update;
  if total >= p_chat_limit or mine >= p_user_limit then return false; end if;
  update community_usage set answers = answers + 1 where chat_id = p_chat and day = d and telegram_id in (0, p_user);
  return true;
end $$;

revoke execute on function public.consume_community_quota(bigint, bigint, int, int) from public, anon, authenticated;
grant execute on function public.consume_community_quota(bigint, bigint, int, int) to service_role;
