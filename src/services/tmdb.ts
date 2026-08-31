const TMDB_API_KEY =
  process.env.TMDB_API_KEY ||
  process.env.NEXT_PUBLIC_TMDB_API_KEY ||
  "0ded8ddd0719ef0f717a6a5343f2a348";


export interface TMDBSeasonSummary {
  season_number: number;
  name: string;
  episode_count: number;
  poster_path?: string | null;
  overview?: string;
}

export interface TMDBCastMember {
  staffId: string;
  name: string;
  character: string;
  avatarUrl: string;
}

export interface TMDBShowMetadata {
  id: number;
  name: string;
  backdrop_url: string | null;
  poster_url: string | null;
  logo_url: string | null;
  vote_average: number;
  overview: string;
  seasons?: TMDBSeasonSummary[];
  cast?: TMDBCastMember[];
}

export interface TMDBEpisode {
  episode_number: number;
  name: string;
  overview: string;
  still_path: string | null;
  runtime: number | null;
  air_date: string | null;
}

export { buildSeasonMapping } from "./seasonMapper";
export type { SeasonMapping, MappedSeason } from "./seasonMapper";

export function cleanTitle(title: string): string {
  if (!title) return "";
  return title
    .replace(/\[.*?\]/g, " ")                    // Remove bracketed tags like [Hindi], [Dual Audio], [Anime]
    .replace(/\(.*?\)/g, " ")                    // Remove parenthesized text like (Season 1), (2024), (Hindi Dub)
    .replace(/\bS\d+[\s\-]*(E\d+)?(\s*-\s*S?\d+)?\b/gi, " ")  // Remove S1, S1-S5, S01E05, S1-S3E10 etc.
    .replace(/\bSeason\s*\d+([\s\-]+(to|\-|and)[\s\-]*\d+)?\b/gi, " ")  // Remove "Season 1", "Season 1-3"
    .replace(/\b(Complete\s*(Series|Season|Collection)?|Dual\s*Audio|Multi\s*Audio|Dubbed|Hindi\s*Dub|Bangla\s*Dub|English\s*Dub|Tamil\s*Dub|Telugu\s*Dub)\b/gi, " ")
    .replace(/\b(1080p|720p|480p|4k|uhd|hdrip|webrip|bluray|x264|x265|hevc)\b/gi, " ")
    .replace(/\s{2,}/g, " ")                    // Collapse multiple spaces into one
    .trim();
}

/**
 * Normalizes a title string for comparison by lowercasing, stripping diacritics/accents,
 * removing punctuation/hyphens, and collapsing whitespace.
 */
