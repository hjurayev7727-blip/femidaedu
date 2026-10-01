-- Yurist bilan bog'lanish: arizalar (forma yoki AI javobidan), mos yuristlarga yo'naltirish, sayt ichidagi yozishma, narx taklifi.
-- Yozishma polling orqali (chat_poll). To'lovgacha kontaktlar server tomonida yashiriladi (maskContacts), shuning uchun
-- xabarlar faqat server orqali yoziladi. Barcha funksiyalar faqat service_role uchun.

create table public.legal_requests (
  id               bigserial primary key,
  client_id        uuid not null references public.profiles (id) on delete cascade,
  field            text check (field ~ '^[a-z-]{2,40}$'),
  region           text check (char_length(region) <= 60),
  title            text not null check (char_length(title) between 5 and 120),
  body             text not null check (char_length(body) between 20 and 4000),
  source           text not null default 'form' check (source in ('form', 'ai')),
  tutor_message_id bigint references public.tutor_messages (id) on delete set null,
  ai_snapshot      text check (char_length(ai_snapshot) <= 12000),
  target_lawyer    uuid references public.lawyer_profiles (user_id) on delete set null,
  status           text not null default 'open' check (status in ('open', 'closed', 'cancelled')),
  created_at       timestamptz not null default now()
);
create index legal_requests_client_idx on public.legal_requests (client_id, created_at desc);

create table public.request_recipients (
  request_id bigint not null references public.legal_requests (id) on delete cascade,
  lawyer_id  uuid not null references public.lawyer_profiles (user_id) on delete cascade,
  seen_at    timestamptz,
  created_at timestamptz not null default now(),
  primary key (request_id, lawyer_id)
);
create index request_recipients_lawyer_idx on public.request_recipients (lawyer_id, created_at desc);

create table public.conversations (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid not null references public.profiles (id) on delete cascade,
  lawyer_id          uuid not null references public.lawyer_profiles (user_id) on delete cascade,
  request_id         bigint references public.legal_requests (id) on delete set null,
  client_read        bigint not null default 0,
  lawyer_read        bigint not null default 0,
  client_notified_at timestamptz,
  lawyer_notified_at timestamptz,
  last_message_at    timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  check (client_id <> lawyer_id)
);
create unique index conversations_unique on public.conversations (client_id, lawyer_id, request_id) nulls not distinct;
create index conversations_client_idx on public.conversations (client_id, last_message_at desc);
create index conversations_lawyer_idx on public.conversations (lawyer_id, last_message_at desc);

create table public.request_offers (
  id              bigserial primary key,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  lawyer_id       uuid not null references public.lawyer_profiles (user_id) on delete cascade,
  client_id       uuid not null references public.profiles (id) on delete cascade,
  price_uzs       int not null check (price_uzs between 10000 and 100000000),
  note            text not null check (char_length(note) between 5 and 1000),
  status          text not null default 'pending' check (status in ('pending', 'accepted', 'withdrawn', 'declined')),
  created_at      timestamptz not null default now()
);
create unique index request_offers_one_pending on public.request_offers (conversation_id) where status = 'pending';

create table public.messages (
  id              bigserial primary key,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id       uuid references public.profiles (id) on delete set null,   -- null: tizim xabari
  kind            text not null default 'text' check (kind in ('text', 'system', 'offer')),
  body            text not null check (char_length(body) between 1 and 4000),
  offer_id        bigint references public.request_offers (id) on delete set null,
  created_at      timestamptz not null default now()
);
create index messages_conv_idx on public.messages (conversation_id, id);

alter table public.legal_requests     enable row level security;
alter table public.request_recipients enable row level security;
alter table public.conversations      enable row level security;
alter table public.request_offers     enable row level security;
alter table public.messages           enable row level security;
revoke all on public.legal_requests, public.request_recipients, public.conversations, public.request_offers, public.messages from anon, authenticated;
grant all on public.legal_requests, public.request_recipients, public.conversations, public.request_offers, public.messages to service_role;
grant usage, select on all sequences in schema public to service_role;

-- ─────────────────────────── Funksiyalar (faqat server) ───────────────────────────

