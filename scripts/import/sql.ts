// To'plam → idempotent SQL. Bir xil SQL testda (PGlite) va haqiqiy bazada (npm run db:import) ishlaydi.
import type { Bundle } from "./bundle";

const lit = (v: string | null | undefined) => (v == null ? "null" : `'${v.replace(/'/g, "''")}'`);
const json = (v: unknown) => `${lit(JSON.stringify(v))}::jsonb`;
const num = (v: number | null | undefined) => (v == null ? "null" : String(v));

function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function bundleToSql(bundle: Bundle): string[] {
  const stmts: string[] = [];

  stmts.push(
    `insert into public.documents (number, code, title, short_title, priority, module) values\n` +
      bundle.documents
        .map((d) => `(${d.number}, ${lit(d.code)}, ${lit(d.title)}, ${lit(d.shortTitle)}, ${lit(d.priority)}, ${d.module})`)
        .join(",\n") +
      `\non conflict (number) do update set code = excluded.code, title = excluded.title,
  short_title = excluded.short_title, priority = excluded.priority, module = excluded.module;`,
  );

  // Mavzular: avval hammasi (ota-onasiz), keyin ota-ona bog'lanishi — tartibga bog'liq bo'lmasin
  stmts.push(
    `insert into public.topics (slug, title, sort, document_id) values\n` +
      bundle.topics
        .map((t) => `(${lit(t.slug)}, ${lit(t.title)}, ${Math.round(t.sort * 100)}, ${t.documentNumber == null ? "null" : `(select id from public.documents where number = ${t.documentNumber})`})`)
        .join(",\n") +
      `\non conflict (slug) do update set title = excluded.title, sort = excluded.sort, document_id = excluded.document_id;`,
  );
  const withParent = bundle.topics.filter((t) => t.parentSlug);
  if (withParent.length) {
    stmts.push(
      `update public.topics t set parent_id = p.id from (values\n` +
        withParent.map((t) => `(${lit(t.slug)}, ${lit(t.parentSlug)})`).join(",\n") +
        `\n) as v(slug, parent_slug) join public.topics p on p.slug = v.parent_slug where t.slug = v.slug;`,
    );
  }

  // Savollar: faqat hali tahrir qilinmagan (version = 1, source = import) importlar yangilanadi —
  // admin panelda tuzatilgan savol qayta importda eski holatiga qaytmaydi.
  for (const part of chunks(bundle.questions, 250)) {
    stmts.push(
      `insert into public.questions (legacy_key, type, stem, context, payload, answer, explanation, source_note,
  difficulty, document_id, topic_id, status, source) values\n` +
        part
          .map(
            (q) =>
              `(${lit(q.legacyKey)}, ${lit(q.type)}, ${lit(q.stem)}, ${lit(q.context)}, ${json(q.payload)}, ${json(q.answer)}, ` +
              `${lit(q.explanation)}, ${lit(q.sourceNote)}, ${num(q.difficulty)}, ` +
              `${q.documentNumber == null ? "null" : `(select id from public.documents where number = ${q.documentNumber})`}, ` +
              `${q.topicSlug == null ? "null" : `(select id from public.topics where slug = ${lit(q.topicSlug)})`}, 'published', 'import')`,
          )
          .join(",\n") +
        `\non conflict (legacy_key) do update set type = excluded.type, stem = excluded.stem, context = excluded.context,
  payload = excluded.payload, answer = excluded.answer, explanation = excluded.explanation,
  source_note = excluded.source_note, difficulty = excluded.difficulty, document_id = excluded.document_id,
  topic_id = excluded.topic_id
where public.questions.source = 'import' and public.questions.version = 1;`,
    );
  }
  return stmts;
}
