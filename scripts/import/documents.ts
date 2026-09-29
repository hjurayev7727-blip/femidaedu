// 52 ta tavsiya etilgan qonunchilik hujjati.
// Manbalar: 01_QONUNCHILIK_BAZASI/Milliy_sertifikat_qonunchilik_hujjatlari.pdf (ro'yxat),
// Solishtirma_35_vs_52.html (ustuvorlik A/B/C), 09_DARS_MATERIALLARI/_generator/sched.json (modul).

export type DocumentRow = {
  number: number;
  code: string;
  title: string;
  shortTitle: string;
  priority: "A" | "B" | "C";
  module: number;
  /** Manba matnidan (src, sarlavha) hujjatni aniqlash uchun — normalize() dan o'tgan matnga qo'llanadi */
  match: RegExp;
};

// Tartib muhim: aniqroq naqshlar oldinda (masalan, "Konstitutsiyaviy sud" "Konstitutsiya"dan oldin).
export const DOCUMENTS: DocumentRow[] = [
  { number: 36, code: "KONSTSUD", title: "“O‘zbekiston Respublikasi Konstitutsiyaviy sudi to‘g‘risida”gi Konstitutsiyaviy qonun", shortTitle: "Konstitutsiyaviy sud", priority: "A", module: 5, match: /konstitutsiyaviy sud/ },
  { number: 37, code: "QPALATA", title: "“O‘zbekiston Respublikasi Oliy Majlisining Qonunchilik palatasi to‘g‘risida”gi Konstitutsiyaviy qonun", shortTitle: "Qonunchilik palatasi", priority: "A", module: 5, match: /qonunchilik palatasi/ },
  { number: 38, code: "SENAT", title: "“O‘zbekiston Respublikasi Oliy Majlisining Senati to‘g‘risida”gi Konstitutsiyaviy qonun", shortTitle: "Senat", priority: "A", module: 5, match: /senat(i|ining)? to'g'risida|oliy majlis senati/ },
  { number: 51, code: "SOK", title: "“O‘zbekiston Respublikasi Sudyalar oliy kengashi to‘g‘risida”gi qonun", shortTitle: "Sudyalar oliy kengashi", priority: "B", module: 5, match: /sudyalar oliy kengashi/ },
  { number: 43, code: "MSIYK", title: "Ma’muriy sud ishlarini yuritish to‘g‘risidagi kodeks", shortTitle: "Ma'muriy sud ishlarini yuritish kodeksi", priority: "B", module: 5, match: /ma'muriy sud ishlarini yuritish/ },
  { number: 52, code: "MTT", title: "“O‘zbekiston Respublikasi Ma’muriy tartib-taomillar to‘g‘risida”gi qonun", shortTitle: "Ma'muriy tartib-taomillar", priority: "B", module: 5, match: /tartib-taomil/ },
  { number: 15, code: "MJTK", title: "O‘zbekiston Respublikasining Ma’muriy javobgarlik to‘g‘risidagi kodeksi", shortTitle: "Ma'muriy javobgarlik kodeksi", priority: "A", module: 4, match: /ma'muriy javobgarlik/ },
  { number: 14, code: "JPK", title: "O‘zbekiston Respublikasining Jinoyat-protsessual kodeksi", shortTitle: "Jinoyat-protsessual kodeksi", priority: "B", module: 4, match: /jinoyat-protsessual/ },
  { number: 13, code: "JK", title: "O‘zbekiston Respublikasining Jinoyat kodeksi", shortTitle: "Jinoyat kodeksi", priority: "A", module: 4, match: /jinoyat kodeksi/ },
  { number: 7, code: "VM", title: "“O‘zbekiston Respublikasi Vazirlar Mahkamasi to‘g‘risida”gi qonun", shortTitle: "Vazirlar Mahkamasi", priority: "A", module: 1, match: /vazirlar mahkamasi/ },
  { number: 40, code: "PREZ", title: "“O‘zbekiston Respublikasi Prezidenti faoliyatining asosiy kafolatlari to‘g‘risida”gi qonun", shortTitle: "Prezident faoliyati kafolatlari", priority: "A", module: 5, match: /prezidenti faoliyatining/ },
  { number: 31, code: "PF5618", title: "“Jamiyatda huquqiy ong va huquqiy madaniyatni yuksaltirish tizimini tubdan takomillashtirish to‘g‘risida”gi Prezident farmoni", shortTitle: "Huquqiy ong va madaniyat (PF-5618)", priority: "B", module: 3, match: /huquqiy ong va huquqiy madaniyat|pf-5618|huquqiy ong va madaniyat/ },
  { number: 17, code: "MARKAZ", title: "Inson huquqlari bo‘yicha O‘zbekiston Respublikasi Milliy markazi to‘g‘risida NIZOM", shortTitle: "Inson huquqlari Milliy markazi", priority: "C", module: 3, match: /milliy markaz/ },
  { number: 22, code: "OMB", title: "“Oliy Majlisning inson huquqlari bo‘yicha vakili (Ombudsman) to‘g‘risida”gi qonun", shortTitle: "Ombudsman", priority: "B", module: 3, match: /ombudsman|inson huquqlari bo'yicha vakil/ },
  { number: 28, code: "ADLIYA", title: "O‘zbekiston Respublikasi Adliya vazirligi to‘g‘risida NIZOM", shortTitle: "Adliya vazirligi", priority: "C", module: 2, match: /adliya vazirligi/ },
  { number: 2, code: "BAYROQ", title: "“O‘zbekiston Respublikasining Davlat bayrog‘i to‘g‘risida”gi qonun", shortTitle: "Davlat bayrog'i", priority: "A", module: 1, match: /davlat bayrog'i/ },
  { number: 3, code: "GERB", title: "“O‘zbekiston Respublikasining Davlat gerbi to‘g‘risida”gi qonun", shortTitle: "Davlat gerbi", priority: "A", module: 1, match: /davlat gerbi/ },
  { number: 4, code: "MADHIYA", title: "“O‘zbekiston Respublikasining Davlat madhiyasi to‘g‘risida”gi qonun", shortTitle: "Davlat madhiyasi", priority: "A", module: 1, match: /davlat madhiyasi/ },
  { number: 42, code: "DTIL", title: "“O‘zbekiston Respublikasining Davlat tili haqida”gi qonun", shortTitle: "Davlat tili", priority: "B", module: 5, match: /davlat tili/ },
  { number: 49, code: "MUSTAQIL", title: "“Davlat mustaqilligi asoslari to‘g‘risida”gi qonun", shortTitle: "Davlat mustaqilligi asoslari", priority: "B", module: 5, match: /davlat mustaqilligi/ },
  { number: 5, code: "VIJDON", title: "“Vijdon erkinligi va diniy tashkilotlar to‘g‘risida”gi qonun", shortTitle: "Vijdon erkinligi", priority: "B", module: 1, match: /vijdon erkinligi/ },
  { number: 6, code: "PARTIYA", title: "“Siyosiy partiyalar to‘g‘risida”gi qonun", shortTitle: "Siyosiy partiyalar", priority: "B", module: 1, match: /siyosiy partiya/ },
  { number: 8, code: "ADVOKAT", title: "“Advokatura to‘g‘risida”gi qonun", shortTitle: "Advokatura", priority: "B", module: 1, match: /advokatura/ },
  { number: 9, code: "BYUDJET", title: "O‘zbekiston Respublikasining Budjet kodeksi", shortTitle: "Budjet kodeksi", priority: "C", module: 4, match: /bu?dje?t kodeksi|byudjet kodeksi/ },
  { number: 10, code: "FK", title: "O‘zbekiston Respublikasining Fuqarolik kodeksi", shortTitle: "Fuqarolik kodeksi", priority: "A", module: 3, match: /fuqarolik kodeksi/ },
  { number: 11, code: "FUQAROLIK", title: "“O‘zbekiston Respublikasining fuqaroligi to‘g‘risida”gi qonun", shortTitle: "Fuqarolik to'g'risida", priority: "A", module: 1, match: /fuqaroligi to'g'risida/ },
  { number: 12, code: "ISTEMOL", title: "“Iste’molchilarning huquqlarini himoya qilish to‘g‘risida”gi qonun", shortTitle: "Iste'molchilar huquqlari", priority: "B", module: 3, match: /iste'molchi/ },
  { number: 16, code: "MK", title: "O‘zbekiston Respublikasining Mehnat kodeksi", shortTitle: "Mehnat kodeksi", priority: "A", module: 4, match: /mehnat kodeksi/ },
  { number: 18, code: "MUALLIF", title: "“Mualliflik huquqi va turdosh huquqlar to‘g‘risida”gi qonun", shortTitle: "Mualliflik huquqi", priority: "B", module: 3, match: /mualliflik huquqi/ },
  { number: 19, code: "NHH", title: "“Normativ-huquqiy hujjatlar to‘g‘risida”gi qonun", shortTitle: "Normativ-huquqiy hujjatlar", priority: "A", module: 2, match: /normativ-huquqiy hujjatlar to'g'risida/ },
  { number: 20, code: "NOTARIAT", title: "“Notariat to‘g‘risida”gi qonun", shortTitle: "Notariat", priority: "B", module: 2, match: /notariat/ },
  { number: 21, code: "OILA", title: "O‘zbekiston Respublikasining Oila kodeksi", shortTitle: "Oila kodeksi", priority: "A", module: 3, match: /oila kodeksi/ },
  { number: 23, code: "PROK", title: "“Prokuratura to‘g‘risida”gi qonun", shortTitle: "Prokuratura", priority: "A", module: 2, match: /prokuratura to'g'risida/ },
  { number: 24, code: "REF", title: "“O‘zbekiston Respublikasining referendumi to‘g‘risida”gi qonun", shortTitle: "Referendum", priority: "B", module: 2, match: /referendum/ },
  { number: 25, code: "SAYLOV", title: "O‘zbekiston Respublikasining Saylov kodeksi", shortTitle: "Saylov kodeksi", priority: "A", module: 2, match: /saylov kodeksi/ },
  { number: 26, code: "SOLIQ", title: "O‘zbekiston Respublikasining Soliq kodeksi", shortTitle: "Soliq kodeksi", priority: "C", module: 4, match: /soliq kodeksi/ },
  { number: 27, code: "SUD", title: "“Sudlar to‘g‘risida”gi qonun", shortTitle: "Sudlar", priority: "A", module: 2, match: /sudlar to'g'risida/ },
  { number: 29, code: "XSH", title: "“O‘zbekiston Respublikasining xalqaro shartnomalari to‘g‘risida”gi qonun", shortTitle: "Xalqaro shartnomalar", priority: "B", module: 3, match: /xalqaro shartnoma/ },
  { number: 30, code: "TABIAT", title: "“Tabiatni muhofaza qilish to‘g‘risida”gi qonun", shortTitle: "Tabiatni muhofaza qilish", priority: "B", module: 4, match: /tabiatni muhofaza/ },
  { number: 32, code: "MUROJ", title: "“Jismoniy va yuridik shaxslarning murojaatlari to‘g‘risida”gi qonun", shortTitle: "Murojaatlar", priority: "A", module: 3, match: /murojaatlari to'g'risida|murojaatlar qonuni/ },
  { number: 33, code: "JAMOAT", title: "“O‘zbekiston Respublikasida jamoat birlashmalari to‘g‘risida”gi qonun", shortTitle: "Jamoat birlashmalari", priority: "B", module: 3, match: /jamoat birlashmalari/ },
  { number: 34, code: "OOOB", title: "“Fuqarolarning o‘zini o‘zi boshqarish organlari to‘g‘risida”gi qonun", shortTitle: "O'zini o'zi boshqarish organlari", priority: "A", module: 2, match: /o'zini o'zi boshqarish/ },
  { number: 35, code: "MAHALLIY", title: "“Mahalliy davlat hokimiyati to‘g‘risida”gi qonun", shortTitle: "Mahalliy davlat hokimiyati", priority: "A", module: 2, match: /mahalliy davlat hokimiyati/ },
  { number: 39, code: "MAHT", title: "“O‘zbekiston Respublikasining ma’muriy-hududiy tuzilishi to‘g‘risida”gi qonun", shortTitle: "Ma'muriy-hududiy tuzilish", priority: "B", module: 5, match: /ma'muriy-hududiy/ },
  { number: 41, code: "OGIRYUK", title: "“O‘n sakkiz yoshgacha bo‘lgan xodimlar ko‘tarishlari va tashishlari mumkin bo‘lgan og‘ir yuk normalarining chegarasini belgilash to‘g‘risida”gi NIZOM", shortTitle: "18 yoshgacha xodimlar uchun og'ir yuk normalari", priority: "C", module: 5, match: /og'ir yuk/ },
  { number: 44, code: "AXBOROTK", title: "“Axborot olish kafolatlari va erkinligi to‘g‘risida”gi qonun", shortTitle: "Axborot olish kafolatlari", priority: "B", module: 5, match: /axborot olish kafolat/ },
  { number: 45, code: "AXBOROTP", title: "“Axborot erkinligi prinsiplari va kafolatlari to‘g‘risida”gi qonun", shortTitle: "Axborot erkinligi prinsiplari", priority: "B", module: 5, match: /axborot erkinligi prinsip/ },
  { number: 46, code: "JNAZORAT", title: "“Jamoatchilik nazorati to‘g‘risida”gi qonun", shortTitle: "Jamoatchilik nazorati", priority: "B", module: 5, match: /jamoatchilik nazorati/ },
  { number: 47, code: "BOLA", title: "“Bola huquqlarining kafolatlari to‘g‘risida”gi qonun", shortTitle: "Bola huquqlari kafolatlari", priority: "A", module: 5, match: /bola huquqlari/ },
  { number: 48, code: "OAV", title: "“Ommaviy axborot vositalari to‘g‘risida”gi qonun", shortTitle: "Ommaviy axborot vositalari", priority: "B", module: 5, match: /ommaviy axborot vositalari to'g'risida/ },
  { number: 50, code: "MUDOFAA", title: "“O‘zbekiston Respublikasi Mudofaa to‘g‘risida”gi qonun", shortTitle: "Mudofaa", priority: "C", module: 5, match: /mudofaa to'g'risida/ },
  // Eng umumiy naqsh — oxirida
  { number: 1, code: "KONST", title: "O‘zbekiston Respublikasi Konstitutsiyasi", shortTitle: "Konstitutsiya", priority: "A", module: 2, match: /konstitutsiya(si|sining|ning|ga|da)?\b(?!viy)/ },
];

export const MODULES: Record<number, string> = {
  1: "Davlat ramzlari va asosiy qonunlar",
  2: "Konstitutsiya, saylov va hokimiyat",
  3: "Fuqarolik, oila va inson huquqlari",
  4: "Mehnat, jinoyat, moliya va ekologiya",
  5: "Konstitutsiyaviy institutlar",
};

/** Tutuq belgilari va registrni bir xil qiladi (‘ ’ ʻ ʼ ` → '). */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’ʻʼ`´]/g, "'")
    .replace(/[«»“”„"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const BY_NUMBER = new Map(DOCUMENTS.map((d) => [d.number, d]));

export function documentByNumber(n: number): DocumentRow {
  const d = BY_NUMBER.get(n);
  if (!d) throw new Error(`Hujjat topilmadi: №${n}`);
  return d;
}

/** Manba matnidan hujjat raqamini aniqlaydi (topilmasa null). */
export function resolveDocument(text: string | undefined | null): number | null {
  if (!text) return null;
  const t = normalizeText(text);
  return DOCUMENTS.find((d) => d.match.test(t))?.number ?? null;
}
