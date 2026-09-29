-- Boshlang'ich ma'lumotlar. Qayta ishga tushirsa ham xavfsiz (on conflict).

-- Spetsifikatsiya bo'limlari — UZBMB "Huquqshunoslik fanlaridan test varianti tafsiloti"
insert into public.spec_sections (code, parent, title, sort) values
  ('1',    null, 'O''zbekiston davlati va huquqi asoslari', 100),
  ('1.1',  '1',  'Shaxs, jamiyat va davlat', 101),
  ('1.2',  '1',  'Fuqarolik jamiyati va huquqiy davlat', 102),
  ('1.3',  '1',  'O''zbekiston Respublikasida davlat boshqaruvining tashkil etilishi', 103),
  ('1.4',  '1',  'Axloq va huquq. Huquqiy munosabatlar', 104),
  ('1.5',  '1',  'Huquqbuzarlik va yuridik javobgarlik', 105),
  ('1.6',  '1',  'Voyaga yetmaganlar huquqlari va burchlari', 106),
  ('2',    null, 'Konstitutsiyaviy huquq asoslari', 200),
  ('2.1',  '2',  'Konstitutsiya — davlatning asosiy qonuni', 201),
  ('2.2',  '2',  'Inson va fuqarolarning asosiy huquqlari, erkinliklari va burchlari', 202),
  ('2.3',  '2',  'Jamiyat va shaxs', 203),
  ('2.4',  '2',  'Davlat boshqaruv organlari', 204),
  ('2.5',  '2',  'Konstitutsiya — mamlakatda demokratiyani rivojlantirish kafolati', 205),
  ('3',    null, 'Huquq sohalari', 300),
  ('3.1',  '3',  'O''zbekiston Respublikasi — xalqaro huquq subyekti', 301),
  ('3.2',  '3',  'Konstitutsiyaviy huquq asoslari', 302),
  ('3.3',  '3',  'Ma''muriy huquq asoslari', 303),
  ('3.4',  '3',  'Fuqarolik huquqi asoslari', 304),
  ('3.5',  '3',  'Mehnat huquqi asoslari', 305),
  ('3.6',  '3',  'Oila huquqi', 306),
  ('3.7',  '3',  'Jinoyat huquqi', 307),
  ('3.8',  '3',  'Moliya huquqi', 308),
  ('3.9',  '3',  'Ekologik huquq', 309),
  ('3.10', '3',  'Protsessual huquq', 310)
on conflict (code) do update set parent = excluded.parent, title = excluded.title, sort = excluded.sort;

-- Standart mock shabloni — umumiy milliy sertifikat formati (rasmiy huquq spetsifikatsiyasi
-- e'lon qilinguncha). Ball qiyinlikka bog'liq: yopiq 1,3 / 2,2 / 3,2; yozma qism 1,1 / 1,5 / 1,7.
-- 35 yopiq = 10×1,3 + 18×2,2 + 7×3,2 = 75; 10 yozma (a+b) = 25 (qismlar bali — kurs javob kalitidagi
-- namunadek, written_points); jami 100 → shkala 75.
insert into public.exam_templates (slug, title, duration_min, blueprint, raw_max, scale_max, grades) values (
  'milliy-sertifikat-standart',
  'Milliy sertifikat — to''liq sinov',
  90,
  '{
    "sections": [
      {"from": 1,  "to": 32, "kind": "closed",  "types": ["single", "multi", "matching", "ordering", "case"]},
      {"from": 33, "to": 35, "kind": "closed",  "types": ["fill_blank"], "shared_options": 6},
      {"from": 36, "to": 45, "kind": "written", "types": ["open"], "parts": ["a", "b"]}
    ],
    "closed_difficulty_mix": {"1": 10, "2": 18, "3": 7},
    "points": {"closed": {"1": 1.3, "2": 2.2, "3": 3.2}, "written_part": {"1": 1.1, "2": 1.5, "3": 1.7}},
    "written_points": [[1.1, 1.1], [1.5, 1.7], [1.5, 1.7], [1.5, 1.1], [1.1, 1.7],
                       [1.1, 1.1], [1.1, 1.1], [1.1, 1.1], [1.1, 1.1], [1.1, 1.1]]
  }'::jsonb,
  100, 75,
  '[{"grade": "A+", "min": 70}, {"grade": "A", "min": 65}, {"grade": "B+", "min": 60},
    {"grade": "B", "min": 55}, {"grade": "C+", "min": 50}, {"grade": "C", "min": 46}]'::jsonb
) on conflict (slug) do update set blueprint = excluded.blueprint, raw_max = excluded.raw_max,
  scale_max = excluded.scale_max, grades = excluded.grades;

insert into public.badges (code, title, description, icon) values
  ('first_test',  'Birinchi qadam',   'Birinchi testni yakunladingiz', '🎯'),
  ('streak_7',    'Bir hafta',        '7 kun ketma-ket shug''ullandingiz', '🔥'),
  ('streak_30',   'Temir iroda',      '30 kun ketma-ket shug''ullandingiz', '💎'),
  ('q_500',       '500 savol',        '500 ta savolga javob berdingiz', '📚'),
  ('mock_a_plus', 'Maqsad — A+',      'Mock imtihonda A+ darajasini oldingiz', '🏆'),
  ('no_mistakes', 'Xatosiz',          'Xatolar daftarini to''liq tozaladingiz', '✅')
on conflict (code) do nothing;

-- Tariflar — VAQTINCHALIK narxlar. Haqiqiy narxni admin panel (/admin/sozlamalar) yoki shu yerda o'zgartiring.
insert into public.plans (code, title, months, price_uzs, sort) values
  ('oy1', '1 oy', 1, 49000, 1),
  ('oy3', '3 oy', 3, 129000, 2)
on conflict (code) do nothing;

-- Qo'lda to'lov rekvizitlari — admin panelda to'ldiriladi (bo'sh bo'lsa, to'lov formasi yopiq)
insert into public.app_settings (key, value) values
  ('manual_payment', '{"card": "", "holder": "", "note": "To''lovdan keyin chek rasmini yuklang — 24 soat ichida tasdiqlanadi."}')
on conflict (key) do nothing;
