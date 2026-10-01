import { NextResponse, type NextRequest } from "next/server";
import { cronSecret } from "@/lib/env";
import { cleanupLegalUploads } from "@/lib/legal-server";
import { secretEquals } from "@/lib/secure-compare";

export const maxDuration = 60;

/** Vercel Cron (vercel.json, kunlik): tahlil qilinmay qolgan hujjat fayllarini o'chirish */
export async function GET(request: NextRequest) {
  const secret = cronSecret();
  if (!secret) return new NextResponse("sozlanmagan", { status: 503 });
  if (!secretEquals(request.headers.get("authorization")?.replace(/^Bearer /, ""), secret)) {
    return new NextResponse("forbidden", { status: 403 });
  }
  const removed = await cleanupLegalUploads();
  return NextResponse.json({ removed });
}
