// Brend nomlari bandligini tekshirish: domenlar (DNS) va Telegram username'lari (t.me sahifasi).
//   npm run brand:check                          — standart ro'yxat (femidaedu.uz, @FemidaEduBot …)
//   npm run brand:check -- femidaedu.uz @FemidaEduBot
// DNS yozuvi yo'q ≠ 100% bo'sh: yakuniy tekshiruv — domen registratori (cctld.uz ro'yxatidagi) saytida.
import { resolveNs, resolve4 } from "node:dns/promises";

const DEFAULT = ["femidaedu.uz", "femida.uz", "femidaedu.com", "@FemidaEduBot", "@FemidaEdu", "@FemidaUzBot"];

async function checkDomain(domain: string) {
  try {
    const ns = await resolveNs(domain);
    return `BAND (NS: ${ns.slice(0, 2).join(", ")})`;
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === "ENOTFOUND") return "bo'sh bo'lishi mumkin (DNS'da yo'q) — registratorda tasdiqlang";
    try {
      await resolve4(domain);
      return "BAND (A yozuvi bor)";
    } catch {
      return `aniq emas (${code}) — registratorda tekshiring`;
    }
  }
}

async function checkTelegram(username: string) {
  const res = await fetch(`https://t.me/${username}`, { redirect: "follow" });
  if (!res.ok) return `tekshirib bo'lmadi (HTTP ${res.status})`;
  const html = await res.text();
  if (!html.includes("tgme_page")) return "tekshirib bo'lmadi (t.me sahifasi emas — tarmoq bloklagan bo'lishi mumkin)";
  // Mavjud profil/bot/kanal sahifasida tgme_page_title bo'ladi; yo'q username'da — umumiy "Contact" sahifasi
  const title = html.match(/<div class="tgme_page_title"[^>]*><span[^>]*>([^<]+)</)?.[1];
  if (title) return `BAND ("${title.trim()}")`;
  return "bo'sh ko'rinadi — @BotFather'da /newbot bilan tasdiqlang";
}

async function main() {
  const items = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT;
  for (const item of items) {
    try {
      const result = item.startsWith("@") ? await checkTelegram(item.slice(1)) : await checkDomain(item);
      console.log(`${item.padEnd(20)} ${result}`);
    } catch (e) {
      console.log(`${item.padEnd(20)} tekshirib bo'lmadi: ${(e as Error).message}`);
    }
  }
}

main();
