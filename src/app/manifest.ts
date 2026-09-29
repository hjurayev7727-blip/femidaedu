import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "A+ Huquq — milliy sertifikatga tayyorgarlik",
    short_name: "A+ Huquq",
    description: "Huquq fanidan milliy sertifikat: mashq, sinov imtihoni, izoh va qonun moddalari.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0f172a",
    theme_color: "#1e293b",
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
