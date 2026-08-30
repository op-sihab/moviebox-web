import styles from "./page.module.css";
import MovieCardSkeleton from "@/components/MovieCardSkeleton";

export default function Loading() {
  return (
    <main className={styles.main} aria-busy="true" aria-label="Loading CineAura">
      {/* Hero Banner Skeleton */}
      <section className={styles.hero}>
        <div className={styles.heroBackground}>
          <div className="skeleton" style={{ width: "100%", height: "100%" }} />
          <div className={styles.heroGradient} />
        </div>
        <div className={`container ${styles.heroContent}`}>
          <div className="skeleton" style={{ height: "3.5rem", width: "55%", maxWidth: "520px", marginBottom: "1.2rem", borderRadius: "10px" }} />
          <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem" }}>
            <div className="skeleton" style={{ height: "1.3rem", width: "80px", borderRadius: "6px" }} />
            <div className="skeleton" style={{ height: "1.3rem", width: "65px", borderRadius: "6px" }} />
            <div className="skeleton" style={{ height: "1.3rem", width: "110px", borderRadius: "6px" }} />
          </div>
          <div className="skeleton" style={{ height: "1.2rem", width: "85%", maxWidth: "620px", marginBottom: "0.6rem", borderRadius: "6px" }} />
          <div className="skeleton" style={{ height: "1.2rem", width: "65%", maxWidth: "480px", marginBottom: "2rem", borderRadius: "6px" }} />
          <div style={{ display: "flex", gap: "1rem" }}>
            <div className="skeleton" style={{ height: "3.2rem", width: "150px", borderRadius: "8px" }} />
            <div className="skeleton" style={{ height: "3.2rem", width: "150px", borderRadius: "8px" }} />
          </div>
        </div>
      </section>

      {/* Carousel Rows Skeletons */}
      <div style={{ marginTop: "-2rem", display: "flex", flexDirection: "column", gap: "3rem", paddingBottom: "3rem" }}>
        {[1, 2, 3].map((row) => (
          <div key={row} className="container" style={{ width: "100%" }}>
            <div className="skeleton" style={{ height: "1.6rem", width: "220px", marginBottom: "1.25rem", borderRadius: "6px" }} />
            <div style={{ display: "flex", gap: "1.25rem", overflow: "hidden" }}>
              {[1, 2, 3, 4, 5, 6, 7].map((card) => (
                <div key={card} style={{ width: "190px", flexShrink: 0 }}>
                  <MovieCardSkeleton width="100%" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}