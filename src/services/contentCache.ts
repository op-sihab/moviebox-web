/**
 * Shared content cache + prefetch layer.
 *
 * Goals:
 *  - Decouple the slow TMDB enrichment from the critical render path so the
 *    page paints as soon as the MovieBox details respond.
 *  - Deduplicate in-flight requests (so hover-prefetch + click never double-fetch).
 *  - Persist core details to sessionStorage so reloads / back-forward are instant.
 *  - Allow MovieCards to warm the cache on hover so navigation feels instant
 *    (no skeleton on the destination page).
 *
 * All in-memory caches are bounded LRU + TTL (see createLruCache below):
 * entries expire after their TTL and the least-recently-used entry is evicted
 * once the entry cap is reached, so long sessions cannot grow memory without
 * bound. Failed fetches are never cached, so they can be retried.
 */

const BASE_URL = process.env.API_URL || "https://movie-api.opsihab.tech";

export interface CoreDetails {
  movie: any;
  cast: any[];
  seasons: any;
  episodes?: any[];
  dubs?: any[];
  backdropUrl?: string | null;
  logoUrl?: string | null;
  logoW500Url?: string | null;
  posterUrl?: string | null;
  tmdbId?: number | null;
  logos?: any[];
  trailer?: string | null;
  tagline?: string | null;
  totalSeasons?: number | null;
  totalEpisodes?: number | null;
}

export interface TmdbEnrichment {
  backdropUrl: string | null;
  titledBackdropUrl?: string | null;
  logoUrl: string | null;
  meta: any;
}

// ---------- LRU + TTL cache ----------
// A plain insertion-ordered Map doubles as an LRU: on access the entry is
// re-inserted (delete + set) to mark it most-recently-used, and once the cache
// grows past maxEntries the oldest entry (the first key) is evicted. Entries
// older than ttlMs are treated as absent and dropped on access.

function createLruCache<T>(maxEntries: number, ttlMs: number) {
  const entries = new Map<string, { value: T; expiresAt: number }>();

  function touch(key: string): { value: T } | null {
    const entry = entries.get(key);
    if (!entry) return null;
    if (Date.now() >= entry.expiresAt) {
      entries.delete(key); // expired: drop it and report a miss
      return null;
    }
    entries.delete(key);
    entries.set(key, entry); // refresh recency
    return entry;
  }

  return {
    get(key: string): T | undefined {
      return touch(key)?.value;
    },
    set(key: string, value: T): void {
      entries.delete(key); // re-insert at the back = most recent
      entries.set(key, { value, expiresAt: Date.now() + ttlMs });
      while (entries.size > maxEntries) {
        const oldest = entries.keys().next();
        if (oldest.done) break;
        entries.delete(oldest.value);
      }
    },
    delete(key: string): void {
      entries.delete(key);
    },
    has(key: string): boolean {
      return touch(key) !== null;
    },
  };
}

// In-memory caches (survive client-side navigation within the session, expire
// by TTL, and evict least-recently-used entries once full). Download links are
// more volatile, so they get a shorter TTL.
const DETAIL_CACHE_MAX = 50;
const DETAIL_CACHE_TTL_MS = 30 * 60 * 1000;
const DOWNLOAD_CACHE_TTL_MS = 10 * 60 * 1000;

const coreCache = createLruCache<CoreDetails>(DETAIL_CACHE_MAX, DETAIL_CACHE_TTL_MS);
const tmdbCache = createLruCache<TmdbEnrichment>(DETAIL_CACHE_MAX, DETAIL_CACHE_TTL_MS);
const recsCache = createLruCache<any[]>(DETAIL_CACHE_MAX, DETAIL_CACHE_TTL_MS);
const downloadCache = createLruCache<any[]>(DETAIL_CACHE_MAX, DOWNLOAD_CACHE_TTL_MS);
const subtitlesCache = createLruCache<any[]>(DETAIL_CACHE_MAX, DOWNLOAD_CACHE_TTL_MS);

// In-flight request dedupe maps (entries are always removed once settled, so
// failed requests can be retried)
const pendingCore: Record<string, Promise<CoreDetails>> = {};
const pendingTmdb: Record<string, Promise<TmdbEnrichment>> = {};
const pendingRecs: Record<string, Promise<any[]>> = {};

