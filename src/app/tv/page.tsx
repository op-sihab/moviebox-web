import type { Metadata } from "next";
import Link from "next/link";
import { getBrowseSections } from "@/services/api";
import MovieCard from "@/components/MovieCard";
import styles from "../browse.module.css";

export const metadata: Metadata = {
  title: "TV Shows",
  description: "Binge-worthy series, dramas, and anime.",
};

// Sentinel returned by the catch below so we can tell "API failed"
// apart from "API returned nothing".
const FETCH_FAILED = "__fetch_failed__";

export default async function TVShowsPage() {
  const sections = await getBrowseSections().catch(() => FETCH_FAILED);
  const failed = sections === FETCH_FAILED;

  // Keep only TV/series content (subjectType 2 = series, 7 = short TV)
  const tvSections = failed
    ? []
    : (sections as any[])
        .map((sec: any) => ({
          title: sec.title,
          subjects: sec.subjects.filter((s: any) => s.subjectType === 2 || s.subjectType === 7),
        }))
        .filter((sec: any) => sec.subjects.length > 0);

  return (
    <main className={styles.main}>
      <div className="container">
        <div className={styles.header}>
          <h1 className={styles.pageTitle}>
            <span>TV</span> Shows
          </h1>
          <p className={styles.subtitle}>Binge-worthy series, dramas, and anime.</p>
        </div>

        {failed ? (
          <div className={styles.errorBanner} role="alert">
            <div>
              <h2>Couldn&apos;t load TV shows</h2>
              <p>Something went wrong while fetching content. Please try again.</p>
            </div>
            <Link href="/tv" className={styles.browseLink}>
              Try Again
            </Link>
          </div>
        ) : tvSections.length === 0 ? (
          <div className={styles.empty}>
            <h2>Nothing to show right now</h2>
            <p>Please try again in a moment.</p>
          </div>
        ) : (
          tvSections.map((sec: any, idx: number, arr: any[]) => {
            // Stable key from the section title (suffix only on duplicates)
            const duplicate = arr.slice(0, idx).some((s: any) => s.title === sec.title);
            return (
              <section
                key={duplicate ? `${sec.title}-${idx}` : sec.title}
                className={styles.section}
              >
                <h2 className={styles.sectionTitle}>{sec.title}</h2>
                <div className={styles.grid}>
                  {sec.subjects.map((show: any, sIdx: number) => (
                    <div key={`${show._id || show.id || "show"}-${sIdx}`} className={styles.gridItem}>
                      <MovieCard movie={show} />
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