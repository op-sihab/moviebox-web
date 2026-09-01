import Carousel from "@/components/Carousel";
import ContinueWatching from "@/components/ContinueWatching";
import { getHomepage, mapSubject } from "@/services/api";
import { searchMovie, searchTVShow } from "@/services/tmdb";
import styles from "./page.module.css";
import Link from "next/link";
import { Play, Info, AlertTriangle, Star } from "lucide-react";
import { img } from "@/services/image";

const HERO_WIDTH = 1920;
const HERO_HEIGHT = 1080;

export default async function Home() {
  // Server-side try/catch: on API failure render an inline error banner
  // (with a client-side retry link) instead of crashing the whole tree.
  let data: any = null;
  let failed = false;
  try {
    data = await getHomepage();
  } catch (err) {
    console.error("Homepage fetch failed:", err);
    failed = true;
  }

  // 1. Extract hero item (Supports both new data.hero_banner and legacy operatingList BANNER)
  let rawHero: any = null;
  if (Array.isArray(data?.hero_banner) && data.hero_banner.length > 0) {
    rawHero = data.hero_banner[0];
  } else {
    const operatingList = data?.data?.operatingList || [];
    const bannerBlock = operatingList.find((op: any) => op.type === "BANNER");
    const banners = bannerBlock?.banner?.items || [];
    rawHero = banners.length > 0 ? banners[0] : null;
  }

  // Normalize hero movie object
  let heroMovie: any = null;
  if (rawHero) {
    const isTv = rawHero.media_type === "tv" || rawHero.subject?.subjectType === 2 || rawHero.subjectType === 2;
    let heroId = String(rawHero.tmdb_id || rawHero.id || rawHero.slug || rawHero.detailPath || "");
    if (rawHero.detail_url) {
      let cleaned = rawHero.detail_url.replace(/^\/details\//, "").replace(/^details\//, "");
      cleaned = cleaned.replace(/^tmdb\//, "").split("?")[0];
      if (cleaned) heroId = cleaned;
    }
    const heroBg = rawHero.backdrop || rawHero.backdrop_w780 || rawHero.image?.url || rawHero.subject?.cover?.url || rawHero.poster;
    let heroLogo = rawHero.logo || rawHero.logo_w500 || null;
    const heroTitle = rawHero.title || rawHero.name || "";
    const heroRating = typeof rawHero.rating === "number" ? rawHero.rating : (rawHero.subject?.imdbRatingValue ? parseFloat(rawHero.subject.imdbRatingValue) : null);
    const heroDate = rawHero.release_date || rawHero.subject?.releaseDate || "";
    let heroOverview = rawHero.overview || rawHero.subject?.description || "";
    const heroGenres = rawHero.genres || (rawHero.subject?.genre ? rawHero.subject.genre.split(",").map((g: string) => g.trim()) : []);

    // Enrich with TMDB fallback only if logo is missing
    if (!heroLogo && heroTitle) {
      try {
        const tmdbMeta = isTv ? await searchTVShow(heroTitle) : await searchMovie(heroTitle);
        if (tmdbMeta?.logo_url) heroLogo = tmdbMeta.logo_url;
        if (!heroOverview && tmdbMeta?.overview) heroOverview = tmdbMeta.overview;
      } catch (err) {
        console.error("Hero TMDB fallback fetch failed:", err);
      }
    }

    heroMovie = {
      id: heroId,
      detailPath: heroId,
      title: heroTitle,
      backdrop: heroBg,
      logoUrl: heroLogo,
      rating: heroRating,
      releaseDate: heroDate,
      overview: heroOverview,
      mediaType: isTv ? "tv" : "movie",
      genres: heroGenres,
    };
  }

  // 2. Extract carousel blocks (Supports both new data.sections and legacy operatingList)
  let carouselBlocks: Array<{ title: string; subjects: any[] }> = [];
  if (Array.isArray(data?.sections) && data.sections.length > 0) {
    carouselBlocks = data.sections
      .filter((sec: any) => Array.isArray(sec.items) && sec.items.length > 0)
      .map((sec: any) => ({
        title: sec.title || "Featured",
        subjects: sec.items.map(mapSubject).filter(Boolean),
      }));
  } else {
    const operatingList = data?.data?.operatingList || [];
    carouselBlocks = operatingList
      .filter(
        (op: any) =>
          (op.type === "SUBJECTS_MOVIE" || op.type === "CUSTOM") &&
          op.subjects &&
          op.subjects.length > 0
      )
      .map((op: any) => ({
        title: (op.title || "").replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "").trim(),
        subjects: op.subjects.map(mapSubject).filter(Boolean),
      }));
  }

  if (failed) {
    return (
      <main className={styles.main}>
        <section className={styles.errorSection}>
          <AlertTriangle className={styles.errorIcon} size={40} />
          <h1 className={styles.errorTitle}>Something went wrong</h1>
          <p className={styles.errorText}>
            We couldn&apos;t load the homepage. Please try again.
          </p>
          <Link href="/" className={styles.retryLink}>
            Try Again
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.main}>
      {heroMovie && (
        <section className={styles.hero}>
          <div className={styles.heroBackground}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.hero(heroMovie.backdrop)}
              alt={heroMovie.title}
              className={styles.heroImage}
              fetchPriority="high"
              width={HERO_WIDTH}
              height={HERO_HEIGHT}
            />
            <div className={styles.heroGradient} />
          </div>

          <div className={`container ${styles.heroContent}`}>
            {heroMovie.logoUrl ? (
              <div className={styles.heroLogoWrapper}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.logo(heroMovie.logoUrl)}
                  alt={heroMovie.title}
                  className={styles.heroTitleLogo}
                  fetchPriority="high"
                />
              </div>
            ) : (
              <h1 className={styles.heroTitle}>{heroMovie.title}</h1>
            )}
            
            {heroMovie.overview && (
              <p className={styles.heroOverview}>{heroMovie.overview}</p>
            )}

            <div className={styles.heroMeta}>
              {heroMovie.rating && (
                <span className={styles.rating}>
                  <Star size={13} fill="currentColor" color="currentColor" />
                  IMDb {heroMovie.rating}
                </span>
              )}
              {heroMovie.releaseDate && (
                <span className={styles.metaChip}>{heroMovie.releaseDate.split("-")[0]}</span>
              )}
              <span className={styles.metaChip}>
                {heroMovie.mediaType === "tv" ? "TV Series" : "Movie"}
              </span>
              {heroMovie.genres && heroMovie.genres.length > 0 && (
                <span className={styles.genreChip}>
                  {heroMovie.genres.slice(0, 3).join(" • ")}
                </span>
              )}
            </div>

            <div className={styles.heroActions}>
              <Link
                href={`/watch/${heroMovie.detailPath}`}
                className={styles.playButton}
              >
                <Play fill="currentColor" size={18} />
                <span>Watch Now</span>
              </Link>
              <Link
                href={`/${heroMovie.mediaType === "tv" ? "tv" : "movie"}/${heroMovie.detailPath}`}
                className={styles.infoButton}
              >
                <Info size={18} />
                <span>More Details</span>
              </Link>
            </div>
          </div>
        </section>
      )}

      <div className={`container ${styles.contentWrapper}`}>
        <ContinueWatching />
        {carouselBlocks.map((block: any, idx: number, arr: any[]) => {
          const duplicate = arr.slice(0, idx).some((s: any) => s.title === block.title);
          const isTrendingOrTop = idx === 0 || /top\s*10|trending|popular/i.test(block.title);

          return (
            <Carousel
              key={duplicate ? `${block.title}-${idx}` : block.title}
              title={block.title}
              movies={block.subjects}
              eager={idx === 0}
              ranked={isTrendingOrTop}
            />
          );
        })}
      </div>
    </main>
  );
}
