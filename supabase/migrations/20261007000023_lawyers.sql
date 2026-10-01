-- Yuristlar katalogi: erkin ro'yxatdan o'tish, ixtiyoriy "Tasdiqlangan" belgisi, shikoyatlar, bloklash.
-- Yurist — rol emas, profil (talaba yoki admin ham yurist bo'lishi mumkin). Telefon/Telegram va karta ma'lumotlari
-- katalog funksiyalarida hech qachon qaytarilmaydi — kontaktlar faqat to'langan buyurtmadan keyin (escrow bosqichi).

create table public.lawyer_profiles (
  user_id          uuid primary key references public.profiles (id) on delete cascade,
  display_name     text not null check (char_length(display_name) between 3 and 80),
  headline         text check (char_length(headline) <= 120),
  bio              text check (char_length(bio) <= 2000),
  fields           text[] not null check (cardinality(fields) between 1 and 6),
  region           text check (char_length(region) <= 60),
  experience_years int check (experience_years between 0 and 70),
  languages        text[] not null default '{uz}' check (cardinality(languages) between 1 and 4),
  price_from_uzs   int check (price_from_uzs between 0 and 100000000),
  phone            text check (phone ~ '^\+998[0-9]{9}$'),
  telegram         text check (telegram ~ '^[A-Za-z0-9_]{5,32}$'),
  payout_card      text check (payout_card ~ '^[0-9]{16}$'),
  payout_holder    text check (char_length(payout_holder) <= 80),
  status           text not null default 'active' check (status in ('active', 'hidden', 'blocked')),
  verified_at      timestamptz,
  rating_sum       int not null default 0,
  rating_count     int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index lawyer_profiles_fields_idx on public.lawyer_profiles using gin (fields) where status = 'active';
create trigger lawyer_profiles_touch before update on public.lawyer_profiles for each row execute function public.touch_updated_at();

create table public.lawyer_verifications (
  id          bigserial primary key,
  user_id     uuid not null references public.lawyer_profiles (user_id) on delete cascade,
  license_no  text not null check (char_length(license_no) between 3 and 40),
  doc_path    text not null check (char_length(doc_path) <= 200),
  status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reason      text check (char_length(reason) <= 500),
  reviewed_by uuid references public.profiles (id),
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz
);
create unique index lawyer_verifications_one_pending on public.lawyer_verifications (user_id) where status = 'pending';

create table public.lawyer_reports (
  id          bigserial primary key,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  lawyer_id   uuid not null references public.lawyer_profiles (user_id) on delete cascade,
  reason      text not null check (char_length(reason) between 10 and 1000),
  status      text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  handled_by  uuid references public.profiles (id),
  created_at  timestamptz not null default now(),
  handled_at  timestamptz
);
create unique index lawyer_reports_one_open on public.lawyer_reports (reporter_id, lawyer_id) where status = 'open';

alter table public.lawyer_profiles      enable row level security;
alter table public.lawyer_verifications enable row level security;
alter table public.lawyer_reports       enable row level security;
revoke all on public.lawyer_profiles, public.lawyer_verifications, public.lawyer_reports from anon, authenticated;
grant all on public.lawyer_profiles, public.lawyer_verifications, public.lawyer_reports to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Komissiya (escrow bosqichida ishlatiladi): kamida 20%
insert into public.app_settings (key, value) values ('lawyer_commission_pct', '20'::jsonb) on conflict (key) do nothing;

-- ─────────────────────────── Funksiyalar (faqat server) ───────────────────────────

create or replace function public.is_admin(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = p_user and role = 'admin')
$$;

/** Yurist profilini yaratish/yangilash. Bloklangan profil o'zgartirilmaydi. */
create or replace function public.upsert_lawyer_profile(p_user uuid, p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_fields text[];
  v_status text;
begin
  select array_agg(distinct f) into v_fields from jsonb_array_elements_text(coalesce(p->'fields', '[]')) f;
  if v_fields is null or exists (select 1 from unnest(v_fields) f where not exists (select 1 from fields where slug = f)) then
    return jsonb_build_object('ok', false, 'reason', 'fields');
  end if;
  select status into v_status from lawyer_profiles where user_id = p_user;
  if v_status = 'blocked' then return jsonb_build_object('ok', false, 'reason', 'blocked'); end if;
  insert into lawyer_profiles (user_id, display_name, headline, bio, fields, region, experience_years, languages, price_from_uzs, phone, telegram, payout_card, payout_holder, status)
  values (p_user, p->>'display_name', nullif(p->>'headline', ''), nullif(p->>'bio', ''), v_fields, nullif(p->>'region', ''),
          (p->>'experience_years')::int, coalesce((select array_agg(x) from jsonb_array_elements_text(p->'languages') x), '{uz}'),
          (p->>'price_from_uzs')::int, nullif(p->>'phone', ''), nullif(p->>'telegram', ''), nullif(p->>'payout_card', ''),
          nullif(p->>'payout_holder', ''), case when (p->>'hidden')::boolean then 'hidden' else 'active' end)
  on conflict (user_id) do update set
    display_name = excluded.display_name, headline = excluded.headline, bio = excluded.bio, fields = excluded.fields,
    region = excluded.region, experience_years = excluded.experience_years, languages = excluded.languages,
    price_from_uzs = excluded.price_from_uzs, phone = excluded.phone, telegram = excluded.telegram,
    payout_card = coalesce(excluded.payout_card, lawyer_profiles.payout_card),
    payout_holder = coalesce(excluded.payout_holder, lawyer_profiles.payout_holder),
    status = excluded.status;
  return jsonb_build_object('ok', true);
end $$;

-- Katalog va ochiq profil uchun umumiy ko'rinish (kontakt va karta YO'Q)
create or replace function public.lawyer_card(l lawyer_profiles) returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object(
    'id', l.user_id, 'display_name', l.display_name, 'headline', l.headline, 'bio', l.bio, 'fields', l.fields,
    'region', l.region, 'experience_years', l.experience_years, 'languages', l.languages, 'price_from_uzs', l.price_from_uzs,
    'verified', l.verified_at is not null, 'rating', case when l.rating_count > 0 then round(l.rating_sum::numeric / l.rating_count, 1) end,
    'rating_count', l.rating_count, 'has_contacts', l.phone is not null or l.telegram is not null, 'since', l.created_at)
$$;

/** Katalog: faqat faol; tasdiqlanganlar oldin, keyin Bayes reytingi (o'rtacha 4 ga 3 ta "virtual" baho), keyin yangilar */
create or replace function public.lawyer_catalog(p_field text, p_region text, p_q text, p_limit int, p_offset int)
returns jsonb
language sql stable security definer set search_path = public as $$
  with f as (
    select l as p, row_number() over (
      order by (l.verified_at is not null) desc, (l.rating_sum + 12)::numeric / (l.rating_count + 3) desc, l.created_at desc) as ord
    from lawyer_profiles l
    where l.status = 'active'
      and (p_field is null or p_field = any (l.fields))
      and (p_region is null or l.region = p_region)
      and (p_q is null or l.display_name ilike '%' || replace(replace(p_q, '%', ''), '_', '') || '%'
           or l.headline ilike '%' || replace(replace(p_q, '%', ''), '_', '') || '%')
  )
  select jsonb_build_object(
    'total', (select count(*) from f),
    'items', coalesce((select jsonb_agg(public.lawyer_card(x.p) order by x.ord) from (
      select f.p, f.ord from f order by f.ord limit least(greatest(p_limit, 1), 50) offset greatest(p_offset, 0)
    ) x), '[]'::jsonb))
$$;

/** Ochiq profil (faol bo'lmasa — faqat egasi va admin ko'radi) */
create or replace function public.lawyer_public(p_viewer uuid, p_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select public.lawyer_card(l) || jsonb_build_object('status', l.status)
  from lawyer_profiles l
  where l.user_id = p_id and (l.status = 'active' or l.user_id = p_viewer or public.is_admin(p_viewer))
$$;

/** Egasi uchun to'liq profil (kabinet) */
create or replace function public.my_lawyer_profile(p_user uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select to_jsonb(l) - 'payout_card' || jsonb_build_object(
    'payout_card_last4', right(l.payout_card, 4),
    'verification', (select jsonb_build_object('status', v.status, 'reason', v.reason, 'created_at', v.created_at)
                     from lawyer_verifications v where v.user_id = l.user_id order by v.id desc limit 1))
  from lawyer_profiles l where l.user_id = p_user
$$;

create or replace function public.submit_lawyer_verification(p_user uuid, p_license text, p_path text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
begin
  if not exists (select 1 from lawyer_profiles where user_id = p_user and status <> 'blocked') then
    return jsonb_build_object('ok', false, 'reason', 'no_profile');
  end if;
  if exists (select 1 from lawyer_profiles where user_id = p_user and verified_at is not null) then
    return jsonb_build_object('ok', false, 'reason', 'already');
  end if;
  if p_path not like p_user::text || '/%' then return jsonb_build_object('ok', false, 'reason', 'path'); end if;
  if exists (select 1 from lawyer_verifications where user_id = p_user and status = 'pending') then
    return jsonb_build_object('ok', false, 'reason', 'pending');
  end if;
  insert into lawyer_verifications (user_id, license_no, doc_path) values (p_user, btrim(p_license), p_path);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.review_lawyer_verification(p_admin uuid, p_id bigint, p_approve boolean, p_reason text)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v lawyer_verifications%rowtype;
begin
  if not public.is_admin(p_admin) then return jsonb_build_object('ok', false, 'reason', 'forbidden'); end if;
  select * into v from lawyer_verifications where id = p_id for update;
  if not found or v.status <> 'pending' then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  update lawyer_verifications set status = case when p_approve then 'approved' else 'rejected' end,
    reason = nullif(btrim(coalesce(p_reason, '')), ''), reviewed_by = p_admin, reviewed_at = now()
  where id = p_id;
  if p_approve then update lawyer_profiles set verified_at = now() where user_id = v.user_id; end if;
  return jsonb_build_object('ok', true, 'doc_path', v.doc_path);
end $$;

/** Shikoyat: o'ziga emas, kuniga 5 tagacha, bir yuristga bitta ochiq shikoyat */
create or replace function public.report_lawyer(p_user uuid, p_lawyer uuid, p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
begin
  if p_user = p_lawyer then return jsonb_build_object('ok', false, 'reason', 'self'); end if;
  if not exists (select 1 from lawyer_profiles where user_id = p_lawyer) then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if (select count(*) from lawyer_reports where reporter_id = p_user and created_at > now() - interval '1 day') >= 5 then
    return jsonb_build_object('ok', false, 'reason', 'limit');
  end if;
  insert into lawyer_reports (reporter_id, lawyer_id, reason) values (p_user, p_lawyer, btrim(p_reason))
  on conflict do nothing;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.handle_lawyer_report(p_admin uuid, p_id bigint, p_status text) returns boolean
language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_admin(p_admin) or p_status not in ('resolved', 'dismissed') then return false; end if;
  update lawyer_reports set status = p_status, handled_by = p_admin, handled_at = now() where id = p_id and status = 'open';
  return found;
end $$;

create or replace function public.set_lawyer_status(p_admin uuid, p_lawyer uuid, p_status text) returns boolean
language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_admin(p_admin) or p_status not in ('active', 'blocked') then return false; end if;
  update lawyer_profiles set status = p_status where user_id = p_lawyer;
  return found;
end $$;

/** Admin navbati: kutilayotgan tasdiqlashlar, ochiq shikoyatlar */
create or replace function public.lawyer_admin_queue(p_admin uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when not public.is_admin(p_admin) then null else jsonb_build_object(
    'verifications', coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'lawyer_id', v.user_id, 'name', l.display_name,
        'license_no', v.license_no, 'doc_path', v.doc_path, 'created_at', v.created_at) order by v.id)
      from lawyer_verifications v join lawyer_profiles l on l.user_id = v.user_id where v.status = 'pending'), '[]'),
    'reports', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'lawyer_id', r.lawyer_id, 'name', l.display_name,
        'status', l.status, 'reason', r.reason, 'created_at', r.created_at,
        'open_reports', (select count(*) from lawyer_reports x where x.lawyer_id = r.lawyer_id and x.status = 'open')) order by r.id)
      from lawyer_reports r join lawyer_profiles l on l.user_id = r.lawyer_id where r.status = 'open'), '[]'),
    'blocked', coalesce((select jsonb_agg(jsonb_build_object('lawyer_id', l.user_id, 'name', l.display_name)) from lawyer_profiles l where l.status = 'blocked'), '[]')
  ) end
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'is_admin(uuid)', 'upsert_lawyer_profile(uuid, jsonb)', 'lawyer_card(lawyer_profiles)',
    'lawyer_catalog(text, text, text, int, int)', 'lawyer_public(uuid, uuid)', 'my_lawyer_profile(uuid)',
    'submit_lawyer_verification(uuid, text, text)', 'review_lawyer_verification(uuid, bigint, boolean, text)',
    'report_lawyer(uuid, uuid, text)', 'handle_lawyer_report(uuid, bigint, text)', 'set_lawyer_status(uuid, uuid, text)',
    'lawyer_admin_queue(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

-- Guvohnoma rasmlari uchun yopiq bucket (shaxsga doir ma'lumot — faqat server va admin)
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('lawyer-docs', 'lawyer-docs', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
    on conflict (id) do nothing;
  end if;
end $$;
