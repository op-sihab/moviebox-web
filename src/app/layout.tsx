import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import NextTopLoader from "nextjs-toploader";
import "./globals.css";
import Navbar from "@/components/Navbar";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-inter",
});

const siteUrl = new URL(
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
);

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: {
    default: "CineAura Stream | Premium Streaming",
    template: "%s | CineAura",
  },
  description: "High-quality movie and tv series streaming.",
  openGraph: {
    type: "website",
    siteName: "CineAura Stream",
    title: "CineAura Stream | Premium Streaming",
    description: "High-quality movie and tv series streaming.",
    url: siteUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "CineAura Stream | Premium Streaming",
    description: "High-quality movie and tv series streaming.",
  },
  icons: {
    icon: "/favicon.ico",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#09090B",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning className={inter.variable}>
        <NextTopLoader
          color="var(--accent-color, #8B5CF6)"
          initialPosition={0.08}
          crawlSpeed={200}
          height={3}
          crawl={true}
          showSpinner={false}
          easing="ease"
          speed={200}
          shadow="0 0 10px var(--accent-color, #8B5CF6)"
        />
        <Navbar />
        <main>{children}</main>
      </body>
    </html>
  );
}