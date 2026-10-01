# Femida Edu — production'ga chiqarish

V3 kodi tayyor (PR #1 → #2 → #4 → #5 → #6 → #7). Ishga tushirish uchun quyidagi kalitlar kerak, qolgan hamma ishni Claude terminal orqali qiladi.

## 1. Egasidan kerak bo'ladigan narsalar

| Nima | Qayerdan | Nima uchun |
|---|---|---|
| Supabase loyihasi: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `DATABASE_URL` (Session pooler) | supabase.com → yangi loyiha (Frankfurt) → Project Settings → API Keys / Connect | Baza, kirish, RLS |
| Vercel token (yoki loyihani GitHub'ga ulash) | vercel.com → Account → Tokens | Saytni joylash |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys | AI testlar, AI ustoz, moderatsiya |
| `TELEGRAM_BOT_TOKEN` (@FemidaEduBot) | @BotFather → /newbot | Bot, Mini App, Telegram orqali kirish |
| Domen (`femidaedu.uz`) DNS boshqaruvi | domen registratori | `NEXT_PUBLIC_SITE_URL` |
| Payme (ixtiyoriy, keyinroq) | DOYSE kassasi | Premium to'lovi |

`TELEGRAM_WEBHOOK_SECRET`, `CRON_SECRET`, `PAYME_FORWARD_SECRET` — Claude o'zi yaratadi (`openssl rand -hex 32`).

## 2. Tartib (Claude bajaradi)

```bash
cp .env.example .env.local          # kalitlar yoziladi (git'ga tushmaydi)
npm run prod:check                  # har bir kalit va xizmatni tekshiradi, hech narsani o'zgartirmaydi
npm run db:migrate -- --seed        # 19 ta migratsiya + seed
npm run db:import                   # v1 savollar bazasi (3 000+ savol)
npm run lex:import -- all           # 7 ta kodeks lex.uz'dan (ID'lar tekshirilgan, sarlavha 'expect' bilan solishtiriladi)
```

1. Vercel: loyiha yaratish, muhit o'zgaruvchilari (`.env.example` dagi hammasi), domen ulash, deploy.
2. `npm run bot:setup` — webhook, buyruqlar menyusi, Mini App tugmasi.
3. Jonli sinov (Playwright): kirish (Telegram), soha → modda → test, AI test yaratish → ulashish → mehmon sifatida ishlash,
   AI ustoz savoli, jonli viktorina (2 brauzer: host + o'quvchi), Premium sahifasi.
4. Admin: egasining profiliga `admin` roli va `trust_level = 3`.
5. PR'lar tartib bilan birlashtiriladi: #1 → #2 → #4 → #5 → #6 → #7 (har biri CI yashil bo'lgandan keyin).

## 3. Chiqishdan keyin

- `npm run lex:import -- all` — oyiga bir marta (qonun o'zgarsa, bog'langan savollar avtomatik tekshiruvga qaytadi).
- Sentry/loglar: Vercel → Logs; AI xarajati — `ai_usage` jadvali.
- Haftalik limitlar: bepul — 10 AI test (10 savolgacha), 10 AI ustoz savoli; jonli viktorina — 30 ishtirokchi.

## 4. Yangi yo'nalish: "hamma uchun huquq" (PR #9 → #11 → #12 → #13 → #15 → escrow)

| Bo'lim | Yoqish | Eslatma |
|---|---|---|
| Savol bering + hujjat tahlili (`/app/savol`) | `ANTHROPIC_API_KEY` | Hujjat: PDF ≤ 20 sahifa / rasm, ≤ 10 MB; fayl tahlildan keyin o'chiriladi |
| Yuristlar katalogi, arizalar, yozishma | Admin → Yuristlar → **Ochish** (`lawyers_enabled`) | Yuristlar bo'lim yopiq paytda ham ro'yxatdan o'ta oladi |
| Yurist xizmatlari uchun to'lov (escrow) | Admin → Escrow → **to'lovni yoqish** (`lawyer_payments_enabled`) | Komissiya kamida 20% |

⚠️ Escrow'ni yoqishdan oldin egasi hal qiladi: mijoz pulini ushlab turish va uchinchi shaxsga o'tkazish "To'lovlar va to'lov
tizimlari to'g'risida"gi qonun bo'yicha litsenziya talab qilishi, DOYSE/Payme shartnomasi va soliq oqibatlari; yuristlar bilan
agentlik/pudrat shartnomasi; faqat advokatlar sudda vakillik qila olishi; shaxsga doir ma'lumotlarni O'zbekistonda saqlash talabi.
Kunlik cron `/api/cron/tozalash`: tashlab ketilgan yuklamalarni o'chiradi va 3 kun o'tgan buyurtmalarni yakunlaydi.
