"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { AiResult } from "@/lib/ai-server";
import { DOC_EXT } from "@/lib/legal";
import { createSupabaseBrowser } from "@/lib/supabase/client";

export function VerifyForm(props: {
  start: (mime: unknown, size: unknown) => Promise<AiResult<{ path: string; token: string }>>;
  submit: (license: unknown, path: unknown) => Promise<AiResult<true>>;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [license, setLicense] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, run] = useTransition();

  function send() {
    if (!file || pending) return;
    if (!DOC_EXT[file.type]) return setError("Faqat rasm (JPG, PNG, WEBP) yoki PDF.");
    if (file.size > 5 * 1024 * 1024) return setError("Fayl 5 MB dan oshmasin.");
    setError(null);
    run(async () => {
      const s = await props.start(file.type, file.size);
      if (!s.ok) return setError(s.message);
      const up = await createSupabaseBrowser().storage.from("lawyer-docs").uploadToSignedUrl(s.value.path, s.value.token, file, { contentType: file.type });
      if (up.error) return setError("Faylni yuklab bo'lmadi. Qayta urinib ko'ring.");
      const r = await props.submit(license, s.value.path);
      if (!r.ok) return setError(r.message);
      router.push("/app/yurist");
    });
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); send(); }} className="card space-y-3">
      <label className="block text-sm font-bold">Advokatlik guvohnomasi (litsenziya) raqami
        <input value={license} onChange={(e) => setLicense(e.target.value)} required minLength={3} maxLength={40}
          className="mt-1 w-full rounded-xl border-2 border-line bg-card px-3 py-2 font-normal outline-none focus:border-brand" />
      </label>
      <label className="block text-sm font-bold">Guvohnoma rasmi yoki PDF (5 MB gacha)
        <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-1 block w-full text-sm" />
      </label>
      {error && <p role="alert" className="text-sm font-semibold text-no">{error}</p>}
      <button className="btn-primary" disabled={!file || license.trim().length < 3 || pending}>{pending ? "Yuborilmoqda…" : "Tekshiruvga yuborish"}</button>
    </form>
  );
}
