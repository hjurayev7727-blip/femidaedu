// Import to'plamining formati va mavzu daraxtini qurish.
import { DOCUMENTS, MODULES } from "./documents";
import type { ImportedQuestion } from "./normalize";
import type { Answer, Payload, QuestionType } from "../../src/lib/questions";

export type TopicRow = { slug: string; title: string; parentSlug: string | null; documentNumber: number | null; sort: number };

export type BundleQuestion = {
  legacyKey: string;
  type: QuestionType;
  stem: string;
  context: string | null;
  payload: Payload;
  answer: Answer;
  explanation: string | null;
  sourceNote: string | null;
  difficulty: 1 | 2 | 3;
  documentNumber: number | null;
  topicSlug: string | null;
};

export type Bundle = {
  version: 1;
  documents: { number: number; code: string; title: string; shortTitle: string; priority: string; module: number }[];
  topics: TopicRow[];
  questions: BundleQuestion[];
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’ʻʼ'`]/g, "")
    .replace(/[–—]/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildBundle(questions: ImportedQuestion[]): Bundle {
  const topics: TopicRow[] = [];
  for (const [m, title] of Object.entries(MODULES)) {
    topics.push({ slug: `modul-${m}`, title: `${m}-modul. ${title}`, parentSlug: null, documentNumber: null, sort: Number(m) * 100 });
  }
  for (const d of [...DOCUMENTS].sort((a, b) => a.number - b.number)) {
    topics.push({ slug: `hujjat-${d.number}`, title: d.shortTitle, parentSlug: `modul-${d.module}`, documentNumber: d.number, sort: d.module * 100 + d.number });
  }

  // Darsliklar: "darslik-8" → "darslik-8-1-6-dars"
  const textbookTopics = new Map<string, TopicRow>();
  const topicFor = (q: ImportedQuestion): string | null => {
    if (q.doc != null) return `hujjat-${q.doc}`;
    if (!q.textbook) return null;
    const g = q.textbook.grade;
    const parent = `darslik-${g}`;
    if (!textbookTopics.has(parent)) {
      textbookTopics.set(parent, { slug: parent, title: `${g}-sinf darsligi`, parentSlug: null, documentNumber: null, sort: 1000 + g * 10 });
    }
    if (!q.textbook.label) return parent;
    const short = q.textbook.label.replace(/^\d+-sinf darsligi\s*·\s*/, "");
    const slug = `${parent}-${slugify(short)}`;
    if (!textbookTopics.has(slug)) {
      const first = Number(/\d+/.exec(short)?.[0] ?? 0);
      textbookTopics.set(slug, { slug, title: short, parentSlug: parent, documentNumber: null, sort: 1000 + g * 10 + first / 100 });
    }
    return slug;
  };

  const out: BundleQuestion[] = questions.map((q) => ({
    legacyKey: q.legacyKey,
    type: q.type,
    stem: q.stem,
    context: q.context,
    payload: q.payload,
    answer: q.answer,
    explanation: q.explanation,
    sourceNote: q.sourceNote,
    difficulty: q.difficulty,
    documentNumber: q.doc,
    topicSlug: topicFor(q),
  }));

  return {
    version: 1,
    documents: DOCUMENTS.map(({ number, code, title, shortTitle, priority, module }) => ({ number, code, title, shortTitle, priority, module })).sort(
      (a, b) => a.number - b.number,
    ),
    topics: [...topics, ...[...textbookTopics.values()].sort((a, b) => a.sort - b.sort)],
    questions: out.sort((a, b) => a.legacyKey.localeCompare(b.legacyKey)),
  };
}
