"use client";

import { memo, useCallback, useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Play, Plus, Check, ThumbsUp, ChevronDown, Star } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import styles from "./MovieCard.module.css";
import { prefetchDetails, fetchTmdb, getCachedTmdb } from "@/services/contentCache";
import { img } from "@/services/image";
import { isInMyList, toggleMyList } from "@/services/mylist";

export interface Movie {
  _id?: string;
  id?: string | number;
  title?: string;
  name?: string;
  poster_path?: string;
  poster?: string;
  poster_w500?: string;
  backdrop_path?: string;
  backdrop?: string;
  backdrop_w780?: string;
  logo?: string;
  logo_w500?: string;
  logo_url?: string;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
  media_type?: string;
  genre?: string;
  progress?: number;
  duration?: number;
  episodeTitle?: string;
  season?: number;
  episode?: number;
}

interface MovieCardProps {
  movie: Movie;
  /** Eager-load the image (use for the first few above-the-fold cards). */
  priority?: boolean;
}

function MovieCard({ movie, priority = false }: MovieCardProps) {
  const router = useRouter();
  const title = movie.title || movie.name || "Untitled";
  const imagePath = movie.poster_path || movie.backdrop_path;
  const rawImageUrl = imagePath
    ? (imagePath.startsWith("http://") || imagePath.startsWith("https://") || imagePath.startsWith("//")
      ? imagePath
      : `https://image.tmdb.org/t/p/w500${imagePath}`)
    : "/placeholder.png";

  const id = movie._id || movie.id;
  const type = movie.media_type || "movie";

  // TMDB image & logo resolution for rich 16:9 hover banner
  const [tmdbInfo, setTmdbInfo] = useState<{
    backdropUrl: string | null;
    titledBackdropUrl: string | null;
    logoUrl: string | null;
  } | null>(() => {
    if (!id) return null;
    const cached = getCachedTmdb(String(id));
    if (cached) {
      return {
        backdropUrl: cached.backdropUrl || (movie.backdrop || movie.backdrop_w780 || null),
        titledBackdropUrl: cached.titledBackdropUrl || cached.meta?.titled_backdrop_url || null,
        logoUrl: cached.logoUrl || movie.logo_w500 || movie.logo || movie.logo_url || null,
      };
    }
    if (movie.logo || movie.logo_w500 || movie.logo_url || movie.backdrop || movie.backdrop_w780) {
      return {
        backdropUrl: movie.backdrop || movie.backdrop_w780 || null,
        titledBackdropUrl: null,
        logoUrl: movie.logo_w500 || movie.logo || movie.logo_url || null,
      };
    }
    return null;
  });

  const posterUrl = img.poster(rawImageUrl);
  const bannerWithTitle = tmdbInfo?.titledBackdropUrl;
  const effectiveBackdrop = bannerWithTitle || tmdbInfo?.backdropUrl || movie.backdrop || movie.backdrop_w780 || (movie.backdrop_path ? (movie.backdrop_path.startsWith("http") ? movie.backdrop_path : `https://image.tmdb.org/t/p/w780${movie.backdrop_path}`) : rawImageUrl);
  const hoverPreviewUrl = img.backdrop(effectiveBackdrop);
  const titleLogoUrl = !bannerWithTitle && (tmdbInfo?.logoUrl || movie.logo_w500 || movie.logo || movie.logo_url) ? (tmdbInfo?.logoUrl || movie.logo_w500 || movie.logo || movie.logo_url) : null;

  const date = movie.release_date || movie.first_air_date;
  const year = date ? new Date(date).getFullYear() : "";
  const rating = movie.vote_average ? movie.vote_average.toFixed(1) : "";

  const isContinueWatching = typeof movie.progress === "number" && typeof movie.duration === "number";

  let detailHref = "";
  let playHref = "";
  if (id) {
    detailHref = `/${type === "tv" ? "tv" : "movie"}/${id}`;
    if (isContinueWatching && type === "tv" && movie.season && movie.episode) {
      playHref = `/watch/${id}?season=${movie.season}&episode=${movie.episode}`;
    } else {
      playHref = `/watch/${id}`;
    }
  }

  // Hover modal state
  const [isHovered, setIsHovered] = useState(false);
  const [modalAlign, setModalAlign] = useState<"center" | "left" | "right">("center");
  const [isBannerLoaded, setIsBannerLoaded] = useState(false);
  const [inList, setInList] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (id) {
      setInList(isInMyList({ _id: String(id), id: String(id) }));
    }
  }, [id]);

  const handleMouseEnter = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Dynamic boundary safeguard: prevent left/right screen clipping
    const rect = e.currentTarget.getBoundingClientRect();
    const leftSpace = rect.left;
    const rightSpace = window.innerWidth - rect.right;

    if (leftSpace < 70) {
      setModalAlign("left");
    } else if (rightSpace < 70) {
      setModalAlign("right");
    } else {
      setModalAlign("center");
    }

    if (id) {
      prefetchDetails(String(id), type === "tv" ? "tv" : "movie");
      const cached = getCachedTmdb(String(id));
      if (cached?.backdropUrl || cached?.logoUrl) {
        setTmdbInfo({
          backdropUrl: cached.backdropUrl || tmdbInfo?.backdropUrl || null,
          titledBackdropUrl: cached.titledBackdropUrl || cached.meta?.titled_backdrop_url || null,
          logoUrl: cached.logoUrl || tmdbInfo?.logoUrl || null,
        });
      } else if (!tmdbInfo?.logoUrl && !movie.logo && !movie.logo_w500 && !movie.logo_url && title) {
        fetchTmdb(String(id), type === "tv" ? "tv" : "movie", title)
          .then((res) => {
            if (res) {
              setTmdbInfo({
                backdropUrl: res.backdropUrl,
                titledBackdropUrl: res.titledBackdropUrl || res.meta?.titled_backdrop_url || null,
                logoUrl: res.logoUrl,
              });
            }
          })
          .catch(() => {});
      }
    }
    
    // Intentional hold debounce (Netflix standard 400ms) so casual scrolling does not pop cards
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      setIsHovered(true);
    }, 400);
  }, [id, type, title, tmdbInfo]);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setIsHovered(false);
  }, []);

  const handleTouchStart = useCallback(() => {
    if (id) prefetchDetails(String(id), type === "tv" ? "tv" : "movie");
  }, [id, type]);

  const handleToggleList = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!id) return;
    const nowIn = toggleMyList({
      _id: String(id),
      id: String(id),
      title,
      poster_path: movie.poster_path || rawImageUrl,
      vote_average: movie.vote_average,
      release_date: movie.release_date || movie.first_air_date,
      media_type: type,
    });
    setInList(nowIn);
  };

  const handleToggleLike = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsLiked((prev) => !prev);
  };

  const handlePlayClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setIsHovered(false);
    if (playHref) {
      if (typeof window !== "undefined") window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      router.push(playHref, { scroll: true });
    }
  };

  const handleDetailsClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setIsHovered(false);
    if (detailHref) {
      if (typeof window !== "undefined") window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      router.push(detailHref, { scroll: true });
    }
  };

  if (!id) {
    return (
      <div className={styles.cardWrapper}>
        <div className={styles.imageContainer}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={posterUrl} alt={title} className={styles.image} />
        </div>
        <div className={styles.bottomInfo}>
          <h3 className={styles.bottomTitle}>{title}</h3>
        </div>
      </div>
    );
  }

  return (
    <div
      className={styles.cardContainer}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
    >
      {/* Base Card */}
      <Link
        href={isContinueWatching ? playHref : detailHref}
        scroll={true}
        className={styles.cardLink}
        onClick={() => {
          if (hoverTimerRef.current) {
            clearTimeout(hoverTimerRef.current);
            hoverTimerRef.current = null;
          }
          setIsHovered(false);
          if (typeof window !== "undefined") window.scrollTo({ top: 0, left: 0, behavior: "instant" });
        }}
      >
        <div className={styles.card}>
          <div className={styles.imageContainer}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={posterUrl}
              alt={title}
              className={styles.image}
              loading={priority ? "eager" : "lazy"}
              fetchPriority={priority ? "high" : "auto"}
              decoding="async"
            />
            <div className={styles.overlay}>
              <div className={styles.playButtonIcon}>
                <Play fill="white" size={22} />
              </div>
            </div>

            {/* Continue watching progress */}
            {isContinueWatching && movie.progress! > 0 && movie.duration! > 0 && (
              <div className={styles.progressBarContainer}>
                <div
                  className={styles.progressBar}
                  style={{ width: `${(movie.progress! / movie.duration!) * 100}%` }}
                />
              </div>
            )}
          </div>
        </div>

        <div className={styles.bottomInfo}>
          <h3 className={styles.bottomTitle}>{title}</h3>
          <div className={styles.bottomMeta}>
            {rating && (
              <>
                <Star size={11} className={styles.starIcon} />
                <span className={styles.ratingText}>{rating}</span>
                {(year || movie.episodeTitle) && <span className={styles.dot}>•</span>}
              </>
            )}
            {movie.episodeTitle ? (
              <span className={styles.episodeLabel}>{movie.episodeTitle}</span>
            ) : (
              year && <span className={styles.yearText}>{year}</span>
            )}
            {(year || movie.episodeTitle) && <span className={styles.dot}>•</span>}
            <span className={styles.mediaTypeLabel}>
              {type === "tv" ? "TV" : "Movie"}
            </span>
          </div>
        </div>
      </Link>

      {/* Netflix-Style Motion Animated Elevated Hover Mini-Card Modal */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            className={`${styles.hoverModal} ${
              modalAlign === "left"
                ? styles.alignLeft
                : modalAlign === "right"
                ? styles.alignRight
                : styles.alignCenter
            }`}
            onClick={handleDetailsClick}
            initial={{
              opacity: 0,
              scale: 0.9,
              x: modalAlign === "center" ? "-50%" : 0,
              y: 6,
            }}
            animate={{
              opacity: 1,
              scale: 1.08,
              x: modalAlign === "center" ? "-50%" : 0,
              y: 0,
            }}
            exit={{
              opacity: 0,
              scale: 0.93,
              x: modalAlign === "center" ? "-50%" : 0,
              y: 4,
            }}
            transition={{
              type: "spring",
              stiffness: 380,
              damping: 28,
              mass: 0.7,
            }}
          >
            {/* Modal Header Thumbnail with Video / Backdrop */}
            <div className={styles.modalMediaWrapper}>
              {/* Skeleton shimmer before banner loads */}
              {!isBannerLoaded && (
                <div className={styles.bannerSkeleton} />
              )}

              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={hoverPreviewUrl}
                alt={title}
                onLoad={() => setIsBannerLoaded(true)}
                className={`${styles.modalImage} ${isBannerLoaded ? styles.bannerLoaded : styles.bannerLoading}`}
              />
              <div className={styles.modalGradient} />
            </div>

            {/* Modal Body & Quick Interactive Actions */}
            <div className={styles.modalBody}>
              <div className={styles.modalActionsRow}>
                <div className={styles.modalActionsLeft}>
                  <button
                    className={styles.modalPlayBtn}
                    onClick={handlePlayClick}
                    title="Play"
                    aria-label="Play"
                  >
                    <Play fill="currentColor" size={18} />
                  </button>
                  <button
                    className={`${styles.modalIconBtn} ${inList ? styles.modalIconActive : ""}`}
                    onClick={handleToggleList}
                    title={inList ? "Remove from List" : "Add to My List"}
                    aria-label="Toggle List"
                  >
                    {inList ? <Check size={18} /> : <Plus size={18} />}
                  </button>
                  <button
                    className={`${styles.modalIconBtn} ${isLiked ? styles.modalIconActive : ""}`}
                    onClick={handleToggleLike}
                    title="Like"
                    aria-label="Like"
                  >
                    <ThumbsUp size={16} />
                  </button>
                </div>

                <button
                  className={styles.modalDetailsBtn}
                  onClick={handleDetailsClick}
                  title="More Details"
                  aria-label="More Details"
                >
                  <ChevronDown size={18} />
                </button>
              </div>

              {/* Modal Title */}
              <h4 className={styles.modalTitle}>{title}</h4>

              {/* Metadata Pills */}
              <div className={styles.modalMetaRow}>
                {rating && (
                  <span className={styles.modalRating}>
                    <Star size={12} fill="currentColor" /> {rating}
                  </span>
                )}
                {year && <span className={styles.modalYear}>{year}</span>}
                <span className={styles.modalTypePill}>
                  {type === "tv" ? "TV Series" : "Movie"}
                </span>
              </div>

              {/* Genre tags */}
              <div className={styles.modalGenres}>
                <span>Cinema</span>
                <span className={styles.dot}>•</span>
                <span>Popular</span>
                <span className={styles.dot}>•</span>
                <span>HD Stream</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default memo(MovieCard);