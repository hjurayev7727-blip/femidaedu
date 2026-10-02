// import_law_document: yangi hujjat, qayta import, o'zgargan/bekor qilingan modda va savollarni tekshiruvga qaytarish.
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDb } from "./helpers/db";

let db: PGlite;
type R = { document_id: number; created: boolean; inserted: number; changed: number; repealed: number; unchanged: number; questions_flagged: number };

const doc = (articles: { number: string; body: string }[]) => ({
  code: "MK", title: "Mehnat kodeksi", short_title: "Mehnat kodeksi", field: "mehnat", lex_id: "6257288",
  chapters: [{ number: "1", title: "Asosiy qoidalar", sort: 1 }],
  articles: articles.map((a, i) => ({ ...a, title: `Modda ${a.number}`, chapter: "1", sort: i + 1 })),
});
const imp = async (p: unknown) => (await db.query<{ r: R }>(`select public.import_law_document($1::jsonb) as r`, [JSON.stringify(p)])).rows[0].r;
const ids = async () => Object.fromEntries((await db.query<{ number: string; id: number }>(`select number, id from articles where document_id = (select id from documents where code = 'MK')`)).rows.map((r) => [r.number, r.id]));

beforeAll(async () => {
  db = await createTestDb();
});

describe("qonun bazasi", () => {
  it("soha katalogi: 18 ta soha, A darajada 6 ta", async () => {
    const { rows } = await db.query<{ priority: string; n: number }>(`select priority, count(*)::int as n from fields group by priority order by priority`);
    expect(rows).toEqual([{ priority: "A", n: 6 }, { priority: "B", n: 6 }, { priority: "C", n: 6 }]);
  });

  it("birinchi import: hujjat 100 dan keyingi raqam bilan, sohaga bog'lanadi, lex havolasi bilan", async () => {
    const r = await imp(doc([{ number: "1", body: "Birinchi modda matni." }, { number: "2", body: "Ikkinchi." }, { number: "3", body: "Uchinchi." }]));
    expect(r).toMatchObject({ created: true, inserted: 3, changed: 0, repealed: 0, questions_flagged: 0 });
    const { rows } = await db.query<{ number: number; lex_url: string; slug: string }>(`select d.number, d.lex_url, f.slug from documents d join fields f on f.id = d.field_id where d.code = 'MK'`);
    expect(rows[0].number).toBeGreaterThan(100);
    expect(rows[0]).toMatchObject({ lex_url: "https://lex.uz/docs/-6257288", slug: "mehnat" });
    const ch = await db.query<{ n: number }>(`select count(*)::int as n from articles a join chapters c on c.id = a.chapter_id where c.number = '1'`);
    expect(ch.rows[0].n).toBe(3);
  });

  it("qayta import: bo'shliq/apostrof farqi o'zgarish emas", async () => {
    const r = await imp(doc([{ number: "1", body: "Birinchi   modda\nmatni." }, { number: "2", body: "Ikkinchi." }, { number: "3", body: "Uchinchi." }]));
    expect(r).toMatchObject({ created: false, inserted: 0, changed: 0, repealed: 0, unchanged: 3 });
  });

  it("o'zgargan va bekor qilingan moddaga bog'langan e'lon qilingan savollar tekshiruvga qaytadi", async () => {
    const a = await ids();
    await db.query(
      `insert into questions (type, stem, answer, status, article_ids) values
         ('single', 'Q1', '{}', 'published', $1), ('single', 'Q2', '{}', 'published', $2),
         ('single', 'Q3', '{}', 'published', $3), ('single', 'Q4', '{}', 'draft', $1)`,
      [[a["1"]], [a["2"]], [a["3"]]],
    );
    const r = await imp(doc([{ number: "1", body: "Birinchi modda YANGI tahrirda." }, { number: "3", body: "Uchinchi." }, { number: "4", body: "Yangi modda." }]));
    expect(r).toMatchObject({ inserted: 1, changed: 1, repealed: 1, unchanged: 1, questions_flagged: 2 });
    const st = await db.query<{ stem: string; status: string }>(`select stem, status from questions where stem like 'Q%' order by stem`);
    expect(st.rows.map((q) => q.status)).toEqual(["review", "review", "published", "draft"]);
    const art = await db.query<{ number: string; status: string }>(`select number, status from articles where document_id = (select id from documents where code = 'MK') order by sort, number`);
    expect(Object.fromEntries(art.rows.map((x) => [x.number, x.status]))).toEqual({ "1": "changed", "2": "repealed", "3": "active", "4": "active" });
  });

  it("bekor qilingan modda qaytsa — 'changed'", async () => {
    const r = await imp(doc([{ number: "1", body: "Birinchi modda YANGI tahrirda." }, { number: "2", body: "Ikkinchi." }, { number: "3", body: "Uchinchi." }, { number: "4", body: "Yangi modda." }]));
    expect(r).toMatchObject({ changed: 1, repealed: 0 });
  });

  it("bo'sh modda ro'yxati bilan import to'xtaydi (hammasini bekor qilib yubormaslik uchun)", async () => {
    await expect(imp({ ...doc([]), articles: [] })).rejects.toThrow(/moddalar topilmadi/);
    await expect(imp({ ...doc([{ number: "1", body: "x" }]), field: "yoq" })).rejects.toThrow(/soha topilmadi/);
  });

  it("oddiy foydalanuvchi import qila olmaydi, lekin sohalar va boblarni o'qiy oladi", async () => {
    const uid = "00000000-0000-0000-0000-00000000a001";
    await db.query(`insert into auth.users (id, email) values ($1, 'u@x.uz')`, [uid]);
    await expect(asUser(db, uid, () => imp(doc([{ number: "1", body: "x" }])))).rejects.toThrow(/permission denied/);
    const n = await asUser(db, uid, async () => (await db.query<{ n: number }>(`select (select count(*) from fields) + (select count(*) from chapters) as n`)).rows[0].n);
    expect(Number(n)).toBeGreaterThan(18);
  });

  it("hujjat turi: qonun va Konstitutsiya; noto'g'ri tur rad etiladi; teng moslikda Konstitutsiya oldin", async () => {
    const body = "Har kim mulkdor bo'lishga haqli. Mulk huquqi qonun bilan qo'riqlanadi.";
    const mk = (code: string, kind: string, field: string) => ({
      code, kind, field, title: code, short_title: code, articles: [{ number: "1", title: "Mulk huquqi", body, sort: 1 }],
    });
    await imp(mk("ISTEMOL", "law", "istemolchi"));
    await imp(mk("KONST2", "constitution", "konstitutsiyaviy"));
    const { rows } = await db.query<{ code: string; kind: string }>(`select code, kind from documents where code in ('ISTEMOL', 'KONST2') order by code`);
    expect(rows).toEqual([{ code: "ISTEMOL", kind: "law" }, { code: "KONST2", kind: "constitution" }]);
    await expect(imp(mk("X1", "decree", "oila"))).rejects.toThrow(/turi/);
    const s = await db.query<{ doc_title: string }>(`select doc_title from public.search_articles('mulk huquqi qo''riqlanadi', null, 2)`);
    expect(s.rows.map((r) => r.doc_title)).toEqual(["KONST2", "ISTEMOL"]);
  });
});
