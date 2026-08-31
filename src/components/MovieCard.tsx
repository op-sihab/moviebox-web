"use client";

import { memo, useCallback, useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Play, Plus, Check, ThumbsUp, ChevronDown } from "lucide-react";
import styles from "./MovieCard.module.css";
import { prefetchDetails } from "@/services/contentCache";
import { img } from "@/services/image";
import { isInMyList, toggleMyList } from "@/services/mylist";

export interface Movie {
  _id?: string;
  id?: string | number;
  title?: string;
  name?: string;
  poster_path?: string;
  backdrop_path?: string;
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

  const posterUrl = img.poster(rawImageUrl);
  const backdropUrl = movie.backdrop_path 
    ? (movie.backdrop_path.startsWith("http") ? movie.backdrop_path : `https://image.tmdb.org/t/p/w780${movie.backdrop_path}`)
    : rawImageUrl;
  const hoverPreviewUrl = img.backdrop(backdropUrl);

  const date = movie.release_date || movie.first_air_date;
  const year = date ? new Date(date).getFullYear() : "";
  const rating = movie.vote_average ? movie.vote_average.toFixed(1) : "";

  const id = movie._id || movie.id;
  const type = movie.media_type || "movie";

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
  const [inList, setInList] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (id) {
      setInList(isInMyList({ _id: String(id), id: String(id) }));
    }
  }, [id]);

  const handleMouseEnter = useCallback(() => {
    if (id) prefetchDetails(String(id), type === "tv" ? "tv" : "movie");
    
    // Smooth debounce on desktop hover
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      setIsHovered(true);
    }, 280);
  }, [id, type]);

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
    if (playHref) router.push(playHref);
  };

  const handleDetailsClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (detailHref) router.push(detailHref);
  };

  if (!id) {
    return (
      <div className={styles.cardWrapper}>
        <div className={`${styles.imageContainer} skeleton`}>
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
      <Link href={isContinueWatching ? playHref : detailHref} className={styles.cardLink}>
        <div className={styles.card}>
          <div className={`${styles.imageContainer} skeleton`}>
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

            {/* Quality Badge */}
            <span className={styles.qualityBadge}>HD</span>

            {/* Rating Pill */}
            {rating && (
              <span className={styles.cardRatingBadge}>
                ★ {rating}
              </span>
            )}

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
            {movie.episodeTitle ? (
              <span className={styles.episodeLabel}>{movie.episodeTitle}</span>
            ) : (
              year && <span className={styles.year}>{year}</span>
            )}
            <span className={styles.mediaTypeLabel}>
              {type === "tv" ? "TV Series" : "Movie"}
            </span>
          </div>
        </div>
      </Link>

      {/* Netflix-Style Elevated Hover Mini-Card Modal */}
      {isHovered && (
        <div className={styles.hoverModal} onClick={handleDetailsClick}>
          {/* Modal Header Thumbnail with Video / Backdrop */}
          <div className={styles.modalMediaWrapper}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={hoverPreviewUrl}
              alt={title}
              className={styles.modalImage}
            />
            <div className={styles.modalGradient} />

            <div className={styles.modalPlayOverlay} onClick={handlePlayClick}>
              <div className={styles.modalCenterPlay}>
                <Play fill="white" size={24} />
              </div>
            </div>

            <span className={styles.modalHdBadge}>4K ULTRA HD</span>
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
                  ★ {rating}
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
        </div>
      )}
    </div>
  );
}

export default memo(MovieCard);