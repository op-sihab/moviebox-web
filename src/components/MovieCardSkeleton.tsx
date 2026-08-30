import styles from "./MovieCard.module.css";

interface MovieCardSkeletonProps {
  aspectRatio?: string;
  width?: string;
}

export default function MovieCardSkeleton({
  aspectRatio = "2/3",
  width = "100%",
}: MovieCardSkeletonProps) {
  return (
    <div
      className={styles.cardWrapper}
      style={{ width, pointerEvents: "none", userSelect: "none" }}
      aria-hidden="true"
    >
      {/* Poster Skeleton */}
      <div
        className={`${styles.card} skeleton`}
        style={{
          aspectRatio,
          border: "none",
          boxShadow: "none",
        }}
      />

      {/* Bottom Info Skeleton */}
      <div className={styles.bottomInfo} style={{ gap: "0.4rem", marginTop: "0.2rem" }}>
        {/* Title */}
        <div
          className="skeleton"
          style={{
            height: "12px",
            width: "80%",
            borderRadius: "4px",
          }}
        />
        {/* Subtitle / Meta */}
        <div
          className="skeleton"
          style={{
            height: "10px",
            width: "45%",
            borderRadius: "4px",
          }}
        />
      </div>
    </div>
  );
}
