import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allows an isolated candidate build beside the active `.next` directory.
  // Production keeps the default unless the release script sets NEXT_DIST_DIR.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  compress: true,
  productionBrowserSourceMaps: false,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [{ protocol: "https", hostname: "s3.export.k2tool.ru", pathname: "/**" }],
  },
  experimental: {
    // Каталог генерирует сотни маршрутов. Один worker делает релизную сборку
    // предсказуемой на сервере и локально без пиков памяти от параллельных БД-чтений.
    cpus: 1,
    serverActions: { bodySizeLimit: "12mb" },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
