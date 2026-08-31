"use client";

import { useState, useEffect, useMemo } from "react";
import styles from "./page.module.css";
import Link from "next/link";
import {
  Play,
  Plus,
  Check,
  Star,
  ChevronDown,
  Volume2,
  ChevronLeft,
  Film,
  Sparkles,
} from "lucide-react";
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
import { getSeasonEpisodes } from "@/services/tmdb";
import { buildSeasonMapping } from "@/services/seasonMapper";
import { img } from "@/services/image";
import { isInMyList, toggleMyList } from "@/services/mylist";

interface TVClientProps {
  id: string;
}

export default function TVClient({ id }: TVClientProps) {
  const [activeId, setActiveId] = useState(id);
  const [retryToken, setRetryToken] = useState(0);

  // Sync prop changes
  useEffect(() => {
    setActiveId(id);
  }, [id]);

  const [movie, setMovie] = useState<any>(null);
  const [cast, setCast] = useState<any[]>([]);
  const [dubs, setDubs] = useState<any[]>([]);
  const [seasonsData, setSeasonsData] = useState<any>(null);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [tmdbBackdropUrl, setTmdbBackdropUrl] = useState<string | null>(null);
  const [tmdbShowMeta, setTmdbShowMeta] = useState<any>(null);
  const [logoReady, setLogoReady] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [recsLoading, setRecsLoading] = useState(true);
  const [inList, setInList] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [episodesProgress, setEpisodesProgress] = useState<{ [key: string]: { progress: number; duration: number } }>({});
  const [continueRecord, setContinueRecord] = useState<{ season: number; episode: number } | null>(null);

  // Continue watching detection
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

        const progMap: { [key: string]: { progress: number; duration: number } } = {};
        let latestTvRecord: any = null;
        let latestTimestamp = 0;

        history.forEach((item: any) => {
          const idMatches = allIds.has(String(item.id));
          const titleMatches = currentBaseTitle && item.title && item.mediaType === "tv" && getBaseTitle(item.title) === currentBaseTitle;

          if (idMatches || titleMatches) {
            if (item.season && item.episode) {
              progMap[`${item.season}:${item.episode}`] = {
                progress: item.progress || 0,
                duration: item.duration || 0,
              };

              const ts = item.updatedAt || 0;
              if (ts > latestTimestamp || !latestTvRecord) {
                latestTimestamp = ts;
                latestTvRecord = item;
              }
            }
          }
        });

        setEpisodesProgress(progMap);
        if (latestTvRecord && latestTvRecord.season && latestTvRecord.episode) {
          setContinueRecord({
            season: latestTvRecord.season,
            episode: latestTvRecord.episode,
          });
        } else {
          setContinueRecord(null);
        }
      } else {
        setEpisodesProgress({});
        setContinueRecord(null);
      }
    } catch (e) {
      console.error("Failed to load continue watching record in TV details page", e);
    }
  }, [activeId, movie, dubs]);

  // List state
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
      media_type: "tv",
    });
    setInList(nowIn);
  };

  // Core metadata fetching
  useEffect(() => {
    let active = true;

    const core = getCachedCore(activeId);
    const tmdb = getCachedTmdb(activeId);
    const recs = getCachedRecs(activeId);

    if (core) {
      setMovie(core.movie);
      setCast(core.cast);
      setDubs(core.dubs || []);
      setSeasonsData(core.seasons);
      if (core.seasons?.seasons?.[0]?.season) {
        setSelectedSeason(core.seasons.seasons[0].season);
      }
      if (active) setLoading(false);
    } else {
      setLoading(true);
    }
    if (tmdb) {
      setTmdbBackdropUrl(tmdb.backdropUrl ?? null);
      if (tmdb.meta?.logo_url !== tmdbShowMeta?.logo_url) setLogoReady(false);
      setTmdbShowMeta(tmdb.meta ?? null);
    }
    if (recs) {
      setRecommendations(recs);
      setRecsLoading(false);
    } else {
      setRecsLoading(true);
    }

    // CRITICAL PATH
    fetchCore(activeId)
      .then((data) => {
        if (!active) return;
        setMovie(data.movie);
        setCast(data.cast);
        setDubs(data.dubs || []);
        setSeasonsData(data.seasons);
        if (data.seasons?.seasons?.[0]?.season) {
          setSelectedSeason(data.seasons.seasons[0].season);
        }
        setFetchError(false);
        setLoading(false);

        if (data.movie?.title) {
          fetchTmdb(activeId, "tv", data.movie.title)
            .then((enr) => {
              if (!active) return;
              if (enr.backdropUrl) setTmdbBackdropUrl(enr.backdropUrl);
              if (enr.meta?.logo_url) setLogoReady(false);
              setTmdbShowMeta(enr.meta);
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

    // Recommendations
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

  const seasonMapping = useMemo(() => {
    return buildSeasonMapping(seasonsData, tmdbShowMeta?.seasons);
  }, [seasonsData, tmdbShowMeta?.seasons]);

  // Load season episodes
  useEffect(() => {
    if (!movie) return;
    let active = true;

    if (tmdbShowMeta?.id) {
      setEpisodesLoading(true);
      getSeasonEpisodes(tmdbShowMeta.id, selectedSeason)
        .then((data) => {
          if (!active) return;
          setEpisodes(data || []);
          setEpisodesLoading(false);
        })
        .catch(() => {
          if (!active) return;
          setEpisodes([]);
          setEpisodesLoading(false);
        });
    } else {
      setEpisodes([]);
      setEpisodesLoading(false);
    }

    return () => {
      active = false;
    };
  }, [movie, selectedSeason, tmdbShowMeta?.id]);

  const currentSeasonInfo = useMemo(() => {
    return seasonMapping.mappedSeasons.find((s) => s.season === selectedSeason) || null;
  }, [seasonMapping.mappedSeasons, selectedSeason]);

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

    if (tmdbShowMeta?.cast && tmdbShowMeta.cast.length > 0) {
      return tmdbShowMeta.cast;
    }

    if (mbxActors.length > 0) {
      return mbxActors;
    }

    const anyActors = (cast || []).filter((c: any) => {
      return !/director|writer|author|editor|producer|composer/i.test(c.character || "");
    });

    return anyActors.length > 0 ? anyActors : cast || [];
  }, [cast, tmdbShowMeta?.cast]);

  const enrichedEpisodes = useMemo(() => {
    const count = currentSeasonInfo?.episode_count || 0;
    return Array.from({ length: count }, (_, index) => {
      const epNum = index + 1;
      const tmdbEp =
        episodes[index] ||
        episodes.find((e: any) => e.episode_number === epNum);
      return {
        episode_number: epNum,
        name: tmdbEp?.name || `Episode ${epNum}`,
        overview: tmdbEp?.overview || `Episode ${epNum} of ${movie?.title || "TV Show"}.`,
        still_path: tmdbEp?.still_path || null,
        runtime: tmdbEp?.runtime || null,
        air_date: tmdbEp?.air_date || null,
      };
    });
  }, [currentSeasonInfo, episodes, movie]);

  if (loading) {
    return <DetailPageSkeleton />;
  }

  if (!movie) {
    return (
      <div className={styles.main}>
        <div className={styles.errorContainer}>
          <h1>{fetchError ? "Something went wrong" : "TV Show not found"}</h1>
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
  const totalEpsCount = movie.totalEpisodes || seasonMapping.mappedSeasons.reduce((acc, s) => acc + s.episode_count, 0);

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
            {!tmdbShowMeta?.logo_url ? (
              <h1 className={styles.heroTitle}>{movie.title}</h1>
            ) : (
              <div className={`${styles.logoContainer} ${logoReady ? styles.logoVisible : ""}`}>
                {!logoReady && <div className={`${styles.logoSkeleton} skeleton`} />}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.logo(tmdbShowMeta.logo_url)}
                  alt={movie.title}
                  className={styles.titleLogo}
                  onLoad={() => setLogoReady(true)}
                />
              </div>
            )}

            {/* Minimalist Inline Meta Line (Red Star • Year • Seasons • Episodes • Genres) */}
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
              <span className={styles.dotSep}>•</span>
              <span>{seasonMapping.mappedSeasons.length} {seasonMapping.mappedSeasons.length === 1 ? "Season" : "Seasons"}</span>
              {totalEpsCount > 0 && (
                <>
                  <span className={styles.dotSep}>•</span>
                  <span>{totalEpsCount} Episodes</span>
                </>
              )}
              {movie.genre && (
                <>
                  <span className={styles.dotSep}>•</span>
                  <span style={{ color: "#94a3b8" }}>
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
                          window.history.pushState(null, "", `/tv/${d.subject_id}`);
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
              {continueRecord ? (
                <Link
                  href={`/watch/${activeId}?season=${continueRecord.season}&episode=${continueRecord.episode}`}
                  className={styles.playPillButton}
                  onMouseEnter={() => {
                    const b = seasonMapping.mapUiToBackend(continueRecord.season, continueRecord.episode);
                    prefetchDownload(activeId, b.mbxSeason, b.mbxEpisode);
                  }}
                  onTouchStart={() => {
                    const b = seasonMapping.mapUiToBackend(continueRecord.season, continueRecord.episode);
                    prefetchDownload(activeId, b.mbxSeason, b.mbxEpisode);
                  }}
                >
                  <Play fill="currentColor" size={19} />
                  <span>Resume S{continueRecord.season} • E{continueRecord.episode}</span>
                </Link>
              ) : (
                <Link
                  href={`/watch/${activeId}?season=${selectedSeason}&episode=1`}
                  className={styles.playPillButton}
                  onMouseEnter={() => {
                    const b = seasonMapping.mapUiToBackend(selectedSeason, 1);
                    prefetchDownload(activeId, b.mbxSeason, b.mbxEpisode);
                  }}
                  onTouchStart={() => {
                    const b = seasonMapping.mapUiToBackend(selectedSeason, 1);
                    prefetchDownload(activeId, b.mbxSeason, b.mbxEpisode);
                  }}
                >
                  <Play fill="currentColor" size={19} />
                  <span>Play S{selectedSeason} • E1</span>
                </Link>
              )}

              {/* Circular Watchlist Button */}
              <button
                className={`${styles.circleWatchlistBtn} ${inList ? styles.circleWatchlistBtnActive : ""}`}
                onClick={handleToggleList}
                title={inList ? "Remove from My List" : "Add to My List"}
                aria-label={inList ? "In Watchlist" : "Add to Watchlist"}
              >
                {inList ? <Check size={20} /> : <Plus size={20} />}
              </button>

              {/* Episodes Scroll Button */}
              <button
                className={styles.pillActionBtn}
                onClick={() => {
                  document.getElementById("episodes")?.scrollIntoView({ behavior: "smooth" });
                }}
                title="Browse Episodes"
              >
                <Film size={16} />
                <span>Episodes</span>
              </button>

              {/* Similars Scroll Button */}
              <button
                className={styles.pillActionBtn}
                onClick={() => {
                  document.getElementById("recommendations")?.scrollIntoView({ behavior: "smooth" });
                }}
                title="Explore Similar Shows"
              >
                <Sparkles size={16} />
                <span>Similars</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 2. MODERN DETAILS HUB (EPISODES CATALOG, STORYLINE, CAST, SPECS) */}
      <div className={`container ${styles.detailsHub}`}>
        <div className={styles.hubGrid}>
          {/* Main Content Area */}
          <div className={styles.hubMain}>
            {/* Netflix-Style Season & Episode Catalog */}
            {seasonMapping.mappedSeasons.length > 0 && (
              <div id="episodes" className={styles.episodesSection}>
                <div className={styles.episodesHeader}>
                  <div className={styles.episodesHeaderLeft}>
                    <h3 className={styles.hubSectionTitle}>Episodes</h3>
                    <span className={styles.seasonSummaryPill}>
                      {currentSeasonInfo?.name || `Season ${selectedSeason}`} • {currentSeasonInfo?.episode_count || 0} Episodes
                    </span>
                  </div>

                  {seasonMapping.mappedSeasons.length > 1 && (
                    <div className={styles.seasonSelectorWrapper}>
                      <select
                        value={selectedSeason}
                        onChange={(e) => setSelectedSeason(parseInt(e.target.value))}
                        className={styles.seasonSelect}
                        aria-label="Select season"
                      >
                        {seasonMapping.mappedSeasons.map((s) => (
                          <option key={s.season} value={s.season}>
                            {s.name} ({s.episode_count} Episodes)
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={16} className={styles.dropdownIcon} />
                    </div>
                  )}
                </div>

                <div className={styles.episodesList}>
                  {episodesLoading && enrichedEpisodes.length === 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                      {[1, 2, 3].map((i) => (
                        <div key={i} className={styles.episodeCard} style={{ pointerEvents: "none" }}>
                          <div className={styles.episodeStillContainer}>
                            <div className="skeleton" style={{ width: "100%", height: "100%" }} />
                          </div>
                          <div className={styles.episodeDetails} style={{ gap: "0.6rem" }}>
                            <div className="skeleton" style={{ height: 18, width: "55%", borderRadius: 4 }} />
                            <div className="skeleton" style={{ height: 14, width: "85%", borderRadius: 4 }} />
                            <div className="skeleton" style={{ height: 14, width: "65%", borderRadius: 4 }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    enrichedEpisodes.map((ep) => {
                      const progressInfo = episodesProgress[`${selectedSeason}:${ep.episode_number}`];
                      const backendCoords = seasonMapping.mapUiToBackend(selectedSeason, ep.episode_number);
                      const stillSrc = ep.still_path ? img.still(ep.still_path) : img.still(movie.cover?.url);

                      return (
                        <Link
                          key={`ep-${selectedSeason}-${ep.episode_number}`}
                          href={`/watch/${activeId}?season=${selectedSeason}&episode=${ep.episode_number}`}
                          className={styles.episodeCard}
                          onMouseEnter={() => prefetchDownload(activeId, backendCoords.mbxSeason, backendCoords.mbxEpisode)}
                          onTouchStart={() => prefetchDownload(activeId, backendCoords.mbxSeason, backendCoords.mbxEpisode)}
                        >
                          <div className={styles.episodeStillContainer}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={stillSrc}
                              alt={ep.name}
                              className={styles.episodeStill}
                              loading="lazy"
                            />
                            <div className={styles.episodePlayOverlay}>
                              <div className={styles.episodePlayBtn}>
                                <Play fill="currentColor" size={20} />
                              </div>
                            </div>
                            <span className={styles.episodeNum}>EP {ep.episode_number}</span>
                            {progressInfo && progressInfo.progress > 0 && progressInfo.duration > 0 && (
                              <div className={styles.episodeProgress}>
                                <div
                                  className={styles.episodeProgressFill}
                                  style={{ width: `${(progressInfo.progress / progressInfo.duration) * 100}%` }}
                                />
                              </div>
                            )}
                          </div>

                          <div className={styles.episodeDetails}>
                            <div className={styles.episodeMetaRow}>
                              <h4 className={styles.episodeTitle}>
                                {ep.episode_number}. {ep.name}
                              </h4>
                              {ep.runtime && <span className={styles.episodeRuntime}>{ep.runtime}m</span>}
                            </div>
                            <p className={styles.episodeOverview}>{ep.overview}</p>
                          </div>
                        </Link>
                      );
                    })
                  )}
                </div>
              </div>
            )}

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
              <h4 className={styles.specsTitle}>Show Information</h4>

              <div className={styles.specItem}>
                <span className={styles.specLabel}>First Aired</span>
                <span className={styles.specValue}>{movie.releaseDate || "Unknown"}</span>
              </div>

              <div className={styles.specItem}>
                <span className={styles.specLabel}>Seasons</span>
                <span className={styles.specValue}>{seasonMapping.mappedSeasons.length}</span>
              </div>

              <div className={styles.specItem}>
                <span className={styles.specLabel}>Total Episodes</span>
                <span className={styles.specValue}>{totalEpsCount}</span>
              </div>

              {movie.countryName && (
                <div className={styles.specItem}>
                  <span className={styles.specLabel}>Origin</span>
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
