import styles from "@/app/tv/[id]/page.module.css";

/**
 * Flagship Cinema DetailPageSkeleton
 * 100% perfectly matching the High-End Streamer Hero Showcase & Content Hub.
 * Zero layout shift, smooth shimmer animation.
 */
export default function DetailPageSkeleton() {
  return (
    <div className={styles.main}>
      {/* 1. HERO STAGE SKELETON */}
      <section className={styles.heroStage}>
        {/* Back button placeholder */}
        <div
          className="skeleton"
          style={{
            position: "absolute",
            top: 100,
            left: "clamp(1.5rem, 4vw, 3.5rem)",
            width: 44,
            height: 44,
            borderRadius: "50%",
            zIndex: 30,
          }}
        />

        <div className={styles.backdropContainer}>
          <div className="skeleton" style={{ width: "100%", height: "100%", opacity: 0.3 }} />
          <div className={styles.backdropGradient} />
        </div>

        <div className={`container ${styles.heroContentWrapper}`}>
          <div className={styles.heroContent}>
            {/* Title / Logo Skeleton */}
            <div
              className="skeleton"
              style={{
                width: "min(320px, 65%)",
                height: 60,
                borderRadius: 8,
                margin: "0.2rem 0",
              }}
            />

            {/* Minimalist Inline Meta Row */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.2rem" }}>
              <div className="skeleton" style={{ width: 45, height: 18, borderRadius: 4 }} />
              <div className="skeleton" style={{ width: 40, height: 18, borderRadius: 4 }} />
              <div className="skeleton" style={{ width: 60, height: 18, borderRadius: 4 }} />
              <div className="skeleton" style={{ width: 110, height: 18, borderRadius: 4 }} />
            </div>

            {/* Overview Lines */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem", maxWidth: "520px", marginTop: "0.3rem" }}>
              <div className="skeleton" style={{ width: "100%", height: 15, borderRadius: 4 }} />
              <div className="skeleton" style={{ width: "88%", height: 15, borderRadius: 4 }} />
              <div className="skeleton" style={{ width: "60%", height: 15, borderRadius: 4 }} />
            </div>

            {/* Action Buttons Bar */}
            <div className={styles.actionButtons} style={{ marginTop: "0.6rem" }}>
              <div className="skeleton" style={{ width: 105, height: 42, borderRadius: 999 }} />
              <div className="skeleton" style={{ width: 44, height: 44, borderRadius: "50%" }} />
              <div className="skeleton" style={{ width: 120, height: 42, borderRadius: 999 }} />
              <div className="skeleton" style={{ width: 105, height: 42, borderRadius: 999 }} />
            </div>
          </div>
        </div>
      </section>

      {/* 2. DETAILS HUB SKELETON */}
      <div className={`container ${styles.detailsHub}`}>
        <div className={styles.hubGrid}>
          {/* Main Column */}
          <div className={styles.hubMain}>
            {/* Storyline Skeleton */}
            <div className={styles.storylineCard}>
              <div className="skeleton" style={{ width: 100, height: 20, borderRadius: 4, marginBottom: "0.85rem" }} />
              <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                <div className="skeleton" style={{ width: "100%", height: 15, borderRadius: 4 }} />
                <div className="skeleton" style={{ width: "92%", height: 15, borderRadius: 4 }} />
              </div>
            </div>

            {/* Cast Rail Skeleton */}
            <div className={styles.castSection}>
              <div className="skeleton" style={{ width: 140, height: 20, borderRadius: 4, marginBottom: "0.85rem" }} />
              <div className={styles.castGrid}>
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className={styles.castCard}>
                    <div className="skeleton" style={{ width: 46, height: 46, borderRadius: "50%", flexShrink: 0 }} />
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", flex: 1 }}>
                      <div className="skeleton" style={{ width: "70%", height: 14, borderRadius: 4 }} />
                      <div className="skeleton" style={{ width: "45%", height: 12, borderRadius: 4 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar Specs Skeleton */}
          <aside className={styles.hubSidebar}>
            <div className={styles.specsCard}>
              <div className="skeleton" style={{ width: 130, height: 20, borderRadius: 4, marginBottom: "0.5rem" }} />
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className={styles.specItem}>
                  <div className="skeleton" style={{ width: 75, height: 11, borderRadius: 4 }} />
                  <div className="skeleton" style={{ width: 110, height: 15, borderRadius: 4 }} />
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
