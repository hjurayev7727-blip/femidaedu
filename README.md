# A+ Huquq 2.0

Huquq fanidan milliy sertifikat imtihoniga tayyorgarlik platformasi — **Next.js 16 + Supabase + Telegram**.
Reja: `../HUQUQSHUNOSLIK KURSI/05_TEXNIK_ONLAYN_TIZIM/PLATFORMA_2.0_REJA.md`

## Holat

**0-bosqich (poydevor)** ✅
- [x] Loyiha skeleti, dizayn tizimi (grafit + firuza, Manrope, tungi rejim)
- [x] Ma'lumotlar bazasi sxemasi + RLS (`supabase/migrations`) va boshlang'ich ma'lumot (`supabase/seed.sql`)
- [x] Telegram Login Widget orqali kirish (server tomonda imzo tekshiruvi) + Google orqali kirish
- [x] Profil: ism, maqsad, hudud, yozuv (lotin/kirill), Telegram'ni bog'lash

**1-bosqich (kontent va mashq)** ✅
- [x] v1 importi: 6 835 element → **3 023 unikal savol** (52 hujjat + 8–11-sinf darsliklari), hisobot: `data/v1/REPORT.md`
- [x] Mashq: mavzu/modul katalogi, 10 talik sessiya, 6 xil savol turi, izoh + modda, natija tahlili
- [x] Kunlik bepul limit (20 savol), xatolar navbati (Leitner 1→3→7→14→30 kun), streak — atomar SQL funksiyada
- [x] Kirill yozuvi: kontent ko'rsatishda o'giriladi, kirillda yozilgan javob ham qabul qilinadi
- [x] "Savolda xato bor" shikoyati

**2-bosqich (imtihon va takrorlash)** ✅
- [x] Sinov imtihoni: 45 topshiriq (35 yopiq + 10 yozma a/b), 90 daqiqa, server vaqtiga bog'langan taymer,
      avtomatik saqlash, navigator; qiyinlik taqsimoti 10/18/7 va ball 1,3/2,2/3,2 — jami 100 → 75 shkala → A+…C
- [x] Natija: daraja, keyingi darajagacha ball, yopiq/yozma qismlar, hujjatlar bo'yicha zaif joylar, to'liq tahlil
- [x] Bepul tarif: oyiga 1 ta sinov (atomar tekshiruv), tugallanmagan sinov davom ettiriladi
- [x] Takrorlash rejimi (muddati kelgan xatolar), kunlik test (hamma uchun bir xil 10 savol, kuniga bitta)
- [x] Yozma (qisqa javobli) savollar mashqqa ham qo'shildi; mobil pastki navigatsiya

