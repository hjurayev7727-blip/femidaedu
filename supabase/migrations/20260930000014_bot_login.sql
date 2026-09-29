-- Saytga bot orqali kirish: sayt bir martalik kod yaratadi (brauzer cookie'siga bog'langan),
-- foydalanuvchi t.me/<bot>?start=login_<kod> ni ochib, botda "Tasdiqlash" ni bosadi, sayt esa kirish holatini so'raydi.
-- Bazada kodning o'zi emas, faqat SHA-256 xeshi saqlanadi. Faqat server (service_role) ishlatadi.

create table public.bot_logins (
  id            uuid primary key default gen_random_uuid(),
  token_hash    text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default now() + interval '10 minutes',
  tg            jsonb,                 -- tasdiqlagan Telegram foydalanuvchisi (callback_query.from)
  confirmed_at  timestamptz,
  used_at       timestamptz
);
create index bot_logins_expires_idx on public.bot_logins (expires_at);

alter table public.bot_logins enable row level security;
revoke all on public.bot_logins from anon, authenticated;
grant all on public.bot_logins to service_role;
