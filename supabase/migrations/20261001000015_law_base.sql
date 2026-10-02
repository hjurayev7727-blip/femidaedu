-- Qonun bazasi (V3, 2-qism): huquq sohalari, hujjat → bob → modda, lex.uz'dan qayta import va o'zgarishni aniqlash.
-- Modda matni o'zgarsa — unga bog'langan savollar tekshiruvga qaytadi; modda bekor qilinsa — muomaladan olinadi.

-- ─────────────────────────── Huquq sohalari ───────────────────────────
create table public.fields (
  id        serial primary key,
  slug      text not null unique,
  title     text not null,
  priority  char(1) not null check (priority in ('A', 'B', 'C')),   -- A — to'liq, B — asosiy boblar, C — umumiy tanishuv
  color     text not null default '#1e3a66',
  icon      text not null default '⚖️',
  sort      int not null default 0
);

insert into public.fields (slug, title, priority, color, icon, sort) values
  ('fuqarolik',            'Fuqarolik huquqi',               'A', '#1e3a66', '🤝', 10),
  ('oila',                 'Oila huquqi',                    'A', '#8a3b5c', '👪', 20),
  ('jinoyat',              'Jinoyat huquqi',                 'A', '#7a1f2b', '⚖️', 30),
  ('jinoyat-protsessual',  'Jinoyat-protsessual huquqi',     'A', '#5b2a3c', '🔎', 40),
  ('mehnat',               'Mehnat huquqi',                  'A', '#1f5f4a', '💼', 50),
  ('soliq',                'Soliq huquqi',                   'A', '#6b5a1e', '🧾', 60),
  ('konstitutsiyaviy',     'Konstitutsiyaviy huquq',         'B', '#0e2340', '🏛️', 70),
  ('mamuriy',              'Ma''muriy huquq',                'B', '#3a4a6b', '📋', 80),
  ('fuqarolik-protsessual','Fuqarolik-protsessual huquqi',   'B', '#2d4f7a', '📑', 90),
  ('yer',                  'Yer huquqi',                     'B', '#4d6b2a', '🌾', 100),
  ('uy-joy',               'Uy-joy huquqi',                  'B', '#6b4a2a', '🏠', 110),
  ('istemolchi',           'Iste''molchilar huquqlari',      'B', '#2a6b6b', '🛒', 120),
  ('bojxona',              'Bojxona huquqi',                 'C', '#4a4a6b', '🛃', 130),
  ('ekologiya',            'Ekologiya huquqi',               'C', '#2a6b3a', '🌿', 140),
  ('xalqaro',              'Xalqaro huquq',                  'C', '#2a4a6b', '🌐', 150),
  ('bank',                 'Bank huquqi',                    'C', '#3a3a3a', '🏦', 160),
  ('sugurta',              'Sug''urta huquqi',               'C', '#5a3a6b', '🛡️', 170),
  ('intellektual-mulk',    'Intellektual mulk huquqi',       'C', '#6b3a2a', '💡', 180)
on conflict (slug) do nothing;

-- ─────────────────────────── Hujjat → bob → modda ───────────────────────────
alter table public.documents
  add column field_id    int references public.fields (id) on delete set null,
  add column lex_id      text unique,                       -- lex.uz hujjat raqami (masalan '6257288')
  add column fetched_at  timestamptz;                       -- oxirgi import vaqti

create table public.chapters (
  id          serial primary key,
  document_id int not null references public.documents (id) on delete cascade,
  number      text not null,                               -- '1', 'II'
  title       text,
  sort        int not null default 0,
  unique (document_id, number)
);

