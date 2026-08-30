import styles from "./page.module.css";

export default function Loading() {
  return (
    <div className={styles.main}>
      {/* Backdrop Skeleton */}
      <div className={styles.backdropContainer}>
        <div className="skeleton" style={{ width: "100%", height: "100%" }} />
        <div className={styles.backdropGradient}></div>
      </div>

      <div className={`container ${styles.contentWrapper}`}>
        <div className={styles.mainContent}>
          {/* Poster Column Skeleton */}
          <div className={styles.posterColumn}>
            <div className={`${styles.poster} skeleton`} style={{ border: "none" }} />
          </div>
          
          {/* Info Column Skeleton */}
          <div className={styles.infoColumn}>
            {/* Title Skeleton */}
            <div className="skeleton" style={{ height: "3.5rem", width: "70%", marginBottom: "1.5rem", borderRadius: "10px" }} />
            
            {/* Meta Row Skeleton */}
            <div className={styles.metaRow} style={{ gap: "1rem" }}>
              <div className="skeleton" style={{ height: "1.3rem", width: "80px", borderRadius: "6px" }} />
              <div className="skeleton" style={{ height: "1.3rem", width: "60px", borderRadius: "6px" }} />
              <div className="skeleton" style={{ height: "1.3rem", width: "50px", borderRadius: "6px" }} />
            </div>
            
            {/* Genres Skeleton */}
            <div className={styles.genres} style={{ gap: "0.75rem", marginBottom: "2rem" }}>
              <div className="skeleton" style={{ height: "2rem", width: "100px", borderRadius: "20px" }} />
              <div className="skeleton" style={{ height: "2rem", width: "120px", borderRadius: "20px" }} />
              <div className="skeleton" style={{ height: "2rem", width: "80px", borderRadius: "20px" }} />
            </div>
            
            {/* Description Skeleton */}
            <div style={{ marginBottom: "2.5rem" }}>
              <div className="skeleton" style={{ height: "1.1rem", width: "100%", marginBottom: "0.75rem", borderRadius: "6px" }} />
              <div className="skeleton" style={{ height: "1.1rem", width: "95%", marginBottom: "0.75rem", borderRadius: "6px" }} />
              <div className="skeleton" style={{ height: "1.1rem", width: "70%", marginBottom: "0.75rem", borderRadius: "6px" }} />
            </div>
            
            {/* Action Buttons Skeleton */}
            <div className={styles.actionButtons} style={{ gap: "1rem", marginBottom: "3rem" }}>
              <div className="skeleton" style={{ height: "3.2rem", width: "160px", borderRadius: "8px" }} />
              <div className="skeleton" style={{ height: "3.2rem", width: "48px", borderRadius: "50%" }} />
              <div className="skeleton" style={{ height: "3.2rem", width: "48px", borderRadius: "50%" }} />
            </div>
            
            {/* Cast Skeleton */}
            <div className={styles.castSection}>
              <div className="skeleton" style={{ height: "2rem", width: "120px", marginBottom: "1.5rem", borderRadius: "6px" }} />
              <div className={styles.castList} style={{ gap: "1.5rem" }}>
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className={styles.castMember} style={{ background: "rgba(255, 255, 255, 0.02)", border: "none" }}>
                    <div className="skeleton" style={{ width: "60px", height: "60px", borderRadius: "50%", flexShrink: 0 }} />
                    <div className={styles.castInfo} style={{ gap: "0.5rem" }}>
                      <div className="skeleton" style={{ height: "1rem", width: "80px", borderRadius: "4px" }} />
                      <div className="skeleton" style={{ height: "0.85rem", width: "60px", borderRadius: "4px" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