// ---------- sessionStorage persistence (core details only) ----------
// Entries are versioned (mbx:core:v2:<id>) and bounded through an index of the
// 30 most-recently persisted ids; keys that fall off the index are deleted so
// storage cannot grow without bound. Older mbx:core:<id> entries are simply
// never read again.

const CORE_STORAGE_PREFIX = "mbx:core:v3:";
const CORE_STORAGE_INDEX_KEY = `${CORE_STORAGE_PREFIX}__index`;
const CORE_STORAGE_MAX = 30;

function persistCore(id: string, data: CoreDetails) {
  if (typeof window === "undefined") return;
  try {
    let index: string[] = [];
    try {
      const parsed: unknown = JSON.parse(sessionStorage.getItem(CORE_STORAGE_INDEX_KEY) || "[]");
      if (Array.isArray(parsed)) {
        index = parsed.filter((x): x is string => typeof x === "string");
      }
    } catch {
      index = []; // unreadable index: rebuild it from scratch
    }
    // Most-recent-first, deduped, capped; evicted ids lose their storage keys.
    const next = [id, ...index.filter((x) => x !== id)].slice(0, CORE_STORAGE_MAX);
    for (const evicted of index) {
      if (!next.includes(evicted)) {
        sessionStorage.removeItem(CORE_STORAGE_PREFIX + evicted);
      }
    }
    sessionStorage.setItem(CORE_STORAGE_PREFIX + id, JSON.stringify(data));
    sessionStorage.setItem(CORE_STORAGE_INDEX_KEY, JSON.stringify(next));
  } catch {
    /* storage full or unavailable: ignore, in-memory cache still works */
  }
}

function loadPersistedCore(id: string): CoreDetails | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CORE_STORAGE_PREFIX + id);
    return raw ? (JSON.parse(raw) as CoreDetails) : null;
  } catch {
    return null;
  }
}

function buildDetailEndpoint(id: string, type: "movie" | "tv" = "movie"): string {
  if (id.startsWith("http://") || id.startsWith("https://")) return id;
  if (id.startsWith("/details/")) return `${BASE_URL}${id}`;
  if (id.startsWith("details/")) return `${BASE_URL}/${id}`;
  if (id.startsWith("tmdb/")) return `${BASE_URL}/details/${id}`;
  // TMDB IDs are numeric with <= 7 digits (e.g. 860508, 969681, 1621552, 95350, 30984)
  if (/^\d{1,7}$/.test(id)) {
    return `${BASE_URL}/details/tmdb/${id}?type=${type}`;
  }
  // MovieBox subject IDs (18-19 digits) or slug paths
  return `${BASE_URL}/details/${encodeURIComponent(id)}`;
}

function buildDownloadEndpoint(id: string, season = 0, episode = 0, type: "movie" | "tv" = "movie"): string {
  let path = id;
  // TMDB IDs are numeric with <= 7 digits
  if (/^\d{1,7}$/.test(path)) {
    const s = season > 0 ? `&season=${season}` : "";
    const e = episode > 0 ? `&episode=${episode}` : "";
    return `${BASE_URL}/download/tmdb/${path}?type=${type}${s}${e}`;
  }
  if (path.startsWith("/details/")) path = path.replace("/details/", "/download/");
  else if (path.startsWith("details/")) path = path.replace("details/", "download/");
  else if (path.startsWith("tmdb/")) path = `/download/${path}`;
  else if (!path.startsWith("/download/") && !path.startsWith("download/")) path = `/download/${encodeURIComponent(path)}`;
  if (!path.startsWith("/")) path = `/${path}`;
  const sep = path.includes("?") ? "&" : "?";
  return `${BASE_URL}${path}${sep}season=${season}&episode=${episode}`;
}

export function extractSlugHash(id: string): string {
  if (!id) return "";
  const clean = String(id).split("?")[0].trim();
  if (/^\d+$/.test(clean)) return clean;
  const parts = clean.split("-");
  return parts[parts.length - 1] || clean;
}

