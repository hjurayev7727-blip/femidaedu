-- Yurist xizmatlari uchun escrow: mijoz oldindan to'laydi (Payme yoki karta + chek), pul platformada saqlanadi,
-- mijoz "bajarildi" desa yoki yurist topshirgandan keyin 3 kun ichida e'tiroz bo'lmasa — yuristga o'tadi (admin qo'lda to'laydi).
-- Komissiya buyurtma yaratilganda qayd etiladi: kamida 20%. Nizo — admin hal qiladi. Premium to'lovlari o'zgarmaydi.
-- Bo'lim app_settings.lawyer_payments_enabled bilan yoqiladi (standart: o'chiq — huquqiy xulosadan keyin).

create table public.service_orders (
  id              bigserial primary key,
  client_id       uuid not null references public.profiles (id) on delete restrict,
  lawyer_id       uuid not null references public.lawyer_profiles (user_id) on delete restrict,
  conversation_id uuid references public.conversations (id) on delete set null,
  offer_id        bigint unique references public.request_offers (id) on delete set null,
  title           text not null check (char_length(title) between 3 and 1000),
  amount_uzs      int not null check (amount_uzs between 10000 and 100000000),
  commission_pct  int not null check (commission_pct between 20 and 90),
  commission_uzs  int not null check (commission_uzs >= 0),
  payout_uzs      int not null check (payout_uzs >= 0),
  status          text not null default 'awaiting_payment' check (status in
                  ('awaiting_payment', 'review', 'held', 'delivered', 'disputed', 'released', 'paid_out', 'refunded', 'cancelled')),
  provider        text check (provider in ('payme', 'manual')),
  external_id     text,
  receipt_path    text,
  receipt_sha256  text,
  receipt_note    text check (char_length(receipt_note) <= 500),
  paid_at         timestamptz,
  delivered_at    timestamptz,
  release_after   timestamptz,
  released_at     timestamptz,
  refunded_at     timestamptz,
  payout_id       bigint,
  clawback        boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (commission_uzs + payout_uzs = amount_uzs),
  check (client_id <> lawyer_id)
);
create index service_orders_client_idx on public.service_orders (client_id, created_at desc);
create index service_orders_lawyer_idx on public.service_orders (lawyer_id, created_at desc);
create index service_orders_due_idx on public.service_orders (release_after) where status = 'delivered';
create unique index service_orders_receipt_uniq on public.service_orders (receipt_sha256) where receipt_sha256 is not null and status <> 'cancelled';
create trigger service_orders_touch before update on public.service_orders for each row execute function public.touch_updated_at();

