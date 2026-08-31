"use client";

import { useState, useEffect, useMemo } from "react";
import styles from "./page.module.css";
import Link from "next/link";
import { Play } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import CustomVideoPlayer from "@/components/CustomVideoPlayer";
import BrandIntro from "@/components/BrandIntro";
import {
  getCachedCore,
  getCachedDownload,
  getCachedTmdb,
  fetchCore,
  fetchDownload,
  fetchTmdb,
} from "@/services/contentCache";
import { buildSeasonMapping } from "@/services/seasonMapper";

interface WatchClientProps {
  id: string;
  initialSeason: number;
  initialEpisode: number;
}

export default function WatchClient({ id, initialSeason, initialEpisode }: WatchClientProps) {
  const router = useRouter();
  const pathname = usePathname();

  // Cache is read inside the first effect (not during render) so SSR and the
  // first client render always match, avoiding hydration mismatches.
  const [movie, setMovie] = useState<any>(null);
  const [seasonsData, setSeasonsData] = useState<any>(null);
  const [tmdbMeta, setTmdbMeta] = useState<any>(null);
  const [dubs, setDubs] = useState<any[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(true);

  const isSeries = movie?.subjectType === 2 || seasonsData?.is_series || (seasonsData?.seasons && seasonsData.seasons.some((s: any) => s.season > 0)) || false;

  const [currentSeason, setCurrentSeason] = useState(initialSeason);
  const [currentEpisode, setCurrentEpisode] = useState(initialEpisode);
  const [files, setFiles] = useState<any[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [selectedFile, setSelectedFile] = useState<any>(null);

  // Branding intro: shown over the stage while the video warms up underneath.
  const [introDone, setIntroDone] = useState(false);
  const [videoReady, setVideoReady] = useState(false);

  // TMDB Episode Metadata States
  const [currentSeasonEpisodes, setCurrentSeasonEpisodes] = useState<any[]>([]);
  const [nextSeasonEpisodes, setNextSeasonEpisodes] = useState<any[]>([]);

  // Sync state when URL params change
  useEffect(() => {
    setCurrentSeason(initialSeason);
    setCurrentEpisode(initialEpisode);
  }, [initialSeason, initialEpisode]);

  const seasonMapping = useMemo(() => {
    return buildSeasonMapping(seasonsData, tmdbMeta?.seasons);
  }, [seasonsData, tmdbMeta?.seasons]);

  // 1. Load core details (movie + seasons) from the warm cache or network
  useEffect(() => {
    let active = true;
    const core = getCachedCore(id);
    const cachedTmdb = getCachedTmdb(id);
    if (cachedTmdb?.meta) {
      setTmdbMeta(cachedTmdb.meta);
    }
    if (core) {
      setMovie(core.movie);
      setSeasonsData(core.seasons);
      setDubs(core.dubs || []);
      setDetailsLoading(false);
      if (core.movie?.title && !cachedTmdb?.meta) {
        fetchTmdb(id, "tv", core.movie.title)
          .then((res) => {
            if (active && res?.meta) setTmdbMeta(res.meta);
          })
          .catch(() => {});
      }
    } else {
      setDetailsLoading(true);
      fetchCore(id)
        .then((data) => {
          if (!active) return;
          setMovie(data.movie);
          setSeasonsData(data.seasons);
          setDubs(data.dubs || []);
          if (data.movie?.title) {
            fetchTmdb(id, "tv", data.movie.title)
              .then((res) => {
                if (active && res?.meta) setTmdbMeta(res.meta);
              })
              .catch(() => {});
          }
        })
        .catch((err) => console.error("Failed to load details", err))
        .finally(() => {
          if (active) setDetailsLoading(false);
        });
    }
    return () => {
      active = false;
    };
  }, [id]);

  // Sync selectedFile when files change (e.g. changing episode)
  useEffect(() => {
    const defaultFile = files.find((f: any) => f.resolution === "720p") || files[0] || null;
    setSelectedFile(defaultFile);
  }, [files]);

  // 2. Fetch stream links whenever the season/episode (or series-ness) changes.
  // Wait until details are loaded: isSeries is derived from the movie payload,
  // so fetching earlier would request with wrong season/episode params.
  useEffect(() => {
    if (detailsLoading || !movie) return;

    let active = true;
    const backendCoords = isSeries
      ? seasonMapping.mapUiToBackend(currentSeason, currentEpisode)
      : { mbxSeason: 0, mbxEpisode: 0 };
    const s = backendCoords.mbxSeason;
    const e = backendCoords.mbxEpisode;

    const cached = getCachedDownload(id, s, e);
    if (cached) {
      setFiles(cached);
      setLoadingFiles(false);
      return;
    }

    setLoadingFiles(true);
    fetchDownload(id, s, e)
      .then((f) => {
        if (active) setFiles(f);
      })
      .catch((err) => console.error("Failed to load streaming links", err))
      .finally(() => {
        if (active) setLoadingFiles(false);
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSeason, currentEpisode, id, isSeries, detailsLoading, movie, seasonMapping]);

  // Determine the next episode (within or across seasons)
  const nextEp = useMemo(() => {
    if (!isSeries || !seasonMapping.mappedSeasons.length) return null;

    const currentSeasonData = seasonMapping.mappedSeasons.find((s) => s.season === currentSeason);
    if (!currentSeasonData) return null;

    if (currentEpisode < currentSeasonData.episode_count) {
      return { season: currentSeason, episode: currentEpisode + 1 };
    } else {
      const nextSeasonData = seasonMapping.mappedSeasons.find((s) => s.season === currentSeason + 1);
      if (nextSeasonData && nextSeasonData.episode_count > 0) {
        return { season: currentSeason + 1, episode: 1 };
      }
    }
    return null;
  }, [isSeries, seasonMapping, currentSeason, currentEpisode]);

  // Prefetch the next episode's stream links so "Next" is instant
  useEffect(() => {
    if (isSeries && nextEp) {
      const backend = seasonMapping.mapUiToBackend(nextEp.season, nextEp.episode);
      fetchDownload(id, backend.mbxSeason, backend.mbxEpisode).catch(() => {});
    }
  }, [isSeries, nextEp, id, seasonMapping]);

  // Load TMDB episode metadata
  useEffect(() => {
    if (!isSeries || !movie?.title) return;

    let active = true;
    const loadTMDBData = async () => {
      try {
        const { searchTVShow, getSeasonEpisodes } = await import("@/services/tmdb");
        const meta = tmdbMeta || (await searchTVShow(movie.title));
        if (!active || !meta?.id) return;

        const targetTmdbSeason = seasonMapping.getTmdbSeason(currentSeason);
        if (targetTmdbSeason !== null) {
          const currentEps = await getSeasonEpisodes(meta.id, targetTmdbSeason);
          if (!active) return;
          setCurrentSeasonEpisodes(currentEps);
        } else {
          if (!active) return;
          setCurrentSeasonEpisodes([]);
        }

        if (nextEp && nextEp.season !== currentSeason) {
          const nextTargetTmdbSeason = seasonMapping.getTmdbSeason(nextEp.season);
          if (nextTargetTmdbSeason !== null) {
            const nextEps = await getSeasonEpisodes(meta.id, nextTargetTmdbSeason);
            if (!active) return;
            setNextSeasonEpisodes(nextEps);
          }
        }
      } catch (err) {
        console.error("Watch page TMDB metadata fetch failed:", err);
      }
    };

    loadTMDBData();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSeason, movie?.title, isSeries, seasonMapping, tmdbMeta]);

  const currentEpisodeMeta = useMemo(() => {
    if (currentEpisode <= 0) return null;
    return (
      currentSeasonEpisodes[currentEpisode - 1] ||
      currentSeasonEpisodes.find((e: any) => e.episode_number === currentEpisode) ||
      null
    );
  }, [currentSeasonEpisodes, currentEpisode]);

  const nextEpisodeMeta = useMemo(() => {
    if (!nextEp) return null;
    const targetEpisodes =
      nextEp.season === currentSeason ? currentSeasonEpisodes : nextSeasonEpisodes;
    if (nextEp.episode <= 0) return null;
    return (
      targetEpisodes[nextEp.episode - 1] ||
      targetEpisodes.find((e: any) => e.episode_number === nextEp.episode) ||
      null
    );
  }, [nextEp, currentSeason, currentSeasonEpisodes, nextSeasonEpisodes]);

  const enrichedEpisodes = useMemo(() => {
    if (!isSeries || !seasonMapping.mappedSeasons.length) return [];
    const currentSeasonData = seasonMapping.mappedSeasons.find((s) => s.season === currentSeason);
    if (!currentSeasonData) return [];
    
    const count = currentSeasonData.episode_count || 0;
    const list = [];
    for (let i = 1; i <= count; i++) {
      const index = i - 1;
      const tmdbEp =
        currentSeasonEpisodes[index] ||
        currentSeasonEpisodes.find((e: any) => e.episode_number === i);
      list.push({
        episode_number: i,
        name: tmdbEp?.name || `Episode ${i}`,
        overview: tmdbEp?.overview || "",
        still_path: tmdbEp?.still_path || null,
        runtime: tmdbEp?.runtime || null,
      });
    }
    return list;
  }, [isSeries, seasonMapping, currentSeason, currentSeasonEpisodes]);

  const handleEpisodeChange = (season: number, episode: number) => {
    setCurrentSeason(season);
    setCurrentEpisode(episode);
    router.push(`${pathname}?season=${season}&episode=${episode}`, { scroll: false });
  };

  const handleNextEpisode = () => {
    if (nextEp) {
      handleEpisodeChange(nextEp.season, nextEp.episode);
    }
  };

  const backHref = `/${isSeries ? "tv" : "movie"}/${id}`;
  const playerTitle = movie?.title || "Now Playing";
  const episodeLabel = isSeries
    ? `S${currentSeason} · E${currentEpisode}${currentEpisodeMeta?.name ? ` · ${currentEpisodeMeta.name}` : ""}`
    : undefined;

  const hasError = !detailsLoading && (!movie || (!loadingFiles && (!files || files.length === 0)));

  // Full-screen stage. The branding intro plays immediately while details +
  // stream links resolve and the video buffers underneath, then fades out once
  // the video is ready (or the intro's max duration elapses).
  return (
    <div className={styles.stage}>
      {/* The player mounts as soon as stream links exist, so the video buffers
          behind the intro. */}
      {movie && !loadingFiles && files && files.length > 0 && (
        <CustomVideoPlayer
          id={id}
          mediaType={isSeries ? "tv" : "movie"}
          season={isSeries ? currentSeason : undefined}
          episode={isSeries ? currentEpisode : undefined}
          posterPath={movie?.cover?.url}
          episodes={enrichedEpisodes}
          currentSeason={currentSeason}
          currentEpisode={currentEpisode}
          onEpisodeChange={handleEpisodeChange}
          files={files}
          selectedFile={selectedFile}
          onQualityChange={setSelectedFile}
          title={playerTitle}
          episodeTitle={episodeLabel}
          nextEpisodeTitle={isSeries && nextEp ? (nextEpisodeMeta?.name || `Episode ${nextEp.episode}`) : undefined}
          onNextEpisode={isSeries && nextEp ? handleNextEpisode : undefined}
          fillParent
          backHref={backHref}
          onReady={() => setVideoReady(true)}
          dubs={dubs}
        />
      )}

      {/* Branding intro overlay — sits on top until it finishes animating out */}
      {!introDone && !hasError && (
        <BrandIntro ready={videoReady} onFinish={() => setIntroDone(true)} />
      )}

      {/* Fallback skeleton loader if the intro finished but the stream is still resolving */}
      {introDone && !hasError && (loadingFiles || (detailsLoading && !movie)) && (
        <div className={styles.stageLoader}>
          <Link href={backHref} className={styles.floatingBack} title="Back to details">
            <span>←</span>
          </Link>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem", width: "80%", maxWidth: "400px" }}>
            <div className="skeleton" style={{ width: "64px", height: "64px", borderRadius: "50%", opacity: 0.2 }} />
            <span className={styles.stageLoaderText}>{playerTitle}</span>
            <div className="skeleton" style={{ width: "100%", height: "4px", borderRadius: "2px", opacity: 0.2 }} />
          </div>
        </div>
      )}

      {/* Error state (only once the intro is not blocking the view) */}
      {hasError && (
        <div className={styles.errorContainer}>
          {!movie ? (
            <>
              <h1>Content not found</h1>
              <Link href="/" className={styles.backHome}>
                Back to Home
              </Link>
            </>
          ) : (
            <>
              <Play size={48} className={styles.disabledPlayIcon} />
              <h2>Streaming is currently unavailable</h2>
              <p>No video links were found for this content. Please try again later.</p>
              <Link href={backHref} className={styles.backHome}>
                Back to Details
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
