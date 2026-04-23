import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Vercel deployment config */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: [
    ".space.z.ai",
    "preview-chat-69c7bb6e-6c25-47c5-ae77-4ba7bf8efa4f.space.z.ai",
  ],
};

export default nextConfig;
