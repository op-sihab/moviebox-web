export interface MappedSeason {
  season: number;
  tmdbSeason: number | null;
  episode_count: number;
  name: string;
}

export interface SeasonMapping {
  isSplit: boolean;
  mappedSeasons: MappedSeason[];
  totalEpisodes: number;
  mapUiToBackend: (
    uiSeason: number,
    uiEpisode: number
  ) => {
    mbxSeason: number;
    mbxEpisode: number;
    tmdbSeason: number | null;
    tmdbEpisode: number | null;
  };
  mapBackendToUi: (
    mbxSeason: number,
    mbxEpisode: number
  ) => {
    uiSeason: number;
    uiEpisode: number;
  };
  getTmdbSeason: (uiSeason: number) => number | null;
}

/**
 * Builds a bidirectional season and episode mapping between MovieBox and TMDB.
 *
 * Handles anime and series where MovieBox provides a single continuous or lumped season
 * (e.g. Naruto Season 1 containing 219 episodes), automatically dividing them into
 * the true seasons from TMDB (e.g. Season 1: 52 eps, Season 2: 52 eps, Season 3: 54 eps, Season 4: 62 eps)
 * while ensuring download/stream queries seamlessly map back to MovieBox's backend coordinates.
 */
export function buildSeasonMapping(
  mbxSeasonsData: any,
  tmdbSeasonsList?: Array<{ season_number: number; episode_count: number; name?: string }> | null
): SeasonMapping {
  const defaultMbxSeasons: Array<{ season: number; episode_count: number }> =
    mbxSeasonsData?.seasons && mbxSeasonsData.seasons.length > 0
      ? mbxSeasonsData.seasons
      : [{ season: 1, episode_count: 1 }];

  const validTmdbSeasons = (tmdbSeasonsList || []).filter(
    (s) => s && s.season_number > 0 && s.episode_count > 0
  );

  const firstMbxSeason = defaultMbxSeasons[0];
  const firstTmdbSeason = validTmdbSeasons[0];

  // Detect lumping when TMDB has multiple seasons and MovieBox Season 1 has significantly more episodes
  const needsSplit =
    validTmdbSeasons.length > 1 &&
    firstMbxSeason &&
    firstTmdbSeason &&
    firstMbxSeason.episode_count > firstTmdbSeason.episode_count + 3;

  if (!needsSplit) {
    const mappedSeasons: MappedSeason[] = defaultMbxSeasons.map((s) => ({
      season: s.season,
      tmdbSeason: s.season,
      episode_count: s.episode_count,
      name: `Season ${s.season}`,
    }));

    return {
      isSplit: false,
      mappedSeasons,
      totalEpisodes:
        mbxSeasonsData?.total_episodes ||
        defaultMbxSeasons.reduce((acc, s) => acc + (s.episode_count || 0), 0),
      mapUiToBackend: (s, e) => ({
        mbxSeason: s,
        mbxEpisode: e,
        tmdbSeason: s,
        tmdbEpisode: e,
      }),
      mapBackendToUi: (s, e) => ({ uiSeason: s, uiEpisode: e }),
      getTmdbSeason: (uiSeason) => uiSeason,
    };
  }

  // Calculate total episodes in TMDB
  const totalTmdbEpisodes = validTmdbSeasons.reduce((acc, s) => acc + (s.episode_count || 0), 0);

  // If first MovieBox season has 219/220 episodes matching TMDB total, ensure count is 220
  const firstMbxCount = Math.max(
    firstMbxSeason.episode_count || 0,
    Math.abs((firstMbxSeason.episode_count || 0) - totalTmdbEpisodes) <= 2 ? totalTmdbEpisodes : 0
  );

  // Create a flat sequential list of episodes for the lumped first season
  const lumpedEpisodes: Array<{ mbxSeason: number; mbxEpisode: number }> = [];
  for (let ep = 1; ep <= firstMbxCount; ep++) {
    lumpedEpisodes.push({ mbxSeason: firstMbxSeason.season, mbxEpisode: ep });
  }

  let currentIdx = 0;
  const mappedSeasons: MappedSeason[] = [];
  const uiToMbxMap = new Map<
    string,
    { mbxSeason: number; mbxEpisode: number; tmdbSeason: number | null; tmdbEpisode: number | null }
  >();
  const mbxToUiMap = new Map<string, { uiSeason: number; uiEpisode: number }>();

  let uiSeasonNum = 1;
  for (const tmdbS of validTmdbSeasons) {
    if (currentIdx >= lumpedEpisodes.length) break;

    const countForThisSeason = Math.min(tmdbS.episode_count, lumpedEpisodes.length - currentIdx);

    for (let uiEp = 1; uiEp <= countForThisSeason; uiEp++) {
      const mbx = lumpedEpisodes[currentIdx];
      const entry = {
        mbxSeason: mbx.mbxSeason,
        mbxEpisode: mbx.mbxEpisode,
        tmdbSeason: tmdbS.season_number,
        tmdbEpisode: uiEp,
      };

      uiToMbxMap.set(`${uiSeasonNum}:${uiEp}`, entry);
      mbxToUiMap.set(`${mbx.mbxSeason}:${mbx.mbxEpisode}`, {
        uiSeason: uiSeasonNum,
        uiEpisode: uiEp,
      });

      currentIdx++;
    }

    mappedSeasons.push({
      season: uiSeasonNum,
      tmdbSeason: tmdbS.season_number,
      episode_count: countForThisSeason,
      name: tmdbS.name || `Season ${uiSeasonNum}`,
    });

    uiSeasonNum++;
  }

  // Handle any remaining extra episodes in the first lumped season
  if (currentIdx < lumpedEpisodes.length) {
    const remainingCount = lumpedEpisodes.length - currentIdx;
    for (let uiEp = 1; uiEp <= remainingCount; uiEp++) {
      const mbx = lumpedEpisodes[currentIdx];
      const entry = {
        mbxSeason: mbx.mbxSeason,
        mbxEpisode: mbx.mbxEpisode,
        tmdbSeason: null,
        tmdbEpisode: null,
      };
      uiToMbxMap.set(`${uiSeasonNum}:${uiEp}`, entry);
      mbxToUiMap.set(`${mbx.mbxSeason}:${mbx.mbxEpisode}`, {
        uiSeason: uiSeasonNum,
        uiEpisode: uiEp,
      });
      currentIdx++;
    }
    mappedSeasons.push({
      season: uiSeasonNum,
      tmdbSeason: null,
      episode_count: remainingCount,
      name: `Season ${uiSeasonNum} (Extra)`,
    });
    uiSeasonNum++;
  }

  // Handle any additional seasons from MovieBox (e.g. Season 2 with 20 episodes)
  for (let sIdx = 1; sIdx < defaultMbxSeasons.length; sIdx++) {
    const extraSeason = defaultMbxSeasons[sIdx];
    const count = extraSeason.episode_count || 0;
    if (count > 0) {
      for (let ep = 1; ep <= count; ep++) {
        const entry = {
          mbxSeason: extraSeason.season,
          mbxEpisode: ep,
          tmdbSeason: null,
          tmdbEpisode: null,
        };
        uiToMbxMap.set(`${uiSeasonNum}:${ep}`, entry);
        mbxToUiMap.set(`${extraSeason.season}:${ep}`, {
          uiSeason: uiSeasonNum,
          uiEpisode: ep,
        });
      }
      mappedSeasons.push({
        season: uiSeasonNum,
        tmdbSeason: null,
        episode_count: count,
        name: `Season ${uiSeasonNum}`,
      });
      uiSeasonNum++;
    }
  }

  return {
    isSplit: true,
    mappedSeasons,
    totalEpisodes: mappedSeasons.reduce((acc, s) => acc + (s.episode_count || 0), 0),
    mapUiToBackend: (uiSeason, uiEpisode) => {
      const direct = uiToMbxMap.get(`${uiSeason}:${uiEpisode}`);
      if (direct) return direct;

      // Fallback: in case backend coordinates were directly supplied
      const mapped = mbxToUiMap.get(`${uiSeason}:${uiEpisode}`);
      if (mapped) {
        return {
          mbxSeason: uiSeason,
          mbxEpisode: uiEpisode,
          tmdbSeason: null,
          tmdbEpisode: null,
        };
      }
      return {
        mbxSeason: uiSeason,
        mbxEpisode: uiEpisode,
        tmdbSeason: uiSeason,
        tmdbEpisode: uiEpisode,
      };
    },
    mapBackendToUi: (mbxSeason, mbxEpisode) => {
      return (
        mbxToUiMap.get(`${mbxSeason}:${mbxEpisode}`) || { uiSeason: mbxSeason, uiEpisode: mbxEpisode }
      );
    },
    getTmdbSeason: (uiSeason) => {
      const found = mappedSeasons.find((s) => s.season === uiSeason);
      return found?.tmdbSeason ?? uiSeason;
    },
  };
}
