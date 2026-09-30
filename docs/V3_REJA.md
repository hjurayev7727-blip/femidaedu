# DOYSE V3 — yagona huquq platformasi: AI bilan test yaratish va ulashish

> Holat: **loyiha hujjati (reja)**, kod hali yozilmagan. Asos: hozirgi A+ Huquq 2.0 kodi (shu repo).
> Qarorlar: loyiha egasi bilan 41 + 20 savollik so'rovnoma (2026-09-30), `data/v3/polls.json`.

## Yangilanish (so'rovnoma 70–93): Femida Edu — alohida mahsulot

- A+ Huquq **o'zgarmaydi** va ishlashda davom etadi. Femida Edu — alohida repo (`femidaedu`), alohida Supabase, alohida bot,
  DOYSE kassasi orqali `F…` buyurtmalar. A+ savollari (3 023) nusxa ko'chiriladi; A+ Premium egalariga birinchi oy 50% chegirma.
- Production — **to'liq V3 tayyor bo'lgach**. Tartib: repo + brend → qonun bazasi (lex.uz) → sohalar katalogi → AI test + ulashish →
  AI ustoz → jonli viktorina. Har qism alohida PR, Vercel preview'da egasi tasdiqlaydi.
- Quyidagi "shu tizimning evolyutsiyasi" degan joylar endi "A+ kodidan boshlangan yangi mahsulot" deb o'qilsin.

## 0. Qisqa xulosa

1. **Faqat huquq, ikki yo'nalish.**
   - **Milliy sertifikat** — hozirgi A+ Huquq (sinov imtihoni, kunlik test, reyting).
   - **Huquq sohalari** — istalgan sohani mustaqil o'rganish. Talaba, yurist, fuqaro va davlat xizmatchisi uchun.
   Barcha sohalar bo'ladi, muhimlari chuqurroq (A/B/C).
2. **Qonun bazasi — poydevor.** lex.uz dan modda-modda import qilinadi. Barcha AI testlari faqat bazadagi rasmiy
   matnga bog'lanadi: har savolda modda bo'lishi shart.
3. **AI bilan test yaratish — hamma uchun.** Manba: soha/mavzu, modda raqami, o'z matni yoki PDF, rasm. Savollar
   soni 5–50, har savolni tahrirlash mumkin. Bepul foydalanuvchiga haftasiga 10 ta test.
4. **Ulashish:** havola, Telegram tugmasi, 6 belgili kod, guruhga vazifa. Ko'rinish: faqat men / havola / guruh /
   hamma. Nusxalash yo'q. Mehmon ishlay oladi. Muallif natijalarni ism bilan ko'radi.
5. **Birinchi versiyada 4 ta katta qism**: sohalar katalogi, AI test + ulashish, AI ustoz, jonli viktorina.
   Taxminiy muddat — 12–14 hafta, oldin qonun bazasi.
6. **Pul:** ikki tarif ("Sertifikat" va "Sohalar"), har biri 39 000 so'm/oy, ikkalasi 59 000. Markazlar uchun paketlar.
   Mualliflarga bonus, pullik testlarda DOYSE 50%.
7. **Ishga tushirish:** hamma qism sinov muhitida to'liq sinovdan o'tadi, egasi qabul qilgach production.

## 1. So'rovnoma natijalari (sizning javoblaringiz)

### A. Qamrov va auditoriya

| # | Savol | Javobingiz | Qaror |
|---|---|---|---|
| 1 | V3 qamrovi qanday bo'lsin? | **Faqat huquq: Milliy sertifikat yoki istalgan huquq sohasini mustaqil o'rganish** | Ikki yo'nalish: 'Milliy sertifikat' (hozirgi A+) va 'Huquq sohalari'. Boshqa fanlar yo'q — 'subject' qatlami kerak emas, o'rniga 'track' (yo'nalish) va 'field' (soha). |
| 2 | "Huquq sohalari" yo'nalishi kim uchun? | **Hammasi; turli sohalar qiziq va chiroyli bo'lsin** | To'rt auditoriya. Profilda 'maqsad' kengayadi (abituriyent / talaba / yurist / fuqaro / davlat xizmatchisi) va bosh sahifa shunga moslashadi. Dizayn: har sohaning o'z rangi va ikonkasi. |
| 3 | Birinchi navbatda qaysi huquq sohalari? | **Barcha huquq sohalari; muhimlariga ko'proq, kam mashhurlarga kamroq e'tibor** | Barcha sohalar katalogda bor, hajmi A/B/C ustuvorlik bilan (27-savol). |
| 4 | Mustaqil o'rganish qanday bo'lsin? | **Hammasi** | Soha sahifasida 4 rejim: modda→test, konspekt+test, AI ustoz, kazuslar. |
| 5 | Asosiy kanal qaysi bo'lsin? | **Telegram Mini App** | Telegram-first. Sayt — o'sha kod, PWA. Native ilova yo'q. |

