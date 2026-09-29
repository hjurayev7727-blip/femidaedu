"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export type EditState = { ok: boolean; message: string } | null;

const text = (max: number) => z.string().trim().max(max);
const Common = z.object({
  id: z.coerce.number().int().positive(),
  version: z.coerce.number().int().positive(),
  stem: text(1000).pipe(z.string().min(5, "Savol matni juda qisqa")),
  explanation: text(2000),
  source_note: text(300),
  difficulty: z.coerce.number().int().min(1).max(3),
  status: z.enum(["draft", "review", "published", "archived"]),
});

const Choice = z.object({
  type: z.enum(["single", "fill_blank", "case"]),
  context: text(2000),
  options: z.array(text(500).pipe(z.string().min(1, "Bo'sh variant bor"))).length(4, "Aynan 4 ta variant kerak"),
  correct: z.coerce.number().int().min(0).max(3),
});

const Open = z.object({
  type: z.literal("open"),
  kind: z.enum(["number", "article", "text"]),
  accepted: z.array(text(200)).transform((a) => [...new Set(a.filter(Boolean))]).pipe(z.array(z.string()).min(1, "Kamida bitta qabul qilinadigan javob")),
  show: text(200).pipe(z.string().min(1, "Ko'rsatiladigan javob bo'sh")),
});

const Other = z.object({ type: z.enum(["matching", "ordering", "multi"]) });

export async function saveQuestion(_prev: EditState, form: FormData): Promise<EditState> {
  const { userId } = await requireRole("reviewer", "admin");
  const common = Common.safeParse(Object.fromEntries(["id", "version", "stem", "explanation", "source_note", "difficulty", "status"].map((k) => [k, form.get(k) ?? ""])));
  if (!common.success) return { ok: false, message: common.error.issues[0]?.message ?? "Ma'lumot noto'g'ri" };
  const type = String(form.get("type"));

  const patch: Record<string, unknown> = {
    stem: common.data.stem,
    explanation: common.data.explanation || null,
    source_note: common.data.source_note || null,
    difficulty: common.data.difficulty,
    status: common.data.status,
  };

  if (type === "single" || type === "fill_blank" || type === "case") {
    const c = Choice.safeParse({ type, context: form.get("context") ?? "", options: form.getAll("options"), correct: form.get("correct") });
    if (!c.success) return { ok: false, message: c.error.issues[0]?.message ?? "Variantlar noto'g'ri" };
    const norm = c.data.options.map((o) => o.toLowerCase().replace(/\s+/g, " "));
    if (new Set(norm).size !== 4) return { ok: false, message: "Variantlar takrorlangan" };
    if (type === "fill_blank" && !common.data.stem.includes("___")) return { ok: false, message: "Bo'sh joy ___ bilan belgilanishi kerak" };
    if (type === "case" && !c.data.context) return { ok: false, message: "Amaliy vaziyat matni bo'sh" };
    // statements (kombinatsiyali savollar) o'zgarmaydi — faqat variantlar va to'g'ri javob
    const admin = createSupabaseAdmin();
    const { data: cur } = await admin.from("questions").select("payload").eq("id", common.data.id).single<{ payload: { statements?: string[] } }>();
    patch.context = type === "case" ? c.data.context : null;
    patch.payload = cur?.payload.statements ? { options: c.data.options, statements: cur.payload.statements } : { options: c.data.options };
    patch.answer = { index: c.data.correct };
  } else if (type === "open") {
    const o = Open.safeParse({ type, kind: form.get("kind"), accepted: String(form.get("accepted") ?? "").split("\n").map((s) => s.trim()), show: form.get("show") ?? "" });
    if (!o.success) return { ok: false, message: o.error.issues[0]?.message ?? "Javob noto'g'ri" };
    if (o.data.kind !== "text" && !Number.isFinite(parseFloat(o.data.accepted[0]))) return { ok: false, message: "Son yoki modda raqami kutilgan" };
    patch.payload = { kind: o.data.kind };
    patch.answer = { accepted: o.data.accepted, show: o.data.show };
  } else if (!Other.safeParse({ type }).success) {
    return { ok: false, message: "Noma'lum savol turi" };
  }

  // Optimistik qulf: boshqa ekspert shu orada o'zgartirgan bo'lsa — ustidan yozilmaydi.
  // version oshadi → qayta import bu savolni eski holatiga qaytarmaydi.
  const { data, error } = await createSupabaseAdmin()
    .from("questions")
    .update({ ...patch, version: common.data.version + 1, reviewer_id: userId })
    .eq("id", common.data.id)
    .eq("version", common.data.version)
    .select("id");
  if (error) return { ok: false, message: "Saqlab bo'lmadi" };
  if (!data?.length) return { ok: false, message: "Savolni boshqa ekspert o'zgartirgan — sahifani yangilang." };
  revalidatePath(`/app/kontent/savollar/${common.data.id}`);
  return { ok: true, message: "Saqlandi ✓" };
}
