// data/lex/documents.json: kodlar takrorlanmaydi, soha va tur to'g'ri, ID raqamli, kutilgan sarlavha bor.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type Entry = { code: string; field: string; lex_id: string; title: string; short_title: string; expect: string; kind: string };
const docs = (JSON.parse(readFileSync("data/lex/documents.json", "utf8")) as { documents: Entry[] }).documents;
const migration = readFileSync("supabase/migrations/20261001000015_law_base.sql", "utf8");

describe("lex registri", () => {
  it("Konstitutsiya, kodekslar va asosiy qonunlar", () => {
    expect(docs.length).toBeGreaterThanOrEqual(18);
    expect(docs.filter((d) => d.kind === "constitution").map((d) => d.code)).toEqual(["KONST"]);
    expect(docs.some((d) => d.kind === "law")).toBe(true);
  });

  it("kod va lex_id takrorlanmaydi; maydonlar to'g'ri", () => {
    expect(new Set(docs.map((d) => d.code)).size).toBe(docs.length);
    expect(new Set(docs.map((d) => d.lex_id)).size).toBe(docs.length);
    for (const d of docs) {
      expect(d.lex_id, d.code).toMatch(/^\d{3,8}$/);
      expect(["code", "law", "constitution"], d.code).toContain(d.kind);
      expect(d.expect, d.code).toBe(d.expect.toLowerCase());
      expect(migration, `soha ${d.field}`).toContain(`'${d.field}'`);
    }
  });
});
