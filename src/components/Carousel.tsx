"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import MovieCard from "./MovieCard";
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
}

export default function Carousel({ title, movies, eager = false }: CarouselProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [isMoved, setIsMoved] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // Single source of truth for arrow visibility, driven by real scroll position
  const updateScrollState = useCallback(() => {
    const el = rowRef.current;
    if (!el) return;
    setIsMoved(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const onScroll = () => updateScrollState();
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, [updateScrollState, movies]);

  const handleClick = (direction: "left" | "right") => {
    if (rowRef.current) {
      const { scrollLeft, clientWidth } = rowRef.current;
      const scrollTo =
        direction === "left"
          ? scrollLeft - clientWidth * 0.8
          : scrollLeft + clientWidth * 0.8;

      rowRef.current.scrollTo({ left: scrollTo, behavior: "smooth" });
    }
  };

  if (!movies || movies.length === 0) return null;

  return (
    <div className={styles.carouselContainer}>
      <h2 className={styles.carouselTitle}>{title}</h2>

      <div className={styles.wrapper}>
        <button
          className={`${styles.navButton} ${styles.left} ${!isMoved ? styles.hidden : ""}`}
          onClick={() => handleClick("left")}
          aria-label={`Scroll ${title} left`}
        >
          <ChevronLeft size={32} />
        </button>

        <div
          className={styles.row}
          ref={rowRef}
          role="region"
          aria-label={title}
          tabIndex={0}
        >
          {movies.map((movie, index) => {
            const movieKey = movie._id || movie.id;
            return (
              <div
                key={movieKey !== undefined ? `${movieKey}-${index}` : `index-${index}`}
                className={styles.item}
              >
                {/* Only the first row eager-loads its first few cards; the rest lazy-load on scroll */}
                <MovieCard movie={movie} priority={eager && index < 6} />
              </div>
            );
          })}
        </div>

        <button
          className={`${styles.navButton} ${styles.right} ${!canScrollRight ? styles.hidden : ""}`}
          onClick={() => handleClick("right")}
          aria-label={`Scroll ${title} right`}
        >
          <ChevronRight size={32} />
        </button>
      </div>
    </div>
  );
}