// Bot yangilanishlarini (webhook) qayta ishlash. Baza va Bot API tashqaridan beriladi — test qilish oson.
import { esc, type BotApi, type InlineButton } from "@/lib/bot/api";

export type BotStats =
  | { found: false }
  | {
      found: true;
      name: string;
      streak: number;
      best: number;
      today: number;
      due: number;
      answered: number;
      last_mock: { grade: string | null; scaled: number; at: string } | null;
    };

export type BotDeps = {
  api: BotApi;
  siteUrl: string;
  stats(telegramId: number): Promise<BotStats>;
  /** bot_enabled ni o'rnatadi; profil topilmasa false */
  setBotEnabled(telegramId: number, enabled: boolean): Promise<boolean>;
};

type TgUser = { id: number; first_name?: string; is_bot?: boolean };
export type Update = {
  update_id: number;
  message?: { message_id: number; from?: TgUser; chat: { id: number; type: string }; text?: string };
  my_chat_member?: { chat: { id: number; type: string }; from: TgUser; new_chat_member: { status: string } };
};

/** Mini App kirish nuqtasi: foydalanuvchini tizimga kiritib, kerakli sahifaga olib boradi */
export function appUrl(siteUrl: string, path = "/app") {
  return `${siteUrl}/tg?keyin=${encodeURIComponent(path)}`;
}

export const openApp = (siteUrl: string, text: string, path = "/app"): InlineButton[][] => [[{ text, web_app: { url: appUrl(siteUrl, path) } }]];

export const HELP = [
  "<b>A+ Huquq</b> — huquqdan milliy sertifikatga tayyorgarlik.",
  "",
  "/kunlik — bugungi 10 ta savol",
  "/natija — streak, bugungi savollar, oxirgi sinov",
  "/sozlamalar — eslatmalarni yoqish/o'chirish",
  "/yordam — shu ro'yxat",
].join("\n");

export async function handleUpdate(u: Update, d: BotDeps): Promise<void> {
  // Foydalanuvchi botni bloklasa / qayta ochsa
  if (u.my_chat_member && u.my_chat_member.chat.type === "private") {
    const status = u.my_chat_member.new_chat_member.status;
    await d.setBotEnabled(u.my_chat_member.from.id, status === "member");
    return;
  }

  const m = u.message;
  if (!m?.text || m.chat.type !== "private" || !m.from || m.from.is_bot) return;
  const chat = m.chat.id;
  const tgId = m.from.id;
  const cmd = m.text.trim().split(/\s+/)[0].toLowerCase().replace(/@.*$/, "");

  switch (cmd) {
    case "/start": {
      const linked = await d.setBotEnabled(tgId, true);
      const hello = `Assalomu alaykum, ${esc(m.from.first_name ?? "do'st")}! 👋`;
      if (linked) {
        await d.api.sendMessage(
          chat,
          `${hello}\n\nHisobingiz bog'landi ✓ Endi kunlik test (08:00) va streak eslatmalari (20:00) shu yerga keladi.\n\n${HELP}`,
          { reply_markup: { inline_keyboard: openApp(d.siteUrl, "📚 Platformani ochish") } },
        );
      } else {
        await d.api.sendMessage(
          chat,
          `${hello}\n\n<b>A+ Huquq</b> — huquqdan milliy sertifikatga tayyorgarlik: 3 000+ savol, sinov imtihoni, izoh va qonun moddalari.\n\nBoshlash uchun pastdagi tugmani bosing — Telegram orqali bir bosishda kirasiz.`,
          { reply_markup: { inline_keyboard: openApp(d.siteUrl, "🚀 Boshlash") } },
        );
      }
      return;
    }
    case "/kunlik":
      await d.api.sendMessage(chat, "📝 <b>Kunlik test</b> — bugun hamma uchun bir xil 10 ta savol.", {
        reply_markup: { inline_keyboard: openApp(d.siteUrl, "Testni boshlash", "/api/kunlik") },
      });
      return;
    case "/natija": {
      const s = await d.stats(tgId);
      if (!s.found) {
        await d.api.sendMessage(chat, "Hisobingiz topilmadi. Avval platformaga kiring:", {
          reply_markup: { inline_keyboard: openApp(d.siteUrl, "🚀 Kirish") },
        });
        return;
      }
      await d.api.sendMessage(chat, statsText(s), { reply_markup: { inline_keyboard: openApp(d.siteUrl, "📊 Batafsil") } });
      return;
    }
    case "/sozlamalar":
      await d.api.sendMessage(chat, "Eslatmalarni profil sahifasida yoqish yoki o'chirish mumkin:", {
        reply_markup: { inline_keyboard: openApp(d.siteUrl, "⚙️ Sozlamalar", "/app/profil") },
      });
      return;
    default:
      await d.api.sendMessage(chat, HELP);
  }
}

export function statsText(s: Extract<BotStats, { found: true }>): string {
  const lines = [
    `<b>${esc(s.name || "Natijalaringiz")}</b>`,
    "",
    `🔥 Streak: <b>${s.streak} kun</b> (eng yaxshisi ${s.best})`,
    `📝 Bugun: <b>${s.today}</b> ta savol${s.today < 10 ? ` — streak uchun yana ${10 - s.today} ta` : " ✓"}`,
    `🔁 Takrorlash: <b>${s.due}</b> ta savol`,
    `📚 Jami javoblar: ${s.answered}`,
  ];
  if (s.last_mock) lines.push(`⏱ Oxirgi sinov: <b>${esc(s.last_mock.grade ?? "—")}</b> · ${Number(s.last_mock.scaled)} / 75`);
  return lines.join("\n");
}
