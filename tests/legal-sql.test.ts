// "Savol bering": yangi suhbat rejimlari, hujjat limiti (atomar), yurist tugmasi sozlamasi, ruxsatlar.
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDb } from "./helpers/db";

let db: PGlite;
const U = "00000000-0000-0000-0000-0000000d0001";

beforeAll(async () => {
  db = await createTestDb();
  await db.query(`insert into auth.users (id, email) values ($1, 'u@x.uz')`, [U]);
});

describe("huquqiy savol-javob", () => {
  it("legal va document rejimlari; noma'lum rejim rad etiladi", async () => {
    const t = await db.query<{ id: string }>(`insert into tutor_threads (user_id, mode, title, field) values ($1, 'legal', 'Ish haqi', 'mehnat') returning id`, [U]);
    await db.query(`insert into tutor_threads (user_id, mode, title) values ($1, 'document', 'Ijara')`, [U]);
    await expect(db.query(`insert into tutor_threads (user_id, mode, title) values ($1, 'chat', 'x')`, [U])).rejects.toThrow(/check/);
    await expect(db.query(`insert into tutor_threads (user_id, mode, title, field) values ($1, 'legal', 'x', 'Bad Field!')`, [U])).rejects.toThrow(/check/);
    await db.query(`insert into tutor_messages (thread_id, role, content, confidence, needs_lawyer, doc_meta) values ($1, 'assistant', 'j', 'low', true, '{"type":"pdf","pages":2,"name":"a.pdf"}')`, [t.rows[0].id]);
    await expect(db.query(`insert into tutor_messages (thread_id, role, content, confidence) values ($1, 'assistant', 'j', 'sure')`, [t.rows[0].id])).rejects.toThrow(/check/);
  });

  it("hujjat limiti: chegaragacha, keyin null; qaytarish; savol limitidan alohida", async () => {
    const take = async () => (await db.query<{ n: number | null }>(`select public.consume_doc_quota($1, 2) as n`, [U])).rows[0].n;
    expect(await take()).toBe(1);
    expect(await take()).toBe(2);
    expect(await take()).toBeNull();
    await db.query(`select public.refund_doc_quota($1)`, [U]);
    expect(await take()).toBe(2);
    const w = await db.query<{ tutor: number; docs: number }>(`select tutor, docs from ai_weekly where user_id = $1`, [U]);
    expect(w.rows[0]).toEqual({ tutor: 0, docs: 2 });
  });

  it("yuristlar bo'limi standart holatda o'chiq; klient limit funksiyasini chaqira olmaydi", async () => {
    const s = await db.query<{ value: unknown }>(`select value from app_settings where key = 'lawyers_enabled'`);
    expect(s.rows[0].value).toBe(false);
    await expect(asUser(db, U, () => db.query(`select public.consume_doc_quota($1, 100)`, [U]))).rejects.toThrow(/permission denied/);
  });
});
