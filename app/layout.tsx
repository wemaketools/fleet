import type { Metadata, Viewport } from "next";
import { Rubik } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const rubik = Rubik({
  variable: "--font-rubik",
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
  openGraph: {
    title: "GPHA Cargo Tracker — Tema Port",
    description:
      "Live simulated cargo truck operations dashboard for Tema Port.",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "GPHA Cargo Tracker live operations dashboard",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og-image.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#FFFFFF",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${rubik.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <TooltipProvider delayDuration={150}>{children}</TooltipProvider>
      </body>
    </html>
  );
}
