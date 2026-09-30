-- Foydalanuvchi testlari (V3, 4-qism): AI bilan yaratish, tahrirlash, ulashish (havola, 6 belgili kod, Telegram, guruh),
-- mehmon rejimi, muallif paneli, javob kaliti o'zgarsa jimgina qayta hisoblash, reyting, ishonch darajasi, katalog.
-- Javob kaliti (test_items.answer) klientga hech qachon berilmaydi: barcha amallar server (service_role) orqali.

-- ─────────────────────────── Ishonch darajasi (hammasini admin beradi) ───────────────────────────
-- 0 — yangi · 1 — katalogga chiqadi · 2 — tasdiqlangan yurist/o'qituvchi · 3 — ekspert
alter table public.profiles add column trust_level smallint not null default 0 check (trust_level between 0 and 3);

-- ─────────────────────────── Testlar ───────────────────────────
create type public.test_visibility as enum ('private', 'link', 'group', 'public');

create table public.tests (
  id             bigserial primary key,
  owner_id       uuid not null references public.profiles (id) on delete cascade,
  field_id       int references public.fields (id) on delete set null,
  title          text not null check (char_length(title) between 3 and 120),
  description    text check (char_length(description) <= 600),
  visibility     public.test_visibility not null default 'link',
  share_code     char(6) not null unique,                   -- 0/O, 1/I yo'q alfavit
  group_id       bigint references public.groups (id) on delete set null,
  -- {timer_min, opens_at, closes_at, max_attempts, shuffle, reveal: 'each'|'end'|'after_close', guests}
  settings       jsonb not null default '{}',
  own_material   boolean not null default false,            -- bazadagi moddaga bog'lanmagan savol bor
  source         text not null default 'ai' check (source in ('ai', 'manual')),
  moderation     text check (moderation in ('pending', 'ok', 'rejected')),
  moderation_note text,
  rating_sum     int not null default 0,
  rating_n       int not null default 0,
  attempts_count int not null default 0,
  status         text not null default 'draft' check (status in ('draft', 'published', 'hidden', 'removed')),
  published_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index tests_owner_idx on public.tests (owner_id, created_at desc);
create index tests_catalog_idx on public.tests (visibility, status, field_id);
create trigger tests_touch before update on public.tests for each row execute function public.touch_updated_at();

create table public.test_items (
  id           bigserial primary key,
  test_id      bigint not null references public.tests (id) on delete cascade,
  pos          int not null default 0,
  type         public.question_type not null,
  stem         text not null,
  context      text,
  payload      jsonb not null,                              -- javobsiz
  answer       jsonb not null,                              -- MAXFIY
  explanation  text,
  article_id   bigint references public.articles (id) on delete set null,
  difficulty   smallint not null default 2 check (difficulty between 1 and 3),
  key_version  int not null default 1,                      -- javob kaliti o'zgarsa oshadi → qayta hisoblash
  status       text not null default 'active' check (status in ('active', 'voided')),
  fingerprint  text
);
create index test_items_test_idx on public.test_items (test_id, pos);
create unique index test_items_fp_idx on public.test_items (test_id, fingerprint) where fingerprint is not null;

create table public.test_attempts (
  id               uuid primary key default gen_random_uuid(),
  test_id          bigint not null references public.tests (id) on delete cascade,
  user_id          uuid references public.profiles (id) on delete cascade,
  guest_name       text check (char_length(guest_name) <= 60),
  guest_token_hash text,                                    -- sha256(cookie tokeni) — tokenning o'zi saqlanmaydi
  item_ids         bigint[] not null,                       -- boshlangandagi savollar (keyin qo'shilganlar ta'sir qilmaydi)
  started_at       timestamptz not null default now(),
  deadline_at      timestamptz,
  finished_at      timestamptz,
  correct_count    int,
  total_count      int,
  score            numeric(5,2),
  score_history    jsonb not null default '[]',             -- qayta hisoblashdan oldingi ballar (audit)
  check ((user_id is null) <> (guest_token_hash is null))
);
create index test_attempts_test_idx on public.test_attempts (test_id, started_at desc);
create index test_attempts_user_idx on public.test_attempts (user_id, started_at desc);
create index test_attempts_guest_idx on public.test_attempts (guest_token_hash);

create table public.test_answers (
  attempt_id   uuid not null references public.test_attempts (id) on delete cascade,
  item_id      bigint not null references public.test_items (id) on delete cascade,
  response     jsonb not null,
  is_correct   boolean not null,
  key_version  int not null default 1,
  answered_at  timestamptz not null default now(),
  primary key (attempt_id, item_id)
);
create index test_answers_item_idx on public.test_answers (item_id);

create table public.test_ratings (
  test_id  bigint not null references public.tests (id) on delete cascade,
  user_id  uuid not null references public.profiles (id) on delete cascade,
  stars    smallint not null check (stars between 1 and 5),
  primary key (test_id, user_id)
);

-- AI testlar haftalik limiti (bepul: 10 ta test / hafta)
create table public.ai_weekly (
  user_id  uuid not null references public.profiles (id) on delete cascade,
  week     date not null,
  tests    int not null default 0,
  primary key (user_id, week)
);

alter table public.tests         enable row level security;
alter table public.test_items    enable row level security;
alter table public.test_attempts enable row level security;
alter table public.test_answers  enable row level security;
alter table public.test_ratings  enable row level security;
alter table public.ai_weekly     enable row level security;
-- Klient faqat o'z testlari ro'yxatini va o'z urinishlarini o'qiydi; savollar va javob kaliti — faqat server orqali
create policy tests_own    on public.tests         for select to authenticated using (owner_id = auth.uid());
create policy tattempt_own on public.test_attempts for select to authenticated using (user_id = auth.uid());
create policy aiw_own      on public.ai_weekly     for select to authenticated using (user_id = auth.uid());
grant select on public.tests, public.test_attempts, public.ai_weekly to authenticated;
grant all on public.tests, public.test_items, public.test_attempts, public.test_answers, public.test_ratings, public.ai_weekly to service_role;
grant usage, select on all sequences in schema public to service_role;

-- ─────────────────────────── Yordamchi funksiyalar ───────────────────────────
create or replace function public.uz_week() returns date
language sql stable as $$ select date_trunc('week', public.uz_today())::date $$;

-- 6 belgili ulashish kodi: chalkash belgilarsiz (0/O, 1/I)
create or replace function public.new_share_code() returns char(6)
language plpgsql volatile set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    select string_agg(substr(alphabet, 1 + floor(random() * 32)::int, 1), '') into code from generate_series(1, 6);
    exit when not exists (select 1 from tests where share_code = code);
  end loop;
  return code;
end $$;

-- AI testlar haftalik limiti (atomar). p_limit null — cheksiz. Qaytaradi: shu haftadagi tartib raqami yoki null (limit tugagan)
create or replace function public.consume_test_quota(p_user uuid, p_limit int) returns int
language plpgsql volatile security definer set search_path = public as $$
declare
  used int;
begin
  insert into ai_weekly (user_id, week) values (p_user, public.uz_week()) on conflict do nothing;
  update ai_weekly set tests = tests + 1
   where user_id = p_user and week = public.uz_week() and (p_limit is null or tests < p_limit)
  returning tests into used;
  return used;
end $$;

-- AI xatosida limit qaytariladi (foydalanuvchi aybsiz)
create or replace function public.refund_test_quota(p_user uuid) returns void
language sql volatile security definer set search_path = public as $$
  update ai_weekly set tests = greatest(tests - 1, 0) where user_id = p_user and week = public.uz_week()
$$;

-- Test sozlamasi (jsonb) dan qiymat
create or replace function public.test_reveal(t tests) returns text
language sql immutable as $$ select coalesce(t.settings->>'reveal', 'end') $$;

-- Testni ishlashga ruxsat: e'lon qilingan + (egasi | havola/ochiq | guruh a'zosi). Mehmon (p_user null) — faqat havola/ochiq va guests ≠ false
create or replace function public.test_accessible(t tests, p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select t.status = 'published' and (
    (p_user is not null and t.owner_id = p_user)
    or (t.visibility in ('link', 'public') and (p_user is not null
        or (coalesce((t.settings->>'guests')::boolean, true) and (t.settings->>'max_attempts') is null)))
    or (t.visibility = 'group' and p_user is not null
        and exists (select 1 from group_members m where m.group_id = t.group_id and m.user_id = p_user))
  )
$$;

-- Urinish balini qayta hisoblash; yakunlangan urinishda ball o'zgarsa eski qiymat tarixga yoziladi
create or replace function public.recalc_test_attempt(p_attempt uuid, p_reason text) returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  a test_attempts%rowtype;
  v_total int; v_correct int; v_score numeric(5,2);
begin
  select * into a from test_attempts where id = p_attempt for update;
  if not found then return; end if;
  select count(*) into v_total from test_items where id = any (a.item_ids) and status = 'active';
  select count(*) into v_correct from test_answers ans join test_items i on i.id = ans.item_id
   where ans.attempt_id = p_attempt and ans.is_correct and i.status = 'active' and i.id = any (a.item_ids);
  v_score := round(100.0 * v_correct / greatest(v_total, 1), 2);
  update test_attempts set
    correct_count = v_correct, total_count = v_total, score = v_score,
    score_history = case when a.finished_at is not null and a.score is distinct from v_score
                         then score_history || jsonb_build_object('score', a.score, 'correct', a.correct_count, 'reason', p_reason, 'at', now())
                         else score_history end
  where id = p_attempt;
end $$;

-- ─────────────────────────── Muallif: yaratish va tahrirlash ───────────────────────────

/** Moddasi bazada yo'q savol bormi — test "o'z materiali" belgisi */
create or replace function public.refresh_test_flags(p_test bigint) returns void
language sql volatile security definer set search_path = public as $$
  update tests set own_material = exists (select 1 from test_items where test_id = p_test and status = 'active' and article_id is null)
  where id = p_test
$$;

/**
 * Yangi test (qoralama) va savollari. p = { title, description, field, source,
 *   items: [{ type, stem, context, payload, answer, explanation, article_id, difficulty, fingerprint }] }
 * Takroriy savollar (bir xil fingerprint) o'tkazib yuboriladi. Qaytaradi: { id, share_code, items }
 */
create or replace function public.create_user_test(p_user uuid, p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_test tests%rowtype;
  v_n int;
begin
  if jsonb_typeof(p->'items') is distinct from 'array' or jsonb_array_length(p->'items') not between 1 and 50 then
    raise exception 'items_count' using errcode = 'P0001';
  end if;
  insert into tests (owner_id, field_id, title, description, share_code, source)
  values (p_user, (select id from fields where slug = p->>'field'), p->>'title', nullif(p->>'description', ''),
          public.new_share_code(), coalesce(p->>'source', 'ai'))
  returning * into v_test;

  insert into test_items (test_id, pos, type, stem, context, payload, answer, explanation, article_id, difficulty, fingerprint)
  select v_test.id, e.ord, (e.x->>'type')::question_type, e.x->>'stem', nullif(e.x->>'context', ''), e.x->'payload', e.x->'answer',
         nullif(e.x->>'explanation', ''), (select id from articles where id = (e.x->>'article_id')::bigint),
         coalesce((e.x->>'difficulty')::smallint, 2), nullif(e.x->>'fingerprint', '')
  from jsonb_array_elements(p->'items') with ordinality as e(x, ord)
  on conflict (test_id, fingerprint) where fingerprint is not null do nothing;
  get diagnostics v_n = row_count;

  perform public.refresh_test_flags(v_test.id);
  return jsonb_build_object('id', v_test.id, 'share_code', v_test.share_code, 'items', v_n);
end $$;

-- Test sarlavhasi, tavsifi, sohasi
create or replace function public.update_test_meta(p_user uuid, p_test bigint, p jsonb) returns boolean
language sql volatile security definer set search_path = public as $$
  -- Ochiq testni tahrirlash — katalog uchun qayta moderatsiya
  update tests set title = p->>'title', description = nullif(p->>'description', ''),
    field_id = (select id from fields where slug = p->>'field'),
    moderation = case when visibility = 'public' then 'pending' else moderation end
  where id = p_test and owner_id = p_user and status <> 'removed'
  returning true
$$;

/**
 * Savolni saqlash (p_item null — yangi savol oxiriga). Javob kaliti o'zgarsa: key_version++ va
 * p_regrade = [{ attempt_id, correct }] (server yangi kalit bilan qayta baholagan) qo'llanadi, ballar jimgina qayta hisoblanadi.
 * Javob berilgan savolning turini o'zgartirib bo'lmaydi.
 */
create or replace function public.save_test_item(p_user uuid, p_test bigint, p_item bigint, p jsonb, p_regrade jsonb default '[]')
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_old test_items%rowtype;
  v_id bigint;
  v_key_changed boolean := false;
  r record;
begin
  if not exists (select 1 from tests where id = p_test and owner_id = p_user and status <> 'removed') then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  if p_item is null then
    if (select count(*) from test_items where test_id = p_test and status = 'active') >= 50 then
      return jsonb_build_object('ok', false, 'reason', 'items_count');
    end if;
    -- Qo'lda qo'shilgan savol bazaga bog'lanmaydi (moddani faqat AI generatori manbadan bog'laydi)
    insert into test_items (test_id, pos, type, stem, context, payload, answer, explanation, article_id, difficulty)
    values (p_test, coalesce((select max(pos) from test_items where test_id = p_test), 0) + 1,
            (p->>'type')::question_type, p->>'stem', nullif(p->>'context', ''), p->'payload', p->'answer',
            nullif(p->>'explanation', ''), null, coalesce((p->>'difficulty')::smallint, 2))
    returning id into v_id;
  else
    select * into v_old from test_items where id = p_item and test_id = p_test and status = 'active' for update;
    if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
    if v_old.type::text <> p->>'type' and exists (select 1 from test_answers where item_id = p_item) then
      return jsonb_build_object('ok', false, 'reason', 'type_locked');
    end if;
    v_key_changed := v_old.answer is distinct from p->'answer' or v_old.payload is distinct from p->'payload';
    update test_items set type = (p->>'type')::question_type, stem = p->>'stem', context = nullif(p->>'context', ''),
      payload = p->'payload', answer = p->'answer', explanation = nullif(p->>'explanation', ''),
      -- modda bog'lanishini faqat olib tashlash mumkin, boshqa moddaga almashtirib bo'lmaydi
      article_id = case when (p->>'article_id')::bigint is not distinct from v_old.article_id then v_old.article_id end,
      difficulty = coalesce((p->>'difficulty')::smallint, difficulty),
      key_version = key_version + v_key_changed::int, fingerprint = null
    where id = p_item returning id into v_id;

    if v_key_changed then
      update test_answers ans set is_correct = (x->>'correct')::boolean, key_version = (select key_version from test_items where id = v_id)
      from jsonb_array_elements(coalesce(p_regrade, '[]')) x
      where ans.item_id = v_id and ans.attempt_id = (x->>'attempt_id')::uuid;
      -- Server javoblarni o'qigandan keyin yozilgan javob qayta baholanmay qolmasin: bo'lsa — butunlay qaytariladi, server qayta urinadi
      if exists (select 1 from test_answers where item_id = v_id and key_version <> (select key_version from test_items where id = v_id)) then
        raise exception 'regrade_retry' using errcode = 'P0001';
      end if;
      for r in select distinct attempt_id from test_answers where item_id = v_id loop
        perform public.recalc_test_attempt(r.attempt_id, 'key_change');
      end loop;
    end if;
  end if;
  update tests set moderation = 'pending' where id = p_test and visibility = 'public' and moderation is not null;

  perform public.refresh_test_flags(p_test);
  return jsonb_build_object('ok', true, 'id', v_id, 'regraded', v_key_changed);
end $$;

-- Savolni olib tashlash: javob berilgan bo'lsa — bekor qilinadi (ballar qayta hisoblanadi), aks holda o'chiriladi
create or replace function public.remove_test_item(p_user uuid, p_item bigint) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_test bigint;
  r record;
begin
  select i.test_id into v_test from test_items i join tests t on t.id = i.test_id
   where i.id = p_item and t.owner_id = p_user and i.status = 'active';
  if v_test is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if exists (select 1 from test_answers where item_id = p_item) then
    update test_items set status = 'voided' where id = p_item;
    for r in select distinct attempt_id from test_answers where item_id = p_item loop
      perform public.recalc_test_attempt(r.attempt_id, 'item_voided');
    end loop;
  else
    delete from test_items where id = p_item;
  end if;
  perform public.refresh_test_flags(v_test);
  update tests set moderation = 'pending' where id = v_test and visibility = 'public' and moderation is not null;
  return jsonb_build_object('ok', true);
end $$;

/**
 * Nashr qilish / ko'rinishni o'zgartirish. Guruh — faqat o'z guruhi (admin — istalgan).
 * public: moderation 'pending' (server AI tekshiruvidan keyin set_test_moderation chaqiradi); katalogga chiqish — test_catalog shartlari.
 */
create or replace function public.publish_test(p_user uuid, p_test bigint, p_visibility public.test_visibility, p_group bigint, p_settings jsonb)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  t tests%rowtype;
begin
  select * into t from tests where id = p_test and owner_id = p_user and status <> 'removed' for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if not exists (select 1 from test_items where test_id = p_test and status = 'active') then
    return jsonb_build_object('ok', false, 'reason', 'no_items');
  end if;
  if p_visibility = 'group' and not exists (
    select 1 from groups g where g.id = p_group
      and (g.teacher_id = p_user or exists (select 1 from profiles where id = p_user and role = 'admin'))
  ) then
    return jsonb_build_object('ok', false, 'reason', 'group');
  end if;
  update tests set visibility = p_visibility, group_id = case when p_visibility = 'group' then p_group end,
    settings = coalesce(p_settings, '{}'), status = 'published', published_at = coalesce(published_at, now()),
    moderation = case when p_visibility = 'public' then coalesce(nullif(moderation, 'rejected'), 'pending') else moderation end
  where id = p_test;
  return jsonb_build_object('ok', true, 'share_code', t.share_code);
end $$;

-- Nashrdan olish (havola ishlamay qoladi) yoki o'chirish (urinishlar bo'lsa — faqat yashiriladi, natijalar saqlanadi)
create or replace function public.set_test_status(p_user uuid, p_test bigint, p_status text) returns boolean
language plpgsql volatile security definer set search_path = public as $$
begin
  if p_status not in ('hidden', 'removed') then return false; end if;
  if p_status = 'removed' and not exists (select 1 from test_attempts where test_id = p_test) then
    delete from tests where id = p_test and owner_id = p_user;
    return found;
  end if;
  update tests set status = p_status where id = p_test and owner_id = p_user and status <> 'removed';
  return found;
