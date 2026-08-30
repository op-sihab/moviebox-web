import Link from "next/link";
import styles from "./Logo.module.css";

interface LogoProps {
  /** Optional href; defaults to home. */
  href?: string;
}

/**
 * CINEAURA brand lockup: a modern play-prism SVG mark + wordmark.
 * Matches the cinematic BrandIntro styling at a compact navbar size.
 */
export default function Logo({ href = "/" }: LogoProps) {
  return (
    <Link href={href} className={styles.logo} aria-label="CineAura home">
      <svg className={styles.mark} viewBox="0 0 120 120" width="30" height="30" aria-hidden="true">
        <defs>
          <linearGradient id="cineaura-logo-ring-v1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#8B5CF6" />
            <stop offset="55%" stopColor="#D946EF" />
            <stop offset="100%" stopColor="#22D3EE" />
          </linearGradient>
        </defs>
        {/* Outer Aura Circle */}
        <circle
          cx="60"
          cy="60"
          r="46"
          fill="none"
          stroke="url(#cineaura-logo-ring-v1)"
          strokeWidth="8"
        />
        {/* Split futuristic play-prism */}
        <path d="M48 40 L62 48 L62 72 L48 80 Z" fill="#fff" />
        <path d="M68 51 L84 60 L68 69 Z" fill="url(#cineaura-logo-ring-v1)" />
      </svg>
      <span className={styles.word}>
        CINE<span className={styles.aura}>AURA</span>
      </span>
    </Link>
  );
}