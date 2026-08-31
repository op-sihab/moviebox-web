import Link from "next/link";
import styles from "./Logo.module.css";

interface LogoProps {
  /** Optional href; defaults to home. */
  href?: string;
}

/**
 * CineAura cinema brand logo with Montserrat typography.
 */
export default function Logo({ href = "/" }: LogoProps) {
  return (
    <Link href={href} className={styles.logo} aria-label="CineAura home">
      <div className={styles.markContainer}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt="CineAura Brand Logo"
          width={42}
          height={42}
          className={styles.markImg}
        />
      </div>
      <span className={styles.wordmark}>
        <span className={styles.cine}>Cine</span>
        <span className={styles.aura}>Aura</span>
      </span>
    </Link>
  );
}