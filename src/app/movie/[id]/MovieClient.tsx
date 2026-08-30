"use client";

import { useState, useEffect, useRef } from "react";
import styles from "./page.module.css";
import Link from "next/link";
import { Play, Plus, Check, ThumbsUp, Star } from "lucide-react";
import Carousel from "@/components/Carousel";
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

  // Sync prop changes
  useEffect(() => {
    setActiveId(id);
  }, [id]);

  // Keep activeId in sync when the user navigates back/forward after a
  // manual pushState-based dub switch
  useEffect(() => {
    const handlePopState = () => {
      const match = window.location.pathname.match(/^\/movie\/([^/?#]+)/);
      if (match && match[1] && decodeURIComponent(match[1]) !== activeId) {
        setActiveId(decodeURIComponent(match[1]));
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [activeId]);

  const [movie, setMovie] = useState<any>(null);
  const [cast, setCast] = useState<any[]>([]);
  const [dubs, setDubs] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [tmdbBackdropUrl, setTmdbBackdropUrl] = useState<string | null>(null);
  const [tmdbLogoUrl, setTmdbLogoUrl] = useState<string | null>(null);
  const [logoReady, setLogoReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [recsLoading, setRecsLoading] = useState(true);
  const [inList, setInList] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const MIN_SKELETON_MS = 350;
  const skeletonStartRef = useRef(0);

  const beginSkeleton = () => {
    skeletonStartRef.current = Date.now();
    setLoading(true);
  };

  const endSkeleton = (apply: () => void) => {
    const elapsed = Date.now() - skeletonStartRef.current;
    const wait = Math.max(0, MIN_SKELETON_MS - elapsed);
    window.setTimeout(() => {
      apply();
    }, wait);
  };
  const [continueRecord, setContinueRecord] = useState<{ progress?: number; duration?: number } | null>(null);

  // Query localStorage to check if there is an active continue watching record for this movie
  useEffect(() => {
    try {
      const saved = localStorage.getItem("mbx:continue_watching");
      if (saved) {
        const history = JSON.parse(saved);
        
        // Collect all IDs associated with this movie across all dubs
        const allIds = new Set<string>();
        if (activeId) allIds.add(String(activeId));
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

        if (record && typeof record.progress === "number" && typeof record.duration === "number") {
          setContinueRecord({
            progress: record.progress,
            duration: record.duration
          });
        } else {
          setContinueRecord(null);
        }
      } else {
        setContinueRecord(null);
      }
    } catch (e) {
      console.error("Failed to load continue watching record in details page", e);
    }
  }, [activeId, movie, dubs]);

  // Reflect the saved state once we know the movie
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
      media_type: "movie",
    });
    setInList(nowIn);
  };

  useEffect(() => {
    let active = true;

    // Re-read cache on activeId change (e.g. client-side navigation between movies).
    // This runs inside the effect (not during render) so SSR and the first client
    // render always match, avoiding hydration mismatches from sessionStorage.
    const core = getCachedCore(activeId);
    const tmdb = getCachedTmdb(activeId);
    const recs = getCachedRecs(activeId);

    if (!core) {
      beginSkeleton();
    }

    if (core) {
      setMovie(core.movie);
      setCast(core.cast);
      setDubs(core.dubs || []);
      endSkeleton(() => {
        if (active) setLoading(false);
      });
    }
    if (tmdb) {
      setTmdbBackdropUrl(tmdb.backdropUrl ?? null);
      if (tmdb.logoUrl !== tmdbLogoUrl) setLogoReady(false);
      if (tmdb.logoUrl) setTmdbLogoUrl(tmdb.logoUrl);
    }
    if (recs) {
      setRecommendations(recs);
      setRecsLoading(false);
    } else {
      setRecsLoading(true);
    }

    // 1. CRITICAL PATH: MovieBox details only. Render as soon as this resolves.
    fetchCore(activeId)
      .then((data) => {
        if (!active) return;
        setMovie(data.movie);
        setCast(data.cast);
        setDubs(data.dubs || []);
        setFetchError(false);
        endSkeleton(() => {
          if (active) setLoading(false);
        });

        // 2. NON-BLOCKING: TMDB backdrop/logo enrichment swaps in when ready.
        if (data.movie?.title) {
          fetchTmdb(activeId, "movie", data.movie.title)
            .then((enr) => {
              if (!active) return;
              if (enr.backdropUrl) setTmdbBackdropUrl(enr.backdropUrl);
              if (enr.logoUrl) {
                setLogoReady(false);
                setTmdbLogoUrl(enr.logoUrl);
              }
            })
            .catch(() => {});
        }
      })
      .catch((err) => {
        console.error("Failed to load details", err);
        if (active) {
          endSkeleton(() => {
            if (active) {
              setFetchError(true);
              setLoading(false);
            }
          });
        }
      });

    // 3. NON-CRITICAL: recommendations (lazy section at the bottom)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, retryToken]);

  // Loading / Skeleton State (100% matched to page layout to prevent layout shift)
  if (loading) {
    return (
      <div className={styles.main}>
        {/* Backdrop Skeleton */}
        <div className={styles.backdropContainer}>
          <div className="skeleton" style={{ width: "100%", height: "100%" }} />
          <div className={styles.backdropGradient}></div>
        </div>

        <div className={`container ${styles.contentWrapper}`}>
          <div className={styles.mainContent}>
            {/* Poster Column Skeleton */}
            <div className={styles.posterColumn}>
              <div className={`${styles.poster} skeleton`} style={{ border: "none" }} />
            </div>
            
            {/* Info Column Skeleton */}
            <div className={styles.infoColumn}>
              {/* Title Skeleton */}
              <div className="skeleton" style={{ height: "3.5rem", width: "70%", marginBottom: "1.5rem", borderRadius: "10px" }} />
              
              {/* Meta Row Skeleton */}
              <div className={styles.metaRow} style={{ gap: "1rem" }}>
                <div className="skeleton" style={{ height: "1.3rem", width: "80px", borderRadius: "6px" }} />
                <div className="skeleton" style={{ height: "1.3rem", width: "60px", borderRadius: "6px" }} />
                <div className="skeleton" style={{ height: "1.3rem", width: "50px", borderRadius: "6px" }} />
              </div>
              
              {/* Genres Skeleton */}
              <div className={styles.genres} style={{ gap: "0.75rem", marginBottom: "2rem" }}>
                <div className="skeleton" style={{ height: "2rem", width: "100px", borderRadius: "20px" }} />
                <div className="skeleton" style={{ height: "2rem", width: "120px", borderRadius: "20px" }} />
                <div className="skeleton" style={{ height: "2rem", width: "80px", borderRadius: "20px" }} />
              </div>
              
              {/* Description Skeleton */}
              <div style={{ marginBottom: "2.5rem" }}>
                <div className="skeleton" style={{ height: "1.1rem", width: "100%", marginBottom: "0.75rem", borderRadius: "6px" }} />
                <div className="skeleton" style={{ height: "1.1rem", width: "95%", marginBottom: "0.75rem", borderRadius: "6px" }} />
                <div className="skeleton" style={{ height: "1.1rem", width: "70%", marginBottom: "0.75rem", borderRadius: "6px" }} />
              </div>
              
              {/* Action Buttons Skeleton */}
              <div className={styles.actionButtons} style={{ gap: "1rem", marginBottom: "3rem" }}>
                <div className="skeleton" style={{ height: "3.2rem", width: "160px", borderRadius: "8px" }} />
                <div className="skeleton" style={{ height: "3.2rem", width: "48px", borderRadius: "50%" }} />
                <div className="skeleton" style={{ height: "3.2rem", width: "48px", borderRadius: "50%" }} />
              </div>
              
              {/* Cast Skeleton */}
              <div className={styles.castSection}>
                <div className="skeleton" style={{ height: "2rem", width: "120px", marginBottom: "1.5rem", borderRadius: "6px" }} />
                <div className={styles.castList} style={{ gap: "1.5rem" }}>
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className={styles.castMember} style={{ background: "rgba(255, 255, 255, 0.02)", border: "none" }}>
                      <div className="skeleton" style={{ width: "60px", height: "60px", borderRadius: "50%", flexShrink: 0 }} />
                      <div className={styles.castInfo} style={{ gap: "0.5rem" }}>
                        <div className="skeleton" style={{ height: "1rem", width: "80px", borderRadius: "4px" }} />
                        <div className="skeleton" style={{ height: "0.85rem", width: "60px", borderRadius: "4px" }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!movie) {
    return (
      <div className={styles.main}>
        <div className={styles.errorContainer}>
          <h1>{fetchError ? "Something went wrong" : "Movie not found"}</h1>
          {fetchError && (
            <button
              className={styles.playButton}
              style={{ marginTop: "2rem", background: "var(--accent-color)", color: "white" }}
              onClick={() => {
                setFetchError(false);
                skeletonStartRef.current = Date.now();
                setLoading(true);
                setRetryToken((t) => t + 1);
              }}
            >
              Try Again
            </button>
          )}
          <Link href="/" className={styles.playButton} style={{ marginTop: "2rem", background: "var(--accent-color)", color: "white" }}>
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const bgImage = tmdbBackdropUrl || movie.cover?.url;

  return (
    <div className={styles.main}>
      <div className={styles.backdropContainer}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img.backdrop(bgImage)}
          alt={movie.title}
          className={styles.backdropImage}
        />
        <div className={styles.backdropGradient}></div>
      </div>

      <div className={`container ${styles.contentWrapper}`}>
        <div className={styles.mainContent}>
          <div className={styles.posterColumn}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.poster(movie.cover?.url)}
              alt={movie.title}
              className={styles.poster}
            />
          </div>
          
          <div className={styles.infoColumn}>
            {!tmdbLogoUrl ? (
              <h1 className={styles.title}>{movie.title}</h1>
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
            
            <div className={styles.metaRow}>
              {movie.imdbRatingValue && (
                <span className={styles.rating}>
                  <Star fill="#fbbf24" color="#fbbf24" size={16} />
                  {movie.imdbRatingValue}
                </span>
              )}
              {movie.releaseDate && <span>{movie.releaseDate.split("-")[0]}</span>}
              {movie.duration > 0 && <span>{Math.floor(movie.duration / 60)}m</span>}
              <span className={styles.hdBadge}>HD</span>
            </div>
            
                {movie.genre && (
                  <div className={styles.genres}>
                    {movie.genre.split(",").map((g: string, gi: number) => (
                      <span key={`${g}-${gi}`} className={styles.genreTag}>{g.trim()}</span>
                    ))}
                  </div>
                )}
            
            <p className={styles.description}>{movie.description}</p>
            
            {dubs && dubs.length > 1 && (
              <div className={styles.dubsContainer}>
                <span className={styles.dubsLabel}>Audio / Dubbing:</span>
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
            
            <div className={styles.actionButtons} style={{ position: "relative" }}>
              {continueRecord && continueRecord.progress && continueRecord.duration ? (
                <div style={{ position: "absolute", top: "-28px", left: "0", right: "120px", display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ flex: 1, height: "3px", backgroundColor: "rgba(255,255,255,0.2)", borderRadius: "2px", overflow: "hidden" }}>
                    <div style={{ width: `${(continueRecord.progress / continueRecord.duration) * 100}%`, height: "100%", backgroundColor: "var(--accent-color)" }} />
                  </div>
                  <span style={{ fontSize: "0.85rem", fontWeight: "bold", whiteSpace: "nowrap" }}>
                    {Math.floor(continueRecord.progress / 60)} of {Math.floor(continueRecord.duration / 60)}m
                  </span>
                </div>
              ) : null}
              <Link
                href={`/watch/${activeId}`}
                className={styles.playButton}
                onMouseEnter={() => prefetchDownload(activeId, 0, 0)}
                onTouchStart={() => prefetchDownload(activeId, 0, 0)}
              >
                <Play fill="black" size={24} />
                <span>{continueRecord && continueRecord.progress ? "Resume" : "Play"}</span>
              </Link>
              <button
                className={styles.iconButton}
                onClick={handleToggleList}
                title={inList ? "Remove from My List" : "Add to My List"}
              >
                {inList ? <Check size={24} /> : <Plus size={24} />}
              </button>
              <button className={styles.iconButton}>
                <ThumbsUp size={24} />
              </button>
            </div>
            
            {cast.length > 0 && (
              <div className={styles.castSection}>
                <h3>Cast</h3>
                <div className={styles.castList}>
                  {cast.slice(0, 5).map((star: any, cIdx: number) => (
                    <div key={`${star.staffId || star.name || "cast"}-${cIdx}`} className={styles.castMember}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img 
                        src={star.avatarUrl ? img.avatar(star.avatarUrl) : "/placeholder.png"} 
                        alt={star.name} 
                        className={styles.castAvatar}
                      />
                      <div className={styles.castInfo}>
                        <span className={styles.castName}>{star.name}</span>
                        <span className={styles.castRole}>{star.character}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {recsLoading ? (
          <div className={styles.recommendations}>
            <h3 style={{ fontSize: "1.2rem", fontWeight: "600", borderLeft: "3px solid var(--accent-color)", paddingLeft: "0.5rem", marginBottom: "1.5rem", color: "var(--text-primary)" }}>More Like This</h3>
            <div style={{ display: "flex", gap: "1.25rem", overflow: "hidden" }}>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} style={{ width: "180px", flexShrink: 0 }}>
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
