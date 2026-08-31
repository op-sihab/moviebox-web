"use client";

import { useState, useEffect, useMemo } from "react";
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
} from "@/services/contentCache";
import { img } from "@/services/image";
import { isInMyList, toggleMyList } from "@/services/mylist";

interface MovieClientProps {
  id: string;
}

export default function MovieClient({ id }: MovieClientProps) {
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
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [tmdbBackdropUrl, setTmdbBackdropUrl] = useState<string | null>(null);
  const [tmdbLogoUrl, setTmdbLogoUrl] = useState<string | null>(null);
  const [tmdbMeta, setTmdbMeta] = useState<any>(null);
  const [logoReady, setLogoReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [recsLoading, setRecsLoading] = useState(true);
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
      if (active) setLoading(false);
    } else {
      setLoading(true);
    }
    if (tmdb) {
      setTmdbBackdropUrl(tmdb.backdropUrl ?? null);
      if (tmdb.logoUrl !== tmdbLogoUrl) setLogoReady(false);
      if (tmdb.logoUrl) setTmdbLogoUrl(tmdb.logoUrl);
      if (tmdb.meta) setTmdbMeta(tmdb.meta);
    }
    if (recs) {
      setRecommendations(recs);
      setRecsLoading(false);
    } else {
      setRecsLoading(true);
    }

    // 1. CRITICAL PATH: MovieBox details only
    fetchCore(activeId)
      .then((data) => {
        if (!active) return;
        setMovie(data.movie);
        setCast(data.cast);
        setDubs(data.dubs || []);
        setFetchError(false);
        setLoading(false);

        // 2. NON-BLOCKING: TMDB backdrop/logo enrichment
        if (data.movie?.title) {
          fetchTmdb(activeId, "movie", data.movie.title)
            .then((enr) => {
              if (!active) return;
              if (enr.backdropUrl) setTmdbBackdropUrl(enr.backdropUrl);
              if (enr.logoUrl) {
                setLogoReady(false);
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

  // Clean cast filter (Actors only, with fallback to TMDB)
  const displayedCast = useMemo(() => {
    const mbxActors = (cast || []).filter((c: any) => {
      const char = (c.character || "").toLowerCase();
      const isActorRole = !/director|writer|author|editor|producer|composer/i.test(char);
      const hasAvatar = !!c.avatarUrl;
      return isActorRole && hasAvatar;
    });

    if (mbxActors.length >= 3) {
      return mbxActors;
    }

    if (tmdbMeta?.cast && tmdbMeta.cast.length > 0) {
      return tmdbMeta.cast;
    }

    if (mbxActors.length > 0) {
      return mbxActors;
    }

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
            {!tmdbLogoUrl ? (
              <h1 className={styles.heroTitle}>{movie.title}</h1>
            ) : (
              <div className={`${styles.logoContainer} ${logoReady ? styles.logoVisible : ""}`}>
                {!logoReady && <div className={`${styles.logoSkeleton} skeleton`} />}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.logo(tmdbLogoUrl)}
                  alt={movie.title}
                  className={styles.titleLogo}
                  onLoad={() => setLogoReady(true)}
                />
              </div>
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
                  {dubs.map((d: any, di: number) => {
                    const isCurrent =
                      String(d.subject_id) === String(activeId) ||
                      String(d.detail_path) === String(activeId) ||
                      String(d.subject_id) === String(movie?.subjectId) ||
                      String(d.detail_path) === String(movie?.detailPath);
                    return (
                      <button
                        key={d.subject_id ?? d.language ?? `dub-${di}`}
                        onClick={() => {
                          window.history.pushState(null, "", `/movie/${d.subject_id}`);
                          setActiveId(d.subject_id);
                        }}
                        className={`${styles.dubBadge} ${isCurrent ? styles.dubActive : ""}`}
                      >
                        {d.language_name}
                      </button>
                    );
                  })}
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

      {/* 2. CONTENT HUB & SPECS SIDEBAR */}
      <div className={`container ${styles.detailsHub}`}>
        <div className={styles.hubGrid}>
          {/* Main Story & Cast Section */}
          <div className={styles.hubMain}>
            {/* Storyline Card */}
            <div className={styles.storylineCard}>
              <h3 className={styles.hubSectionTitle}>Storyline</h3>
              <p className={styles.storylineText}>{movie.description || "No synopsis available."}</p>
            </div>

            {/* Top Billed Cast Rail */}
            {displayedCast.length > 0 && (
              <div className={styles.castSection}>
                <h3 className={styles.hubSectionTitle}>Top Billed Cast</h3>
                <div className={styles.castGrid}>
                  {displayedCast.slice(0, 10).map((star: any, cIdx: number) => {
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

          {/* Right Info Specs Rail */}
          <aside className={styles.hubSidebar}>
            <div className={styles.specsCard}>
              <h4 className={styles.specsTitle}>Information</h4>

              <div className={styles.specItem}>
                <span className={styles.specLabel}>Release Date</span>
                <span className={styles.specValue}>{movie.releaseDate || "Unknown"}</span>
              </div>

              {formattedDuration && (
                <div className={styles.specItem}>
                  <span className={styles.specLabel}>Duration</span>
                  <span className={styles.specValue}>{formattedDuration}</span>
                </div>
              )}

              {movie.countryName && (
                <div className={styles.specItem}>
                  <span className={styles.specLabel}>Country</span>
                  <span className={styles.specValue}>{movie.countryName}</span>
                </div>
              )}

              <div className={styles.specItem}>
                <span className={styles.specLabel}>Quality</span>
                <span className={styles.specValue}>4K Ultra HD • HDR</span>
              </div>

              <div className={styles.specItem}>
                <span className={styles.specLabel}>Audio</span>
                <span className={styles.specValue}>Dolby Atmos 5.1</span>
              </div>

              {movie.subtitles && (
                <div className={styles.specItem}>
                  <span className={styles.specLabel}>Subtitles</span>
                  <span className={styles.specSubtitles}>
                    {movie.subtitles.split(",").slice(0, 6).join(", ")}
                  </span>
                </div>
              )}
            </div>
          </aside>
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
