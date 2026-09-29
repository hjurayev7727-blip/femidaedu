// O'zbek lotin ↔ kirill transliteratsiyasi (1995-yilgi lotin alifbosi qoidalari).
// Kontent lotinda saqlanadi; kirill — foydalanuvchi tanlasa, ko'rsatishda o'giriladi.

const APOS = "['‘’ʻʼ`]";
const VOWELS_LAT = "aeiouAEIOU";

const DIGRAPHS: [RegExp, string, string][] = [
  // [naqsh, kichik harf, bosh harf]
  [new RegExp(`o${APOS}`, "gi"), "ў", "Ў"],
  [new RegExp(`g${APOS}`, "gi"), "ғ", "Ғ"],
  [/ts(?=i[yo])/gi, "ц", "Ц"], // Konstitutsiya → Конституция, revolyutsion → революцион
  [/sh/gi, "ш", "Ш"],
  [/ch/gi, "ч", "Ч"],
  [/yo/gi, "ё", "Ё"],
  [/yu/gi, "ю", "Ю"],
  [/ya/gi, "я", "Я"],
];

const SINGLE: Record<string, string> = {
  a: "а", b: "б", d: "д", f: "ф", g: "г", h: "ҳ", i: "и", j: "ж", k: "к", l: "л", m: "м", n: "н", o: "о",
  p: "п", q: "қ", r: "р", s: "с", t: "т", u: "у", v: "в", x: "х", y: "й", z: "з", c: "с", w: "в",
};

function caseLike(src: string, lower: string, upper: string) {
  return src[0] === src[0].toUpperCase() && src[0] !== src[0].toLowerCase() ? upper : lower;
}

export function latinToCyrillic(text: string): string {
  let s = text;
  // "ye" so'z boshida yoki unlidan keyin → е; "e" so'z boshida → э, qolgan joyda → е
  s = s.replace(/(^|[^a-zA-Zʻ'‘’])([Yy][Ee])/g, (_, p, ye) => p + (ye[0] === "Y" ? "Е" : "е"));
  s = s.replace(new RegExp(`([${VOWELS_LAT}])([Yy][Ee])`, "g"), (_, v, ye) => v + (ye[0] === "Y" ? "Е" : "е"));
  s = s.replace(/(^|[^a-zA-Zа-яА-ЯўғқҳЎҒҚҲ'‘’ʻ])([Ee])/g, (_, p, e) => p + (e === "E" ? "Э" : "э"));
  for (const [re, lo, up] of DIGRAPHS) s = s.replace(re, (m) => caseLike(m, lo, up));
  // so'z ichidagi tutuq belgisi (ma'no, san'at) → ъ
  s = s.replace(new RegExp(`(?<=[a-zA-Zа-яА-Я])${APOS}(?=[a-zA-Zа-яА-Я])`, "g"), "ъ");
  s = s.replace(/[a-zA-Z]/g, (ch) => {
    const lo = SINGLE[ch.toLowerCase()] ?? (ch.toLowerCase() === "e" ? "е" : ch);
    return ch === ch.toUpperCase() ? lo.toUpperCase() : lo;
  });
  return s;
}

const CYR: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z", и: "i", й: "y", к: "k", л: "l",
  м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "x", ц: "ts", ч: "ch", ш: "sh",
  ъ: "'", ь: "", ы: "i", э: "e", ю: "yu", я: "ya", ў: "o'", қ: "q", ғ: "g'", ҳ: "h", щ: "sh",
};

export function cyrillicToLatin(text: string): string {
  // е so'z boshida yoki unlidan keyin → ye
  const s = text.replace(/(^|[^а-яёўқғҳА-ЯЁЎҚҒҲ]|[аеёиоуўэюяАЕЁИОУЎЭЮЯ])([еЕ])/g, (_, p, e) => p + (e === "Е" ? "Ye" : "ye"));
  let out = "";
  for (const ch of s) {
    const lo = ch.toLowerCase();
    const t = CYR[lo];
    if (t === undefined) out += ch;
    else out += ch !== lo && t ? t[0].toUpperCase() + t.slice(1) : t;
  }
  return out;
}

export type Script = "latin" | "cyrillic";

export function toScript(text: string, script: Script): string {
  return script === "cyrillic" ? latinToCyrillic(text) : text;
}
