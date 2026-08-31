import Link from "next/link";
import styles from "./Logo.module.css";

interface LogoProps {
  /** Optional href; defaults to home. */
  href?: string;
}

/**
 * CINEAURA flagship cinema brand mark:
 * Sleek geometric aperture play-prism with cinema crimson flame accent.
 */
export default function Logo({ href = "/" }: LogoProps) {
  return (
    <Link href={href} className={styles.logo} aria-label="CineAura home">
      <div className={styles.markContainer}>
        <svg className={styles.mark} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <defs>
            <linearGradient id="ca-cinema-flame" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#E50914" />
              <stop offset="100%" stopColor="#FF385C" />
            </linearGradient>
          </defs>
          {/* Angular Cinema Box Frame */}
          <rect x="2" y="2" width="32" height="32" rx="9" fill="#12151D" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
          {/* Dynamic Play Prism */}
          <path d="M14 10.5L26 18L14 25.5V10.5Z" fill="url(#ca-cinema-flame)" />
          {/* Subtle light glint edge */}
          <path d="M14 10.5L20 14.5L14 18.5V10.5Z" fill="#FFFFFF" fillOpacity="0.28" />
        </svg>
        <span className={styles.glowAura} aria-hidden="true" />
      </div>
      <span className={styles.wordmark}>
        <span className={styles.cine}>CINE</span>
        <span className={styles.aura}>AURA</span>
      </span>
    </Link>
  );
}