export function matchesDubId(dub: any, currentId: string): boolean {
  if (!dub || !currentId) return false;
  const clean = String(currentId).split("?")[0].trim();
  const dPath = String(dub.detail_path || dub.detailPath || "").trim();
  const dSub = String(dub.subject_id || dub.subjectId || "").trim();
  if (clean === dPath || clean === dSub) return true;
  const currentHash = extractSlugHash(clean);
  const pathHash = extractSlugHash(dPath);
  if (currentHash && pathHash && currentHash === pathHash) return true;
  if (currentHash && dSub && currentHash === dSub) return true;
  return false;
}

// ---------- synchronous cache getters ----------

export function getCachedCore(id: string): CoreDetails | null {
  const cached = coreCache.get(id);
  if (cached) return cached;
  const persisted = loadPersistedCore(id);
  if (persisted) {
    coreCache.set(id, persisted); // hydrate in-memory cache (refreshes recency)
    return persisted;
  }
  return null;
}

export function getCachedTmdb(id: string): TmdbEnrichment | null {
  return tmdbCache.get(id) ?? null;
}

export function getCachedRecs(id: string): any[] | null {
  return recsCache.get(id) ?? null;
}

// ---------- fetchers (deduped) ----------

export function fetchCore(id: string, type: "movie" | "tv" = "movie"): Promise<CoreDetails> {
  const cached = getCachedCore(id);
  if (cached) return Promise.resolve(cached);

  if (!pendingCore[id]) {
    pendingCore[id] = (async () => {
      const res = await fetch(buildDetailEndpoint(id, type));
      if (!res.ok) throw new Error("Failed to fetch details");
      const json = await res.json();

      const apiCast = Array.isArray(json?.cast) && json.cast.length > 0 ? json.cast : [];
      const apiStars = Array.isArray(json?.data?.stars) && json.data.stars.length > 0 ? json.data.stars : [];
      const rawCast = apiCast.length > 0 ? apiCast : apiStars;
      const castList = rawCast.map((c: any) => ({
        staffId: String(c.id || c.staffId || c.name || ""),
        name: c.name || "",
        character: c.character ? c.character.replace(/\s*\(voice\)/gi, "").trim() : "Cast",
        avatarUrl: c.profile_image || c.profile || c.avatarUrl || (c.profile_path ? (c.profile_path.startsWith("http") ? c.profile_path : `https://image.tmdb.org/t/p/w185${c.profile_path}`) : ""),
      }));

      const backdropUrl = json?.backdrop || json?.backdrop_w780 || json?.data?.subject?.cover?.url || null;
      const logoUrl = json?.logo_w500 || json?.logo || null;
      const logoW500Url = json?.logo_w500 || json?.logo || null;
      const posterUrl = json?.poster || json?.poster_w500 || json?.data?.subject?.cover?.url || null;
      const tmdbId = json?.tmdb_id ? Number(json.tmdb_id) : (typeof json?.id === "number" ? json.id : null);
      const isTv = json?.media_type === "tv" || type === "tv" || json?.data?.subject?.subjectType === 2 || Array.isArray(json?.seasons) || (json?.total_seasons && json.total_seasons > 0);

      // Prioritize top-level clean API structure over legacy data.subject
      const title = json?.title || json?.name || json?.data?.subject?.title || "";
      const description = json?.overview || json?.description || json?.tagline || json?.data?.subject?.description || "";
      const releaseDate = json?.release_date || json?.releaseDate || json?.data?.subject?.releaseDate || "";
      const duration = json?.runtime ? json.runtime * 60 : (json?.runtime_minutes ? json.runtime_minutes * 60 : (json?.data?.subject?.duration || 0));
      const genre = Array.isArray(json?.genres) ? json.genres.join(", ") : (json?.genre || json?.data?.subject?.genre || "");
      const rating = json?.rating ? String(json.rating) : (json?.data?.subject?.imdbRatingValue || "0");

      const subject = {
        subjectId: tmdbId || json?.id || json?.data?.subject?.subjectId || id,
        title,
        description,
        releaseDate,
        duration,
        genre,
        imdbRatingValue: rating,
        cover: { url: posterUrl || backdropUrl },
        stills: { url: backdropUrl || posterUrl },
        detailPath: json?.detail_path || id,
        countryName: json?.countryName || json?.data?.subject?.countryName || "",
        subjectType: isTv ? 2 : 1,
        hasResource: json?.data?.subject?.hasResource ?? true,
        trailer: json?.data?.subject?.trailer || (json?.trailer ? { videoAddress: { url: json.trailer } } : null),
        postList: json?.data?.postList,
        accessStrategy: json?.data?.accessStrategy,
      };

      const rawDubs =
        (Array.isArray(json?.dubs) && json.dubs.length > 0 ? json.dubs : null) ||
        (Array.isArray(json?.data?.subject?.dubs) && json.data.subject.dubs.length > 0 ? json.data.subject.dubs : null) ||
        (Array.isArray(json?.subject?.dubs) && json.subject.dubs.length > 0 ? json.subject.dubs : null) ||
        (Array.isArray(json?.data?.dubs) && json.data.dubs.length > 0 ? json.data.dubs : null) ||
        [];

      const normalizedDubs = rawDubs.map((d: any) => {
        const subjectId = String(d.subjectId || d.subject_id || "");
        const detailPath = String(d.detailPath || d.detail_path || "");
        const rawName = d.lanName || d.language_name || d.language || "Audio";
        const code = d.lanCode || d.language_code || "";
        const isOriginal = Boolean(d.original || d.is_original || /original/i.test(rawName));
        const isSub = d.type === 1 || /\bsub\b/i.test(rawName);
        const isDub = d.type === 0 || (!d.type && !isSub);

        let cleanName = rawName;
        if (/hindi/i.test(rawName)) cleanName = "Hindi";
        else if (isOriginal) cleanName = "Original Audio";
        else cleanName = rawName.replace(/\bdub\b/gi, "").trim() || rawName;

        return {
          ...d,
          subject_id: subjectId,
          subjectId: subjectId,
          detail_path: detailPath,
          detailPath: detailPath,
          language_name: rawName,
          lanName: rawName,
          language: cleanName,
          displayName: cleanName,
          language_code: code,
          lanCode: code,
          is_original: isOriginal,
          original: isOriginal,
          type: typeof d.type === "number" ? d.type : (isSub ? 1 : 0),
          isSub,
          isDub,
        };
      });

      const data: CoreDetails = {
        movie: subject,
        cast: castList,
        seasons: json?.seasons || null,
        episodes: Array.isArray(json?.episodes) ? json.episodes : undefined,
        dubs: normalizedDubs,
        backdropUrl,
        logoUrl: logoW500Url || logoUrl,
        logoW500Url,
        posterUrl,
        tmdbId,
        logos: json?.logos || [],
        trailer: json?.trailer || null,
        tagline: json?.tagline || null,
        totalSeasons: json?.total_seasons || null,
        totalEpisodes: json?.total_episodes || null,
      };

      coreCache.set(id, data);
      persistCore(id, data);

      // Instant TMDB cache prime directly from API payload
      if (backdropUrl || logoUrl || tmdbId) {
        const existing = tmdbCache.get(id);
        tmdbCache.set(id, {
          backdropUrl: backdropUrl || existing?.backdropUrl || null,
          titledBackdropUrl: existing?.titledBackdropUrl || null,
          logoUrl: logoW500Url || logoUrl || existing?.logoUrl || null,
          meta: existing?.meta || (tmdbId ? {
            id: tmdbId,
            name: subject?.title,
            logo_url: logoW500Url || logoUrl,
            cast: castList,
            overview: subject?.description,
            episodes: Array.isArray(json?.episodes) ? json.episodes : undefined,
          } : null),
        });
      }

      return data;
    })();
    // Clean up the pending entry once settled so failures can be retried
    pendingCore[id].catch(() => {}).finally(() => {
      delete pendingCore[id];
    });
  }
  return pendingCore[id];
}

