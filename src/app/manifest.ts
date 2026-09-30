import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Femida Edu — huquq bo'yicha hammasi bir joyda",
    short_name: "Femida Edu",
    description: "Milliy sertifikat va huquq sohalari: mashq, sinov imtihoni, qonun moddalari bilan izoh, AI testlar.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#081628",
    theme_color: "#0e2340",
    lang: "uz",
    categories: ["education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Kunlik test", url: "/api/kunlik" },
      { name: "Mashq", url: "/app/mashq" },
      { name: "Takrorlash", url: "/app/takrorlash" },
    ],
  };
}
