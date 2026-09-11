import type { NextConfig } from "next";
import { randomUUID } from "node:crypto";

const fieldProtocolBuildId =
  process.env.FIELD_PROTOCOL_BUILD_ID?.trim() ||
  process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
  randomUUID();

const nextConfig: NextConfig = {
  // Opaque invite tokens (including OAuth return destinations) must not reach dev access logs.
  logging: { incomingRequests: { ignore: [/\/invite\//, /\/auth\/callback/, /[?&]next=/] } },
  async headers() {
    return [{ source: '/invite/:path*', headers: [
      { key: 'Cache-Control', value: 'private, no-store' },
      { key: 'Referrer-Policy', value: 'no-referrer' },
      { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
    ] }];
  },
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
