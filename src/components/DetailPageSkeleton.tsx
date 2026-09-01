"use client";

import { useEffect } from "react";
import styles from "@/app/movie/[id]/page.module.css";

/**
 * Flagship Cinema DetailPageSkeleton
 * 100% perfectly matching the High-End Streamer Hero Showcase & Cast Hub.
 * Zero layout shift, instant scroll to top, zero card skeleton flashes.
 */
export default function DetailPageSkeleton() {
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
  }, []);

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
          <div className="skeleton" style={{ width: "100%", height: "100%", opacity: 0.2 }} />
          <div className={styles.backdropGradient} />
        </div>

        <div className={`container ${styles.heroContentWrapper}`}>
          <div className={styles.heroContent}>
            {/* Title / Logo Skeleton */}
            <div
              className="skeleton"
              style={{
                width: "min(340px, 70%)",
                height: 54,
                borderRadius: 8,
                margin: "0.2rem 0 0.5rem",
              }}
            />

            {/* Minimalist Inline Meta Row */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.55rem", margin: "0.2rem 0" }}>
              <div className="skeleton" style={{ width: 48, height: 18, borderRadius: 4 }} />
              <div className="skeleton" style={{ width: 40, height: 18, borderRadius: 4 }} />
              <div className="skeleton" style={{ width: 62, height: 18, borderRadius: 4 }} />
              <div className="skeleton" style={{ width: 110, height: 18, borderRadius: 4 }} />
            </div>

            {/* Overview Lines */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem", maxWidth: "560px", margin: "0.3rem 0 0.5rem" }}>
              <div className="skeleton" style={{ width: "100%", height: 15, borderRadius: 4 }} />
              <div className="skeleton" style={{ width: "90%", height: 15, borderRadius: 4 }} />
              <div className="skeleton" style={{ width: "65%", height: 15, borderRadius: 4 }} />
            </div>

            {/* Action Buttons Bar */}
            <div className={styles.actionButtons} style={{ marginTop: "0.8rem" }}>
              <div className="skeleton" style={{ width: 115, height: 44, borderRadius: 999 }} />
              <div className="skeleton" style={{ width: 44, height: 44, borderRadius: "50%" }} />
              <div className="skeleton" style={{ width: 125, height: 44, borderRadius: 999 }} />
              <div className="skeleton" style={{ width: 110, height: 44, borderRadius: 999 }} />
            </div>
          </div>
        </div>
      </section>

      {/* 2. CAST SECTION SKELETON */}
      <div className={`container ${styles.detailsHub}`}>
        <section className={styles.castSection}>
          <div className={styles.castHeader} style={{ marginBottom: "1.25rem" }}>
            <div className="skeleton" style={{ width: 80, height: 24, borderRadius: 6 }} />
            <div className="skeleton" style={{ width: 70, height: 20, borderRadius: 999 }} />
          </div>

          <div className={styles.castGrid}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className={styles.castCard}>
                <div
                  className="skeleton"
                  style={{ width: 52, height: 52, borderRadius: "50%", flexShrink: 0 }}
                />
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", flex: 1, minWidth: 0 }}>
                  <div className="skeleton" style={{ width: "75%", height: 14, borderRadius: 4 }} />
                  <div className="skeleton" style={{ width: "50%", height: 12, borderRadius: 4 }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
