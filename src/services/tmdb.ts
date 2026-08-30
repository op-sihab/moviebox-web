const TMDB_API_KEY =
  process.env.TMDB_API_KEY ||
  process.env.NEXT_PUBLIC_TMDB_API_KEY ||
  "0ded8ddd0719ef0f717a6a5343f2a348";


export interface TMDBShowMetadata {
  id: number;
  name: string;
  backdrop_url: string | null;
  poster_url: string | null;
  logo_url: string | null;
  vote_average: number;
  overview: string;
}

export interface TMDBEpisode {
  episode_number: number;
  name: string;
  overview: string;
  still_path: string | null;
  runtime: number | null;
  air_date: string | null;
}

/**
 * Cleans language tags, season/episode indicators, and other modifiers
 * from show titles for accurate TMDB searches.
 *
 * Examples:
 *   "The Boys [Hindi] S1-S5"       → "The Boys"
 *   "Breaking Bad (Season 3)"      → "Breaking Bad"
 *   "Naruto S01E05 [Bengali]"      → "Naruto"
 *   "Loki Season 1-2"              → "Loki"
 *   "Wednesday Complete Series"    → "Wednesday"
 */
export function cleanTitle(title: string): string {
  return title
    .replace(/\[.*?\]/g, "")                    // Remove bracketed tags like [Hindi], [Anime]
    .replace(/\(.*?\)/g, "")                    // Remove parenthesized text like (Season 1), (2024)
    .replace(/\bS\d+[\s\-]*E?\d*[\s\-]*S?\d*/gi, "")  // Remove S1, S1-S5, S01E05, S1-S3E10 etc.
    .replace(/\bSeason\s*\d+[\s\-]*\d*/gi, "")  // Remove "Season 1", "Season 1-3"
    .replace(/\bComplete\s*(Series|Season|Collection)?\b/gi, "") // Remove "Complete Series" etc.
    .replace(/\s{2,}/g, " ")                    // Collapse multiple spaces into one
    .trim();
}

/**
 * Normalizes a title string for comparison by lowercasing, removing punctuation/hyphens,
 * and collapsing whitespace. This allows fuzzy matching between titles like
 * "Spider Man Noir" and "Spider-Noir".
 */
function normalizeForComparison(str: string): string {
  return str
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

  // Direct containment check (normalized)
  if (normMatch.includes(normQuery) || normQuery.includes(normMatch)) {
    return true;
  }

  // Word overlap check — at least 50% of the shorter title's words must appear in the longer one
  const queryWords = normQuery.split(" ").filter(w => w.length > 1);
  const matchWords = normMatch.split(" ").filter(w => w.length > 1);

  const shorter = queryWords.length <= matchWords.length ? queryWords : matchWords;
  const longer = queryWords.length > matchWords.length ? queryWords : matchWords;

  const overlapCount = shorter.filter(word => longer.includes(word)).length;
  const overlapRatio = overlapCount / shorter.length;

  // Need at least 60% word overlap to consider it a match
  return overlapRatio >= 0.6;
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

    // Fetch title logo concurrently
    const logoUrl = await getTitleLogo(bestMatch.id, "tv");

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

    // Fetch title logo concurrently
    const logoUrl = await getTitleLogo(bestMatch.id, "movie");

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
    };
  } catch (err) {
    console.error("TMDB Movie Search Error:", err);
    return null;
  }
}
