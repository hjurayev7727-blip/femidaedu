-- Jonli viktorina (V3, 6-qism): muallif o'z testidan xona ochadi → 6 raqamli PIN + QR → o'quvchilar (kirgan yoki mehmon)
-- qo'shiladi → har savol vaqt bilan → javobdan keyin top-5 → yakuniy natija (guruhga bog'lanishi mumkin).
-- Bepul: 30 ishtirokchigacha. Holat so'rovlari (polling) server orqali; javob kaliti faqat "reveal" bosqichida beriladi.

create table public.live_rooms (
  id                uuid primary key default gen_random_uuid(),
  test_id           bigint not null references public.tests (id) on delete cascade,
  host_id           uuid not null references public.profiles (id) on delete cascade,
  group_id          bigint references public.groups (id) on delete set null,
  pin               char(6) not null,
  status            text not null default 'lobby' check (status in ('lobby', 'question', 'reveal', 'finished')),
  item_ids          bigint[] not null,
  current_pos       int not null default -1,                  -- 0 dan; lobby'da -1
  seconds           int not null default 20 check (seconds between 5 and 120),
  max_players       int not null default 30 check (max_players between 2 and 500),
  question_started_at timestamptz,
  question_ends_at  timestamptz,
  created_at        timestamptz not null default now(),
  finished_at       timestamptz
);
-- PIN faqat faol xonalar orasida takrorlanmas
create unique index live_rooms_pin_active_idx on public.live_rooms (pin) where status <> 'finished';
create index live_rooms_host_idx on public.live_rooms (host_id, created_at desc);

create table public.live_players (
  id               uuid primary key default gen_random_uuid(),
  room_id          uuid not null references public.live_rooms (id) on delete cascade,
  user_id          uuid references public.profiles (id) on delete cascade,
  guest_token_hash text,
  name             text not null check (char_length(name) between 2 and 40),
  score            int not null default 0,
  correct          int not null default 0,
  joined_at        timestamptz not null default now(),
  check ((user_id is null) <> (guest_token_hash is null)),
  unique (room_id, user_id),
  unique (room_id, guest_token_hash)
);
create index live_players_room_idx on public.live_players (room_id, score desc);

create table public.live_answers (
  player_id    uuid not null references public.live_players (id) on delete cascade,
  room_id      uuid not null references public.live_rooms (id) on delete cascade,
  item_id      bigint not null references public.test_items (id) on delete cascade,
  response     jsonb not null,
  is_correct   boolean not null,
  points       int not null default 0,
  answered_at  timestamptz not null default now(),
  primary key (player_id, item_id)
);
create index live_answers_room_item_idx on public.live_answers (room_id, item_id);

alter table public.live_rooms   enable row level security;
alter table public.live_players enable row level security;
alter table public.live_answers enable row level security;
create policy live_rooms_host on public.live_rooms for select to authenticated using (host_id = auth.uid());
grant select on public.live_rooms to authenticated;
grant all on public.live_rooms, public.live_players, public.live_answers to service_role;

-- Savol vaqti tugaganmi (host "ko'rsatish"ni bosmasa ham): samarali holat
create or replace function public.live_effective_status(r live_rooms) returns text
language sql stable as $$
  select case when r.status = 'question' and now() > r.question_ends_at then 'reveal' else r.status end
$$;

/** Xona ochish: faqat test egasi, testda savol bo'lsa. Qaytaradi: { ok, room_id, pin } */
create or replace function public.create_live_room(p_host uuid, p_test bigint, p_seconds int, p_max int, p_group bigint) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_ids bigint[];
  v_pin text;
  v_id uuid;
begin
  if not exists (select 1 from tests where id = p_test and owner_id = p_host and status <> 'removed') then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if p_group is not null and not exists (select 1 from groups where id = p_group and teacher_id = p_host) then
    return jsonb_build_object('ok', false, 'reason', 'group');
  end if;
  select coalesce(array_agg(id order by pos, id), '{}') into v_ids from test_items where test_id = p_test and status = 'active';
  if cardinality(v_ids) = 0 then return jsonb_build_object('ok', false, 'reason', 'no_items'); end if;
  -- Eski ochiq xonalar yopiladi (bir host — bitta faol xona)
  update live_rooms set status = 'finished', finished_at = now() where host_id = p_host and status <> 'finished';
  loop
    v_pin := lpad(floor(random() * 1000000)::int::text, 6, '0');
    exit when not exists (select 1 from live_rooms where pin = v_pin and status <> 'finished');
  end loop;
  insert into live_rooms (test_id, host_id, group_id, pin, item_ids, seconds, max_players)
  values (p_test, p_host, p_group, v_pin, v_ids, least(greatest(coalesce(p_seconds, 20), 5), 120), least(greatest(coalesce(p_max, 30), 2), 500))
  returning id into v_id;
  return jsonb_build_object('ok', true, 'room_id', v_id, 'pin', v_pin);
