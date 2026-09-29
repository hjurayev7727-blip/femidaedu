-- Premium: tariflar, qo'lda to'lov (chek → admin tasdiqlaydi), sozlamalar.
-- Click / Payme / Uzum keyinroq shu payments jadvali orqali ulanadi (provider + external_id).

create table public.plans (
  code      text primary key,                  -- 'oy1', 'oy3', 'imtihongacha'
  title     text not null,
  months    int not null check (months between 1 and 24),
  price_uzs int not null check (price_uzs > 0),
  is_active boolean not null default true,
  sort      int not null default 0
);

-- Admin tahrirlaydigan ochiq sozlamalar (maxfiy kalitlar bu yerda SAQLANMAYDI — ular .env da)
create table public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id)
);

alter table public.payments
  add column plan_code text references public.plans (code),
  add column reject_reason text;

-- Bitta foydalanuvchida bir vaqtda faqat bitta ko'rib chiqilayotgan qo'lda to'lov
create unique index payments_one_pending on public.payments (user_id) where status = 'pending' and provider = 'manual';

alter table public.plans enable row level security;
alter table public.app_settings enable row level security;
revoke all on public.plans, public.app_settings from anon, authenticated;
grant select on public.plans to anon, authenticated;
create policy plans_read on public.plans for select using (is_active);
grant select on public.app_settings to authenticated;
create policy settings_read on public.app_settings for select to authenticated using (key in ('manual_payment'));

-- ─────────────────────────── Funksiyalar (faqat server) ───────────────────────────
create or replace function public.create_manual_payment(p_user uuid, p_plan text, p_receipt text)
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
  insert into payments (user_id, provider, amount_uzs, months, status, receipt_path, plan_code)
  values (p_user, 'manual', pl.price_uzs, pl.months, 'pending', p_receipt, pl.code)
  returning id into new_id;
  return jsonb_build_object('ok', true, 'id', new_id);
end $$;

-- Tasdiqlash: obuna joriy obuna tugagan kundan (yoki hozirdan) boshlab uzaytiriladi. Qayta chaqirish xavfsiz.
create or replace function public.approve_payment(p_admin uuid, p_payment bigint)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  p payments%rowtype;
  base timestamptz;
begin
  if not exists (select 1 from profiles where id = p_admin and role = 'admin') then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;
  select * into p from payments where id = p_payment for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if p.status = 'paid' then return jsonb_build_object('ok', true, 'already', true); end if;
  if p.status <> 'pending' then return jsonb_build_object('ok', false, 'reason', 'status'); end if;

  select greatest(now(), coalesce(max(ends_at), now())) into base from subscriptions where user_id = p.user_id;
  insert into subscriptions (user_id, plan, starts_at, ends_at, source)
  values (p.user_id, coalesce(p.plan_code, 'premium'), base, base + make_interval(months => p.months), 'payment');

  update payments set status = 'paid', paid_at = now(), reviewed_by = p_admin where id = p_payment;
  return jsonb_build_object('ok', true, 'already', false, 'ends_at', base + make_interval(months => p.months));
end $$;

create or replace function public.reject_payment(p_admin uuid, p_payment bigint, p_reason text)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
begin
  if not exists (select 1 from profiles where id = p_admin and role = 'admin') then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;
  update payments set status = 'rejected', reviewed_by = p_admin, reject_reason = left(p_reason, 500)
  where id = p_payment and status = 'pending';
  if not found then return jsonb_build_object('ok', false, 'reason', 'status'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- Mijoz uchun: o'z Premium muddati
create or replace function public.my_premium_until() returns timestamptz
language sql stable security invoker set search_path = public as $$
  select max(ends_at) from subscriptions where user_id = auth.uid() and ends_at > now();
$$;

revoke execute on function public.create_manual_payment(uuid, text, text), public.approve_payment(uuid, bigint),
  public.reject_payment(uuid, bigint, text) from public, anon, authenticated;
grant execute on function public.create_manual_payment(uuid, text, text), public.approve_payment(uuid, bigint),
  public.reject_payment(uuid, bigint, text) to service_role;
grant execute on function public.my_premium_until() to authenticated;

-- ─────────────────────────── Chek rasmlari uchun yopiq bucket ───────────────────────────
-- Faqat Supabase'da (storage sxemasi bor joyda). Yuklash va ko'rish faqat server orqali (admin klient),
-- shuning uchun mijoz uchun storage policy kerak emas — bucket yopiq.
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('receipts', 'receipts', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
    on conflict (id) do nothing;
  end if;
end $$;
