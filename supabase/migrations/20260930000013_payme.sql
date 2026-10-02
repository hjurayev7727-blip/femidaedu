-- Payme (Paycom Merchant API) — DOYSE kassasi orqali.
-- Payme so'rovlari doyse.uz ga keladi; DOYSE "F" bilan boshlanuvchi (Femida Edu) buyurtmalarni va o'zida topilmagan
-- tranzaksiyalarni bu yerga uzatadi (/api/pay/payme, maxfiy kalit bilan). Payme kalitini A+ bilmaydi.
--
-- To'lanmagan Payme buyurtmasi payments jadvaliga tushmaydi (admin tasdiqlash ro'yxati va talabaning
-- "Tekshirilmoqda" holati toza qoladi): PerformTransaction'da payments(paid) + subscriptions yoziladi.
-- Butun mantiq bitta SQL funksiyada — qatorlar qulflanadi, parallel so'rovlar ikki marta Premium bermaydi.

create table public.payme_orders (
  code        text primary key check (code ~ '^F[A-Z0-9]{9}$'),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  plan_code   text not null references public.plans (code),
  months      int not null check (months > 0),
  amount_uzs  int not null check (amount_uzs > 0),
  status      text not null default 'new' check (status in ('new', 'paid', 'cancelled', 'refunded')),
  payment_id  bigint references public.payments (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index payme_orders_user_idx on public.payme_orders (user_id, created_at desc);

create table public.payme_transactions (
  id            text primary key,                 -- Payme tranzaksiya ID
  order_code    text not null references public.payme_orders (code) on delete cascade,
  amount        bigint not null,                  -- tiyin
  state         smallint not null check (state in (1, 2, -1, -2)),
  reason        int,
  payme_time    bigint not null,                  -- Payme yaratgan vaqt (ms)
  create_time   bigint not null,
  perform_time  bigint not null default 0,
  cancel_time   bigint not null default 0
);
create index payme_tx_order_idx on public.payme_transactions (order_code);
create index payme_tx_time_idx on public.payme_transactions (payme_time);
-- Bitta buyurtmada bir vaqtda faqat bitta faol (state = 1) tranzaksiya
create unique index payme_tx_one_active on public.payme_transactions (order_code) where state = 1;

-- Qaysi obuna qaysi to'lovdan (Payme bekor qilsa — aynan shu muddat qaytariladi)
alter table public.subscriptions add column payment_id bigint references public.payments (id) on delete set null;

alter table public.payme_orders enable row level security;
alter table public.payme_transactions enable row level security;
revoke all on public.payme_orders, public.payme_transactions from anon, authenticated;
grant all on public.payme_orders, public.payme_transactions to service_role;

create or replace function public.payme_now() returns bigint
language sql volatile as $$ select (extract(epoch from clock_timestamp()) * 1000)::bigint $$;

-- Talaba "Payme orqali to'lash" ni bosganda: buyurtma kodi va summa
create or replace function public.create_payme_order(p_user uuid, p_plan text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  pl plans%rowtype;
  c text;
  abc constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
begin
  select * into pl from plans where code = p_plan and is_active;
  if not found then return jsonb_build_object('ok', false, 'reason', 'plan'); end if;

  -- Yaqinda yaratilgan, hali to'lanmagan va faol tranzaksiyasi yo'q buyurtma bo'lsa — o'shani qaytaramiz
  select o.code into c from payme_orders o
  where o.user_id = p_user and o.plan_code = pl.code and o.status = 'new' and o.amount_uzs = pl.price_uzs
    and o.created_at > now() - interval '12 hours'
    and not exists (select 1 from payme_transactions t where t.order_code = o.code)
  order by o.created_at desc limit 1;

  if c is null then
    loop
      c := 'F' || (select string_agg(substr(abc, 1 + floor(random() * length(abc))::int, 1), '') from generate_series(1, 9));
      exit when not exists (select 1 from payme_orders where code = c);
    end loop;
    insert into payme_orders (code, user_id, plan_code, months, amount_uzs) values (c, p_user, pl.code, pl.months, pl.price_uzs);
  end if;
  return jsonb_build_object('ok', true, 'code', c, 'amount_uzs', pl.price_uzs);
end $$;

-- Payme JSON-RPC mantig'i. Natija: {"result": …} yoki {"error": {"code": …, "message": …, "data": …}}
create or replace function public.payme_rpc(p_method text, p_params jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  timeout constant bigint := 12 * 3600 * 1000;
  o payme_orders%rowtype;
  t payme_transactions%rowtype;
  tx_id text := p_params ->> 'id';
  v_code text := p_params #>> '{account,order_id}';
  v_amount bigint;
  ts bigint := payme_now();
  pay_id bigint;
  base timestamptz;
  sub subscriptions%rowtype;
  removed interval;

begin
  if p_method in ('CheckPerformTransaction', 'CreateTransaction') then
    begin
      v_amount := (p_params ->> 'amount')::bigint;
    exception when others then
      return jsonb_build_object('error', jsonb_build_object('code', -31001, 'message', 'Wrong amount'));
    end;
  end if;

  if p_method = 'CheckPerformTransaction' then
    select * into o from payme_orders where payme_orders.code = v_code;
    if not found then return jsonb_build_object('error', jsonb_build_object('code', -31050, 'message', 'Order not found', 'data', 'order_id')); end if;
    if o.status <> 'new' then return jsonb_build_object('error', jsonb_build_object('code', -31051, 'message', 'Order is not payable', 'data', 'order_id')); end if;
    if v_amount <> o.amount_uzs::bigint * 100 then return jsonb_build_object('error', jsonb_build_object('code', -31001, 'message', 'Wrong amount')); end if;
    return jsonb_build_object('result', jsonb_build_object('allow', true));

  elsif p_method = 'CreateTransaction' then
    select * into t from payme_transactions where id = tx_id for update;
    if found then
      if t.state <> 1 then return jsonb_build_object('error', jsonb_build_object('code', -31008, 'message', 'Transaction is not active')); end if;
      if ts - t.payme_time > timeout then
        update payme_transactions set state = -1, reason = 4, cancel_time = ts where id = t.id;
        update payme_orders set status = 'cancelled' where payme_orders.code = t.order_code and status = 'new';
        return jsonb_build_object('error', jsonb_build_object('code', -31008, 'message', 'Timeout'));
      end if;
      return jsonb_build_object('result', jsonb_build_object('create_time', t.create_time, 'transaction', t.id, 'state', 1));
    end if;

    select * into o from payme_orders where payme_orders.code = v_code for update;
    if not found then return jsonb_build_object('error', jsonb_build_object('code', -31050, 'message', 'Order not found', 'data', 'order_id')); end if;
    if o.status <> 'new' then return jsonb_build_object('error', jsonb_build_object('code', -31051, 'message', 'Order is not payable', 'data', 'order_id')); end if;
    if v_amount <> o.amount_uzs::bigint * 100 then return jsonb_build_object('error', jsonb_build_object('code', -31001, 'message', 'Wrong amount')); end if;
    if exists (select 1 from payme_transactions where order_code = o.code and state = 1) then
      return jsonb_build_object('error', jsonb_build_object('code', -31050, 'message', 'Order has pending transaction', 'data', 'order_id'));
    end if;
    insert into payme_transactions (id, order_code, amount, state, payme_time, create_time)
    values (tx_id, o.code, v_amount, 1, coalesce((p_params ->> 'time')::bigint, ts), ts);
    return jsonb_build_object('result', jsonb_build_object('create_time', ts, 'transaction', tx_id, 'state', 1));

  elsif p_method = 'PerformTransaction' then
    select * into t from payme_transactions where id = tx_id for update;
    if not found then return jsonb_build_object('error', jsonb_build_object('code', -31003, 'message', 'Transaction not found')); end if;
    if t.state = 2 then return jsonb_build_object('result', jsonb_build_object('transaction', t.id, 'perform_time', t.perform_time, 'state', 2)); end if;
    if t.state <> 1 then return jsonb_build_object('error', jsonb_build_object('code', -31008, 'message', 'Transaction is cancelled')); end if;
    if ts - t.payme_time > timeout then
      update payme_transactions set state = -1, reason = 4, cancel_time = ts where id = t.id;
      update payme_orders set status = 'cancelled' where payme_orders.code = t.order_code and status = 'new';
      return jsonb_build_object('error', jsonb_build_object('code', -31008, 'message', 'Timeout'));
    end if;

    select * into o from payme_orders where payme_orders.code = t.order_code for update;
    insert into payments (user_id, provider, amount_uzs, months, status, external_id, plan_code, paid_at)
    values (o.user_id, 'payme', o.amount_uzs, o.months, 'paid', t.id, o.plan_code, now())
    returning id into pay_id;
    select greatest(now(), coalesce(max(ends_at), now())) into base from subscriptions where user_id = o.user_id;
    insert into subscriptions (user_id, plan, starts_at, ends_at, source, payment_id)
    values (o.user_id, o.plan_code, base, base + make_interval(months => o.months), 'payment', pay_id);
    update payme_orders set status = 'paid', payment_id = pay_id where payme_orders.code = o.code;
    update payme_transactions set state = 2, perform_time = ts where id = t.id;
    return jsonb_build_object('result', jsonb_build_object('transaction', t.id, 'perform_time', ts, 'state', 2));

  elsif p_method = 'CancelTransaction' then
    select * into t from payme_transactions where id = tx_id for update;
    if not found then return jsonb_build_object('error', jsonb_build_object('code', -31003, 'message', 'Transaction not found')); end if;
    if t.state < 0 then return jsonb_build_object('result', jsonb_build_object('transaction', t.id, 'cancel_time', t.cancel_time, 'state', t.state)); end if;

    select * into o from payme_orders where payme_orders.code = t.order_code for update;
    if t.state = 1 then
      update payme_transactions set state = -1, reason = (p_params ->> 'reason')::int, cancel_time = ts where id = t.id;
      update payme_orders set status = 'cancelled' where payme_orders.code = o.code and status = 'new';
      return jsonb_build_object('result', jsonb_build_object('transaction', t.id, 'cancel_time', ts, 'state', -1));
    end if;

    -- To'langan tranzaksiya bekor qilindi (pul qaytarildi): shu to'lovning Premium muddati olib tashlanadi,
    -- undan keyin navbatda turgan obunalar shu muddatga oldinga suriladi
    update payme_transactions set state = -2, reason = (p_params ->> 'reason')::int, cancel_time = ts where id = t.id;
    update payme_orders set status = 'refunded' where payme_orders.code = o.code;
    if o.payment_id is not null then
      update payments set status = 'refunded' where id = o.payment_id;
      select * into sub from subscriptions where payment_id = o.payment_id for update;
      if found then
        removed := sub.ends_at - greatest(sub.starts_at, least(now(), sub.ends_at));
        update subscriptions set ends_at = greatest(starts_at, least(now(), ends_at)) where id = sub.id;
        update subscriptions set starts_at = starts_at - removed, ends_at = ends_at - removed
        where user_id = sub.user_id and id <> sub.id and starts_at >= sub.ends_at;
      end if;
    end if;
    return jsonb_build_object('result', jsonb_build_object('transaction', t.id, 'cancel_time', ts, 'state', -2));

  elsif p_method = 'CheckTransaction' then
    select * into t from payme_transactions where id = tx_id;
    if not found then return jsonb_build_object('error', jsonb_build_object('code', -31003, 'message', 'Transaction not found')); end if;
    return jsonb_build_object('result', jsonb_build_object(
      'create_time', t.create_time, 'perform_time', t.perform_time, 'cancel_time', t.cancel_time,
      'transaction', t.id, 'state', t.state, 'reason', t.reason));

  elsif p_method = 'GetStatement' then
    return jsonb_build_object('result', jsonb_build_object('transactions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t2.id, 'time', t2.payme_time, 'amount', t2.amount, 'account', jsonb_build_object('order_id', t2.order_code),
        'create_time', t2.create_time, 'perform_time', t2.perform_time, 'cancel_time', t2.cancel_time,
        'transaction', t2.id, 'state', t2.state, 'reason', t2.reason) order by t2.payme_time)
      from payme_transactions t2
      where t2.payme_time between coalesce((p_params ->> 'from')::bigint, 0) and coalesce((p_params ->> 'to')::bigint, 0)
    ), '[]'::jsonb)));
  end if;

  return jsonb_build_object('error', jsonb_build_object('code', -32601, 'message', 'Method not found'));
end $$;

revoke all on function public.create_payme_order(uuid, text), public.payme_rpc(text, jsonb), public.payme_now()
  from public, anon, authenticated;
grant execute on function public.create_payme_order(uuid, text), public.payme_rpc(text, jsonb), public.payme_now() to service_role;
