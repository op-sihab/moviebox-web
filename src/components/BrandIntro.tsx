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
  /** Content title logo URL (if available) */
  titleLogoUrl?: string | null;
  /** Content title */
  contentTitle?: string | null;
}

/**
 * Netflix-style branding intro shown over the watch stage. It plays a cinematic
 * CineAura logo animation + optional content title logo while the video loads underneath.
 */
export default function BrandIntro({
  ready,
  onFinish,
  minDuration = 700,
  maxDuration = 3500,
  titleLogoUrl,
  contentTitle,
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
      <div className={styles.ambientVignette} aria-hidden="true" />
      <div className={styles.anamorphicBeam} aria-hidden="true" />
      <div className={styles.auraRing1} aria-hidden="true" />
      <div className={styles.auraRing2} aria-hidden="true" />
      <div className={styles.glowPulse} aria-hidden="true" />

      <div className={styles.logoWrap} aria-hidden={finished || undefined}>
        {/* ===== Animated brand mark ===== */}
        <div className={styles.markContainer}>
          <div className={styles.markBackdropGlow} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="CineAura Logo"
            className={styles.markImg}
          />
          <div className={styles.markGlow} />
          <div className={styles.markLensShine} />
        </div>

        {/* ===== Wordmark ===== */}
        <div className={styles.wordmark}>
          Cine<span>Aura</span>
          <span className={styles.shine} aria-hidden="true">
            CineAura
          </span>
        </div>

        <div className={styles.tagline}>
          <span>C I N E M A T I C</span>
          <span className={styles.taglineDot}>•</span>
          <span>A U R A</span>
        </div>

        {/* Optional Title Logo Presentation */}
        {titleLogoUrl ? (
          <div className={styles.contentLogoWrap}>
            <span className={styles.presentingText}>NOW STREAMING</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={titleLogoUrl} alt={contentTitle || "Title"} className={styles.contentTitleLogo} />
          </div>
        ) : contentTitle ? (
          <div className={styles.contentLogoWrap}>
            <span className={styles.presentingText}>NOW STREAMING</span>
            <span className={styles.contentTitleText}>{contentTitle}</span>
          </div>
        ) : null}
      </div>

      {!exiting && (
        <div className={styles.loadBar}>
          <div className={styles.loadBarFill} />
        </div>
      )}
    </div>
  );
}