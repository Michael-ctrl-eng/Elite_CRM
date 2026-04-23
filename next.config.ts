import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Vercel deployment config */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Remove output: "standalone" for Vercel - Vercel handles its own build output
  // If deploying to a VPS/Docker, uncomment the line below:
  // output: "standalone",
};

export default nextConfig;
