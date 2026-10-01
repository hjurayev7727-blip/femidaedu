"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { DOC_EXT, type DocMime } from "@/lib/legal";
import { LAWYER_DOCS_BUCKET, LICENSE_MAX_BYTES, type LawyerKind, type Result } from "@/lib/lawyers";
import { createSupabaseBrowser } from "@/lib/supabase/client";

const ACCEPT = Object.keys(DOC_EXT).join(",");

/** Guvohnoma (yoki diplom) raqami va rasmi: fayl brauzerdan to'g'ridan-to'g'ri yopiq bucket'ga, keyin admin navbatiga */
export function VerifyForm({ kind, createUpload, submit }: {
  kind: LawyerKind;
  createUpload: (file: unknown) => Promise<Result<{ path: string; token: string }>>;
  submit: (input: unknown) => Promise<Result<null>>;
}) {
  const router = useRouter();
  const [license, setLicense] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function pick(f: File | null) {
    setError(null);
    if (!f) return setFile(null);
    if (!(f.type in DOC_EXT)) return setError("Faqat rasm (JPG, PNG, WEBP) yoki PDF");
    if (f.size > LICENSE_MAX_BYTES) return setError("Fayl 5 MB dan katta");
    setFile(f);
  }

  function send() {
    if (!file || pending) return;
    const f = file;
    setError(null);
    const fail = (message: string) => {
      setStage(null);
      setError(message);
    };
    start(async () => {
      setStage("Yuklanmoqda…");
      const up = await createUpload({ mime: f.type as DocMime, size: f.size, name: f.name });
      if (!up.ok) return fail(up.message);
      const { error: upErr } = await createSupabaseBrowser().storage.from(LAWYER_DOCS_BUCKET)
        .uploadToSignedUrl(up.value.path, up.value.token, f, { contentType: f.type });
      if (upErr) return fail("Faylni yuklab bo'lmadi. Internetni tekshirib, qayta urinib ko'ring.");
      setStage("Tekshirilmoqda…");
      const r = await submit({ license, path: up.value.path });
      if (!r.ok) return fail(r.message);
      setStage(null);
      router.refresh();
    });
  }

  return (
    <form className="card space-y-4" onSubmit={(e) => { e.preventDefault(); send(); }}>
      <label className="block text-sm font-bold">
        {kind === "advokat" ? "Advokatlik litsenziyasi (guvohnoma) raqami" : "Yuridik ma'lumot haqidagi diplom raqami"}
        <input value={license} onChange={(e) => setLicense(e.target.value)} required minLength={3} maxLength={40}
          className="mt-1.5 w-full rounded-xl border-2 border-line bg-card px-3.5 py-2.5 font-semibold outline-none focus:border-brand" />
      </label>
      <div>
        <input id="license-file" type="file" accept={ACCEPT} className="sr-only" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
        <label htmlFor="license-file"
          className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed border-line px-4 py-6 text-center hover:border-brand/50">
          <span className="text-2xl" aria-hidden>🪪</span>
          <b>{file ? file.name : kind === "advokat" ? "Guvohnoma rasmini tanlang" : "Diplom rasmini tanlang"}</b>
          <span className="text-xs text-mute">{file ? `${(file.size / 1024 / 1024).toFixed(1)} MB · boshqasini tanlash uchun bosing` : "Rasm (JPG, PNG, WEBP) yoki PDF · 5 MB gacha"}</span>
        </label>
      </div>
      {error && <p role="alert" className="text-sm font-semibold text-no">{error}</p>}
      {stage && <p role="status" className="text-sm font-semibold text-mute">{stage}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-mute">🔒 Fayl yopiq saqlanadi, uni faqat admin ko&apos;radi va tekshiruvdan keyin o&apos;chiriladi.</p>
        <button className="btn-primary" disabled={pending || !file || license.trim().length < 3}>{pending ? "Yuborilmoqda…" : "Tekshiruvga yuborish"}</button>
      </div>
    </form>
  );
}