create table public.order_disputes (
  order_id    bigint primary key references public.service_orders (id) on delete cascade,
  opened_by   uuid not null references public.profiles (id),
  reason      text not null check (char_length(reason) between 10 and 2000),
  status      text not null default 'open' check (status in ('open', 'resolved')),
  resolution  text check (resolution in ('release', 'refund')),
  admin_note  text check (char_length(admin_note) <= 1000),
  resolved_by uuid references public.profiles (id),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.lawyer_payouts (
  id          bigserial primary key,
  lawyer_id   uuid not null references public.lawyer_profiles (user_id) on delete restrict,
  amount_uzs  bigint not null check (amount_uzs > 0),
  order_ids   bigint[] not null,
  card_last4  text,
  reference   text not null check (char_length(reference) between 3 and 200),
  paid_by     uuid not null references public.profiles (id),
  paid_at     timestamptz not null default now()
);
alter table public.service_orders add constraint service_orders_payout_fk foreign key (payout_id) references public.lawyer_payouts (id);

create table public.lawyer_reviews (
  order_id   bigint primary key references public.service_orders (id) on delete cascade,
  client_id  uuid not null references public.profiles (id) on delete cascade,
  lawyer_id  uuid not null references public.lawyer_profiles (user_id) on delete cascade,
  rating     int not null check (rating between 1 and 5),
  body       text check (char_length(body) <= 1000),
  hidden     boolean not null default false,
  created_at timestamptz not null default now()
);
create index lawyer_reviews_lawyer_idx on public.lawyer_reviews (lawyer_id, created_at desc);

-- Reyting yig'indisi (yashirilgan sharhlar hisobga olinmaydi)
create or replace function public.lawyer_reviews_rating() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_lawyer uuid := coalesce(new.lawyer_id, old.lawyer_id);
begin
  update lawyer_profiles set
    rating_sum = (select coalesce(sum(rating), 0) from lawyer_reviews where lawyer_id = v_lawyer and not hidden),
    rating_count = (select count(*) from lawyer_reviews where lawyer_id = v_lawyer and not hidden)
  where user_id = v_lawyer;
  return null;
end $$;
create trigger lawyer_reviews_rating after insert or update or delete on public.lawyer_reviews
  for each row execute function public.lawyer_reviews_rating();

alter table public.service_orders enable row level security;
alter table public.order_disputes enable row level security;
alter table public.lawyer_payouts enable row level security;
alter table public.lawyer_reviews enable row level security;
revoke all on public.service_orders, public.order_disputes, public.lawyer_payouts, public.lawyer_reviews from anon, authenticated;
grant all on public.service_orders, public.order_disputes, public.lawyer_payouts, public.lawyer_reviews to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Payme buyurtmalari: Premium yoki yurist xizmati (kod formati o'zgarmaydi — DOYSE "F…" ni uzatadi)
alter table public.payme_orders add column kind text not null default 'premium' check (kind in ('premium', 'service'));
alter table public.payme_orders add column service_order_id bigint references public.service_orders (id) on delete cascade;
alter table public.payme_orders alter column plan_code drop not null, alter column months drop not null;
alter table public.payme_orders add constraint payme_orders_kind_shape check (
  (kind = 'premium' and plan_code is not null and months > 0 and service_order_id is null)
  or (kind = 'service' and service_order_id is not null and plan_code is null));

insert into public.app_settings (key, value) values ('lawyer_payments_enabled', 'false'::jsonb) on conflict (key) do nothing;

-- ─────────────────────────── Funksiyalar (faqat server) ───────────────────────────

create or replace function public.new_payme_code() returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  c text;
  abc constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
begin
  loop
    c := 'F' || (select string_agg(substr(abc, 1 + floor(random() * length(abc))::int, 1), '') from generate_series(1, 9));
    exit when not exists (select 1 from payme_orders where code = c);
  end loop;
  return c;
end $$;

/** Komissiya: sozlamadagi foiz, lekin kamida 20% */
create or replace function public.lawyer_commission_pct() returns int
language sql stable security definer set search_path = public as $$
  select greatest(20, least(90, coalesce((select (value #>> '{}')::int from app_settings where key = 'lawyer_commission_pct'), 20)))
$$;

/** Suhbatda to'langan buyurtma bormi — kontaktlar ochiladi (5-bosqichdagi vaqtinchalik funksiya almashtiriladi) */
create or replace function public.conversation_paid(p_conv uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from service_orders where conversation_id = p_conv and status in ('held', 'delivered', 'disputed', 'released', 'paid_out'))
$$;

/** Taklifni qabul qilish → buyurtma (to'lov kutilmoqda). Takror chaqiruv o'sha buyurtmani qaytaradi. */
create or replace function public.create_service_order(p_user uuid, p_offer bigint) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  o request_offers%rowtype;
  v_id bigint;
  v_pct int := public.lawyer_commission_pct();
  v_comm int;
begin
  select id into v_id from service_orders where offer_id = p_offer and client_id = p_user and status in ('awaiting_payment', 'review');
  if v_id is not null then return jsonb_build_object('ok', true, 'id', v_id); end if;
  select * into o from request_offers where id = p_offer for update;
  if not found or o.client_id <> p_user then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if o.status <> 'pending' then return jsonb_build_object('ok', false, 'reason', 'offer'); end if;
  if not exists (select 1 from lawyer_profiles where user_id = o.lawyer_id and status = 'active') then
    return jsonb_build_object('ok', false, 'reason', 'lawyer');
  end if;
  v_comm := ceil(o.price_uzs * v_pct / 100.0)::int;
  insert into service_orders (client_id, lawyer_id, conversation_id, offer_id, title, amount_uzs, commission_pct, commission_uzs, payout_uzs)
  values (p_user, o.lawyer_id, o.conversation_id, o.id, o.note, o.price_uzs, v_pct, v_comm, o.price_uzs - v_comm)
  returning id into v_id;
  update request_offers set status = 'accepted' where id = o.id;
  perform public.post_system_message(o.conversation_id, 'Mijoz taklifni qabul qildi. To''lov kutilmoqda.');
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.create_service_payme_order(p_user uuid, p_order bigint) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  s service_orders%rowtype;
  c text;
begin
  select * into s from service_orders where id = p_order and client_id = p_user for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if s.status <> 'awaiting_payment' then return jsonb_build_object('ok', false, 'reason', 'status'); end if;
  select o.code into c from payme_orders o
  where o.service_order_id = s.id and o.status = 'new' and o.amount_uzs = s.amount_uzs
    and not exists (select 1 from payme_transactions t where t.order_code = o.code and t.state <> 1)
  order by o.created_at desc limit 1;
  if c is null then
    c := public.new_payme_code();
    insert into payme_orders (code, user_id, kind, service_order_id, amount_uzs) values (c, p_user, 'service', s.id, s.amount_uzs);
  end if;
  return jsonb_build_object('ok', true, 'code', c, 'amount_uzs', s.amount_uzs);
end $$;

/** Karta orqali to'lov: chek yuklanadi, admin tasdiqlaydi */
create or replace function public.submit_service_receipt(p_user uuid, p_order bigint, p_path text, p_sha256 text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
begin
  if p_path not like p_user::text || '/%' then return jsonb_build_object('ok', false, 'reason', 'path'); end if;
  if exists (select 1 from service_orders where receipt_sha256 = p_sha256 and status <> 'cancelled')
     or exists (select 1 from payments where receipt_sha256 = p_sha256 and status in ('pending', 'paid')) then
    return jsonb_build_object('ok', false, 'reason', 'duplicate_receipt');
  end if;
  update service_orders set status = 'review', provider = 'manual', receipt_path = p_path, receipt_sha256 = p_sha256, receipt_note = null
  where id = p_order and client_id = p_user and status = 'awaiting_payment';
  if not found then return jsonb_build_object('ok', false, 'reason', 'status'); end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.review_service_receipt(p_admin uuid, p_order bigint, p_approve boolean, p_note text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  s service_orders%rowtype;
begin
  if not public.is_admin(p_admin) then return jsonb_build_object('ok', false, 'reason', 'forbidden'); end if;
  select * into s from service_orders where id = p_order for update;
  if not found or s.status <> 'review' then return jsonb_build_object('ok', false, 'reason', 'status'); end if;
  if p_approve then
    update service_orders set status = 'held', paid_at = now() where id = p_order;
    perform public.post_system_message(s.conversation_id, 'To''lov tasdiqlandi. Pul platformada saqlanadi va xizmat tasdiqlangach yuristga o''tadi. Kontaktlar ochildi.');
  else
    update service_orders set status = 'awaiting_payment', provider = null, receipt_sha256 = null,
      receipt_note = coalesce(nullif(btrim(p_note), ''), 'Chek tasdiqlanmadi') where id = p_order;
  end if;
  return jsonb_build_object('ok', true, 'receipt_path', s.receipt_path);
end $$;

create or replace function public.cancel_service_order(p_user uuid, p_order bigint) returns boolean
language plpgsql volatile security definer set search_path = public as $$
declare
  s service_orders%rowtype;
begin
  update service_orders set status = 'cancelled' where id = p_order and client_id = p_user and status = 'awaiting_payment'
    and not exists (select 1 from payme_orders o join payme_transactions t on t.order_code = o.code where o.service_order_id = p_order and t.state = 1)
  returning * into s;
  if not found then return false; end if;
  update payme_orders set status = 'cancelled' where service_order_id = p_order and status = 'new';
  update request_offers set status = 'declined' where id = s.offer_id;
  perform public.post_system_message(s.conversation_id, 'Mijoz buyurtmani bekor qildi.');
  return true;
end $$;

/** Yurist: xizmat bajarildi → mijozda 3 kun tasdiqlash yoki e'tiroz uchun */
create or replace function public.mark_delivered(p_lawyer uuid, p_order bigint) returns boolean
language plpgsql volatile security definer set search_path = public as $$
declare
  s service_orders%rowtype;
begin
  update service_orders set status = 'delivered', delivered_at = now(), release_after = now() + interval '3 days'
  where id = p_order and lawyer_id = p_lawyer and status = 'held' returning * into s;
  if not found then return false; end if;
  perform public.post_system_message(s.conversation_id, 'Yurist xizmatni bajarilgan deb belgiladi. 3 kun ichida tasdiqlang yoki e''tiroz bildiring — aks holda to''lov yuristga o''tadi.');
  return true;
end $$;

create or replace function public.confirm_order(p_user uuid, p_order bigint) returns boolean
language plpgsql volatile security definer set search_path = public as $$
declare
  s service_orders%rowtype;
begin
  update service_orders set status = 'released', released_at = now()
  where id = p_order and client_id = p_user and status in ('held', 'delivered') returning * into s;
  if not found then return false; end if;
  perform public.post_system_message(s.conversation_id, 'Mijoz xizmatni tasdiqladi. To''lov yuristga o''tkaziladi.');
  return true;
end $$;

create or replace function public.open_dispute(p_user uuid, p_order bigint, p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  s service_orders%rowtype;
begin
  select * into s from service_orders where id = p_order and client_id = p_user for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if s.status not in ('held', 'delivered') or (s.release_after is not null and s.release_after <= now()) then
    return jsonb_build_object('ok', false, 'reason', 'status');
  end if;
  insert into order_disputes (order_id, opened_by, reason) values (p_order, p_user, btrim(p_reason));
  update service_orders set status = 'disputed' where id = p_order;
  perform public.post_system_message(s.conversation_id, 'Mijoz e''tiroz bildirdi. To''lov admin qaror qilguncha to''xtatildi.');
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.resolve_dispute(p_admin uuid, p_order bigint, p_resolution text, p_note text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  s service_orders%rowtype;
begin
  if not public.is_admin(p_admin) then return jsonb_build_object('ok', false, 'reason', 'forbidden'); end if;
  if p_resolution not in ('release', 'refund') then return jsonb_build_object('ok', false, 'reason', 'resolution'); end if;
  select * into s from service_orders where id = p_order for update;
  if not found or s.status <> 'disputed' then return jsonb_build_object('ok', false, 'reason', 'status'); end if;
  update order_disputes set status = 'resolved', resolution = p_resolution, admin_note = nullif(btrim(coalesce(p_note, '')), ''),
    resolved_by = p_admin, resolved_at = now() where order_id = p_order;
  if p_resolution = 'release' then
    update service_orders set status = 'released', released_at = now() where id = p_order;
    perform public.post_system_message(s.conversation_id, 'Admin qarori: to''lov yuristga o''tkaziladi.');
  else
    -- Pulni qaytarish tizimdan tashqarida: Payme — kassa kabinetidan (CancelTransaction qaytadi), karta — admin qo'lda
    update service_orders set status = 'refunded', refunded_at = now() where id = p_order;
    perform public.post_system_message(s.conversation_id, 'Admin qarori: to''lov mijozga qaytariladi.');
  end if;
  return jsonb_build_object('ok', true, 'provider', s.provider, 'external_id', s.external_id);
end $$;

/** Muddati o'tgan topshirilgan buyurtmalar — avtomatik yuristga (cron va sahifa ochilganda) */
create or replace function public.release_due_orders() returns int
language plpgsql volatile security definer set search_path = public as $$
declare
  n int;
  r record;
begin
  n := 0;
  for r in update service_orders set status = 'released', released_at = now()
           where status = 'delivered' and release_after <= now() returning conversation_id loop
    n := n + 1;
    if r.conversation_id is not null then
      perform public.post_system_message(r.conversation_id, '3 kun ichida e''tiroz bo''lmadi — to''lov yuristga o''tkaziladi.');
    end if;
  end loop;
  return n;
end $$;

/** Admin: yuristga to'langanini qayd etish (bank o'tkazmasi qo'lda) */
create or replace function public.record_payout(p_admin uuid, p_lawyer uuid, p_orders bigint[], p_reference text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_sum bigint;
  v_n int;
  v_id bigint;
begin
  if not public.is_admin(p_admin) then return jsonb_build_object('ok', false, 'reason', 'forbidden'); end if;
  if coalesce(cardinality(p_orders), 0) = 0 then return jsonb_build_object('ok', false, 'reason', 'empty'); end if;
  perform 1 from service_orders where id = any (p_orders) for update;
  select count(*), coalesce(sum(payout_uzs), 0) into v_n, v_sum from service_orders
  where id = any (p_orders) and lawyer_id = p_lawyer and status = 'released' and not clawback;
  if v_n <> cardinality(p_orders) then return jsonb_build_object('ok', false, 'reason', 'orders'); end if;
  insert into lawyer_payouts (lawyer_id, amount_uzs, order_ids, card_last4, reference, paid_by)
  values (p_lawyer, v_sum, p_orders, (select right(payout_card, 4) from lawyer_profiles where user_id = p_lawyer), btrim(p_reference), p_admin)
  returning id into v_id;
  update service_orders set status = 'paid_out', payout_id = v_id where id = any (p_orders);
  return jsonb_build_object('ok', true, 'id', v_id, 'amount_uzs', v_sum);
end $$;

/** Kontaktlar: faqat shu yurist bilan to'langan buyurtmasi bor mijozga */
create or replace function public.lawyer_contacts(p_user uuid, p_lawyer uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('phone', l.phone, 'telegram', l.telegram)
  from lawyer_profiles l
  where l.user_id = p_lawyer and exists (
    select 1 from service_orders s where s.client_id = p_user and s.lawyer_id = p_lawyer
      and s.status in ('held', 'delivered', 'disputed', 'released', 'paid_out'))
$$;

create or replace function public.leave_review(p_user uuid, p_order bigint, p_rating int, p_body text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  s service_orders%rowtype;
begin
  select * into s from service_orders where id = p_order and client_id = p_user;
  if not found or s.status not in ('released', 'paid_out') then return jsonb_build_object('ok', false, 'reason', 'status'); end if;
  if p_rating not between 1 and 5 then return jsonb_build_object('ok', false, 'reason', 'rating'); end if;
  insert into lawyer_reviews (order_id, client_id, lawyer_id, rating, body) values (p_order, p_user, s.lawyer_id, p_rating, nullif(btrim(coalesce(p_body, '')), ''))
  on conflict (order_id) do nothing;
  if not found then return jsonb_build_object('ok', false, 'reason', 'already'); end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.hide_review(p_admin uuid, p_order bigint, p_hidden boolean) returns boolean
language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_admin(p_admin) then return false; end if;
  update lawyer_reviews set hidden = p_hidden where order_id = p_order;
  return found;
end $$;

create or replace function public.lawyer_reviews_public(p_lawyer uuid, p_limit int) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('rating', r.rating, 'body', r.body, 'created_at', r.created_at,
    'client', split_part(p.full_name, ' ', 1)) order by r.created_at desc), '[]')
  from (select * from lawyer_reviews where lawyer_id = p_lawyer and not hidden order by created_at desc limit least(greatest(p_limit, 1), 50)) r
  join profiles p on p.id = r.client_id
$$;

create or replace function public.order_json(s service_orders, p_user uuid) returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object(
    'id', s.id, 'role', case when s.client_id = p_user then 'client' else 'lawyer' end, 'title', s.title,
    'amount_uzs', s.amount_uzs, 'commission_pct', s.commission_pct, 'payout_uzs', s.payout_uzs, 'status', s.status,
    'provider', s.provider, 'receipt_note', s.receipt_note, 'conversation_id', s.conversation_id,
    'lawyer_id', s.lawyer_id, 'lawyer_name', (select display_name from lawyer_profiles where user_id = s.lawyer_id),
    'client_name', (select split_part(full_name, ' ', 1) from profiles where id = s.client_id),
    'paid_at', s.paid_at, 'delivered_at', s.delivered_at, 'release_after', s.release_after, 'released_at', s.released_at,
    'created_at', s.created_at,
    'dispute', (select jsonb_build_object('reason', d.reason, 'status', d.status, 'resolution', d.resolution, 'admin_note', d.admin_note)
                from order_disputes d where d.order_id = s.id),
    'reviewed', exists (select 1 from lawyer_reviews r where r.order_id = s.id))
$$;

create or replace function public.order_detail(p_user uuid, p_order bigint) returns jsonb
language sql stable security definer set search_path = public as $$
  select public.order_json(s, p_user) from service_orders s where s.id = p_order and p_user in (s.client_id, s.lawyer_id)
$$;

create or replace function public.my_orders(p_user uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(public.order_json(s, p_user) order by s.id desc), '[]')
  from service_orders s where p_user in (s.client_id, s.lawyer_id)
$$;

/** Admin: chek tekshiruvi, nizolar, clawback, to'lanishi kerak bo'lgan yuristlar (karta to'liq — faqat admin) */
create or replace function public.escrow_admin(p_admin uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when not public.is_admin(p_admin) then null else jsonb_build_object(
    'review', coalesce((select jsonb_agg(public.order_json(s, p_admin) || jsonb_build_object('receipt_path', s.receipt_path) order by s.id)
      from service_orders s where s.status = 'review'), '[]'),
    'disputed', coalesce((select jsonb_agg(public.order_json(s, p_admin) order by s.id) from service_orders s where s.status = 'disputed'), '[]'),
    'clawback', coalesce((select jsonb_agg(public.order_json(s, p_admin) order by s.id) from service_orders s where s.clawback and s.status <> 'refunded'), '[]'),
    'payouts', coalesce((select jsonb_agg(x order by x->>'lawyer_name') from (
      select jsonb_build_object('lawyer_id', l.user_id, 'lawyer_name', l.display_name, 'card', l.payout_card, 'holder', l.payout_holder,
        'total_uzs', sum(s.payout_uzs), 'order_ids', jsonb_agg(s.id order by s.id)) x
      from service_orders s join lawyer_profiles l on l.user_id = s.lawyer_id
      where s.status = 'released' and not s.clawback group by l.user_id) q), '[]'),
    'held_total', (select coalesce(sum(amount_uzs), 0) from service_orders where status in ('held', 'delivered', 'disputed', 'released')),
    'commission_total', (select coalesce(sum(commission_uzs), 0) from service_orders where status in ('released', 'paid_out'))
  ) end
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'new_payme_code()', 'lawyer_commission_pct()', 'conversation_paid(uuid)', 'create_service_order(uuid, bigint)',
    'create_service_payme_order(uuid, bigint)', 'submit_service_receipt(uuid, bigint, text, text)',
    'review_service_receipt(uuid, bigint, boolean, text)', 'cancel_service_order(uuid, bigint)', 'mark_delivered(uuid, bigint)',
    'confirm_order(uuid, bigint)', 'open_dispute(uuid, bigint, text)', 'resolve_dispute(uuid, bigint, text, text)',
    'release_due_orders()', 'record_payout(uuid, uuid, bigint[], text)', 'lawyer_contacts(uuid, uuid)',
    'leave_review(uuid, bigint, int, text)', 'hide_review(uuid, bigint, boolean)', 'lawyer_reviews_public(uuid, int)',
    'order_json(service_orders, uuid)', 'order_detail(uuid, bigint)', 'my_orders(uuid)', 'escrow_admin(uuid)',
    'lawyer_reviews_rating()'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

-- Premium buyurtmasi ham umumiy kod generatoridan foydalanadi (xatti-harakat o'zgarmaydi)
create or replace function public.create_payme_order(p_user uuid, p_plan text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  pl plans%rowtype;
  c text;
begin
  select * into pl from plans where code = p_plan and is_active;
  if not found then return jsonb_build_object('ok', false, 'reason', 'plan'); end if;

  -- Yaqinda yaratilgan, hali to'lanmagan va faol tranzaksiyasi yo'q buyurtma bo'lsa — o'shani qaytaramiz
  select o.code into c from payme_orders o
  where o.user_id = p_user and o.kind = 'premium' and o.plan_code = pl.code and o.status = 'new' and o.amount_uzs = pl.price_uzs
    and o.created_at > now() - interval '12 hours'
    and not exists (select 1 from payme_transactions t where t.order_code = o.code)
  order by o.created_at desc limit 1;

  if c is null then
    c := public.new_payme_code();
    insert into payme_orders (code, user_id, plan_code, months, amount_uzs) values (c, p_user, pl.code, pl.months, pl.price_uzs);
  end if;
  return jsonb_build_object('ok', true, 'code', c, 'amount_uzs', pl.price_uzs);
end $$;

-- Payme JSON-RPC: Premium tarmog'i o'zgarishsiz; yurist xizmati (kind = 'service') — escrow
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
  so service_orders%rowtype;

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
    if o.kind = 'service' and not exists (select 1 from service_orders s where s.id = o.service_order_id and s.status = 'awaiting_payment') then
      return jsonb_build_object('error', jsonb_build_object('code', -31051, 'message', 'Order is not payable', 'data', 'order_id'));
    end if;
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
    if o.kind = 'service' and not exists (select 1 from service_orders s where s.id = o.service_order_id and s.status = 'awaiting_payment') then
      return jsonb_build_object('error', jsonb_build_object('code', -31051, 'message', 'Order is not payable', 'data', 'order_id'));
    end if;
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
    if o.kind = 'service' then
      -- Yurist xizmati: pul platformada ushlab turiladi (escrow), obuna yaratilmaydi
      update service_orders set status = 'held', provider = 'payme', external_id = t.id, paid_at = now()
      where id = o.service_order_id
      returning * into so;
      update payme_orders set status = 'paid' where payme_orders.code = o.code;
      update payme_transactions set state = 2, perform_time = ts where id = t.id;
      if so.conversation_id is not null then
        perform public.post_system_message(so.conversation_id, 'To''lov qabul qilindi. Pul platformada saqlanadi va xizmat tasdiqlangach yuristga o''tadi. Kontaktlar ochildi.');
      end if;
      return jsonb_build_object('result', jsonb_build_object('transaction', t.id, 'perform_time', ts, 'state', 2));
    end if;
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
    if o.kind = 'service' then
      -- Pul mijozga qaytarildi: yuristga hali o'tmagan bo'lsa — buyurtma bekor; o'tgan bo'lsa — admin uchun "clawback" belgisi
      update service_orders set
        status = case when status in ('held', 'delivered', 'disputed') then 'refunded' else status end,
        clawback = status in ('released', 'paid_out'),
        refunded_at = now()
      where id = o.service_order_id;
      return jsonb_build_object('result', jsonb_build_object('transaction', t.id, 'cancel_time', ts, 'state', -2));
    end if;
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

revoke all on function public.create_payme_order(uuid, text), public.payme_rpc(text, jsonb) from public, anon, authenticated;
grant execute on function public.create_payme_order(uuid, text), public.payme_rpc(text, jsonb) to service_role;
