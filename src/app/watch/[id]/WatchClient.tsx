"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import styles from "./page.module.css";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import CustomVideoPlayer from "@/components/CustomVideoPlayer";
import BrandIntro from "@/components/BrandIntro";
import {
  getCachedCore,
  getCachedDownload,
  getCachedTmdb,
  getCachedSeasonEpisodes,
  fetchCore,
  fetchDownload,
  fetchTmdb,
  fetchSeasonEpisodes,
  matchesDubId,
  prefetchAllDubs,
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

  const [activeId, setActiveId] = useState(id);

  const [movie, setMovie] = useState<any>(null);
  const [seasonsData, setSeasonsData] = useState<any>(null);
  const [tmdbMeta, setTmdbMeta] = useState<any>(null);
  const [dubs, setDubs] = useState<any[]>([]);
  const [rawApiEpisodes, setRawApiEpisodes] = useState<any[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(true);
  const userSelectedDub = useRef(false);

  const isSeries =
    movie?.subjectType === 2 ||
    seasonsData?.is_series ||
    (Array.isArray(seasonsData) && seasonsData.length > 0) ||
    (seasonsData?.seasons &&
      seasonsData.seasons.some((s: any) => s.season > 0 || s.season_number > 0)) ||
    false;

  const [currentSeason, setCurrentSeason] = useState(initialSeason);
  const [currentEpisode, setCurrentEpisode] = useState(initialEpisode);
  const [files, setFiles] = useState<any[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [selectedFile, setSelectedFile] = useState<any>(null);

  // Branding intro
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

  // 1. Initial details loading
  useEffect(() => {
    let active = true;
    const core = getCachedCore(activeId);
    const cachedTmdbMeta = getCachedTmdb(activeId);
    if (cachedTmdbMeta?.meta) {
      setTmdbMeta(cachedTmdbMeta.meta);
    }
    if (core) {
      setMovie(core.movie);
      setSeasonsData(core.seasons);
      if (core.episodes) setRawApiEpisodes(core.episodes);
      const availableDubs = core.dubs || [];
      setDubs(availableDubs);


      if (core.tmdbId && !cachedTmdbMeta?.meta) {
        setTmdbMeta({ id: core.tmdbId, name: core.movie?.title });
      }
      setDetailsLoading(false);
      if (core.movie?.title && !cachedTmdbMeta?.meta && !core.tmdbId) {
        fetchTmdb(activeId, "tv", core.movie.title)
          .then((res) => {
            if (active && res?.meta) setTmdbMeta(res.meta);
          })
          .catch(() => {});
      }
    } else {
      if (!movie) setDetailsLoading(true);
      fetchCore(activeId)
        .then((data) => {
          if (!active) return;
          setMovie(data.movie);
          setSeasonsData(data.seasons);
          if (data.episodes) setRawApiEpisodes(data.episodes);
          const availableDubs = data.dubs || [];
          setDubs(availableDubs);


          if (data.tmdbId) {
            setTmdbMeta({ id: data.tmdbId, name: data.movie?.title });
          }
          if (data.movie?.title && !data.tmdbId) {
            fetchTmdb(activeId, "tv", data.movie.title)
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
  }, [activeId]);

  // Sync selectedFile when files change (preserving resolution if user had selected one)
  useEffect(() => {
    const playable = (files || []).filter(
      (f: any) =>
        Boolean(f?.stream_link && typeof f.stream_link === "string" && f.stream_link.trim() !== "")
    );
    if (playable.length === 0) {
      return;
    }
    const currentRes = selectedFile?.resolution;
    const matchedFile = currentRes ? playable.find((f: any) => f.resolution === currentRes) : null;
    const defaultFile =
      matchedFile ||
      playable.find((f: any) => f.resolution === "1080p") ||
      playable.find((f: any) => f.resolution === "720p") ||
      playable.find((f: any) => f.resolution === "480p") ||
      playable[0];
    setSelectedFile(defaultFile);
  }, [files]);

  // 2. Fetch stream links (seamlessly without clearing files when switching dubs)
  useEffect(() => {
    if (!movie) return;

    let active = true;
    const backendCoords = isSeries
      ? seasonMapping.mapUiToBackend(currentSeason, currentEpisode)
      : { mbxSeason: 0, mbxEpisode: 0 };
    const s = backendCoords.mbxSeason;
    const e = backendCoords.mbxEpisode;

    const cached = getCachedDownload(activeId, s, e);
    if (cached && cached.length > 0) {
      setFiles(cached);
      setLoadingFiles(false);
      return;
    }

    if (files.length === 0) {
      setLoadingFiles(true);
    }

    fetchDownload(activeId, s, e, isSeries ? "tv" : "movie")
      .then((f) => {
        if (active && f && f.length > 0) {
          setFiles(f);
        }
      })
      .catch((err) => console.error("Failed to load streaming links", err))
      .finally(() => {
        if (active) setLoadingFiles(false);
      });

    return () => {
      active = false;
    };
  }, [currentSeason, currentEpisode, activeId, isSeries, movie, seasonMapping]);

  // 3. Parallel pre-warming of all available language dubs
  // Preloads all audio dub streams in parallel so switching between languages happens instantly in 0ms
  useEffect(() => {
    if (!dubs || dubs.length <= 1) return;

    const backendCoords = isSeries
      ? seasonMapping.mapUiToBackend(currentSeason, currentEpisode)
      : { mbxSeason: 0, mbxEpisode: 0 };
    const s = backendCoords.mbxSeason;
    const e = backendCoords.mbxEpisode;
    const type = isSeries ? "tv" : "movie";

    prefetchAllDubs(dubs, s, e, type);
  }, [dubs, currentSeason, currentEpisode, isSeries, seasonMapping]);

  // Determine next episode
  const nextEp = useMemo(() => {
    if (!isSeries || !seasonMapping.mappedSeasons.length) return null;

    const currentSeasonData = seasonMapping.mappedSeasons.find(
      (s) => s.season === currentSeason
    );
    if (!currentSeasonData) return null;

    if (currentEpisode < currentSeasonData.episode_count) {
      return { season: currentSeason, episode: currentEpisode + 1 };
    } else {
      const nextSeasonData = seasonMapping.mappedSeasons.find(
        (s) => s.season === currentSeason + 1
      );
      if (nextSeasonData && nextSeasonData.episode_count > 0) {
        return { season: currentSeason + 1, episode: 1 };
      }
    }
    return null;
  }, [isSeries, seasonMapping, currentSeason, currentEpisode]);

  // Prefetch next episode
  useEffect(() => {
    if (isSeries && nextEp) {
      const backend = seasonMapping.mapUiToBackend(nextEp.season, nextEp.episode);
      fetchDownload(activeId, backend.mbxSeason, backend.mbxEpisode).catch(() => {});
    }
  }, [isSeries, nextEp, activeId, seasonMapping]);

  // Load episode metadata
  useEffect(() => {
    if (!isSeries) return;

    let active = true;
    const backendCoords = seasonMapping.mapUiToBackend(currentSeason, currentEpisode);

    const cachedSeasonEps = getCachedSeasonEpisodes(activeId, backendCoords.mbxSeason);
    if (cachedSeasonEps && cachedSeasonEps.length > 0) {
      setCurrentSeasonEpisodes(cachedSeasonEps);
    } else {
      fetchSeasonEpisodes(activeId, backendCoords.mbxSeason, tmdbMeta?.id)
        .then((eps) => {
          if (active && eps && eps.length > 0) {
            setCurrentSeasonEpisodes(eps);
          } else if (active && rawApiEpisodes && rawApiEpisodes.length > 0) {
            setCurrentSeasonEpisodes(rawApiEpisodes);
          }
        })
        .catch(() => {
          if (active && rawApiEpisodes && rawApiEpisodes.length > 0) {
            setCurrentSeasonEpisodes(rawApiEpisodes);
          }
        });
    }

    if (nextEp && nextEp.season !== currentSeason) {
      const nextBackendCoords = seasonMapping.mapUiToBackend(nextEp.season, nextEp.episode);
      fetchSeasonEpisodes(activeId, nextBackendCoords.mbxSeason, tmdbMeta?.id)
        .then((eps) => {
          if (active && eps) setNextSeasonEpisodes(eps);
        })
        .catch(() => {});
    }

    return () => {
      active = false;
    };
  }, [isSeries, currentSeason, currentEpisode, activeId, seasonMapping, tmdbMeta?.id, nextEp, rawApiEpisodes]);

  const currentEpisodeMeta = useMemo(() => {
    if (!isSeries || !currentSeasonEpisodes.length) return null;
    return (
      currentSeasonEpisodes.find((e: any) => e.episode_number === currentEpisode) ||
      currentSeasonEpisodes[currentEpisode - 1] ||
      null
    );
  }, [isSeries, currentSeasonEpisodes, currentEpisode]);

  const nextEpisodeMeta = useMemo(() => {
    if (!isSeries || !nextEp) return null;
    if (nextEp.season === currentSeason) {
      return (
        currentSeasonEpisodes.find((e: any) => e.episode_number === nextEp.episode) ||
        currentSeasonEpisodes[nextEp.episode - 1] ||
        null
      );
    } else {
      return (
        nextSeasonEpisodes.find((e: any) => e.episode_number === nextEp.episode) ||
        nextSeasonEpisodes[nextEp.episode - 1] ||
        null
      );
    }
  }, [isSeries, nextEp, currentSeason, currentSeasonEpisodes, nextSeasonEpisodes]);

  const enrichedEpisodes = useMemo(() => {
    if (!isSeries) return [];
    const currentSeasonData = seasonMapping.mappedSeasons.find(
      (s) => s.season === currentSeason
    );
    if (!currentSeasonData) return [];

    const count = currentSeasonData.episode_count || currentSeasonEpisodes.length || 0;
    const list = [];
    for (let i = 1; i <= count; i++) {
      const index = i - 1;
      const matchedEp =
        currentSeasonEpisodes.find((e: any) => e.episode_number === i) ||
        currentSeasonEpisodes[index];
      list.push({
        episode_number: i,
        name: matchedEp?.name || `Episode ${i}`,
        overview: matchedEp?.overview || "",
        still_path: matchedEp?.still_w500 || matchedEp?.still_path || null,
        runtime: matchedEp?.runtime_minutes || matchedEp?.runtime || null,
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

  // Seamless in-place audio dub switch without unmounting player or refreshing page
  const handleDubChange = async (targetDub: any) => {
    const targetId = String(
      targetDub.detail_path ||
      targetDub.detailPath ||
      targetDub.subject_id ||
      targetDub.subjectId ||
      ""
    );
    const cleanActiveId = String(activeId || "");
    const isCurrent = matchesDubId(targetDub, cleanActiveId);

    if (!targetId || isCurrent) return;

    userSelectedDub.current = true;
    setActiveId(targetId);

    const query = isSeries ? `?season=${currentSeason}&episode=${currentEpisode}` : "";
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `/watch/${targetId}${query}`);
    }

    // Instant switch: If parallel pre-warming already cached the stream in memory, swap immediately in 0ms!
    const backendCoords = isSeries
      ? seasonMapping.mapUiToBackend(currentSeason, currentEpisode)
      : { mbxSeason: 0, mbxEpisode: 0 };
    const s = backendCoords.mbxSeason;
    const e = backendCoords.mbxEpisode;
    const cachedFiles = getCachedDownload(targetId, s, e);
    if (cachedFiles && cachedFiles.length > 0) {
      setFiles(cachedFiles);
      setLoadingFiles(false);
    }

    // Refresh core movie details so title matches the newly selected audio dub
    fetchCore(targetId, isSeries ? "tv" : "movie")
      .then((data) => {
        if (data.movie) setMovie(data.movie);
      })
      .catch(() => {});
  };

  const backHref = `/${isSeries ? "tv" : "movie"}/${activeId}`;
  const playerTitle = movie?.title || "Now Playing";
  const episodeLabel = isSeries
    ? `S${currentSeason} · E${currentEpisode}${
        currentEpisodeMeta?.name ? ` · ${currentEpisodeMeta.name}` : ""
      }`
    : undefined;

  const hasPlayerMounted = Boolean(movie);
  const hasError = !detailsLoading && (!movie || (!loadingFiles && (!files || files.length === 0)));

  return (
    <div className={styles.stage}>
      {hasPlayerMounted && (
        <CustomVideoPlayer
          id={activeId}
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
          nextEpisodeTitle={
            isSeries && nextEp
              ? nextEpisodeMeta?.name || `Episode ${nextEp.episode}`
              : undefined
          }
          onNextEpisode={isSeries && nextEp ? handleNextEpisode : undefined}
          fillParent
          backHref={backHref}
          onReady={() => setVideoReady(true)}
          dubs={dubs}
          onDubChange={handleDubChange}
        />
      )}

      {/* Branding intro overlay */}
      {!introDone && !hasError && (
        <BrandIntro
          ready={videoReady}
          onFinish={() => setIntroDone(true)}
          titleLogoUrl={tmdbMeta?.logo_url || getCachedCore(activeId)?.logoUrl || null}
          contentTitle={playerTitle}
        />
      )}

      {/* Initial load fallback skeleton */}
      {introDone && !hasError && (detailsLoading && !movie) && (
        <div className={styles.stageLoader}>
          <Link href={backHref} className={styles.floatingBack} title="Back to details">
            <span>←</span>
          </Link>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "1rem",
              width: "80%",
              maxWidth: "400px",
            }}
          >
            <div
              className="skeleton"
              style={{ width: "64px", height: "64px", borderRadius: "50%", opacity: 0.2 }}
            />
            <span className={styles.stageLoaderText}>{playerTitle}</span>
            <div
              className="skeleton"
              style={{ width: "100%", height: "4px", borderRadius: "2px", opacity: 0.2 }}
            />
          </div>
        </div>
      )}

      {/* Error state */}
      {hasError && (
        <div className={styles.stageError}>
          <Link href={backHref} className={styles.floatingBack} title="Back to details">
            <span>←</span>
          </Link>
          <div className={styles.errorCard}>
            <h2>Playback Unavailable</h2>
            <p>
              We couldn&apos;t find any working streaming links for this title right now. Please try
              again later or choose another source.
            </p>
            <Link href={backHref} className={styles.errorBackBtn}>
              Back to Title Details
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
