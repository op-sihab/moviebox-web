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
        <svg
          className={styles.mark}
          viewBox="0 0 120 120"
          width="118"
          height="118"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="bx-ring" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#A78BFA" />
              <stop offset="50%" stopColor="#8B5CF6" />
              <stop offset="100%" stopColor="#E879F9" />
            </linearGradient>
            <linearGradient id="bx-play" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#ffd9dc" />
            </linearGradient>
            <filter id="bx-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3.2" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Outer circle that draws itself */}
          <circle
            className={styles.markRing}
            cx="60"
            cy="60"
            r="46"
            fill="none"
            stroke="url(#bx-ring)"
            strokeWidth="5"
            filter="url(#bx-glow)"
          />

          {/* Play-prism group that fades + scales in */}
          <g className={styles.markPlay}>
            <path d="M48 40 L62 48 L62 72 L48 80 Z" fill="url(#bx-play)" />
            <path d="M68 51 L84 60 L68 69 Z" fill="url(#bx-ring)" />
          </g>
        </svg>

        {/* ===== Wordmark ===== */}
        <div className={styles.wordmark}>
          CINE<span>AURA</span>
          <span className={styles.shine} aria-hidden="true">
            CINEAURA
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