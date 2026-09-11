import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "s3.export.k2tool.ru" }],
  },
};

export default nextConfig;
