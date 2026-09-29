import { describe, expect, it } from "vitest";
import { checkReceipt, RECEIPT_MAX_BYTES, sniffReceipt } from "@/lib/receipt";

const b = (...xs: number[]) => new Uint8Array([...xs, ...new Array(16).fill(0)]);

describe("sniffReceipt", () => {
  it("imzo baytlari bo'yicha aniqlaydi", () => {
    expect(sniffReceipt(b(0xff, 0xd8, 0xff, 0xe0))?.ext).toBe("jpg");
    expect(sniffReceipt(b(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))?.ext).toBe("png");
    expect(sniffReceipt(b(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50))?.ext).toBe("webp");
    expect(sniffReceipt(new TextEncoder().encode("%PDF-1.7 ..."))?.ext).toBe("pdf");
  });
  it("HTML, SVG, bajariladigan fayllarni rad etadi", () => {
    expect(sniffReceipt(new TextEncoder().encode("<html><script>"))).toBeNull();
    expect(sniffReceipt(new TextEncoder().encode("<svg xmlns="))).toBeNull();
    expect(sniffReceipt(b(0x4d, 0x5a))).toBeNull();
  });
});

describe("checkReceipt", () => {
  it("bo'sh, katta va noto'g'ri fayl — tushunarli xabar", async () => {
    expect(await checkReceipt(null)).toMatchObject({ ok: false });
    expect(await checkReceipt(new Blob([]))).toMatchObject({ ok: false, message: "Chek faylini tanlang" });
    expect(await checkReceipt(new Blob([new Uint8Array(RECEIPT_MAX_BYTES + 1)]))).toMatchObject({ ok: false, message: "Fayl 5 MB dan katta" });
    // MIME "image/png" deb yozilgan, lekin ichida HTML — rad etiladi
    const fake = new Blob(["<html>"], { type: "image/png" });
    expect(await checkReceipt(fake)).toMatchObject({ ok: false });
  });
  it("haqiqiy PNG qabul qilinadi", async () => {
    const r = await checkReceipt(new Blob([b(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)]));
    expect(r.ok && r.kind.mime).toBe("image/png");
  });
});
