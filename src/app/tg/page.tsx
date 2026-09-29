import type { Metadata } from "next";
import { safeNext } from "@/lib/redirect";
import { MiniAppLogin } from "./mini-app-login";

export const metadata: Metadata = { title: "Telegram orqali kirish" };

/** Telegram Mini App kirish nuqtasi (bot tugmalari va menyu shu yerga ochadi). */
export default async function TelegramEntry({ searchParams }: PageProps<"/tg">) {
  const sp = await searchParams;
  const next = safeNext(Array.isArray(sp.keyin) ? sp.keyin[0] : sp.keyin);
  return (
    <main className="bg-hero flex flex-1 flex-col items-center justify-center px-4 text-center text-white">
      <p className="bg-accent rounded-[14px] px-3 py-1.5 text-2xl font-extrabold">A+</p>
      <MiniAppLogin next={next} />
    </main>
  );
}
