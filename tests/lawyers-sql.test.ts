// Yuristlar katalogi (pivot, 4-bosqich): profil, katalog (kontaktlar oshkor bo'lmaydi), tasdiqlash, shikoyat, admin amallari.
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDb } from "./helpers/db";

let db: PGlite;
const ADMIN = "00000000-0000-0000-0000-0000000d0001";
const A = "00000000-0000-0000-0000-0000000d0002"; // tasdiqlangan advokat
const B = "00000000-0000-0000-0000-0000000d0003"; // yuqori reytingli, tasdiqlanmagan
const C = "00000000-0000-0000-0000-0000000d0004"; // yangi
const X = "00000000-0000-0000-0000-0000000d0005"; // mijoz
const H = "00000000-0000-0000-0000-0000000d0006"; // yashirin
const D = "00000000-0000-0000-0000-0000000d0007"; // bloklanadigan
const path = (u: string, n = 1) => `${u}/11111111-1111-1111-1111-${String(n).padStart(12, "0")}.jpg`;

type R = { ok: boolean; reason?: string; [k: string]: unknown };
const rpc = async (sql: string, params: unknown[]) => (await db.query<{ r: R }>(sql, params)).rows[0].r;

const profile = (over: Record<string, unknown> = {}) => ({
  kind: "yurist", display_name: "Ali Valiyev", headline: "Mehnat nizolari", bio: "Mehnat va oila ishlari bo'yicha 7 yillik amaliyot.",
  fields: ["mehnat", "oila"], region: "Toshkent shahri", experience_years: 7, languages: ["uz", "ru"], price_from_uzs: 150000,
  phone: "+998901234567", telegram: "ali_valiyev", visible: true, ...over,
});
const upsert = (u: string, p: Record<string, unknown>) => rpc(`select public.upsert_lawyer_profile($1, $2::jsonb) as r`, [u, JSON.stringify(p)]);
const catalog = async (args: { field?: string; region?: string; q?: string; limit?: number; offset?: number } = {}) =>
  (await db.query<{ id: string; verified: boolean; rating: string | null; [k: string]: unknown }>(
    `select * from public.lawyer_catalog($1, $2, $3, $4, $5)`,
    [args.field ?? null, args.region ?? null, args.q ?? null, args.limit ?? 20, args.offset ?? 0])).rows;

beforeAll(async () => {
  db = await createTestDb();
  await db.query(`insert into auth.users (id, email) values ($1, 'a@x.uz'), ($2, 'b@x.uz'), ($3, 'c@x.uz'), ($4, 'd@x.uz'), ($5, 'x@x.uz'), ($6, 'h@x.uz'), ($7, 'dd@x.uz')`,
    [ADMIN, A, B, C, X, H, D]);
  await db.query(`update public.profiles set role = 'admin' where id = $1`, [ADMIN]);
}, 60_000);