### B. AI bilan test yaratish

| # | Savol | Javobingiz | Qaror |
|---|---|---|---|
| 6 | Foydalanuvchi AI bilan testni nimadan tuzsin? | **Hammasi** | To'rt manba. Mavzu va modda — bazadan; matn/PDF/rasm — foydalanuvchi materiali, lekin har savol bazadagi moddaga bog'lanishi shart (7-savol). |
| 7 | AI testlari qonun matniga qanchalik bog'liq bo'lsin? | **Faqat bazadagi rasmiy matndan** | Har savolda article_id majburiy. Bazadagi moddaga bog'lab bo'lmagan savol rad etiladi. Shuning uchun lex.uz importi (39) birinchi ish. |
| 8 | Qaysi savol turlari? | **Hammasi** | Mavjud turlar + true_false. AI hammasini yarata oladi. |
| 9 | Bitta AI testda nechta savol? | **Foydalanuvchi tanlaydi (5–50)** | 5–50, AI 10 talik bo'laklarda yaratadi. |
| 10 | Kim AI bilan test yarata olsin? | **Hamma, bepul limit bilan** | Hamma yaratadi; limit tarifga bog'liq. |
| 11 | Bepul foydalanuvchiga AI limiti? | **Haftasiga 10 ta test** | Bepul: haftasiga 10 ta test (dushanbadan yangilanadi, Toshkent vaqti). |
| 12 | AI tuzgan testni ulashishdan oldin tahrirlash? | **Ha, har savolni tahrirlash** | Qoralama → to'liq tahrirlagich → nashr. |
| 13 | Har savolga izoh va modda havolasi? | **Ixtiyoriy** | Izoh ixtiyoriy. Modda havolasi baribir avtomatik (7-savol) — ishlovchi har doim moddani ochib ko'ra oladi. |

### C. Ulashish

| # | Savol | Javobingiz | Qaror |
|---|---|---|---|
| 14 | Testni qanday ulashish mumkin bo'lsin? | **Hammasi** | Havola, Telegram tugmasi (startapp), 6 belgili kod, guruhga vazifa. |
| 15 | Test ko'rinish darajalari? | **Hammasi** | visibility: private / link / group / public. |
| 16 | Boshqaning testini nusxalab o'zgartirish? | **Yo'q** | Nusxa (fork) yo'q. Test faqat muallifniki. |
| 17 | Ro'yxatdan o'tmagan odam ulashilgan testni ishlay oladimi? | **Ha, saqlash uchun kirish** | Mehmon ishlaydi; natija va izoh uchun Telegram bilan kiradi. |
| 18 | Test ishlaganlarning natijasini muallif ko'radimi? | **Har doim ism bilan** | Muallif hamma natijani ism bilan ko'radi. Test boshida ogohlantirish: 'Natijangiz va ismingiz muallifga ko'rinadi'. Mehmondan ism so'raladi. |
| 19 | Ulashilgan testga qanday sozlamalar kerak? | **Hammasi** | settings: taymer, muddat, urinishlar soni, aralashtirish. |
| 20 | To'g'ri javoblar qachon ko'rsatilsin? | **Uchala variant ham (muallif tanlaydi)** | Muallif tanlaydi: har savoldan keyin / tugagach / muddat o'tgach. |
| 21 | Muallif testni o'zgartirsa, eski natijalar? | **Qayta hisoblansin** | Javob kaliti o'zgarsa, hamma urinishlar yangi kalit bilan jimgina qayta hisoblanadi (aniqlashtirish, 44). Savol matni o'zgarsa, eski javoblar saqlanadi, savol 'o'zgartirilgan' deb belgilanadi. |

### D. Sifat va moderatsiya

| # | Savol | Javobingiz | Qaror |
|---|---|---|---|
| 22 | Ommaviy katalogdagi testlar sifati qanday nazorat qilinsin? | **Hammasi** | Sifat balli = baho + shikoyat + AI audit; ekspert — tanlangan testlar va rasmiyga ko'tarish. |
| 23 | Yaxshi foydalanuvchi savoli rasmiy bankka o'tsinmi? | **Ha, ekspert tasdiqlasa** | Promote: ekspert navbati → rasmiy bankka nusxa (source='community'). Shartlarda muallifdan litsenziya. |
| 24 | Muallif ishonch darajasi kerakmi? | **Ha, 0–3 daraja** | trust_level 0–3; katalogga 1-darajadan. |
| 25 | Nomaqbul kontent qanday to'xtatilsin? | **AI filtr + shikoyat** | Katalogga chiqishda AI filtr; qolganlari — shikoyat bo'yicha. |

