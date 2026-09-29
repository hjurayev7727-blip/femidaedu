import { describe, expect, it } from "vitest";
import { paymeCheckoutUrl, paymeResponse } from "@/lib/payme";

describe("paymeCheckoutUrl", () => {
  it("checkout.paycom.uz/<base64>: kassa, buyurtma, summa tiyinda, qaytish manzili", () => {
    const url = paymeCheckoutUrl(
      { PAYME_MERCHANT_ID: "6abc02ca4bc1ce551a2c21a6", PAYME_CHECKOUT_URL: "https://checkout.paycom.uz" },
      { code: "AABCDEFGH2", amountUzs: 49000 },
      "https://aplushuquq.vercel.app/app/premium?payme=AABCDEFGH2",
    );
    const [base, b64] = url.split(/\/(?=[^/]+$)/);
    expect(base).toBe("https://checkout.paycom.uz");
    expect(Buffer.from(b64, "base64").toString()).toBe(
      "m=6abc02ca4bc1ce551a2c21a6;ac.order_id=AABCDEFGH2;a=4900000;c=https://aplushuquq.vercel.app/app/premium?payme=AABCDEFGH2;l=uz",
    );
  });
});

describe("paymeResponse", () => {
  it("natija va xato — JSON-RPC 2.0, xabar 3 tilda, data saqlanadi", () => {
    expect(paymeResponse(7, { result: { allow: true } })).toEqual({ jsonrpc: "2.0", id: 7, result: { allow: true } });
    const e = paymeResponse(8, { error: { code: -31050, message: "Order not found", data: "order_id" } });
    expect(e).toMatchObject({ jsonrpc: "2.0", id: 8, error: { code: -31050, data: "order_id" } });
    expect(Object.keys((e as { error: { message: object } }).error.message).sort()).toEqual(["en", "ru", "uz"]);
    expect(paymeResponse(undefined, { error: { code: -32504 } })).toMatchObject({ id: null, error: { code: -32504 } });
  });
});
