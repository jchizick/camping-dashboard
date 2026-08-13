import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2880],
    qualities: [75, 92],
  },
};

export default nextConfig;