describe("profil", () => {
  it("ro'yxatdan o'tish va tahrirlash; bayroq standart o'chiq", async () => {
    expect(await upsert(A, profile({ kind: "advokat", display_name: "Akmal Advokatov", fields: ["jinoyat"] }))).toEqual({ ok: true, created: true, unverified: false });
    expect(await upsert(B, profile({ display_name: "Bobur Yuristov", region: "Samarqand", fields: ["fuqarolik", "mehnat"] }))).toMatchObject({ ok: true });
    expect(await upsert(C, profile({ display_name: "Charos Yangi", telegram: "", languages: ["uz"] }))).toMatchObject({ ok: true });
    expect(await upsert(H, profile({ display_name: "Hilola Yashirin", visible: false }))).toMatchObject({ ok: true });
    expect(await upsert(D, profile({ display_name: "Dilshod Blok" }))).toMatchObject({ ok: true });
    expect(await upsert(C, profile({ display_name: "Charos Yangiyeva", telegram: "", languages: ["uz"] }))).toEqual({ ok: true, created: false, unverified: false });
    // sohalar katalog tartibida, tillar kanonik tartibda saqlanadi
    await upsert(H, profile({ display_name: "Hilola Yashirin", visible: false, fields: ["soliq", "fuqarolik", "mehnat"], languages: ["en", "kaa", "uz", "uz"] }));
    const h = await db.query<{ fields: string[]; languages: string[] }>(`select fields, languages from lawyer_profiles where user_id = $1`, [H]);
    expect(h.rows[0]).toEqual({ fields: ["fuqarolik", "mehnat", "soliq"], languages: ["uz", "en", "kaa"] });
    const s = await db.query<{ value: unknown }>(`select value from app_settings where key = 'lawyers_enabled'`);
    expect(s.rows[0].value).toBe(false);
  });

  it("noto'g'ri ma'lumot rad etiladi", async () => {
    const U = "00000000-0000-0000-0000-0000000d00f1";
    await db.query(`insert into auth.users (id, email) values ($1, 'f@x.uz')`, [U]);
    expect(await upsert(U, profile({ fields: ["yoq-soha"] }))).toEqual({ ok: false, reason: "fields" });
    expect(await upsert(U, profile({ fields: [] }))).toEqual({ ok: false, reason: "fields" });
    expect(await upsert(U, profile({ fields: ["mehnat", "oila", "jinoyat", "soliq", "yer", "bank"] }))).toEqual({ ok: false, reason: "fields" });
    expect(await upsert(U, profile({ phone: "", telegram: "" }))).toEqual({ ok: false, reason: "contact" });
    expect(await upsert(U, profile({ region: "Moskva" }))).toEqual({ ok: false, reason: "invalid" });
    expect(await upsert(U, profile({ phone: "12345" }))).toEqual({ ok: false, reason: "invalid" });
    expect(await upsert(U, profile({ languages: ["de"] }))).toEqual({ ok: false, reason: "invalid" });
    expect(await upsert(U, profile({ experience_years: "ko'p" }))).toEqual({ ok: false, reason: "invalid" });
    expect(await upsert(U, profile({ price_from_uzs: 500 }))).toEqual({ ok: false, reason: "invalid" });
    expect(await upsert(U, profile({ display_name: "Al" }))).toEqual({ ok: false, reason: "invalid" });
    expect(await upsert(U, { ...profile(), fields: "mehnat" })).toEqual({ ok: false, reason: "invalid" });
    const n = await db.query(`select 1 from lawyer_profiles where user_id = $1`, [U]);
    expect(n.rows).toHaveLength(0);
  });
});

