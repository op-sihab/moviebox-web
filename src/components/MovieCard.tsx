"use client";

import { memo, useCallback } from "react";
import Link from "next/link";
import { Play } from "lucide-react";
import styles from "./MovieCard.module.css";
import { prefetchDetails } from "@/services/contentCache";
import { img } from "@/services/image";

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
  const title = movie.title || movie.name;
  const imagePath = movie.poster_path || movie.backdrop_path;
  const rawImageUrl = imagePath
    ? (imagePath.startsWith("http://") || imagePath.startsWith("https://") || imagePath.startsWith("//")
      ? imagePath
      : `https://image.tmdb.org/t/p/w500${imagePath}`)
    : "/placeholder.png";
  // Route through wsrv.nl: resized WebP served from Cloudflare edge cache
  const imageUrl = img.poster(rawImageUrl);
  const date = movie.release_date || movie.first_air_date;
  const year = date ? new Date(date).getFullYear() : "";
  const rating = movie.vote_average ? movie.vote_average.toFixed(1) : "";

  // Use a fallback ID format if _id is not present
  const id = movie._id || movie.id;
  const type = movie.media_type || "movie";

  // If it's a continue-watching item (has progress), send the user straight to the player!
  const isContinueWatching = typeof movie.progress === "number" && typeof movie.duration === "number";

  let linkHref = "";
  if (id) {
    linkHref = `/${type === "tv" ? "tv" : "movie"}/${id}`;
    if (isContinueWatching) {
      if (type === "tv" && movie.season && movie.episode) {
        linkHref = `/watch/${id}?season=${movie.season}&episode=${movie.episode}`;
      } else {
        linkHref = `/watch/${id}`;
      }
    }
  }

  // Warm the detail-page cache on hover/focus so navigation skips the skeleton
  const handlePrefetch = useCallback(() => {
    if (id) {
      prefetchDetails(String(id), type === "tv" ? "tv" : "movie");
    }
  }, [id, type]);

  // Touch devices never fire mouseenter, so warm the cache on touchstart —
  // it fires ~150-300ms before the click, giving the fetch a head start.
  const handleTouchStart = useCallback(() => {
    if (!id) return;
    prefetchDetails(String(id), type === "tv" ? "tv" : "movie");
  }, [id, type]);

  const content = (
    <>
      <div className={styles.card}>
        {/* Skeleton lives as the container background; the image paints on top of
            it and covers it as soon as it loads. No JS state, so it can never get
            stuck behind a skeleton. */}
        <div className={`${styles.imageContainer} skeleton`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={title || "Movie poster"}
            className={styles.image}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            decoding="async"
          />
          <div className={styles.overlay}>
            <div className={styles.playButton}>
              <Play fill="white" size={24} />
            </div>
          </div>
          {typeof movie.progress === "number" &&
            movie.progress > 0 &&
            typeof movie.duration === "number" &&
            movie.duration > 0 && (
              <div className={styles.progressBarContainer}>
                <div
                  className={styles.progressBar}
                  style={{ width: `${(movie.progress / movie.duration) * 100}%` }}
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
          {rating && (
            <span className={styles.rating}>
              {"\u2605"} {rating}
            </span>
          )}
        </div>
      </div>
    </>
  );

  // Cards without a resolvable id render as a static tile instead of a broken link
  if (!id) {
    return <div className={styles.cardWrapper}>{content}</div>;
  }

  return (
    <Link
      href={linkHref}
      className={styles.cardWrapper}
      onMouseEnter={handlePrefetch}
      onFocus={handlePrefetch}
      onTouchStart={handleTouchStart}
    >
      {content}
    </Link>
  );
}

export default memo(MovieCard);