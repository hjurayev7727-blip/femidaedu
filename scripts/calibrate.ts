// Savollar qiyinligini haqiqiy javoblardan Rasch modeli bilan hisoblash.
//   npm run db:calibrate               — faqat hisobot (data/calibration/REPORT.md), bazaga yozmaydi
//   npm run db:calibrate -- --apply    — questions.irt_b va difficulty (1/2/3) ni yangilaydi
// Tavsiya: kamida ~200 ta sinov imtihoni / bir necha ming javob yig'ilgach ishga tushiring.
import { mkdirSync, writeFileSync } from "node:fs";
import postgres from "postgres";
import { bandOf, difficultyBands, estimateRasch, itemDiscrimination, type Response } from "../src/lib/rasch";

try {
  process.loadEnvFile(".env.local");
} catch {
  // muhitdan
}
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL topilmadi (.env.local).");
  process.exit(1);
}
const MIN_PER_ITEM = 30;
const apply = process.argv.includes("--apply");
const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });

type Row = { person: string; item: string; correct: boolean };
type Meta = { id: string; stem: string; difficulty: number; type: string; source: string };

async function main() {
  // Har o'quvchining har savolga BIRINCHI javobi (takrorlashdagi o'rganish ta'siri modelni buzmasin)
  const rows = await sql<Row[]>`
    select distinct on (a.user_id, aa.question_id) a.user_id::text as person, aa.question_id::text as item, aa.is_correct as correct
    from public.attempt_answers aa join public.attempts a on a.id = aa.attempt_id
    where aa.is_correct is not null
    order by a.user_id, aa.question_id, aa.answered_at`;
  console.log(`Javoblar: ${rows.length}`);
  const data: Response[] = rows.map((r) => ({ person: r.person, item: r.item, correct: r.correct }));
  const result = estimateRasch(data, { minPerItem: MIN_PER_ITEM });
  const disc = itemDiscrimination(data, result.persons);
  console.log(`Baholangan savollar: ${result.items.size} · o'quvchilar: ${result.persons.size} · iteratsiya: ${result.iterations} · ${result.converged ? "yaqinlashdi" : "YAQINLASHMADI"}`);
  if (result.items.size < 50) {
    console.log(`Ma'lumot yetarli emas (kamida ${MIN_PER_ITEM} javobli savollar 50 tadan kam). Keyinroq ishga tushiring.`);
    return;
  }

  const ids = [...result.items.keys()];
  const meta = await sql<Meta[]>`select id::text, left(stem, 120) as stem, difficulty, type, source from public.questions where id in ${sql(ids.map(Number))}`;
  const metaById = new Map(meta.map((m) => [m.id, m]));
  const bands = difficultyBands([...result.items.values()].map((v) => v.b));

  const rowsOut = ids.map((id) => {
    const it = result.items.get(id)!;
    const m = metaById.get(id);
    return { id, ...it, disc: disc.get(id) ?? 0, band: bandOf(it.b, bands), label: m?.difficulty ?? 2, stem: m?.stem ?? "", type: m?.type ?? "" };
  });
  const suspicious = rowsOut.filter((r) => r.disc < 0).sort((a, c) => a.disc - c.disc);
  const mislabeled = rowsOut.filter((r) => Math.abs(r.band - r.label) === 2);

  mkdirSync("data/calibration", { recursive: true });
  const fmt = (x: number) => x.toFixed(2);
  writeFileSync(
    "data/calibration/REPORT.md",
    [
      `# Rasch kalibrlash hisoboti`,
      ``,
      `Javoblar: ${rows.length} · baholangan savollar: ${result.items.size} · o'quvchilar: ${result.persons.size}`,
      `Toifa chegaralari (10/18/7 ulush): oson < ${fmt(bands.low)} ≤ o'rta < ${fmt(bands.high)} ≤ qiyin`,
      ``,
      `## ⚠ Javob kaliti shubhali (ajratish kuchi manfiy) — ekspert tekshirsin`,
      ...(suspicious.length ? suspicious.map((r) => `- #${r.id} (${r.type}) disc ${fmt(r.disc)}, to'g'ri ${Math.round(r.pValue * 100)}% — ${r.stem}`) : ["Yo'q."]),
      ``,
      `## Yorlig'i keskin farq qiladi (1 ↔ 3)`,
      ...(mislabeled.length ? mislabeled.map((r) => `- #${r.id}: yorliq ${r.label} → haqiqiy ${r.band} (b ${fmt(r.b)}, to'g'ri ${Math.round(r.pValue * 100)}%) — ${r.stem}`) : ["Yo'q."]),
      ``,
      `## Barcha savollar`,
      `| id | b | se | n | to'g'ri % | disc | yorliq → toifa |`,
      `|---|---|---|---|---|---|---|`,
      ...rowsOut.sort((a, c) => a.b - c.b).map((r) => `| ${r.id} | ${fmt(r.b)} | ${fmt(r.se)} | ${r.n} | ${Math.round(r.pValue * 100)} | ${fmt(r.disc)} | ${r.label} → ${r.band} |`),
    ].join("\n"),
  );
  console.log(`Hisobot: data/calibration/REPORT.md · shubhali kalit: ${suspicious.length} · yorlig'i keskin farqli: ${mislabeled.length}`);

  if (apply) {
    await sql.begin(async (tx) => {
      for (const r of rowsOut) {
        await tx`update public.questions set irt_b = ${r.b}, difficulty = ${r.band} where id = ${Number(r.id)}`;
      }
    });
    console.log(`✓ ${rowsOut.length} ta savolga irt_b va qiyinlik toifasi yozildi (sinov imtihoni endi shuni ishlatadi).`);
  } else {
    console.log("Bazaga yozilmadi. Yozish uchun: npm run db:calibrate -- --apply");
  }
}

main()
  .catch((e: Error) => {
    console.error("✗", e.message);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
