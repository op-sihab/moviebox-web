"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import styles from "./page.module.css";
import Link from "next/link";
import { Play, Plus, Check, Star, Volume2, ChevronLeft, Download, Sparkles } from "lucide-react";
import Carousel from "@/components/Carousel";
import DetailPageSkeleton from "@/components/DetailPageSkeleton";
import MovieCardSkeleton from "@/components/MovieCardSkeleton";
import {
  getCachedCore,
  getCachedTmdb,
  getCachedRecs,
  fetchCore,
  fetchTmdb,
  fetchRecs,
  prefetchDownload,
  prefetchDetails,
} from "@/services/contentCache";
import { img } from "@/services/image";
import { isInMyList, toggleMyList } from "@/services/mylist";

interface MovieClientProps {
  id: string;
}

export default function MovieClient({ id }: MovieClientProps) {
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

  const [movie, setMovie] = useState<any>(cachedCore?.movie || null);
  const [cast, setCast] = useState<any[]>(cachedCore?.cast || []);
  const [dubs, setDubs] = useState<any[]>(cachedCore?.dubs || []);
  const [recommendations, setRecommendations] = useState<any[]>(cachedRecs || []);
  const [tmdbBackdropUrl, setTmdbBackdropUrl] = useState<string | null>(cachedCore?.backdropUrl || cachedTmdb?.backdropUrl || null);
  const [tmdbLogoUrl, setTmdbLogoUrl] = useState<string | null>(cachedCore?.logoUrl || cachedTmdb?.logoUrl || null);
  const [tmdbMeta, setTmdbMeta] = useState<any>(cachedTmdb?.meta || (cachedCore?.tmdbId ? { id: cachedCore.tmdbId, name: cachedCore.movie?.title } : null));
  const [showAllDubs, setShowAllDubs] = useState(false);
  const userSelectedDub = useRef(false);
  const [loading, setLoading] = useState(!cachedCore);
  const [recsLoading, setRecsLoading] = useState(!cachedRecs);
  const [inList, setInList] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [continueRecord, setContinueRecord] = useState<{ progress?: number; duration?: number } | null>(null);

  // Reflect the saved state once we know the movie
  useEffect(() => {
    if (movie) {
      setInList(isInMyList({ _id: activeId, id: activeId }));
    }
  }, [movie, activeId]);

  // Query localStorage to check if there is an active continue watching record for this movie
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

        const record = history.find((item: any) => {
          if (allIds.has(String(item.id))) return true;
          if (currentBaseTitle && item.title && item.mediaType === "movie") {
            return getBaseTitle(item.title) === currentBaseTitle;
          }
          return false;
        });

        if (record && record.progress && record.duration) {
          setContinueRecord({
            progress: record.progress,
            duration: record.duration,
          });
        } else {
          setContinueRecord(null);
        }
      } else {
        setContinueRecord(null);
      }
    } catch (e) {
      console.error("Failed to load continue watching record in movie details page", e);
    }
  }, [activeId, movie, dubs]);

  const handleToggleList = () => {
    if (!movie) return;
    const nowIn = toggleMyList({
      _id: activeId,
      id: activeId,
      title: movie.title,
      poster_path: movie.cover?.url,
      vote_average: movie.imdbRatingValue ? parseFloat(movie.imdbRatingValue) : 0,
      release_date: movie.releaseDate,
      media_type: "movie",
    });
    setInList(nowIn);
  };

  // Fetch logic
  useEffect(() => {
    let active = true;

    const core = getCachedCore(activeId);
    const tmdb = getCachedTmdb(activeId);
    const recs = getCachedRecs(activeId);

    if (core) {
      setMovie(core.movie);
      setCast(core.cast);
      setDubs(core.dubs || []);
      if (core.backdropUrl) setTmdbBackdropUrl(core.backdropUrl);
      if (core.logoUrl) {
        setTmdbLogoUrl(core.logoUrl);
      }
      if (core.tmdbId) {
        setTmdbMeta((prev: any) => prev || { id: core.tmdbId, name: core.movie?.title });
      }
      // Predictive Async Pre-warming: warm stream in background
      prefetchDownload(activeId, 0, 0);
      if (active) setLoading(false);
    } else if (!movie) {
      setLoading(true);
    }
    if (tmdb) {
      if (tmdb.backdropUrl) setTmdbBackdropUrl(tmdb.backdropUrl);
      if (tmdb.logoUrl) {
        setTmdbLogoUrl(tmdb.logoUrl);
      }
      if (tmdb.meta) setTmdbMeta(tmdb.meta);
    }
    if (recs) {
      setRecommendations(recs);
      setRecsLoading(false);
    } else {
      setRecsLoading(true);
    }

    // 1. CRITICAL PATH: MovieBox details (now with direct backdrop & logo)
    fetchCore(activeId, "movie")
      .then((data) => {
        if (!active) return;
        setMovie(data.movie);
        setCast(data.cast);
        setDubs(data.dubs || []);

        // Default audio dub selection on initial visit: prefer Hindi, fallback to Original Audio
        if (!userSelectedDub.current) {
          const hindiDub = (data.dubs || []).find((d: any) =>
            /hindi/i.test(d.language_name || d.language || "")
          );
          const originalDub = (data.dubs || []).find(
            (d: any) => d.is_original || /original/i.test(d.language_name || d.language || "")
          );
          const targetDub = hindiDub || originalDub;

          const isCurrentTarget = Boolean(
            targetDub && (
              String(targetDub.subject_id) === String(activeId) ||
              String(targetDub.detail_path) === String(activeId)
            )
          );

          if (targetDub && !isCurrentTarget && (targetDub.subject_id || targetDub.detail_path)) {
            const targetId = String(targetDub.subject_id || targetDub.detail_path);
            if (targetId && targetId !== String(activeId)) {
              userSelectedDub.current = true;
              window.history.replaceState(null, "", `/movie/${targetId}`);
              setActiveId(targetId);
              return;
            }
          }
        }
        if (data.backdropUrl) setTmdbBackdropUrl(data.backdropUrl);
        if (data.logoUrl) {
          setTmdbLogoUrl(data.logoUrl);
        }
        if (data.tmdbId) {
          setTmdbMeta((prev: any) => prev || { id: data.tmdbId, name: data.movie?.title });
        }
        setFetchError(false);
        setLoading(false);

        // Predictive Async Pre-warming: load video stream in background
        prefetchDownload(activeId, 0, 0, "movie");

        // 2. NON-BLOCKING: Additional TMDB enrichment (cast avatars, overview fallback if needed)
        if (data.movie?.title && (!data.backdropUrl || !data.logoUrl || !data.tmdbId)) {
          fetchTmdb(activeId, "movie", data.movie.title)
            .then((enr) => {
              if (!active) return;
              if (enr.backdropUrl && !data.backdropUrl) setTmdbBackdropUrl(enr.backdropUrl);
              if (enr.logoUrl && !data.logoUrl) {
                setTmdbLogoUrl(enr.logoUrl);
              }
              if (enr.meta) setTmdbMeta(enr.meta);
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

    // 3. NON-CRITICAL: recommendations
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

  // Clean cast filter: prioritize actors with real avatar photos, merge TMDB photos if needed
  const displayedCast = useMemo(() => {
    const withAvatars = (cast || []).filter((c: any) => Boolean(c.avatarUrl));
    if (withAvatars.length >= 3) return withAvatars;

    const tmdbWithAvatars = (tmdbMeta?.cast || []).filter((c: any) => Boolean(c.avatarUrl));
    if (tmdbWithAvatars.length >= 3) return tmdbWithAvatars;

    if (cast && cast.length > 0 && tmdbMeta?.cast && tmdbMeta.cast.length > 0) {
      const tmdbMap = new Map(tmdbMeta.cast.map((t: any) => [(t.name || "").toLowerCase().trim(), t.avatarUrl]));
      const enriched = cast.map((c: any) => ({
        ...c,
        avatarUrl: c.avatarUrl || tmdbMap.get((c.name || "").toLowerCase().trim()) || "",
      }));
      const enrichedWithAvatars = enriched.filter((c: any) => Boolean(c.avatarUrl));
      if (enrichedWithAvatars.length > 0) return enrichedWithAvatars;
    }

    if (tmdbMeta?.cast && tmdbMeta.cast.length > 0) return tmdbMeta.cast;
    if (withAvatars.length > 0) return withAvatars;

    const anyActors = (cast || []).filter((c: any) => {
      return !/director|writer|author|editor|producer|composer/i.test(c.character || "");
    });

    return anyActors.length > 0 ? anyActors : cast || [];
  }, [cast, tmdbMeta?.cast]);

  // Loading skeleton state
  if (loading) {
    return <DetailPageSkeleton />;
  }

  if (!movie) {
    return (
      <div className={styles.main}>
        <div className={styles.errorContainer}>
          <h1>{fetchError ? "Something went wrong" : "Movie not found"}</h1>
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
  const durationMin = movie.duration > 0 ? Math.floor(movie.duration / 60) : null;
  const hours = durationMin ? Math.floor(durationMin / 60) : 0;
  const mins = durationMin ? durationMin % 60 : 0;
  const formattedDuration = hours > 0 ? `${hours}h ${mins}m` : durationMin ? `${durationMin}m` : null;

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
            {tmdbLogoUrl ? (
              <div className={styles.logoContainer}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.logo(tmdbLogoUrl)}
                  alt={movie.title}
                  className={styles.titleLogo}
                  onError={() => {
                    setTmdbLogoUrl(null);
                  }}
                />
              </div>
            ) : (
              <h1 className={styles.heroTitle}>{movie.title}</h1>
            )}

            {/* Minimalist Inline Meta Line (Red Star • Year • Duration • Genres) */}
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
              {formattedDuration && (
                <>
                  <span className={styles.dotSep}>•</span>
                  <span>{formattedDuration}</span>
                </>
              )}
              {movie.genre && (
                <>
                  <span className={styles.dotSep}>•</span>
                  <span className={styles.genreInline}>
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
                          const targetId = String(d.subject_id || d.detail_path || "");
                          const isCurrent = Boolean(
                            (d.subject_id && String(d.subject_id) === String(activeId)) ||
                            (d.detail_path && String(d.detail_path) === String(activeId)) ||
                            (movie?.subjectId && String(d.subject_id) === String(movie.subjectId)) ||
                            (movie?.detailPath && String(d.detail_path) === String(movie.detailPath))
                          );
                          return (
                            <button
                              key={d.subject_id ?? d.detail_path ?? d.language ?? `dub-${di}`}
                              onClick={() => {
                                if (targetId && targetId !== String(activeId)) {
                                  userSelectedDub.current = true;
                                  window.history.replaceState(null, "", `/movie/${targetId}`);
                                  setActiveId(targetId);
                                }
                              }}
                              onMouseEnter={() => {
                                if (targetId) prefetchDetails(targetId, "movie");
                              }}
                              onTouchStart={() => {
                                if (targetId) prefetchDetails(targetId, "movie");
                              }}
                              className={`${styles.dubBadge} ${isCurrent ? styles.dubActive : ""}`}
                            >
                              {d.language_name}
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
              {continueRecord?.progress && continueRecord?.duration ? (
                <div className={styles.resumeRow}>
                  <div className={styles.resumeTrack}>
                    <div
                      className={styles.resumeFill}
                      style={{ width: `${(continueRecord.progress / continueRecord.duration) * 100}%` }}
                    />
                  </div>
                  <span className={styles.resumeText}>
                    {Math.floor(continueRecord.progress / 60)} of {Math.floor(continueRecord.duration / 60)}m
                  </span>
                </div>
              ) : null}

              {/* White High-Contrast Play Pill Button */}
              <Link
                href={`/watch/${activeId}`}
                className={styles.playPillButton}
                onMouseEnter={() => prefetchDownload(activeId, 0, 0)}
                onTouchStart={() => prefetchDownload(activeId, 0, 0)}
              >
                <Play fill="currentColor" size={19} />
                <span>{continueRecord?.progress ? "Resume" : "Play"}</span>
              </Link>

              {/* Circular Watchlist Button */}
              <button
                className={`${styles.circleWatchlistBtn} ${inList ? styles.circleWatchlistBtnActive : ""}`}
                onClick={handleToggleList}
                title={inList ? "Remove from My List" : "Add to My List"}
                aria-label={inList ? "In Watchlist" : "Add to Watchlist"}
              >
                {inList ? <Check size={20} /> : <Plus size={20} />}
              </button>

              {/* Download Action Button */}
              <Link
                href={`/watch/${activeId}`}
                className={styles.pillActionBtn}
                title="Direct Play & Download"
              >
                <Download size={16} />
                <span>Download</span>
              </Link>

              {/* Similars Scroll Button */}
              <button
                className={styles.pillActionBtn}
                onClick={() => {
                  document.getElementById("recommendations")?.scrollIntoView({ behavior: "smooth" });
                }}
                title="Explore Similar Movies"
              >
                <Sparkles size={16} />
                <span>Similars</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 2. CAST SECTION */}
      {displayedCast.length > 0 && (
        <div className={`container ${styles.detailsHub}`}>
          <section className={styles.castSection}>
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
          </section>
        </div>
      )}

      {/* 3. RECOMMENDATIONS SECTION */}
      <div id="recommendations" className={`container ${styles.recommendationsWrap}`}>
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
  );
}
