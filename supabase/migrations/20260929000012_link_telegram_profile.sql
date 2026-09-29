-- Jonli ishga tushirishda topilgan xato: Supabase Auth (GoTrue) admin.createUser foydalanuvchini avval
-- app_metadata'siz INSERT qiladi, telegram_id ni esa keyin alohida UPDATE bilan yozadi. handle_new_user
-- trigger'i faqat INSERT'ni ko'radi — profil telegram_id'siz qoladi va keyingi kirishlar
-- "texnik email band, lekin telegram_id bog'lanmagan" bilan rad etiladi.
--
-- Yechim: server foydalanuvchini yaratgach (yoki yarim yaratilgan holatni tiklashda) profilni shu funksiya
-- bilan bog'laydi. Ishonch manbai — faqat server yoza oladigan raw_app_meta_data.telegram_id
-- (foydalanuvchi o'zgartira oladigan user_metadata emas).

create or replace function public.link_telegram_profile(p_email text, p_telegram_id bigint, p_username text)
returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid;
begin
  select u.id into uid
  from auth.users u
  where lower(u.email) = lower(p_email)
    and u.raw_app_meta_data ->> 'telegram_id' = p_telegram_id::text;
  if uid is null then
    return null;
  end if;

  update public.profiles
     set telegram_id = p_telegram_id,
         telegram_username = p_username
   where id = uid
     and (telegram_id is null or telegram_id = p_telegram_id);
  if not found then
    return null;
  end if;
  return uid;
end $$;

revoke all on function public.link_telegram_profile(text, bigint, text) from public, anon, authenticated;
grant execute on function public.link_telegram_profile(text, bigint, text) to service_role;
