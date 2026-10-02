// Sohalar katalogi: bepul qoidasi, modda → mashq (Premium qulfi), progress trigger'i, soha va hujjat ko'rsatkichlari.
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDb } from "./helpers/db";

let db: PGlite;
const U = "00000000-0000-0000-0000-00000000f001";
let art: Record<string, number> = {};
let docId = 0;

async function importDoc(code: string, field: string, chapters: [string, string[]][]) {
  const payload = {
    code, title: code, field,
    chapters: chapters.map(([n], i) => ({ number: n, title: `Bob ${n}`, sort: i + 1 })),
    articles: chapters.flatMap(([ch, nums]) => nums.map((n) => ({ number: n, title: `M${n}`, body: `Matn ${code} ${n}`, chapter: ch }))).map((a, i) => ({ ...a, sort: i + 1 })),
  };
  const { rows } = await db.query<{ r: { document_id: number } }>(`select public.import_law_document($1::jsonb) as r`, [JSON.stringify(payload)]);
  return rows[0].r.document_id;
}
const startPractice = (article: number, premium: boolean) =>
  db.query<{ id: string }>(`select public.start_article_practice($1, $2, 10, $3) as id`, [U, article, premium]);

beforeAll(async () => {
  db = await createTestDb();
  await db.query(`insert into auth.users (id, email) values ($1, 'f@x.uz')`, [U]);
  docId = await importDoc("MK", "mehnat", [["1", ["1", "2"]], ["2", ["3", "4"]]]);
  await importDoc("BK", "bojxona", [["1", ["1"]], ["2", ["2"]]]);
  const { rows } = await db.query<{ code: string; number: string; id: number }>(`select d.code, a.number, a.id from articles a join documents d on d.id = a.document_id`);
  art = Object.fromEntries(rows.map((r) => [`${r.code}${r.number}`, r.id]));
  await db.query(`insert into questions (type, stem, answer, status, article_ids) values
    ('single', 'S1', '{}', 'published', $1), ('single', 'S2', '{}', 'published', $1), ('single', 'S3', '{}', 'published', $2), ('single', 'S4', '{}', 'draft', $3)`,
    [[art.MK1], [art.MK3], [art.MK2]]);
});

describe("sohalar katalogi", () => {
  it("bepul: 1-bob va C soha; A sohaning 2-bobi — Premium", async () => {
    const free = async (id: number) => (await db.query<{ f: boolean }>(`select public.article_is_free($1) as f`, [id])).rows[0].f;
    expect(await free(art.MK1)).toBe(true);
    expect(await free(art.MK3)).toBe(false);
    expect(await free(art.BK2)).toBe(true);
  });

  it("modda bo'yicha mashq: e'lon qilingan savollar, Premium qulfi, savolsiz modda", async () => {
    const { rows } = await startPractice(art.MK1, false);
    const q = await db.query<{ n: number }>(`select cardinality(question_ids) as n from attempts where id = $1`, [rows[0].id]);
    expect(q.rows[0].n).toBe(2);
    await expect(startPractice(art.MK3, false)).rejects.toThrow(/premium_required/);
    expect((await startPractice(art.MK3, true)).rows[0].id).toBeTruthy();
    await expect(startPractice(art.MK2, true)).rejects.toThrow(/no_questions/);
  });

  it("oddiy foydalanuvchi mashqni to'g'ridan-to'g'ri ocha olmaydi (Premium'ni o'zi e'lon qilib bo'lmaydi)", async () => {
    await expect(asUser(db, U, () => startPractice(art.MK3, true))).rejects.toThrow(/permission denied/);
  });

  it("javob yozilganda modda progressi yangilanadi, o'zlashtirish 2 to'g'ri + 2/3", async () => {
    const { rows } = await startPractice(art.MK1, false);
    const qs = (await db.query<{ id: number }>(`select id from questions where stem in ('S1','S2') order by stem`)).rows;
    await db.query(`insert into attempt_answers (attempt_id, question_id, response, is_correct) values ($1, $2, '{}', true), ($1, $3, '{}', true)`, [rows[0].id, qs[0].id, qs[1].id]);
    const p = await db.query<{ seen: number; correct: number }>(`select seen, correct from article_progress where user_id = $1 and article_id = $2`, [U, art.MK1]);
    expect(p.rows[0]).toEqual({ seen: 2, correct: 2 });
    const ov = await asUser(db, U, async () => (await db.query<{ slug: string; articles: number; mastered: number; questions: number; documents: number }>(`select * from public.field_overview() where slug in ('mehnat', 'bojxona') order by slug`)).rows);
    expect(ov).toEqual([
      expect.objectContaining({ slug: "bojxona", documents: 1, articles: 2, mastered: 0, questions: 0 }),
      expect.objectContaining({ slug: "mehnat", documents: 1, articles: 4, mastered: 1, questions: 3 }),
    ]);
  });

  it("hujjat moddalari: savollar soni, progress va bepullik", async () => {
    const rows = await asUser(db, U, async () => (await db.query<{ number: string; questions: number; correct: number; free: boolean }>(`select number, questions, correct, free from public.document_articles($1)`, [docId])).rows);
    expect(rows.map((r) => [r.number, r.questions, r.correct, r.free])).toEqual([["1", 2, 2, true], ["2", 0, 0, true], ["3", 1, 0, false], ["4", 0, 0, false]]);
  });
});
