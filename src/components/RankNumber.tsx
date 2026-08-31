import React from "react";
import styles from "./RankNumber.module.css";

interface RankNumberProps {
  rank: number;
}

/**
 * Poppins 900 2px white outline rank numeral matching reference inspection.
 */
export default function RankNumber({ rank }: RankNumberProps) {
  return (
    <span className={styles.rankNumber} aria-hidden="true">
      {rank}
    </span>
  );
}
