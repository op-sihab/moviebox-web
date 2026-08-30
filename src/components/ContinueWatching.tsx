"use client";

import { useState, useEffect } from "react";
import Carousel from "./Carousel";
import type { Movie } from "./MovieCard";

export default function ContinueWatching() {
  const [history, setHistory] = useState<Movie[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem("mbx:continue_watching");
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Map to match the shape MovieCard / Carousel expects
          const mapped = (parsed as Record<string, unknown>[]).map(
            (item): Movie => ({
              id: item.id as string | number | undefined,
              title: item.title as string | undefined,
              poster_path: item.posterPath as string | undefined,
              vote_average: 0,
              release_date: "",
              _id: item.id as string | undefined, // Use id directly for watch route or detail route
              media_type: (item.mediaType as string | undefined) || "movie",
              progress: item.progress as number | undefined,
              duration: item.duration as number | undefined,
              episodeTitle: item.episodeTitle as string | undefined,
              season: item.season as number | undefined,
              episode: item.episode as number | undefined,
            })
          );
          setHistory(mapped);
        }
      }
    } catch (e) {
      console.error("Failed to load continue watching history:", e);
    }
  }, []);

  // Keep the mounted guard: localStorage is unavailable during SSR
  if (!mounted || history.length === 0) return null;

  return (
    <div style={{ marginBottom: "2rem" }}>
      <Carousel title="Continue Watching" movies={history} eager={true} />
    </div>
  );
}