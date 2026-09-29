import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // To'lov cheki (≤ 5 MB) server action orqali yuklanadi; multipart qo'shimchasi uchun zaxira bilan
    serverActions: { bodySizeLimit: "6mb" },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // X-Frame-Options: DENY o'rniga — Telegram Web Mini App'ni iframe ichida ochadi
          { key: "Content-Security-Policy", value: "frame-ancestors 'self' https://*.telegram.org" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
