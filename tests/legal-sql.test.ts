// "Savol bering" (pivot, 3-bosqich): yangi suhbat rejimlari, hujjat limiti, yuklash havolalari jadvali.
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDb } from "./helpers/db";

let db: PGlite;
const U = "00000000-0000-0000-0000-0000000c0001";
const V = "00000000-0000-0000-0000-0000000c0002";

beforeAll(async () => {
  db = await createTestDb();
  await db.query(`insert into auth.users (id, email) values ($1, 'u@x.uz'), ($2, 'v@x.uz')`, [U, V]);
}, 60_000);

describe("suhbat rejimlari", () => {
  it("legal va document qabul qilinadi, boshqasi — yo'q; soha slug shakli tekshiriladi", async () => {
    for (const mode of ["legal", "document", "explain", "case"]) {
      await db.query(`insert into tutor_threads (user_id, mode, title, field) values ($1, $2, 'T', 'mehnat')`, [U, mode]);
    }
    await expect(db.query(`insert into tutor_threads (user_id, mode, title) values ($1, 'lawyer', 'T')`, [U])).rejects.toThrow(/check/);
    await expect(db.query(`insert into tutor_threads (user_id, mode, title, field) values ($1, 'legal', 'T', 'Mehnat; drop')`, [U])).rejects.toThrow(/check/);
  });

  it("javob belgilari: ishonch, yurist kerakligi, doc_meta (faqat obyekt, kichik)", async () => {
    const t = (await db.query<{ id: string }>(`insert into tutor_threads (user_id, mode, title) values ($1, 'document', 'Hujjat') returning id`, [U])).rows[0].id;
    await db.query(
      `insert into tutor_messages (thread_id, role, content, doc_meta) values ($1, 'user', 'tahlil', '{"name":"ijara.pdf","pages":3}')`, [t]);
    await db.query(`insert into tutor_messages (thread_id, role, content, confidence, needs_lawyer) values ($1, 'assistant', 'javob', 'low', true)`, [t]);
    const r = await db.query<{ confidence: string | null; needs_lawyer: boolean }>(`select confidence, needs_lawyer from tutor_messages where thread_id = $1 order by id`, [t]);
    expect(r.rows).toEqual([{ confidence: null, needs_lawyer: false }, { confidence: "low", needs_lawyer: true }]);
    await expect(db.query(`insert into tutor_messages (thread_id, role, content, confidence) values ($1, 'assistant', 'x', 'unsure')`, [t])).rejects.toThrow(/check/);
    await expect(db.query(`insert into tutor_messages (thread_id, role, content, doc_meta) values ($1, 'user', 'x', '[1]')`, [t])).rejects.toThrow(/check/);
    await expect(db.query(`insert into tutor_messages (thread_id, role, content, doc_meta) values ($1, 'user', 'x', $2::jsonb)`,
      [t, JSON.stringify({ name: "x".repeat(3000) })])).rejects.toThrow(/check/);
  });
});

describe("hujjat tahlili limiti", () => {
  it("savollar limitidan alohida, atomar, qaytariladi", async () => {
    const q = () => db.query<{ r: number | null }>(`select public.consume_doc_quota($1, 2) as r`, [V]).then((x) => x.rows[0].r);
    expect(await q()).toBe(1);
    expect(await q()).toBe(2);
    expect(await q()).toBeNull();
    await db.query(`select public.refund_doc_quota($1)`, [V]);
    expect(await q()).toBe(2);
    const w = (await db.query<{ tutor: number; docs: number }>(`select tutor, docs from ai_weekly where user_id = $1`, [V])).rows[0];
    expect(w).toEqual(expect.objectContaining({ tutor: 0, docs: 2 }));
  });

  it("klient limit funksiyalarini chaqira olmaydi", async () => {
    await expect(asUser(db, V, () => db.query(`select public.consume_doc_quota($1, 100)`, [V]))).rejects.toThrow(/permission denied/);
    await expect(asUser(db, V, () => db.query(`select public.refund_doc_quota($1)`, [V]))).rejects.toThrow(/permission denied/);
  });
});

describe("legal_uploads", () => {
  it("yo'l shakli: foydalanuvchi papkasi + uuid + ruxsat etilgan kengaytma", async () => {
    await db.query(`insert into legal_uploads (path, user_id) values ($1, $2)`, [`${U}/11111111-1111-1111-1111-111111111111.pdf`, U]);
    await expect(db.query(`insert into legal_uploads (path, user_id) values ($1, $2)`, [`${U}/../x.pdf`, U])).rejects.toThrow(/check/);
    await expect(db.query(`insert into legal_uploads (path, user_id) values ($1, $2)`, [`${U}/11111111-1111-1111-1111-111111111112.exe`, U])).rejects.toThrow(/check/);
  });

  it("klient jadvalni ko'ra ham, yoza ham olmaydi", async () => {
    await expect(asUser(db, U, () => db.query(`select * from legal_uploads`))).rejects.toThrow(/permission denied/);
    await expect(asUser(db, U, () => db.query(`insert into legal_uploads (path, user_id) values ($1, $2)`,
      [`${U}/11111111-1111-1111-1111-111111111113.pdf`, U]))).rejects.toThrow(/permission denied/);
  });
});
