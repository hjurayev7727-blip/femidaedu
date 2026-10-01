// Faqat ishlab chiqish uchun: yuristlar sahifalari namuna ma'lumot bilan (Supabase'siz). Production'da mavjud emas.
import { notFound } from "next/navigation";
import { LawyerCabinetView } from "@/components/lawyers/cabinet-view";
import { DisabledNotice, LawyersCatalogView, LawyersSoon } from "@/components/lawyers/catalog-view";
import type { FieldInfo } from "@/components/lawyers/lawyer-card";
import { LawyerProfileView } from "@/components/lawyers/lawyer-profile";
import { ReportForm } from "@/components/lawyers/report-form";
import { VerificationView } from "@/components/lawyers/verification-view";
import type { LawyerCard, LawyerPublic, MyLawyer } from "@/lib/lawyers-server";
import { demoReport, demoSaveLawyer, demoSubmit, demoUpload } from "./actions";

const FIELDS: FieldInfo[] = [
  { slug: "fuqarolik", title: "Fuqarolik huquqi", icon: "🤝" },
  { slug: "oila", title: "Oila huquqi", icon: "👪" },
  { slug: "jinoyat", title: "Jinoyat huquqi", icon: "⚖️" },
  { slug: "mehnat", title: "Mehnat huquqi", icon: "💼" },
  { slug: "soliq", title: "Soliq huquqi", icon: "🧾" },
  { slug: "uy-joy", title: "Uy-joy huquqi", icon: "🏠" },
  { slug: "istemolchi", title: "Iste'molchilar huquqlari", icon: "🛒" },
  { slug: "yer", title: "Yer huquqi", icon: "🌾" },
];

const card = (over: Partial<LawyerCard> & Pick<LawyerCard, "id" | "display_name">): LawyerCard => ({
  kind: "yurist", headline: "", fields: ["fuqarolik"], region: "Toshkent shahri", experience_years: 3, languages: ["uz"],
  price_from_uzs: null, verified: false, rating: null, rating_count: 0, ...over,
});

const LAWYERS: LawyerCard[] = [
  card({ id: "00000000-0000-4000-8000-000000000001", display_name: "Namuna Advokat Karimova", kind: "advokat", verified: true,
    headline: "Oilaviy nizolar: ajrashish, aliment, mol-mulk bo'linishi", fields: ["oila", "fuqarolik", "uy-joy"],
    region: "Toshkent shahri", experience_years: 12, languages: ["uz", "ru"], price_from_uzs: 200000, rating: 4.8, rating_count: 23 }),
  card({ id: "00000000-0000-4000-8000-000000000002", display_name: "Namuna Advokat Rahimov", kind: "advokat", verified: true,
    headline: "Jinoyat ishlari bo'yicha himoya, tergovda va sudda", fields: ["jinoyat"], region: "Samarqand",
    experience_years: 9, languages: ["uz", "ru"], price_from_uzs: 300000, rating: 4.6, rating_count: 11 }),
  card({ id: "00000000-0000-4000-8000-000000000003", display_name: "Namuna Yurist Toshmatova",
    headline: "Mehnat nizolari: ish haqi, ishdan bo'shatish, ta'til", fields: ["mehnat", "soliq"], region: "Farg'ona",
    experience_years: 5, languages: ["uz"], price_from_uzs: 100000, rating: 5, rating_count: 2 }),
  card({ id: "00000000-0000-4000-8000-000000000004", display_name: "Namuna Yurist Aliyev",
    headline: "Iste'molchi huquqlari va shartnomalar tekshiruvi", fields: ["istemolchi", "fuqarolik", "uy-joy", "yer"],
    region: "Andijon", experience_years: 0, languages: ["uz", "ru", "en"] }),
];

const PUB: LawyerPublic = {
  ...LAWYERS[0], created_at: "2026-09-20T10:00:00Z",
  bio: "Namuna matn. 2014 yildan advokatlik faoliyati bilan shug'ullanaman.\nAsosiy yo'nalish — oilaviy nizolar: nikohni bekor qilish, aliment undirish, bolaning yashash joyini belgilash va er-xotin mol-mulkini bo'lish.\nMaslahat onlayn yoki ofisda, hujjatlarni oldindan ko'rib chiqaman.",
};

const MINE: MyLawyer = {
  user_id: LAWYERS[2].id, kind: "yurist", display_name: LAWYERS[2].display_name, headline: LAWYERS[2].headline,
  bio: "Namuna: 5 yil davomida korxonada yurist bo'lib ishlaganman.", fields: LAWYERS[2].fields, region: "Farg'ona",
  experience_years: 5, languages: ["uz"], price_from_uzs: 100000, phone: "+998901234567", telegram: "namuna_yurist",
  status: "active", verified_at: null, rating: 5, rating_count: 2, created_at: "2026-09-25T10:00:00Z",
};

export default async function DevLawyers({ searchParams }: PageProps<"/dev/yuristlar">) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await searchParams;
  const page = String(sp.sahifa ?? "katalog");
  const byslug = new Map(FIELDS.map((f) => [f.slug, f]));
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-6">
      <p className="rounded-xl bg-amber-soft px-4 py-2 text-sm font-semibold text-amber">Namuna ma&apos;lumot (faqat ishlab chiqish uchun).</p>
      {page === "katalog" && (
        <LawyersCatalogView items={LAWYERS} more page={0} filters={{ field: null, region: null, q: null }} fields={FIELDS}
          cta={<span className="text-sm font-bold text-gold-2 underline">Siz yuristmisiz? Bepul ro&apos;yxatdan o&apos;ting →</span>} />
      )}
      {page === "bosh" && (
        <LawyersCatalogView items={[]} more={false} page={0} filters={{ field: "yer", region: "Navoiy", q: null }} fields={FIELDS}
          notice={<DisabledNotice />} cta={null} />
      )}
      {page === "yopiq" && <LawyersSoon />}
      {page === "profil" && <LawyerProfileView l={PUB} fields={byslug} report={<ReportForm lawyerId={PUB.id} action={demoReport} />} />}
      {page === "profil2" && <LawyerProfileView l={{ ...LAWYERS[3], bio: "", created_at: PUB.created_at }} fields={byslug} report={<ReportForm lawyerId={LAWYERS[3].id} action={demoReport} />} />}
      {page === "yangi" && <LawyerCabinetView profile={null} verification={null} fields={FIELDS} enabled={false} action={demoSaveLawyer} />}
      {page === "kabinet" && <LawyerCabinetView profile={MINE} verification={null} fields={FIELDS} enabled action={demoSaveLawyer} />}
      {page === "tasdiqlash" && (
        <VerificationView profile={MINE} createUpload={demoUpload} submit={demoSubmit}
          verification={{ id: 1, license_no: "D-12345", status: "rejected", reason: "Rasm xira, raqam o'qilmaydi", created_at: "2026-09-28T09:00:00Z" }} />
      )}
    </main>
  );
}
