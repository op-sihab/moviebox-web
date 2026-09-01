const BASE_URL = process.env.API_URL || "https://movie-api.opsihab.tech";

export async function getHomepage() {
  const res = await fetch(`${BASE_URL}/homepage`, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error("Failed to fetch homepage");
  return res.json();
}

export async function searchContent(
  query: string,
  typeOrSignal: string | AbortSignal = "all",
  pageOrSignal: number | AbortSignal = 1,
  signalParam?: AbortSignal
) {
  let type = "all";
  let page = 1;
  let signal: AbortSignal | undefined = undefined;

  if (typeOrSignal instanceof AbortSignal) {
    signal = typeOrSignal;
  } else if (typeof typeOrSignal === "string") {
    type = typeOrSignal;
  }

  if (pageOrSignal instanceof AbortSignal) {
    signal = pageOrSignal;
  } else if (typeof pageOrSignal === "number") {
    page = pageOrSignal;
  }

  if (signalParam instanceof AbortSignal) {
    signal = signalParam;
  }

  const res = await fetch(
    `${BASE_URL}/search?q=${encodeURIComponent(query)}&type=${type}&page=${page}`,
    { signal }
  );
  if (!res.ok) throw new Error("Failed to search");
  return res.json();
}

export function buildDetailEndpoint(id: string, type: "movie" | "tv" = "movie"): string {
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

export async function getDetails(detailPath: string, type: "movie" | "tv" = "movie") {
  const url = buildDetailEndpoint(detailPath, type);
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch details");
  return res.json();
}

export async function getDownloadLinks(detailPath: string, season = 0, episode = 0) {
  const res = await fetch(`${BASE_URL}/download/${encodeURIComponent(detailPath)}?season=${season}&episode=${episode}`);
  if (!res.ok) throw new Error("Failed to fetch download links");
  return res.json();
}

export async function getRecommendations(detailPath: string) {
  const res = await fetch(`${BASE_URL}/recommend/${encodeURIComponent(detailPath)}`);
  if (!res.ok) throw new Error("Failed to fetch recommendations");
  return res.json();
}

export async function getStreamSources(subjectId: string | number, se = 1, ep = 1) {
  const res = await fetch(`${BASE_URL}/api/stream/${encodeURIComponent(subjectId)}?se=${se}&ep=${ep}`);
  if (!res.ok) throw new Error("Failed to fetch stream sources");
  return res.json();
}

export async function getCaptions(subjectId: string | number, se = 1, ep = 1) {
  const res = await fetch(`${BASE_URL}/api/stream/${encodeURIComponent(subjectId)}/captions?se=${se}&ep=${ep}`);
  if (!res.ok) throw new Error("Failed to fetch captions");
  return res.json();
}

export async function getSearchSuggestions(query: string) {
  if (!query || query.trim().length === 0) return { suggestions: [] };
  const res = await fetch(`${BASE_URL}/search/suggest?q=${encodeURIComponent(query.trim())}`);
  if (!res.ok) throw new Error("Failed to fetch suggestions");
  return res.json();
}

/**
 * Maps a raw homepage/search subject into the shape MovieCard expects.
 */
export function mapSubject(s: any) {
  if (!s) return null;
  const isTv =
    s.media_type === "tv" ||
    s.subjectType === 2 ||
    s.subject_type === "TV_SERIES" ||
    s.subject_type === 2 ||
    (s.total_seasons && s.total_seasons > 0);

  // Clean single-segment ID so Next.js dynamic routes /movie/[id] and /tv/[id] never 404
  let cleanId = "";
  if (s.detail_url) cleanId = s.detail_url;
  else if (s.detailPath) cleanId = s.detailPath;
  else if (s.slug) cleanId = s.slug;
  else if (s.tmdb_id) cleanId = String(s.tmdb_id);
  else if (s.id) cleanId = String(s.id);
  else if (s.subjectId || s.subject_id) cleanId = String(s.subjectId || s.subject_id);

  if (cleanId.includes("/details/")) {
    cleanId = cleanId.split("/details/").pop() || cleanId;
  }
  if (cleanId.startsWith("tmdb/")) {
    cleanId = cleanId.replace(/^tmdb\//, "");
  }
  cleanId = cleanId.split("?")[0];

  const logoUrl = s.logo_w500 || s.logo || s.logo_url || null;
  const backdropUrl = s.backdrop || s.banner_image || s.backdrop_w780 || s.backdrop_path || null;
  const posterUrl = s.poster_url || s.poster || s.poster_w500 || s.cover?.url || s.cover_image || s.poster_path || null;

  return {
    id: s.tmdb_id || s.id || s.subjectId || s.subject_id,
    title: s.title || s.name || s.original_title || "",
    poster_path: posterUrl,
    poster: posterUrl,
    poster_w500: s.poster_w500 || posterUrl,
    backdrop_path: backdropUrl,
    backdrop: backdropUrl,
    backdrop_w780: s.backdrop_w780 || backdropUrl,
    vote_average:
      typeof s.rating === "number"
        ? s.rating
        : parseFloat(s.rating || s.imdbRatingValue || s.vote_average || "0"),
    release_date: s.release_date || s.releaseDate,
    _id: cleanId,
    media_type: isTv ? "tv" : "movie",
    subjectType: isTv ? 2 : 1,
    overview: s.overview || s.description || "",
    logo_url: logoUrl,
    logo: logoUrl,
    logo_w500: s.logo_w500 || logoUrl,
    badge: s.badge || "",
  };
}

/**
 * Returns the homepage carousel blocks (title + subjects), normalized.
 * Used by the browse pages (Movies / TV / New & Popular).
 */
export async function getBrowseSections() {
  const data = await getHomepage();

  // 1. New API format: data.sections
  if (Array.isArray(data?.sections) && data.sections.length > 0) {
    return data.sections
      .filter(
        (sec: any) =>
          sec.section?.toLowerCase() !== "banner" &&
          sec.title?.toLowerCase() !== "banner" &&
          Array.isArray(sec.items) &&
          sec.items.length > 0
      )
      .map((sec: any) => {
        const rawTitle = sec.section || sec.title || "Featured";
        return {
          title: rawTitle.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "").trim(),
          rawTitle,
          subjects: sec.items.map(mapSubject).filter(Boolean),
        };
      });
  }

  // 2. Legacy API format: data.data.operatingList
  const operatingList = data?.data?.operatingList || [];
  return operatingList
    .filter(
      (op: any) =>
        (op.type === "SUBJECTS_MOVIE" || op.type === "CUSTOM") &&
        op.subjects &&
        op.subjects.length > 0
    )
    .map((op: any) => ({
      title: (op.title || "").replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "").trim(),
      rawTitle: op.title,
      subjects: op.subjects.map(mapSubject).filter(Boolean),
    }));
}
