-- Huquq sohalari katalogi (V3, 3-qism): modda bo'yicha progress, soha ko'rsatkichlari, modda → test, bepul qoidasi.
-- Qonun matni ochiq (lex.uz'da ham ochiq); Premium bilan testlar yopiladi: bepul — har hujjatning 1-bobi va C sohalar.

-- Modda bepulmi: C soha, sohasiz hujjat (Sertifikat yo'nalishi — o'z limitlari bor), 1-bob yoki bobsiz hujjatning dastlabki 20 moddasi
create or replace function public.article_is_free(p_article bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    f.priority = 'C' or d.field_id is null
      or (a.chapter_id is null and a.sort <= 20)
      or a.chapter_id = (select c.id from chapters c where c.document_id = a.document_id order by c.sort, c.id limit 1),
    false)
  from articles a
  join documents d on d.id = a.document_id
  left join fields f on f.id = d.field_id
  where a.id = p_article
$$;
grant execute on function public.article_is_free(bigint) to authenticated, service_role;

-- Modda "o'zlashtirilgan": kamida 2 ta to'g'ri javob va to'g'ri ulushi ≥ 2/3
create or replace function public.article_mastered(p_seen int, p_correct int) returns boolean
language sql immutable as $$ select p_correct >= 2 and p_correct * 3 >= p_seen * 2 $$;

-- Javob yozilganda savolga bog'langan moddalar progressi yangilanadi (moddalar xaritasi uchun)
create or replace function public.track_article_progress() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into article_progress (user_id, article_id, seen, correct, last_at)
  select at.user_id, ar.id, 1, (new.is_correct is true)::int, now()
  from attempts at
  join questions q on q.id = new.question_id
  join articles ar on ar.id = any (q.article_ids)
  where at.id = new.attempt_id
  on conflict (user_id, article_id) do update
    set seen = article_progress.seen + 1, correct = article_progress.correct + excluded.correct, last_at = now();
  return null;
end $$;
create trigger attempt_answers_article_progress after insert on public.attempt_answers
  for each row execute function public.track_article_progress();

-- Katalog: har soha bo'yicha moddalar, o'zlashtirilganlar (joriy foydalanuvchi) va savollar soni
create or replace function public.field_overview()
returns table (slug text, title text, priority char(1), color text, icon text, documents int, articles int, mastered int, questions int)
language sql stable security definer set search_path = public as $$
  select f.slug, f.title, f.priority, f.color, f.icon,
         count(distinct d.id)::int,
         count(distinct a.id)::int,
         count(distinct a.id) filter (where public.article_mastered(p.seen, p.correct))::int,
         count(distinct q.id)::int
  from fields f
  left join documents d on d.field_id = f.id
  left join articles a on a.document_id = d.id and a.status <> 'repealed'
  left join article_progress p on p.article_id = a.id and p.user_id = auth.uid()
  left join questions q on q.status = 'published' and a.id = any (q.article_ids)
  group by f.id
  order by f.sort
$$;
grant execute on function public.field_overview() to authenticated;

-- Hujjat bo'yicha: har modda uchun savollar soni va joriy foydalanuvchi progressi
create or replace function public.document_articles(p_document int)
returns table (id bigint, number text, title text, chapter_id int, sort int, status text, questions int, seen int, correct int, free boolean)
language sql stable security definer set search_path = public as $$
  select a.id, a.number, a.title, a.chapter_id, a.sort, a.status,
         (select count(*)::int from questions q where q.status = 'published' and a.id = any (q.article_ids)),
         coalesce(p.seen, 0), coalesce(p.correct, 0), public.article_is_free(a.id)
  from articles a
  left join article_progress p on p.article_id = a.id and p.user_id = auth.uid()
  where a.document_id = p_document and a.status <> 'repealed'
  order by a.sort, a.id
$$;
grant execute on function public.document_articles(int) to authenticated;

-- Modda bo'yicha mashq (faqat service_role; server Premium holatini beradi)
create or replace function public.start_article_practice(p_user uuid, p_article bigint, p_n int, p_premium boolean)
returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  ids bigint[];
  new_id uuid;
begin
  if not exists (select 1 from articles where id = p_article and status <> 'repealed') then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if not p_premium and not public.article_is_free(p_article) then
    raise exception 'premium_required' using errcode = 'P0001';
  end if;
  select coalesce(array_agg(id), '{}') into ids from (
    select q.id from questions q
    where q.status = 'published' and p_article = any (q.article_ids)
    order by random() limit greatest(1, least(p_n, 50))
  ) s;
  if cardinality(ids) = 0 then
    raise exception 'no_questions' using errcode = 'P0001';
  end if;
  insert into attempts (user_id, mode, question_ids) values (p_user, 'practice', ids) returning id into new_id;
  return new_id;
end $$;
revoke all on function public.start_article_practice(uuid, bigint, int, boolean) from public, anon, authenticated;
grant execute on function public.start_article_practice(uuid, bigint, int, boolean) to service_role;
