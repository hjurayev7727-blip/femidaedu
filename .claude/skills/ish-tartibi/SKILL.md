---
name: ish-tartibi
description: Loyiha egasi (Femida Edu / A+ Huquq) bilan ish tartibi — har qanday topshiriq boshida o'qing. Claude hamma ishni o'zi terminal va Chromium orqali qiladi, egasiga ish buyurmaydi, faqat imkonsiz holatda qisqa xabar beradi; so'rovnoma, hisobot, git/PR, tekshiruv va muhit cheklovlari qoidalari.
---

# Ish tartibi (egasi bilan kelishuv, 2026-09-30)

Egasi: "Hamma narsani o'zing qil, menga ish buyurma. Faqat juda zarur bo'lsa tasdiqlayman."
Bu qoidalar `femidaedu` va `aplushuquq` repolaridagi **barcha** topshiriqlarga tegishli.

## 1. Avtonomiya

- Hamma ishni **o'zing** qil: terminal (git, npm, skriptlar, SQL), Chromium/Playwright (`/opt/pw-browsers/chromium`) —
  sahifani ochish, skrinshot, tekshirish. Egasiga "buni qiling" deb ish topshirma.
- Egasi PR'larni **merge qilishni ham** senga topshirgan. Production'ga chiqish tartibi — 4-bo'limda.
- Imkonsiz narsa chiqsa (ruxsat yo'q, tarmoq yopiq) — avval **qonuniy aylanib o'tish yo'lini izla** (boshqa manba,
  boshqa vosita, lokal alternativa, qidiruv tizimi, DNS). Xavfsizlik cheklovlarini (proxy, ruxsatlar, parollar)
  chetlab o'tma, berilmagan hisob ma'lumotlaridan foydalanma. Yo'l topilmasa — hammasini tayyorlab qo'y va egasiga
  **bitta qisqa** xabar yoz: nima kerak va qayerda bosiladi (masalan, repo ochish, kalit berish).
- Qaytarib bo'lmaydigan amallar (o'chirish, force-push, production, foydalanuvchilarga xabar) egasi ruxsat bergan,
  lekin: avval zaxira ol, qaytariladigan yo'lni tanla (merge commit, force-push emas), keyin hisobotda ayt.

## 2. So'rovnomalar (poll)

- Egasi "kamida N ta poll" desa — `AskUserQuestion` bilan 4 tadan raund qilib o'tkaz, har savolda tavsiya variant birinchi.
- Egasi so'ramasa, o'zi qaror qil; mantiq haqiqatan noaniq bo'lsagina so'ra.
- Har bir javobni `data/v3/polls.json` ga yoz (`block`, `q`, `options`, `owner` — egasining javobi, `decision` — qaror),
  keyin `docs/V3_REJA.md` / `docs/BREND.md` ni yangila. `tests/v3-polls.test.ts` o'tishi shart.
- Javoblar orasida ziddiyat bo'lsa — tavsiya bilan hujjatga yoz, keyingi raundda aniqlashtir.

## 3. Hisobot

- Faqat **muhim voqealarda**: katta qism tugadi, to'siq chiqdi, production. 5–10 qator, o'zbek tilida (lotin),
  skrinshot/havola bilan. Har qadamni hikoya qilma.
- PR yoki issue havolasi — to'liq URL bilan markdown havola.

## 4. Git va PR

- `femidaedu` — Femida Edu (alohida mahsulot). `aplushuquq` — A+ Huquq, **o'zgartirilmaydi** (faqat shu skill kabi yordamchi fayllar).
- V3 qismlari tartibi: brend → qonun bazasi → sohalar katalogi → AI test + ulashish → AI ustoz → jonli viktorina.
  Har qism o'z branch'i va draft PR'i, oldingi qism ustiga (stacked). PR'lar **to'liq V3 tayyor bo'lguncha ochiq** turadi,
  keyin tartib bilan merge qilinadi va production'ga chiqariladi.
- Commit xabari inglizcha, qisqa sarlavha + nima uchun. Force-push faqat o'zingning, hech kim ishlatmagan branch'ingda.

## 5. Push'dan oldin tekshiruv (majburiy)

```bash
npx vitest run                 # hamma testlar
npx eslint .                   # xato bo'lmasin (ogohlantirishlar — faqat sening yangi kodingda tuzat)
npx next typegen && npx tsc --noEmit
NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=x \
  NEXT_PUBLIC_SITE_URL=http://localhost:3100 npx next build
```
UI o'zgarsa: `next start -p 3100` + Playwright skrinshotlar (yorug'/tungi, 1280 px va 390 px), o'zing ko'rib chiq.
Serverni to'xtatish: `pkill -f "[n]ext-server"` (naqshni `[n]` bilan yoz — aks holda buyruq o'z shell'ini o'ldiradi).
`node_modules` ni symlink qilma — Turbopack build qabul qilmaydi; `npm ci` qil.

## 6. Muhit cheklovlari (bulut konteyner)

- Tarmoq proxy'si `.uz` saytlar, `t.me`, whois xizmatlarini yopadi; DNS ishlaydi (`npm run brand:check`).
  npm, Google Fonts, qidiruv (WebSearch) ishlaydi.
- lex.uz yopiq → `npm run lex:import -- KOD --file matn.txt` yoki egasining kompyuterida/Vercel'da import.
- GitHub: yangi repo yaratish ruxsati yo'q (403) — egasidan so'rash kerak bo'lgan kam holatlardan biri.
- Konteyner vaqtinchalik: ishni tez-tez commit + push qil, lokal qoldirma.

## 7. Brend (o'zgarmas qarorlar)

- Nom: **Femida Edu**; logo S1 (`src/components/logo.tsx`): Playfair "Femida", oltin "i" nuqtasi, oltin nishonchadagi EDU.
- Ranglar: navy `#0e2340`, brand (harakat) `#1e3a66` / tungida `#6f97d6`, oltin `#b08a3a`/`#cfab5e`; to'g'ri/xato — yashil/qizil.
- Shrift: sarlavhalar Playfair Display, matn Manrope. Avatar/ilova ikonkasi — tarozi tutgan Femida haykali, favicon — oltin nuqtali F.
- Shior: "Huquq bo'yicha hammasi bir joyda". Yuridik: "YURISTIM TEAM MChJ mahsuloti". Payme buyurtmalari `F…`.
