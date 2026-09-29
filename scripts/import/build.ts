// v1 materiallaridan import to'plamini quradi:  npm run import:build [-- <v1 papka>]
// Natija: data/v1/bundle.json (repoga qo'shiladi) va data/v1/REPORT.md (tekshiruv hisoboti).
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { longestOptionBias } from "../../src/lib/bias";
import { buildBundle } from "./bundle";
import { documentByNumber } from "./documents";
import { dedupe, isRejected, normalize, type ImportedQuestion, type Rejected } from "./normalize";
import { readAllSources } from "./sources";

const root = resolve(process.argv[2] ?? process.env.V1_ROOT ?? "../HUQUQSHUNOSLIK KURSI");
const outDir = resolve("data/v1");

const { items, log } = readAllSources(root);
const ok: ImportedQuestion[] = [];
const rejected: Rejected[] = [];
for (const raw of items) {
  const r = normalize(raw);
  if (isRejected(r)) rejected.push(r);
  else ok.push(r);
}
const { questions, conflicts } = dedupe(ok);
const bundle = buildBundle(questions);

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "bundle.json"), JSON.stringify(bundle));

// ── Hisobot ──
const byType = new Map<string, number>();
const byDoc = new Map<number, number>();
let noTopic = 0;
for (const q of bundle.questions) {
  byType.set(q.type, (byType.get(q.type) ?? 0) + 1);
  if (q.documentNumber != null) byDoc.set(q.documentNumber, (byDoc.get(q.documentNumber) ?? 0) + 1);
  if (!q.topicSlug) noTopic++;
}
const emptyDocs = bundle.documents.filter((d) => !byDoc.has(d.number));

// To'g'ri javobi keskin uzun (taxmin qilinadigan) savollar — hujjatlar bo'yicha
const choice = bundle.questions.filter((q) => "options" in q.payload && "index" in q.answer);
const biasedByDoc = new Map<string, { biased: number; total: number }>();
for (const q of choice) {
  const key = q.documentNumber != null ? `№${q.documentNumber} ${bundle.documents.find((d) => d.number === q.documentNumber)!.shortTitle}` : "Darsliklar";
  const e = biasedByDoc.get(key) ?? { biased: 0, total: 0 };
  e.total++;
  if (longestOptionBias((q.payload as { options: string[] }).options, (q.answer as { index: number }).index).biased) e.biased++;
  biasedByDoc.set(key, e);
}
const biasedTotal = [...biasedByDoc.values()].reduce((s, v) => s + v.biased, 0);

const lines = [
  `# v1 import hisoboti`,
  ``,
  `Manba: \`${root}\``,
  ``,
  `| Ko'rsatkich | Soni |`,
  `|---|---|`,
  `| O'qilgan elementlar | ${items.length} |`,
  `| Rad etilgan (xato) | ${rejected.length} |`,
  `| Dublikatlar birlashtirildi | ${ok.length - questions.length} |`,
  `| **Unikal savollar** | **${questions.length}** |`,
  `| Mavzusiz (faqat aralash testlarda) | ${noTopic} |`,
  `| Javobi ziddiyatli dublikatlar | ${conflicts.length} |`,
  ``,
  `## Turlar`,
  ...[...byType].sort((a, b) => b[1] - a[1]).map(([t, n]) => `- ${t}: ${n}`),
  ``,
  `## Hujjatlar bo'yicha`,
  `| № | Hujjat | Savollar |`,
  `|---|---|---|`,
  ...bundle.documents.map((d) => `| ${d.number} | ${d.shortTitle} | ${byDoc.get(d.number) ?? 0} |`),
  ``,
  emptyDocs.length ? `⚠ Savolsiz hujjatlar: ${emptyDocs.map((d) => `№${d.number}`).join(", ")}` : `Barcha 52 hujjat bo'yicha savol bor.`,
  ``,
  `## To'g'ri javobi keskin uzun savollar — ${biasedTotal} / ${choice.length} (${Math.round((100 * biasedTotal) / choice.length)}%)`,
  `To'g'ri variant boshqalardan kamida 30% va 8 belgi uzun — o'quvchi bilmasdan topa oladi. Kontent panelida "Javobi ko'zga tashlanadi" filtri bilan tuzating (chalg'ituvchi variantlarni uzaytiring).`,
  ``,
  `| Hujjat | Keskin uzun | Jami |`,
  `|---|---|---|`,
  ...[...biasedByDoc].sort((a, b) => b[1].biased - a[1].biased).map(([k, v]) => `| ${k} | ${v.biased} | ${v.total} |`),
  ``,
  `## Javobi ziddiyatli dublikatlar (ekspert ko'rib chiqsin)`,
  conflicts.length ? `Bir xil savol turli manbalarda turli to'g'ri javob bilan. Import birinchisini oldi.` : "Yo'q.",
  ...conflicts.map((c) => `- **${c.stem.slice(0, 120)}** — olindi: \`${c.kept}\` · boshqasi: \`${c.other}\` (${c.origins.join(", ")})`),
  ``,
  `## Rad etilganlar`,
  ...(rejected.length ? rejected.map((r) => `- ${r.origin}: ${r.reason} — ${r.preview}`) : ["Yo'q."]),
  ``,
  `## Manbalar jurnali`,
  ...log.map((l) => `- ${l}`),
  ``,
];
writeFileSync(join(outDir, "REPORT.md"), lines.join("\n"));

console.log(`O'qildi: ${items.length} · rad: ${rejected.length} · unikal: ${questions.length} · ziddiyat: ${conflicts.length} · mavzusiz: ${noTopic}`);
console.log(`Savolsiz hujjatlar: ${emptyDocs.map((d) => `№${d.number} ${documentByNumber(d.number).shortTitle}`).join("; ") || "yo'q"}`);