### E. Huquq sohalari

| # | Savol | Javobingiz | Qaror |
|---|---|---|---|
| 26 | Sohalar katalogi qanday tuzilsin? | **Ikkalasi ham** | Ikki ko'rinish: 'Kodeks bo'yicha' (talaba/yurist) va 'Hayotiy mavzular' (fuqaro). Ikkalasi ham bir xil moddalarga bog'lanadi. |
| 27 | Muhim sohalarga ustuvorlik qanday belgilansin? | **A/B/C darajalar** | A — modda-modda test + konspekt + kazus; B — asosiy boblar; C — umumiy tanishuv (20–50 savol). |
| 28 | Qonunlar o'zgarsa nima bo'ladi? | **Eski savollar avtomatik belgilanadi** | lex.uz qayta importida modda matni o'zgarsa, unga bog'langan rasmiy va foydalanuvchi savollari 'tekshiruvda' holatiga o'tadi. |
| 29 | Sohani o'rganishda progress qanday ko'rinsin? | **Hammasi** | Foiz, moddalar xaritasi, soha nishonlari, yakunda PDF sertifikat (tekshirish havolasi bilan). |

### F. To'lov

| # | Savol | Javobingiz | Qaror |
|---|---|---|---|
| 30 | To'lov modeli? | **Ikki tarif** | 'Sertifikat' va 'Sohalar' — alohida tariflar, ikkalasi birga chegirma bilan. |
| 31 | Premium narxi (oyiga)? | **39 000 so'm** | Har tarif 39 000 so'm/oy. Ikkalasi birga — taklif 59 000 (tasdiqlash kerak). |
| 32 | Mualliflar testlaridan foyda ko'rsinmi? | **Bonus va pullik testlar** | Bonus Premium kunlar + pullik testlar (DOYSE foiz oladi). Pullik testlar muallifga to'lov huquqiy masalasi hal bo'lgach. |
| 33 | O'quv markazi/universitet uchun tarif? | **Paketlar (30/100/300 kishi)** | Oylik paketlar, ichida o'qituvchilar AI limiti. |

### G. Motivatsiya va AI ustoz

| # | Savol | Javobingiz | Qaror |
|---|---|---|---|
| 34 | Reytingga qaysi natijalar kirsin? | **Faqat rasmiy savollar** | O'quvchi reytingi faqat rasmiy bankdan; mualliflar reytingi alohida. |
| 35 | O'qituvchi jonli viktorina o'tkaza olsinmi? | **Ha, birinchi versiyada** | Jonli viktorina birinchi versiyada (Supabase Realtime, mavjud musobaqa mexanizmi asosida). |
| 36 | AI ustoz nimalarni qila olsin? | **Hammasi** | To'rt funksiya; javoblar bazadagi moddalarga tayanadi va manbani ko'rsatadi. |
| 37 | AI ustoz fuqaroga shaxsiy huquqiy maslahat bersinmi? | **Yo'q, faqat ta'lim** | Faqat ta'lim: 'Bu yuridik maslahat emas' + yuristga murojaat tavsiyasi. Kazus tahlili — o'quv masalasi sifatida. |

### H. Birinchi versiya va o'tish

