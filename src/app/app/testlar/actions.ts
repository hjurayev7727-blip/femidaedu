"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Attachment } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { MAX_ITEMS, normalizeCode, parseArticleRange, SHARE_CODE_RE, type Visibility } from "@/lib/user-tests";
import { createAiTest, publishTest, saveTestItem, type TestSource } from "@/lib/user-tests-server";

export type FormState = { ok: false; message: string } | { ok: true; message: string } | null;

const TYPES = ["single", "fill_blank", "case", "open"] as const;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
const MAX_FILE = 5 * 1024 * 1024;

const CreateSchema = z.object({
  title: z.string().trim().min(3, "Test nomini yozing (kamida 3 harf)").max(120),
  source: z.enum(["articles", "text", "file"]),
  document: z.coerce.number().int().positive().optional(),
  articles: z.string().max(200).optional().default(""),
  chapter: z.coerce.number().int().positive().optional(),
  text: z.string().max(60_000).optional().default(""),
  count: z.coerce.number().int().min(1).max(MAX_ITEMS),
  types: z.array(z.enum(TYPES)).min(1, "Kamida bitta savol turini tanlang"),
});

/** AI bilan yangi test (qoralama) → tahrirlagichga */
export async function createTest(_prev: FormState, form: FormData): Promise<FormState> {
  const { supabase, userId } = await requireUser();
  const opt = (k: string) => (form.get(k) === "" ? undefined : form.get(k) ?? undefined);
  const p = CreateSchema.safeParse({
    title: form.get("title"), source: form.get("source"), document: opt("document"), articles: opt("articles"), chapter: opt("chapter"),
    text: opt("text"), count: form.get("count"), types: form.getAll("types"),
  });
  if (!p.success) return { ok: false, message: p.error.issues[0]?.message ?? "Forma noto'g'ri to'ldirilgan." };
  const i = p.data;

  let source: TestSource;
  if (i.source === "articles") {
    if (!i.document) return { ok: false, message: "Hujjatni tanlang." };
    if (i.chapter) {
      source = { kind: "chapter", chapterId: i.chapter };
    } else {
      const numbers = parseArticleRange(i.articles);
      if (!numbers.length) return { ok: false, message: "Modda raqamlarini yozing (masalan: 1-10, 15) yoki bobni tanlang." };
      const { data } = await createSupabaseAdmin().from("articles").select("id").eq("document_id", i.document).in("number", numbers)
        .neq("status", "repealed").returns<{ id: number }[]>();
      if (!data?.length) return { ok: false, message: "Bu raqamdagi moddalar bazada topilmadi." };
      source = { kind: "articles", articleIds: data.map((a) => Number(a.id)) };
    }
  } else if (i.source === "text") {
    if (i.text.trim().length < 200) return { ok: false, message: "Matn kamida 200 belgi bo'lsin." };
    source = { kind: "text", text: i.text, documentId: i.document ?? null };
  } else {
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Faylni tanlang (PDF yoki rasm)." };
    if (file.size > MAX_FILE) return { ok: false, message: "Fayl 5 MB dan oshmasin." };
    const data = Buffer.from(await file.arrayBuffer()).toString("base64");
    let attachment: Attachment;
    if (file.type === "application/pdf") attachment = { kind: "pdf", data };
    else if ((IMAGE_TYPES as readonly string[]).includes(file.type)) attachment = { kind: "image", mediaType: file.type as (typeof IMAGE_TYPES)[number], data };
    else return { ok: false, message: "Faqat PDF, JPG, PNG yoki WEBP." };
    source = { kind: "file", attachment, note: i.text.slice(0, 2000), documentId: i.document ?? null };
  }

  const { data: premium } = await supabase.rpc("is_premium");
  const r = await createAiTest(userId, Boolean(premium), { title: i.title, field: null, source, count: i.count, types: i.types });
  if (!r.ok) return r;
  redirect(`/app/testlar/${r.value.id}?yangi=${r.value.created}`);
}

const ownTestId = (v: FormDataEntryValue | null) => z.coerce.number().int().positive().parse(v);

