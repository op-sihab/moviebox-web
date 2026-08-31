"use client";

import { useEffect, useState } from "react";
import styles from "./BrandIntro.module.css";

interface BrandIntroProps {
  /** When true the underlying content (video) is ready to be revealed. */
  ready: boolean;
  /** Called once the intro has fully finished animating out. */
  onFinish: () => void;
  /** Minimum time the brand animation stays on screen (ms). */
  minDuration?: number;
  /** Hard cap — intro never blocks longer than this even if not ready (ms). */
  maxDuration?: number;
}

/**
 * Netflix-style branding intro shown over the watch stage. It plays a cinematic
 * MOVIEBOX logo animation (an animated play/film mark + drawn wordmark) while
 * the video loads underneath, then fades out once the stream is ready
 * (respecting a minimum on-screen time) or when the max duration is hit.
 */
export default function BrandIntro({
  ready,
  onFinish,
  minDuration = 2000,
  maxDuration = 6000,
}: BrandIntroProps) {
  const [exiting, setExiting] = useState(false);
  const [minElapsed, setMinElapsed] = useState(false);
  // Fallback for browsers/background tabs that skip `animationend` events
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMinElapsed(true), minDuration);
    return () => clearTimeout(t);
  }, [minDuration]);

  useEffect(() => {
    const t = setTimeout(() => setExiting(true), maxDuration);
    return () => clearTimeout(t);
  }, [maxDuration]);

  useEffect(() => {
    if (ready && minElapsed) {
      setExiting(true);
    }
  }, [ready, minElapsed]);

  // Hard timeout fallback: if `animationend` never fires (e.g. the tab was
  // backgrounded mid-exit), still release the overlay slightly after the
  // exit animation could have finished.
  useEffect(() => {
    if (!exiting) return;
    const t = setTimeout(() => {
      setFinished(true);
      onFinish();
    }, 3000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exiting]);

  const handleAnimationEnd = (e: React.AnimationEvent) => {
    if (exiting && !finished && e.target === e.currentTarget) {
      setFinished(true);
      onFinish();
    }
  };

  return (
    <div
      className={`${styles.overlay} ${exiting ? styles.exiting : ""}`}
      onAnimationEnd={handleAnimationEnd}
      role="status"
      aria-live="polite"
      aria-label="Loading CineAura"
    >
      <div className={styles.glowPulse} aria-hidden="true" />

      <div className={styles.logoWrap} aria-hidden={finished || undefined}>
        {/* ===== Animated brand mark ===== */}
        <div className={styles.markContainer}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="CineAura Logo"
            className={styles.markImg}
          />
          <div className={styles.markGlow} />
        </div>

        {/* ===== Wordmark ===== */}
        <div className={styles.wordmark}>
          Cine<span>Aura</span>
          <span className={styles.shine} aria-hidden="true">
            CineAura
          </span>
        </div>

        <div className={styles.tagline}>C I N E M A T I C&nbsp;&nbsp;A U R A</div>
      </div>

      {!exiting && (
        <div className={styles.loadBar}>
          <div className={styles.loadBarFill} />
        </div>
      )}
    </div>
  );
}