end $$;

/** Qo'shilish (PIN). Qayta kirsa — o'sha ishtirokchi. Qaytaradi: { ok, room_id, player_id } */
create or replace function public.join_live_room(p_pin text, p_user uuid, p_guest text, p_name text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  r live_rooms%rowtype;
  v_player uuid;
  v_name text := left(regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g'), 40);
begin
  select * into r from live_rooms where pin = p_pin and status <> 'finished' for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if p_user is null and coalesce(p_guest, '') = '' then return jsonb_build_object('ok', false, 'reason', 'name'); end if;
  select id into v_player from live_players
   where room_id = r.id and ((p_user is not null and user_id = p_user) or (p_user is null and guest_token_hash = p_guest));
  if v_player is not null then return jsonb_build_object('ok', true, 'room_id', r.id, 'player_id', v_player); end if;
  if char_length(v_name) < 2 then return jsonb_build_object('ok', false, 'reason', 'name'); end if;
  if (select count(*) from live_players where room_id = r.id) >= r.max_players then
    return jsonb_build_object('ok', false, 'reason', 'full');
  end if;
  insert into live_players (room_id, user_id, guest_token_hash, name)
  values (r.id, p_user, case when p_user is null then p_guest end, v_name)
  returning id into v_player;
  return jsonb_build_object('ok', true, 'room_id', r.id, 'player_id', v_player);
end $$;

/** Host: keyingi savol (lobby → 1-savol; oxirgisidan keyin — yakun) */
create or replace function public.live_next(p_host uuid, p_room uuid) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  r live_rooms%rowtype;
begin
  select * into r from live_rooms where id = p_room and host_id = p_host for update;
  if not found or r.status = 'finished' then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if r.current_pos + 1 >= cardinality(r.item_ids) then
    update live_rooms set status = 'finished', finished_at = now() where id = p_room;
    return jsonb_build_object('ok', true, 'status', 'finished');
  end if;
  update live_rooms set status = 'question', current_pos = current_pos + 1,
    question_started_at = now(), question_ends_at = now() + make_interval(secs => seconds)
  where id = p_room;
  return jsonb_build_object('ok', true, 'status', 'question', 'pos', r.current_pos + 1);
end $$;

/** Host: savolni muddatidan oldin yopish (javoblarni ko'rsatish) yoki viktorinani yakunlash */
create or replace function public.live_control(p_host uuid, p_room uuid, p_action text) returns boolean
language plpgsql volatile security definer set search_path = public as $$
begin
  if p_action = 'reveal' then
    update live_rooms set status = 'reveal', question_ends_at = least(question_ends_at, now())
    where id = p_room and host_id = p_host and status = 'question';
  elsif p_action = 'finish' then
    update live_rooms set status = 'finished', finished_at = now() where id = p_room and host_id = p_host and status <> 'finished';
  else
    return false;
  end if;
  return found;
end $$;

/**
 * Javob (server kalit bo'yicha p_correct ni hisoblaydi). Faqat joriy savol, vaqt ichida (1 s tarmoq zaxirasi), bir marta.
 * Ball: to'g'ri — 500 + 500 × (qolgan vaqt ulushi); xato — 0.
 */
create or replace function public.live_answer(p_room uuid, p_user uuid, p_guest text, p_item bigint, p_response jsonb, p_correct boolean) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  r live_rooms%rowtype;
  v_player uuid;
  v_points int := 0;
begin
  select * into r from live_rooms where id = p_room;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  select id into v_player from live_players
   where room_id = p_room and ((p_user is not null and user_id = p_user) or (p_user is null and user_id is null and guest_token_hash = p_guest));
  if v_player is null then return jsonb_build_object('ok', false, 'reason', 'not_joined'); end if;
  if r.status <> 'question' or r.current_pos < 0 or r.item_ids[r.current_pos + 1] <> p_item
     or now() > r.question_ends_at + interval '1 second' then
    return jsonb_build_object('ok', false, 'reason', 'closed');
  end if;
  if p_correct then
    v_points := 500 + round(500 * greatest(0, extract(epoch from (r.question_ends_at - now()))) / r.seconds)::int;
  end if;
  insert into live_answers (player_id, room_id, item_id, response, is_correct, points)
  values (v_player, p_room, p_item, p_response, p_correct, v_points)
  on conflict do nothing;
  if not found then return jsonb_build_object('ok', false, 'reason', 'duplicate'); end if;
  update live_players set score = score + v_points, correct = correct + p_correct::int where id = v_player;
  return jsonb_build_object('ok', true);
end $$;

/**
 * Holat (polling). p_host — host ekrani uchun; aks holda ishtirokchi (p_user yoki p_guest).
 * Javob kaliti faqat reveal/finished bosqichida qaytariladi.
 */
create or replace function public.live_state(p_room uuid, p_user uuid, p_guest text, p_host boolean) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  r live_rooms%rowtype;
  v_status text;
  v_item test_items%rowtype;
  v_player live_players%rowtype;
  v_title text;
begin
  select * into r from live_rooms where id = p_room;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if p_host and r.host_id is distinct from p_user then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if not p_host then
    select * into v_player from live_players
     where room_id = p_room and ((p_user is not null and user_id = p_user) or (p_user is null and user_id is null and guest_token_hash = p_guest));
    if not found then return jsonb_build_object('ok', false, 'reason', 'not_joined'); end if;
  end if;
  v_status := public.live_effective_status(r);
  select title into v_title from tests where id = r.test_id;
  if r.current_pos >= 0 then select * into v_item from test_items where id = r.item_ids[r.current_pos + 1]; end if;

  return jsonb_build_object(
    'ok', true, 'status', v_status, 'title', v_title, 'pin', r.pin, 'pos', r.current_pos, 'total', cardinality(r.item_ids),
    'seconds', r.seconds, 'ends_at', r.question_ends_at, 'now', now(), 'max_players', r.max_players,
    'players', (select count(*) from live_players where room_id = p_room),
    'answered', case when r.current_pos >= 0 then (select count(*) from live_answers where room_id = p_room and item_id = v_item.id) else 0 end,
    'item', case when r.current_pos >= 0 and v_status <> 'finished' then jsonb_build_object(
      'id', v_item.id, 'type', v_item.type, 'stem', v_item.stem, 'context', v_item.context, 'payload', v_item.payload, 'difficulty', v_item.difficulty) end,
    'answer', case when v_status in ('reveal') and r.current_pos >= 0 then v_item.answer end,
    'explanation', case when v_status = 'reveal' and r.current_pos >= 0 then v_item.explanation end,
    'names', case when v_status = 'lobby' then (select coalesce(jsonb_agg(name order by joined_at), '[]') from (select name, joined_at from live_players where room_id = p_room order by joined_at limit 60) s) end,
    'top', case when v_status in ('reveal', 'finished') then (
      select coalesce(jsonb_agg(jsonb_build_object('name', name, 'score', score, 'correct', correct) order by score desc, joined_at), '[]')
      from (select name, score, correct, joined_at from live_players where room_id = p_room order by score desc, joined_at limit case when v_status = 'finished' and p_host then 100 else 5 end) s) end,
    'distribution', case when p_host and v_status = 'reveal' and r.current_pos >= 0 then (
      select coalesce(jsonb_object_agg(k, n), '{}') from (select coalesce(response->>'index', 'other') as k, count(*) as n from live_answers where room_id = p_room and item_id = v_item.id group by 1) s) end,
    'me', case when not p_host then jsonb_build_object(
      'name', v_player.name, 'score', v_player.score, 'correct', v_player.correct,
      'rank', (select count(*) + 1 from live_players where room_id = p_room and (score > v_player.score or (score = v_player.score and joined_at < v_player.joined_at))),
      'answered', exists (select 1 from live_answers where player_id = v_player.id and item_id = v_item.id),
      'last', (select jsonb_build_object('correct', is_correct, 'points', points) from live_answers where player_id = v_player.id and item_id = v_item.id)) end
  );
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'create_live_room(uuid, bigint, int, int, bigint)', 'join_live_room(text, uuid, text, text)', 'live_next(uuid, uuid)',
    'live_control(uuid, uuid, text)', 'live_answer(uuid, uuid, text, bigint, jsonb, boolean)', 'live_state(uuid, uuid, text, boolean)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