| # | Savol | Javobingiz | Qaror |
|---|---|---|---|
| 38 | Birinchi versiyada eng muhim narsalar? | **Hammasi (to'rttasi ham)** | To'rttasi ham birinchi versiyada; muddat 12–14 haftaga cho'ziladi. Tartib: qonun bazasi → katalog → AI test + ulashish → AI ustoz → jonli viktorina. |
| 39 | Kodeks/qonun matnlari bazaga qanday kiritilsin? | **lex.uz dan import** | lex.uz dan modda-modda import, tahrir sanasi bilan; qayta import o'zgarishni aniqlaydi (28). |
| 40 | Ota-onaga hisobot kerakmi? | **Kerak emas** | Ota-ona funksiyasi yo'q. |
| 41 | Hozirgi A+ Huquq foydalanuvchilari? | **Hammasi avtomatik saqlanadi** | Shu baza ustida evolyutsiya: obuna, streak, natijalar joyida qoladi. |

## 2. Aniqlashtirish (20 savol) — yakuniy qarorlar

Birinchi so'rovnomadagi ziddiyatlar va ochiq savollar ikkinchi raundda hal qilindi (`data/v3/polls.json`, 42–61):

| Mavzu | Qaror |
|---|---|
| Bazaga bog'lanmagan savol (o'z materiali) | "Foydalanuvchi materiali" belgisi bilan qoladi; ommaviy katalogga chiqmaydi |
| Muallif ishlovchining ismini ko'rishi | **Har doim to'liq ism**, katalogda ham. Test boshida majburiy ogohlantirish |
| Javob kaliti o'zgarsa | Jimgina avtomatik qayta hisoblash; eski ball audit tarixida saqlanadi |
| Mualliflik huquqi | Foydalanish shartlarida litsenziya bandi; rasmiy bankka o'tsa bonus |
| Narx | Sertifikat 39 000, Sohalar 39 000, ikkalasi **59 000** so'm/oy |
| Bepul AI test hajmi | Haftasiga 10 ta test × **10 savolgacha** |
| A sohalar | **Fuqarolik, oila, jinoyat, jinoyat-protsessual, mehnat, soliq**. Konstitutsiyaviy va ma'muriy — B |
| Rasmiy savollar tekshiruvi | Trust 3 ekspertlar tekshiradi, **oxirgi tasdiq — admin** |
| Trust 3 va trust 1 | Ikkalasini ham **admin qo'lda** beradi |
| Ekspert mukofoti | Bepul Premium + har tasdiqlangan savol uchun to'lov + belgi + reytingda ustunlik |
| Bepul sohalar | Har sohaning 1-bobi + barcha C sohalar |
| AI ustoz (bepul) | Haftasiga 10 savol |
| Konspektlar | AI yozadi → ekspert tekshiradi |
| Soha sertifikati | Faqat **nazoratli onlayn imtihon** (kamera + ekran) dan keyin |
| Jonli viktorina (bepul) | 30 kishigacha |
| Pullik testlar | DOYSE **50%**, muallif 50% |
| Ishga tushirish | Hamma qism alohida sinov muhitida to'liq sinovdan o'tadi; egasi "mukammal" deb qabul qilgach, bir marta production'ga chiqariladi |

## 3. Qurilgan logika

### 3.1. Umumiy sxema

```
                    ┌──────────── DOYSE hisobi (Telegram / Google) ─────────────┐
                    │ maqsad: abituriyent / talaba / yurist / fuqaro / xizmatchi │
                    │ rol: student / teacher / author / reviewer / admin         │
                    │ trust_level 0–3 · tariflar: sertifikat, sohalar            │
                    └─────┬───────────────────────┬──────────────────────┬───────┘
                          │                       │                      │
   ┌── QONUN BAZASI (lex.uz) ───────┐   ┌── RASMIY BANK ─────────┐  ┌── FOYDALANUVCHI TESTLARI ──────┐
   │ fields (sohalar, A/B/C)        │   │ questions (ekspert)    │  │ tests → test_items             │
   │ documents → chapters → articles│◀──│ Milliy sertifikat:     │  │ visibility, share_code         │
   │ life_topics ↔ articles         │   │  sinov, kunlik, reyting│  │ settings, versiya              │
   │ revision (tahrir sanasi, hash) │   │ Sohalar: modda testlari│  │ AI generator (4 manba)         │
   └───────────────┬────────────────┘   └─────────┬──────────────┘  └──────────────┬─────────────────┘
                   │  har savol article_id ga bog'langan  ◀──── promote (ekspert) ──┘
                   └────────────── attempts / attempt_answers (umumiy) ─────────────┘
         AI ustoz (tushuntirish, kazus, xatolardan test, reja) · jonli viktorina (Realtime)
```

### 3.2. Qonun bazasi va sohalar katalogi (26–29, 39)

```sql
create table fields (                   -- huquq sohalari
  id serial primary key, slug text unique, title text, color text, icon text,
  priority char(1) check (priority in ('A','B','C')), sort int
);
alter table documents add column field_id int references fields,
                      add column lex_id text unique,          -- lex.uz hujjat ID
                      add column fetched_at timestamptz;
create table chapters (id serial primary key, document_id int references documents, number text, title text, sort int);
alter table articles  add column chapter_id int references chapters,
                      add column body_hash text,              -- o'zgarishni aniqlash (28)
                      add column status text not null default 'active' check (status in ('active','changed','repealed'));
create table life_topics (id serial primary key, field_id int references fields, title text, slug text unique);  -- "Ishdan bo'shatish"
create table life_topic_articles (topic_id int references life_topics, article_id bigint references articles, primary key (topic_id, article_id));
create table article_progress (user_id uuid, article_id bigint, correct int, seen int, last_at timestamptz,
                               primary key (user_id, article_id));          -- moddalar xaritasi (29)
create table certificates (id uuid primary key, user_id uuid, field_id int, score int, issued_at timestamptz);  -- PDF + tekshirish havolasi
```