/** Suhbat bo'yicha to'lov qilinganmi (kontaktlar ochiladi). Escrow bosqichida haqiqiy tekshiruv bilan almashtiriladi. */
create or replace function public.conversation_paid(p_conv uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select false
$$;

create or replace function public.post_system_message(p_conv uuid, p_body text) returns void
language sql volatile security definer set search_path = public as $$
  insert into messages (conversation_id, kind, body) values (p_conv, 'system', p_body);
  update conversations set last_message_at = now() where id = p_conv;
$$;

/**
 * Ariza: tanlangan yuristga yoki sohasi mos 10 ta faol yuristga (tasdiqlangan va shu hududdagilar oldin).
 * Mos yurist bo'lmasa — admin qo'lda yo'naltiradi. Bir vaqtda 3 ta ochiq, kuniga 5 ta ariza.
 */
create or replace function public.create_legal_request(p_user uuid, p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_id bigint;
  v_target uuid := nullif(p->>'target_lawyer', '')::uuid;
  v_field text := nullif(p->>'field', '');
  v_tm bigint := nullif(p->>'tutor_message_id', '')::bigint;
  v_n int;
begin
  if (select count(*) from legal_requests where client_id = p_user and status = 'open') >= 3 then
    return jsonb_build_object('ok', false, 'reason', 'open_limit');
  end if;
  if (select count(*) from legal_requests where client_id = p_user and created_at > now() - interval '1 day') >= 5 then
    return jsonb_build_object('ok', false, 'reason', 'day_limit');
  end if;
  if v_field is not null and not exists (select 1 from fields where slug = v_field) then
    return jsonb_build_object('ok', false, 'reason', 'field');
  end if;
  if v_target is not null and (v_target = p_user or not exists (select 1 from lawyer_profiles where user_id = v_target and status = 'active')) then
    return jsonb_build_object('ok', false, 'reason', 'lawyer');
  end if;
  -- AI xabari faqat foydalanuvchining o'z suhbatidan
  if v_tm is not null and not exists (
    select 1 from tutor_messages m join tutor_threads t on t.id = m.thread_id where m.id = v_tm and t.user_id = p_user and m.role = 'assistant'
  ) then
    v_tm := null;
  end if;

  insert into legal_requests (client_id, field, region, title, body, source, tutor_message_id, ai_snapshot, target_lawyer)
  values (p_user, v_field, nullif(p->>'region', ''), btrim(p->>'title'), btrim(p->>'body'),
          case when v_tm is not null then 'ai' else 'form' end, v_tm,
          case when v_tm is not null then (select left(content, 12000) from tutor_messages where id = v_tm) end, v_target)
  returning id into v_id;

  if v_target is not null then
    insert into request_recipients (request_id, lawyer_id) values (v_id, v_target);
  else
    insert into request_recipients (request_id, lawyer_id)
    select v_id, l.user_id from lawyer_profiles l
    where l.status = 'active' and l.user_id <> p_user and (v_field is null or v_field = any (l.fields))
    order by (l.verified_at is not null) desc, (l.region is not distinct from nullif(p->>'region', '')) desc,
             (l.rating_sum + 12)::numeric / (l.rating_count + 3) desc, random()
    limit 10;
  end if;
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'id', v_id, 'recipients', v_n);
end $$;

create or replace function public.my_requests(p_user uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id, 'title', r.title, 'field', r.field, 'status', r.status, 'created_at', r.created_at,
    'recipients', (select count(*) from request_recipients x where x.request_id = r.id),
    'replies', (select count(*) from conversations c where c.request_id = r.id)) order by r.id desc), '[]')
  from legal_requests r where r.client_id = p_user
$$;

/** Yuristga kelgan arizalar (ochiq) */
create or replace function public.request_inbox(p_lawyer uuid) returns jsonb
language sql volatile security definer set search_path = public as $$
  with mark as (
    update request_recipients set seen_at = now() where lawyer_id = p_lawyer and seen_at is null returning request_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id, 'title', r.title, 'body', r.body, 'field', r.field, 'region', r.region, 'source', r.source,
    'ai_snapshot', r.ai_snapshot, 'created_at', r.created_at, 'direct', r.target_lawyer is not distinct from p_lawyer,
    'new', x.seen_at is null or x.request_id in (select request_id from mark),
    'conversation_id', (select c.id from conversations c where c.request_id = r.id and c.lawyer_id = p_lawyer)) order by r.id desc), '[]')
  from request_recipients x join legal_requests r on r.id = x.request_id
  where x.lawyer_id = p_lawyer and r.status = 'open'
$$;

/**
 * Suhbat ochish: mijoz yuristga to'g'ridan-to'g'ri (p_request null yoki o'z arizasi) yoki
 * yurist o'ziga yuborilgan arizaga javob berib. Mavjud bo'lsa — o'shani qaytaradi.
 */
create or replace function public.open_conversation(p_user uuid, p_other uuid, p_request bigint) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  r legal_requests%rowtype;
  v_client uuid;
  v_lawyer uuid;
  v_id uuid;
