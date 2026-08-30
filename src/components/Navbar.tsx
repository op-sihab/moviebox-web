"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Bell, User, Home, Tv, Film, Heart } from "lucide-react";
import styles from "./Navbar.module.css";
import Logo from "./Logo";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/tv", label: "TV Shows" },
  { href: "/movies", label: "Movies" },
  { href: "/new", label: "New & Popular" },
  { href: "/mylist", label: "My List" },
];

const MOBILE_NAV_LINKS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/tv", label: "TV Shows", icon: Tv },
  { href: "/movies", label: "Movies", icon: Film },
  { href: "/mylist", label: "My List", icon: Heart },
  { href: "/search", label: "Search", icon: Search },
];

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const pathname = usePathname();
  const scrollRafRef = useRef<number | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (scrollRafRef.current !== null) return;
      scrollRafRef.current = window.requestAnimationFrame(() => {
        scrollRafRef.current = null;
        const next = window.scrollY > 50;
        setIsScrolled((prev) => (prev === next ? prev : next));
      });
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (scrollRafRef.current !== null) {
        window.cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = null;
      }
    };
  }, []);

  // Hide the navbar entirely on the full-screen watch experience
  if (pathname?.startsWith("/watch/")) {
    return null;
  }

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname?.startsWith(href);

  return (
    <>
      <header className={`${styles.navbar} ${isScrolled ? styles.scrolled : ""}`}>
        <div className={styles.container}>
          <div className={styles.left}>
            <Logo />
            <nav className={styles.navLinks}>
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={isActive(link.href) ? styles.active : ""}
                  aria-current={isActive(link.href) ? "page" : undefined}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className={styles.right}>
            <Link href="/search" className={styles.searchBtn} aria-label="Search">
              <Search size={16} />
              <span className={styles.searchLabel}>Search</span>
              <span className={styles.searchKbd}>Ctrl K</span>
            </Link>
            <button className={`${styles.iconBtn} ${styles.desktopOnly}`} aria-label="Notifications">
              <Bell size={20} />
              <span className={styles.notifDot} aria-hidden="true" />
            </button>
            <div className={styles.profile}>
              <User size={17} />
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar */}
      <nav className={styles.mobileBottomNav}>
        {MOBILE_NAV_LINKS.map((link) => {
          const Icon = link.icon;
          const active = isActive(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`${styles.mobileNavItem} ${active ? styles.mobileActive : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={22} className={styles.mobileNavIcon} />
              <span className={styles.mobileNavLinkText}>{link.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}