**lex.uz importi** (`npm run lex:import -- <lex_id>`):
1. Hujjatni oladi, modda-modda ajratadi (bob, modda raqami, matn, tahrir sanasi).
2. `body_hash` o'zgargan moddalar → `articles.status='changed'` va unga bog'langan barcha savollar
   (rasmiy va foydalanuvchi) `review` holatiga o'tadi. Mualliflarga xabar boradi: "JK 168-modda o'zgardi, 3 ta savolingizni tekshiring".
3. Bekor qilingan modda → `repealed`, savollar muomaladan olinadi.

**A/B/C hajmi:**

| Daraja | Sohalar (taklif) | Kontent |
|---|---|---|
| A | Fuqarolik, oila, jinoyat, jinoyat-protsessual, mehnat, soliq | Har modda bo'yicha test, bob konspekti, kazuslar, hayotiy mavzular |
| B | Konstitutsiyaviy, ma'muriy, fuqarolik-protsessual, yer, uy-joy, iste'molchi huquqlari | Asosiy boblar bo'yicha test va konspekt |
| C | Bojxona, ekologiya, xalqaro, bank, sug'urta, intellektual mulk va boshqalar | Umumiy tanishuv, 20–50 savol |

**Progress (29):** soha foizi = (o'zlashtirilgan moddalar / sohadagi moddalar); modda "o'zlashtirilgan" bo'lishi
uchun oxirgi 3 javobdan kamida 2 tasi to'g'ri va kamida 1 marta takrorlashda to'g'ri bo'lishi kerak (Leitner, bor).
Sertifikat — A soha ≥ 80% va **nazoratli onlayn imtihon** (kamera + ekran) ≥ 70%.

### 3.3. Foydalanuvchi testlari (UGC)

```sql
create type test_visibility as enum ('private', 'link', 'group', 'public');
create table tests (
  id bigserial primary key,
  owner_id uuid not null references profiles,
  field_id int references fields,
  title text not null, description text,
  visibility test_visibility not null default 'link',
  share_code char(6) unique not null,              -- 0/O, 1/I yo'q alfavit
  group_id bigint references groups,               -- visibility='group' bo'lsa
  settings jsonb not null default '{}',            -- {timer_min, opens_at, closes_at, max_attempts, shuffle, reveal: 'each'|'end'|'after_close'}
  price_uzs int,                                   -- pullik test (keyinroq; null = bepul)
  version int not null default 1,
  own_material boolean not null default false,     -- bazaga bog'lanmagan savol bor (2-bo'lim)
  quality_score real, rating_sum int default 0, rating_n int default 0, attempts_count int default 0,
  status text not null default 'draft' check (status in ('draft','published','hidden','removed')),
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create table test_items (
  id bigserial primary key, test_id bigint references tests on delete cascade, pos int,
  type question_type not null, stem text, context text,
  payload jsonb not null,                          -- javobsiz
  answer jsonb not null,                           -- MAXFIY
  explanation text,                                -- ixtiyoriy (13)
  article_id bigint references articles,           -- 7: bazadagi modda; null faqat own_material da
  key_version int not null default 1,              -- javob kaliti o'zgarsa oshadi → qayta hisoblash (21)
  status text not null default 'active' check (status in ('active','review','voided')),
  fingerprint text
);
create table test_ratings (test_id bigint, user_id uuid, stars smallint check (stars between 1 and 5), primary key (test_id, user_id));
create table ai_weekly (user_id uuid, week date, tests int not null default 0, primary key (user_id, week));  -- 11
alter type attempt_mode add value 'ugc';
alter table attempts add column test_id bigint references tests,
                     add column guest_name text, add column guest_token text;   -- 17–18
```

**RLS:** `tests` — egasi hammasini ko'radi; boshqalar faqat `published` testni ko'radi, va faqat shunday bo'lsa:
`public`, `link` (kod bilan so'ralgan) yoki `group` (`member_of`). `answer` klientga hech qachon oldindan
bermaydi, faqat `settings.reveal` qoidasi bo'yicha server qaytaradi.

### 3.4. AI bilan test yaratish oqimi (6–13)

```
Manba ─────────────┬─ soha/mavzu → bazadan tegishli moddalar (life_topic yoki bob) → AI'ga kontekst
                   ├─ modda raqami → shu modda (+ qo'shni moddalar chalg'ituvchi uchun)
                   ├─ matn / PDF ─┐
                   └─ rasm ───────┴→ AI matnni ajratadi → bazadan mos moddalarni qidiradi (to'liq matnli qidiruv)
        ↓
Limit: ai_weekly.tests < 10 (bepul) · tarif bo'yicha (pullik) — atomar SQL
        ↓
AI generatsiya: 5–50 savol, 10 talik bo'laklar, turlar: single/multi/matching/true_false/open/case
   har savol → {article_ref, ...}; article_ref bazada topilmasa → own_material (2-bo'lim)
        ↓
Validatsiya: draftToQuestion (bor) + bias.ts (javob keskin uzunmi) + dublikat (fingerprint)
        ↓
Qoralama → tahrirlagich (har savol, 12) → "Nashr qilish" → visibility tanlash
        ↓
public bo'lsa: trust_level ≥ 1? → AI moderatsiya (haqorat/siyosat/reklama/maxfiy material) → katalog
```

### 3.5. Ulashish va ishlash (14–21)

```
Muallif: [Ulashish] → doyse.uz/t/K7Q2XM · t.me/<bot>?startapp=t_K7Q2XM · kod K7Q2XM · [Guruhga vazifa]
Ishlovchi → test kartasi (nom, muallif + trust belgisi, soha, savollar, ★, muddat)
   "Natijangiz va ismingiz muallifga ko'rinadi" (18) → [Boshlash]
   ├─ kirgan  → attempts(mode='ugc')
   └─ mehmon  → ism kiritadi → guest_token (cookie) → ishlaydi → natija; izoh/saqlash uchun "Telegram bilan kirish"
Tekshiruv: opens_at ≤ now ≤ closes_at · urinishlar < max_attempts · taymer server vaqtida (sinov imtihonidagidek)
Javob ko'rsatish: settings.reveal = each | end | after_close
Muallif paneli: har ishlovchi (ism, ball, vaqt), har savol bo'yicha to'g'ri %, shubhali savollar
Javob kaliti o'zgarsa (21): key_version++ → jimgina qayta hisoblash (xabarsiz), eski ball audit tarixida
```

### 3.6. Sifat, ishonch, moderatsiya (22–25)

```
quality_score = 0.35·★ (Bayes o'rtacha, m=10) + 0.25·(1 − tasdiqlangan shikoyatlar ulushi)
              + 0.20·savol statistikasi (ajratish kuchi > 0) + 0.20·AI audit
trust_level (hammasini admin qo'lda beradi): 0 → yangi · 1 → katalogga chiqadi (nomzodlar navbati: ≥ 3 nashr) · 2 → tasdiqlangan yurist/o'qituvchi · 3 → ekspert
Katalog: public ∧ trust ≥ 1 ∧ AI filtrdan o'tgan ∧ own_material = false ∧ ≥ 5 savol ∧ izohli ≥ 50%
Avtomatik yashirish: quality < 0.4 (≥ 30 urinishdan keyin) yoki ≥ 3 ochiq "maxfiy material" shikoyati
Promote (23): ekspert tekshiradi → admin tasdiqlaydi → questions ga nusxa (source='community', author_id saqlanadi) → muallifga bonus
```

### 3.7. AI ustoz (36–37)

- **Tushuntirish**: modda yoki tushuncha, oddiy tilda, misol bilan. Manba moddalar pastda havola bilan ko'rsatiladi.
- **Kazus tahlili**: foydalanuvchi vaziyatni yozadi, AI qaysi moddalar tegishli ekanini o'quv masalasi sifatida tahlil qiladi.
- **Xatolardan test**: `review_queue` va `article_progress` dagi zaif moddalar bo'yicha AI test (haftalik limitga kiradi).
- **O'quv reja**: maqsad (sertifikat sanasi yoki soha) va kunlik vaqtga qarab haftalik reja.
- **Chegaralar**: har javob oxirida "Bu yuridik maslahat emas". Shaxsiy ish ("sudga nima deyay") uchun yuristga
  murojaat tavsiyasi beriladi. Kontekst faqat bazadagi moddalardan olinadi (RAG). Foydalanuvchi matni
  `<oquvchi_...>` teglarida beriladi (hozirgi `UNTRUSTED` yondashuvi).

### 3.8. Jonli viktorina (35)

O'qituvchi o'z testidan "Jonli" xona ochadi → 6 raqamli PIN + QR → o'quvchilar Mini App'da qo'shiladi →
o'qituvchi ekranida savol → hamma javob beradi (vaqt chegarasi) → har savoldan keyin top-5 → yakuniy natija guruhga saqlanadi.
Texnik: Supabase Realtime kanali, holat serverda (`live_sessions`, `live_answers`), ball = to'g'ri × tezlik.
Mavjud musobaqa mexanizmi (`contests`) asos bo'ladi.

### 3.9. Tariflar (30–33)

| Tarif | Narx | Nima kiradi |
|---|---|---|
| Bepul | 0 | Kuniga 20 rasmiy savol (hozirgi), oyiga 1 sinov, haftasiga 10 ta AI test (≤ 10 savol), AI ustoz haftasiga 10 savol, har sohaning 1-bobi + C sohalar, jonli viktorina 30 kishigacha |
| **Sertifikat** | 39 000 so'm/oy | Milliy sertifikat to'liq: sinov imtihonlari, cheksiz mashq, AI tekshiruv |
| **Sohalar** | 39 000 so'm/oy | Barcha sohalar to'liq, sertifikatlar, AI ustoz |
| Ikkalasi | 59 000 so'm/oy | Hammasi + AI testlar limiti oshadi |
| Markaz / universitet | 30 / 100 / 300 kishi paketlari | Guruhlar, jonli viktorina, o'qituvchilar AI limiti |

Mualliflar: sifatli va ko'p ishlangan test uchun Premium kunlar (masalan, oyiga ≥ 100 ishlanish va ★ ≥ 4 bo'lsa —
7 kun). Rasmiy bankka o'tgan har savol uchun ham bonus. Pullik testlar (32) — muallifga pul o'tkazish tartibi
(YaTT/o'zini o'zi band qilgan) hal bo'lgach.

## 4. Hozirgi koddan nima qayta ishlatiladi

| V3 qismi | Hozirgi kod | O'zgarish |
|---|---|---|
| Hujjat va moddalar | `documents`, `articles`, `topics` | `fields`, `chapters`, `lex_id`, `body_hash` |
| Savol turlari, tekshirish | `lib/questions.ts` | `true_false` |
| AI generator | `lib/ai.ts` (`generateDrafts`, `DraftSchema`) | soha-mustaqil prompt, modda bog'lash, 10 talik bo'laklar |
| AI tushuntirish | `aiExplain` | AI ustoz (RAG, suhbat) |
| Kvota | `consume_ai_quota`, `ai_usage` | haftalik test limiti |
| Urinishlar | `attempts`, `record_answer`, sinov taymeri | `mode='ugc'`, mehmon, qayta hisoblash |
| Tahrirlagich | `/app/kontent/savollar/[id]/editor.tsx` | `test_items` uchun |
| Guruh, vazifa | `groups`, `assignments` | vazifa = UGC test ham |
| Musobaqa | `contests`, `finalize_contest` | jonli viktorina asosi |
| Takrorlash | `review_queue` (Leitner) | modda darajasida progress |
| Bot / Mini App | `lib/bot/*`, `/tg` | `startapp=t_<kod>`, ulashish tugmasi |
| To'lov | Payme (DOYSE kassasi), chek | ikki tarif, markaz paketlari |

## 5. Bosqichlar (birinchi versiya ichida)

| # | Qism | Muddat | Tayyorlik mezoni |
|---|---|---|---|
| 1 | Qonun bazasi: lex.uz importi, `fields`, bob/modda, o'zgarish aniqlash | 2–3 hafta | A sohalarning barcha kodekslari bazada |
| 2 | Sohalar katalogi (A): kodeks va hayotiy mavzular ko'rinishi, modda → test, progress, xarita | 3 hafta | 6 ta A soha, har birida ≥ 300 rasmiy savol |
| 3 | AI test + ulashish: generator (4 manba), tahrir, havola/kod/Telegram/vazifa, mehmon, muallif paneli, katalog | 3–4 hafta | 100 ta foydalanuvchi testi, ≥ 30% ulashilgan |
| 4 | AI ustoz | 2 hafta | Javoblarning ≥ 95% ida manba moddasi ko'rsatilgan |
| 5 | Jonli viktorina | 2 hafta | 30 kishilik xona kechikishsiz ishlaydi |
| — | Keyin: B/C sohalar kontenti, sertifikatlar, markaz kabineti, pullik testlar | | |

## 6. Plyuslar

1. **Aniq joy.** "Huquq bo'yicha hamma narsa bir joyda" — O'zbekistonda bunday to'liq platforma yo'q. Fokus
   saqlanadi (faqat huquq), lekin auditoriya 4 barobar kengayadi.
2. **Ishonchli AI.** Har savol rasmiy moddaga bog'langan. Qonun o'zgarsa, savol avtomatik tekshiruvga qaytadi.
   Huquqda bu eng kuchli ustunlik: AI xatosi — eng katta xavf.
3. **O'sish dvigateli.** Ulashilgan test + mehmon rejimi + Telegram tugmasi. Har o'qituvchi — tarqatish kanali.
   Jonli viktorina o'qituvchini platformaga bog'laydi.
4. **Poydevor tayyor.** Moddalar, savol turlari, maxfiy javob kaliti, AI, bot, musobaqa, Payme bor. Bu yangi sayt
   emas, evolyutsiya. Hozirgi foydalanuvchilar hech narsa yo'qotmaydi.
5. **Ko'p daromad manbasi.** Ikki tarif, markaz paketlari, keyinroq pullik testlar.
6. **Ma'lumot aktivi.** Foydalanuvchi savollari va statistikasi rasmiy bank uchun manba bo'ladi (promote).

## 7. Kamchiliklar va xavflar

| # | Kamchilik / xavf | Ta'siri | Chora |
|---|---|---|---|
| 1 | **Birinchi versiya juda katta** (4 qism, 12–14 hafta) | Kechikish, charchash, bozor kutmaydi | Har qism tayyor bo'lishi bilan yopiq beta; qonun bazasi va katalog birinchi |
| 2 | **lex.uz importi** — sayt tuzilishi o'zgarishi, foydalanish shartlari, kirill/lotin | Baza eskiradi yoki import buziladi | Rasmiy ochiq manba, lekin shartlarni tekshirish; import testlar bilan, haftalik qayta import; importdan keyin qo'lda tekshirish |
| 3 | **Barcha sohalar uchun rasmiy kontent** — minglab savol va ekspert kerak | A sohalar sifatli bo'lmasa, ishonch tushadi | A/B/C; AI qoralama + ekspert; foydalanuvchi savollarini promote qilish |
| 4 | **AI xarajati** (bepul: haftasiga 10 test × 10 savol + AI ustoz 10 savol; pullik: 50 savolgacha) | Bepul foydalanuvchilar zarar keltiradi | Bepul testda ≤ 10 savol, keshlash (bir xil modda + sozlama), `ai_usage` kunlik monitoring |
| 5 | **Ism har doim ko'rinadi** (18) — shaxsiy ma'lumot, voyaga yetmaganlar | Shikoyat, qonunchilik talablari | Majburiy ogohlantirish; ko'rinadigan ismni foydalanuvchi o'zi tahrirlaydi |
| 6 | **Natijalarni qayta hisoblash** (21) | Guruh vazifasida baho o'zgaradi, nizolar | Faqat javob kaliti o'zgarganda, tarix saqlanadi, muallif tasdiqlaydi |
| 7 | **AI ustoz yuridik maslahat sifatida qabul qilinishi** | Huquqiy javobgarlik | Faqat ta'lim, har javobda ogohlantirish, manba moddalar, shaxsiy ish uchun yurist tavsiyasi |
| 8 | **Nomaqbul yoki maxfiy kontent** (sizib chiqqan imtihon savollari) | DTM/BMBA bilan muammo | AI filtr + shikoyat + shartlarda taqiq + blok |
| 9 | **Narx 39 000 ga tushishi** | Hozirgi 49 000 ga nisbatan daromad kamayishi mumkin | Ikkalasi birga 59 000; hozirgi obunachilar ikkala tarifni oladi; 2 oydan keyin konversiya bo'yicha qayta ko'rib chiqish |
| 10 | **Nusxalash yo'q** — o'qituvchilar bir-birining testidan foydalana olmaydi | UGC sekinroq o'sadi | Katalogdagi testni guruhga vazifa sifatida berish mumkin (nusxasiz) |
| 11 | **Telegram'ga qaramlik** | Telegram cheklansa trafik tushadi | Sayt + PWA + Google orqali kirish |

## 8. Aniqlashtirishdan keyin qo'shilgan xavflar

| Xavf | Chora |
|---|---|
| **Admin — tor joy**: trust 1, trust 3, rasmiy bank va katalog — hammasi admin qo'lida | Admin panelida navbatlar (nomzodlar, promote, shikoyatlar), kunlik Telegram xulosasi; keyinchalik 2-admin |
| **To'liq ism har doim ko'rinadi** — voyaga yetmaganlar va katalogdagi begona mualliflar | Majburiy ogohlantirish; foydalanuvchi profilda ko'rinadigan ismni o'zi tahrirlay oladi |
| **Jimgina qayta hisoblash** — ishlovchi bali nega o'zgarganini bilmaydi | Natija sahifasida "Muallif X-savol javobini o'zgartirdi" yozuvi (xabar yubormasdan) |
| **Onlayn proktoring** — kamera/ekran yozuvi shaxsiy ma'lumot, murakkab texnologiya | Birinchi versiyada faqat tasodifiy suratlar + tab almashtirishni qayd qilish; roziligi olinadi; yozuvlar 30 kunda o'chadi |
| **Pullik test 50% komissiya** | Muallif daromadini to'lash tartibi (YaTT, o'zini o'zi band qilgan) huquqiy maslahat bilan hal qilinadi |

## Ilova: xuddi shu savollarni auditoriyaga berish

`data/v3/polls.json` dagi savollar Telegram so'rovnomasi formatida (savol ≤ 300, variant ≤ 100 belgi):

```bash
npm run v3:polls                               # ro'yxat
npm run v3:polls -- @kanal --send              # kanal/guruhga yuborish (bot admin bo'lishi kerak)
npm run v3:polls -- @kanal --results           # yopish, natija → data/v3/results-*.json
```
