import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Maxfiylik siyosati" };
export const dynamic = "force-static";

export default function Privacy() {
  return (
    <LegalPage
      title="Maxfiylik siyosati"
      updated="2026-yil 29-sentabr"
      intro="A+ Huquq — huquq fanidan milliy sertifikat imtihoniga tayyorlanish platformasi. Bu sahifada qanday ma'lumot to'plashimiz, undan nima uchun foydalanishimiz va uni qanday himoya qilishimiz tushuntiriladi."
      sections={[
        {
          title: "Qanday ma'lumot to'playmiz",
          items: [
            "Telegram orqali kirsangiz: Telegram ID, ism-familiya, username va profil rasmi havolasi (Telegram bergan ma'lumot).",
            "Google orqali kirsangiz: email manzil, ism va profil rasmi havolasi.",
            "Profilda o'zingiz ko'rsatgan ma'lumot: maqsad, hudud, yozuv turi (lotin/kirill).",
            "O'qish faoliyati: javoblaringiz, sinov imtihoni natijalari, takrorlash navbati, streak va yutuqlar.",
            "To'lov qilganingizda: tanlangan tarif va siz yuklagan to'lov cheki rasmi. Karta ma'lumotlaringizni biz qabul qilmaymiz va saqlamaymiz.",
            "Texnik ma'lumot: tizimga kirganingizni eslab qolish uchun sessiya cookie'lari. Reklama yoki kuzatuv cookie'larini ishlatmaymiz.",
          ],
        },
        {
          title: "Ma'lumotdan nima uchun foydalanamiz",
          items: [
            "Hisobingizni yaratish, tizimga kiritish va natijalaringizni saqlash.",
            "Zaif mavzularingizni aniqlash, takrorlash jadvali va shaxsiy tavsiyalar berish.",
            "Telegram bot orqali siz yoqqan eslatmalarni yuborish (profil sozlamalarida o'chirish mumkin).",
            "To'lovni tekshirib, Premium'ni faollashtirish.",
            "Reytingda ismingiz va natijangiz ko'rsatiladi — buni profil sozlamalarida istalgan vaqtda yashirish mumkin.",
          ],
        },
        {
          title: "Kimlarga uzatiladi",
          items: [
            "Ma'lumotlaringizni sotmaymiz va reklama uchun uzatmaymiz.",
            "Platforma quyidagi xizmatlarda ishlaydi: Supabase (ma'lumotlar bazasi, Yevropa Ittifoqi — Frankfurt), Vercel (sayt xostingi), Telegram (bot va kirish), Google (kirish).",
            "Yozma javobni AI bilan qayta tekshirish yoki \"AI'dan so'rash\" funksiyasidan foydalansangiz, savol va javobingiz matni Anthropic (Claude) xizmatiga yuboriladi. Ism yoki kontakt ma'lumotlaringiz yuborilmaydi.",
            "Guruhga qo'shilsangiz, guruh o'qituvchisi guruh topshiriqlaridagi natijalaringizni ko'radi.",
          ],
        },
        {
          title: "Saqlash va himoya",
          items: [
            "Ma'lumotlar shifrlangan ulanish (HTTPS) orqali uzatiladi.",
            "Har bir foydalanuvchi faqat o'z ma'lumotlarini ko'radi — bu ma'lumotlar bazasi darajasida (Row Level Security) cheklangan.",
            "Hisobingiz o'chirilganda unga bog'liq o'qish ma'lumotlari ham o'chiriladi.",
          ],
        },
        {
          title: "Sizning huquqlaringiz",
          items: [
            "O'z ma'lumotlaringizni ko'rish, tuzatish yoki hisobingizni butunlay o'chirishni so'rash mumkin.",
            "Buning uchun Telegram'da @aplushuquq_bot orqali murojaat qiling — so'rovingiz 30 kun ichida bajariladi.",
          ],
        },
        {
          title: "O'zgarishlar",
          items: [
            "Siyosat o'zgarsa, shu sahifada yangilanish sanasi bilan e'lon qilinadi. Muhim o'zgarishlar haqida Telegram bot orqali ham xabar beramiz.",
          ],
        },
      ]}
    />
  );
}