function normalizeForComparison(str: string): string {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Strip accents like ū -> u, é -> e
    .toLowerCase()
    .replace(/[-:''`]/g, " ")   // Replace hyphens/punctuation with spaces
    .replace(/[^a-z0-9\s]/g, "") // Remove remaining special chars
    .replace(/\s+/g, " ")        // Collapse spaces
    .trim();
}

/**
 * Checks if two titles are similar enough to be considered a valid TMDB match.
 * Uses multiple strategies:
 * 1. Direct containment (after normalization)
 * 2. Word overlap ratio — if most words from the TMDB result appear in the query (or vice versa)
 */
function isTitleMatch(query: string, tmdbTitle: string): boolean {
  const normQuery = normalizeForComparison(query);
  const normMatch = normalizeForComparison(tmdbTitle);

  if (!normQuery || !normMatch) return false;

  // Direct containment check (normalized)
  if (normMatch === normQuery || normMatch.includes(normQuery) || normQuery.includes(normMatch)) {
    return true;
  }

  // Word overlap check
  const queryWords = normQuery.split(" ").filter(w => w.length > 1);
  const matchWords = normMatch.split(" ").filter(w => w.length > 1);

  if (queryWords.length === 0 || matchWords.length === 0) return false;

  const shorter = queryWords.length <= matchWords.length ? queryWords : matchWords;
  const longer = queryWords.length > matchWords.length ? queryWords : matchWords;

  const overlapCount = shorter.filter(word => longer.includes(word)).length;
  const overlapRatio = overlapCount / shorter.length;

  return overlapRatio >= 0.5;
}

/**
 * Fetches the best English title treatment logo for a movie or TV show from TMDB
 * Prefers PNG logos with English language, falls back to any available logo
 */
export async function getTitleLogo(tmdbId: number, type: "movie" | "tv"): Promise<string | null> {
  try {
    const url = `https://api.themoviedb.org/3/${type}/${tmdbId}/images?api_key=${TMDB_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    const logos = data.logos || [];
    if (logos.length === 0) return null;

    // Prefer English PNG logos with good aspect ratio (wide logos look best)
    const enPngLogos = logos.filter(
      (l: any) => l.iso_639_1 === "en" && l.file_path?.endsWith(".png")
    );
    const bestLogo = enPngLogos.length > 0 ? enPngLogos[0] : logos.find((l: any) => l.file_path?.endsWith(".png")) || logos[0];

    if (!bestLogo?.file_path) return null;
    return `https://image.tmdb.org/t/p/w500${bestLogo.file_path}`;
  } catch (err) {
    console.error(`TMDB logo fetch error for ${type}/${tmdbId}:`, err);
    return null;
  }
}

/**
 * Searches TMDB for a TV Series matching the given title and verifies it using a name safeguard
 */
export async function searchTVShow(title: string): Promise<TMDBShowMetadata | null> {
  const query = cleanTitle(title);
  if (!query) return null;

  try {
    const searchUrl = `https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`;
    const res = await fetch(searchUrl);
    if (!res.ok) return null;

    const data = await res.json();
    const results = data.results || [];
    if (results.length === 0) return null;

    // Safeguard: fuzzy title similarity verification
    const bestMatch = results[0];
    
    if (!isTitleMatch(query, bestMatch.name)) {
      console.warn(`TMDB Safeguard mismatch: Tried searching "${query}", matched with "${bestMatch.name}"`);
      return null; // fallback to avoid wrong metadata
    }

    // Fetch title logo, show details (seasons), and credits concurrently
    const [logoUrl, detailsData, creditsData] = await Promise.all([
      getTitleLogo(bestMatch.id, "tv"),
      fetch(`https://api.themoviedb.org/3/tv/${bestMatch.id}?api_key=${TMDB_API_KEY}`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch(`https://api.themoviedb.org/3/tv/${bestMatch.id}/credits?api_key=${TMDB_API_KEY}`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]);

    const rawSeasons = detailsData?.seasons || [];
    const seasons: TMDBSeasonSummary[] = rawSeasons
      .filter((s: any) => s.season_number > 0 && s.episode_count > 0)
      .map((s: any) => ({
        season_number: s.season_number,
        name: s.name || `Season ${s.season_number}`,
        episode_count: s.episode_count,
        poster_path: s.poster_path ? `https://image.tmdb.org/t/p/w500${s.poster_path}` : null,
        overview: s.overview || "",
      }));

    const castList: TMDBCastMember[] = (creditsData?.cast || []).slice(0, 12).map((c: any) => ({
      staffId: String(c.id),
      name: c.name,
      character: c.character ? c.character.replace(/\s*\(voice\)/gi, "").trim() : "Cast",
      avatarUrl: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : "",
    }));

    return {
      id: bestMatch.id,
      name: bestMatch.name,
      backdrop_url: bestMatch.backdrop_path 
        ? `https://image.tmdb.org/t/p/original${bestMatch.backdrop_path}` 
        : null,
      poster_url: bestMatch.poster_path 
        ? `https://image.tmdb.org/t/p/w500${bestMatch.poster_path}` 
        : null,
      logo_url: logoUrl,
      vote_average: bestMatch.vote_average || 0,
      overview: bestMatch.overview || "",
      seasons: seasons.length > 0 ? seasons : undefined,
      cast: castList.length > 0 ? castList : undefined,
    };
  } catch (err) {
    console.error("TMDB TV Search Error:", err);
    return null;
  }
}

/**
 * Fetches episodes metadata for a specific season of a matched TMDB TV Series
 */
export async function getSeasonEpisodes(tmdbId: number, season: number): Promise<TMDBEpisode[]> {
  try {
    const seasonUrl = `https://api.themoviedb.org/3/tv/${tmdbId}/season/${season}?api_key=${TMDB_API_KEY}`;
    const res = await fetch(seasonUrl);
    if (!res.ok) return [];

    const data = await res.json();
    const episodes = data.episodes || [];
    return episodes.map((ep: any) => ({
      episode_number: ep.episode_number,
      name: ep.name || `Episode ${ep.episode_number}`,
      overview: ep.overview || "No description available.",
      still_path: ep.still_path 
        ? `https://image.tmdb.org/t/p/w300${ep.still_path}` 
        : null,
      runtime: ep.runtime || null,
      air_date: ep.air_date || null,
    }));
  } catch (err) {
    console.error(`TMDB Season ${season} fetch error:`, err);
    return [];
  }
}

/**
 * Searches TMDB for a Movie matching the given title and returns its metadata
 */
export async function searchMovie(title: string): Promise<TMDBShowMetadata | null> {
  const query = cleanTitle(title);
  if (!query) return null;

  try {
    const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`;
    const res = await fetch(searchUrl);
    if (!res.ok) return null;

    const data = await res.json();
    const results = data.results || [];
    if (results.length === 0) return null;

    // Safeguard: fuzzy title similarity verification
    const bestMatch = results[0];
    
    if (!isTitleMatch(query, bestMatch.title)) {
      return null;
    }

    // Fetch title logo and credits concurrently
    const [logoUrl, creditsData] = await Promise.all([
      getTitleLogo(bestMatch.id, "movie"),
      fetch(`https://api.themoviedb.org/3/movie/${bestMatch.id}/credits?api_key=${TMDB_API_KEY}`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]);

    const castList: TMDBCastMember[] = (creditsData?.cast || []).slice(0, 12).map((c: any) => ({
      staffId: String(c.id),
      name: c.name,
      character: c.character ? c.character.replace(/\s*\(voice\)/gi, "").trim() : "Cast",
      avatarUrl: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : "",
    }));

    return {
      id: bestMatch.id,
      name: bestMatch.title,
      backdrop_url: bestMatch.backdrop_path 
        ? `https://image.tmdb.org/t/p/original${bestMatch.backdrop_path}` 
        : null,
      poster_url: bestMatch.poster_path 
        ? `https://image.tmdb.org/t/p/w500${bestMatch.poster_path}` 
        : null,
      logo_url: logoUrl,
      vote_average: bestMatch.vote_average || 0,
      overview: bestMatch.overview || "",
      cast: castList.length > 0 ? castList : undefined,
    };
  } catch (err) {
    console.error("TMDB Movie Search Error:", err);
    return null;
  }
}
