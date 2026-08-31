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
  themeColor: "#0a0a0f",
  colorScheme: "dark",
};

// Warm up connections to the third-party hosts the page depends on.
// The API serves details/recommendations; wsrv.nl serves every image.
const PRECONNECT_HOSTS = [
  "https://movie-api.opsihab.tech",
  "https://wsrv.nl",
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {PRECONNECT_HOSTS.map((host) => (
          <link key={host} rel="preconnect" href={host} crossOrigin="anonymous" />
        ))}
        <link rel="dns-prefetch" href="https://image.tmdb.org" />
      </head>
      <body suppressHydrationWarning className={inter.variable}>
        <NextTopLoader
          color="#E50914"
          initialPosition={0.08}
          crawlSpeed={200}
          height={3}
          crawl={true}
          showSpinner={false}
          easing="ease"
          speed={200}
          shadow="0 0 12px rgba(229, 9, 20, 0.65)"
        />
        <Navbar />
        <main>{children}</main>
      </body>
    </html>
  );
}