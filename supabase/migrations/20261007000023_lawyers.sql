-- Yuristlar katalogi (pivot, 4-bosqich): yurist profili, ixtiyoriy tasdiqlash (guvohnoma), shikoyatlar, katalog.
-- Yurist — rol emas, profil: talaba yoki admin ham yurist bo'la oladi (profiles.role bitta qiymat).
-- Kontaktlar (telefon, Telegram) katalog va ochiq profil orqali HECH QACHON qaytmaydi — to'lovdan keyin ochiladi (6-bosqich).
-- Jadvallar yopiq (RLS, klientga ruxsat yo'q); kirish faqat server (service_role) orqali RPC'lar bilan.
-- Bo'lim app_settings.lawyers_enabled bayrog'i ortida (standart: o'chiq).

-- ─────────────────────────── Yurist profili ───────────────────────────
create table public.lawyer_profiles (
  user_id          uuid primary key references public.profiles (id) on delete cascade,
  kind             text not null default 'yurist' check (kind in ('advokat', 'yurist')),
  display_name     text not null check (char_length(display_name) between 3 and 80),
  headline         text not null default '' check (char_length(headline) <= 120),
  bio              text not null default '' check (char_length(bio) <= 2000),
  fields           text[] not null check (cardinality(fields) between 1 and 5),
  region           text not null check (region = any (array[
    'Toshkent shahri', 'Toshkent viloyati', 'Andijon', 'Buxoro', 'Farg''ona', 'Jizzax', 'Xorazm', 'Namangan', 'Navoiy',
    'Qashqadaryo', 'Qoraqalpog''iston', 'Samarqand', 'Sirdaryo', 'Surxondaryo'])),
  experience_years smallint not null default 0 check (experience_years between 0 and 60),
  languages        text[] not null default '{uz}' check (cardinality(languages) between 1 and 4 and languages <@ array['uz', 'ru', 'en', 'kaa']),
  price_from_uzs   int check (price_from_uzs is null or price_from_uzs between 10000 and 100000000),
  -- yashirin kontaktlar: faqat server va admin (mijozga — to'langan buyurtmadan keyin)
  phone            text check (phone is null or phone ~ '^\+998[0-9]{9}$'),
  telegram         text check (telegram is null or telegram ~ '^[A-Za-z][A-Za-z0-9_]{4,31}$'),
  status           text not null default 'active' check (status in ('active', 'hidden', 'blocked')),
  verified_at      timestamptz,
  -- sharhlar (6-bosqich) trigger orqali yangilaydi
  rating_sum       int not null default 0 check (rating_sum >= 0),
  rating_count     int not null default 0 check (rating_count >= 0),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index lawyer_profiles_catalog_idx on public.lawyer_profiles (status, verified_at desc nulls last, created_at desc);
create index lawyer_profiles_fields_idx on public.lawyer_profiles using gin (fields);
create trigger lawyer_profiles_touch before update on public.lawyer_profiles for each row execute function public.touch_updated_at();

-- ─────────────────────────── Tasdiqlash (ixtiyoriy "Tasdiqlangan" belgisi) ───────────────────────────
-- Guvohnoma rasmi yopiq `lawyer-docs` bucket'ida; admin ko'rib chiqqach fayl o'chiriladi (doc_path = null), raqam qoladi.
create table public.lawyer_verifications (
  id           bigserial primary key,
  user_id      uuid not null references public.lawyer_profiles (user_id) on delete cascade,
  license_no   text not null check (char_length(license_no) between 3 and 40),
  doc_path     text check (doc_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|jpg|png|webp)$'),
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reason       text check (char_length(reason) <= 500),
  reviewed_by  uuid references public.profiles (id) on delete set null,
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now(),
  check (status <> 'pending' or doc_path is not null)
);
create unique index lawyer_verifications_one_pending on public.lawyer_verifications (user_id) where status = 'pending';
create index lawyer_verifications_queue_idx on public.lawyer_verifications (status, created_at);

-- ─────────────────────────── Shikoyatlar ───────────────────────────
create table public.lawyer_reports (
  id           bigserial primary key,
  reporter_id  uuid not null references public.profiles (id) on delete cascade,
  lawyer_id    uuid not null references public.lawyer_profiles (user_id) on delete cascade,
  kind         text not null check (kind in ('fake', 'fraud', 'rude', 'offplatform', 'other')),
  reason       text not null check (char_length(reason) between 10 and 1000),
  status       text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  handled_by   uuid references public.profiles (id) on delete set null,
  handled_at   timestamptz,
  created_at   timestamptz not null default now(),
  check (reporter_id <> lawyer_id)
);
create unique index lawyer_reports_one_open on public.lawyer_reports (reporter_id, lawyer_id) where status = 'open';
create index lawyer_reports_queue_idx on public.lawyer_reports (status, created_at);
create index lawyer_reports_reporter_idx on public.lawyer_reports (reporter_id, created_at desc);

alter table public.lawyer_profiles      enable row level security;
alter table public.lawyer_verifications enable row level security;
alter table public.lawyer_reports       enable row level security;
revoke all on public.lawyer_profiles, public.lawyer_verifications, public.lawyer_reports from anon, authenticated;
grant all on public.lawyer_profiles, public.lawyer_verifications, public.lawyer_reports to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Bo'lim bayrog'i (admin sozlamalarida yoqiladi)
insert into public.app_settings (key, value) values ('lawyers_enabled', 'false') on conflict (key) do nothing;

-- ─────────────────────────── Yuklash havolalari reestri: guvohnoma fayllari ham ───────────────────────────
-- 3-bosqichdagi legal_uploads endi bucket'ni ham saqlaydi: berilgan yo'l faqat shu foydalanuvchiga, topshirilmagan
-- fayllar cron (/api/cron/tozalash) orqali o'chiriladi.
alter table public.legal_uploads add column bucket text not null default 'legal-uploads' check (bucket in ('legal-uploads', 'lawyer-docs'));

do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('lawyer-docs', 'lawyer-docs', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
    on conflict (id) do nothing;
  end if;
end $$;

-- ─────────────────────────── Funksiyalar (faqat server) ───────────────────────────

-- Ro'yxatdan o'tish yoki tahrirlash (bepul, erkin). Tasdiqlangan yurist ismi yoki turini o'zgartirsa, belgi olinadi.
-- p: {kind, display_name, headline, bio, fields[], region, experience_years, languages[], price_from_uzs, phone, telegram, visible}
create or replace function public.upsert_lawyer_profile(p_user uuid, p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  cur      lawyer_profiles%rowtype;
  existed  boolean;
  v_input  text[];
  v_fields text[];
  v_langs  text[];
  known_langs constant text[] := array['uz', 'ru', 'en', 'kaa'];
  v_name   text := btrim(coalesce(p->>'display_name', ''));
  v_kind   text := coalesce(nullif(p->>'kind', ''), 'yurist');
  v_phone  text := nullif(btrim(coalesce(p->>'phone', '')), '');
  v_tg     text := nullif(btrim(coalesce(p->>'telegram', '')), '');
  v_status text := case when p->>'visible' = 'false' then 'hidden' else 'active' end;
  reset    boolean := false;
begin
  if not exists (select 1 from profiles where id = p_user) then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if jsonb_typeof(p->'fields') is distinct from 'array' or jsonb_typeof(p->'languages') is distinct from 'array' then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  -- sohalar katalogdagi tartibda, tillar — o'zbek, rus, ingliz, qoraqalpoq tartibida saqlanadi
  v_input := array(select distinct x from jsonb_array_elements_text(p->'fields') x);
  v_fields := array(select f.slug from fields f where f.slug = any (v_input) order by f.sort);
  if cardinality(v_input) not between 1 and 5 or cardinality(v_fields) <> cardinality(v_input) then
    return jsonb_build_object('ok', false, 'reason', 'fields');
  end if;
  if exists (select 1 from jsonb_array_elements_text(p->'languages') x where x <> all (known_langs)) then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  v_langs := array(select l from unnest(known_langs) with ordinality k (l, i)
                   where l in (select jsonb_array_elements_text(p->'languages')) order by i);
  if v_phone is null and v_tg is null then return jsonb_build_object('ok', false, 'reason', 'contact'); end if;

  select * into cur from lawyer_profiles where user_id = p_user for update;
  existed := found;
  if existed then
    if cur.status = 'blocked' then return jsonb_build_object('ok', false, 'reason', 'blocked'); end if;
    reset := cur.verified_at is not null and (lower(cur.display_name) <> lower(v_name) or cur.kind <> v_kind);
    update lawyer_profiles set
      kind = v_kind, display_name = v_name, headline = btrim(coalesce(p->>'headline', '')), bio = btrim(coalesce(p->>'bio', '')),
      fields = v_fields, region = p->>'region', experience_years = coalesce(nullif(p->>'experience_years', '')::smallint, 0),
      languages = v_langs, price_from_uzs = nullif(p->>'price_from_uzs', '')::int, phone = v_phone, telegram = v_tg,
      status = v_status, verified_at = case when reset then null else verified_at end
    where user_id = p_user;
  else
    insert into lawyer_profiles (user_id, kind, display_name, headline, bio, fields, region, experience_years, languages,
                                 price_from_uzs, phone, telegram, status)
    values (p_user, v_kind, v_name, btrim(coalesce(p->>'headline', '')), btrim(coalesce(p->>'bio', '')), v_fields, p->>'region',
            coalesce(nullif(p->>'experience_years', '')::smallint, 0), v_langs, nullif(p->>'price_from_uzs', '')::int,
            v_phone, v_tg, v_status);
  end if;
  return jsonb_build_object('ok', true, 'created', not existed, 'unverified', reset);
exception
  when check_violation or not_null_violation or invalid_text_representation or numeric_value_out_of_range then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
end $$;

-- Guvohnoma yuborish: bitta ko'rib chiqilayotgan ariza, haftasiga ko'pi bilan 3 ta
create or replace function public.submit_lawyer_verification(p_user uuid, p_license text, p_path text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  l lawyer_profiles%rowtype;
  new_id bigint;
begin
  select * into l from lawyer_profiles where user_id = p_user for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_profile'); end if;
  if l.status = 'blocked' then return jsonb_build_object('ok', false, 'reason', 'blocked'); end if;
  if l.verified_at is not null then return jsonb_build_object('ok', false, 'reason', 'already'); end if;
  if exists (select 1 from lawyer_verifications where user_id = p_user and status = 'pending') then
    return jsonb_build_object('ok', false, 'reason', 'pending');
  end if;
  if (select count(*) from lawyer_verifications where user_id = p_user and created_at > now() - interval '7 days') >= 3 then
    return jsonb_build_object('ok', false, 'reason', 'too_many');
  end if;
  if p_path is null or p_path !~ ('^' || p_user::text || '/[0-9a-f-]{36}\.(pdf|jpg|png|webp)$') then
    return jsonb_build_object('ok', false, 'reason', 'path');
  end if;
  insert into lawyer_verifications (user_id, license_no, doc_path) values (p_user, btrim(p_license), p_path) returning id into new_id;
  return jsonb_build_object('ok', true, 'id', new_id);
exception
  when check_violation or not_null_violation then return jsonb_build_object('ok', false, 'reason', 'invalid');
end $$;

-- Admin: tasdiqlash yoki rad etish. Fayl yo'li qaytariladi — server uni bucket'dan o'chiradi.
create or replace function public.review_lawyer_verification(p_admin uuid, p_id bigint, p_approve boolean, p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v lawyer_verifications%rowtype;
begin
  if not exists (select 1 from profiles where id = p_admin and role = 'admin') then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;
  select * into v from lawyer_verifications where id = p_id for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if v.status <> 'pending' then return jsonb_build_object('ok', false, 'reason', 'status'); end if;
  update lawyer_verifications set
    status = case when p_approve then 'approved' else 'rejected' end,
    reason = case when p_approve then null else left(coalesce(nullif(btrim(p_reason), ''), 'Hujjat tasdiqlanmadi'), 500) end,
    reviewed_by = p_admin, reviewed_at = now(), doc_path = null
  where id = p_id;
  if p_approve then
    update lawyer_profiles set verified_at = now() where user_id = v.user_id;
  end if;
  return jsonb_build_object('ok', true, 'path', v.doc_path, 'user_id', v.user_id);
end $$;

-- Admin: belgini olib tashlash (masalan, guvohnoma bekor qilingan bo'lsa)
create or replace function public.revoke_lawyer_verification(p_admin uuid, p_lawyer uuid) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
begin
  if not exists (select 1 from profiles where id = p_admin and role = 'admin') then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;
  update lawyer_profiles set verified_at = null where user_id = p_lawyer and verified_at is not null;
  if not found then return jsonb_build_object('ok', false, 'reason', 'status'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- Katalog: faqat faol profillar; tasdiqlanganlar yuqorida, keyin Bayes reytingi (o'rtacha 4, og'irlik 3), keyin yangilari.
-- Kontaktlar (phone, telegram) bu yerda yo'q.
create or replace function public.lawyer_catalog(p_field text default null, p_region text default null, p_q text default null,
                                                 p_limit int default 20, p_offset int default 0)
returns table (id uuid, kind text, display_name text, headline text, fields text[], region text, experience_years smallint,
               languages text[], price_from_uzs int, verified boolean, rating numeric, rating_count int)
language sql stable security definer set search_path = public as $$
  select l.user_id, l.kind, l.display_name, l.headline, l.fields, l.region, l.experience_years, l.languages, l.price_from_uzs,
         l.verified_at is not null, case when l.rating_count > 0 then round(l.rating_sum::numeric / l.rating_count, 1) end, l.rating_count
  from lawyer_profiles l
  where l.status = 'active'
    and (p_field is null or p_field = any (l.fields))
    and (p_region is null or l.region = p_region)
    and (coalesce(btrim(p_q), '') = ''
         or (l.display_name || ' ' || l.headline || ' ' || l.bio)
            ilike '%' || replace(replace(replace(left(btrim(p_q), 80), '\', '\\'), '%', '\%'), '_', '\_') || '%')
  order by (l.verified_at is not null) desc, (l.rating_sum + 12.0) / (l.rating_count + 3) desc, l.created_at desc, l.user_id
  limit least(greatest(coalesce(p_limit, 20), 1), 50) offset least(greatest(coalesce(p_offset, 0), 0), 10000)
$$;

-- Ochiq profil (faqat faol). Kontaktlar yo'q.
create or replace function public.lawyer_public(p_id uuid)
returns table (id uuid, kind text, display_name text, headline text, bio text, fields text[], region text, experience_years smallint,
               languages text[], price_from_uzs int, verified_at timestamptz, rating numeric, rating_count int, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select l.user_id, l.kind, l.display_name, l.headline, l.bio, l.fields, l.region, l.experience_years, l.languages, l.price_from_uzs,
         l.verified_at, case when l.rating_count > 0 then round(l.rating_sum::numeric / l.rating_count, 1) end, l.rating_count, l.created_at
  from lawyer_profiles l
  where l.user_id = p_id and l.status = 'active'
$$;

-- Shikoyat: o'zi ustidan emas, bitta yurist ustidan bitta ochiq shikoyat, kuniga ko'pi bilan 5 ta
create or replace function public.report_lawyer(p_user uuid, p_lawyer uuid, p_kind text, p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  new_id bigint;
begin
  if p_user = p_lawyer then return jsonb_build_object('ok', false, 'reason', 'self'); end if;
  perform 1 from profiles where id = p_user for update;   -- bir foydalanuvchining shikoyatlari ketma-ket (kunlik limit aniq)
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if not exists (select 1 from lawyer_profiles where user_id = p_lawyer) then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if exists (select 1 from lawyer_reports where reporter_id = p_user and lawyer_id = p_lawyer and status = 'open') then
    return jsonb_build_object('ok', false, 'reason', 'duplicate');
  end if;
  if (select count(*) from lawyer_reports where reporter_id = p_user and created_at > now() - interval '1 day') >= 5 then
    return jsonb_build_object('ok', false, 'reason', 'limit');
  end if;
  insert into lawyer_reports (reporter_id, lawyer_id, kind, reason) values (p_user, p_lawyer, p_kind, btrim(p_reason)) returning id into new_id;
  return jsonb_build_object('ok', true, 'id', new_id);
exception
  when check_violation or not_null_violation then return jsonb_build_object('ok', false, 'reason', 'invalid');
end $$;

-- Admin: shikoyatni yopish
create or replace function public.handle_lawyer_report(p_admin uuid, p_id bigint, p_status text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
begin
  if not exists (select 1 from profiles where id = p_admin and role = 'admin') then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;
  if p_status not in ('resolved', 'dismissed') then return jsonb_build_object('ok', false, 'reason', 'invalid'); end if;
  update lawyer_reports set status = p_status, handled_by = p_admin, handled_at = now() where id = p_id and status = 'open';
  if not found then return jsonb_build_object('ok', false, 'reason', 'status'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- Admin: profil holati. Bloklanganda ochiq shikoyatlar "hal qilindi" bo'ladi.
create or replace function public.set_lawyer_status(p_admin uuid, p_lawyer uuid, p_status text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
begin
  if not exists (select 1 from profiles where id = p_admin and role = 'admin') then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;
  if p_status not in ('active', 'hidden', 'blocked') then return jsonb_build_object('ok', false, 'reason', 'invalid'); end if;
  update lawyer_profiles set status = p_status where user_id = p_lawyer;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if p_status = 'blocked' then
    update lawyer_reports set status = 'resolved', handled_by = p_admin, handled_at = now() where lawyer_id = p_lawyer and status = 'open';
  end if;
  return jsonb_build_object('ok', true);
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'upsert_lawyer_profile(uuid, jsonb)', 'submit_lawyer_verification(uuid, text, text)',
    'review_lawyer_verification(uuid, bigint, boolean, text)', 'revoke_lawyer_verification(uuid, uuid)',
    'lawyer_catalog(text, text, text, int, int)', 'lawyer_public(uuid)', 'report_lawyer(uuid, uuid, text, text)',
    'handle_lawyer_report(uuid, bigint, text)', 'set_lawyer_status(uuid, uuid, text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