export function fetchTmdb(
  id: string,
  type: "movie" | "tv",
  title: string
): Promise<TmdbEnrichment> {
  const cached = tmdbCache.get(id);
  // If we already have logo, backdrop, and cast cached, avoid TMDB roundtrip
  if (cached && (cached.logoUrl || cached.titledBackdropUrl) && cached.backdropUrl && cached.meta?.cast) {
    return Promise.resolve(cached);
  }

  if (!pendingTmdb[id]) {
    pendingTmdb[id] = (async () => {
      let result: TmdbEnrichment = { backdropUrl: null, titledBackdropUrl: null, logoUrl: null, meta: null };
      try {
        if (type === "movie") {
          const { searchMovie } = await import("@/services/tmdb");
          const meta = await searchMovie(title);
          result = {
            backdropUrl: meta?.backdrop_url || null,
            titledBackdropUrl: meta?.titled_backdrop_url || null,
            logoUrl: meta?.logo_url || null,
            meta,
          };
        } else {
          const { searchTVShow } = await import("@/services/tmdb");
          const meta = await searchTVShow(title);
          result = {
            backdropUrl: meta?.backdrop_url || null,
            titledBackdropUrl: meta?.titled_backdrop_url || null,
            logoUrl: meta?.logo_url || null,
            meta,
          };
        }
      } catch (e) {
        console.error("TMDB enrichment failed:", e);
      }
      // Merge with existing API values if any
      const existing = tmdbCache.get(id);
      const merged: TmdbEnrichment = {
        backdropUrl: result.backdropUrl || existing?.backdropUrl || null,
        titledBackdropUrl: result.titledBackdropUrl || existing?.titledBackdropUrl || null,
        logoUrl: result.logoUrl || existing?.logoUrl || null,
        meta: result.meta || existing?.meta || null,
      };
      if (merged.backdropUrl || merged.logoUrl || merged.meta) {
        tmdbCache.set(id, merged);
      }
      return merged;
    })();
    pendingTmdb[id].catch(() => {}).finally(() => {
      delete pendingTmdb[id];
    });
  }
  return pendingTmdb[id];
}

