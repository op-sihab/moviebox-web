"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Flame } from "lucide-react";
import MovieCard from "./MovieCard";
import RankNumber from "./RankNumber";
import styles from "./Carousel.module.css";

interface Movie {
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
}

interface CarouselProps {
  title: string;
  movies: Movie[];
  /** When true, the first few cards eager-load (use only for the first/above-the-fold row). */
  eager?: boolean;
  /** When true, renders giant typographic rank numbers (1..10) next to each poster */
  ranked?: boolean;
}

export default function Carousel({ title, movies, eager = false, ranked = false }: CarouselProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [isMoved, setIsMoved] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // Strip raw unicode emojis from section title
  const cleanTitle = title.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "").trim();
  const isTrending = /trending|hot|popular/i.test(title);

  // Single source of truth for arrow visibility, driven by real scroll position
  const updateScrollState = useCallback(() => {
    const el = rowRef.current;
    if (!el) return;
    const scrollLeft = el.scrollLeft;
    const maxScroll = el.scrollWidth - el.clientWidth;

    // Show left button ONLY when user has scrolled significantly (> 30px)
    setIsMoved(scrollLeft > 30);
    // Show right button when there is remaining scrollable content (> 30px)
    setCanScrollRight(maxScroll > 30 && scrollLeft < maxScroll - 30);
  }, []);

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    
    updateScrollState();
    const t1 = setTimeout(updateScrollState, 80);
    const t2 = setTimeout(updateScrollState, 400);

    const onScroll = () => updateScrollState();
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", updateScrollState);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [updateScrollState, movies]);

  const handleClick = (direction: "left" | "right") => {
    const el = rowRef.current;
    if (!el) return;
    const scrollAmount = el.clientWidth * 0.8;
    const maxScroll = el.scrollWidth - el.clientWidth;

    let target =
      direction === "left"
        ? el.scrollLeft - scrollAmount
        : el.scrollLeft + scrollAmount;

    // Cleanly snap to absolute boundaries if close
    if (target <= 40) target = 0;
    if (target >= maxScroll - 40) target = maxScroll;

    el.scrollTo({ left: target, behavior: "smooth" });

    // Update visibility state following animation
    setTimeout(updateScrollState, 150);
    setTimeout(updateScrollState, 450);
  };

  if (!movies || movies.length === 0) return null;

  return (
    <div className={styles.carouselContainer}>
      <h2 className={styles.carouselTitle}>
        {isTrending && <Flame size={22} color="#e50914" className={styles.titleIcon} />}
        <span>{cleanTitle}</span>
      </h2>

      <div className={styles.wrapper}>
        {isMoved && (
          <button
            className={`${styles.navButton} ${styles.left}`}
            onClick={() => handleClick("left")}
            aria-label={`Scroll ${title} left`}
          >
            <ChevronLeft size={28} strokeWidth={2.5} />
          </button>
        )}

        <div
          className={styles.row}
          ref={rowRef}
          role="region"
          aria-label={title}
          tabIndex={0}
        >
          {movies.map((movie, index) => {
            const movieKey = movie._id || movie.id;
            const isRanked = ranked && index < 10;
            return (
              <div
                key={movieKey !== undefined ? `${movieKey}-${index}` : `index-${index}`}
                className={isRanked ? styles.rankedItem : styles.item}
              >
                {isRanked && (
                  <div className={styles.rankedNumberWrap}>
                    <RankNumber rank={index + 1} />
                  </div>
                )}
                <div className={isRanked ? styles.rankedPoster : undefined}>
                  {/* Only the first row eager-loads its first few cards; the rest lazy-load on scroll */}
                  <MovieCard movie={movie} priority={eager && index < 6} />
                </div>
              </div>
            );
          })}
        </div>

        {canScrollRight && (
          <button
            className={`${styles.navButton} ${styles.right}`}
            onClick={() => handleClick("right")}
            aria-label={`Scroll ${title} right`}
          >
            <ChevronRight size={28} strokeWidth={2.5} />
          </button>
        )}
      </div>
    </div>
  );
}