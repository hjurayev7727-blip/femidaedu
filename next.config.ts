import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // To'lov cheki (≤ 5 MB) server action orqali yuklanadi; multipart qo'shimchasi uchun zaxira bilan
    serverActions: { bodySizeLimit: "6mb" },
  },
};

export default nextConfig;
