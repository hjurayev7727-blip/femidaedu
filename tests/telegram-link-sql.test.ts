// Jonli xato: GoTrue admin.createUser app_metadata'ni INSERT'dan keyin UPDATE bilan yozadi,
// shuning uchun handle_new_user profilga telegram_id qo'ymaydi. link_telegram_profile buni tuzatadi.
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDb } from "./helpers/db";

let db: PGlite;
const EMAIL = "tg777@telegram.aplus-huquq.uz";
const U = "00000000-0000-0000-0000-00000000c701";

const link = async (email: string, tg: number, username: string | null = "ali") =>
  (await db.query<{ id: string | null }>(`select public.link_telegram_profile($1, $2, $3) as id`, [email, tg, username])).rows[0].id;
const profileTg = async (id: string) =>
  (await db.query<{ telegram_id: number | null; telegram_username: string | null }>(
    `select telegram_id, telegram_username from public.profiles where id = $1`, [id])).rows[0];

beforeAll(async () => {
  db = await createTestDb();
  // GoTrue ketma-ketligi: avval app_metadata'siz qator, keyin alohida UPDATE
  await db.query(`insert into auth.users (id, email, raw_app_meta_data) values ($1, $2, '{"provider":"email"}')`, [U, EMAIL]);
  await db.query(`update auth.users set raw_app_meta_data = raw_app_meta_data || '{"telegram_id":"777"}' where id = $1`, [U]);
}, 60_000);

describe("link_telegram_profile", () => {
  it("trigger telegram_id'ni ko'rmagan (jonli xatoning takrori)", async () => {
    expect((await profileTg(U)).telegram_id).toBeNull();
  });

  it("app_metadata.telegram_id mos kelsa — profil bog'lanadi; qayta chaqirish xavfsiz", async () => {
    expect(await link(EMAIL, 777)).toBe(U);
    expect(await profileTg(U)).toEqual({ telegram_id: 777, telegram_username: "ali" });
    expect(await link(EMAIL.toUpperCase(), 777, "ali2")).toBe(U);
    expect((await profileTg(U)).telegram_username).toBe("ali2");
  });

  it("boshqa Telegram hisobi yoki begona email — rad etiladi", async () => {
    expect(await link(EMAIL, 778)).toBeNull();
    const V = "00000000-0000-0000-0000-00000000c702";
    // Kimdir texnik emailni oldindan egallagan (app_metadata'da telegram_id yo'q)
    await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, 'tg900@telegram.aplus-huquq.uz', '{"telegram_id":"900"}')`, [V]);
    expect(await link("tg900@telegram.aplus-huquq.uz", 900)).toBeNull();
    expect((await profileTg(V)).telegram_id).toBeNull();
  });

  it("mijoz chaqira olmaydi", async () => {
    await expect(asUser(db, U, () => db.query(`select public.link_telegram_profile('${EMAIL}', 777, null)`))).rejects.toThrow(/permission denied/);
  });
});
