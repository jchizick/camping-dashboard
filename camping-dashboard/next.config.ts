import type { NextConfig } from "next";
import { randomUUID } from "node:crypto";

const fieldProtocolBuildId =
  process.env.FIELD_PROTOCOL_BUILD_ID?.trim() ||
  process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
  randomUUID();

const nextConfig: NextConfig = {
  generateBuildId: async () => fieldProtocolBuildId,
  env: {
    NEXT_PUBLIC_FIELD_PROTOCOL_BUILD_ID: fieldProtocolBuildId,
  },
  images: {
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2880],
    qualities: [75, 92],
  },
};

export default nextConfig;
