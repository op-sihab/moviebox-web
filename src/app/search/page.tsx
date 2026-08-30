"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { mapSubject, searchContent } from "@/services/api";
import MovieCard from "@/components/MovieCard";
import MovieCardSkeleton from "@/components/MovieCardSkeleton";
import styles from "./page.module.css";
import {
  Search as SearchIcon,
  AlertTriangle,
  ChevronDown,
} from "lucide-react";

const DEBOUNCE_MS = 500;
const PAGE_SIZE = 60;

type SearchResult = ReturnType<typeof mapSubject>;

function SearchInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qParam = searchParams.get("q") ?? "";

  const [query, setQuery] = useState(() => qParam);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [retryToken, setRetryToken] = useState(0);

  // Debounced search with per-query AbortController.
  // Previous results are kept visible while a new request is in flight.
  useEffect(() => {
    const trimmed = query.trim();
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    if (trimmed === "") {
      // Immediate reset — also clears "loading" if a request was in flight.
      setResults([]);
      setError(false);
      setLoading(false);
      setVisibleCount(PAGE_SIZE);
    } else {
      timer = setTimeout(async () => {
        if (controller.signal.aborted || cancelled) return;
        setLoading(true);
        setError(false);

        try {
          const data = await searchContent(trimmed, controller.signal);
          if (cancelled || controller.signal.aborted) return;
          const subjects: any[] = data?.data?.items || [];
          setResults(subjects.map(mapSubject));
          setVisibleCount(PAGE_SIZE);
        } catch (err) {
          if (cancelled || controller.signal.aborted) return;
          console.error("Search failed:", err);
          setError(true);
        } finally {
          if (!cancelled && !controller.signal.aborted) setLoading(false);
        }
      }, DEBOUNCE_MS);
    }

    return () => {
      cancelled = true;
      if (timer !== undefined) clearTimeout(timer);
      controller.abort();
    };
  }, [query, retryToken]);

  // Shallow URL sync on debounced change (no loop: only replaces when different).
  useEffect(() => {
    const trimmed = query.trim();
    const current = new URLSearchParams(window.location.search).get("q") ?? "";
    if (trimmed === current) return;
    router.replace(
      trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search",
      { scroll: false }
    );
  }, [query, router]);

  // Sync state back from the URL on back/forward navigation.
  useEffect(() => {
    setQuery((prev: string) => (prev === qParam ? prev : qParam));
  }, [qParam]);

  const handleRetry = () => setRetryToken((t) => t + 1);

  const visibleResults = results.slice(0, visibleCount);

  return (
    <main className={styles.main}>
      <div className={`container ${styles.container}`}>
        <div className={styles.searchBar}>
          <SearchIcon className={styles.searchIcon} size={24} />
          <input
            type="text"
            placeholder="Search for movies, TV shows..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={styles.searchInput}
            aria-label="Search for movies, TV shows"
          />
          {loading && (
            <div className="skeleton" style={{ width: "20px", height: "20px", borderRadius: "50%", opacity: 0.3 }} />
          )}
        </div>
        {loading && <div className={styles.loadingBar} aria-hidden="true" />}

        {loading && results.length === 0 && (
          <div className={styles.resultsGrid} style={{ marginTop: "2rem" }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={`search-skel-${i}`} className={styles.gridItem}>
                <MovieCardSkeleton />
              </div>
            ))}
          </div>
        )}

        {results.length > 0 && (
          <div className={styles.resultsGrid}>
            {visibleResults.map((movie, rIdx) => (
              <div key={`${movie._id || movie.id || "res"}-${rIdx}`} className={styles.gridItem}>
                <MovieCard movie={movie} />
              </div>
            ))}
          </div>
        )}

        {results.length > visibleCount && (
          <div className={styles.loadMoreWrap}>
            <button
              type="button"
              className={styles.loadMoreButton}
              onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
            >
              <ChevronDown size={18} />
              <span>Load More</span>
            </button>
          </div>
        )}

        {error && results.length === 0 && (
          <div className={styles.errorState} role="alert">
            <AlertTriangle className={styles.errorIcon} size={32} />
            <h2>Something went wrong</h2>
            <p>We couldn&apos;t complete your search. Please try again.</p>
            <button
              type="button"
              className={styles.retryButton}
              onClick={handleRetry}
            >
              Try Again
            </button>
          </div>
        )}

        {!error && query.trim() !== "" && !loading && results.length === 0 && (
          <div className={styles.noResults}>
            <p>No results found for &quot;{query}&quot;</p>
          </div>
        )}

        {query.trim() === "" && (
          <div className={styles.emptyState}>
            <h2>What are you looking for?</h2>
            <p>Search by title, character, or genre.</p>
          </div>
        )}
      </div>
    </main>
  );
}

function SearchFallback() {
  return (
    <main className={styles.main}>
      <div className={`container ${styles.container}`}>
        <div className={styles.searchBar} aria-hidden="true">
          <SearchIcon className={styles.searchIcon} size={24} />
          <span className={`${styles.searchInput} ${styles.fallbackText}`}>
            Search…
          </span>
        </div>
        <div className={styles.resultsGrid} style={{ marginTop: "2rem" }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={`fallback-skel-${i}`} className={styles.gridItem}>
              <MovieCardSkeleton />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchFallback />}>
      <SearchInner />
    </Suspense>
  );
}