-- "Savol bering": har kim uchun huquqiy savol-javob (qonun moddalariga tayangan) va hujjat tahlili.
-- AI ustoz suhbatlari jadvalidan foydalaniladi; yangi rejimlar: legal (savol), document (yuklangan hujjat tahlili).
-- Yuklangan fayl saqlanmaydi: tahlildan keyin o'chiriladi, faqat turi/sahifalari/nomi (doc_meta) va javob qoladi.

alter table public.tutor_threads drop constraint if exists tutor_threads_mode_check;
alter table public.tutor_threads add constraint tutor_threads_mode_check check (mode in ('explain', 'case', 'legal', 'document'));
alter table public.tutor_threads add column if not exists field text check (field is null or field ~ '^[a-z-]{2,40}$');

alter table public.tutor_messages
  add column if not exists confidence text check (confidence in ('high', 'medium', 'low')),
  add column if not exists needs_lawyer boolean not null default false,
  add column if not exists doc_meta jsonb;   -- { type: 'pdf'|'image', pages, name } — faylning o'zi emas

-- Hujjat tahlili qimmatroq — alohida haftalik limit
alter table public.ai_weekly add column if not exists docs int not null default 0;

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

revoke all on function public.consume_doc_quota(uuid, int), public.refund_doc_quota(uuid) from public, anon, authenticated;
grant execute on function public.consume_doc_quota(uuid, int), public.refund_doc_quota(uuid) to service_role;

-- Yuristlar bo'limi tayyor bo'lguncha "Yuristga murojaat" tugmasi yashirin
insert into public.app_settings (key, value) values ('lawyers_enabled', 'false'::jsonb) on conflict (key) do nothing;

-- Yuklangan hujjatlar uchun yopiq bucket (faqat server, imzolangan yuklash havolasi orqali)
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('legal-uploads', 'legal-uploads', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
    on conflict (id) do nothing;
  end if;
end $$;
