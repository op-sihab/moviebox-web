import styles from "../browse.module.css";
import MovieCardSkeleton from "@/components/MovieCardSkeleton";

export default function Loading() {
  return (
    <main className={styles.main} aria-busy="true" aria-label="Loading TV Shows">
      <div className={`container ${styles.container}`}>
        <div className={styles.header}>
          <div className="skeleton" style={{ height: "2.8rem", width: "240px", marginBottom: "0.75rem", borderRadius: "8px" }} />
          <div className="skeleton" style={{ height: "1.1rem", width: "340px", borderRadius: "6px" }} />
        </div>

        {[1, 2].map((sec) => (
          <section key={sec} className={styles.section}>
            <div className="skeleton" style={{ height: "1.5rem", width: "180px", marginBottom: "1.25rem", borderRadius: "6px" }} />
            <div className={styles.grid}>
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className={styles.gridItem}>
                  <MovieCardSkeleton />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}