begin
  if p_request is not null then
    select * into r from legal_requests where id = p_request;
    if not found or r.status <> 'open' then return jsonb_build_object('ok', false, 'reason', 'request'); end if;
    if r.client_id = p_user then
      v_client := p_user; v_lawyer := p_other;
    elsif exists (select 1 from request_recipients where request_id = p_request and lawyer_id = p_user) then
      v_client := r.client_id; v_lawyer := p_user;
    else
      return jsonb_build_object('ok', false, 'reason', 'request');
    end if;
  else
    v_client := p_user; v_lawyer := p_other;
  end if;
  if v_client = v_lawyer or not exists (select 1 from lawyer_profiles where user_id = v_lawyer and status = 'active') then
    return jsonb_build_object('ok', false, 'reason', 'lawyer');
  end if;

  select id into v_id from conversations where client_id = v_client and lawyer_id = v_lawyer and request_id is not distinct from p_request;
  if v_id is null then
    insert into conversations (client_id, lawyer_id, request_id) values (v_client, v_lawyer, p_request) returning id into v_id;
    perform public.post_system_message(v_id, case when p_request is not null
      then 'Suhbat «' || r.title || '» arizasi bo''yicha boshlandi.'
      else 'Suhbat boshlandi. Telefon va Telegram xizmat uchun to''lovdan keyin ochiladi.' end);
  end if;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

/**
 * Xabar yuborish: faqat ishtirokchi, bloklangan yurist yozolmaydi, daqiqasiga 20 ta.
 * Qaytaradi: kimga bildirishnoma yuborish kerak (har suhbatda 10 daqiqada ko'pi bilan 1 ta).
 */
create or replace function public.send_message(p_user uuid, p_conv uuid, p_body text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  c conversations%rowtype;
  v_id bigint;
  v_notify uuid;
begin
  select * into c from conversations where id = p_conv for update;
  if not found or p_user not in (c.client_id, c.lawyer_id) then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if exists (select 1 from lawyer_profiles where user_id = c.lawyer_id and status = 'blocked') then
    return jsonb_build_object('ok', false, 'reason', 'blocked');
  end if;
  if (select count(*) from messages where conversation_id = p_conv and sender_id = p_user and created_at > now() - interval '1 minute') >= 20 then
    return jsonb_build_object('ok', false, 'reason', 'rate');
  end if;
  insert into messages (conversation_id, sender_id, body) values (p_conv, p_user, btrim(p_body)) returning id into v_id;
  if p_user = c.client_id then
    update conversations set last_message_at = now(), client_read = v_id,
      lawyer_notified_at = case when lawyer_notified_at is null or lawyer_notified_at < now() - interval '10 minutes' then now() else lawyer_notified_at end
    where id = p_conv
    returning case when lawyer_notified_at = now() then c.lawyer_id end into v_notify;
  else
    update conversations set last_message_at = now(), lawyer_read = v_id,
      client_notified_at = case when client_notified_at is null or client_notified_at < now() - interval '10 minutes' then now() else client_notified_at end
    where id = p_conv
    returning case when client_notified_at = now() then c.client_id end into v_notify;
  end if;
  return jsonb_build_object('ok', true, 'id', v_id, 'notify', v_notify);
end $$;

/** Yurist narx taklifi: oldingi kutilayotgan taklif bekor qilinadi */
create or replace function public.make_offer(p_lawyer uuid, p_conv uuid, p_price int, p_note text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  c conversations%rowtype;
  v_offer bigint;
begin
  select * into c from conversations where id = p_conv for update;
  if not found or c.lawyer_id <> p_lawyer then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if exists (select 1 from lawyer_profiles where user_id = p_lawyer and status <> 'active') then
    return jsonb_build_object('ok', false, 'reason', 'blocked');
  end if;
  update request_offers set status = 'withdrawn' where conversation_id = p_conv and status = 'pending';
  insert into request_offers (conversation_id, lawyer_id, client_id, price_uzs, note) values (p_conv, p_lawyer, c.client_id, p_price, btrim(p_note))
  returning id into v_offer;
  insert into messages (conversation_id, sender_id, kind, body, offer_id) values (p_conv, p_lawyer, 'offer', btrim(p_note), v_offer);
  update conversations set last_message_at = now() where id = p_conv;
  return jsonb_build_object('ok', true, 'id', v_offer, 'client', c.client_id);
end $$;

create or replace function public.decline_offer(p_user uuid, p_offer bigint) returns boolean
language plpgsql volatile security definer set search_path = public as $$
declare
  o request_offers%rowtype;
begin
  update request_offers set status = 'declined' where id = p_offer and client_id = p_user and status = 'pending' returning * into o;
  if not found then return false; end if;
  perform public.post_system_message(o.conversation_id, 'Mijoz taklifni rad etdi.');
  return true;
end $$;

/** Yozishma holati: p_after dan keyingi xabarlar, takliflar, o'qilganlik; o'qish kursori yangilanadi */
create or replace function public.chat_poll(p_user uuid, p_conv uuid, p_after bigint) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  c conversations%rowtype;
  v_last bigint;
  is_client boolean;
begin
  select * into c from conversations where id = p_conv;
  if not found or p_user not in (c.client_id, c.lawyer_id) then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  is_client := p_user = c.client_id;
  select max(id) into v_last from messages where conversation_id = p_conv;
  if v_last is not null then
    if is_client then update conversations set client_read = greatest(client_read, v_last) where id = p_conv;
    else update conversations set lawyer_read = greatest(lawyer_read, v_last) where id = p_conv; end if;
  end if;
  return jsonb_build_object(
    'ok', true,
    'role', case when is_client then 'client' else 'lawyer' end,
    'other_read', case when is_client then c.lawyer_read else c.client_read end,
    'paid', public.conversation_paid(p_conv),
    'messages', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'mine', m.sender_id = p_user, 'kind', m.kind, 'body', m.body,
        'offer_id', m.offer_id, 'created_at', m.created_at) order by m.id)
      from (select * from messages where conversation_id = p_conv and id > coalesce(p_after, 0) order by id limit 200) m), '[]'),
    'offers', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'price_uzs', o.price_uzs, 'note', o.note, 'status', o.status) order by o.id)
      from request_offers o where o.conversation_id = p_conv), '[]'));