export async function saveMeta(form: FormData) {
  const { userId } = await requireUser();
  const id = ownTestId(form.get("test"));
  const p = z.object({ title: z.string().trim().min(3).max(120), description: z.string().trim().max(600), field: z.string().max(40) })
    .safeParse({ title: form.get("title"), description: form.get("description") ?? "", field: form.get("field") ?? "" });
  if (p.success) await createSupabaseAdmin().rpc("update_test_meta", { p_user: userId, p_test: id, p: p.data });
  revalidatePath(`/app/testlar/${id}`);
}

/** Savolni saqlash (klient komponentidan JSON) */
export async function saveItem(testId: number, itemId: number | null, input: unknown): Promise<FormState> {
  const { userId } = await requireUser();
  const r = await saveTestItem(userId, testId, itemId, input);
  if (!r.ok) return r;
  revalidatePath(`/app/testlar/${testId}`);
  return { ok: true, message: r.value.regraded ? "Saqlandi. Javob kaliti o'zgardi — natijalar qayta hisoblandi." : "Saqlandi." };
}

export async function removeItem(testId: number, itemId: number): Promise<FormState> {
  const { userId } = await requireUser();
  const { data } = await createSupabaseAdmin().rpc("remove_test_item", { p_user: userId, p_item: itemId });
  revalidatePath(`/app/testlar/${testId}`);
  return (data as { ok: boolean } | null)?.ok ? { ok: true, message: "Olib tashlandi." } : { ok: false, message: "Olib tashlab bo'lmadi." };
}

const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).optional();
/** datetime-local (Toshkent vaqti) → ISO */
const tashkent = (v: string | undefined) => (v ? new Date(`${v}:00+05:00`).toISOString() : undefined);

export async function publish(_prev: FormState, form: FormData): Promise<FormState> {
  const { userId } = await requireUser();
  const id = ownTestId(form.get("test"));
  const p = z.object({
    visibility: z.enum(["private", "link", "group", "public"]),
    group: z.coerce.number().int().positive().optional(),
    timer: z.coerce.number().int().min(0).max(240).optional(),
    opens: localDate, closes: localDate,
    max_attempts: z.coerce.number().int().min(0).max(20).optional(),
    reveal: z.enum(["each", "end", "after_close"]),
  }).safeParse({
    visibility: form.get("visibility"), group: form.get("group") || undefined, timer: form.get("timer") || undefined,
    opens: form.get("opens") || undefined, closes: form.get("closes") || undefined, max_attempts: form.get("max_attempts") || undefined,
    reveal: form.get("reveal"),
  });
  if (!p.success) return { ok: false, message: "Sozlamalar noto'g'ri." };
  const s = p.data;
  const settings = {
    ...(s.timer ? { timer_min: s.timer } : {}),
    ...(s.opens ? { opens_at: tashkent(s.opens) } : {}),
    ...(s.closes ? { closes_at: tashkent(s.closes) } : {}),
    ...(s.max_attempts ? { max_attempts: s.max_attempts } : {}),
    shuffle: form.get("shuffle") === "on",
    guests: form.get("guests") === "on",
    reveal: s.reveal,
  };
  const r = await publishTest(userId, id, s.visibility as Visibility, s.group ?? null, settings);
  revalidatePath(`/app/testlar/${id}`);
  if (!r.ok) return r;
  const mod = r.value.moderation;
  return {
    ok: true,
    message: mod === "rejected" ? `Nashr qilindi, lekin katalogga chiqmaydi: ${r.value.note ?? "moderatsiyadan o'tmadi"}. Havola ishlaydi.`
      : mod === "pending" ? "Nashr qilindi. Katalog uchun tekshiruv navbatida."
      : mod === "ok" ? "Nashr qilindi. Tekshiruvdan o'tdi — ishonch darajangiz ≥ 1 bo'lsa, katalogda ko'rinadi."
      : "Nashr qilindi.",
  };
}

export async function setStatus(form: FormData) {
  const { userId } = await requireUser();
  const id = ownTestId(form.get("test"));
  const status = z.enum(["hidden", "removed"]).parse(form.get("status"));
  await createSupabaseAdmin().rpc("set_test_status", { p_user: userId, p_test: id, p_status: status });
  if (status === "removed") redirect("/app/testlar");
  revalidatePath(`/app/testlar/${id}`);
}

/** Kod bo'yicha testni ochish */
export async function openByCode(form: FormData) {
  const code = normalizeCode(String(form.get("code") ?? ""));
  redirect(SHARE_CODE_RE.test(code) ? `/t/${code}` : "/app/testlar?xato=kod");
}
