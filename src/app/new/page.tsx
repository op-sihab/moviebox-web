import type { Metadata } from "next";
import Link from "next/link";
import { getBrowseSections } from "@/services/api";
import MovieCard from "@/components/MovieCard";
import styles from "../browse.module.css";

export const metadata: Metadata = {
  title: "New & Popular",
  description: "What everyone is watching right now.",
};

const HOT_KEYWORDS = ["trending", "hot", "upcoming", "new", "top", "this week", "cinema", "calendar"];

// Sentinel returned by the catch below so we can tell "API failed"
// apart from "API returned nothing".
const FETCH_FAILED = "__fetch_failed__";

export default async function NewPopularPage() {
  const sections = await getBrowseSections().catch(() => FETCH_FAILED);
  const failed = sections === FETCH_FAILED;

  // Prefer sections whose title signals freshness/popularity; fall back to all
  const matched = failed
    ? []
    : (sections as any[]).filter((sec: any) =>
        HOT_KEYWORDS.some((k) => sec.title.toLowerCase().includes(k))
      );
  const display = matched.length > 0 ? matched : failed ? [] : (sections as any[]);

  return (
    <main className={styles.main}>
      <div className="container">
        <div className={styles.header}>
          <h1 className={styles.pageTitle}>
            <span>New</span> &amp; Popular
          </h1>
          <p className={styles.subtitle}>What everyone is watching right now.</p>
        </div>

        {failed ? (
          <div className={styles.errorBanner} role="alert">
            <div>
              <h2>Couldn&apos;t load New &amp; Popular</h2>
              <p>Something went wrong while fetching content. Please try again.</p>
            </div>
            <Link href="/new" className={styles.browseLink}>
              Try Again
            </Link>
          </div>
        ) : display.length === 0 ? (
          <div className={styles.empty}>
            <h2>Nothing to show right now</h2>
            <p>Please try again in a moment.</p>
          </div>
        ) : (
          display.map((sec: any, idx: number, arr: any[]) => {
            // Stable key from the section title (suffix only on duplicates)
            const duplicate = arr.slice(0, idx).some((s: any) => s.title === sec.title);
            return (
              <section
                key={duplicate ? `${sec.title}-${idx}` : sec.title}
                className={styles.section}
              >
                <h2 className={styles.sectionTitle}>{sec.title}</h2>
                <div className={styles.grid}>
                  {sec.subjects.map((item: any, iIdx: number) => (
                    <div key={`${item._id || item.id || "item"}-${iIdx}`} className={styles.gridItem}>
                      <MovieCard movie={item} />
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