describe("tasdiqlash", () => {
  let id: number;

  it("bitta ko'rib chiqilayotgan ariza, yo'l faqat o'z papkasida", async () => {
    expect(await rpc(`select public.submit_lawyer_verification($1, 'AL-123', $2) as r`, [X, path(X)])).toEqual({ ok: false, reason: "no_profile" });
    expect(await rpc(`select public.submit_lawyer_verification($1, 'AL-123', $2) as r`, [A, path(B)])).toEqual({ ok: false, reason: "path" });
    expect(await rpc(`select public.submit_lawyer_verification($1, 'AL-123', $2) as r`, [A, `${A}/../x.jpg`])).toEqual({ ok: false, reason: "path" });
    expect(await rpc(`select public.submit_lawyer_verification($1, 'A', $2) as r`, [A, path(A)])).toEqual({ ok: false, reason: "invalid" });
    const r = await rpc(`select public.submit_lawyer_verification($1, ' AL-123 ', $2) as r`, [A, path(A)]);
    expect(r.ok).toBe(true);
    id = r.id as number;
    expect(await rpc(`select public.submit_lawyer_verification($1, 'AL-124', $2) as r`, [A, path(A, 2)])).toEqual({ ok: false, reason: "pending" });
  });

  it("faqat admin tasdiqlaydi; fayl yo'li qaytariladi va bazadan o'chiriladi", async () => {
    expect(await rpc(`select public.review_lawyer_verification($1, $2, true, null) as r`, [A, id])).toEqual({ ok: false, reason: "forbidden" });
    expect(await rpc(`select public.review_lawyer_verification($1, $2, true, null) as r`, [ADMIN, id])).toEqual({ ok: true, path: path(A), user_id: A });
    expect(await rpc(`select public.review_lawyer_verification($1, $2, true, null) as r`, [ADMIN, id])).toEqual({ ok: false, reason: "status" });
    const v = await db.query<{ status: string; doc_path: string | null; license_no: string }>(`select status, doc_path, license_no from lawyer_verifications where id = $1`, [id]);
    expect(v.rows[0]).toEqual({ status: "approved", doc_path: null, license_no: "AL-123" });
    expect(await rpc(`select public.submit_lawyer_verification($1, 'AL-125', $2) as r`, [A, path(A, 3)])).toEqual({ ok: false, reason: "already" });
  });

  it("rad etish sababi saqlanadi; haftasiga ko'pi bilan 3 ta ariza", async () => {
    for (let i = 1; i <= 3; i++) {
      const r = await rpc(`select public.submit_lawyer_verification($1, 'YU-1', $2) as r`, [C, path(C, i)]);
      expect(r.ok).toBe(true);
      expect(await rpc(`select public.review_lawyer_verification($1, $2, false, '  ') as r`, [ADMIN, r.id])).toMatchObject({ ok: true, path: path(C, i) });
    }
    const last = await db.query<{ reason: string }>(`select reason from lawyer_verifications where user_id = $1 order by id desc limit 1`, [C]);
    expect(last.rows[0].reason).toBe("Hujjat tasdiqlanmadi");
    expect(await rpc(`select public.submit_lawyer_verification($1, 'YU-1', $2) as r`, [C, path(C, 9)])).toEqual({ ok: false, reason: "too_many" });
  });

  it("tasdiqlangan yurist ismini yoki turini o'zgartirsa — belgi olinadi", async () => {
    expect(await upsert(A, profile({ kind: "advokat", display_name: "akmal advokatov", fields: ["jinoyat"], bio: "Yangi bio" }))).toEqual({ ok: true, created: false, unverified: false });
    expect(await upsert(A, profile({ kind: "yurist", display_name: "Akmal Advokatov", fields: ["jinoyat"] }))).toEqual({ ok: true, created: false, unverified: true });
    const v = await db.query<{ verified_at: string | null }>(`select verified_at from lawyer_profiles where user_id = $1`, [A]);
    expect(v.rows[0].verified_at).toBeNull();
    // qaytadan tasdiqlash (keyingi testlar uchun) va admin belgini olib tashlay oladi
    await db.query(`update lawyer_profiles set kind = 'advokat', verified_at = now() where user_id = $1`, [A]);
    await db.query(`update lawyer_profiles set verified_at = now() where user_id = $1`, [H]);
    expect(await rpc(`select public.revoke_lawyer_verification($1, $2) as r`, [B, H])).toEqual({ ok: false, reason: "forbidden" });
    expect(await rpc(`select public.revoke_lawyer_verification($1, $2) as r`, [ADMIN, H])).toEqual({ ok: true });
    expect(await rpc(`select public.revoke_lawyer_verification($1, $2) as r`, [ADMIN, H])).toEqual({ ok: false, reason: "status" });
  });
});