end $$;

-- AI moderatsiya natijasi (server)
create or replace function public.set_test_moderation(p_test bigint, p_status text, p_note text) returns void
language sql volatile security definer set search_path = public as $$
  update tests set moderation = p_status, moderation_note = p_note where id = p_test
$$;

-- Ishonch darajasini faqat admin beradi
create or replace function public.admin_set_trust(p_admin uuid, p_user uuid, p_level int) returns boolean
language plpgsql volatile security definer set search_path = public as $$
begin
  if not exists (select 1 from profiles where id = p_admin and role = 'admin') then return false; end if;
  update profiles set trust_level = p_level where id = p_user;
  return found;
end $$;

-- ─────────────────────────── Ishlovchi: kartochka, boshlash, javob, yakunlash ───────────────────────────

-- Kod bo'yicha test kartasi (javobsiz). p_user null — mehmon; p_guest — mehmon tokeni xeshi
create or replace function public.test_card(p_code text, p_user uuid, p_guest text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  t tests%rowtype;
  v_author profiles%rowtype;
  v_mine int;
  v_open uuid;
begin
  select * into t from tests where share_code = upper(p_code);
  if not found or not public.test_accessible(t, p_user) then
    -- Guruh testi: kirmagan yoki a'zo bo'lmagan foydalanuvchiga faqat "yopiq" deb aytiladi
    if found and t.status = 'published' and (t.visibility = 'group' or p_user is null) then
      return jsonb_build_object('ok', false, 'reason', case when p_user is null then 'login_required' else 'group_only' end, 'title', t.title);
    end if;
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  select * into v_author from profiles where id = t.owner_id;
  select count(*) filter (where finished_at is not null) into v_mine from test_attempts
   where test_id = t.id and ((p_user is not null and user_id = p_user) or (p_user is null and guest_token_hash = p_guest));
  select id into v_open from test_attempts
   where test_id = t.id and finished_at is null and (deadline_at is null or deadline_at > now())
     and ((p_user is not null and user_id = p_user) or (p_user is null and guest_token_hash = p_guest))
   order by started_at desc limit 1;
  return jsonb_build_object(
    'ok', true, 'id', t.id, 'code', t.share_code, 'title', t.title, 'description', t.description,
    'author', v_author.full_name, 'trust', v_author.trust_level, 'is_owner', p_user is not null and t.owner_id = p_user,
    'field', (select jsonb_build_object('slug', slug, 'title', title, 'icon', icon) from fields where id = t.field_id),
    'items', (select count(*) from test_items where test_id = t.id and status = 'active'),
    'rating', case when t.rating_n > 0 then round(t.rating_sum::numeric / t.rating_n, 1) end, 'rating_n', t.rating_n,
    'attempts', t.attempts_count, 'settings', t.settings, 'visibility', t.visibility, 'own_material', t.own_material,
    'my_finished', v_mine, 'open_attempt', v_open,
    'my_rating', (select stars from test_ratings where test_id = t.id and user_id = p_user));
end $$;

/**
 * Urinish boshlash (yoki tugallanmaganini davom ettirish). Mehmon: p_user null, p_guest_name + p_guest (token xeshi).
 * Qaytaradi: { ok, attempt_id } | { ok: false, reason: not_found|login_required|not_open|closed|max_attempts|no_items }
 */
create or replace function public.start_test_attempt(p_code text, p_user uuid, p_guest_name text, p_guest text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  t tests%rowtype;
  v_open uuid;
  v_done int;
  v_ids bigint[];
  v_timer int;
  v_close timestamptz;
  v_id uuid;
begin
  select * into t from tests where share_code = upper(p_code) for update;  -- parallel boshlashlar ketma-ket (urinishlar limiti)
  if not found or t.status <> 'published' then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if not public.test_accessible(t, p_user) then
    return jsonb_build_object('ok', false, 'reason', case when p_user is null then 'login_required' else 'not_found' end);
  end if;
  if p_user is null and (coalesce(trim(p_guest_name), '') = '' or coalesce(p_guest, '') = '') then
    return jsonb_build_object('ok', false, 'reason', 'login_required');
  end if;
  -- Urinishlar cheklangan testda mehmon tokenni yangilab limitni chetlab o'tmasin — faqat kirganlar
  if p_user is null and (t.settings->>'max_attempts') is not null then
    return jsonb_build_object('ok', false, 'reason', 'login_required');
  end if;
  if (t.settings->>'opens_at') is not null and now() < (t.settings->>'opens_at')::timestamptz then
    return jsonb_build_object('ok', false, 'reason', 'not_open');
  end if;
  v_close := (t.settings->>'closes_at')::timestamptz;
  if v_close is not null and now() >= v_close then return jsonb_build_object('ok', false, 'reason', 'closed'); end if;

  -- Tugallanmagan urinish — davom ettiriladi
  select id into v_open from test_attempts
   where test_id = t.id and finished_at is null and (deadline_at is null or deadline_at > now())
     and ((p_user is not null and user_id = p_user) or (p_user is null and guest_token_hash = p_guest))
   order by started_at desc limit 1;
  if v_open is not null then return jsonb_build_object('ok', true, 'attempt_id', v_open, 'resumed', true); end if;

  select count(*) into v_done from test_attempts
   where test_id = t.id and ((p_user is not null and user_id = p_user) or (p_user is null and guest_token_hash = p_guest));
  if (t.settings->>'max_attempts') is not null and v_done >= (t.settings->>'max_attempts')::int and t.owner_id is distinct from p_user then
    return jsonb_build_object('ok', false, 'reason', 'max_attempts');
  end if;

  select coalesce(array_agg(id order by case when coalesce((t.settings->>'shuffle')::boolean, false) then random() end, pos, id), '{}')
    into v_ids from test_items where test_id = t.id and status = 'active';
  if cardinality(v_ids) = 0 then return jsonb_build_object('ok', false, 'reason', 'no_items'); end if;

  v_timer := nullif((t.settings->>'timer_min')::int, 0);
  insert into test_attempts (test_id, user_id, guest_name, guest_token_hash, item_ids, deadline_at, total_count)
  values (t.id, p_user, case when p_user is null then left(trim(p_guest_name), 60) end, case when p_user is null then p_guest end,
          v_ids,
          case when v_timer is null then v_close
               when v_close is null then now() + make_interval(mins => v_timer)
               else least(now() + make_interval(mins => v_timer), v_close) end,
          cardinality(v_ids))
  returning id into v_id;
  return jsonb_build_object('ok', true, 'attempt_id', v_id, 'resumed', false);
end $$;

-- Urinish egasimi (foydalanuvchi yoki mehmon tokeni)
create or replace function public.test_attempt_actor(a test_attempts, p_user uuid, p_guest text) returns boolean
language sql immutable as $$
  select (p_user is not null and a.user_id = p_user) or (p_user is null and a.user_id is null and a.guest_token_hash = p_guest)
$$;

/**
 * Javobni yozish (server javob kalitiga qarab p_correct ni hisoblaydi). reveal='each' — javob o'zgarmaydi,
 * boshqa rejimlarda yakunlaguncha o'zgartirish mumkin. Muddat server vaqtida (30 soniya tarmoq zaxirasi).
 */
create or replace function public.save_test_answer(p_attempt uuid, p_user uuid, p_guest text, p_item bigint, p_response jsonb, p_correct boolean, p_key int)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  a test_attempts%rowtype;
  t tests%rowtype;
  v_key int;
begin
  select * into a from test_attempts where id = p_attempt for update;
  if not found or not public.test_attempt_actor(a, p_user, p_guest) then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if a.finished_at is not null then return jsonb_build_object('ok', false, 'reason', 'finished'); end if;
  if a.deadline_at is not null and now() > a.deadline_at + interval '30 seconds' then return jsonb_build_object('ok', false, 'reason', 'time_up'); end if;
  if not (p_item = any (a.item_ids)) then return jsonb_build_object('ok', false, 'reason', 'not_in_attempt'); end if;
  select * into t from tests where id = a.test_id;
  select key_version into v_key from test_items where id = p_item and status = 'active' for share;
  if v_key is null then return jsonb_build_object('ok', false, 'reason', 'not_in_attempt'); end if;
  -- Javob eski kalit bilan baholangan bo'lsa (muallif shu orada kalitni o'zgartirdi) — server qayta baholaydi
  if p_key is distinct from v_key then return jsonb_build_object('ok', false, 'reason', 'stale_key'); end if;

  if public.test_reveal(t) = 'each' then
    insert into test_answers (attempt_id, item_id, response, is_correct, key_version) values (p_attempt, p_item, p_response, p_correct, v_key)
    on conflict do nothing;
    if not found then return jsonb_build_object('ok', false, 'reason', 'duplicate'); end if;
  else
    insert into test_answers (attempt_id, item_id, response, is_correct, key_version) values (p_attempt, p_item, p_response, p_correct, v_key)
    on conflict (attempt_id, item_id) do update set response = excluded.response, is_correct = excluded.is_correct,
      key_version = excluded.key_version, answered_at = now();
  end if;
  return jsonb_build_object('ok', true, 'reveal', public.test_reveal(t));
end $$;

-- Yakunlash: ball hisoblanadi, test urinishlar soni oshadi
create or replace function public.finish_test_attempt(p_attempt uuid, p_user uuid, p_guest text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  a test_attempts%rowtype;
begin
  select * into a from test_attempts where id = p_attempt for update;
  if not found or not public.test_attempt_actor(a, p_user, p_guest) then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if a.finished_at is null then
    perform public.recalc_test_attempt(p_attempt, 'finish');
    update test_attempts set finished_at = least(now(), coalesce(deadline_at + interval '30 seconds', now())) where id = p_attempt;
    update tests set attempts_count = attempts_count + 1 where id = a.test_id;
  end if;
  select * into a from test_attempts where id = p_attempt;
  return jsonb_build_object('ok', true, 'score', a.score, 'correct', a.correct_count, 'total', a.total_count);
end $$;

-- Mehmon keyin Telegram/Google bilan kirsa — urinishlari akkauntiga o'tkaziladi
create or replace function public.claim_guest_attempts(p_user uuid, p_guest text) returns int
language sql volatile security definer set search_path = public as $$
  with moved as (
    update test_attempts set user_id = p_user, guest_token_hash = null
    where user_id is null and guest_token_hash = p_guest returning 1
  )
  select count(*)::int from moved
$$;

-- Baho (1–5): faqat testni yakunlagan foydalanuvchi, muallif o'ziga baho qo'ya olmaydi
create or replace function public.rate_test(p_user uuid, p_test bigint, p_stars int) returns boolean
language plpgsql volatile security definer set search_path = public as $$
declare
  v_old smallint;
begin
  if p_stars not between 1 and 5 then return false; end if;
  perform 1 from tests where id = p_test for update;   -- parallel baholar ketma-ket (yig'indi ikki marta qo'shilmasin)
  if exists (select 1 from tests where id = p_test and owner_id = p_user) then return false; end if;
  if not exists (select 1 from test_attempts where test_id = p_test and user_id = p_user and finished_at is not null) then return false; end if;
  select stars into v_old from test_ratings where test_id = p_test and user_id = p_user;
  insert into test_ratings (test_id, user_id, stars) values (p_test, p_user, p_stars)
  on conflict (test_id, user_id) do update set stars = excluded.stars;
  update tests set rating_sum = rating_sum - coalesce(v_old, 0) + p_stars, rating_n = rating_n + (v_old is null)::int where id = p_test;
  return true;
end $$;

-- Kirgan foydalanuvchining testdagi javobi modda progressiga ham yoziladi (moddalar xaritasi)
create or replace function public.track_test_article_progress() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into article_progress (user_id, article_id, seen, correct, last_at)
  select a.user_id, i.article_id, 1, new.is_correct::int, now()
  from test_attempts a join test_items i on i.id = new.item_id
  where a.id = new.attempt_id and a.user_id is not null and i.article_id is not null
  on conflict (user_id, article_id) do update
    set seen = article_progress.seen + 1, correct = article_progress.correct + excluded.correct, last_at = now();
  return null;
end $$;
create trigger test_answers_article_progress after insert on public.test_answers
  for each row execute function public.track_test_article_progress();

-- ─────────────────────────── Muallif paneli ───────────────────────────

-- Har ishlovchi: muallif har doim to'liq ismni ko'radi (kartada ogohlantiriladi)
create or replace function public.test_results(p_user uuid, p_test bigint)
returns table (attempt_id uuid, name text, guest boolean, score numeric, correct int, total int, started_at timestamptz, finished_at timestamptz, regraded boolean)
language sql stable security definer set search_path = public as $$
  select a.id, coalesce(nullif(p.full_name, ''), a.guest_name, 'Ishtirokchi'), a.user_id is null,
         a.score, a.correct_count, a.total_count, a.started_at, a.finished_at, jsonb_array_length(a.score_history) > 0
  from test_attempts a
  join tests t on t.id = a.test_id and t.owner_id = p_user
  left join profiles p on p.id = a.user_id
  where a.test_id = p_test
  order by a.finished_at desc nulls last, a.started_at desc
  limit 500
$$;

-- Har savol bo'yicha: javoblar soni va to'g'ri ulushi (shubhali savollarni topish uchun)
create or replace function public.test_item_stats(p_user uuid, p_test bigint)
returns table (item_id bigint, answered int, correct int)
language sql stable security definer set search_path = public as $$
  select i.id, count(ans.item_id)::int, count(*) filter (where ans.is_correct)::int
  from test_items i
  join tests t on t.id = i.test_id and t.owner_id = p_user
  left join test_answers ans on ans.item_id = i.id
  where i.test_id = p_test and i.status = 'active'
  group by i.id
$$;

-- ─────────────────────────── Katalog va guruh testlari ───────────────────────────

-- Ochiq katalog: public + muallif ishonchi ≥ 1 + AI moderatsiyadan o'tgan + faqat bazaga bog'langan + ≥ 5 savol + izohli ≥ 50%
create or replace function public.test_catalog(p_field text default null, p_limit int default 30)
returns table (code text, title text, author text, trust smallint, field text, field_icon text, items int, rating numeric, rating_n int, attempts int)
language sql stable security definer set search_path = public as $$
  select t.share_code, t.title, public.public_name(p.full_name), p.trust_level, f.title, f.icon, s.n,
         case when t.rating_n > 0 then round(t.rating_sum::numeric / t.rating_n, 1) end, t.rating_n, t.attempts_count
  from tests t
  join profiles p on p.id = t.owner_id
  left join fields f on f.id = t.field_id
  cross join lateral (
    select count(*)::int as n, count(*) filter (where coalesce(explanation, '') <> '')::int as explained
    from test_items where test_id = t.id and status = 'active'
  ) s
  where t.visibility = 'public' and t.status = 'published' and t.moderation = 'ok' and not t.own_material
    and p.trust_level >= 1 and s.n >= 5 and s.explained * 2 >= s.n
    and (p_field is null or f.slug = p_field)
  -- Bayes o'rtacha baho (m = 10, o'rtacha 3,5) + ommaboplik
  order by (t.rating_sum + 35.0) / (t.rating_n + 10) desc, t.attempts_count desc, t.published_at desc
  limit least(greatest(p_limit, 1), 100)
$$;
grant execute on function public.test_catalog(text, int) to anon, authenticated;

-- Foydalanuvchi a'zo bo'lgan guruhlarga berilgan testlar
create or replace function public.my_group_tests()
returns table (code text, title text, group_name text, items int, closes_at timestamptz, finished boolean)
language sql stable security definer set search_path = public as $$
  select t.share_code, t.title, g.name,
         (select count(*)::int from test_items where test_id = t.id and status = 'active'),
         (t.settings->>'closes_at')::timestamptz,
         exists (select 1 from test_attempts a where a.test_id = t.id and a.user_id = auth.uid() and a.finished_at is not null)
  from tests t
  join groups g on g.id = t.group_id
  join group_members m on m.group_id = g.id and m.user_id = auth.uid()
  where t.visibility = 'group' and t.status = 'published'
  order by t.published_at desc
  limit 50
$$;
grant execute on function public.my_group_tests() to authenticated;

-- Server funksiyalari: faqat service_role (foydalanuvchi identifikatori server tomonidan beriladi)
do $$
declare f text;
begin
  foreach f in array array[
    'consume_test_quota(uuid, int)', 'refund_test_quota(uuid)', 'recalc_test_attempt(uuid, text)', 'refresh_test_flags(bigint)',
    'create_user_test(uuid, jsonb)', 'update_test_meta(uuid, bigint, jsonb)', 'save_test_item(uuid, bigint, bigint, jsonb, jsonb)',
    'remove_test_item(uuid, bigint)', 'publish_test(uuid, bigint, public.test_visibility, bigint, jsonb)',
    'set_test_status(uuid, bigint, text)', 'set_test_moderation(bigint, text, text)', 'admin_set_trust(uuid, uuid, int)',
    'test_card(text, uuid, text)', 'start_test_attempt(text, uuid, text, text)', 'save_test_answer(uuid, uuid, text, bigint, jsonb, boolean, int)',
    'finish_test_attempt(uuid, uuid, text)', 'claim_guest_attempts(uuid, text)', 'rate_test(uuid, bigint, int)',
    'test_results(uuid, bigint)', 'test_item_stats(uuid, bigint)', 'test_accessible(public.tests, uuid)', 'new_share_code()'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
