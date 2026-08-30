import type { Metadata } from "next";
import MovieClient from "./MovieClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

const API_BASE = process.env.API_URL || "https://movie-api.opsihab.tech";

interface MinimalDetails {
  title?: string;
  description?: string;
  cover?: { url?: string };
}

// Timeout-guarded so a slow backend can never stall the server render.
// The client (MovieClient) fetches the full payload independently; this only
// feeds <head> metadata.
async function fetchDetails(id: string): Promise<MinimalDetails | null> {
  try {
    const res = await fetch(`${API_BASE}/details/${id}`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return (json?.data ?? json) as MinimalDetails;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const details = await fetchDetails(id);
  const title = details?.title ?? "Movie";
  const description =
    details?.description?.slice(0, 160) ?? "Stream movies in HD on CineAura.";
  const image = details?.cover?.url;

  return {
    title: `${title} — CineAura`,
    description,
    openGraph: {
      title: `${title} — CineAura`,
      description,
      images: image ? [image] : undefined,
      type: "video.movie",
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} — CineAura`,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function MovieDetails({ params }: PageProps) {
  const { id } = await params;
  return <MovieClient id={id} />;
}
