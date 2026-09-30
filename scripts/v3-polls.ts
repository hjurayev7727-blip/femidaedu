// V3 so'rovnomalarini Telegram kanal/guruhga yuborish va natijasini yig'ish.
//   npm run v3:polls                               — faqat ro'yxatni ko'rsatadi (hech narsa yuborilmaydi)
//   npm run v3:polls -- <chat_id> --send           — yuboradi (bot kanal/guruhda admin bo'lishi kerak)
//   npm run v3:polls -- <chat_id> --send --from 17 — 17-savoldan davom ettiradi
//   npm run v3:polls -- <chat_id> --results        — so'rovnomalarni yopadi, ovozlarni data/v3/results-<chat>.json ga yozadi
import { readFileSync, writeFileSync } from "node:fs";
import { BotApiError, createBotApi } from "../src/lib/bot/api";
import { loadPolls, sendPollParams } from "./v3/polls";

try {
  process.loadEnvFile(".env.local");
} catch {
  // o'zgaruvchilar muhitdan olinadi
}

const args = process.argv.slice(2);
const fromIdx = args.indexOf("--from");
const from = fromIdx >= 0 ? Number(args[fromIdx + 1]) || 1 : 1;
const chat = args.filter((a, i) => !a.startsWith("--") && !(fromIdx >= 0 && i === fromIdx + 1))[0];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
type Sent = { id: number; message_id: number };

async function retrying<T>(fn: () => Promise<T>): Promise<T> {
  for (;;) {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof BotApiError && e.retryAfter) await sleep(e.retryAfter * 1000);
      else throw e;
    }
  }
}

async function main() {
  const polls = loadPolls();
  const mode = args.includes("--send") ? "send" : args.includes("--results") ? "results" : "list";
  if (mode === "list" || !chat) {
    for (const p of polls) console.log(`${p.id}. [${p.block}] ${p.q}${p.multi ? " (bir nechta)" : ""}\n   - ${p.options.join("\n   - ")}`);
    console.log(`\n${polls.length} ta so'rovnoma. Yuborish: npm run v3:polls -- <chat_id> --send`);
    return;
  }
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN yo'q (.env.local)");
  const api = createBotApi(token);
  const sentFile = `data/v3/sent-${chat.replace(/[^\w-]/g, "")}.json`;

  if (mode === "send") {
    let sent: Sent[] = [];
    try {
      sent = JSON.parse(readFileSync(sentFile, "utf8"));
    } catch {
      // birinchi yuborish
    }
    for (const p of polls.filter((x) => x.id >= from)) {
      const m = await retrying(() => api.call<{ message_id: number }>("sendPoll", sendPollParams(chat, p)));
      sent = [...sent.filter((s) => s.id !== p.id), { id: p.id, message_id: m.message_id }];
      writeFileSync(sentFile, JSON.stringify(sent, null, 2));
      console.log(`✓ ${p.id}`);
      await sleep(3000); // a'zolarga bir vaqtda 40 ta bildirishnoma ketmasligi uchun
    }
    return;
  }

  const sent: Sent[] = JSON.parse(readFileSync(sentFile, "utf8"));
  const results = [];
  for (const s of sent) {
    const poll = await retrying(() =>
      api.call<{ total_voter_count: number; options: { text: string; voter_count: number }[] }>("stopPoll", { chat_id: chat, message_id: s.message_id }),
    );
    const total = poll.total_voter_count || 1;
    results.push({
      id: s.id,
      voters: poll.total_voter_count,
      options: poll.options.map((o) => ({ text: o.text, votes: o.voter_count, pct: Math.round((o.voter_count / total) * 100) })),
    });
    console.log(`${s.id}: ${poll.total_voter_count} ovoz`);
  }
  writeFileSync(`data/v3/results-${chat.replace(/[^\w-]/g, "")}.json`, JSON.stringify(results.sort((a, b) => a.id - b.id), null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
