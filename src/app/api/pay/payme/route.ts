import { NextResponse, type NextRequest } from "next/server";
import { PAYME_METHODS, paymeEnv, paymeResponse, type PaymeRpcResult } from "@/lib/payme";
import { secretEquals } from "@/lib/secure-compare";
import { createSupabaseAdmin } from "@/lib/supabase/server";

/**
 * Payme Merchant API (JSON-RPC) — DOYSE uzatgan so'rovlar. Payme kalitini DOYSE tekshiradi,
 * bu yerda faqat DOYSE'ning uzatish kaliti (X-Payme-Forward) tekshiriladi.
 * Payme har doim HTTP 200 kutadi — xatolar JSON-RPC "error" ichida qaytadi.
 */
export async function POST(request: NextRequest) {
  const cfg = paymeEnv();
  if (!cfg) return NextResponse.json(paymeResponse(null, { error: { code: -32400 } }), { status: 503 });
  if (!secretEquals(request.headers.get("x-payme-forward"), cfg.PAYME_FORWARD_SECRET)) {
    return NextResponse.json(paymeResponse(null, { error: { code: -32504 } }), { status: 403 });
  }

  let body: { id?: unknown; method?: unknown; params?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(paymeResponse(null, { error: { code: -32700 } }));
  }
  const method = typeof body?.method === "string" ? body.method : "";
  if (!(PAYME_METHODS as readonly string[]).includes(method)) return NextResponse.json(paymeResponse(body?.id, { error: { code: -32601 } }));
  const params = body.params && typeof body.params === "object" ? body.params : {};

  const { data, error } = await createSupabaseAdmin().rpc("payme_rpc", { p_method: method, p_params: params });
  if (error) {
    console.error("payme_rpc", method, error.message);
    return NextResponse.json(paymeResponse(body.id, { error: { code: -32400 } }));
  }
  return NextResponse.json(paymeResponse(body.id, data as PaymeRpcResult));
}
