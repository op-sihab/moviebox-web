"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Bell, User, Home, Tv, Film, Heart } from "lucide-react";
import { motion, LayoutGroup } from "motion/react";
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

function getCanonicalRoute(p: string | null): string {
  if (!p || p === "/") return "/";
  if (p === "/movies" || p.startsWith("/movie/")) return "/movies";
  if (p === "/tv" || p.startsWith("/tv/")) return "/tv";
  if (p.startsWith("/new")) return "/new";
  if (p.startsWith("/mylist")) return "/mylist";
  return p;
}

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState<string>(() => getCanonicalRoute(pathname));
  const scrollRafRef = useRef<number | null>(null);

  // Synchronize when route finishes navigating
  useEffect(() => {
    setActiveTab(getCanonicalRoute(pathname));
  }, [pathname]);

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

  // Hide navbar on full-screen watch
  if (pathname?.startsWith("/watch/")) {
    return null;
  }

  return (
    <>
      <header className={`${styles.navbar} ${isScrolled ? styles.scrolled : ""}`}>
        <div className={styles.container}>
          <div className={styles.left}>
            <Logo />
            <LayoutGroup id="header-nav-segmented-tabs">
              <nav className={styles.navLinks} aria-label="Main Navigation">
                {NAV_LINKS.map((link) => {
                  const active = activeTab === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setActiveTab(link.href)}
                      className={`${styles.navTab} ${active ? styles.active : ""}`}
                      aria-current={active ? "page" : undefined}
                    >
                      {active && (
                        <motion.span
                          layoutId="activeNavIndicator"
                          className={styles.activePillIndicator}
                          transition={{
                            type: "spring",
                            stiffness: 380,
                            damping: 32,
                            mass: 0.8,
                          }}
                        />
                      )}
                      <span className={styles.navTabLabel}>{link.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </LayoutGroup>
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
      <LayoutGroup id="mobile-nav-segmented-tabs">
        <nav className={styles.mobileBottomNav}>
          {MOBILE_NAV_LINKS.map((link) => {
            const Icon = link.icon;
            const active = activeTab === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setActiveTab(link.href)}
                className={`${styles.mobileNavItem} ${active ? styles.mobileActive : ""}`}
                aria-current={active ? "page" : undefined}
              >
                {active && (
                  <motion.span
                    layoutId="activeMobileIndicator"
                    className={styles.activeMobilePill}
                    transition={{
                      type: "spring",
                      stiffness: 380,
                      damping: 32,
                      mass: 0.8,
                    }}
                  />
                )}
                <Icon size={21} className={styles.mobileNavIcon} />
                <span className={styles.mobileNavLinkText}>{link.label}</span>
              </Link>
            );
          })}
        </nav>
      </LayoutGroup>
    </>
  );
}