end $$;

/** Suhbat sarlavhasi uchun: ikkinchi tomon, ariza */
create or replace function public.conversation_info(p_user uuid, p_conv uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', c.id, 'role', case when c.client_id = p_user then 'client' else 'lawyer' end,
    'lawyer_id', c.lawyer_id, 'lawyer_name', l.display_name, 'lawyer_verified', l.verified_at is not null, 'lawyer_status', l.status,
    'client_name', split_part(p.full_name, ' ', 1),
    'request', case when r.id is not null then jsonb_build_object('id', r.id, 'title', r.title, 'body', r.body, 'ai_snapshot', r.ai_snapshot) end)
  from conversations c
  join lawyer_profiles l on l.user_id = c.lawyer_id
  join profiles p on p.id = c.client_id
  left join legal_requests r on r.id = c.request_id
  where c.id = p_conv and p_user in (c.client_id, c.lawyer_id)
$$;

create or replace function public.my_conversations(p_user uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x->>'last_message_at' desc), '[]') from (
    select jsonb_build_object(
      'id', c.id, 'role', case when c.client_id = p_user then 'client' else 'lawyer' end,
      'other', case when c.client_id = p_user then l.display_name else split_part(p.full_name, ' ', 1) end,
      'request_title', r.title, 'last_message_at', c.last_message_at,
      'last', (select left(m.body, 120) from messages m where m.conversation_id = c.id order by m.id desc limit 1),
      'unread', (select count(*) from messages m where m.conversation_id = c.id and m.sender_id is not null and m.sender_id <> p_user
                 and m.id > case when c.client_id = p_user then c.client_read else c.lawyer_read end)) x
    from conversations c
    join lawyer_profiles l on l.user_id = c.lawyer_id
    join profiles p on p.id = c.client_id
    left join legal_requests r on r.id = c.request_id
    where p_user in (c.client_id, c.lawyer_id)
    order by c.last_message_at desc limit 100
  ) s
$$;

create or replace function public.close_request(p_user uuid, p_request bigint) returns boolean
language plpgsql volatile security definer set search_path = public as $$
begin
  update legal_requests set status = 'closed' where id = p_request and client_id = p_user and status = 'open';
  return found;
end $$;

/** Admin: yuristga yo'naltirilmagan ochiq arizalar va qo'lda yo'naltirish */
create or replace function public.unrouted_requests(p_admin uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when not public.is_admin(p_admin) then null else coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id, 'title', r.title, 'body', r.body, 'field', r.field, 'region', r.region, 'created_at', r.created_at) order by r.id), '[]') end
  from legal_requests r
  where r.status = 'open' and not exists (select 1 from request_recipients x where x.request_id = r.id)
$$;

create or replace function public.assign_request(p_admin uuid, p_request bigint, p_lawyer uuid) returns boolean
language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_admin(p_admin) or not exists (select 1 from lawyer_profiles where user_id = p_lawyer and status = 'active') then return false; end if;
  if not exists (select 1 from legal_requests where id = p_request and status = 'open' and client_id <> p_lawyer) then return false; end if;
  insert into request_recipients (request_id, lawyer_id) values (p_request, p_lawyer) on conflict do nothing;
  return true;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'conversation_paid(uuid)', 'post_system_message(uuid, text)', 'create_legal_request(uuid, jsonb)', 'my_requests(uuid)',
    'request_inbox(uuid)', 'open_conversation(uuid, uuid, bigint)', 'send_message(uuid, uuid, text)',
    'make_offer(uuid, uuid, int, text)', 'decline_offer(uuid, bigint)', 'chat_poll(uuid, uuid, bigint)',
    'conversation_info(uuid, uuid)', 'my_conversations(uuid)', 'close_request(uuid, bigint)',
    'unrouted_requests(uuid)', 'assign_request(uuid, bigint, uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
