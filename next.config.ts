import type { NextConfig } from "next";

const config: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "12mb" },
  },
  allowedDevOrigins: ["192.168.1.37"],
  images: {
    // Covers are served from our own storage route; remote covers are opt-in.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default config;