describe("katalog", () => {
  it("kontaktlar hech qachon qaytmaydi", async () => {
    const cols = await db.query<{ name: string }>(
      `select unnest(proargnames) as name from pg_proc where proname in ('lawyer_catalog', 'lawyer_public')`);
    const names = cols.rows.map((r) => r.name);
    expect(names).toContain("display_name");
    for (const secret of ["phone", "telegram", "license_no", "doc_path"]) expect(names).not.toContain(secret);
    const rows = await catalog();
    expect(JSON.stringify(rows)).not.toMatch(/998901234567|ali_valiyev/);
    const pub = await db.query(`select * from public.lawyer_public($1)`, [B]);
    expect(JSON.stringify(pub.rows)).not.toMatch(/998901234567|ali_valiyev/);
  });

  it("tartib: tasdiqlanganlar, keyin Bayes reytingi, keyin yangilari; yashirin va bloklangan ko'rinmaydi", async () => {
    await db.query(`update lawyer_profiles set rating_sum = 10, rating_count = 2 where user_id = $1`, [B]); // 4,5 → (10+12)/5 = 4,4
    await db.query(`update lawyer_profiles set rating_sum = 5, rating_count = 1 where user_id = $1`, [D]);  // 5,0 → (5+12)/4 = 4,25
    expect((await catalog()).map((r) => r.id)).toEqual([A, B, D, C]);
    const rows = await catalog();
    expect(rows.find((r) => r.id === B)).toMatchObject({ verified: false, rating_count: 2 });
    expect(Number(rows.find((r) => r.id === B)?.rating)).toBe(5);
    expect(rows.find((r) => r.id === C)?.rating).toBeNull();
    expect(rows.find((r) => r.id === A)?.verified).toBe(true);
    expect(await db.query(`select * from public.lawyer_public($1)`, [H]).then((r) => r.rows)).toHaveLength(0);
  });

  it("filtrlar: soha, viloyat, qidiruv (LIKE belgilari xavfsiz), sahifalash", async () => {
    expect((await catalog({ field: "oila" })).map((r) => r.id).sort()).toEqual([C, D].sort());
    expect((await catalog({ region: "Samarqand" })).map((r) => r.id)).toEqual([B]);
    expect((await catalog({ q: "bobur" })).map((r) => r.id)).toEqual([B]);
    expect(await catalog({ q: "%" })).toHaveLength(0);
    expect(await catalog({ q: "_" })).toHaveLength(0);
    expect((await catalog({ limit: 2 })).map((r) => r.id)).toEqual([A, B]);
    expect((await catalog({ limit: 2, offset: 2 })).map((r) => r.id)).toEqual([D, C]);
    expect(await catalog({ limit: 1000 })).toHaveLength(4);
  });
});

