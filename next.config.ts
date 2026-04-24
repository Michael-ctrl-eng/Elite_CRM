import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: [
    ".space.z.ai",
    "preview-chat-69c7bb6e-6c25-47c5-ae77-4ba7bf8efa4f.space.z.ai",
  ],
  // Server runtime config - available server-side only (not exposed to client)
  serverRuntimeConfig: {
    DATABASE_URL: process.env.DATABASE_URL || "mysql://u184662983_Helite:Helite%2B12@auth-db2122.hstgr.io:3306/u184662983_Helite",
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || "83O/mbx8leZ3juO8mWc/6SL1iyp7xAaCZcNVaTEqdvM=",
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || "https://crm.elitepartnersus.com",
    CAREERS_API_KEY: process.env.CAREERS_API_KEY || "elite-careers-api-key-2024",
    SMTP_HOST: process.env.SMTP_HOST || "smtp.hostinger.com",
    SMTP_PORT: process.env.SMTP_PORT || "465",
    SMTP_SECURE: process.env.SMTP_SECURE || "true",
    SMTP_SENDER: process.env.SMTP_SENDER || "noreply@elitepartnersus.com",
    SMTP_USER: process.env.SMTP_USER || "noreply@elitepartnersus.com",
    SMTP_PASS: process.env.SMTP_PASS || "",
  },
  // Public runtime config - available client-side
  publicRuntimeConfig: {
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || "Elite CRM",
    NEXT_PUBLIC_SIGNUP_ENABLED: process.env.NEXT_PUBLIC_SIGNUP_ENABLED || "false",
    NEXT_PUBLIC_DEMO_MODE: process.env.NEXT_PUBLIC_DEMO_MODE || "false",
  },
};

export default nextConfig;
