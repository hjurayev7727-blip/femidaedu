// data/v1/bundle.json → SQL → PGlite: import butunligi, idempotentlik va xavfsizlik.
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { bundleToSql } from "../scripts/import/sql";
import { gradeResponse, type Answer, type Payload, type QuestionType } from "@/lib/questions";
import { createTestDb, loadBundle } from "./helpers/db";

const bundle = loadBundle();
let db: PGlite;

async function runImport() {
  for (const stmt of bundleToSql(bundle)) await db.exec(stmt);
}

beforeAll(async () => {
  db = await createTestDb();
  await runImport();
}, 60_000);

const count = async (sql: string) => (await db.query<{ n: number }>(sql)).rows[0].n;

describe("v1 import", () => {
  it("52 hujjat, barcha savollar yuklandi va e'lon qilingan", async () => {
    expect(await count(`select count(*)::int as n from public.documents`)).toBe(52);
    expect(await count(`select count(*)::int as n from public.questions`)).toBe(bundle.questions.length);
    expect(bundle.questions.length).toBeGreaterThan(3000);
    expect(await count(`select count(*)::int as n from public.questions where status <> 'published'`)).toBe(0);
  });

  it("har bir savol mavzuga bog'langan; hujjat mavzulari modul ostida", async () => {
    expect(await count(`select count(*)::int as n from public.questions where topic_id is null`)).toBe(0);
    expect(
      await count(`select count(*)::int as n from public.topics where slug like 'hujjat-%' and parent_id is null`),
    ).toBe(0);
    expect(await count(`select count(*)::int as n from public.topics where slug like 'hujjat-%'`)).toBe(52);
  });

  it("qayta import — dublikat yaratmaydi (idempotent)", async () => {
    await runImport();
    expect(await count(`select count(*)::int as n from public.questions`)).toBe(bundle.questions.length);
    expect(await count(`select count(*)::int as n from public.topics`)).toBe(bundle.topics.length);
  });

  it("admin tahrir qilgan savol qayta importda o'zgarmaydi", async () => {
    const key = bundle.questions[0].legacyKey;
    await db.query(`update public.questions set stem = 'TAHRIRLANGAN', version = 2 where legacy_key = $1`, [key]);
    await runImport();
    const { rows } = await db.query<{ stem: string }>(`select stem from public.questions where legacy_key = $1`, [key]);
    expect(rows[0].stem).toBe("TAHRIRLANGAN");
  });

  it("bazadagi to'g'ri javob bilan tekshiruv to'g'ri ishlaydi (har turdan namuna)", async () => {
    const { rows } = await db.query<{ type: QuestionType; payload: Payload; answer: Answer }>(
      `select distinct on (type) type, payload, answer from public.questions order by type, id`,
    );
    expect(rows.length).toBeGreaterThanOrEqual(6);
    for (const r of rows) {
      const a = r.answer as Record<string, unknown>;
      const response =
        "index" in a ? { index: a.index as number }
        : "map" in a ? { map: a.map as number[] }
        : "order" in a ? { order: a.order as number[] }
        : { text: (a.accepted as string[])[0] };
      expect(gradeResponse(r.type, r.payload, r.answer, response).correct, r.type).toBe(true);
    }
  });

  it("o'quvchi javobni ko'ra olmaydi, lekin savolni ko'radi", async () => {
    await db.exec(`insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'x@x.uz')`);
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);`);
    try {
      expect(await count(`select count(*)::int as n from public.questions`)).toBe(bundle.questions.length);
      await expect(db.query(`select answer from public.questions limit 1`)).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec(`reset role`);
    }
  });
});
