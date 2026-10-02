"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { AiResult } from "@/lib/ai-server";
import { DOC_EXT, DOC_MAX_BYTES, DOC_MAX_PAGES } from "@/lib/legal";
import type { DocReply } from "@/lib/legal-server";
import { createSupabaseBrowser } from "@/lib/supabase/client";

/** Hujjat yuklash: fayl brauzerdan to'g'ridan-to'g'ri yopiq omborga (imzolangan havola), keyin server tahlil qiladi va faylni o'chiradi */
export function DocUpload(props: {
  start: (mime: unknown, size: unknown) => Promise<AiResult<{ path: string; token: string }>>;
  analyze: (path: unknown, name: unknown, question: unknown) => Promise<AiResult<DocReply>>;
  aiReady: boolean;
  weekUsed: number;
  weekLimit: number;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [question, setQuestion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<string | null>(null);
  const [pending, run] = useTransition();
  const left = Math.max(props.weekLimit - props.weekUsed, 0);

  function pick(f: File | null) {
    setError(null);
    if (f && !DOC_EXT[f.type]) return setError("Faqat PDF yoki rasm (JPG, PNG, WEBP)."), setFile(null);
    if (f && f.size > DOC_MAX_BYTES) return setError("Fayl 10 MB dan katta."), setFile(null);
    setFile(f);
  }

  function submit() {
    if (!file || pending) return;
    setError(null);
    run(async () => {
      setStage("Yuklanmoqda…");
      const s = await props.start(file.type, file.size);
      if (!s.ok) return setError(s.message), setStage(null);
      const up = await createSupabaseBrowser().storage.from("legal-uploads").uploadToSignedUrl(s.value.path, s.value.token, file, { contentType: file.type });
      if (up.error) return setError("Faylni yuklab bo'lmadi. Internetni tekshirib, qayta urinib ko'ring."), setStage(null);
      setStage("Hujjat o'qilmoqda va moddalar bilan solishtirilmoqda… (1–2 daqiqa)");
      const r = await props.analyze(s.value.path, file.name, question);
      setStage(null);
      if (!r.ok) return setError(r.message);
      router.push(`/app/savol/${r.value.threadId}`);
    });
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="card space-y-3 !p-4">
      <label className="block rounded-xl border-2 border-dashed border-line px-4 py-6 text-center hover:border-brand/50">
        <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only"
          onChange={(e) => pick(e.target.files?.[0] ?? null)} disabled={pending} />
        <span className="block text-3xl" aria-hidden>📄</span>
        <b className="mt-1 block">{file ? file.name : "Shartnoma, ariza yoki da'vo xatini tanlang"}</b>
        <span className="text-xs text-mute">PDF ({DOC_MAX_PAGES} sahifagacha) yoki telefon rasmi · 10 MB gacha</span>
      </label>
      <label className="block text-sm font-bold">
        Savolingiz (ixtiyoriy)
        <textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={2} maxLength={1000} disabled={pending}
          placeholder="Masalan: Bu ijara shartnomasini imzolasam bo'ladimi? Qaysi bandlar xavfli?"
          className="mt-1 w-full resize-y rounded-xl border-2 border-line bg-card px-3 py-2 font-normal outline-none focus:border-brand" />
      </label>
      {stage && <p role="status" className="text-sm font-semibold text-brand-2">{stage}</p>}
      {error && <p role="alert" className="text-sm font-semibold text-no">{error}</p>}
      {!props.aiReady && <p className="text-sm font-semibold text-amber">AI yordamchi hali ulanmagan.</p>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-mute">Bu hafta yana {left} ta hujjat · fayl tahlildan so&apos;ng darhol o&apos;chiriladi</p>
        <button className="btn-primary !py-2.5" disabled={!file || pending || !props.aiReady || left === 0}>{pending ? "Tahlil qilinmoqda…" : "Tahlil qilish"}</button>
      </div>
    </form>
  );
}
