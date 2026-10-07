// «Sulton Juraev | Hamjamiyat · AI» guruhi (@huquq_klubi muhokama guruhi). Bot u yerda admin — HAMMA xabarni oladi,
// shuning uchun faqat: qo'shilish so'rovini tasdiqlash, @eslatma/javobga qisqa javob va kuniga 1 ta post.
// Salomlashish, spam va «avval botni oching» — A+ botining ishi, bu yerda yo'q.
import { esc, type BotApi, type InlineButton } from "@/lib/bot/api";

export const HAMJAMIYAT_DEFAULT_ID = -1003651189754;
export const BOT_USERNAME_DEFAULT = "femidaedu_bot";
/** Bir foydalanuvchiga kuniga javoblar va butun guruhga kuniga javoblar (limit tugasa — jim) */
export const USER_DAILY_ANSWERS = 5;
export const CHAT_DAILY_ANSWERS = 40;
export const ANSWER_MAX = 700;
/** Kunlik post oynasi (Toshkent soati): 18:00–19:59; 20:00–22:00 — post yo'q */
export const POST_HOURS = { from: 18, to: 20 };

export function hamjamiyatChatId(): number {
  const n = Number(process.env.HAMJAMIYAT_CHAT_ID);
  return Number.isSafeInteger(n) && n < 0 ? n : HAMJAMIYAT_DEFAULT_ID;
}

export const startLink = (username: string) => `https://t.me/${username}?start=hamjamiyat`;
export const botButton = (username: string, text = "⚖️ Femida Edu botini ochish"): InlineButton[][] => [[{ text, url: startLink(username) }]];

type TgUser = { id: number; is_bot?: boolean; first_name?: string; username?: string };
export type GroupMessage = {
  message_id: number;
  from?: TgUser;
  sender_chat?: { id: number };
  is_automatic_forward?: boolean;
  chat: { id: number; type: string };
  text?: string;
  caption?: string;
  reply_to_message?: { message_id: number; from?: TgUser; text?: string; caption?: string };
};
export type JoinRequest = { chat: { id: number; type: string }; from: TgUser; user_chat_id?: number };

export type CommunityDeps = {
  chatId: number;
  botId: number;
  username: string;
  /** Shu Telegram ID li profil bormi */
  knownUser(telegramId: number): Promise<boolean>;
  /** Atomar kunlik limit (foydalanuvchi + guruh); false — limit tugagan */
  consume(telegramId: number): Promise<boolean>;
  /** Qisqa javob (oddiy matn) yoki null — AI ishlamadi */
  answer(question: string, context: string | null): Promise<string | null>;
};

/** Qo'shilish so'rovini tasdiqlash; so'rov bo'lmasa/eskirgan bo'lsa Telegram xato beradi — jim yutamiz */
export async function approveJoin(api: BotApi, chatId: number, userId: number): Promise<boolean> {
  try {
    await api.call("approveChatJoinRequest", { chat_id: chatId, user_id: userId });
    return true;
  } catch {
    return false;
  }
}

export async function handleJoinRequest(r: JoinRequest, api: BotApi, c: CommunityDeps): Promise<void> {
  if (r.chat.id !== c.chatId || r.from.is_bot) return;
  if (await c.knownUser(r.from.id).catch(() => false)) await approveJoin(api, c.chatId, r.from.id);
}

const mentionRe = (username: string) => new RegExp(`@${username.replace(/[^\w]/g, "")}\\b`, "gi");

/** Xabar botga qaratilganmi: @eslatma yoki bot xabariga javob */
export function isAddressed(m: GroupMessage, c: Pick<CommunityDeps, "botId" | "username">): boolean {
  // Guruhda buyruqlar (/start@bot va h.k.) ishlanmaydi — faqat oddiy savol
  if ((m.text ?? m.caption ?? "").trimStart().startsWith("/")) return false;
  if (m.reply_to_message?.from?.id === c.botId) return true;
  return mentionRe(c.username).test(m.text ?? m.caption ?? "");
}

