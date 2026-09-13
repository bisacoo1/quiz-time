import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow live-reload from hosted dev previews (e.g. *.e2b.app sandboxes).
  // Dev-only: this has no effect on production builds.
  allowedDevOrigins: ["*.e2b.app", "*.arena.ai", "localhost"],
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
