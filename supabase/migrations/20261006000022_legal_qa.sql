-- "Savol bering" (pivot, 3-bosqich): amaliy huquqiy savol-javob va hujjat tahlili.
-- Suhbatlar AI yordamchi jadvallarida (tutor_threads/tutor_messages) yangi rejimlar bilan saqlanadi.
-- Yuklangan fayl tahlildan keyin o'chiriladi — bazada faqat savol, javob va fayl haqida qisqa ma'lumot (doc_meta) qoladi.

-- ─────────────────────────── Rejimlar va javob belgilari ───────────────────────────
alter table public.tutor_threads drop constraint if exists tutor_threads_mode_check;
alter table public.tutor_threads add constraint tutor_threads_mode_check check (mode in ('explain', 'case', 'legal', 'document'));
alter table public.tutor_threads add column field text check (field is null or field ~ '^[a-z-]{2,40}$');
create index tutor_threads_user_mode_idx on public.tutor_threads (user_id, mode, updated_at desc);

alter table public.tutor_messages
  add column confidence   text check (confidence in ('high', 'medium', 'low')),
  add column needs_lawyer boolean not null default false,
  add column doc_meta     jsonb check (doc_meta is null or (jsonb_typeof(doc_meta) = 'object' and octet_length(doc_meta::text) <= 2000));

-- ─────────────────────────── Hujjat tahlili limiti (savollardan alohida) ───────────────────────────
alter table public.ai_weekly add column docs int not null default 0;

create or replace function public.consume_doc_quota(p_user uuid, p_limit int) returns int
language plpgsql volatile security definer set search_path = public as $$
declare
  used int;
begin
  insert into ai_weekly (user_id, week) values (p_user, public.uz_week()) on conflict do nothing;
  update ai_weekly set docs = docs + 1
   where user_id = p_user and week = public.uz_week() and (p_limit is null or docs < p_limit)
  returning docs into used;
  return used;
end $$;

create or replace function public.refund_doc_quota(p_user uuid) returns void
language sql volatile security definer set search_path = public as $$
  update ai_weekly set docs = greatest(docs - 1, 0) where user_id = p_user and week = public.uz_week()
$$;

do $$
declare f text;
begin
  foreach f in array array['consume_doc_quota(uuid, int)', 'refund_doc_quota(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

-- ─────────────────────────── Yuklangan hujjatlar uchun yopiq bucket ───────────────────────────
-- Brauzer faylni server bergan bir martalik imzoli havola orqali yuklaydi (Vercel tana chegarasi ~4,5 MB),
-- o'qish va o'chirish faqat server (admin klient) orqali — storage policy kerak emas.
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('legal-uploads', 'legal-uploads', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
    on conflict (id) do nothing;
  end if;
end $$;

-- Berilgan yuklash havolalari: yo'l faqat shu foydalanuvchiga va bir marta beriladi; tahlil qilinmagan
-- fayllar cron (/api/cron/tozalash) orqali 1 soatdan keyin o'chiriladi.
create table public.legal_uploads (
  path        text primary key check (path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|jpg|png|webp)$'),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now()
);
create index legal_uploads_user_idx on public.legal_uploads (user_id, created_at desc);
create index legal_uploads_age_idx on public.legal_uploads (created_at);
alter table public.legal_uploads enable row level security;
revoke all on public.legal_uploads from anon, authenticated;
grant all on public.legal_uploads to service_role;
