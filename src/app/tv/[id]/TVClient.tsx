"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import styles from "./page.module.css";
import Link from "next/link";
import {
  Play,
  Plus,
  Check,
  Star,
  ChevronDown,
  Volume2,
  ChevronLeft,
  Film,
  Sparkles,
} from "lucide-react";
import Carousel from "@/components/Carousel";
import DetailPageSkeleton from "@/components/DetailPageSkeleton";
import MovieCardSkeleton from "@/components/MovieCardSkeleton";
import {
  getCachedCore,
  getCachedTmdb,
  getCachedRecs,
  getCachedSeasonEpisodes,
  fetchCore,
  fetchTmdb,
  fetchRecs,
  fetchSeasonEpisodes,
  prefetchDownload,
  prefetchDetails,
  matchesDubId,
} from "@/services/contentCache";
import { getSeasonEpisodes } from "@/services/tmdb";
import { buildSeasonMapping } from "@/services/seasonMapper";
import { img } from "@/services/image";
import { isInMyList, toggleMyList } from "@/services/mylist";

interface TVClientProps {
  id: string;
}

export default function TVClient({ id }: TVClientProps) {
  const cachedCore = getCachedCore(id);
  const cachedTmdb = getCachedTmdb(id);
  const cachedRecs = getCachedRecs(id);

  const [activeId, setActiveId] = useState(id);
  const [retryToken, setRetryToken] = useState(0);

  // Sync prop changes & always scroll window to the top instantly
  useEffect(() => {
    setActiveId(id);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
  }, [id]);

  const [movie, setMovie] = useState<any>(null);
  const [cast, setCast] = useState<any[]>([]);
  const [dubs, setDubs] = useState<any[]>([]);
  const [seasonsData, setSeasonsData] = useState<any>(null);
  const [rawApiEpisodes, setRawApiEpisodes] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [tmdbBackdropUrl, setTmdbBackdropUrl] = useState<string | null>(null);
  const [tmdbShowMeta, setTmdbShowMeta] = useState<any>(null);
  const [showAllDubs, setShowAllDubs] = useState(false);
  const userSelectedDub = useRef(false);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [recsLoading, setRecsLoading] = useState(true);
  const [inList, setInList] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [episodesProgress, setEpisodesProgress] = useState<{ [key: string]: { progress: number; duration: number } }>({});
  const [continueRecord, setContinueRecord] = useState<{ season: number; episode: number } | null>(null);

  // Continue watching detection
  useEffect(() => {
    try {
      const saved = localStorage.getItem("mbx:continue_watching");
      if (saved) {
        const history = JSON.parse(saved);
        const allIds = new Set<string>();
        allIds.add(String(activeId));
        if (movie?.subjectId) allIds.add(String(movie.subjectId));
        if (movie?.detailPath) allIds.add(String(movie.detailPath));
        if (dubs) {
          dubs.forEach((d: any) => {
            if (d.subject_id) allIds.add(String(d.subject_id));
            if (d.detail_path) allIds.add(String(d.detail_path));
          });
        }

        const getBaseTitle = (t: string) => {
          if (!t) return "";
          return t.replace(/\[[^\]]+\]/g, "").replace(/\([^\)]+\)/g, "").trim().toLowerCase();
        };
        const currentBaseTitle = getBaseTitle(movie?.title || "");

        const progMap: { [key: string]: { progress: number; duration: number } } = {};
        let latestTvRecord: any = null;
        let latestTimestamp = 0;

        history.forEach((item: any) => {
          const idMatches = allIds.has(String(item.id));
          const titleMatches = currentBaseTitle && item.title && item.mediaType === "tv" && getBaseTitle(item.title) === currentBaseTitle;

          if (idMatches || titleMatches) {
            if (item.season && item.episode) {
              progMap[`${item.season}:${item.episode}`] = {
                progress: item.progress || 0,
                duration: item.duration || 0,
              };

              const ts = item.updatedAt || 0;
              if (ts > latestTimestamp || !latestTvRecord) {
                latestTimestamp = ts;
                latestTvRecord = item;
              }
            }
          }
        });

        setEpisodesProgress(progMap);
        if (latestTvRecord && latestTvRecord.season && latestTvRecord.episode) {
          setContinueRecord({
            season: latestTvRecord.season,
            episode: latestTvRecord.episode,
          });
        } else {
          setContinueRecord(null);
        }
      } else {
        setEpisodesProgress({});
        setContinueRecord(null);
      }
    } catch (e) {
      console.error("Failed to load continue watching record in TV details page", e);
    }
  }, [activeId, movie, dubs]);

  // List state
  useEffect(() => {
    if (movie) {
      setInList(isInMyList({ _id: activeId, id: activeId }));
    }
  }, [movie, activeId]);

  const handleToggleList = () => {
    if (!movie) return;
    const nowIn = toggleMyList({
      _id: activeId,
      id: activeId,
      title: movie.title,
      poster_path: movie.cover?.url,
      vote_average: movie.imdbRatingValue ? parseFloat(movie.imdbRatingValue) : 0,
      release_date: movie.releaseDate,
      media_type: "tv",
    });
    setInList(nowIn);
  };

  // Core metadata fetching
  useEffect(() => {
    let active = true;

    const core = getCachedCore(activeId);
    const tmdb = getCachedTmdb(activeId);
    const recs = getCachedRecs(activeId);

    if (core) {
      setMovie(core.movie);
      setCast(core.cast);
      setDubs(core.dubs || []);
      setSeasonsData(core.seasons);
      if (core.episodes) setRawApiEpisodes(core.episodes);
      if (core.backdropUrl) setTmdbBackdropUrl(core.backdropUrl);
      if (core.logoUrl) {
        setTmdbShowMeta((prev: any) => ({ ...prev, logo_url: core.logoUrl }));
      }
      if (core.tmdbId) {
        setTmdbShowMeta((prev: any) => ({
          ...prev,
          id: core.tmdbId,
          name: core.movie?.title,
          logo_url: core.logoUrl || prev?.logo_url || null,
        }));
      }
      const rawS = core.seasons;
      const firstSeason = Array.isArray(rawS) && rawS.length > 0
        ? (rawS[0].season_number ?? rawS[0].season ?? 1)
        : (Array.isArray(rawS?.seasons) && rawS.seasons.length > 0
          ? (rawS.seasons[0].season_number ?? rawS.seasons[0].season ?? 1)
          : 1);
      setSelectedSeason(firstSeason);
      // Predictive Async Pre-warming: load S1:E1 or continue-watching stream in background
      prefetchDownload(activeId, continueRecord?.season || firstSeason, continueRecord?.episode || 1);
      if (active) setLoading(false);
    } else if (!movie) {
      setLoading(true);
    }
    if (tmdb) {
      if (tmdb.backdropUrl) setTmdbBackdropUrl(tmdb.backdropUrl);
      setTmdbShowMeta((prev: any) => ({ ...prev, ...tmdb.meta, logo_url: tmdb.logoUrl || tmdb.meta?.logo_url || prev?.logo_url }));
    }
    if (recs) {
      setRecommendations(recs);
      setRecsLoading(false);
    } else {
      setRecsLoading(true);
    }

    // CRITICAL PATH (Now includes direct backdrop, logo, and tmdb_id)
    fetchCore(activeId, "tv")
      .then((data) => {
        if (!active) return;
        setMovie(data.movie);
        setCast(data.cast);
        setDubs(data.dubs || []);
        setSeasonsData(data.seasons);

        if (data.episodes) setRawApiEpisodes(data.episodes);
        if (data.backdropUrl) setTmdbBackdropUrl(data.backdropUrl);
        if (data.logoUrl) {
          setTmdbShowMeta((prev: any) => ({ ...prev, logo_url: data.logoUrl }));
        }
        if (data.tmdbId) {
          setTmdbShowMeta((prev: any) => ({
            ...prev,
            id: data.tmdbId,
            name: data.movie?.title,
            logo_url: data.logoUrl || prev?.logo_url || null,
          }));
        }
        const rawFetchS = data.seasons;
        const fetchFirstSeason = Array.isArray(rawFetchS) && rawFetchS.length > 0
          ? (rawFetchS[0].season_number ?? rawFetchS[0].season ?? 1)
          : (Array.isArray(rawFetchS?.seasons) && rawFetchS.seasons.length > 0
            ? (rawFetchS.seasons[0].season_number ?? rawFetchS.seasons[0].season ?? 1)
            : 1);
        setSelectedSeason(fetchFirstSeason);
        setFetchError(false);
        setLoading(false);

        // Predictive Async Pre-warming
        prefetchDownload(activeId, continueRecord?.season || fetchFirstSeason, continueRecord?.episode || 1, "tv");

        if (data.movie?.title && (!data.backdropUrl || !data.logoUrl || !data.tmdbId)) {
          fetchTmdb(activeId, "tv", data.movie.title)
            .then((enr) => {
              if (!active) return;
              if (enr.backdropUrl && !data.backdropUrl) setTmdbBackdropUrl(enr.backdropUrl);
              setTmdbShowMeta((prev: any) => ({ ...prev, ...enr.meta }));
            })
            .catch(() => {});
        }
      })
      .catch((err) => {
        console.error("Failed to load details", err);
        if (active) {
          setFetchError(true);
          setLoading(false);
        }
      });

    // Recommendations
    fetchRecs(activeId)
      .then((mapped) => {
        if (!active) return;
        setRecommendations(mapped);
        setRecsLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load recommendations", err);
        if (active) setRecsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [activeId, retryToken]);

  const seasonMapping = useMemo(() => {
    return buildSeasonMapping(seasonsData, tmdbShowMeta?.seasons);
  }, [seasonsData, tmdbShowMeta?.seasons]);

  // Load season episodes
  useEffect(() => {
    if (!movie) return;
    let active = true;

    // 1. Instant resolution from API payload if available for current season
    const currentSeasonEps = (rawApiEpisodes || []).filter(
      (e: any) => (e.season_number === selectedSeason || e.season === selectedSeason)
    );
    if (currentSeasonEps.length > 0) {
      setEpisodes(currentSeasonEps);
      setEpisodesLoading(false);
      return;
    }

    // 2. Check cached season episodes
    const cachedEps = getCachedSeasonEpisodes(activeId, selectedSeason);
    if (cachedEps && cachedEps.length > 0) {
      setEpisodes(cachedEps);
      setEpisodesLoading(false);
      return;
    }

    // 3. Fetch season episodes directly from API with TMDB fallback
    setEpisodesLoading(true);
    fetchSeasonEpisodes(activeId, selectedSeason, tmdbShowMeta?.id)
      .then((data) => {
        if (!active) return;
        setEpisodes(data || []);
        setEpisodesLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setEpisodes([]);
        setEpisodesLoading(false);
      });

    return () => {
      active = false;
    };
  }, [movie, activeId, selectedSeason, tmdbShowMeta?.id, rawApiEpisodes]);

  const currentSeasonInfo = useMemo(() => {
    return seasonMapping.mappedSeasons.find((s) => s.season === selectedSeason) || null;
  }, [seasonMapping.mappedSeasons, selectedSeason]);

  const displayedCast = useMemo(() => {
    const withAvatars = (cast || []).filter((c: any) => Boolean(c.avatarUrl));
    if (withAvatars.length >= 3) return withAvatars;

    const tmdbWithAvatars = (tmdbShowMeta?.cast || []).filter((c: any) => Boolean(c.avatarUrl));
    if (tmdbWithAvatars.length >= 3) return tmdbWithAvatars;

    if (cast && cast.length > 0 && tmdbShowMeta?.cast && tmdbShowMeta.cast.length > 0) {
      const tmdbMap = new Map(tmdbShowMeta.cast.map((t: any) => [(t.name || "").toLowerCase().trim(), t.avatarUrl]));
      const enriched = cast.map((c: any) => ({
        ...c,
        avatarUrl: c.avatarUrl || tmdbMap.get((c.name || "").toLowerCase().trim()) || "",
      }));
      const enrichedWithAvatars = enriched.filter((c: any) => Boolean(c.avatarUrl));
      if (enrichedWithAvatars.length > 0) return enrichedWithAvatars;
    }

    if (tmdbShowMeta?.cast && tmdbShowMeta.cast.length > 0) return tmdbShowMeta.cast;
    if (withAvatars.length > 0) return withAvatars;

    const anyActors = (cast || []).filter((c: any) => {
      return !/director|writer|author|editor|producer|composer/i.test(c.character || "");
    });

    return anyActors.length > 0 ? anyActors : cast || [];
  }, [cast, tmdbShowMeta?.cast]);

  const enrichedEpisodes = useMemo(() => {
    const count = currentSeasonInfo?.episode_count || episodes.length || 0;
    const finalCount = count > 0 ? count : episodes.length;
    return Array.from({ length: finalCount }, (_, index) => {
      const epNum = index + 1;
      const matchedEp =
        episodes.find((e: any) => e.episode_number === epNum) ||
        episodes[index];
      return {
        episode_number: epNum,
        name: matchedEp?.name || `Episode ${epNum}`,
        overview: matchedEp?.overview || `Episode ${epNum} of ${movie?.title || "TV Show"}.`,
        still_path: matchedEp?.still_w500 || matchedEp?.still_path || null,
        runtime: matchedEp?.runtime_minutes || matchedEp?.runtime || null,
        air_date: matchedEp?.air_date || null,
        stream_url: matchedEp?.stream_url || null,
      };
    });
  }, [currentSeasonInfo, episodes, movie]);

  if (loading) {
    return <DetailPageSkeleton />;
  }

  if (!movie) {
    return (
      <div className={styles.main}>
        <div className={styles.errorContainer}>
          <h1>{fetchError ? "Something went wrong" : "TV Show not found"}</h1>
          {fetchError && (
            <button
              className={styles.playPillButton}
              onClick={() => {
                setFetchError(false);
                setLoading(true);
                setRetryToken((t) => t + 1);
              }}
            >
              Try Again
            </button>
          )}
          <Link href="/" className={styles.playPillButton}>
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const bgImage = tmdbBackdropUrl || movie.cover?.url;
  const totalEpsCount = movie.totalEpisodes || seasonMapping.totalEpisodes || seasonMapping.mappedSeasons.reduce((acc, s) => acc + s.episode_count, 0);

  return (
    <div className={styles.main}>
      {/* 1. IMMERSIVE HERO SHOWCASE */}
      <section className={styles.heroStage}>
        {/* Top-Left Floating Back Button */}
        <button
          onClick={() => window.history.back()}
          className={styles.backButton}
          aria-label="Go Back"
          title="Back"
        >
          <ChevronLeft size={22} />
        </button>

        <div className={styles.backdropContainer}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img.backdrop(bgImage)}
            alt={movie.title}
            className={styles.backdropImage}
            fetchPriority="high"
            decoding="async"
          />
          <div className={styles.backdropGradient} />
        </div>

        <div className={`container ${styles.heroContentWrapper}`}>
          <div className={styles.heroContent}>
            {/* Title Logo or Typographic Headline */}
            {tmdbShowMeta?.logo_url ? (
              <div className={styles.logoContainer}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.logo(tmdbShowMeta.logo_url)}
                  alt={movie.title}
                  className={styles.titleLogo}
                  onError={() => {
                    setTmdbShowMeta((prev: any) => ({ ...prev, logo_url: null }));
                  }}
                />
              </div>
            ) : (
              <h1 className={styles.heroTitle}>{movie.title}</h1>
            )}

            {/* Minimalist Inline Meta Line (Red Star • Year • Seasons • Episodes • Genres) */}
            <div className={styles.heroMetaLine}>
              {movie.imdbRatingValue && (
                <span className={styles.ratingInline}>
                  <Star size={14} fill="#e50914" color="#e50914" />
                  <strong className={styles.ratingVal}>{movie.imdbRatingValue}</strong>
                </span>
              )}
              {movie.releaseDate && (
                <>
                  <span className={styles.dotSep}>•</span>
                  <span>{movie.releaseDate.split("-")[0]}</span>
                </>
              )}
              <span className={styles.dotSep}>•</span>
              <span>{seasonMapping.mappedSeasons.length} {seasonMapping.mappedSeasons.length === 1 ? "Season" : "Seasons"}</span>
              {totalEpsCount > 0 && (
                <>
                  <span className={styles.dotSep}>•</span>
                  <span>{totalEpsCount} Episodes</span>
                </>
              )}
              {movie.genre && (
                <>
                  <span className={styles.dotSep}>•</span>
                  <span style={{ color: "#94a3b8" }}>
                    {movie.genre.split(",").slice(0, 3).map((g: string) => g.trim()).join(" • ")}
                  </span>
                </>
              )}
            </div>

            {/* Short Plot Logline */}
            {movie.description && (
              <p className={styles.heroOverview}>{movie.description}</p>
            )}

            {/* Audio Dub Selector */}
            {dubs && dubs.length > 1 && (
              <div className={styles.dubsContainer}>
                <div className={styles.dubsHeader}>
                  <Volume2 size={14} />
                  <span>Available Audio Dubs</span>
                </div>
                <div className={styles.dubsList}>
                  {(() => {
                    const sortedDubs = [...dubs].sort((a: any, b: any) => {
                      const aIsHindi = /hindi/i.test(a?.language_name || a?.language || "");
                      const bIsHindi = /hindi/i.test(b?.language_name || b?.language || "");
                      if (aIsHindi && !bIsHindi) return -1;
                      if (!aIsHindi && bIsHindi) return 1;

                      const aIsOrig = a?.is_original || /original/i.test(a?.language_name || a?.language || "");
                      const bIsOrig = b?.is_original || /original/i.test(b?.language_name || b?.language || "");
                      if (aIsOrig && !bIsOrig) return -1;
                      if (!aIsOrig && bIsOrig) return 1;

                      return 0;
                    });
                    const maxInitial = 4;
                    const itemsToShow = showAllDubs ? sortedDubs : sortedDubs.slice(0, maxInitial);
                    const remainingCount = sortedDubs.length - maxInitial;

                    return (
                      <>
                        {itemsToShow.map((d: any, di: number) => {
                          const targetId = String(
                            d.detail_path || d.detailPath || d.subject_id || d.subjectId || ""
                          );
                          const cleanActiveId = String(activeId || "");
                          const isCurrent = matchesDubId(d, cleanActiveId);
                          const rawName = d.displayName || d.language_name || d.lanName || d.language || "Audio";
                          const label = /hindi/i.test(rawName)
                            ? "Hindi Dub"
                            : (d.is_original || d.original || /original/i.test(rawName))
                            ? "Original Audio"
                            : rawName;
                          return (
                            <button
                              key={d.subject_id ?? d.subjectId ?? d.detail_path ?? d.detailPath ?? `dub-${di}`}
                              onClick={() => {
                                if (targetId && targetId !== cleanActiveId) {
                                  userSelectedDub.current = true;
                                  window.history.replaceState(null, "", `/tv/${targetId}`);
                                  setActiveId(targetId);
                                }
                              }}
                              onMouseEnter={() => {
                                if (targetId) prefetchDetails(targetId, "tv");
                              }}
                              onTouchStart={() => {
                                if (targetId) prefetchDetails(targetId, "tv");
                              }}
                              className={`${styles.dubBadge} ${isCurrent ? styles.dubActive : ""}`}
                            >
                              {label}
                            </button>
                          );
                        })}
                        {sortedDubs.length > maxInitial && (
                          <button
                            type="button"
                            onClick={() => setShowAllDubs((prev) => !prev)}
                            className={styles.dubMoreBtn}
                          >
                            {showAllDubs ? "Show Less" : `+${remainingCount} More`}
                          </button>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Primary Action Buttons Bar */}
            <div className={styles.actionButtons}>
              {continueRecord ? (
                <Link
                  href={`/watch/${activeId}?season=${continueRecord.season}&episode=${continueRecord.episode}`}
                  className={styles.playPillButton}
                  onMouseEnter={() => {
                    const b = seasonMapping.mapUiToBackend(continueRecord.season, continueRecord.episode);
                    prefetchDownload(activeId, b.mbxSeason, b.mbxEpisode);
                  }}
                  onTouchStart={() => {
                    const b = seasonMapping.mapUiToBackend(continueRecord.season, continueRecord.episode);
                    prefetchDownload(activeId, b.mbxSeason, b.mbxEpisode);
                  }}
                >
                  <Play fill="currentColor" size={19} />
                  <span>Resume S{continueRecord.season} • E{continueRecord.episode}</span>
                </Link>
              ) : (
                <Link
                  href={`/watch/${activeId}?season=${selectedSeason}&episode=1`}
                  className={styles.playPillButton}
                  onMouseEnter={() => {
                    const b = seasonMapping.mapUiToBackend(selectedSeason, 1);
                    prefetchDownload(activeId, b.mbxSeason, b.mbxEpisode);
                  }}
                  onTouchStart={() => {
                    const b = seasonMapping.mapUiToBackend(selectedSeason, 1);
                    prefetchDownload(activeId, b.mbxSeason, b.mbxEpisode);
                  }}
                >
                  <Play fill="currentColor" size={19} />
                  <span>Play S{selectedSeason} • E1</span>
                </Link>
              )}

              {/* Circular Watchlist Button */}
              <button
                className={`${styles.circleWatchlistBtn} ${inList ? styles.circleWatchlistBtnActive : ""}`}
                onClick={handleToggleList}
                title={inList ? "Remove from My List" : "Add to My List"}
                aria-label={inList ? "In Watchlist" : "Add to Watchlist"}
              >
                {inList ? <Check size={20} /> : <Plus size={20} />}
              </button>

              {/* Episodes Scroll Button */}
              <button
                className={styles.pillActionBtn}
                onClick={() => {
                  document.getElementById("episodes")?.scrollIntoView({ behavior: "smooth" });
                }}
                title="Browse Episodes"
              >
                <Film size={16} />
                <span>Episodes</span>
              </button>

              {/* Similars Scroll Button */}
              <button
                className={styles.pillActionBtn}
                onClick={() => {
                  document.getElementById("recommendations")?.scrollIntoView({ behavior: "smooth" });
                }}
                title="Explore Similar Shows"
              >
                <Sparkles size={16} />
                <span>Similars</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 2. MODERN DETAILS HUB (EPISODES CATALOG, STORYLINE, CAST, SPECS) */}
      <div className={`container ${styles.detailsHub}`}>
        <div className={styles.hubGrid}>
          {/* Main Content Area */}
          <div className={styles.hubMain}>
            {/* Netflix-Style Season & Episode Catalog */}
            {seasonMapping.mappedSeasons.length > 0 && (
              <div id="episodes" className={styles.episodesSection}>
                <div className={styles.episodesHeader}>
                  <div className={styles.episodesHeaderLeft}>
                    <h3 className={styles.hubSectionTitle}>Episodes</h3>
                    <span className={styles.seasonSummaryPill}>
                      {currentSeasonInfo?.name || `Season ${selectedSeason}`} • {currentSeasonInfo?.episode_count || 0} Episodes
                    </span>
                  </div>

                  {seasonMapping.mappedSeasons.length > 1 && (
                    <div className={styles.seasonSelectorWrapper}>
                      <select
                        value={selectedSeason}
                        onChange={(e) => setSelectedSeason(parseInt(e.target.value))}
                        className={styles.seasonSelect}
                        aria-label="Select season"
                      >
                        {seasonMapping.mappedSeasons.map((s) => (
                          <option key={s.season} value={s.season}>
                            {s.name} ({s.episode_count} Episodes)
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={16} className={styles.dropdownIcon} />
                    </div>
                  )}
                </div>

                <div className={styles.episodesScrollBox}>
                  {episodesLoading ? (
                    <div className={styles.episodesSkeletonList}>
                      {Array.from({ length: Math.min(8, currentSeasonInfo?.episode_count || 6) }, (_, i) => (
                        <div key={`skel-${i}`} className={styles.episodeCardSkeleton}>
                          <div className={`${styles.episodeStillSkeleton} skeleton`} />
                          <div className={styles.episodeDetailsSkeleton}>
                            <div className="skeleton" style={{ height: 20, width: "45%", borderRadius: 6 }} />
                            <div className="skeleton" style={{ height: 14, width: "85%", borderRadius: 4 }} />
                            <div className="skeleton" style={{ height: 14, width: "65%", borderRadius: 4 }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    enrichedEpisodes.map((ep) => {
                      const progressInfo = episodesProgress[`${selectedSeason}:${ep.episode_number}`];
                      const backendCoords = seasonMapping.mapUiToBackend(selectedSeason, ep.episode_number);
                      const stillSrc = ep.still_path ? img.still(ep.still_path) : img.still(movie.cover?.url);

                      return (
                        <Link
                          key={`ep-${selectedSeason}-${ep.episode_number}`}
                          href={`/watch/${activeId}?season=${selectedSeason}&episode=${ep.episode_number}`}
                          className={styles.episodeCard}
                          onMouseEnter={() => prefetchDownload(activeId, backendCoords.mbxSeason, backendCoords.mbxEpisode)}
                          onTouchStart={() => prefetchDownload(activeId, backendCoords.mbxSeason, backendCoords.mbxEpisode)}
                        >
                          <div className={styles.episodeStillContainer}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={stillSrc}
                              alt={ep.name}
                              className={styles.episodeStill}
                              loading="lazy"
                            />
                            <div className={styles.episodePlayOverlay}>
                              <div className={styles.episodePlayBtn}>
                                <Play fill="currentColor" size={20} />
                              </div>
                            </div>
                            <span className={styles.episodeNum}>EP {ep.episode_number}</span>
                            {progressInfo && progressInfo.progress > 0 && progressInfo.duration > 0 && (
                              <div className={styles.episodeProgress}>
                                <div
                                  className={styles.episodeProgressFill}
                                  style={{ width: `${(progressInfo.progress / progressInfo.duration) * 100}%` }}
                                />
                              </div>
                            )}
                          </div>

                          <div className={styles.episodeDetails}>
                            <div className={styles.episodeMetaRow}>
                              <h4 className={styles.episodeTitle}>
                                {ep.episode_number}. {ep.name}
                              </h4>
                              {ep.runtime && <span className={styles.episodeRuntime}>{ep.runtime}m</span>}
                            </div>
                            <p className={styles.episodeOverview}>{ep.overview}</p>
                          </div>
                        </Link>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Cast Rail */}
            {displayedCast.length > 0 && (
              <div className={styles.castSection}>
                <div className={styles.castHeader}>
                  <h3 className={styles.hubSectionTitle}>Cast</h3>
                  <span className={styles.castCountPill}>{displayedCast.length} actors</span>
                </div>
                <div className={styles.castGrid}>
                  {displayedCast.slice(0, 18).map((star: any, cIdx: number) => {
                    const avatarSrc = star.avatarUrl ? img.avatar(star.avatarUrl) : null;
                    return (
                      <div key={`${star.staffId || star.name || "cast"}-${cIdx}`} className={styles.castCard}>
                        <div className={styles.castAvatarWrapper}>
                          {avatarSrc ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={avatarSrc}
                              alt={star.name}
                              className={styles.castAvatarImg}
                              loading="lazy"
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = "none";
                                const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                if (fallback) fallback.style.display = "flex";
                              }}
                            />
                          ) : null}
                          <div
                            className={styles.castAvatarFallback}
                            style={{ display: avatarSrc ? "none" : "flex" }}
                          >
                            {star.name ? star.name.charAt(0).toUpperCase() : "★"}
                          </div>
                        </div>

                        <div className={styles.castCardInfo}>
                          <span className={styles.castNameText}>{star.name}</span>
                          <span className={styles.castRoleText}>{star.character || "Cast"}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 3. RECOMMENDATIONS SECTION */}
        <div id="recommendations">
          {recsLoading && recommendations.length === 0 ? (
            <div className={styles.recommendations}>
              <h3 className={styles.hubSectionTitle}>More Like This</h3>
              <div className={styles.recsSkeletonRow}>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className={styles.recsSkeletonItem}>
                    <MovieCardSkeleton />
                  </div>
                ))}
              </div>
            </div>
          ) : recommendations.length > 0 ? (
            <div className={styles.recommendations}>
              <Carousel title="More Like This" movies={recommendations} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
