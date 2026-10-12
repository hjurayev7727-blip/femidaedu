# Savol bazasini qayta tuzish (Rustamboyev darsligi)

Qarorlar: `data/v3/polls.json` (102–109). Yozish — Sonnet 5.5, tekshiruv — Opus 5.5, ikkalasi Batch API (−50%),
jami sarf `--cap` (standart $20) dan oshsa skript yuborishdan oldin to'xtaydi. Natija `data/v2/bundle.json`,
`data/v1` o'zgarmaydi.

Kalit va darslik faqat o'z kompyuteringizda qoladi. Repo papkasida:

```bash
npm ci
export ANTHROPIC_API_KEY=sk-ant-...        # chatga yozmang; alohida kalit + Console'da limit tavsiya etiladi
npm run rebuild -- extract "/Users/sultan/CLAUDE AI/<darslik .docx papkasi>"   # bobma-bob, fayl nomi tartibida
npm run rebuild -- plan --cap 20           # taxminiy narx (API'siz)
npm run rebuild -- pilot                   # 3 bo'lak, ~$0.3 — sifatni ko'zdan kechiring
npm run rebuild -- write                   # Sonnet batch
npm run rebuild -- collect                 # tayyor bo'lguncha kutadi
npm run rebuild -- review                  # Opus tekshiruvi
npm run rebuild -- collect
npm run rebuild -- build                   # data/v2/bundle.json + REPORT.md
npm run db:import -- data/v2/bundle.json   # faqat REPORT.md ni ko'rib chiqqach
```

- Tekshiruvdan o'tmagan, javobi uzunligi bilan oshkor bo'lgan va takroriy savollar bundlega kirmaydi.
- Xato/rad etilgan bo'laklar uchun `write`/`review` ni qayta ishga tushirsangiz, faqat qolganlari yuboriladi.
- Holat `data/v2/.work/state.json` da (git'ga tushmaydi; darslik matni ham shu yerda).
