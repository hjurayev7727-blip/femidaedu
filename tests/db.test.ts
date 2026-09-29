// Migratsiyani haqiqiy Postgres (PGlite) ustida ishga tushirib, RLS/GRANT qoidalarini tekshiradi.
// Supabase'ning auth sxemasi minimal "stub" bilan almashtirilgan.
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb } from "./helpers/db";

let db: PGlite;

const STUDENT = "00000000-0000-0000-0000-000000000001";
const OTHER = "00000000-0000-0000-0000-000000000002";
const TEACHER = "00000000-0000-0000-0000-000000000003";

async function as<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role;`);
  }
}

beforeAll(async () => {
  db = await createTestDb();

  await db.exec(`
    insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values
      ('${STUDENT}', 's@x.uz', '{"full_name":"Ali Valiyev"}', '{"telegram_id":"123456","telegram_username":"ali"}'),
      ('${OTHER}',   'o@x.uz', '{"name":"Boshqa","telegram_id":"777"}', null),
      ('${TEACHER}', 't@x.uz', '{"full_name":"Ustoz"}', null);
    update public.profiles set role = 'teacher' where id = '${TEACHER}';
    insert into public.questions (type, stem, payload, answer, explanation, status) values
      ('single', 'Nashr etilgan savol', '{"options":["a","b","c","d"]}', '{"index":2}', 'izoh', 'published'),
      ('single', 'Qoralama savol',      '{"options":["a","b","c","d"]}', '{"index":0}', 'izoh', 'draft');
    insert into public.attempts (user_id, mode, question_ids, raw_score) values
      ('${STUDENT}', 'practice', '{1}', 80), ('${OTHER}', 'practice', '{1}', 50);
  `);
});

describe("profil", () => {
  it("auth.users dan profil avtomatik yaratiladi (Telegram ma'lumoti bilan)", async () => {
    const { rows } = await db.query<{ full_name: string; telegram_id: string; role: string }>(
      `select full_name, telegram_id::text, role from public.profiles where id = $1`,
      [STUDENT],
    );
    expect(rows[0]).toEqual({ full_name: "Ali Valiyev", telegram_id: "123456", role: "student" });
  });

  it("telegram_id foydalanuvchi o'zi yozadigan metadata'dan olinmaydi (hisobni oldindan egallash)", async () => {
    const { rows } = await db.query<{ telegram_id: string | null }>(`select telegram_id::text from public.profiles where id = $1`, [OTHER]);
    expect(rows[0].telegram_id).toBeNull();
  });

  it("o'quvchi ismini o'zgartira oladi, lekin rolini emas", async () => {
    await as(STUDENT, () => db.exec(`update public.profiles set full_name = 'Ali' where id = '${STUDENT}'`));
    await expect(
      as(STUDENT, () => db.exec(`update public.profiles set role = 'admin' where id = '${STUDENT}'`)),
    ).rejects.toThrow(/permission denied/);
    await expect(
      as(STUDENT, () => db.exec(`update public.profiles set telegram_id = 1 where id = '${STUDENT}'`)),
    ).rejects.toThrow(/permission denied/);
  });

  it("boshqa foydalanuvchi profilini ko'ra olmaydi", async () => {
    const { rows } = await as(STUDENT, () => db.query(`select id from public.profiles`));
    expect(rows).toEqual([{ id: STUDENT }]);
  });
});

describe("savollar", () => {
  it("faqat e'lon qilingan savollar ko'rinadi", async () => {
    const { rows } = await as(STUDENT, () => db.query<{ stem: string }>(`select stem from public.questions`));
    expect(rows.map((r) => r.stem)).toEqual(["Nashr etilgan savol"]);
  });

  it("to'g'ri javob va izoh mijozga yopiq", async () => {
    await expect(as(STUDENT, () => db.query(`select answer from public.questions`))).rejects.toThrow(
      /permission denied/,
    );
    await expect(as(STUDENT, () => db.query(`select explanation from public.questions`))).rejects.toThrow(
      /permission denied/,
    );
    await expect(as(STUDENT, () => db.query(`select * from public.questions`))).rejects.toThrow(
      /permission denied/,
    );
  });

  it("anon savollarni umuman ko'ra olmaydi", async () => {
    await db.exec(`set role anon`);
    await expect(db.query(`select stem from public.questions`)).rejects.toThrow(/permission denied/);
    await db.exec(`reset role`);
  });
});

describe("natijalar va guruhlar", () => {
  it("o'quvchi natija yoza olmaydi (ball faqat serverda)", async () => {
    await expect(
      as(STUDENT, () =>
        db.exec(`insert into public.attempts (user_id, mode, question_ids, raw_score)
                 values ('${STUDENT}', 'mock', '{1}', 100)`),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("o'quvchi faqat o'z natijasini ko'radi", async () => {
    const { rows } = await as(STUDENT, () => db.query<{ user_id: string }>(`select user_id from public.attempts`));
    expect(rows).toEqual([{ user_id: STUDENT }]);
  });

  it("o'qituvchi guruh ochadi, lekin o'zi Premium bera olmaydi", async () => {
    await as(TEACHER, () =>
      db.exec(`insert into public.groups (teacher_id, name) values ('${TEACHER}', '11-A')`),
    );
    await expect(
      as(TEACHER, () =>
        db.exec(`insert into public.groups (teacher_id, name, grants_premium) values ('${TEACHER}', 'X', true)`),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      as(TEACHER, () => db.exec(`update public.groups set grants_premium = true`)),
    ).rejects.toThrow(/permission denied/);
  });

  it("oddiy o'quvchi guruh ocha olmaydi", async () => {
    await expect(
      as(STUDENT, () => db.exec(`insert into public.groups (teacher_id, name) values ('${STUDENT}', 'Men')`)),
    ).rejects.toThrow(/row-level security/);
  });

  it("o'qituvchi faqat o'z guruhi a'zolarining natijasini ko'radi", async () => {
    const before = await as(TEACHER, () => db.query(`select user_id from public.attempts`));
    expect(before.rows).toEqual([]);

    await db.exec(`insert into public.group_members (group_id, user_id)
                   select id, '${STUDENT}' from public.groups where name = '11-A'`);
    const after = await as(TEACHER, () => db.query<{ user_id: string }>(`select user_id from public.attempts`));
    expect(after.rows).toEqual([{ user_id: STUDENT }]);

    const profiles = await as(TEACHER, () => db.query<{ id: string }>(`select id from public.profiles order by id`));
    expect(profiles.rows.map((r) => r.id)).toEqual([STUDENT, TEACHER]);
  });

  it("Premium: obuna yoki Premium beradigan guruh orqali", async () => {
    const premium = () =>
      db.query<{ p: boolean }>(`select public.is_premium() as p`).then((r) => r.rows[0].p);

    expect(await as(STUDENT, premium)).toBe(false);
    await db.exec(`update public.groups set grants_premium = true where name = '11-A'`);
    expect(await as(STUDENT, premium)).toBe(true);

    expect(await as(OTHER, premium)).toBe(false);
    await db.exec(`insert into public.subscriptions (user_id, ends_at) values ('${OTHER}', now() + interval '30 days')`);
    expect(await as(OTHER, premium)).toBe(true);
  });
});

describe("seed", () => {
  it("standart shablon: yopiq 75 + yozma 25 = 100", async () => {
    const { rows } = await db.query<{ blueprint: { closed_difficulty_mix: Record<string, number>; points: { closed: Record<string, number> } } }>(
      `select blueprint from public.exam_templates where slug = 'milliy-sertifikat-standart'`,
    );
    const { closed_difficulty_mix: mix, points } = rows[0].blueprint;
    const closed = Object.entries(mix).reduce((s, [d, n]) => s + n * points.closed[d], 0);
    expect(Object.values(mix).reduce((a, b) => a + b)).toBe(35);
    expect(closed).toBeCloseTo(75);
  });

  it("24 ta spetsifikatsiya bo'limi", async () => {
    const { rows } = await db.query<{ n: number }>(`select count(*)::int as n from public.spec_sections`);
    expect(rows[0].n).toBe(24);
  });
});
