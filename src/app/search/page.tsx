"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { mapSubject, searchContent } from "@/services/api";
import MovieCard from "@/components/MovieCard";
import MovieCardSkeleton from "@/components/MovieCardSkeleton";
import styles from "./page.module.css";
import {
  Search as SearchIcon,
  X as ClearIcon,
  AlertTriangle,
  ChevronDown,
  Sparkles,
  TrendingUp,
  Loader2,
  Film,
} from "lucide-react";

const DEBOUNCE_MS = 400;
const PAGE_SIZE = 40;

type SearchResult = ReturnType<typeof mapSubject>;

const GENRE_CATEGORIES = [
  { name: "Action", emoji: "⚡", query: "Action" },
  { name: "Anime", emoji: "🎌", query: "Anime" },
  { name: "Hindi Dub", emoji: "🎙️", query: "Hindi" },
  { name: "Marvel", emoji: "🍿", query: "Marvel" },
  { name: "Sci-Fi", emoji: "🌌", query: "Sci-Fi" },
  { name: "Thriller", emoji: "🔪", query: "Thriller" },
  { name: "Drama", emoji: "🎭", query: "Drama" },
  { name: "Horror", emoji: "👻", query: "Horror" },
  { name: "Comedy", emoji: "🤣", query: "Comedy" },
  { name: "Romance", emoji: "💖", query: "Romance" },
];

const POPULAR_SEARCHES = [
  "Naruto",
  "Spider-Man",
  "Avengers",
  "One Piece",
  "Breaking Bad",
  "Batman",
  "Stranger Things",
  "Jujutsu Kaisen",
  "Loki",
  "Avatar",
  "Demon Slayer",
  "Game of Thrones",
];

function SearchInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qParam = searchParams.get("q") ?? "";
  const typeParam = (searchParams.get("type") as "all" | "movie" | "tv") || "all";

  const [query, setQuery] = useState(() => qParam);
  const [filterType, setFilterType] = useState<"all" | "movie" | "tv">(() => typeParam);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [retryToken, setRetryToken] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced search with per-query AbortController
  useEffect(() => {
    const trimmed = query.trim();
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    if (trimmed === "") {
      setResults([]);
      setError(false);
      setLoading(false);
      setVisibleCount(PAGE_SIZE);
    } else {
      setLoading(true);
      setError(false);
      timer = setTimeout(async () => {
        if (controller.signal.aborted || cancelled) return;

        try {
          const data = await searchContent(trimmed, filterType, 1, controller.signal);
          if (cancelled || controller.signal.aborted) return;
          const subjects: any[] = data?.data?.items || [];
          setResults(subjects.map(mapSubject));
          setVisibleCount(PAGE_SIZE);
        } catch (err: any) {
          if (cancelled || controller.signal.aborted || err?.name === "AbortError") return;
          console.error("Search failed:", err);
          setError(true);
        } finally {
          if (!cancelled && !controller.signal.aborted) {
            setLoading(false);
          }
        }
      }, DEBOUNCE_MS);
    }

    return () => {
      cancelled = true;
      if (timer !== undefined) clearTimeout(timer);
      controller.abort();
    };
  }, [query, filterType, retryToken]);

  // Sync state to URL
  useEffect(() => {
    const trimmed = query.trim();
    const currentQ = new URLSearchParams(window.location.search).get("q") ?? "";
    const currentType = new URLSearchParams(window.location.search).get("type") ?? "all";

    if (trimmed === currentQ && filterType === currentType) return;

    if (trimmed) {
      const typeStr = filterType !== "all" ? `&type=${filterType}` : "";
      router.replace(`/search?q=${encodeURIComponent(trimmed)}${typeStr}`, { scroll: false });
    } else {
      router.replace("/search", { scroll: false });
    }
  }, [query, filterType, router]);

  // Sync state back from URL on navigation
  useEffect(() => {
    setQuery((prev) => (prev === qParam ? prev : qParam));
    setFilterType((prev) => (prev === typeParam ? prev : typeParam));
  }, [qParam, typeParam]);

  const handleClear = () => {
    setQuery("");
    setResults([]);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleTagClick = (tag: string) => {
    setQuery(tag);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleRetry = () => setRetryToken((t) => t + 1);

  const visibleResults = results.slice(0, visibleCount);
  const isQueryActive = query.trim() !== "";

  return (
    <main className={styles.main}>
      <div className={`container ${styles.container}`}>
        {/* Header Title */}
        <div className={styles.searchHero}>
          <h1 className={styles.pageTitle}>
            Explore & <span>Search</span>
          </h1>
          <p className={styles.pageSubtitle}>
            Discover thousands of HD movies, TV shows, and anime on CineAura
          </p>

          {/* Search Input Bar */}
          <div className={styles.searchBarWrapper}>
            <div className={styles.searchBar}>
              <SearchIcon className={styles.searchIcon} size={22} />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search by title, anime, character, genre..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className={styles.searchInput}
                aria-label="Search movies and shows"
                autoFocus
              />
              {loading && <Loader2 className={styles.spinner} size={20} />}
              {query && !loading && (
                <button
                  type="button"
                  onClick={handleClear}
                  className={styles.clearButton}
                  title="Clear search"
                  aria-label="Clear search query"
                >
                  <ClearIcon size={16} />
                </button>
              )}
            </div>

            {/* Stable loading bar that never causes layout shifts */}
            <div className={styles.loadingBarContainer}>
              {loading && <div className={styles.loadingBarActive} aria-hidden="true" />}
            </div>
          </div>
        </div>

        {/* Filter Tabs & Results Count (shown when searching or results exist) */}
        {isQueryActive && (
          <div className={styles.controlsBar}>
            <div className={styles.filterTabs}>
              <button
                type="button"
                className={`${styles.filterTab} ${filterType === "all" ? styles.filterTabActive : ""}`}
                onClick={() => setFilterType("all")}
              >
                All
              </button>
              <button
                type="button"
                className={`${styles.filterTab} ${filterType === "movie" ? styles.filterTabActive : ""}`}
                onClick={() => setFilterType("movie")}
              >
                Movies
              </button>
              <button
                type="button"
                className={`${styles.filterTab} ${filterType === "tv" ? styles.filterTabActive : ""}`}
                onClick={() => setFilterType("tv")}
              >
                TV Shows
              </button>
            </div>

            {!loading && results.length > 0 && (
              <div className={styles.resultCount}>
                Found <strong>{results.length}</strong> {results.length === 1 ? "result" : "results"} for &quot;{query.trim()}&quot;
              </div>
            )}
          </div>
        )}

        {/* Loading State Skeletons */}
        {loading && results.length === 0 && (
          <div className={styles.resultsGrid}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={`search-skel-${i}`} className={styles.gridItem}>
                <MovieCardSkeleton />
              </div>
            ))}
          </div>
        )}

        {/* Results Grid */}
        {results.length > 0 && (
          <div className={styles.resultsGrid}>
            {visibleResults.map((movie, rIdx) => (
              <div key={`${movie._id || movie.id || "res"}-${rIdx}`} className={styles.gridItem}>
                <MovieCard movie={movie} />
              </div>
            ))}
          </div>
        )}

        {/* Load More Button */}
        {results.length > visibleCount && (
          <div className={styles.loadMoreWrap}>
            <button
              type="button"
              className={styles.loadMoreButton}
              onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
            >
              <ChevronDown size={18} />
              <span>Load More ({results.length - visibleCount} remaining)</span>
            </button>
          </div>
        )}

        {/* Error State */}
        {error && results.length === 0 && (
          <div className={styles.errorState} role="alert">
            <AlertTriangle className={styles.errorIcon} size={40} />
            <h2>Search Failed</h2>
            <p>We couldn&apos;t load search results. Please check your connection and try again.</p>
            <button type="button" className={styles.retryButton} onClick={handleRetry}>
              Try Again
            </button>
          </div>
        )}

        {/* No Results State */}
        {!error && isQueryActive && !loading && results.length === 0 && (
          <div className={styles.noResults}>
            <Film className={styles.noResultsIcon} size={48} />
            <h2>No Results Found</h2>
            <p>
              We couldn&apos;t find anything matching &quot;<strong>{query}</strong>&quot;. Try checking for typos or searching for a general keyword like &quot;Action&quot; or &quot;Anime&quot;.
            </p>
          </div>
        )}

        {/* Empty / Discovery State */}
        {!isQueryActive && (
          <div className={styles.discoverySection}>
            {/* Quick Genres */}
            <div className={styles.discoveryBlock}>
              <div className={styles.discoveryTitle}>
                <Sparkles size={18} color="var(--accent-color)" />
                <span>Browse by Category</span>
              </div>
              <div className={styles.genresGrid}>
                {GENRE_CATEGORIES.map((cat) => (
                  <button
                    key={cat.name}
                    type="button"
                    className={styles.genreChip}
                    onClick={() => handleTagClick(cat.query)}
                  >
                    <span className={styles.genreEmoji}>{cat.emoji}</span>
                    <span>{cat.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Popular Searches */}
            <div className={styles.discoveryBlock}>
              <div className={styles.discoveryTitle}>
                <TrendingUp size={18} color="var(--accent-color)" />
                <span>Trending Searches</span>
              </div>
              <div className={styles.popularTags}>
                {POPULAR_SEARCHES.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className={styles.popularTag}
                    onClick={() => handleTagClick(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
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
        <div className={styles.searchHero}>
          <h1 className={styles.pageTitle}>
            Explore & <span>Search</span>
          </h1>
          <div className={styles.searchBar}>
            <SearchIcon className={styles.searchIcon} size={22} />
            <span className={`${styles.searchInput} ${styles.fallbackText}`}>
              Search movies, TV shows...
            </span>
          </div>
        </div>
        <div className={styles.resultsGrid}>
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