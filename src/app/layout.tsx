import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Elite CRM",
  description: "Elite CRM - Multi-tenant Customer Relationship Management",
  keywords: ["CRM", "Elite", "Next.js", "TypeScript", "Tailwind CSS", "shadcn/ui", "React"],
  authors: [{ name: "Elite CRM Team" }],
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "Elite CRM",
    description: "Multi-tenant Customer Relationship Management",
    siteName: "Elite CRM",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Elite CRM",
    description: "Multi-tenant Customer Relationship Management",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
