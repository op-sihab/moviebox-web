"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Link from "next/link";
import styles from "./CustomVideoPlayer.module.css";
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Volume1,
  Maximize,
  Minimize,
  Settings,
  List,
  Languages,
  SkipForward,
  Check,
  ArrowLeft,
  Tv,
  Airplay,
  HelpCircle,
  Search,
  X,
} from "lucide-react";
import { matchesDubId, prefetchDownload } from "@/services/contentCache";

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
  fillParent?: boolean;
  backHref?: string;
  onReady?: () => void;
  dubs?: any[];
  onDubChange?: (dub: any) => void;
  brandingLogo?: string;
  brandingUrl?: string;
  showBranding?: boolean;
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
  onDubChange,
  brandingLogo,
  brandingUrl = "/",
  showBranding = true,
}: CustomVideoPlayerProps) {
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const [isFloating, setIsFloating] = useState(false);
  const [isFloatingDismissed, setIsFloatingDismissed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const [videoUrl, setVideoUrl] = useState<string>("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedTime, setBufferedTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showEpisodesDrawer, setShowEpisodesDrawer] = useState(false);
  const [showAudioDrawer, setShowAudioDrawer] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [settingsTab, setSettingsTab] = useState<"main" | "quality" | "speed" | "audio" | "aspect">("main");
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [showSpinner, setShowSpinner] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [aspectMode, setAspectMode] = useState<"contain" | "cover" | "fill">("contain");
  const [audioSearch, setAudioSearch] = useState("");

  // Action Splash (Center feedback for play/pause/skip)
  const [splashAction, setSplashAction] = useState<"play" | "pause" | null>(null);

  // Timeline Hover & Dragging
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPos, setHoverPos] = useState<number>(0);
  const [isDraggingTimeline, setIsDraggingTimeline] = useState(false);

  const spinnerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const SPINNER_DELAY_MS = 2500;

  // Autoplay Countdown States
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showCountdownToast, setShowCountdownToast] = useState(false);
  const [isCountdownCancelled, setIsCountdownCancelled] = useState(false);

  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousTimeRef = useRef(0);
  const pendingTimestampRef = useRef<number | null>(null);
  const isPlayingRef = useRef(false);
  const isScrubbingRef = useRef(false);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Floating Mini-Player when scrolled out of view
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isOutOfView = entry.intersectionRatio < 0.25;
        if (isOutOfView && isPlaying && !isFloatingDismissed) {
          setIsFloating(true);
        } else if (!isOutOfView) {
          setIsFloating(false);
          setIsFloatingDismissed(false);
        }
      },
      { threshold: [0.25] }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [isPlaying, isFloatingDismissed]);

  // Deferred Spinner
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
      setShowSpinner(false);
    }
    return () => {
      if (spinnerTimerRef.current) {
        clearTimeout(spinnerTimerRef.current);
        spinnerTimerRef.current = null;
      }
    };
  }, [isLoading]);

  // Sorted Dubs: Original first, other languages alphabetically
  const sortedDubs = useMemo(() => {
    if (!dubs || dubs.length === 0) return [];
    const audioDubs = dubs.filter(
      (d: any) => d.type === 0 || (!d.type && !d.isSub && !/\bsub\b/i.test(d.language_name || d.lanName || d.language || ""))
    );
    return [...audioDubs].sort((a: any, b: any) => {
      const aName = a?.displayName || a?.language_name || a?.language || a?.lanName || "";
      const bName = b?.displayName || b?.language_name || b?.language || b?.lanName || "";

      const aIsOrig = a?.is_original || a?.original || /original/i.test(aName);
      const bIsOrig = b?.is_original || b?.original || /original/i.test(bName);
      if (aIsOrig && !bIsOrig) return -1;
      if (!aIsOrig && bIsOrig) return 1;

      return aName.localeCompare(bName);
    });
  }, [dubs]);

  const filteredDubs = useMemo(() => {
    if (!audioSearch.trim()) return sortedDubs;
    const q = audioSearch.toLowerCase().trim();
    return sortedDubs.filter((d: any) => {
      const name = (d.displayName || d.language_name || d.lanName || d.language || "").toLowerCase();
      return name.includes(q);
    });
  }, [sortedDubs, audioSearch]);

  const currentDub = useMemo(() => {
    if (!sortedDubs || sortedDubs.length === 0) return null;
    const cleanId = String(id || "");

    // 1. Match ID directly or via unique slug hash
    const match = sortedDubs.find((d: any) => matchesDubId(d, cleanId));
    if (match) return match;

    // 2. Natural default: Original Audio
    const originalDub = sortedDubs.find(
      (d: any) => d.is_original || d.original || /original/i.test(d.displayName || d.language_name || d.lanName || d.language || "")
    );
    if (originalDub) return originalDub;

    // 3. Fallback to first audio dub
    return sortedDubs[0];
  }, [sortedDubs, id]);

  const currentDubName = useMemo(() => {
    if (!currentDub) return "";
    const name = currentDub.displayName || currentDub.language_name || currentDub.lanName || currentDub.language || "";
    if (currentDub.is_original || currentDub.original || /original/i.test(name)) return "Original";
    if (/hindi/i.test(name)) return "Hindi";
    return name.replace(/\bdub\b/gi, "").trim() || "Audio";
  }, [currentDub]);

  const allIds = useMemo(() => {
    const ids = new Set<string>();
    if (id) ids.add(String(id));
    if (dubs) {
      dubs.forEach((d: any) => {
        if (d.subject_id) ids.add(String(d.subject_id));
        if (d.subjectId) ids.add(String(d.subjectId));
        if (d.detail_path) ids.add(String(d.detail_path));
        if (d.detailPath) ids.add(String(d.detailPath));
      });
    }
    return ids;
  }, [id, dubs]);

  // Load progress
  const [episodesProgress, setEpisodesProgress] = useState<Record<string, { progress: number; duration: number }>>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem("mbx:episodes_progress");
      if (saved) {
        const history = JSON.parse(saved);
        const map: Record<string, { progress: number; duration: number }> = {};
        const getBaseTitle = (t: string) => {
          if (!t) return "";
          return t.replace(/[[^]]+]/g, "").replace(/([^)]+)/g, "").trim().toLowerCase();
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

  useEffect(() => {
    try {
      const getBaseTitle = (t: string) => {
        if (!t) return "";
        return t.replace(/[[^]]+]/g, "").replace(/([^)]+)/g, "").trim().toLowerCase();
      };
      const currentBase = getBaseTitle(title);

      const savedEps = localStorage.getItem("mbx:episodes_progress");
      if (savedEps) {
        const epHistory = JSON.parse(savedEps);
        const epItem = epHistory.find((item: any) => {
          const isMatch =
            allIds.has(String(item.id)) ||
            (currentBase && item.title && getBaseTitle(item.title) === currentBase);
          return isMatch && item.season === season && item.episode === episode;
        });
        if (epItem && epItem.progress > 10 && epItem.progress < epItem.duration * 0.95) {
          previousTimeRef.current = epItem.progress;
          return;
        }
      }

      const savedWatch = localStorage.getItem("mbx:continue_watching");
      if (savedWatch) {
        const list = JSON.parse(savedWatch);
        const match = list.find((item: any) => {
          const isMatch =
            allIds.has(String(item.id)) ||
            (currentBase && item.title && getBaseTitle(item.title) === currentBase);
          return (
            isMatch &&
            (mediaType === "movie" || (item.season === season && item.episode === episode))
          );
        });
        if (match && match.progress > 10 && match.progress < match.duration * 0.95) {
          previousTimeRef.current = match.progress;
          return;
        }
      }
    } catch (err) {
      console.error("Failed to read progress", err);
    }
  }, [id, season, episode, mediaType, title, allIds]);

  // Video URL and source syncing
  useEffect(() => {
    const newLink = selectedFile?.stream_link;
    if (!newLink) {
      setVideoUrl("");
      return;
    }

    if (newLink === videoUrl) return;

    if (videoRef.current && videoRef.current.currentTime > 0) {
      pendingTimestampRef.current = videoRef.current.currentTime;
    }

    setVideoUrl(newLink);
    setVideoError(false);

    // Only show full loading overlay on cold startup when there was no previous stream
    if (!videoUrl) {
      setIsLoading(true);
    }
  }, [selectedFile, videoUrl]);

  // Handle Video Metadata Loaded & Autoplay
  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    const dur = videoRef.current.duration;
    setDuration(dur);
    setIsLoading(false);

    // Switch native audio track if supported (Safari / macOS / iOS / multi-track media)
    try {
      const mediaEl = videoRef.current as any;
      if (mediaEl && mediaEl.audioTracks && mediaEl.audioTracks.length > 0) {
        const langCode = (currentDub?.language_code || currentDub?.lanCode || "").toLowerCase();
        const langName = (currentDub?.displayName || currentDub?.language_name || currentDub?.lanName || "").toLowerCase();
        for (let i = 0; i < mediaEl.audioTracks.length; i++) {
          const track = mediaEl.audioTracks[i];
          const tLang = (track.language || "").toLowerCase();
          const tLabel = (track.label || "").toLowerCase();
          const matches =
            (langCode && (tLang.includes(langCode) || tLabel.includes(langCode))) ||
            (langName && (tLabel.includes(langName) || tLang.includes(langName)));
          track.enabled = Boolean(matches);
        }
      }
    } catch {
      // AudioTrackList may be read-only in some environments
    }

    if (pendingTimestampRef.current && pendingTimestampRef.current > 0) {
      videoRef.current.currentTime = pendingTimestampRef.current;
      setCurrentTime(pendingTimestampRef.current);
      pendingTimestampRef.current = null;
    } else if (previousTimeRef.current > 0 && previousTimeRef.current < dur * 0.95) {
      videoRef.current.currentTime = previousTimeRef.current;
      setCurrentTime(previousTimeRef.current);
    }

    if (onReady) onReady();
    videoRef.current
      .play()
      .then(() => setIsPlaying(true))
      .catch(() => {
        // If browser blocks unmuted autoplay, mute and play smoothly
        if (videoRef.current) {
          videoRef.current.muted = true;
          setIsMuted(true);
          videoRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
        }
      });
  };

  const handleCanPlay = () => {
    setIsLoading(false);
    if (videoRef.current && pendingTimestampRef.current && pendingTimestampRef.current > 0) {
      videoRef.current.currentTime = pendingTimestampRef.current;
      pendingTimestampRef.current = null;
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const resetControlsTimeout = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlayingRef.current) {
      controlsTimeoutRef.current = setTimeout(() => {
        if (!showSettings && !showEpisodesDrawer && !showAudioDrawer && !showShortcutsModal) {
          setShowControls(false);
        }
      }, 3500);
    }
  }, [showSettings, showEpisodesDrawer, showAudioDrawer, showShortcutsModal]);

  const handleMouseMove = () => {
    resetControlsTimeout();
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const saveProgress = (curTime: number, dur: number) => {
    if (!curTime || !dur || dur <= 0 || curTime < 5) return;
    try {
      const savedEpisodes = localStorage.getItem("mbx:episodes_progress");
      let epList: any[] = savedEpisodes ? JSON.parse(savedEpisodes) : [];

      const currentItem = {
        id: String(id),
        title,
        mediaType,
        season: season || 1,
        episode: episode || 1,
        episodeTitle,
        posterPath,
        progress: curTime,
        duration: dur,
        updatedAt: Date.now(),
      };

      epList = epList.filter(
        (item: any) =>
          !(
            allIds.has(String(item.id)) &&
            item.season === (season || 1) &&
            item.episode === (episode || 1)
          )
      );
      epList.unshift(currentItem);
      if (epList.length > 100) epList.pop();
      localStorage.setItem("mbx:episodes_progress", JSON.stringify(epList));

      const key = `${season || 1}:${episode || 1}`;
      setEpisodesProgress((prev) => ({
        ...prev,
        [key]: { progress: curTime, duration: dur },
      }));

      const savedWatch = localStorage.getItem("mbx:continue_watching");
      let watchList: any[] = savedWatch ? JSON.parse(savedWatch) : [];
      watchList = watchList.filter((item: any) => !allIds.has(String(item.id)));
      watchList.unshift(currentItem);
      if (watchList.length > 50) watchList.pop();
      localStorage.setItem("mbx:continue_watching", JSON.stringify(watchList));
    } catch (err) {
      console.error("Failed to save progress", err);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current && !isScrubbingRef.current) {
      const cur = videoRef.current.currentTime;
      const dur = videoRef.current.duration;
      setCurrentTime(cur);

      if (videoRef.current.buffered.length > 0) {
        try {
          const bufEnd = videoRef.current.buffered.end(videoRef.current.buffered.length - 1);
          setBufferedTime(bufEnd);
        } catch {}
      }

      if (Math.floor(cur) % 5 === 0 && dur > 0) {
        saveProgress(cur, dur);
      }

      if (mediaType === "tv" && onNextEpisode && dur > 0 && dur - cur <= 15 && !isCountdownCancelled) {
        const remaining = Math.max(0, Math.ceil(dur - cur));
        setCountdown(remaining);
        setShowCountdownToast(true);
        if (remaining <= 1) {
          setShowCountdownToast(false);
          setCountdown(null);
          onNextEpisode();
        }
      } else {
        if (showCountdownToast && (dur - cur > 15 || isCountdownCancelled)) {
          setShowCountdownToast(false);
          setCountdown(null);
        }
      }
    }
  };

  // Immediate Click-To-Play / Pause
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
      setSplashAction("pause");
    } else {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(console.error);
      setSplashAction("play");
    }
    setTimeout(() => setSplashAction(null), 500);
    resetControlsTimeout();
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
    resetControlsTimeout();
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
    resetControlsTimeout();
  };

  const skip = (seconds: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(
      0,
      Math.min(duration, videoRef.current.currentTime + seconds)
    );
    resetControlsTimeout();
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(console.error);
    } else {
      document.exitFullscreen().catch(console.error);
    }
    resetControlsTimeout();
  };

  const togglePictureInPicture = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (e) {
      console.error("PiP error", e);
    }
    resetControlsTimeout();
  };

  // Timeline Dragging & Scrubbing
  const updateScrubTime = useCallback(
    (clientX: number) => {
      if (!timelineRef.current || !videoRef.current || duration <= 0) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const target = pos * duration;
      videoRef.current.currentTime = target;
      setCurrentTime(target);
      setHoverPos(clientX - rect.left);
      setHoverTime(target);
      if (previewVideoRef.current && Number.isFinite(target)) {
        try {
          previewVideoRef.current.currentTime = target;
        } catch {}
      }
    },
    [duration]
  );

  const handleTimelineMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    isScrubbingRef.current = true;
    setIsDraggingTimeline(true);
    updateScrubTime(e.clientX);

    const handleMouseMoveWindow = (moveEvent: MouseEvent) => {
      updateScrubTime(moveEvent.clientX);
    };

    const handleMouseUpWindow = (upEvent: MouseEvent) => {
      isScrubbingRef.current = false;
      setIsDraggingTimeline(false);
      updateScrubTime(upEvent.clientX);
      if (videoRef.current) {
        saveProgress(videoRef.current.currentTime, duration);
      }
      window.removeEventListener("mousemove", handleMouseMoveWindow);
      window.removeEventListener("mouseup", handleMouseUpWindow);
    };

    window.addEventListener("mousemove", handleMouseMoveWindow);
    window.addEventListener("mouseup", handleMouseUpWindow);
  };

  const handleTimelineMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || duration <= 0) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const target = pos * duration;
    setHoverPos(e.clientX - rect.left);
    setHoverTime(target);
    if (previewVideoRef.current && Number.isFinite(target)) {
      try {
        previewVideoRef.current.currentTime = target;
      } catch {}
    }
  };

  const handleTimelineMouseLeave = () => {
    if (!isDraggingTimeline) {
      setHoverTime(null);
    }
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }
      switch (e.key.toLowerCase()) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "arrowleft":
        case "j":
          e.preventDefault();
          skip(-10);
          break;
        case "arrowright":
        case "l":
          e.preventDefault();
          skip(10);
          break;
        case "arrowup":
          e.preventDefault();
          setVolume((v) => {
            const next = Math.min(1, v + 0.1);
            if (videoRef.current) {
              videoRef.current.volume = next;
              videoRef.current.muted = false;
            }
            setIsMuted(false);
            return next;
          });
          resetControlsTimeout();
          break;
        case "arrowdown":
          e.preventDefault();
          setVolume((v) => {
            const next = Math.max(0, v - 0.1);
            if (videoRef.current) {
              videoRef.current.volume = next;
              videoRef.current.muted = next === 0;
            }
            setIsMuted(next === 0);
            return next;
          });
          resetControlsTimeout();
          break;
        case "m":
          e.preventDefault();
          toggleMute();
          break;
        case "f":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "p":
          e.preventDefault();
          togglePictureInPicture();
          break;
        case "d":
        case "c":
          e.preventDefault();
          setShowAudioDrawer((prev) => !prev);
          setShowEpisodesDrawer(false);
          setShowSettings(false);
          setShowShortcutsModal(false);
          break;
        case "e":
          if (mediaType === "tv") {
            e.preventDefault();
            setShowEpisodesDrawer((prev) => !prev);
            setShowAudioDrawer(false);
            setShowSettings(false);
            setShowShortcutsModal(false);
          }
          break;
        case "n":
          if (onNextEpisode) {
            e.preventDefault();
            onNextEpisode();
          }
          break;
        case "?":
          e.preventDefault();
          setShowShortcutsModal((prev) => !prev);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPlaying, duration, onNextEpisode, mediaType, resetControlsTimeout]);

  const handleSelectDub = (dub: any) => {
    const targetId = String(
      dub.detail_path ||
      dub.detailPath ||
      dub.subject_id ||
      dub.subjectId ||
      ""
    );
    const cleanCurrentId = String(id || "");
    const isCurrent = matchesDubId(dub, cleanCurrentId);

    if (!targetId || isCurrent) {
      setShowAudioDrawer(false);
      setShowSettings(false);
      return;
    }

    if (videoRef.current && videoRef.current.currentTime > 0) {
      pendingTimestampRef.current = videoRef.current.currentTime;
    }

    if (onDubChange) {
      onDubChange(dub);
    } else {
      const query =
        mediaType === "tv" && currentSeason
          ? `?season=${currentSeason}&episode=${currentEpisode}`
          : "";
      window.location.href = `/watch/${targetId}${query}`;
    }
    setShowAudioDrawer(false);
    setShowSettings(false);
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return "00:00";
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) {
      return `${h}:${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
    }
    return `${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferPercent = duration > 0 ? (bufferedTime / duration) * 100 : 0;

  const showFloating = isFloating && !isFullscreen;

  return (
    <div
      ref={containerRef}
      className={`${styles.playerContainer} ${isFullscreen ? styles.fullscreen : ""} ${
        fillParent ? styles.fillParent : ""
      } ${showFloating ? styles.floatingPlayer : ""}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {showFloating && (
        <button
          className={styles.floatingCloseBtn}
          onClick={(e) => {
            e.stopPropagation();
            setIsFloating(false);
            setIsFloatingDismissed(true);
          }}
          title="Close floating mini player"
          aria-label="Close floating mini player"
        >
          <X size={15} />
        </button>
      )}
      {videoUrl ? (
        <video
          ref={videoRef}
          src={videoUrl}
          autoPlay
          playsInline
          preload="auto"
          className={`${styles.video} ${
            aspectMode === "cover"
              ? styles.videoCover
              : aspectMode === "fill"
              ? styles.videoFill
              : styles.videoContain
          }`}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onCanPlay={handleCanPlay}
          onWaiting={() => setIsLoading(true)}
          onPlaying={() => {
            setIsLoading(false);
            setIsPlaying(true);
          }}
          onPause={() => setIsPlaying(false)}
          onError={() => setVideoError(true)}
        />
      ) : (
        <div className={styles.noSource}>Loading streaming source…</div>
      )}

      {/* Action Splash Animation (Single crisp play/pause indicator) */}
      {splashAction && (
        <div className={styles.actionSplash}>
          {splashAction === "play" ? <Play size={36} fill="currentColor" /> : <Pause size={36} />}
        </div>
      )}

      {/* Stream Error Overlay */}
      {videoError && (
        <div className={styles.errorOverlay}>
          <span className={styles.errorText}>Stream connection interrupted</span>
          <button
            onClick={() => {
              setVideoError(false);
              setIsLoading(true);
              if (videoRef.current) {
                videoRef.current.load();
                videoRef.current.play().catch(console.error);
              }
            }}
            className={styles.errorRetryBtn}
          >
            Retry Stream
          </button>
        </div>
      )}

      {/* Minimalist Zero-Text Neon Ring Spinner */}
      {showSpinner && (
        <div className={styles.loadingOverlay}>
          <div className={styles.customSpinnerWrapper}>
            <div className={styles.customSpinnerRing} />
            <div className={styles.customSpinnerRingInner} />
            <div className={styles.customSpinnerGlow} />
          </div>
        </div>
      )}

      {/* Screen Click-To-Pause Overlay */}
      <div
        className={`${styles.controlsWrapper} ${showControls ? styles.visible : ""}`}
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
      >
        {/* Top Header */}
        <div className={styles.playerHeader} onClick={(e) => e.stopPropagation()}>
          <div className={styles.headerLeft}>
            {backHref && (
              <Link href={backHref} className={styles.backArrow} title="Back">
                <ArrowLeft size={22} />
              </Link>
            )}
            <div className={styles.headerTitles}>
              <span className={styles.headerTitle}>{title}</span>
              {episodeTitle && <span className={styles.headerEpisode}>{episodeTitle}</span>}
            </div>
          </div>

          <div className={styles.headerBadges}>
            {showBranding && (
              <Link
                href={brandingUrl}
                className={styles.brandingLogoBtn}
                title="CineAura"
                onClick={(e) => e.stopPropagation()}
              >
                {brandingLogo ? (
                  <img src={brandingLogo} alt="Logo" className={styles.brandingLogoImg} />
                ) : (
                  <span className={styles.brandingWordmark}>
                    CINE<span className={styles.brandingRed}>AURA</span>
                  </span>
                )}
              </Link>
            )}
            {selectedFile?.resolution && (
              <span className={styles.headerPill}>{selectedFile.resolution}</span>
            )}
            {currentDubName && (
              <span className={`${styles.headerPill} ${styles.headerPillRed}`}>
                {currentDubName === "Original" ? "Original Audio" : `${currentDubName} Dub`}
              </span>
            )}
          </div>
        </div>

        {/* Bottom Bar: Interactive Scrub Bar + Control Bar */}
        <div className={styles.bottomControlsGroup} onClick={(e) => e.stopPropagation()}>
          {/* Custom Interactive Timeline */}
          <div
            ref={timelineRef}
            className={styles.timelineContainer}
            onMouseDown={handleTimelineMouseDown}
            onMouseMove={handleTimelineMouseMove}
            onMouseLeave={handleTimelineMouseLeave}
          >
            <div className={styles.timelineTrack}>
              <div className={styles.timelineBuffer} style={{ width: `${bufferPercent}%` }} />
              <div className={styles.timelineProgress} style={{ width: `${progressPercent}%` }} />
              <div className={styles.timelineThumb} style={{ left: `${progressPercent}%` }} />
            </div>
            {hoverTime !== null && (
              <div
                className={styles.seekThumbnailTooltip}
                style={{
                  left: `${Math.max(
                    85,
                    Math.min(hoverPos, (timelineRef.current?.clientWidth || 300) - 85)
                  )}px`,
                }}
              >
                <div className={styles.seekThumbnailCard}>
                  {posterPath && (
                    <img
                      src={posterPath}
                      alt="Preview"
                      className={styles.seekThumbnailFallback}
                    />
                  )}
                  {videoUrl && (
                    <video
                      ref={previewVideoRef}
                      src={videoUrl}
                      preload="metadata"
                      muted
                      playsInline
                      className={styles.seekThumbnailVideo}
                    />
                  )}
                  <div className={styles.seekThumbnailTimeBadge}>
                    {formatTime(hoverTime)}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Controls Bar */}
          <div className={styles.controlBar}>
            {/* Left Controls */}
            <div className={styles.leftControls}>
              <button
                onClick={togglePlay}
                className={styles.iconButton}
                title={isPlaying ? "Pause (Space/K)" : "Play (Space/K)"}
              >
                {isPlaying ? <Pause size={24} /> : <Play size={24} fill="currentColor" />}
              </button>

              <button
                onClick={() => skip(-10)}
                className={`${styles.iconButton} ${styles.skipBtnDesktopHidden}`}
                title="Rewind 10s"
              >
                <RotateCcw size={22} />
              </button>

              <button
                onClick={() => skip(10)}
                className={`${styles.iconButton} ${styles.skipBtnDesktopHidden}`}
                title="Forward 10s"
              >
                <RotateCw size={22} />
              </button>

              {onNextEpisode && (
                <button
                  onClick={() => onNextEpisode()}
                  className={styles.iconButton}
                  title={`Next: ${nextEpisodeTitle || "Next Episode (N)"}`}
                >
                  <SkipForward size={22} fill="currentColor" />
                </button>
              )}

              {/* Volume Slider */}
              <div className={styles.volumeContainer}>
                <button
                  onClick={toggleMute}
                  className={styles.iconButton}
                  title={isMuted ? "Unmute (M)" : "Mute (M)"}
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX size={22} />
                  ) : volume > 0.5 ? (
                    <Volume2 size={22} />
                  ) : (
                    <Volume1 size={22} />
                  )}
                </button>
                <div className={styles.volumeSliderWrapper}>
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
              </div>

              {/* Time Display */}
              <div className={styles.timeDisplay}>
                <span>{formatTime(currentTime)}</span>
                <span className={styles.timeDivider}>/</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Right Controls */}
            <div className={styles.rightControls}>
              {/* Episodes Drawer Toggle */}
              {mediaType === "tv" && episodes && episodes.length > 0 && (
                <button
                  onClick={() => {
                    setShowEpisodesDrawer(!showEpisodesDrawer);
                    setShowAudioDrawer(false);
                    setShowSettings(false);
                    setShowShortcutsModal(false);
                  }}
                  className={`${styles.iconButton} ${showEpisodesDrawer ? styles.activeIcon : ""}`}
                  title="Episodes (E)"
                >
                  <List size={22} />
                </button>
              )}

              {/* Audio & Dubs Switcher Button */}
              {sortedDubs && sortedDubs.length > 0 && (
                <button
                  onClick={() => {
                    setShowAudioDrawer(!showAudioDrawer);
                    setShowEpisodesDrawer(false);
                    setShowSettings(false);
                    setShowShortcutsModal(false);
                  }}
                  className={`${styles.audioQuickBtn} ${showAudioDrawer ? styles.audioQuickBtnActive : ""}`}
                  title="Audio & Dubs (D)"
                >
                  <Languages size={18} />
                  <span>Audio</span>
                  {currentDubName && <span className={styles.dubLangBadge}>{currentDubName}</span>}
                </button>
              )}

              {/* Settings Popover */}
              <div className={styles.settingsWrapper}>
                <button
                  onClick={() => {
                    setShowSettings(!showSettings);
                    setShowEpisodesDrawer(false);
                    setShowAudioDrawer(false);
                    setShowShortcutsModal(false);
                    setSettingsTab("main");
                  }}
                  className={`${styles.iconButton} ${showSettings ? styles.activeIcon : ""}`}
                  title="Settings"
                >
                  <Settings size={22} />
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
                            <span>Quality</span>
                            <span style={{ fontSize: "0.8rem", opacity: 0.65 }}>
                              {selectedFile?.resolution || "Auto"} ›
                            </span>
                          </button>

                          {sortedDubs && sortedDubs.length > 0 && (
                            <button
                              onClick={() => setSettingsTab("audio")}
                              className={styles.menuItem}
                            >
                              <span>Audio / Dub</span>
                              <span style={{ fontSize: "0.8rem", opacity: 0.65 }}>
                                {currentDubName || "Default"} ›
                              </span>
                            </button>
                          )}

                          <button
                            onClick={() => setSettingsTab("speed")}
                            className={styles.menuItem}
                          >
                            <span>Speed</span>
                            <span style={{ fontSize: "0.8rem", opacity: 0.65 }}>
                              {playbackRate === 1 ? "Normal" : `${playbackRate}x`} ›
                            </span>
                          </button>

                          <button
                            onClick={() => setSettingsTab("aspect")}
                            className={styles.menuItem}
                          >
                            <span>Aspect Ratio</span>
                            <span style={{ fontSize: "0.8rem", opacity: 0.65, textTransform: "capitalize" }}>
                              {aspectMode} ›
                            </span>
                          </button>

                          <button
                            onClick={() => {
                              setShowSettings(false);
                              setShowShortcutsModal(true);
                            }}
                            className={styles.menuItem}
                          >
                            <span>Hotkeys Guide</span>
                            <HelpCircle size={16} opacity={0.65} />
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
                          ‹ Quality
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
                                <span>
                                  {file.resolution} ({file.size_mb} MB)
                                </span>
                                {isCurrent && <Check size={16} />}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}

                    {settingsTab === "audio" && (
                      <>
                        <button
                          onClick={() => setSettingsTab("main")}
                          className={styles.menuHeaderBack}
                        >
                          ‹ Audio & Dubs
                        </button>
                        <div className={styles.menuList}>
                          {sortedDubs.map((dub: any, idx: number) => {
                            const dubId = String(dub.detail_path || dub.detailPath || dub.subject_id || dub.subjectId || idx);
                            const isActive = currentDub ? matchesDubId(dub, String(currentDub.detail_path || currentDub.subject_id || "")) : false;

                            const rawName = dub.displayName || dub.language_name || dub.lanName || dub.language || "Audio";
                            const isHindi = /hindi/i.test(rawName);
                            const isOrig = dub.is_original || dub.original || /original/i.test(rawName);
                            let displayName = rawName;
                            if (isHindi) displayName = "Hindi Dub";
                            else if (isOrig) displayName = "Original Audio";
                            else if (!/dub/i.test(displayName)) displayName = `${displayName} Dub`;

                            const targetDubId = String(dub.detail_path || dub.detailPath || dub.subject_id || dub.subjectId || "");
                            return (
                              <button
                                key={dubId}
                                onClick={() => handleSelectDub(dub)}
                                onMouseEnter={() => {
                                  if (targetDubId && !isActive) {
                                    prefetchDownload(targetDubId, season || 0, episode || 0, mediaType || "movie");
                                  }
                                }}
                                onTouchStart={() => {
                                  if (targetDubId && !isActive) {
                                    prefetchDownload(targetDubId, season || 0, episode || 0, mediaType || "movie");
                                  }
                                }}
                                className={`${styles.menuItem} ${isActive ? styles.activeItem : ""}`}
                              >
                                <span>{displayName}</span>
                                {isActive && <Check size={16} />}
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
                                onClick={() => {
                                  setPlaybackRate(rate);
                                  if (videoRef.current) {
                                    videoRef.current.playbackRate = rate;
                                  }
                                  setShowSettings(false);
                                }}
                                className={`${styles.menuItem} ${isCurrent ? styles.activeItem : ""}`}
                              >
                                <span>{rate === 1 ? "Normal (1x)" : `${rate}x`}</span>
                                {isCurrent && <Check size={16} />}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}

                    {settingsTab === "aspect" && (
                      <>
                        <button
                          onClick={() => setSettingsTab("main")}
                          className={styles.menuHeaderBack}
                        >
                          ‹ Aspect Ratio
                        </button>
                        <div className={styles.menuList}>
                          {[
                            { id: "contain", label: "Fit to Screen (Default)" },
                            { id: "cover", label: "Fill / Zoom (No Black Bars)" },
                            { id: "fill", label: "Stretch Screen" },
                          ].map((item) => {
                            const isCurrent = aspectMode === item.id;
                            return (
                              <button
                                key={item.id}
                                onClick={() => {
                                  setAspectMode(item.id as any);
                                  setShowSettings(false);
                                }}
                                className={`${styles.menuItem} ${isCurrent ? styles.activeItem : ""}`}
                              >
                                <span>{item.label}</span>
                                {isCurrent && <Check size={16} />}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Picture-in-Picture */}
              <button
                onClick={togglePictureInPicture}
                className={styles.iconButton}
                title="Picture-in-Picture (P)"
              >
                <Airplay size={21} />
              </button>

              {/* Fullscreen Button */}
              <button
                onClick={toggleFullscreen}
                className={styles.iconButton}
                title={isFullscreen ? "Exit Fullscreen (F)" : "Fullscreen (F)"}
              >
                {isFullscreen ? <Minimize size={22} /> : <Maximize size={22} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Audio & Dubs Drawer Overlay */}
      {showAudioDrawer && sortedDubs && sortedDubs.length > 0 && (
        <div
          className={styles.audioDrawer}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Audio & Dubs"
        >
          <div className={styles.drawerHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <Languages size={22} color="var(--accent-color, #e50914)" />
              <h3>Audio & Dubs ({sortedDubs.length})</h3>
            </div>
            <button
              onClick={() => setShowAudioDrawer(false)}
              className={styles.drawerCloseBtn}
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {sortedDubs.length > 6 && (
            <div style={{ padding: "0.8rem 1.4rem 0 1.4rem" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "8px",
                  padding: "0.45rem 0.8rem",
                }}
              >
                <Search size={16} color="rgba(255,255,255,0.5)" />
                <input
                  type="text"
                  placeholder="Search audio language..."
                  value={audioSearch}
                  onChange={(e) => setAudioSearch(e.target.value)}
                  style={{
                    background: "none",
                    border: "none",
                    outline: "none",
                    color: "#fff",
                    fontSize: "0.85rem",
                    width: "100%",
                  }}
                />
              </div>
            </div>
          )}

          <div className={styles.drawerList}>
            {filteredDubs.map((dub: any, idx: number) => {
              const dubId = String(dub.detail_path || dub.detailPath || dub.subject_id || dub.subjectId || idx);
              const isActive = currentDub ? matchesDubId(dub, String(currentDub.detail_path || currentDub.subject_id || "")) : false;

              const rawName = dub.displayName || dub.language_name || dub.lanName || dub.language || "Audio";
              const isHindi = /hindi/i.test(rawName);
              const isOrig = dub.is_original || dub.original || /original/i.test(rawName);
              let displayName = rawName;
              if (isHindi) displayName = "Hindi";
              else if (isOrig) displayName = "Original";
              else displayName = rawName.replace(/\bdub\b/gi, "").trim() || rawName;

              const targetDubId = String(dub.detail_path || dub.detailPath || dub.subject_id || dub.subjectId || "");
              return (
                <button
                  key={dubId}
                  onClick={() => handleSelectDub(dub)}
                  onMouseEnter={() => {
                    if (targetDubId && !isActive) {
                      prefetchDownload(targetDubId, season || 0, episode || 0, mediaType || "movie");
                    }
                  }}
                  onTouchStart={() => {
                    if (targetDubId && !isActive) {
                      prefetchDownload(targetDubId, season || 0, episode || 0, mediaType || "movie");
                    }
                  }}
                  className={`${styles.audioDubItem} ${isActive ? styles.audioDubItemActive : ""}`}
                >
                  <div className={styles.audioDubLeft}>
                    <span className={styles.audioDubName}>{displayName} {isOrig ? "Audio" : "Dub"}</span>
                    {isHindi && (
                      <span className={styles.dubLangBadge} style={{ fontSize: "0.7rem" }}>
                        Hindi
                      </span>
                    )}
                    {isOrig && !isHindi && (
                      <span
                        className={styles.dubLangBadge}
                        style={{ background: "rgba(255,255,255,0.2)", fontSize: "0.7rem" }}
                      >
                        Original
                      </span>
                    )}
                  </div>
                  {isActive && (
                    <Check size={18} color="var(--accent-color, #e50914)" strokeWidth={2.5} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Episodes Drawer Overlay */}
      {showEpisodesDrawer && mediaType === "tv" && episodes && episodes.length > 0 && (
        <div
          className={styles.episodesDrawer}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Episodes List"
        >
          <div className={styles.drawerHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <Tv size={22} color="var(--accent-color, #e50914)" />
              <h3>Season {currentSeason || 1} Episodes</h3>
            </div>
            <button
              onClick={() => setShowEpisodesDrawer(false)}
              className={styles.drawerCloseBtn}
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <div className={styles.drawerList}>
            {episodes.map((ep: any) => {
              const isActive = ep.episode_number === currentEpisode;
              const progressKey = `${currentSeason}:${ep.episode_number}`;
              const progressInfo = episodesProgress[progressKey];
              const epImage =
                ep.still_w500 || ep.still_path
                  ? (ep.still_w500 || ep.still_path).startsWith("http")
                    ? ep.still_w500 || ep.still_path
                    : `https://image.tmdb.org/t/p/w300${ep.still_path}`
                  : posterPath
                  ? posterPath.startsWith("http")
                    ? posterPath
                    : `https://image.tmdb.org/t/p/w500${posterPath}`
                  : "/placeholder.png";

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
                  <div
                    style={{
                      display: "flex",
                      gap: "12px",
                      marginBottom: "6px",
                      alignItems: "flex-start",
                    }}
                  >
                    <div
                      style={{
                        position: "relative",
                        width: "120px",
                        flexShrink: 0,
                        borderRadius: "8px",
                        overflow: "hidden",
                        aspectRatio: "16/9",
                        backgroundColor: "rgba(255,255,255,0.08)",
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={epImage}
                        alt={ep.name}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        loading="lazy"
                      />
                      <div
                        style={{
                          position: "absolute",
                          bottom: "4px",
                          right: "4px",
                          backgroundColor: "rgba(0,0,0,0.85)",
                          color: "white",
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: "4px",
                        }}
                      >
                        Ep {ep.episode_number}
                      </div>
                      {progressInfo && progressInfo.progress && progressInfo.duration ? (
                        <div
                          style={{
                            position: "absolute",
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: "3px",
                            backgroundColor: "rgba(255,255,255,0.25)",
                            zIndex: 10,
                          }}
                        >
                          <div
                            style={{
                              width: `${(progressInfo.progress / progressInfo.duration) * 100}%`,
                              height: "100%",
                              backgroundColor: "var(--accent-color, #e50914)",
                            }}
                          />
                        </div>
                      ) : null}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        flex: 1,
                        textAlign: "left",
                        gap: "3px",
                      }}
                    >
                      <span className={styles.drawerItemTitle}>{ep.name}</span>
                      {ep.runtime && (
                        <span style={{ fontSize: "0.75rem", color: "var(--text-secondary, #888)" }}>
                          {ep.runtime}m
                        </span>
                      )}
                    </div>
                  </div>
                  {ep.overview && (
                    <p
                      className={styles.drawerItemOverview}
                      style={{
                        WebkitLineClamp: 2,
                        display: "-webkit-box",
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        margin: 0,
                      }}
                    >
                      {ep.overview}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Autoplay Next Episode Toast */}
      {showCountdownToast && onNextEpisode && (
        <div className={styles.nextToastContainer} onClick={(e) => e.stopPropagation()}>
          <span className={styles.toastLabel}>Playing Next Episode</span>
          <div className={styles.toastTimerRow}>
            <div className={styles.toastCountdownNum}>{countdown}</div>
            <span className={styles.toastTitle}>
              {nextEpisodeTitle || "Next Episode"}
            </span>
          </div>
          <div className={styles.toastActions}>
            <button
              onClick={() => {
                setShowCountdownToast(false);
                setCountdown(null);
                onNextEpisode();
              }}
              className={styles.toastPlayBtn}
            >
              Play Now
            </button>
            <button
              onClick={() => {
                setShowCountdownToast(false);
                setCountdown(null);
                setIsCountdownCancelled(true);
              }}
              className={styles.toastCancelBtn}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Modal */}
      {showShortcutsModal && (
        <div className={styles.shortcutsModal} onClick={(e) => e.stopPropagation()}>
          <div className={styles.shortcutsHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <HelpCircle size={20} color="var(--accent-color, #e50914)" />
              <h3>Keyboard Hotkeys</h3>
            </div>
            <button
              onClick={() => setShowShortcutsModal(false)}
              className={styles.drawerCloseBtn}
            >
              ×
            </button>
          </div>
          <div className={styles.shortcutsGrid}>
            <div className={styles.shortcutRow}>
              <span>Play / Pause</span>
              <span className={styles.shortcutKbd}>Space / K</span>
            </div>
            <div className={styles.shortcutRow}>
              <span>Seek Back 10s</span>
              <span className={styles.shortcutKbd}>← / J</span>
            </div>
            <div className={styles.shortcutRow}>
              <span>Seek Forward 10s</span>
              <span className={styles.shortcutKbd}>→ / L</span>
            </div>
            <div className={styles.shortcutRow}>
              <span>Volume Up / Down</span>
              <span className={styles.shortcutKbd}>↑ / ↓</span>
            </div>
            <div className={styles.shortcutRow}>
              <span>Mute / Unmute</span>
              <span className={styles.shortcutKbd}>M</span>
            </div>
            <div className={styles.shortcutRow}>
              <span>Toggle Fullscreen</span>
              <span className={styles.shortcutKbd}>F</span>
            </div>
            <div className={styles.shortcutRow}>
              <span>Audio & Dubs</span>
              <span className={styles.shortcutKbd}>D</span>
            </div>
            <div className={styles.shortcutRow}>
              <span>Episodes List</span>
              <span className={styles.shortcutKbd}>E</span>
            </div>
            <div className={styles.shortcutRow}>
              <span>Picture in Picture</span>
              <span className={styles.shortcutKbd}>P</span>
            </div>
            <div className={styles.shortcutRow}>
              <span>Next Episode</span>
              <span className={styles.shortcutKbd}>N</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
