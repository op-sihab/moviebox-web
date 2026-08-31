"use client";

import { Suspense, useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

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
  History,
  Trash2,
  Loader2,
  Film,
  Zap,
  Tv,
  Mic,
  Rocket,
  Flame,
  Drama,
  Ghost,
  Laugh,
  Heart,
  Star,
} from "lucide-react";

const DEBOUNCE_MS = 280;
const PAGE_SIZE = 40;
const RECENT_SEARCHES_KEY = "mbx:recent_searches";

type SearchResult = ReturnType<typeof mapSubject>;

const GENRE_CATEGORIES = [
  { name: "Action", icon: Zap, query: "Action", color: "#f59e0b" },
  { name: "Anime", icon: Tv, query: "Anime", color: "#ec4899" },
  { name: "Hindi Dub", icon: Mic, query: "Hindi", color: "#3b82f6" },
  { name: "Marvel", icon: Film, query: "Marvel", color: "#ef4444" },
  { name: "Sci-Fi", icon: Rocket, query: "Sci-Fi", color: "#8b5cf6" },
  { name: "Thriller", icon: Flame, query: "Thriller", color: "#f97316" },
  { name: "Drama", icon: Drama, query: "Drama", color: "#10b981" },
  { name: "Horror", icon: Ghost, query: "Horror", color: "#a855f7" },
  { name: "Comedy", icon: Laugh, query: "Comedy", color: "#eab308" },
  { name: "Romance", icon: Heart, query: "Romance", color: "#f43f5e" },
];

