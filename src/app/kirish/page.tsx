import type { Metadata } from "next";
import Link from "next/link";
import { GoogleLogin } from "@/components/google-login";
import { Logo } from "@/components/logo";
import { TelegramLogin } from "@/components/telegram-login";
import { env, isConfigured } from "@/lib/env";
import { safeNext } from "@/lib/redirect";

export const metadata: Metadata = { title: "Kirish" };

const ERRORS: Record<string, string> = {
  telegram_imzo: "Telegram ma'lumotini tasdiqlab bo'lmadi. Qaytadan urinib ko'ring.",
  google: "Google orqali kirish yakunlanmadi. Qaytadan urinib ko'ring.",
  server: "Serverda xatolik. Birozdan keyin urinib ko'ring.",
  sessiya: "Kirish sessiyasi eskirgan. Sahifani yangilab, qayta urinib ko'ring.",
};

export default async function LoginPage({ searchParams }: PageProps<"/kirish">) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const next = safeNext(one(sp.keyin));
  const error = ERRORS[one(sp.xato) ?? ""];

  return (
    <main className="bg-hero flex flex-1 flex-col items-center justify-center px-4 py-10">
      <Logo />
      <div className="card mt-6 w-full max-w-sm p-6!">
        <h1 className="text-center text-xl font-extrabold tracking-tight">Kirish</h1>
        <p className="mt-1 text-center text-sm text-mute">Parol kerak emas — bir bosishda kiring</p>

        {error && (
          <p role="alert" className="mt-4 rounded-xl bg-no-soft px-4 py-3 text-sm font-semibold text-no">
            {error}
          </p>
        )}

        {!isConfigured ? (
          <p className="mt-5 rounded-xl bg-amber-soft px-4 py-3 text-sm">
            Platforma hali sozlanmagan: <code>.env.local</code> faylini to&apos;ldiring (README.md, 1-qadam).
          </p>
        ) : (
          <div className="mt-6 space-y-4">
            {env().NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ? (
              <TelegramLogin
                bot={env().NEXT_PUBLIC_TELEGRAM_BOT_USERNAME!}
                authUrl={`${env().NEXT_PUBLIC_SITE_URL}/api/auth/telegram?keyin=${encodeURIComponent(next)}`}
              />
            ) : (
              <p className="text-center text-sm text-mute">Telegram bot hali ulanmagan</p>
            )}
            <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-mute">
              <span className="h-px flex-1 bg-line" />
              yoki
              <span className="h-px flex-1 bg-line" />
            </div>
            <GoogleLogin next={next} />
          </div>
        )}

        <p className="mt-6 text-center text-xs text-mute">
          <Link href="/" className="underline">Bosh sahifaga qaytish</Link>
        </p>
      </div>
    </main>
  );
}