export function fetchRecs(id: string): Promise<any[]> {
  const cached = recsCache.get(id);
  if (cached) return Promise.resolve(cached);

  if (!pendingRecs[id]) {
    pendingRecs[id] = (async () => {
      const res = await fetch(`${BASE_URL}/recommend/${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error("Failed to fetch recommendations");
      const json = await res.json();
      const items = json?.items || [];
      return items.map((r: any) => ({
        id: r.subject_id,
        title: r.title,
        poster_path: r.cover_image,
        vote_average: parseFloat(r.imdb_rating || "0"),
        release_date: r.release_date,
        _id: r.detail_path,
        media_type: r.subject_type === "TV_SERIES" ? "tv" : "movie",
      }));
    })();
    pendingRecs[id]
      .then((mapped) => {
        recsCache.set(id, mapped);
      })
      .catch(() => {})
      .finally(() => {
        delete pendingRecs[id];
      });
  }
  return pendingRecs[id];
}

// ---------- prefetch & predictive pre-warming ----------

// Tracks ids already warmed this session. Capped FIFO (~100 ids) so long
// sessions cannot grow it without bound; ids are removed when their prefetch
// fails so a later hover can retry.
const prefetched = new Set<string>();
const PREFETCHED_MAX = 100;

/**
 * Warms the cache for a detail page and predicts streaming requirements.
 * Safe to call repeatedly (hover events): it only triggers network once per id.
 */
export function prefetchDetails(id: string, type: "movie" | "tv") {
  if (!id || prefetched.has(id)) return;
  prefetched.add(id);
  while (prefetched.size > PREFETCHED_MAX) {
    const oldest = prefetched.values().next();
    if (oldest.done) break;
    prefetched.delete(oldest.value);
  }

  fetchCore(id, type)
    .then((core) => {
      if (core?.movie?.title && (!core.backdropUrl || !core.logoUrl || !core.tmdbId)) {
        fetchTmdb(id, type, core.movie.title).catch(() => {});
      }
      // Predictive Async Pre-warming:
      // Start warming the video stream links in background so watch page is instant
      if (type === "movie") {
        fetchDownload(id, 0, 0, "movie").catch(() => {});
      } else {
        fetchDownload(id, 1, 1, "tv").catch(() => {});
      }
    })
    .catch(() => {
      prefetched.delete(id);
    });

  fetchRecs(id).catch(() => {});
}

// ---------- download / stream links (per id + season + episode) ----------
// Same bounded LRU as above, with a shorter TTL since stream links are more
// volatile than details.

const pendingDownloads: Record<string, Promise<any[]>> = {};

function downloadKey(id: string, season: number, episode: number) {
  return `${id}:${season}:${episode}`;
}

export function getCachedDownload(id: string, season: number, episode: number): any[] | null {
  return downloadCache.get(downloadKey(id, season, episode)) ?? null;
}

const seasonEpisodesCache = createLruCache<any[]>(50, 15 * 60 * 1000);
const pendingSeasonEpisodes: Record<string, Promise<any[]>> = {};

export function getCachedSeasonEpisodes(id: string, season: number): any[] | null {
  return seasonEpisodesCache.get(`${id}:season:${season}`) ?? null;
}

export function fetchSeasonEpisodes(
  id: string,
  season: number,
  tmdbId?: number
): Promise<any[]> {
  const key = `${id}:season:${season}`;
  const cached = seasonEpisodesCache.get(key);
  if (cached) return Promise.resolve(cached);

  if (!pendingSeasonEpisodes[key]) {
    pendingSeasonEpisodes[key] = (async () => {
      // 1. Try direct API endpoint with ?season={season}
      try {
        const endpoint = buildDetailEndpoint(id, "tv");
        const sep = endpoint.includes("?") ? "&" : "?";
        const res = await fetch(`${endpoint}${sep}season=${season}`);
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json?.episodes) && json.episodes.length > 0) {
            seasonEpisodesCache.set(key, json.episodes);
            return json.episodes;
          }
        }
      } catch (e) {
        console.warn("Direct API season fetch failed, trying fallback:", e);
      }

      // 2. Try TMDB fallback
      if (tmdbId) {
        try {
          const { getSeasonEpisodes } = await import("@/services/tmdb");
          const eps = await getSeasonEpisodes(tmdbId, season);
          if (Array.isArray(eps) && eps.length > 0) {
            seasonEpisodesCache.set(key, eps);
            return eps;
          }
        } catch (e) {
          console.warn("TMDB season fetch fallback failed:", e);
        }
      }

      return [];
    })();

    pendingSeasonEpisodes[key].catch(() => {}).finally(() => {
      delete pendingSeasonEpisodes[key];
    });
  }

  return pendingSeasonEpisodes[key];
}

export function getCachedSubtitles(id: string, season: number, episode: number): any[] | null {
  return subtitlesCache.get(downloadKey(id, season, episode)) ?? null;
}

export function fetchDownload(id: string, season: number, episode: number, type: "movie" | "tv" = "movie"): Promise<any[]> {
  const key = downloadKey(id, season, episode);
  const cached = downloadCache.get(key);
  if (cached) return Promise.resolve(cached);

  if (!pendingDownloads[key]) {
    pendingDownloads[key] = (async () => {
      const res = await fetch(buildDownloadEndpoint(id, season, episode, type));
      if (!res.ok) throw new Error("Failed to fetch download links");
      const json = await res.json();
      let rawFiles = json?.files || [];
      const rawSubs = json?.subtitles || [];
      let files = rawFiles
        .filter((f: any) => Boolean(f?.stream_link && typeof f.stream_link === "string" && f.stream_link.trim() !== ""))
        .sort((a: any, b: any) => (b.resolution_value || 0) - (a.resolution_value || 0));

      // Continuous series fallback: If season > 1 and 0 files were returned, check if backend uses continuous season 1 numbering (like Naruto)
      if (files.length === 0 && season > 1 && type === "tv") {
        try {
          const core = await fetchCore(id, "tv");
          const seasonsList = Array.isArray(core.seasons)
            ? core.seasons
            : (Array.isArray((core.seasons as any)?.seasons) ? (core.seasons as any).seasons : []);

          let cumulative = 0;
          for (let i = 0; i < season - 1 && i < seasonsList.length; i++) {
            const epCount = seasonsList[i].episode_count ?? seasonsList[i].maxEp ?? seasonsList[i].episodes_count ?? 0;
            cumulative += epCount;
          }

          if (cumulative > 0) {
            const absEp = cumulative + episode;
            const res2 = await fetch(buildDownloadEndpoint(id, 1, absEp, "tv"));
            if (res2.ok) {
              const json2 = await res2.json();
              const rawFiles2 = json2?.files || [];
              const files2 = rawFiles2
                .filter((f: any) => Boolean(f?.stream_link && typeof f.stream_link === "string" && f.stream_link.trim() !== ""))
                .sort((a: any, b: any) => (b.resolution_value || 0) - (a.resolution_value || 0));
              if (files2.length > 0) {
                files = files2;
                if (json2?.subtitles?.length > 0) {
                  subtitlesCache.set(key, json2.subtitles);
                }
              }
            }
          }
        } catch (err) {
          console.warn("Continuous series download fallback failed:", err);
        }
      }
      
      downloadCache.set(key, files);
      if (rawSubs.length > 0) {
        subtitlesCache.set(key, rawSubs);
      }
      if (files.length > 0 && files[0]?.stream_link) {
        preloadMediaStream(files[0].stream_link);
      }
      return files;
    })();
    pendingDownloads[key].catch(() => {}).finally(() => {
      delete pendingDownloads[key];
    });
  }
  return pendingDownloads[key];
}

const preloadedStreamUrls = new Set<string>();

/**
 * Pre-warms CDN connection and buffers MP4 metadata/headers into browser cache.
 */
export function preloadMediaStream(url: string) {
  if (typeof window === "undefined" || !url || preloadedStreamUrls.has(url)) return;
  preloadedStreamUrls.add(url);

  try {
    const host = new URL(url).origin;
    if (!document.querySelector(`link[rel="preconnect"][href="${host}"]`)) {
      const link = document.createElement("link");
      link.rel = "preconnect";
      link.href = host;
      link.crossOrigin = "anonymous";
      document.head.appendChild(link);
    }
  } catch {}

  try {
    const v = document.createElement("video");
    v.preload = "auto";
    v.muted = true;
    const proxiedUrl = (url.includes("hakunaymatata.com") || url.includes("aoneroom.com"))
      ? `/api/proxy?url=${encodeURIComponent(url)}`
      : url;
    v.src = proxiedUrl;
    const cleanUp = () => {
      v.src = "";
      v.remove();
    };
    v.onloadedmetadata = () => {
      setTimeout(cleanUp, 15000);
    };
    v.onerror = cleanUp;
    setTimeout(cleanUp, 20000);
  } catch {}
}

/**
 * Warms the streaming links for a title in background so the watch page can open instantly.
 */
export function prefetchDownload(id: string, season: number, episode: number, type: "movie" | "tv" = "movie") {
  if (!id) return;
  fetchDownload(id, season, episode, type).catch(() => {});
}

/**
 * Pre-warms streaming links for all available audio dubs in parallel.
 * When the user switches language, the stream is already cached in memory for instantaneous playback.
 */
export function prefetchAllDubs(
  dubs: any[],
  season: number,
  episode: number,
  type: "movie" | "tv" = "movie"
) {
  // Let the backend handle pre-warming server-side without flooding the browser network pipe.
  // At most prefetch only 1 alternate popular dub if needed, using a relaxed timeout.
  if (!Array.isArray(dubs) || dubs.length <= 1) return;
  const firstAlt = dubs.find((d: any) => {
    const name = String(d.displayName || d.language || "").toLowerCase();
    return name.includes("hindi") || name.includes("english");
  }) || dubs[0];
  const dubId = String(firstAlt?.detail_path || firstAlt?.detailPath || firstAlt?.subject_id || firstAlt?.subjectId || "");
  if (dubId && typeof window !== "undefined") {
    setTimeout(() => {
      prefetchDownload(dubId, season, episode, type);
    }, 2500);
  }
}

/**
 * Explicit helper for Predictive Async Pre-warming on detail pages.
 */
export function warmDetailStreams(id: string, isTv: boolean, season = 1, episode = 1) {
  if (!id) return;
  if (isTv) {
    prefetchDownload(id, season, episode, "tv");
  } else {
    prefetchDownload(id, 0, 0, "movie");
  }
}