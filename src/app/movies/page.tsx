import type { Metadata } from "next";
import Link from "next/link";
import { getBrowseSections } from "@/services/api";
import MovieCard from "@/components/MovieCard";
import styles from "../browse.module.css";

export const metadata: Metadata = {
  title: "Movies",
  description: "Blockbusters, classics, and everything in between.",
};

// Sentinel returned by the catch below so we can tell "API failed"
// apart from "API returned nothing".
const FETCH_FAILED = "__fetch_failed__";

export default async function MoviesPage() {
  const sections = await getBrowseSections().catch(() => FETCH_FAILED);
  const failed = sections === FETCH_FAILED;

  // Keep only sections that contain movies, and within each keep only movies
  const movieSections = failed
    ? []
    : (sections as any[])
        .map((sec: any) => ({
          title: sec.title,
          subjects: sec.subjects.filter((s: any) => s.subjectType === 1),
        }))
        .filter((sec: any) => sec.subjects.length > 0);

  return (
    <main className={styles.main}>
      <div className="container">
        <div className={styles.header}>
          <h1 className={styles.pageTitle}>
            <span>Movies</span>
          </h1>
          <p className={styles.subtitle}>Blockbusters, classics, and everything in between.</p>
        </div>

        {failed ? (
          <div className={styles.errorBanner} role="alert">
            <div>
              <h2>Couldn&apos;t load movies</h2>
              <p>Something went wrong while fetching content. Please try again.</p>
            </div>
            <Link href="/movies" className={styles.browseLink}>
              Try Again
            </Link>
          </div>
        ) : movieSections.length === 0 ? (
          <div className={styles.empty}>
            <h2>Nothing to show right now</h2>
            <p>Please try again in a moment.</p>
          </div>
        ) : (
          movieSections.map((sec: any, idx: number, arr: any[]) => {
            // Stable key from the section title (suffix only on duplicates)
            const duplicate = arr.slice(0, idx).some((s: any) => s.title === sec.title);
            return (
              <section
                key={duplicate ? `${sec.title}-${idx}` : sec.title}
                className={styles.section}
              >
                <h2 className={styles.sectionTitle}>{sec.title}</h2>
                <div className={styles.grid}>
                  {sec.subjects.map((movie: any, mIdx: number) => (
                    <div key={`${movie._id || movie.id || "movie"}-${mIdx}`} className={styles.gridItem}>
                      <MovieCard movie={movie} />
                    </div>
                  ))}
                </div>
              </section>
            );
          })
        )}
      </div>
    </main>
  );
}