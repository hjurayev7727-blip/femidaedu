import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Foydalanish shartlari" };
export const dynamic = "force-static";

export default function Terms() {
  return (
    <LegalPage
      title="Foydalanish shartlari"
      updated="2026-yil 29-sentabr"
      intro="A+ Huquq platformasidan foydalanib, siz quyidagi shartlarga rozilik bildirasiz."
      sections={[
        {
          title: "Xizmat",
          items: [
            "Platforma huquq fanidan milliy sertifikat imtihoniga tayyorlanish uchun mashq, sinov imtihoni va izohlar beradi.",
            "Sinov imtihonidagi ball va daraja taxminiy — rasmiy imtihon natijasini kafolatlamaydi.",
            "Izohlar va qonun moddalari o'quv maqsadida beriladi va yuridik maslahat hisoblanmaydi. Qonunchilik o'zgarishi mumkin — rasmiy manbalar (lex.uz) ustuvor.",
          ],
        },
        {
          title: "Hisob",
          items: [
            "Telegram yoki Google orqali kirasiz; hisobingiz xavfsizligi uchun o'zingiz javobgarsiz.",
            "Bitta hisobdan boshqalar bilan birgalikda foydalanish, savollarni ommaviy ko'chirib tarqatish yoki tizimni avtomatlashtirilgan tarzda yuklash taqiqlanadi.",
            "Qoidalar buzilganda hisob cheklanishi mumkin.",
          ],
        },
        {
          title: "Bepul tarif va Premium",
          items: [
            "Bepul tarifda kunlik savol, oylik sinov imtihoni va AI so'rovlari soni cheklangan.",
            "Premium tanlangan muddatga (1 yoki 3 oy) cheklovlarni olib tashlaydi. Narxlar Premium sahifasida ko'rsatiladi.",
            "To'lov karta orqali o'tkaziladi va chek yuklanadi; administrator tekshirgach Premium faollashadi. Chek soxta yoki qayta ishlatilgan bo'lsa, so'rov rad etiladi.",
            "Premium faollashgandan keyin to'lov qaytarilmaydi, texnik nosozlik tufayli xizmat ko'rsatilmagan holatlar bundan mustasno.",
          ],
        },
        {
          title: "Kontent",
          items: [
            "Savollar, izohlar va platforma dizayni A+ Huquq'ga tegishli. Ularni ruxsatsiz nusxalash va tarqatish mumkin emas.",
            "Savolda xato topsangiz, @aplushuquq_bot orqali yuboring — tekshirib tuzatamiz.",
          ],
        },
        {
          title: "Aloqa",
          items: ["Savol va takliflar uchun: Telegram — @aplushuquq_bot."],
        },
      ]}
    />
  );
}
