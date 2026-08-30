import styles from "../browse.module.css";
import MovieCardSkeleton from "@/components/MovieCardSkeleton";

export default function Loading() {
  return (
    <main className={styles.main} aria-busy="true" aria-label="Loading My List">
      <div className={`container ${styles.container}`}>
        <div className={styles.header}>
          <div className="skeleton" style={{ height: "2.8rem", width: "180px", marginBottom: "0.75rem", borderRadius: "8px" }} />
          <div className="skeleton" style={{ height: "1.1rem", width: "260px", borderRadius: "6px" }} />
        </div>

        <div className={styles.grid}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className={styles.gridItem}>
              <MovieCardSkeleton />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}