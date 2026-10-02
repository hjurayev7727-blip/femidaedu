// Yuristlar katalogi: profil, kontaktlar sizib chiqmasligi, tartib (tasdiqlangan oldin), bloklash, tasdiqlash, shikoyat limiti.
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDb } from "./helpers/db";

let db: PGlite;
const ADMIN = "00000000-0000-0000-0000-0000000e0001";
const L1 = "00000000-0000-0000-0000-0000000e0002";
const L2 = "00000000-0000-0000-0000-0000000e0003";
const C = "00000000-0000-0000-0000-0000000e0004";
type J = Record<string, unknown>;
const one = async <T = J>(sql: string, params: unknown[] = []) => (await db.query<{ r: T }>(sql, params)).rows[0]?.r;
const upsert = (u: string, p: J) => one(`select public.upsert_lawyer_profile($1, $2::jsonb) as r`, [u, JSON.stringify(p)]);
const catalog = (field: string | null = null, region: string | null = null, q: string | null = null) =>
  one<{ total: number; items: J[] }>(`select public.lawyer_catalog($1, $2, $3, 20, 0) as r`, [field, region, q]);

beforeAll(async () => {
  db = await createTestDb();
  await db.query(`insert into auth.users (id, email) values ($1, 'a@x.uz'), ($2, 'l1@x.uz'), ($3, 'l2@x.uz'), ($4, 'c@x.uz')`, [ADMIN, L1, L2, C]);
  await db.query(`update profiles set role = 'admin' where id = $1`, [ADMIN]);
});

describe("yuristlar katalogi", () => {
  it("profil: soha tekshiruvi, telefon formati", async () => {
    expect(await upsert(L1, { display_name: "Aziz Karimov", fields: ["yo'q-soha"] })).toEqual({ ok: false, reason: "fields" });
    await expect(upsert(L1, { display_name: "Aziz Karimov", fields: ["mehnat"], phone: "998901234567" })).rejects.toThrow(/check/);
    expect(await upsert(L1, { display_name: "Aziz Karimov", fields: ["mehnat", "fuqarolik"], region: "Toshkent shahri", phone: "+998901234567", telegram: "aziz_yurist", payout_card: "8600123412341234" })).toEqual({ ok: true });
    expect(await upsert(L2, { display_name: "Dilnoza Rahimova", fields: ["oila"], region: "Samarqand viloyati" })).toEqual({ ok: true });
  });

  it("katalog kontakt va kartani qaytarmaydi; filtrlar", async () => {
    const all = await catalog();
    expect(all?.total).toBe(2);
    const text = JSON.stringify(all);
    expect(text).not.toContain("998901234567");
    expect(text).not.toContain("aziz_yurist");
    expect(text).not.toContain("8600");
    expect(all?.items.find((i) => i.display_name === "Aziz Karimov")).toMatchObject({ has_contacts: true });
    expect((await catalog("oila"))?.items.map((i) => i.display_name)).toEqual(["Dilnoza Rahimova"]);
    expect((await catalog(null, "Toshkent shahri"))?.total).toBe(1);
    expect((await catalog(null, null, "dil"))?.total).toBe(1);
    expect((await catalog(null, null, "%"))?.total).toBe(2);
  });

  it("tasdiqlash: faqat admin; tasdiqlangan birinchi chiqadi", async () => {
    expect(await one(`select public.submit_lawyer_verification($1, 'AB-123', $2) as r`, [L2, `${L1}/x.jpg`])).toEqual({ ok: false, reason: "path" });
    expect(await one(`select public.submit_lawyer_verification($1, 'AB-123', $2) as r`, [L2, `${L2}/x.jpg`])).toEqual({ ok: true });
    expect(await one(`select public.submit_lawyer_verification($1, 'AB-123', $2) as r`, [L2, `${L2}/y.jpg`])).toEqual({ ok: false, reason: "pending" });
    const vid = (await db.query<{ id: number }>(`select id from lawyer_verifications where user_id = $1`, [L2])).rows[0].id;
    expect(await one(`select public.review_lawyer_verification($1, $2, true, null) as r`, [C, vid])).toEqual({ ok: false, reason: "forbidden" });
    expect(await one(`select public.review_lawyer_verification($1, $2, true, null) as r`, [ADMIN, vid])).toMatchObject({ ok: true });
    const items = (await catalog())?.items ?? [];
    expect(items.map((i) => [i.display_name, i.verified])).toEqual([["Dilnoza Rahimova", true], ["Aziz Karimov", false]]);
  });

  it("egasining kabineti: karta faqat oxirgi 4 raqam", async () => {
    const me = await one<J>(`select public.my_lawyer_profile($1) as r`, [L1]);
    expect(me).toMatchObject({ payout_card_last4: "1234", phone: "+998901234567" });
    expect(me).not.toHaveProperty("payout_card");
  });

  it("shikoyat: o'ziga emas, takrorsiz, kuniga 5 ta; bloklangan katalogda yo'q va tahrirlay olmaydi", async () => {
    expect(await one(`select public.report_lawyer($1, $1, 'Sababsiz shikoyat matni') as r`, [L1])).toEqual({ ok: false, reason: "self" });
    expect(await one(`select public.report_lawyer($1, $2, 'Pul olib, ishni qilmadi') as r`, [C, L1])).toEqual({ ok: true });
    await one(`select public.report_lawyer($1, $2, 'Yana bir marta yozyapman') as r`, [C, L1]);
    expect((await db.query(`select 1 from lawyer_reports where lawyer_id = $1`, [L1])).rows).toHaveLength(1);
    const q = await one<{ reports: J[] }>(`select public.lawyer_admin_queue($1) as r`, [ADMIN]);
    expect(q?.reports).toHaveLength(1);
    expect(await one(`select public.lawyer_admin_queue($1) as r`, [C])).toBeNull();

    expect(await one(`select public.set_lawyer_status($1, $2, 'blocked') as r`, [C, L1])).toBe(false);
    expect(await one(`select public.set_lawyer_status($1, $2, 'blocked') as r`, [ADMIN, L1])).toBe(true);
    expect((await catalog())?.total).toBe(1);
    expect(await one(`select public.lawyer_public($1, $2) as r`, [C, L1])).toBeNull();
    expect(await one(`select public.lawyer_public($1, $2) as r`, [L1, L1])).toMatchObject({ status: "blocked" });
    expect(await upsert(L1, { display_name: "Aziz Karimov", fields: ["mehnat"] })).toEqual({ ok: false, reason: "blocked" });
  });

  it("klient jadval va funksiyalarga to'g'ridan-to'g'ri kira olmaydi", async () => {
    await expect(asUser(db, C, () => db.query(`select * from lawyer_profiles`))).rejects.toThrow(/permission denied/);
    await expect(asUser(db, C, () => db.query(`select public.lawyer_catalog(null, null, null, 5, 0)`))).rejects.toThrow(/permission denied/);
  });
});
