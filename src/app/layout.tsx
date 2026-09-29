import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/sw-register";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "cyrillic"],
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  applicationName: "A+ Huquq",
  appleWebApp: { capable: true, title: "A+ Huquq", statusBarStyle: "black-translucent" },
  title: { default: "A+ Huquq — milliy sertifikatga tayyorgarlik", template: "%s · A+ Huquq" },
  description:
    "Huquq fanidan milliy sertifikat imtihoniga tayyorgarlik: mavzu bo'yicha mashq, to'liq sinov imtihoni, xatolar ustida ishlash va qonun moddalari bilan izohlar.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1e293b" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1220" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="uz" className={`${manrope.variable} h-full`}>
      <body className="flex min-h-full flex-col font-sans">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
