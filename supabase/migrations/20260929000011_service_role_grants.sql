-- Server (service_role) jadvallarga to'liq kirishi kerak.
-- Supabase loyihasi "Automatically expose new tables" o'chirilgan holda yaratilganda
-- public sxemadagi yangi jadvallarga hech bir API roliga, jumladan service_role'ga ham, avtomatik ruxsat berilmaydi.
-- anon/authenticated uchun ruxsatlar init migratsiyasida qo'lda (ustun darajasida) boshqariladi — ularga tegmaymiz.

grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
