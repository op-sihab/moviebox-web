import styles from "./page.module.css";

export default function Loading() {
  return (
    <div className={styles.stage} style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "1.5rem" }}>
      {/* Top Header Skeleton */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div className="skeleton" style={{ width: "44px", height: "44px", borderRadius: "50%", opacity: 0.15 }} />
          <div className="skeleton" style={{ width: "220px", height: "1.5rem", borderRadius: "4px", opacity: 0.15 }} />
        </div>
        <div className="skeleton" style={{ width: "100px", height: "36px", borderRadius: "20px", opacity: 0.15 }} />
      </div>

      {/* Center Backdrop Skeleton */}
      <div style={{ position: "absolute", inset: 0, zIndex: 1 }}>
        <div className="skeleton" style={{ width: "100%", height: "100%", opacity: 0.1 }} />
      </div>

      {/* Bottom Controls Bar Skeleton */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", width: "100%", maxWidth: "900px", margin: "0 auto", zIndex: 10 }}>
        <div className="skeleton" style={{ width: "100%", height: "6px", borderRadius: "3px", opacity: 0.2 }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
            <div className="skeleton" style={{ width: "36px", height: "36px", borderRadius: "50%", opacity: 0.2 }} />
            <div className="skeleton" style={{ width: "80px", height: "1rem", borderRadius: "4px", opacity: 0.2 }} />
          </div>
          <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
            <div className="skeleton" style={{ width: "32px", height: "32px", borderRadius: "50%", opacity: 0.2 }} />
            <div className="skeleton" style={{ width: "32px", height: "32px", borderRadius: "50%", opacity: 0.2 }} />
            <div className="skeleton" style={{ width: "32px", height: "32px", borderRadius: "50%", opacity: 0.2 }} />
          </div>
        </div>
      </div>
    </div>
  );
}
