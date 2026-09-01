/**
 * Image optimization via wsrv.nl (free Cloudflare-backed image CDN/proxy).
 *
 * Why: MovieBox (aoneroom) and TMDB serve large, unoptimized JPG/PNG files
 * (often 400KB-1MB+). Routing them through wsrv.nl lets us:
 *   - Resize to the exact display width (no oversized downloads)
 *   - Convert to WebP (typically 5-10x smaller than the source JPG)
 *   - Serve from Cloudflare's global edge cache (cache hits are ~100-150ms)
 *
 * Docs: https://wsrv.nl/docs/
 */

const WSRV_BASE = "https://wsrv.nl/";

type ImagePreset = "poster" | "backdrop" | "hero" | "avatar" | "still" | "logo";

interface PresetConfig {
  width: number;
  quality: number;
  /** Output format. WebP supports alpha, so it is safe for transparent logos too. */
  format: "webp" | "png";
}

const PRESETS: Record<ImagePreset, PresetConfig> = {
  poster: { width: 360, quality: 82, format: "webp" },   // grid/carousel cards
  backdrop: { width: 1280, quality: 78, format: "webp" }, // detail page banner
  hero: { width: 1920, quality: 78, format: "webp" },     // homepage hero
  avatar: { width: 120, quality: 80, format: "webp" },    // cast circles
  still: { width: 400, quality: 78, format: "webp" },     // episode thumbnails
  logo: { width: 500, quality: 90, format: "webp" },      // title treatment (alpha preserved)
};

/**
 * Returns true for URLs we should NOT proxy (local assets, data URIs, blobs,
 * or values that are already wsrv links).
 */
function shouldSkip(url: string): boolean {
  if (!url) return true;
  if (url.startsWith("/")) return true;            // local /placeholder.png etc.
  if (url.startsWith("data:")) return true;        // inline data URIs
  if (url.startsWith("blob:")) return true;        // object URLs
  if (url.includes("wsrv.nl")) return true;        // already optimized
  if (url.includes("image.tmdb.org")) return true; // direct high-speed TMDB CDN
  return false;
}

/**
 * Wraps an image URL with wsrv.nl using the given preset.
 * Falls back to the original URL if it shouldn't/can't be proxied.
 *
 * @param url     The source image URL (http/https or protocol-relative //...)
 * @param preset  Sizing/quality profile based on where the image is shown
 */
export function optimizeImage(
  url: string | null | undefined,
  preset: ImagePreset = "poster"
): string {
  if (!url) return "/placeholder.png";
  if (shouldSkip(url)) return url;

  const cfg = PRESETS[preset];

  // wsrv accepts the source as a query param. Strip the leading protocol for a
  // cleaner key (wsrv adds https:// automatically), and encode it.
  const cleaned = url.replace(/^https?:\/\//, "").replace(/^\/\//, "");
  const params = new URLSearchParams({
    url: cleaned,
    w: String(cfg.width),
    q: String(cfg.quality),
    output: cfg.format,
    // Resize behaviour: "fit=cover" + scale down only, never upscale small sources.
    we: "", // "without enlargement" — keeps tiny images crisp instead of stretching
  });

  return `${WSRV_BASE}?${params.toString()}`;
}

/**
 * Convenience helpers for readability at call sites.
 */
export const img = {
  poster: (u?: string | null) => optimizeImage(u, "poster"),
  backdrop: (u?: string | null) => optimizeImage(u, "backdrop"),
  hero: (u?: string | null) => optimizeImage(u, "hero"),
  avatar: (u?: string | null) => optimizeImage(u, "avatar"),
  still: (u?: string | null) => optimizeImage(u, "still"),
  logo: (u?: string | null) => optimizeImage(u, "logo"),
};
