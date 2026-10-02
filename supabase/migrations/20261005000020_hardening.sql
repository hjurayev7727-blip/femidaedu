-- Xavfsizlik gigienasi (Supabase advisor natijalari bo'yicha).
-- 1) Supabase public sxemadagi funksiyalarga anon uchun ham EXECUTE beradi. Trigger funksiyalari va faqat kirgan
--    foydalanuvchilar uchun mo'ljallanganlaridan anon huquqi olinadi (ochiq katalog — test_catalog — ochiq qoladi).
-- 2) search_path belgilanmagan yordamchi funksiyalarga search_path qo'yiladi.
do $$
declare f text;
begin
  foreach f in array array[
    'handle_new_user()', 'track_article_progress()', 'track_test_article_progress()',
    'is_premium()', 'current_role_is(public.user_role[])', 'member_of(bigint)', 'teaches(uuid)',
    'my_group_tests()', 'field_overview()', 'document_articles(int)', 'article_is_free(bigint)', 'topic_question_counts()'
  ] loop
    execute format('revoke execute on function public.%s from anon, public', f);
  end loop;
  -- trigger funksiyalarini to'g'ridan-to'g'ri chaqirish kerak emas
  foreach f in array array['handle_new_user()', 'track_article_progress()', 'track_test_article_progress()'] loop
    execute format('revoke execute on function public.%s from authenticated', f);
  end loop;
  -- kirgan foydalanuvchilar uchun kerakli o'qish funksiyalari
  foreach f in array array['is_premium()', 'current_role_is(public.user_role[])', 'member_of(bigint)', 'teaches(uuid)',
    'my_group_tests()', 'field_overview()', 'document_articles(int)', 'article_is_free(bigint)', 'topic_question_counts()'] loop
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

alter function public.uz_today() set search_path = public;
alter function public.topic_subtree(int) set search_path = public;
alter function public.touch_updated_at() set search_path = public;
alter function public.public_name(text) set search_path = public;
alter function public.payme_now() set search_path = public;
alter function public.law_text_hash(text) set search_path = public;
alter function public.article_mastered(int, int) set search_path = public;
alter function public.uz_week() set search_path = public;
alter function public.test_reveal(public.tests) set search_path = public;
alter function public.test_attempt_actor(public.test_attempts, uuid, text) set search_path = public;
alter function public.live_effective_status(public.live_rooms) set search_path = public;