const POPULAR_SEARCHES = [
  "Spider-Man",
  "Naruto",
  "Breaking Bad",
  "Avengers",
  "Game of Thrones",
  "One Piece",
  "Stranger Things",
  "Batman",
  "Jujutsu Kaisen",
  "Loki",
  "Avatar",
  "Demon Slayer",
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
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (saved) {
        setRecentSearches(JSON.parse(saved));
      }
    } catch {}
  }, []);

  const saveRecentSearch = useCallback((term: string) => {
    const clean = term.trim();
    if (!clean || clean.length < 2) return;
    try {
      setRecentSearches((prev) => {
        const next = [clean, ...prev.filter((s) => s.toLowerCase() !== clean.toLowerCase())].slice(0, 8);
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
        return next;
      });
    } catch {}
  }, []);

  const removeRecentSearch = (e: React.MouseEvent, term: string) => {
    e.stopPropagation();
    try {
      setRecentSearches((prev) => {
        const next = prev.filter((s) => s !== term);
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
        return next;
      });
    } catch {}
  };

  const clearAllRecent = () => {
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
      setRecentSearches([]);
    } catch {}
  };

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
          saveRecentSearch(trimmed);
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
  }, [query, filterType, retryToken, saveRecentSearch]);

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

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const searchBarWrapRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchBarWrapRef.current && !searchBarWrapRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setIsDropdownOpen(false);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleTagClick = (tag: string) => {
    setQuery(tag);
    setIsDropdownOpen(false);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      handleClear();
    } else if (e.key === "Enter") {
      setIsDropdownOpen(false);
    }
  };

  const handleRetry = () => setRetryToken((t) => t + 1);

  const visibleResults = results.slice(0, visibleCount);
  const isQueryActive = query.trim() !== "";

  return (
    <main className={styles.main}>
      <div className={`container ${styles.container}`}>
        {/* Header Hero */}
        <div className={styles.searchHero}>
          <div className={styles.heroTextWrap}>
            <h1 className={styles.pageTitle}>
              Explore <span>CineAura</span>
            </h1>
            <p className={styles.pageSubtitle}>
              Search thousands of movies, TV shows, and anime in HD quality
            </p>
          </div>

          {/* Search Input Bar */}
          <div className={styles.searchBarWrapper} ref={searchBarWrapRef}>
            <div className={styles.searchBar}>
              <SearchIcon className={styles.searchIcon} size={22} />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search movies, TV shows, anime, genres..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setIsDropdownOpen(true);
                }}
                onFocus={() => setIsDropdownOpen(true)}
                onKeyDown={handleKeyDown}
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
                  title="Clear search (Esc)"
                  aria-label="Clear search query"
                >
                  <ClearIcon size={16} />
                </button>
              )}
            </div>

            {/* Instant Floating Recommendations Dropdown */}
            {isDropdownOpen && isQueryActive && results.length > 0 && (
              <div className={styles.suggestionsDropdown}>
                <div className={styles.dropdownHeader}>
                  <Sparkles size={14} color="var(--accent-color)" />
                  <span>Top Recommendations</span>
                </div>
                <div className={styles.suggestionsList}>
                  {results.slice(0, 5).map((item) => {
                    const itemTitle = item.title || "Untitled";
                    const itemType = item.media_type || "movie";
                    const itemId = item._id || item.id;
                    const date = item.release_date;
                    const itemYear = date ? new Date(date).getFullYear() : "";
                    const itemRating = item.vote_average ? item.vote_average.toFixed(1) : "";
                    const posterUrl = item.poster_path
                      ? (item.poster_path.startsWith("http")
                        ? item.poster_path
                        : `https://image.tmdb.org/t/p/w200${item.poster_path}`)
                      : "/placeholder.png";

                    return (
                      <Link
                        key={`sugg-${itemId}`}
                        href={`/${itemType === "tv" ? "tv" : "movie"}/${itemId}`}
                        className={styles.suggestionItem}
                        onClick={() => {
                          setIsDropdownOpen(false);
                          if (typeof window !== "undefined") window.scrollTo({ top: 0, left: 0, behavior: "instant" });
                        }}
                      >
                        <div className={styles.suggestionPosterWrap}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={posterUrl} alt={itemTitle} className={styles.suggestionPoster} />
                        </div>
                        <div className={styles.suggestionDetails}>
                          <h4 className={styles.suggestionTitle}>{itemTitle}</h4>
                          <div className={styles.suggestionMeta}>
                            {itemRating && (
                              <span className={styles.suggestionRating}>
                                <Star size={11} fill="#f5c518" color="#f5c518" /> {itemRating}
                              </span>
                            )}
                            {itemRating && itemYear && <span className={styles.dot}>•</span>}
                            {itemYear && <span className={styles.suggestionYear}>{itemYear}</span>}
                            {itemYear && <span className={styles.dot}>•</span>}
                            <span className={styles.suggestionType}>{itemType === "tv" ? "TV" : "Movie"}</span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
                <button
                  type="button"
                  className={styles.viewAllFooter}
                  onClick={() => {
                    setIsDropdownOpen(false);
                    inputRef.current?.blur();
                  }}
                >
                  <span>View all {results.length} results</span>
                </button>
              </div>
            )}

            {/* Accent loading shimmer bar */}
            <div className={styles.loadingBarContainer}>
              {loading && <div className={styles.loadingBarActive} aria-hidden="true" />}
            </div>
          </div>
        </div>

        {/* Filter Tabs & Results Count Bar */}
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
                TV Series
              </button>
            </div>

            {!loading && results.length > 0 && (
              <div className={styles.resultCount}>
                Found <strong>{results.length}</strong> {results.length === 1 ? "title" : "titles"} for &quot;{query.trim()}&quot;
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
            <AlertTriangle className={styles.errorIcon} size={42} />
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
              We couldn&apos;t find anything matching &quot;<strong>{query}</strong>&quot;. Check for typos or browse popular categories below.
            </p>
            <div className={styles.noResultsChips}>
              {POPULAR_SEARCHES.slice(0, 6).map((tag) => (
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
        )}

        {/* Empty / Discovery State */}
        {!isQueryActive && (
          <div className={styles.discoverySection}>
            {/* Recent Searches */}
            {recentSearches.length > 0 && (
              <div className={styles.discoveryBlock}>
                <div className={styles.discoveryHeader}>
                  <div className={styles.discoveryTitle}>
                    <History size={18} color="var(--accent-color)" />
                    <span>Recent Searches</span>
                  </div>
                  <button
                    type="button"
                    className={styles.clearAllRecentBtn}
                    onClick={clearAllRecent}
                  >
                    <Trash2 size={13} />
                    <span>Clear All</span>
                  </button>
                </div>
                <div className={styles.recentTags}>
                  {recentSearches.map((term) => (
                    <div
                      key={term}
                      className={styles.recentTag}
                      onClick={() => handleTagClick(term)}
                    >
                      <span className={styles.recentTagText}>{term}</span>
                      <button
                        type="button"
                        className={styles.removeRecentBtn}
                        onClick={(e) => removeRecentSearch(e, term)}
                        title="Remove"
                      >
                        <ClearIcon size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Trending Searches */}
            <div className={styles.discoveryBlock}>
              <div className={styles.discoveryTitle}>
                <Flame size={18} color="var(--accent-color)" />
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

            {/* Quick Genres / Categories */}
            <div className={styles.discoveryBlock}>
              <div className={styles.discoveryTitle}>
                <Sparkles size={18} color="var(--accent-color)" />
                <span>Browse by Category</span>
              </div>
              <div className={styles.genresGrid}>
                {GENRE_CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  return (
                    <button
                      key={cat.name}
                      type="button"
                      className={styles.genreChip}
                      onClick={() => handleTagClick(cat.query)}
                    >
                      <div className={styles.genreIconWrap} style={{ background: `${cat.color}15`, color: cat.color }}>
                        <Icon size={18} />
                      </div>
                      <span className={styles.genreName}>{cat.name}</span>
                    </button>
                  );
                })}
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
          <div className={styles.heroTextWrap}>
            <h1 className={styles.pageTitle}>
              Explore <span>CineAura</span>
            </h1>
          </div>
          <div className={styles.searchBar}>
            <SearchIcon className={styles.searchIcon} size={22} />
            <span className={`${styles.searchInput} ${styles.fallbackText}`}>
              Search movies, TV shows, anime...
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