import Carousel from "@/components/Carousel";
import ContinueWatching from "@/components/ContinueWatching";
import { getHomepage } from "@/services/api";
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

  const operatingList = data?.data?.operatingList || [];

  // Extract banner
  const bannerBlock = operatingList.find((op: any) => op.type === "BANNER");
  const banners = bannerBlock?.banner?.items || [];
  const heroMovie = banners.length > 0 ? banners[0] : null;

  // Extract carousels
  const carouselBlocks = operatingList.filter(
    (op: any) =>
      (op.type === "SUBJECTS_MOVIE" || op.type === "CUSTOM") &&
      op.subjects &&
      op.subjects.length > 0
  );

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
              src={img.hero(heroMovie.image?.url || heroMovie.subject?.cover?.url)}
              alt={heroMovie.title}
              className={styles.heroImage}
              fetchPriority="high"
              width={HERO_WIDTH}
              height={HERO_HEIGHT}
            />
            <div className={styles.heroGradient} />
          </div>

          <div className={`container ${styles.heroContent}`}>
            <div className={styles.badgeRow}>
              <span className={styles.heroBadge}>FEATURED SPOTLIGHT</span>
              <span className={styles.heroQualityBadge}>4K ULTRA HD</span>
            </div>
            <h1 className={styles.heroTitle}>{heroMovie.title}</h1>
            
            {heroMovie.subject?.description && (
              <p className={styles.heroOverview}>{heroMovie.subject.description}</p>
            )}

            <div className={styles.heroMeta}>
              {heroMovie.subject?.imdbRatingValue && (
                <span className={styles.rating}>
                  <Star size={14} fill="currentColor" color="currentColor" />
                  IMDb {heroMovie.subject.imdbRatingValue}
                </span>
              )}
              {heroMovie.subject?.releaseDate && (
                <span className={styles.metaChip}>{heroMovie.subject.releaseDate.split("-")[0]}</span>
              )}
              <span className={styles.metaChip}>
                {heroMovie.subject?.subjectType === 2 ? "TV Series" : "Movie"}
              </span>
              {heroMovie.subject?.genre && (
                <span className={styles.genreChip}>
                  {heroMovie.subject.genre.split(",").slice(0, 3).join(" • ")}
                </span>
              )}
            </div>

            <div className={styles.heroActions}>
              <Link
                href={`/watch/${heroMovie.detailPath}`}
                className={styles.playButton}
              >
                <Play fill="currentColor" size={20} />
                <span>Watch Now</span>
              </Link>
              <Link
                href={`/${heroMovie.subject?.subjectType === 2 ? "tv" : "movie"}/${heroMovie.detailPath}`}
                className={styles.infoButton}
              >
                <Info size={20} />
                <span>More Details</span>
              </Link>
            </div>
          </div>
        </section>
      )}

      <div className={`container ${styles.contentWrapper}`}>
        <ContinueWatching />
        {carouselBlocks.map((block: any, idx: number, arr: any[]) => {
          const mappedMovies = block.subjects.map((s: any) => ({
            id: s.subjectId,
            title: s.title,
            poster_path: s.cover?.url,
            vote_average: parseFloat(s.imdbRatingValue),
            release_date: s.releaseDate,
            _id: s.detailPath, // Use detailPath as the _id for routing
            media_type: s.subjectType === 2 ? "tv" : "movie",
          }));

          // Stable key from the section title (suffix only on duplicates)
          const duplicate = arr.slice(0, idx).some((s: any) => s.title === block.title);

          return (
            <Carousel
              key={duplicate ? `${block.title}-${idx}` : block.title}
              title={block.title}
              movies={mappedMovies}
              eager={idx === 0}
            />
          );
        })}
      </div>
    </main>
  );
}