alter table public.articles
  add column chapter_id  int references public.chapters (id) on delete set null,
  add column body_hash   text,                             -- normallashtirilgan matn xeshi (o'zgarishni aniqlash)
  add column status      text not null default 'active' check (status in ('active', 'changed', 'repealed')),
  add column sort        int not null default 0,
  add column updated_at  timestamptz not null default now();
create index articles_doc_sort_idx on public.articles (document_id, sort);

-- ─────────────────────────── Hayotiy mavzular (fuqarolar uchun ko'rinish) ───────────────────────────
create table public.life_topics (
  id        serial primary key,
  field_id  int not null references public.fields (id) on delete cascade,
  slug      text not null unique,
  title     text not null,                                 -- "Ishdan bo'shatish", "Meros"
  sort      int not null default 0
);
create table public.life_topic_articles (
  topic_id    int not null references public.life_topics (id) on delete cascade,
  article_id  bigint not null references public.articles (id) on delete cascade,
  primary key (topic_id, article_id)
);

-- ─────────────────────────── Modda bo'yicha progress (moddalar xaritasi) ───────────────────────────
create table public.article_progress (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  article_id  bigint not null references public.articles (id) on delete cascade,
  seen        int not null default 0,
  correct     int not null default 0,
  last_at     timestamptz not null default now(),
  primary key (user_id, article_id)
);

alter table public.fields              enable row level security;
alter table public.chapters            enable row level security;
alter table public.life_topics         enable row level security;
alter table public.life_topic_articles enable row level security;
alter table public.article_progress    enable row level security;
create policy fields_read      on public.fields              for select using (true);
create policy chapters_read    on public.chapters            for select using (true);
create policy life_topics_read on public.life_topics         for select using (true);
create policy lta_read         on public.life_topic_articles for select using (true);
create policy progress_own     on public.article_progress    for select to authenticated using (user_id = auth.uid());
grant select on public.fields, public.chapters, public.life_topics, public.life_topic_articles to anon, authenticated;
grant select on public.article_progress to authenticated;
grant all on public.fields, public.chapters, public.life_topics, public.life_topic_articles, public.article_progress to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Matn xeshi: bo'shliqlar va apostrof turlari o'zgarishi "o'zgarish" hisoblanmaydi
create or replace function public.law_text_hash(p_body text) returns text
language sql immutable as $$
  select md5(lower(regexp_replace(translate(coalesce(p_body, ''), '‘’ʼʻ`´', repeat('''', 6)), '\s+', ' ', 'g')))
$$;

/**
 * Bitta hujjatni (lex.uz'dan ajratilgan) bazaga yozadi. Faqat service_role (import skripti).
 * p = { lex_id, code, title, short_title, field, revised_on,
 *       chapters: [{ number, title, sort }], articles: [{ number, title, body, chapter, sort }] }
 * Qaytaradi: { document_id, created, inserted, changed, repealed, unchanged, questions_flagged }
 */
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

  select id into v_doc from documents where (p->>'lex_id' is not null and lex_id = p->>'lex_id') or code = p->>'code' limit 1;
  if v_doc is null then
    insert into documents (number, code, title, short_title, lex_id, field_id, revised_on, lex_url, fetched_at)
    values ((select greatest(coalesce(max(number), 0), 100) + 1 from documents), p->>'code', p->>'title',
            coalesce(p->>'short_title', p->>'title'), p->>'lex_id', v_field, (p->>'revised_on')::date,
            case when p->>'lex_id' is not null then 'https://lex.uz/docs/-' || (p->>'lex_id') end, now())
    returning id into v_doc;
    v_created := true;
  else
    update documents set title = p->>'title', short_title = coalesce(p->>'short_title', short_title),
      lex_id = coalesce(p->>'lex_id', lex_id), field_id = coalesce(v_field, field_id),
      revised_on = coalesce((p->>'revised_on')::date, revised_on), fetched_at = now()
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

-- Ekspert modda o'zgarishini ko'rib chiqqach: 'changed' → 'active'
create or replace function public.ack_article_change(p_article bigint) returns boolean
language sql security definer set search_path = public as $$
  update articles set status = 'active' where id = p_article and status = 'changed'
    and public.current_role_is('reviewer', 'admin')
  returning true
$$;
revoke all on function public.ack_article_change(bigint) from public, anon;
grant execute on function public.ack_article_change(bigint) to authenticated;
