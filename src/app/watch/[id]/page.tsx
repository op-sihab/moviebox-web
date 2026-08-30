import type { Metadata } from "next";
import WatchClient from "./WatchClient";

export const metadata: Metadata = {
  title: "Watch — CineAura",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    s?: string;
    e?: string;
    season?: string;
    episode?: string;
    q?: string;
  }>;
}

export default async function WatchPage({ params, searchParams }: PageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const id = resolvedParams.id;

  const initialSeason = parseInt(resolvedSearchParams.season || resolvedSearchParams.s || "1");
  const initialEpisode = parseInt(resolvedSearchParams.episode || resolvedSearchParams.e || "1");

  // Full-screen watch experience. WatchClient fetches details + stream links on
  // the client, reusing the warm contentCache (often already populated by the
  // details page) so the player appears instantly with no blocking server calls.
  return <WatchClient id={id} initialSeason={initialSeason} initialEpisode={initialEpisode} />;
}
