import type { Metadata, Viewport } from "next";
import { Manrope, Playfair_Display } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/sw-register";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "cyrillic"],
  weight: ["500", "600", "700", "800"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin", "cyrillic"],
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  applicationName: "Femida Edu",
  appleWebApp: { capable: true, title: "Femida Edu", statusBarStyle: "black-translucent" },
  title: { default: "Femida Edu — huquq bo'yicha hammasi bir joyda", template: "%s · Femida Edu" },
  description:
    "Har kim uchun huquq: qonunlarni o'rganing, savolingizga qonun moddasi bilan javob oling, hujjatingizni tekshiring va yurist bilan bog'laning.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0e2340" },
    { media: "(prefers-color-scheme: dark)", color: "#0a1426" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="uz" className={`${manrope.variable} ${playfair.variable} h-full`}>
      <body className="flex min-h-full flex-col font-sans">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