**3-bosqich (Premium va to'lov)** ✅ — qo'lda to'lov
- [x] Tariflar (`plans`) va to'lov rekvizitlari admin paneldan o'zgartiriladi — narxlar: 1 oy — 49 000, 3 oy — 129 000 so'm
- [x] `/app/premium`: bepul va Premium solishtirmasi, karta rekvizitlari, chek yuklash (JPG/PNG/WEBP/PDF ≤ 5 MB,
      tur fayl baytlaridan tekshiriladi), to'lovlar tarixi va holati
- [x] Chek yopiq `receipts` bucket'ida; admin 10 daqiqalik imzolangan havola orqali ko'radi
- [x] `/admin/tolovlar`: tasdiqlash (obuna joriy muddat tugagan kundan uzaytiriladi) yoki sabab bilan rad etish
- [x] `/admin/sozlamalar`: tarif narxlari, karta raqami (bo'sh bo'lsa — to'lov formasi yopiq)
- [ ] Click / Payme / Uzum — merchant ma'lumotlari (YaTT yoki MChJ) kerak

**4-bosqich (Telegram bot va Mini App)** ✅
- [x] Webhook `/api/bot` (maxfiy token bilan): `/start` (hisobni bog'lash), `/kunlik`, `/natija`, `/sozlamalar`, `/yordam`
- [x] Mini App (`/tg`): Telegram ichida bir bosishda kirish (initData imzosi + Origin tekshiruvi)
- [x] Eslatmalar (Vercel Cron): 08:00 — kunlik test, 20:00 — bugun 10 savol yechmaganlarga streak eslatmasi;
      botni bloklaganlar avtomatik o'chiriladi; profil sahifasida yoqish/o'chirish
- [x] Sinov imtihoni natijasi botga yuboriladi

**5-bosqich (o'qituvchi paneli)** ✅
- [x] `/app/ustoz`: guruh ochish, taklif havolasi (nusxalash / Telegram'da ulashish), o'quvchi chiqarish
- [x] Guruh: o'quvchilar statistikasi (7 kun va umumiy aniqlik, streak, oxirgi sinov), zaif mavzular (30 kun)
- [x] Vazifalar: mavzu + savollar soni + muddat; bajarilish (kim bajardi, necha foiz); o'quvchi bosh sahifasida
- [x] `/app/qoshilish/<kod>`: o'quvchi bir bosishda qo'shiladi
- [x] Admin: rol berish (o'qituvchi, ekspert…), Premium sovg'a qilish, guruhni "Premium guruh" qilish

**6-bosqich (AI)** ✅ — Claude Opus 5.5 (`claude-opus-5-5`), rad etilsa server tomonda `fallbacks: "default"`
- [x] Yozma javobni AI qayta tekshirishi (matnli javob, mazmunan to'g'ri bo'lsa qabul qilinadi; sinov natijasiga ta'sir qilmaydi)
- [x] "AI'dan so'rash": javobdan keyin savol, izoh va manba asosida tushuntirish (Premium, kuniga 30 ta)
- [x] `/app/kontent`: savol generatori (muallif manba matnini joylashtiradi) → qoralama → ekspert tasdiqlaydi;
      shikoyatlarni ko'rib chiqish (to'g'ri shikoyat — savol muomaladan olinadi)
- [x] Har bir AI chaqiruvi `ai_usage` jadvaliga yoziladi (tokenlar, maqsad)
- [ ] Jonli API bilan sinov — `ANTHROPIC_API_KEY` qo'yilgach (hozircha soxta klient bilan testlangan)

**7-bosqich (motivatsiya)** ✅
- [x] Reyting (`/app/reyting`): haftalik va umumiy, viloyat bo'yicha; ball = aniqlik × 0,7 + faollik × 0,3;
      faqat "Ali V." ko'rinishidagi ism, profilda reytingdan chiqish
- [x] Nishonlar (9 ta): mashq/sinov/musobaqa yakunida avtomatik beriladi, botga xabar, profilda ko'rinadi
- [x] Musobaqalar: admin vaqt/davomiylik/savollar/mavzuni belgilaydi va botda e'lon qiladi; hamma bir xil savollarni
      ishlaydi, javoblar va natijalar tugagach ochiladi; o'rin — to'g'ri javoblar, teng bo'lsa vaqt; top-3 ga nishon

**8-bosqich (kalibrlash)** — vosita tayyor, real ma'lumot kutilmoqda
- [x] `npm run db:calibrate`: Rasch (JMLE) bilan savol qiyinligi, 10/18/7 toifalari, hisobot `data/calibration/REPORT.md`:
      javob kaliti shubhali savollar (ajratish kuchi manfiy) va yorlig'i noto'g'ri savollar
- [ ] ~200 ta sinov imtihoni yig'ilgach ishga tushirish, keyin `-- --apply` (sinov imtihoni kalibrlangan toifalarni ishlatadi)

**Kontent sifati va PWA**
- [x] `/app/kontent/savollar`: qidiruv, hujjat filtri, "javobi ko'zga tashlanadi" filtri; savolni tahrirlash
      (versiya oshadi — qayta import ustidan yozmaydi; ikki ekspert bir vaqtda tahrirlasa — to'qnashuv aniqlanadi)
- [ ] **1 074 ta savolda (41%) to'g'ri javob keskin uzun** — tahrir kerak (`data/v1/REPORT.md`)
- [x] PWA: manifest, ikonkalar, service worker (faqat statik fayllar keshlanadi), offline sahifa, xavfsizlik sarlavhalari

**Kurs o'quvchilarini ko'chirish:** v1 da akkaunt yo'q edi (ism + telefon), shuning uchun avtomatik ko'chirilmaydi.
Tartib: o'zingizga admin panelda "O'qituvchi" rolini bering → `/app/ustoz` da "A+ kurs 2026" guruhini oching →
`/admin/guruhlar` da uni "Premium guruh" qiling → taklif havolasini kurs Telegram guruhiga tashlang.

## Ishga tushirish

Node.js `~/.local/node` ga o'rnatilgan. Terminalda bir marta:

```bash
export PATH="$HOME/.local/node/bin:$PATH"
```

### 1. Supabase loyihasi

1. [supabase.com](https://supabase.com) → **New project** (region: Frankfurt `eu-central-1` — O'zbekistonga eng yaqin).
2. **Project Settings → API Keys** dan `URL`, `publishable` va `secret` kalitlarni, **Connect → Session pooler** dan
   `DATABASE_URL` ni oling.
3. `.env.example` ni `.env.local` ga nusxalab, qiymatlarni to'ldiring.
4. Sxema va boshlang'ich ma'lumot (qayta ishga tushirish xavfsiz — faqat yangi migratsiyalar qo'llanadi):

   ```bash
   npm run db:migrate -- --seed
   ```

5. **Authentication → Sign In / Providers → Email — o'chiring.** Platforma faqat Telegram va Google orqali
   kiritadi; ochiq email ro'yxati begona Telegram hisobini oldindan egallashga urinish uchun ishlatilishi mumkin
   (kod bundan himoyalangan, lekin keraksiz eshikni yopib qo'ygan ma'qul).

### 2. Telegram bot

1. [@BotFather](https://t.me/BotFather) → `/newbot` → token va username'ni `.env.local` ga yozing.
2. `/setdomain` → saytning domeni (masalan `aplushuquq.uz`). **Widget localhost'da ishlamaydi** — sinash uchun
   Vercel preview domeni yoki `ngrok` tunnelidan foydalaning va `NEXT_PUBLIC_SITE_URL` ni shunga moslang.

3. Webhook va menyu (sayt HTTPS domenda ishga tushgach): `.env.local` ga `TELEGRAM_WEBHOOK_SECRET`
   (`openssl rand -hex 32`) yozing, keyin `npm run bot:setup` (holatni ko'rish: `npm run bot:setup -- info`).
4. Vercel → Settings → Environment Variables: `CRON_SECRET` (`openssl rand -hex 32`) — eslatmalar `vercel.json`
   dagi jadval bo'yicha (03:00 va 15:00 UTC = 08:00 va 20:00 Toshkent) ishlaydi.

### 3. Google orqali kirish

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → OAuth client (Web) yarating.
   *Authorized redirect URI*: `https://<loyiha>.supabase.co/auth/v1/callback`
2. Supabase → **Authentication → Sign In / Providers → Google** → Client ID va Secret'ni kiriting.
3. Supabase → **Authentication → URL Configuration**:
   - *Site URL*: `NEXT_PUBLIC_SITE_URL` qiymati
   - *Redirect URLs*: `http://localhost:3000/auth/callback`, `https://<domen>/auth/callback`

### 4. Birinchi admin va to'lov sozlamalari

Kirgandan keyin Supabase SQL Editor'da:

```sql
update public.profiles set role = 'admin' where id = (select id from auth.users order by created_at limit 1);
```

Keyin `/admin/sozlamalar` da tarif narxlarini va to'lov qabul qilinadigan karta raqamini kiriting —
karta kiritilmaguncha `/app/premium` dagi to'lov formasi yopiq turadi.

### 5. Savollarni yuklash

`.env.local` ga `DATABASE_URL` qo'shing (Supabase → **Connect** → *Session pooler* satri, parol bilan), keyin:

```bash
npm run db:import
```

Import tranzaksiyada ishlaydi (xato bo'lsa hech narsa o'zgarmaydi) va qayta ishga tushirsa ham xavfsiz:
admin panelda tahrirlangan savollar (`version > 1`) qayta importda ustidan yozilmaydi.

v1 materiallari o'zgarsa, to'plamni qayta quring (`../HUQUQSHUNOSLIK KURSI` dan o'qiydi):

```bash
npm run import:build
```

### 6. Ishga tushirish

```bash
npm install
npm run dev        # http://localhost:3000  (Supabase'siz namunalar: /dev/savollar, /dev/imtihon, /dev/premium — faqat dev)
npm test           # 234 ta test: RLS, import, mashq/imtihon SQL funksiyalari (PGlite), baholash, transliteratsiya
npm run typecheck
npm run lint
```

## Xavfsizlik qoidalari (kod yozganda buzmang)

- **To'g'ri javob va izoh** (`questions.answer`, `explanation`) mijozga ochilmaydi — ustun GRANT'lari bilan yopilgan.
  Javobni tekshirish va izohni qaytarish faqat serverda (`createSupabaseAdmin`), foydalanuvchi huquqi tekshirilgandan keyin.
- **Ball, urinish, obuna, to'lov** jadvallariga mijoz yoza olmaydi — faqat server.
- `profiles.role`, `telegram_id`, `groups.grants_premium` ni foydalanuvchi o'zi o'zgartira olmaydi.
- `SUPABASE_SECRET_KEY` va `TELEGRAM_BOT_TOKEN` faqat serverda; hech qachon `NEXT_PUBLIC_` bilan boshlanmasin.
- Telegram'ni mavjud akkauntga bog'lash faqat profil sahifasidan boshlangan bo'lsa ishlaydi (`tg_link` cookie) —
  begona imzoli havola orqali akkauntni egallashdan himoya.
- Har bir yangi jadval/ustun uchun `tests/db.test.ts` ga RLS testi qo'shing.

## Tuzilma

```
src/
  proxy.ts                    sessiyani yangilash + yopiq bo'limlarga yo'naltirish (Next 16: middleware → proxy)
  app/
    page.tsx                  landing
    kirish/                   Telegram + Google
    app/                      o'quvchi kabineti (bosh sahifa, mashq, imtihon, takrorlash, premium, profil)
    app/ustoz                 o'qituvchi paneli; app/qoshilish — guruhga qo'shilish
    app/kontent               kontent paneli: AI generator, tasdiqlash, shikoyatlar
    admin/                    admin panel: to'lovlar, sozlamalar
    dev/                      Supabase'siz namunalar (faqat dev)
    api/auth/telegram/        widget qaytish manzili, bog'lash
    api/auth/telegram-webapp  Mini App orqali kirish
    api/bot, api/cron         bot webhook va eslatmalar
    tg/                       Mini App kirish sahifasi
    auth/callback, chiqish    Google OAuth, chiqish
  lib/
    questions.ts              savol modeli va javobni tekshirish
    grading-open.ts           yozma javob (v1 mantiqi: sonlar so'zda, xatoga chidamli)
    translit.ts               lotin ↔ kirill
    practice.ts               mashq: javobni yozish (server)
    mock.ts                   sinov rejasi, ball, daraja, tahlil (sof funksiyalar)
    mock-server.ts            sinovni boshlash / saqlash / baholash (server)
    payments.ts, receipt.ts   qo'lda to'lov: chekni tekshirish va yuklash
    ai.ts, ai-server.ts       Claude: qayta tekshirish, tushuntirish, savol generatori
    telegram.ts               Login Widget va Mini App imzosini tekshirish
    bot/                      Bot API klienti, buyruqlar, ommaviy xabar yuborish
    auth-telegram.ts          Telegram → Supabase foydalanuvchisi
    auth.ts                   requireUser / requireRole
    supabase/                 server, brauzer va admin klientlar
scripts/import/              v1 → data/v1/bundle.json → SQL (build.ts, load.ts)
data/v1/                      import to'plami va hisobot
supabase/
  migrations/                 sxema + RLS, mashq funksiyalari
  seed.sql                    spetsifikatsiya bo'limlari, standart mock shabloni, nishonlar
tests/                        vitest
```
