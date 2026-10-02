-- Qonunlar qamrovi: hujjat turi (kodeks / qonun / Konstitutsiya), import va qidiruvda hisobga olish.
-- Femida Edu endi faqat kodekslar emas, ko'p so'raladigan qonunlarni ham qamraydi (Iste'molchilar, Murojaatlar, Notariat…).

alter table public.documents add column if not exists kind text not null default 'code'
  check (kind in ('code', 'law', 'constitution'));

update public.documents set kind = case
  when code = 'KONST' then 'constitution'
  when title ~* 'kodeks' then 'code'
  else 'law' end;

-- Qidiruv (AI javoblari uchun manba) — butun matn bo'yicha GIN indeks
create index if not exists articles_fts_idx on public.articles
  using gin (to_tsvector('simple', coalesce(title, '') || ' ' || body));

create or replace function public.import_law_document(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_doc      int;
  v_created  boolean := false;
  v_field    int;
  a          jsonb;
  c          jsonb;
  v_hash     text;
  v_old      record;
  v_ins int := 0; v_chg int := 0; v_rep int := 0; v_same int := 0; v_flag int := 0;
  v_changed  bigint[] := '{}';
  v_repealed bigint[] := '{}';
  v_seen     text[] := '{}';
begin
  if coalesce(p->>'code', '') = '' or coalesce(p->>'title', '') = '' then
    raise exception 'code va title majburiy';
  end if;
  if jsonb_typeof(p->'articles') is distinct from 'array' or jsonb_array_length(p->'articles') = 0 then
    raise exception 'moddalar topilmadi — import to''xtatildi (bekor qilish xavfi)';
  end if;
  select id into v_field from fields where slug = p->>'field';
  if p ? 'field' and v_field is null then raise exception 'soha topilmadi: %', p->>'field'; end if;
  if p ? 'kind' and p->>'kind' not in ('code', 'law', 'constitution') then raise exception 'hujjat turi noto''g''ri: %', p->>'kind'; end if;

  select id into v_doc from documents where (p->>'lex_id' is not null and lex_id = p->>'lex_id') or code = p->>'code' limit 1;
  if v_doc is null then
    insert into documents (number, code, title, short_title, lex_id, field_id, revised_on, lex_url, fetched_at, kind)
    values ((select greatest(coalesce(max(number), 0), 100) + 1 from documents), p->>'code', p->>'title',
            coalesce(p->>'short_title', p->>'title'), p->>'lex_id', v_field, (p->>'revised_on')::date,
            case when p->>'lex_id' is not null then 'https://lex.uz/docs/-' || (p->>'lex_id') end, now(),
            coalesce(p->>'kind', 'code'))
    returning id into v_doc;
    v_created := true;
  else
    update documents set title = p->>'title', short_title = coalesce(p->>'short_title', short_title),
      lex_id = coalesce(p->>'lex_id', lex_id), field_id = coalesce(v_field, field_id),
      revised_on = coalesce((p->>'revised_on')::date, revised_on), fetched_at = now(),
      lex_url = case when p->>'lex_id' is not null then 'https://lex.uz/docs/-' || (p->>'lex_id') else lex_url end,
      kind = coalesce(p->>'kind', kind)
    where id = v_doc;
  end if;

  for c in select * from jsonb_array_elements(coalesce(p->'chapters', '[]'::jsonb)) loop
    insert into chapters (document_id, number, title, sort) values (v_doc, c->>'number', c->>'title', coalesce((c->>'sort')::int, 0))
    on conflict (document_id, number) do update set title = excluded.title, sort = excluded.sort;
  end loop;

  for a in select * from jsonb_array_elements(p->'articles') loop
    v_hash := law_text_hash(a->>'body');
    v_seen := v_seen || (a->>'number');
    select id, body_hash, status into v_old from articles where document_id = v_doc and number = a->>'number';
    if not found then
      insert into articles (document_id, number, title, body, body_hash, chapter_id, sort, status)
      values (v_doc, a->>'number', a->>'title', a->>'body', v_hash,
              (select id from chapters where document_id = v_doc and number = a->>'chapter'), coalesce((a->>'sort')::int, 0), 'active');
      v_ins := v_ins + 1;
    elsif v_old.body_hash is distinct from v_hash or v_old.status = 'repealed' then
      update articles set title = a->>'title', body = a->>'body', body_hash = v_hash, status = 'changed', updated_at = now(),
        chapter_id = (select id from chapters where document_id = v_doc and number = a->>'chapter'), sort = coalesce((a->>'sort')::int, sort)
      where id = v_old.id;
      v_changed := v_changed || v_old.id; v_chg := v_chg + 1;
    else
      update articles set title = a->>'title', sort = coalesce((a->>'sort')::int, sort),
        chapter_id = (select id from chapters where document_id = v_doc and number = a->>'chapter')
      where id = v_old.id;
      v_same := v_same + 1;
    end if;
  end loop;

  -- Yangi matnda yo'q moddalar — bekor qilingan
  with gone as (
    update articles set status = 'repealed', updated_at = now()
    where document_id = v_doc and status <> 'repealed' and not (number = any (v_seen))
    returning id
  )
  select coalesce(array_agg(id), '{}'), count(*) into v_repealed, v_rep from gone;

  -- O'zgargan/bekor qilingan moddaga bog'langan e'lon qilingan savollar — tekshiruvga
  if not v_created and (cardinality(v_changed) > 0 or cardinality(v_repealed) > 0) then
    with flagged as (
      update questions set status = 'review'
      where status = 'published' and article_ids && (v_changed || v_repealed)
      returning id
    )
    select count(*) into v_flag from flagged;
  end if;

  return jsonb_build_object('document_id', v_doc, 'created', v_created, 'inserted', v_ins, 'changed', v_chg,
    'repealed', v_rep, 'unchanged', v_same, 'questions_flagged', v_flag);
end $$;
revoke all on function public.import_law_document(jsonb) from public, anon, authenticated;
grant execute on function public.import_law_document(jsonb) to service_role;

-- Teng mos kelganda Konstitutsiya va kodeks moddalari oldinroq chiqadi
create or replace function public.search_articles(p_query text, p_field text default null, p_limit int default 6)
returns table (id bigint, document_id int, number text, title text, body text, doc_title text, field_slug text, rank real)
language sql stable security definer set search_path = public as $$
  with words as (
    select distinct left(w, 5) as w
    from regexp_split_to_table(lower(translate(coalesce(p_query, ''), '‘’ʼʻ`''', '')), '[^a-zа-яёўқғҳ0-9]+') as w
    where char_length(w) >= 4
    limit 12
  ), q as (
    select to_tsquery('simple', string_agg(w || ':*', ' | ')) as tsq from words having count(*) > 0
  )
  select a.id, a.document_id, a.number, a.title, a.body, d.short_title, f.slug,
         ((ts_rank(to_tsvector('simple', coalesce(a.title, '') || ' ' || a.body), q.tsq)
          + 2 * ts_rank(to_tsvector('simple', coalesce(a.title, '')), q.tsq))
          * case d.kind when 'constitution' then 1.3 when 'code' then 1.15 else 1 end)::real as rank
  from q, articles a
  join documents d on d.id = a.document_id
  left join fields f on f.id = d.field_id
  where a.status <> 'repealed'
    and to_tsvector('simple', coalesce(a.title, '') || ' ' || a.body) @@ q.tsq
    and (p_field is null or f.slug = p_field)
  order by rank desc, a.id
  limit least(greatest(p_limit, 1), 20)
$$;
revoke all on function public.search_articles(text, text, int) from public, anon, authenticated;
grant execute on function public.search_articles(text, text, int) to service_role;