describe("shikoyat va admin", () => {
  it("o'zi ustidan emas, bitta ochiq shikoyat, kuniga 5 ta", async () => {
    const rep = (u: string, l: string, kind = "fake", reason = "Profil soxtaga o'xshaydi, tekshiring") =>
      rpc(`select public.report_lawyer($1, $2, $3, $4) as r`, [u, l, kind, reason]);
    expect(await rep(A, A)).toEqual({ ok: false, reason: "self" });
    expect(await rep(X, X)).toEqual({ ok: false, reason: "self" });
    expect(await rep(X, "00000000-0000-0000-0000-0000000d0fff")).toEqual({ ok: false, reason: "not_found" });
    expect(await rep(X, B, "spam")).toEqual({ ok: false, reason: "invalid" });
    expect(await rep(X, B, "fake", "qisqa")).toEqual({ ok: false, reason: "invalid" });
    expect((await rep(X, B)).ok).toBe(true);
    expect(await rep(X, B)).toEqual({ ok: false, reason: "duplicate" });
    for (const l of [C, D, H, A]) expect((await rep(X, l)).ok).toBe(true);
    // kunlik limit: 5 ta allaqachon
    await db.query(`update lawyer_reports set status = 'dismissed' where reporter_id = $1 and lawyer_id = $2`, [X, B]);
    expect(await rep(X, B)).toEqual({ ok: false, reason: "limit" });
  });

  it("shikoyatni faqat admin yopadi; bloklash ochiq shikoyatlarni yopadi va profilni yashiradi", async () => {
    const open = await db.query<{ id: number }>(`select id from lawyer_reports where lawyer_id = $1 and status = 'open'`, [C]);
    expect(await rpc(`select public.handle_lawyer_report($1, $2, 'dismissed') as r`, [X, open.rows[0].id])).toEqual({ ok: false, reason: "forbidden" });
    expect(await rpc(`select public.handle_lawyer_report($1, $2, 'deleted') as r`, [ADMIN, open.rows[0].id])).toEqual({ ok: false, reason: "invalid" });
    expect(await rpc(`select public.handle_lawyer_report($1, $2, 'dismissed') as r`, [ADMIN, open.rows[0].id])).toEqual({ ok: true });
    expect(await rpc(`select public.handle_lawyer_report($1, $2, 'resolved') as r`, [ADMIN, open.rows[0].id])).toEqual({ ok: false, reason: "status" });

    expect(await rpc(`select public.set_lawyer_status($1, $2, 'blocked') as r`, [X, D])).toEqual({ ok: false, reason: "forbidden" });
    expect(await rpc(`select public.set_lawyer_status($1, $2, 'banned') as r`, [ADMIN, D])).toEqual({ ok: false, reason: "invalid" });
    expect(await rpc(`select public.set_lawyer_status($1, $2, 'blocked') as r`, [ADMIN, D])).toEqual({ ok: true });
    const st = await db.query<{ status: string }>(`select status from lawyer_reports where lawyer_id = $1`, [D]);
    expect(st.rows.map((r) => r.status)).toEqual(["resolved"]);
    expect((await catalog()).map((r) => r.id)).not.toContain(D);
    // bloklangan yurist profilini tahrirlay yoki ko'rinadigan qila olmaydi, tasdiqlash yubora olmaydi
    expect(await upsert(D, profile({ display_name: "Dilshod Blok" }))).toEqual({ ok: false, reason: "blocked" });
    expect(await rpc(`select public.submit_lawyer_verification($1, 'AL-9', $2) as r`, [D, path(D)])).toEqual({ ok: false, reason: "blocked" });
  });
});

describe("klient to'g'ridan-to'g'ri kira olmaydi", () => {
  it("jadvallar va funksiyalar yopiq", async () => {
    for (const t of ["lawyer_profiles", "lawyer_verifications", "lawyer_reports"]) {
      await expect(asUser(db, X, () => db.query(`select * from public.${t}`))).rejects.toThrow(/permission denied/);
    }
    await expect(asUser(db, X, () => db.query(`select * from public.lawyer_catalog()`))).rejects.toThrow(/permission denied/);
    await expect(asUser(db, X, () => db.query(`select * from public.lawyer_public($1)`, [A]))).rejects.toThrow(/permission denied/);
    await expect(asUser(db, X, () => db.query(`select public.upsert_lawyer_profile($1, '{}')`, [X]))).rejects.toThrow(/permission denied/);
    await expect(asUser(db, X, () => db.query(`select public.report_lawyer($1, $2, 'fake', 'xxxxxxxxxxxx')`, [X, A]))).rejects.toThrow(/permission denied/);
    await expect(asUser(db, ADMIN, () => db.query(`select public.set_lawyer_status($1, $2, 'active')`, [ADMIN, D]))).rejects.toThrow(/permission denied/);
  });

  it("legal_uploads: bucket faqat ruxsat etilganlari", async () => {
    await db.query(`insert into legal_uploads (path, user_id, bucket) values ($1, $2, 'lawyer-docs')`, [path(A, 7), A]);
    await expect(db.query(`insert into legal_uploads (path, user_id, bucket) values ($1, $2, 'receipts')`, [path(A, 8), A])).rejects.toThrow(/check/);
    const r = await db.query<{ bucket: string }>(`insert into legal_uploads (path, user_id) values ($1, $2) returning bucket`, [path(A, 9), A]);
    expect(r.rows[0].bucket).toBe("legal-uploads");
  });
});
