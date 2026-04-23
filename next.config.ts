import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Vercel deployment config */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: [
    ".space.z.ai",
  ],
};

export default nextConfig;
