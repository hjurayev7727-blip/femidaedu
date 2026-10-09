-- Payme fiskal chek (Merchant API): CheckPerformTransaction javobiga "detail" qo'shiladi —
-- Payme chekni shu ma'lumot bilan o'zi yaratadi va fiskallashtiradi (A+ 20261008000072_payme_fiscal bilan bir xil).
-- IKPU 10899001001000000 «Прочие образовательные услуги», qadoq 1236092 «человек», QQS 0% (aylanma soliq).
-- Chekdagi nom — umumiy «Ta'lim xizmati».
-- Asosiy mantiq o'zgarmaydi: payme_rpc → payme_rpc_core, ustiga yupqa qobiq.
-- Idempotent: qayta ishga tushirilsa, nomini qayta o'zgartirmaydi — faqat qobiqni yangilaydi.
-- DIQQAT: keyingi migratsiyada payme_rpc mantig'i o'zgarsa — payme_rpc_core ni yangilang (payme_rpc emas).

do $$
begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'payme_rpc_core'
  ) then
    alter function public.payme_rpc(text, jsonb) rename to payme_rpc_core;
  end if;
end $$;
revoke all on function public.payme_rpc_core(text, jsonb) from public, anon, authenticated;

create or replace function public.payme_rpc(p_method text, p_params jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  r jsonb := payme_rpc_core(p_method, p_params);
  o payme_orders%rowtype;
begin
  if p_method <> 'CheckPerformTransaction' or not (r ? 'result') then return r; end if;
  select * into o from payme_orders where code = p_params -> 'account' ->> 'order_id';
  return jsonb_build_object('result', (r -> 'result') || jsonb_build_object('detail', jsonb_build_object(
    'receipt_type', 0,
    'items', jsonb_build_array(jsonb_build_object(
      'title', 'Ta''lim xizmati',
      'price', o.amount_uzs::bigint * 100,
      'count', 1,
      'code', '10899001001000000',
      'package_code', '1236092',
      'vat_percent', 0
    ))
  )));
end $$;

revoke all on function public.payme_rpc(text, jsonb) from public, anon, authenticated;
grant execute on function public.payme_rpc(text, jsonb), public.payme_rpc_core(text, jsonb) to service_role;