/** AI matnini guruh uchun tozalash: Markdown belgilarisiz, ≤ max belgi, so'z chegarasida */
export function clipAnswer(text: string, max = ANSWER_MAX): string {
  const t = text.replace(/\*\*|__|`+/g, "").replace(/^#+\s*/gm, "").replace(/\n{3,}/g, "\n\n").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const at = cut.lastIndexOf(" ");
  return `${(at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[\s,.;:—-]+$/, "")}…`;
}

/**
 * Guruhdagi xabar. Kanal postlari (sender_chat / avtomatik forward), botlar va botga qaratilmagan xabarlar — e'tiborsiz:
 * hech narsa yozilmaydi, o'chirilmaydi, bazaga tegilmaydi.
 */
export async function handleGroupMessage(m: GroupMessage, api: BotApi, c: CommunityDeps): Promise<void> {
  if (m.chat.id !== c.chatId || m.sender_chat || m.is_automatic_forward || !m.from || m.from.is_bot) return;
  if (!isAddressed(m, c)) return;
  const question = (m.text ?? m.caption ?? "").replace(mentionRe(c.username), "").trim().slice(0, 1500);
  const quoted = m.reply_to_message?.text ?? m.reply_to_message?.caption ?? null;
  if (!question && !quoted) return;
  if (!(await c.consume(m.from.id))) return;

  await api.call("sendChatAction", { chat_id: m.chat.id, action: "typing" }).catch(() => {});
  const raw = await c.answer(question || "Shu xabarni tushuntirib bering.", quoted ? quoted.slice(0, 1000) : null);
  if (!raw) return;
  await api.call("sendMessage", {
    chat_id: m.chat.id,
    text: esc(clipAnswer(raw)),
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    reply_parameters: { message_id: m.message_id, allow_sending_without_reply: true },
    reply_markup: { inline_keyboard: botButton(c.username) },
  });
}

/** Toshkent sanasi (YYYY-MM-DD) va soati */
export function tashkentClock(now: Date): { day: string; hour: number } {
  const day = now.toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" });
  const hour = Number(now.toLocaleString("en-GB", { timeZone: "Asia/Tashkent", hour: "2-digit", hour12: false }));
  return { day, hour: hour % 24 };
}

export type DailyTip = { text: string; source: string | null };
export type DailyPostDeps = {
  api: BotApi;
  chatId: number;
  username: string;
  now: Date;
  /** Shu sana uchun post huquqini band qiladi; false — allaqachon yuborilgan (takror yo'q) */
  claim(day: string): Promise<boolean>;
  /** Yuborilmasa — bandlikni bo'shatish (qo'lda qayta urinish mumkin bo'lsin) */
  release(day: string): Promise<void>;
  tip(day: string): Promise<DailyTip>;
};

export function dailyPostHtml(t: DailyTip): string {
  return [`⚖️ <b>Kun saboqchasi · Femida Edu</b>`, "", esc(clipAnswer(t.text, 650)), ...(t.source ? ["", `📚 Manba: ${esc(t.source)}`] : [])].join("\n");
}

export type DailyPostResult = "posted" | "duplicate" | "outside_hours";

/** Kuniga bitta post (18:00 Toshkent, cron). Sana bo'yicha band qilinadi — ikki marta chaqirilsa ham bitta post. */
export async function postDailyTip(d: DailyPostDeps): Promise<DailyPostResult> {
  const { day, hour } = tashkentClock(d.now);
  if (hour < POST_HOURS.from || hour >= POST_HOURS.to) return "outside_hours";
  if (!(await d.claim(day))) return "duplicate";
  try {
    const tip = await d.tip(day);
    await d.api.sendMessage(d.chatId, dailyPostHtml(tip), {
      reply_markup: { inline_keyboard: botButton(d.username, "📚 Femida Edu'da o'rganish") },
      disable_notification: true,
    });
    return "posted";
  } catch (e) {
    await d.release(day).catch(() => {});
    throw e;
  }
}

/** AI yoki qonun bazasi ishlamasa — tayyor saboqchalar (sana bo'yicha aylanadi) */
export const FALLBACK_TIPS: DailyTip[] = [
  { text: "Qonun moddasini o'qiganda avval dispozitsiyani (qoida nima deydi), keyin sanksiyani (buzilsa nima bo'ladi) ajrating. Shunda eng uzun modda ham ikki gapga sig'adi.", source: null },
  { text: "Muddatlarni yodlashning oson yo'li: har bir muddatni hayotiy vaziyatga bog'lang. Masalan, mehnat shartnomasidagi sinov muddati — «yangi ishda 3 oylik tanishuv».", source: null },
  { text: "Kodeksning 1-bobi — butun hujjatning kaliti: unda asosiy tushunchalar beriladi. Qolgan moddalarni tushunish uchun avval shu bobni o'qing.", source: null },
  { text: "Huquqni o'rganishda eng samarali usul — kazus: vaziyatni o'qing, qaysi munosabat ekanini aniqlang, modda toping va qo'llang. Femida Edu'dagi AI ustoz aynan shunday ishlaydi.", source: null },
  { text: "Bir kunda 10 ta savol yechish bir haftada 70 ta moddani takrorlash degani. Oz-ozdan, lekin har kuni — huquqni o'rganishning eng ishonchli yo'li.", source: null },
];

export function fallbackTip(day: string): DailyTip {
  const n = Math.floor(Date.parse(day) / 86_400_000);
  return FALLBACK_TIPS[((n % FALLBACK_TIPS.length) + FALLBACK_TIPS.length) % FALLBACK_TIPS.length];
}
