import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl =
  process.env.VERCEL_PROJECT_PRODUCTION_URL ??
  process.env.VERCEL_URL ??
  "localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(
    siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`,
  ),
  title: "GPHA Cargo Tracker — Tema Port",
  description:
    "Live operations dashboard for Ghana Ports and Harbours Authority cargo fleet at Tema Port.",
  icons: {
    icon: "/gpha-logo.png",
  },
  openGraph: {
    title: "GPHA Cargo Tracker — Tema Port",
    description:
      "Live simulated cargo truck operations dashboard for Tema Port.",
    type: "website",
    images: [
      {
        url: "/og-image.svg",
        width: 1200,
        height: 630,
        alt: "GPHA Cargo Tracker live operations dashboard",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistMono.variable} dark h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="bg-[#0B0F19] text-slate-200 min-h-full flex flex-col">
        <TooltipProvider delayDuration={150}>{children}</TooltipProvider>
      </body>
    </html>
  );
}
