"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import styles from "./CustomVideoPlayer.module.css";
import { Loader2 } from "lucide-react";

interface CustomVideoPlayerProps {
  id: string;
  mediaType?: "movie" | "tv";
  season?: number;
  episode?: number;
  posterPath?: string;
  episodes?: any[];
  currentSeason?: number;
  currentEpisode?: number;
  onEpisodeChange?: (season: number, episode: number) => void;
  files: any[];
  selectedFile: any;
  onQualityChange: (file: any) => void;
  title: string;
  episodeTitle?: string;
  nextEpisodeTitle?: string;
  onNextEpisode?: () => void;
  /** Fill the parent container (full-screen watch layout) instead of a 16:9 box. */
  fillParent?: boolean;
  /** When provided, renders a back arrow in the player header. */
  backHref?: string;
  /** Fires once the video has buffered enough to start playing (canplay). */
  onReady?: () => void;
  dubs?: any[];
}

export default function CustomVideoPlayer({
  id,
  mediaType = "movie",
  season,
  episode,
  posterPath,
  episodes,
  currentSeason,
  currentEpisode,
  onEpisodeChange,
  files,
  selectedFile,
  onQualityChange,
  title,
  episodeTitle,
  nextEpisodeTitle,
  onNextEpisode,
  fillParent = false,
  backHref,
  onReady,
  dubs,
}: CustomVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [showEpisodesDrawer, setShowEpisodesDrawer] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [settingsTab, setSettingsTab] = useState<"main" | "quality" | "speed">("main");
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  // The spinner only appears after a short grace period of continuous buffering,
  // so quick loads just play without ever flashing a loader.
  const [showSpinner, setShowSpinner] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoError, setVideoError] = useState(false);

  const spinnerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const SPINNER_DELAY_MS = 4500;

  // Autoplay Countdown States
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showCountdownToast, setShowCountdownToast] = useState(false);
  const [isCountdownCancelled, setIsCountdownCancelled] = useState(false);

  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lastFilesRef = useRef<any[]>([]);
  const previousTimeRef = useRef(0);
  const wasPlayingRef = useRef(false);
  const activeTimeRef = useRef(0);
  const isPlayingRef = useRef(false);
  const isMutedRef = useRef(false);
  const isFullscreenRef = useRef(false);
  const isScrubbingRef = useRef(false);
  const restoredKeyRef = useRef<string | null>(null);

  // Sync isPlaying state to a ref to avoid triggering source switches on play/pause
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    isFullscreenRef.current = isFullscreen;
  }, [isFullscreen]);

  // Sync playback rate on load
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [videoUrl, isLoading, playbackRate]);

  // Deferred spinner: only show the loader if buffering lasts longer than the
  // grace period. Fast loads play immediately with no spinner flash.
  useEffect(() => {
    if (isLoading) {
      if (!spinnerTimerRef.current) {
        spinnerTimerRef.current = setTimeout(() => {
          setShowSpinner(true);
        }, SPINNER_DELAY_MS);
      }
    } else {
      if (spinnerTimerRef.current) {
        clearTimeout(spinnerTimerRef.current);
        spinnerTimerRef.current = null;
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowSpinner(false);
    }
    return () => {
      if (spinnerTimerRef.current) {
        clearTimeout(spinnerTimerRef.current);
        spinnerTimerRef.current = null;
      }
    };
  }, [isLoading, videoUrl]);

  // Compute associated IDs (current active ID + sibling dub IDs)
  const allIds = useMemo(() => {
    const ids = new Set<string>();
    if (id) ids.add(String(id));
    if (dubs) {
      dubs.forEach((d: any) => {
        if (d.subject_id) ids.add(String(d.subject_id));
        if (d.detail_path) ids.add(String(d.detail_path));
      });
    }
    return ids;
  }, [id, dubs]);

  // Load and hold playback progress for all episodes of this show
  const [episodesProgress, setEpisodesProgress] = useState<Record<string, { progress: number; duration: number }>>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem("mbx:episodes_progress");
      if (saved) {
        const history = JSON.parse(saved);
        const map: Record<string, { progress: number; duration: number }> = {};
        
        const getBaseTitle = (t: string) => {
          if (!t) return "";
          return t.replace(/\[[^\]]+\]/g, "").replace(/\([^\)]+\)/g, "").trim().toLowerCase();
        };
        const currentBase = getBaseTitle(title);

        history.forEach((item: any) => {
          const isMatch = 
            allIds.has(String(item.id)) || 
            (currentBase && item.title && getBaseTitle(item.title) === currentBase);

          if (isMatch) {
            const key = `${item.season}:${item.episode}`;
            map[key] = { progress: item.progress, duration: item.duration };
          }
        });
        setEpisodesProgress(map);
      }
    } catch (e) {
      console.error("Failed to load episodes progress", e);
    }
  }, [allIds, title]);

  // 1. Restore playback progress from localStorage on mount/id change
  useEffect(() => {
    const restoredKey = `${title ?? ""}:${mediaType}:${season ?? 0}:${episode ?? 0}`;
    restoredKeyRef.current = restoredKey;
    try {
      const getBaseTitle = (t: string) => {
        if (!t) return "";
        return t.replace(/\[[^\]]+\]/g, "").replace(/\([^\)]+\)/g, "").trim().toLowerCase();
      };
      const currentBase = getBaseTitle(title);

      // First check episodes progress history for this specific episode
      const savedEps = localStorage.getItem("mbx:episodes_progress");
      if (savedEps) {
        const epHistory = JSON.parse(savedEps);
        const epItem = epHistory.find(
          (item: any) => {
            const isMatch = allIds.has(String(item.id)) || (currentBase && item.title && getBaseTitle(item.title) === currentBase);
            return isMatch && item.season === season && item.episode === episode;
          }
        );
        if (
          epItem &&
          epItem.progress > 10 &&
          epItem.progress < epItem.duration * 0.95
        ) {
          previousTimeRef.current = epItem.progress;
          return;
        }
      }

      // Fallback: Check continue watching history
      const saved = localStorage.getItem("mbx:continue_watching");
      if (saved) {
        const history = JSON.parse(saved);
        const progressItem = history.find(
          (item: any) => {
            const isMatch = allIds.has(String(item.id)) || (currentBase && item.title && getBaseTitle(item.title) === currentBase);
            return isMatch && (!season || item.season === season) && (!episode || item.episode === episode);
          }
        );
        if (
          progressItem &&
          progressItem.progress > 10 &&
          progressItem.progress < progressItem.duration * 0.95
        ) {
          previousTimeRef.current = progressItem.progress;
        }
      }
    } catch (e) {
      console.error("Failed to restore progress", e);
    }
  }, [allIds, season, episode, title]);

  // 2. Throttle saving playback progress to localStorage every 5 seconds
  useEffect(() => {
    if (!id) return;

    const interval = setInterval(() => {
      if (!videoRef.current) return;
      const current = videoRef.current.currentTime;
      const dur = videoRef.current.duration;
      
      if (dur <= 0 || current < 3) return;

      try {
        const getBaseTitle = (t: string) => {
          if (!t) return "";
          return t.replace(/\[[^\]]+\]/g, "").replace(/\([^\)]+\)/g, "").trim().toLowerCase();
        };
        const currentBase = getBaseTitle(title);

        // Save to general Continue Watching history
        const saved = localStorage.getItem("mbx:continue_watching");
        const history = saved ? JSON.parse(saved) : [];
        const filtered = history.filter((item: any) => {
          const isMatch = allIds.has(String(item.id)) || (currentBase && item.title && getBaseTitle(item.title) === currentBase && item.mediaType === mediaType);
          return !isMatch;
        });

        // Only save progress if less than 95% watched
        if (current / dur < 0.95) {
          filtered.unshift({
            id,
            title,
            episodeTitle,
            mediaType,
            season,
            episode,
            progress: current,
            duration: dur,
            posterPath,
            updatedAt: Date.now(),
          });
          if (filtered.length > 12) {
            filtered.pop();
          }
        }
        localStorage.setItem("mbx:continue_watching", JSON.stringify(filtered));

        // Save to individual Episodes Progress history
        const savedEps = localStorage.getItem("mbx:episodes_progress");
        const epHistory = savedEps ? JSON.parse(savedEps) : [];
        const filteredEps = epHistory.filter(
          (item: any) => {
            const isMatch = allIds.has(String(item.id)) || (currentBase && item.title && getBaseTitle(item.title) === currentBase);
            return !(isMatch && item.season === season && item.episode === episode);
          }
        );

        if (current / dur < 0.95) {
          filteredEps.unshift({
            id,
            title,
            season,
            episode,
            progress: current,
            duration: dur,
            updatedAt: Date.now(),
          });
          if (filteredEps.length > 100) {
            filteredEps.pop();
          }
          // Update local state to immediately show updated progress bar in the episode drawer
          setEpisodesProgress((prev) => ({
            ...prev,
            [`${season}:${episode}`]: { progress: current, duration: dur }
          }));
        } else {
          // If finished, remove from local progress map
          setEpisodesProgress((prev) => {
            const next = { ...prev };
            delete next[`${season}:${episode}`];
            return next;
          });
        }
        localStorage.setItem("mbx:episodes_progress", JSON.stringify(filteredEps));
      } catch (e) {
        console.error("Failed to save progress", e);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [
    id,
    allIds,
    title,
    episodeTitle,
    mediaType,
    season,
    episode,
    posterPath,
  ]);

  // Track changes to selectedFile and files to save current playback progress and play state *before* switching sources
  useEffect(() => {
    if (selectedFile?.stream_link) {
      if (videoRef.current && videoUrl) {
        // If files array is the same, we are just switching quality. Preserve progress!
        if (files === lastFilesRef.current) {
          previousTimeRef.current = activeTimeRef.current;
          wasPlayingRef.current = isPlayingRef.current;
      } else {
        // New episode or movie: reset progress and auto-play.
        // Skip the reset when a restore just ran for this same episode,
        // otherwise the restored resume position would be wiped.
        if (restoredKeyRef.current !== `${title ?? ""}:${mediaType}:${season ?? 0}:${episode ?? 0}`) {
          previousTimeRef.current = 0;
          restoredKeyRef.current = null;
        }
        activeTimeRef.current = 0;
        setCurrentTime(0);
        wasPlayingRef.current = true;
      }
      } else {
        // Initial load: Preserve previousTimeRef.current (from localStorage)
        activeTimeRef.current = 0;
        setCurrentTime(0);
        wasPlayingRef.current = true;
      }
      lastFilesRef.current = files;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVideoUrl(selectedFile.stream_link);
      setIsLoading(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile, files]);

  const handleSettingsToggle = () => {
    setShowSettings(!showSettings);
    setSettingsTab("main");
  };

  const handleSpeedChange = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
    setShowSettings(false);
  };

  // Reset countdown cancellation state when starting a new episode
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsCountdownCancelled(false);
    setShowCountdownToast(false);
    setCountdown(null);
  }, [files]);

  // Handle mouse move to auto-hide controls
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying && !showSettings) {
        setShowControls(false);
      }
    }, 2500);
  };

  // Handle mouse leaving the player - hide with a smooth delay instead of instantly
  const handleMouseLeave = () => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying && !showSettings) {
        setShowControls(false);
      }
    }, 1200);
  };

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
      }
    };
  }, []);



  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch((err) => console.error("Play error:", err));
    }
  };

  const handleControlsClick = () => {
    togglePlay();
  };

  const skip = (seconds: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime += seconds;
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    // Prevent UI timeline from jumping to 0:00 during quality switches
    if (isLoading && previousTimeRef.current > 0 && videoRef.current.currentTime === 0) {
      return;
    }

    const curTime = videoRef.current.currentTime;
    if (!isScrubbingRef.current) {
      setCurrentTime(curTime);
    }
    activeTimeRef.current = curTime;

    // Trigger Next Episode Autoplay Toast when remaining time <= 20 seconds
    if (onNextEpisode && duration > 0) {
      const remaining = duration - curTime;
      if (remaining <= 20 && remaining > 0) {
        if (!showCountdownToast) {
          setShowCountdownToast(true);
        }
        setCountdown(Math.ceil(remaining));
      } else {
        setShowCountdownToast(false);
        setCountdown(null);
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration);
    if (previousTimeRef.current > 0) {
      try {
        videoRef.current.currentTime = previousTimeRef.current;
      } catch {}
    }
  };

  const handleCanPlay = () => {
    if (!videoRef.current) return;
    setIsLoading(false);

    // Signal that the stream is ready (used to dismiss the branding intro)
    onReady?.();

    // Restore previous playback progress if switching qualities
    if (previousTimeRef.current > 0) {
      try {
        videoRef.current.currentTime = previousTimeRef.current;
      } catch {}
      previousTimeRef.current = 0; // reset
    }

    // Restore or trigger play state
    if (wasPlayingRef.current) {
      videoRef.current
        .play()
        .then(() => {
          wasPlayingRef.current = false;
        })
        .catch((err: DOMException) => {
          if (err?.name === "NotAllowedError") {
            videoRef.current!.muted = true;
            setIsMuted(true);
            videoRef.current!.play().catch(() => setIsPlaying(false));
          } else {
            setIsPlaying(false);
          }
          wasPlayingRef.current = false;
        });
    }
  };

  const handleVideoError = () => {
    setIsLoading(false);
    setShowSpinner(false);
    setVideoError(true);
  };

  const handleVideoRetry = () => {
    if (!videoRef.current || !videoUrl) return;
    setVideoError(false);
    setIsLoading(true);
    videoRef.current.load();
    videoRef.current.play().catch(() => setIsPlaying(false));
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    setIsMuted(newVol === 0);
    if (videoRef.current) {
      videoRef.current.volume = newVol;
      videoRef.current.muted = newVol === 0;
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const nextMute = !isMutedRef.current;
    setIsMuted(nextMute);
    videoRef.current.muted = nextMute;
    if (!nextMute && volume === 0) {
      setVolume(0.5);
      videoRef.current.volume = 0.5;
    }
  };

  const handleTimelineChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    videoRef.current.currentTime = newTime;
  };

  const handleScrubStart = () => {
    isScrubbingRef.current = true;
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
  };

  const handleScrubEnd = () => {
    isScrubbingRef.current = false;
    handleMouseMove();
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!isFullscreenRef.current) {
      const el = containerRef.current as HTMLDivElement & {
        webkitRequestFullscreen?: () => Promise<void> | void;
      };
      if (el.requestFullscreen) {
        el.requestFullscreen().catch(() => {});
      } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
      }
    } else {
      const doc = document as Document & { webkitExitFullscreen?: () => void };
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen();
      }
    }
  };

  const handleVideoEnded = () => {
    setIsPlaying(false);
    if (onNextEpisode) {
      onNextEpisode();
    }
  };

  // Listen for fullscreen change events (e.g. user hits Escape)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Listen to keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const active = document.activeElement as HTMLElement | null;
      const tag = active?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        active?.isContentEditable ||
        (target && target.closest("a, button, input, textarea, select, [contenteditable]") && e.code !== "Escape")
      ) {
        return;
      }

      if (e.code === "Escape") {
        if (showEpisodesDrawer) {
          setShowEpisodesDrawer(false);
        } else if (showSettings) {
          setShowSettings(false);
        }
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        skip(-10);
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        skip(10);
      } else if (e.code === "KeyF") {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.code === "KeyM") {
        e.preventDefault();
        toggleMute();
      } else if (e.code === "KeyN" && onNextEpisode) {
        e.preventDefault();
        onNextEpisode();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, onNextEpisode, showEpisodesDrawer, showSettings]);

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const hrs = Math.floor(time / 3600);
    const mins = Math.floor((time % 3600) / 60);
    const secs = Math.floor(time % 60);

    const formattedSecs = secs < 10 ? `0${secs}` : secs;

    if (hrs > 0) {
      const formattedMins = mins < 10 ? `0${mins}` : mins;
      return `${hrs}:${formattedMins}:${formattedSecs}`;
    }
    return `${mins}:${formattedSecs}`;
  };

  return (
    <div
      ref={containerRef}
      className={`${styles.playerContainer} ${fillParent ? styles.fillParent : ""} ${isFullscreen ? styles.fullscreen : ""}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Video Element */}
      {videoUrl ? (
        <video
          ref={videoRef}
          src={videoUrl}
          className={styles.video}
          onClick={() => {
            if (clickTimerRef.current) return;
            clickTimerRef.current = setTimeout(() => {
              clickTimerRef.current = null;
              togglePlay();
            }, 220);
          }}
          onDoubleClick={() => {
            if (clickTimerRef.current) {
              clearTimeout(clickTimerRef.current);
              clickTimerRef.current = null;
            }
            toggleFullscreen();
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => {
            setIsPlaying(false);
            setIsLoading(false); // Clear loading state instantly on pause
          }}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onCanPlay={handleCanPlay}
          onWaiting={() => {
            if (videoRef.current && !videoRef.current.paused) {
              setIsLoading(true); // Only trigger buffering if not paused
            }
          }}
          onPlaying={() => setIsLoading(false)}
          onEnded={handleVideoEnded}
          onError={handleVideoError}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          {...({ referrerPolicy: "no-referrer" } as any)}
          autoPlay
          playsInline
        />
      ) : (
        <div className={styles.noSource}>Loading streaming source...</div>
      )}

      {/* Stream error overlay with retry */}
      {videoError && (
        <div className={styles.errorOverlay}>
          <span className={styles.errorText}>Stream failed to load</span>
          <button onClick={handleVideoRetry} className={styles.errorRetryBtn}>
            Try Again
          </button>
        </div>
      )}

      {/* Loading Overlay — only after the grace period (deferred spinner) */}
      {showSpinner && (
        <div className={styles.loadingOverlay}>
          <Loader2 size={48} strokeWidth={1.5} className={styles.spinner} />
          <span style={{ fontSize: "0.9rem", opacity: 0.85 }}>Loading stream…</span>
        </div>
      )}

      {/* Big Play Overlay (Netflix/YouTube style) — hidden while the spinner shows */}
      {!isPlaying && videoUrl && !showSpinner && (
        <div className={styles.bigPlayOverlay} onClick={togglePlay}>
          <div className={styles.bigPlayButton}>
            <svg viewBox="0 0 24 24" width="36" height="36" fill="currentColor" className={styles.bigPlayIcon}>
              <path d="M7 5.72c0-1.07 1.17-1.72 2.08-1.15l10.04 6.28c.83.52.83 1.78 0 2.3l-10.04 6.28c-.91.57-2.08-.08-2.08-1.15V5.72z" />
            </svg>
          </div>
        </div>
      )}

      {/* Mobile Center Controls Overlay — active when controls are visible */}
      {videoUrl && (
        <div className={`${styles.mobileCenterControls} ${showControls ? styles.mobileCenterControlsVisible : ""}`} onClick={(e) => e.stopPropagation()}>
          <button onClick={() => skip(-10)} className={styles.mobileCenterButton} title="Skip back 10s">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" clipRule="evenodd" d="M11.0198 2.04817C13.3222 1.8214 15.6321 2.39998 17.5557 3.68532C19.4794 4.97067 20.8978 6.88324 21.5694 9.09718C22.241 11.3111 22.1242 13.6894 21.2388 15.8269C20.3534 17.9643 18.7543 19.7286 16.714 20.8192C14.6736 21.9098 12.3182 22.2592 10.0491 21.8079C7.77999 21.3565 5.73759 20.1323 4.26989 18.3439C2.80219 16.5555 2 14.3136 2 12L0 12C-2.74181e-06 14.7763 0.962627 17.4666 2.72387 19.6127C4.48511 21.7588 6.93599 23.2278 9.65891 23.7694C12.3818 24.3111 15.2083 23.8918 17.6568 22.5831C20.1052 21.2744 22.0241 19.1572 23.0866 16.5922C24.149 14.0273 24.2892 11.1733 23.4833 8.51661C22.6774 5.85989 20.9752 3.56479 18.6668 2.02238C16.3585 0.479975 13.5867 -0.214319 10.8238 0.057802C8.71195 0.2658 6.70517 1.02859 5 2.2532V1H3V5C3 5.55229 3.44772 6 4 6H8V4H5.99999C7.45608 2.90793 9.19066 2.22833 11.0198 2.04817ZM2 4V7H5V9H1C0.447715 9 0 8.55229 0 8V4H2ZM14.125 16C13.5466 16 13.0389 15.8586 12.6018 15.5758C12.1713 15.2865 11.8385 14.8815 11.6031 14.3609C11.3677 13.2135 11.25 13.2135 11.25 12.5C11.25 11.7929 11.3677 11.1759 11.6031 10.6488C11.8385 10.1217 12.1713 9.71671 12.6018 9.43389C13.0389 9.14463 13.5466 9 14.125 9C14.7034 9 15.2077 9.14463 15.6382 9.43389C16.0753 9.71671 16.4116 10.1217 16.6469 10.6488C16.8823 11.1759 17 11.7929 17 12.5C17 13.2135 16.8823 13.8338 16.6469 14.3609C16.4116 14.8815 16.0753 15.2865 15.6382 15.5758C15.2077 15.8586 14.7034 16 14.125 16ZM14.125 14.6501C14.5151 14.6501 14.8211 14.4637 15.043 14.0909C15.2649 13.7117 15.3759 13.1814 15.3759 12.5C15.3759 11.8186 15.2649 11.2916 15.043 10.9187C14.8211 10.5395 14.5151 10.3499 14.125 10.3499C13.7349 10.3499 13.4289 10.5395 13.207 10.9187C12.9851 11.2916 12.8741 11.8186 12.8741 12.5C12.8741 13.1814 12.9851 13.7117 13.207 14.0909C13.4289 14.4637 13.7349 14.6501 14.125 14.6501ZM8.60395 10.7163V15.8554H10.1978V9.01928L7 9.81956V11.1405L8.60395 10.7163Z" fill="currentColor" />
            </svg>
          </button>
          
          <button onClick={togglePlay} className={styles.mobileCenterPlayButton} title={isPlaying ? "Pause" : "Play"}>
            {isPlaying ? (
              <svg viewBox="0 0 24 24" width="36" height="36" fill="currentColor">
                <path d="M6 6c0-1.1.9-2 2-2s2 .9 2 2v12c0 1.1-.9 2-2 2s-2-.9-2-2V6zm8 0c0-1.1.9-2 2-2s2 .9 2 2v12c0 1.1-.9 2-2 2s-2-.9-2-2V6z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="36" height="36" fill="currentColor">
                <path d="M7 5.72c0-1.07 1.17-1.72 2.08-1.15l10.04 6.28c.83.52.83 1.78 0 2.3l-10.04 6.28c-.91.57-2.08-.08-2.08-1.15V5.72z" />
              </svg>
            )}
          </button>
          
          <button onClick={() => skip(10)} className={styles.mobileCenterButton} title="Skip forward 10s">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" clipRule="evenodd" d="M6.4443 3.68532C8.36794 2.39998 10.6778 1.8214 12.9802 2.04817C14.8093 2.22833 16.5439 2.90793 18 4H16V6H20C20.5523 6 21 5.55228 21 5V1H19V2.2532C17.2948 1.02858 15.288 0.265799 13.1762 0.0578004C10.4133 -0.214321 7.64153 0.479973 5.33315 2.02238C3.02478 3.56479 1.32262 5.85989 0.516716 8.51661C-0.28919 11.1733 -0.148983 14.0273 0.913448 16.5922C1.97588 19.1572 3.8948 21.2744 6.34325 22.5831C8.79169 23.8918 11.6182 24.3111 14.3411 23.7694C17.064 23.2278 19.5149 21.7588 21.2761 19.6127C23.0374 17.4666 24 14.7763 24 12L22 12C22 14.3136 21.1978 16.5555 19.7301 18.3439C18.2624 20.1323 16.22 21.3565 13.9509 21.8079C11.6818 22.2592 9.32641 21.9098 7.28604 20.8192C5.24567 19.7286 3.64657 17.9643 2.76121 15.8269C1.87585 13.6894 1.75901 11.3111 2.4306 9.09717C3.10218 6.88324 4.52065 4.97066 6.4443 3.68532ZM22 4V7H19V9H23C23.5523 9 24 8.55228 24 8V4H22ZM12.6018 15.5758C13.0389 15.8586 13.5466 16 14.125 16C14.7034 16 15.2077 15.8586 15.6382 15.5758C16.0753 15.2865 16.4116 14.8815 16.6469 14.3609C16.8823 13.8338 17 13.2135 17 12.5C17 11.7929 16.8823 11.1758 16.6469 10.6488C16.4116 10.1217 16.0753 9.71671 15.6382 9.43388C15.2077 9.14463 14.7034 9 14.125 9C14.7034 9 15.2077 9.14463 15.6382 9.43388C15.2077 9.14463 14.7034 9 14.125 9C13.5466 9 13.0389 9.14463 12.6018 9.43388C12.1713 9.71671 11.8385 10.1217 11.6031 10.6488C11.3677 11.1758 11.25 11.7929 11.25 12.5C11.25 13.2135 11.3677 13.8338 11.6031 14.3609C11.8385 14.8815 12.1713 15.2865 12.6018 15.5758ZM15.043 14.0909C14.8211 14.4637 14.5151 14.6501 14.125 14.6501C13.7349 14.6501 13.4289 14.4637 13.207 14.0909C12.9851 13.7117 15.3759 13.1814 15.3759 12.5C15.3759 11.8186 15.2649 11.2916 15.043 10.9187C14.8211 10.5395 14.5151 10.3499 14.125 10.3499C13.7349 10.3499 13.4289 10.5395 13.207 10.9187C12.9851 11.2916 12.8741 11.8186 12.8741 12.5C12.8741 13.1814 12.9851 13.7117 13.207 14.0909C13.4289 14.4637 13.7349 14.6501 14.125 14.6501ZM8.60395 10.7163V15.8554H10.1978V9.01928L7 9.81956V11.1405L8.60395 10.7163Z" fill="currentColor" />
            </svg>
          </button>
        </div>
      )}


      {/* Play Next Episode Countdown Toast (Netflix Style) */}
      {showCountdownToast && !isCountdownCancelled && onNextEpisode && (
        <div className={styles.nextToastContainer} onClick={(e) => e.stopPropagation()}>
          <div className={styles.toastLabel}>Next Episode Playing in</div>
          <div className={styles.toastTimerRow}>
            <div className={styles.toastCountdownNum}>{countdown}</div>
            <div className={styles.toastDetails}>
              <div className={styles.toastNextLabel}>Next Up:</div>
              <div className={styles.toastEpisodeTitle}>{nextEpisodeTitle || "Next Episode"}</div>
            </div>
          </div>
          <div className={styles.toastActions}>
            <button 
              onClick={() => onNextEpisode()}
              className={styles.toastPlayBtn}
            >
              Play Now
            </button>
            <button 
              onClick={() => setIsCountdownCancelled(true)}
              className={styles.toastCancelBtn}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Controls Overlay */}
      <div 
        className={`${styles.controlsWrapper} ${showControls ? styles.visible : ""}`}
        onClick={handleControlsClick}
      >
        {/* Top Header */}
        <div className={styles.playerHeader} onClick={(e) => e.stopPropagation()}>
          {backHref && (
            <Link href={backHref} className={styles.backArrow} title="Back to details">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
            </Link>
          )}
          <div className={styles.headerTitles}>
            <h2>{title}</h2>
            {episodeTitle && <span className={styles.headerEpisode}>{episodeTitle}</span>}
          </div>
        </div>

        {/* Bottom Controls Group */}
        <div className={styles.bottomControlsGroup} onClick={(e) => e.stopPropagation()}>
          {/* Timeline Slider */}
          <div className={styles.timelineContainer}>
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={handleTimelineChange}
              onPointerDown={handleScrubStart}
              onPointerUp={handleScrubEnd}
              onPointerCancel={handleScrubEnd}
              onKeyDown={handleScrubEnd}
              aria-label="Seek"
              className={styles.timeline}
              style={{
                background: `linear-gradient(to right, var(--accent-color) 0%, var(--accent-color) ${
                  (currentTime / (duration || 1)) * 100
                }%, rgba(255, 255, 255, 0.2) ${(currentTime / (duration || 1)) * 100}%, rgba(255, 255, 255, 0.2) 100%)`,
              }}
            />
          </div>

          {/* Bottom Control Bar */}
          <div className={styles.controlBar}>
            <div className={styles.leftControls}>
              {/* Play/Pause */}
              <button onClick={togglePlay} className={styles.iconButton} title={isPlaying ? "Pause" : "Play"}>
                {isPlaying ? (
                  <svg viewBox="0 0 24 24" width="34" height="34" fill="currentColor">
                    <path d="M6 6c0-1.1.9-2 2-2s2 .9 2 2v12c0 1.1-.9 2-2 2s-2-.9-2-2V6zm8 0c0-1.1.9-2 2-2s2 .9 2 2v12c0 1.1-.9 2-2 2s-2-.9-2-2V6z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="34" height="34" fill="currentColor">
                    <path d="M7 5.72c0-1.07 1.17-1.72 2.08-1.15l10.04 6.28c.83.52.83 1.78 0 2.3l-10.04 6.28c-.91.57-2.08-.08-2.08-1.15V5.72z" />
                  </svg>
                )}
              </button>

              {/* Skip 10s Back */}
              <button onClick={() => skip(-10)} className={styles.iconButton} title="Skip back 10s">
                <svg viewBox="0 0 24 24" width="34" height="34" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" clipRule="evenodd" d="M11.0198 2.04817C13.3222 1.8214 15.6321 2.39998 17.5557 3.68532C19.4794 4.97067 20.8978 6.88324 21.5694 9.09718C22.241 11.3111 22.1242 13.6894 21.2388 15.8269C20.3534 17.9643 18.7543 19.7286 16.714 20.8192C14.6736 21.9098 12.3182 22.2592 10.0491 21.8079C7.77999 21.3565 5.73759 20.1323 4.26989 18.3439C2.80219 16.5555 2 14.3136 2 12L0 12C-2.74181e-06 14.7763 0.962627 17.4666 2.72387 19.6127C4.48511 21.7588 6.93599 23.2278 9.65891 23.7694C12.3818 24.3111 15.2083 23.8918 17.6568 22.5831C20.1052 21.2744 22.0241 19.1572 23.0866 16.5922C24.149 14.0273 24.2892 11.1733 23.4833 8.51661C22.6774 5.85989 20.9752 3.56479 18.6668 2.02238C16.3585 0.479975 13.5867 -0.214319 10.8238 0.057802C8.71195 0.2658 6.70517 1.02859 5 2.2532V1H3V5C3 5.55229 3.44772 6 4 6H8V4H5.99999C7.45608 2.90793 9.19066 2.22833 11.0198 2.04817ZM2 4V7H5V9H1C0.447715 9 0 8.55229 0 8V4H2ZM14.125 16C13.5466 16 13.0389 15.8586 12.6018 15.5758C12.1713 15.2865 11.8385 14.8815 11.6031 14.3609C11.3677 13.8338 11.25 13.2135 11.25 12.5C11.25 11.7929 11.3677 11.1759 11.6031 10.6488C11.8385 10.1217 12.1713 9.71671 12.6018 9.43389C13.0389 9.14463 13.5466 9 14.125 9C14.7034 9 15.2077 9.14463 15.6382 9.43389C16.0753 9.71671 16.4116 10.1217 16.6469 10.6488C16.8823 11.1759 17 11.7929 17 12.5C17 13.2135 16.8823 13.8338 16.6469 14.3609C16.4116 14.8815 16.0753 15.2865 15.6382 15.5758C15.2077 15.8586 14.7034 16 14.125 16ZM14.125 14.6501C14.5151 14.6501 14.8211 14.4637 15.043 14.0909C15.2649 13.7117 15.3759 13.1814 15.3759 12.5C15.3759 11.8186 15.2649 11.2916 15.043 10.9187C14.8211 10.5395 14.5151 10.3499 14.125 10.3499C13.7349 10.3499 13.4289 10.5395 13.207 10.9187C12.9851 11.2916 12.8741 11.8186 12.8741 12.5C12.8741 13.1814 12.9851 13.7117 13.207 14.0909C13.4289 14.4637 13.7349 14.6501 14.125 14.6501ZM8.60395 15.8554H10.1978V9.01928L7 9.81956V11.1405L8.60395 10.7163Z" fill="currentColor" />
                </svg>
              </button>

              {/* Skip 10s Forward */}
              <button onClick={() => skip(10)} className={styles.iconButton} title="Skip forward 10s">
                <svg viewBox="0 0 24 24" width="34" height="34" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" clipRule="evenodd" d="M6.4443 3.68532C8.36794 2.39998 10.6778 1.8214 12.9802 2.04817C14.8093 2.22833 16.5439 2.90793 18 4H16V6H20C20.5523 6 21 5.55228 21 5V1H19V2.2532C17.2948 1.02858 15.288 0.265799 13.1762 0.0578004C10.4133 -0.214321 7.64153 0.479973 5.33315 2.02238C3.02478 3.56479 1.32262 5.85989 0.516716 8.51661C-0.28919 11.1733 -0.148983 14.0273 0.913448 16.5922C1.97588 19.1572 3.8948 21.2744 6.34325 22.5831C8.79169 23.8918 11.6182 24.3111 14.3411 23.7694C17.064 23.2278 19.5149 21.7588 21.2761 19.6127C23.0374 17.4666 24 14.7763 24 12L22 12C22 14.3136 21.1978 16.5555 19.7301 18.3439C18.2624 20.1323 16.22 21.3565 13.9509 21.8079C11.6818 22.2592 9.32641 21.9098 7.28604 20.8192C5.24567 19.7286 3.64657 17.9643 2.76121 15.8269C1.87585 13.6894 1.75901 11.3111 2.4306 9.09717C3.10218 6.88324 4.52065 4.97066 6.4443 3.68532ZM22 4V7H19V9H23C23.5523 9 24 8.55228 24 8V4H22ZM12.6018 15.5758C13.0389 15.8586 13.5466 16 14.125 16C14.7034 16 15.2077 15.8586 15.6382 15.5758C16.0753 15.2865 16.4116 14.8815 16.6469 14.3609C16.8823 13.8338 17 13.2135 17 12.5C17 11.7929 16.8823 11.1758 16.6469 10.6488C16.4116 10.1217 16.0753 9.71671 15.6382 9.43388C15.2077 9.14463 14.7034 9 14.125 9C14.7034 9 15.2077 9.14463 15.6382 9.43388C15.2077 9.14463 14.7034 9 14.125 9C13.5466 9 13.0389 9.14463 12.6018 9.43388C12.1713 9.71671 11.8385 10.1217 11.6031 10.6488C11.3677 11.1758 11.25 11.7929 11.25 12.5C11.25 13.2135 11.3677 13.8338 11.6031 14.3609C11.8385 14.8815 12.1713 15.2865 12.6018 15.5758ZM15.043 14.0909C14.8211 14.4637 14.5151 14.6501 14.125 14.6501C13.7349 14.6501 13.4289 14.4637 13.207 14.0909C12.9851 13.7117 15.3759 13.1814 15.3759 12.5C15.3759 11.8186 15.2649 11.2916 15.043 10.9187C14.8211 10.5395 14.5151 10.3499 14.125 10.3499C13.7349 10.3499 13.4289 10.5395 13.207 10.9187C12.9851 11.2916 12.8741 11.8186 12.8741 12.5C12.8741 13.1814 12.9851 13.7117 13.207 14.0909C13.4289 14.4637 13.7349 14.6501 14.125 14.6501ZM8.60395 10.7163V15.8554H10.1978V9.01928L7 9.81956V11.1405L8.60395 10.7163Z" fill="currentColor" />
                </svg>
              </button>

              {/* Next Episode (Skip Forward) Button */}
              {onNextEpisode && (
                <button 
                  onClick={() => onNextEpisode()} 
                  className={styles.iconButton}
                  title={`Next Episode: ${nextEpisodeTitle || "Play Next"}`}
                >
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.75">
                      <path d="M5 4l10 8-10 8V4z" fill="currentColor" />
                      <path d="M19 5v14" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                  </span>
                </button>
              )}

              {/* Volume controls */}
              <div className={styles.volumeContainer}>
                <button onClick={toggleMute} className={styles.iconButton} title={isMuted ? "Unmute" : "Mute"}>
                  {isMuted ? (
                    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 5L6 9H2v6h4l5 4V5z" fill="currentColor" />
                      <line x1="23" y1="9" x2="17" y2="15" />
                      <line x1="17" y1="9" x2="23" y2="15" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 5L6 9H2v6h4l5 4V5z" fill="currentColor" />
                      {volume > 0.5 ? (
                        <>
                          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                        </>
                      ) : (
                        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                      )}
                    </svg>
                  )}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  aria-label="Volume"
                  className={styles.volumeSlider}
                />
              </div>

              {/* Time display */}
              <div className={styles.timeDisplay}>
                <span>{formatTime(currentTime)}</span>
                <span className={styles.timeDivider}>/</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            <div className={styles.rightControls}>
              {/* Episodes List Drawer Toggle */}
              {mediaType === "tv" && episodes && episodes.length > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowEpisodesDrawer(!showEpisodesDrawer);
                    setShowSettings(false); // Close settings if open
                  }}
                  className={`${styles.iconButton} ${showEpisodesDrawer ? styles.activeIcon : ""}`}
                  title="Episodes List"
                >
                  <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="8" y1="6" x2="21" y2="6" />
                    <line x1="8" y1="12" x2="21" y2="12" />
                    <line x1="8" y1="18" x2="21" y2="18" />
                    <line x1="3" y1="6" x2="3.01" y2="6" strokeWidth="2.5" />
                    <line x1="3" y1="12" x2="3.01" y2="12" strokeWidth="2.5" />
                    <line x1="3" y1="18" x2="3.01" y2="18" strokeWidth="2.5" />
                  </svg>
                </button>
              )}

              {/* Quality & Speed Settings */}
              <div className={styles.settingsWrapper}>
                <button
                  onClick={handleSettingsToggle}
                  className={`${styles.iconButton} ${showSettings ? styles.activeIcon : ""}`}
                  title="Playback Settings"
                >
                  <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </button>

                {showSettings && (
                  <div className={styles.settingsMenu}>
                    {settingsTab === "main" && (
                      <>
                        <div className={styles.menuHeader}>Playback Settings</div>
                        <div className={styles.menuList}>
                          <button
                            onClick={() => setSettingsTab("quality")}
                            className={styles.menuItem}
                          >
                            <span className={styles.bullet}></span>
                            <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                              <span>Quality</span>
                              <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", opacity: 0.7 }}>
                                {selectedFile?.resolution || "Auto"} ›
                              </span>
                            </div>
                          </button>
                          <button
                            onClick={() => setSettingsTab("speed")}
                            className={styles.menuItem}
                          >
                            <span className={styles.bullet}></span>
                            <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                              <span>Speed</span>
                              <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", opacity: 0.7 }}>
                                {playbackRate === 1 ? "Normal" : `${playbackRate}x`} ›
                              </span>
                            </div>
                          </button>
                        </div>
                      </>
                    )}

                    {settingsTab === "quality" && (
                      <>
                        <button
                          onClick={() => setSettingsTab("main")}
                          className={styles.menuHeaderBack}
                        >
                          ‹ Streaming Quality
                        </button>
                        <div className={styles.menuList}>
                          {files.map((file) => {
                            const isCurrent = selectedFile?.id === file.id;
                            return (
                              <button
                                key={file.id}
                                onClick={() => {
                                  onQualityChange(file);
                                  setShowSettings(false);
                                }}
                                className={`${styles.menuItem} ${isCurrent ? styles.activeItem : ""}`}
                              >
                                <span className={styles.bullet}></span>
                                <span>
                                  {file.resolution} ({file.size_mb} MB)
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}

                    {settingsTab === "speed" && (
                      <>
                        <button
                          onClick={() => setSettingsTab("main")}
                          className={styles.menuHeaderBack}
                        >
                          ‹ Playback Speed
                        </button>
                        <div className={styles.menuList}>
                          {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((rate) => {
                            const isCurrent = playbackRate === rate;
                            return (
                              <button
                                key={rate}
                                onClick={() => handleSpeedChange(rate)}
                                className={`${styles.menuItem} ${isCurrent ? styles.activeItem : ""}`}
                              >
                                <span className={styles.bullet}></span>
                                <span>
                                  {rate === 1 ? "Normal (1x)" : `${rate}x`}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Fullscreen */}
              <button onClick={toggleFullscreen} className={styles.iconButton} title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
                {isFullscreen ? (
                  <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="4 14 10 14 10 20" />
                    <polyline points="20 10 14 10 14 4" />
                    <line x1="14" y1="10" x2="21" y2="3" />
                    <line x1="10" y1="14" x2="3" y2="21" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 3 21 3 21 9" />
                    <polyline points="9 21 3 21 3 15" />
                    <line x1="21" y1="3" x2="14" y2="10" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Episodes Drawer Overlay (sliding sidebar) */}
      {showEpisodesDrawer && mediaType === "tv" && episodes && episodes.length > 0 && (
        <div
          className={styles.episodesDrawer}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Episodes List"
        >
          <div className={styles.drawerHeader}>
            <h3>Episodes List</h3>
            <button
              onClick={() => setShowEpisodesDrawer(false)}
              className={styles.drawerCloseBtn}
              aria-label="Close episodes list"
            >
              ×
            </button>
          </div>
          <div className={styles.drawerList}>
            {episodes.map((ep: any) => {
              const isActive = ep.episode_number === currentEpisode;
              const progressKey = `${currentSeason}:${ep.episode_number}`;
              const progressInfo = episodesProgress[progressKey];
              return (
                <button
                  key={ep.episode_number}
                  onClick={() => {
                    if (onEpisodeChange && currentSeason) {
                      onEpisodeChange(currentSeason, ep.episode_number);
                      setShowEpisodesDrawer(false);
                    }
                  }}
                  className={`${styles.drawerItem} ${isActive ? styles.drawerItemActive : ""}`}
                >
                  <div style={{ display: "flex", gap: "12px", marginBottom: "8px", alignItems: "flex-start" }}>
                    <div style={{ position: "relative", width: "120px", flexShrink: 0, borderRadius: "6px", overflow: "hidden", aspectRatio: "16/9", backgroundColor: "rgba(255,255,255,0.1)" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img 
                        src={ep.still_path ? (ep.still_path.startsWith("http") ? ep.still_path : `https://image.tmdb.org/t/p/w300${ep.still_path}`) : (posterPath ? (posterPath.startsWith("http") ? posterPath : `https://image.tmdb.org/t/p/w500${posterPath}`) : "/placeholder.png")} 
                        alt={ep.name}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        loading="lazy"
                      />
                      <div style={{ position: "absolute", bottom: "4px", right: "4px", backgroundColor: "rgba(0,0,0,0.75)", color: "white", fontSize: "0.7rem", padding: "2px 4px", borderRadius: "4px" }}>
                        Ep {ep.episode_number}
                      </div>
                      {progressInfo && progressInfo.progress && progressInfo.duration ? (
                        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "3px", backgroundColor: "rgba(255,255,255,0.2)", zIndex: 10 }}>
                          <div style={{ width: `${(progressInfo.progress / progressInfo.duration) * 100}%`, height: "100%", backgroundColor: "var(--accent-color)" }} />
                        </div>
                      ) : null}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", flex: 1, textAlign: "left", gap: "4px" }}>
                      <span className={styles.drawerItemTitle} style={{ margin: 0, fontSize: "0.95rem" }}>{ep.name}</span>
                      {ep.runtime && <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{ep.runtime}m</span>}
                    </div>
                  </div>
                  {ep.overview && (
                    <p className={styles.drawerItemOverview} style={{ WebkitLineClamp: 2, display: "-webkit-box", WebkitBoxOrient: "vertical", overflow: "hidden", margin: 0 }}>{ep.overview}</p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

