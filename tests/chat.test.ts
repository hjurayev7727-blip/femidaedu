// Yozishma: xabarlarni birlashtirish va shakllar.
import { describe, expect, it } from "vitest";
import { lastId, mergeMessages, OfferSchema, RequestSchema, type ChatMsg } from "@/lib/chat";

const M = (id: number, body = `m${id}`, mine = false): ChatMsg => ({ id, mine, kind: "text", body, offer_id: null, created_at: "2026-10-01T00:00:00Z" });

describe("xabarlarni birlashtirish", () => {
  it("takrorsiz va tartibli; vaqtinchalik xabar server nusxasi bilan almashtiriladi", () => {
    expect(mergeMessages([M(1), M(2)], [M(2), M(3)]).map((m) => m.id)).toEqual([1, 2, 3]);
    const local = { ...M(-1, "salom", true) };
    expect(mergeMessages([M(1), local], [M(5, "salom", true)]).map((m) => m.id)).toEqual([1, 5]);
    expect(mergeMessages([M(1), local], [M(5, "boshqa", false)]).map((m) => m.id)).toEqual([1, 5, -1]);
    expect(lastId([M(3), M(-1), M(7)])).toBe(7);
  });
});

describe("shakllar", () => {
  it("ariza va taklif", () => {
    expect(RequestSchema.safeParse({ title: "Ish haqi", body: "x".repeat(20), field: "", region: "", target_lawyer: "", tutor_message_id: "" }).success).toBe(true);
    expect(RequestSchema.safeParse({ title: "Ish", body: "x".repeat(20), field: "", region: "", target_lawyer: "", tutor_message_id: "" }).success).toBe(false);
    expect(RequestSchema.parse({ title: "Ish haqi", body: "x".repeat(20), field: "mehnat", region: "", target_lawyer: "", tutor_message_id: "12" }).tutor_message_id).toBe(12);
    expect(OfferSchema.safeParse({ price_uzs: "5000", note: "Maslahat" }).success).toBe(false);
    expect(OfferSchema.parse({ price_uzs: "150000", note: "Maslahat berish" }).price_uzs).toBe(150000);
  });
});
