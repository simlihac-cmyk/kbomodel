import type {
  Award,
  KboDataBundle,
  KboSeasonRuleset,
  PlayerGameStat,
  PlayerSplitStat,
  TeamSeasonStat,
  TeamSplitStat,
} from "@/lib/domain/kbo/types";
import type {
  NormalizedAwards,
  NormalizedFranchiseLineage,
  NormalizedPlayerGameStats,
  NormalizedPlayerSplitStats,
  NormalizedPlayerSeasonStats,
  NormalizedPlayers,
  NormalizedRosterEvents,
  NormalizedRulesets,
  NormalizedScoreboard,
  NormalizedSeriesGames,
  NormalizedStandings,
  NormalizedTeamHitterStats,
  NormalizedTeamPitcherStats,
} from "@/lib/data-sources/kbo/dataset-types";

type IngestOverlayInputs = {
  franchiseLineage: NormalizedFranchiseLineage | null;
  players: NormalizedPlayers | null;
  awards: NormalizedAwards | null;
  playerSeasonStats: NormalizedPlayerSeasonStats | null;
  playerGameStats: NormalizedPlayerGameStats | null;
  playerSplitStats: NormalizedPlayerSplitStats | null;
  standings: NormalizedStandings | null;
  seriesGames: NormalizedSeriesGames | null;
  scoreboard: NormalizedScoreboard | null;
  rosterEvents: NormalizedRosterEvents | null;
  rulesets: NormalizedRulesets | null;
  teamHitterStats: NormalizedTeamHitterStats | null;
  teamPitcherStats: NormalizedTeamPitcherStats | null;
};

function alignScoreboardToExistingGames(
  bundle: KboDataBundle,
  scoreboard: NormalizedScoreboard,
): NormalizedScoreboard {
  const existingByTuple = new Map(
    bundle.games.map((game) => [
      [game.seasonId, game.homeSeasonTeamId, game.awaySeasonTeamId, game.scheduledAt].join("|"),
      game,
    ] as const),
  );

  const gameIdMap = new Map<string, string>();
  const alignedGames = scoreboard.games.map((game) => {
    const tupleKey = [game.seasonId, game.homeSeasonTeamId, game.awaySeasonTeamId, game.scheduledAt].join("|");
    const existing = existingByTuple.get(tupleKey);
    if (!existing) {
      gameIdMap.set(game.gameId, game.gameId);
      return game;
    }

    gameIdMap.set(game.gameId, existing.gameId);
    return {
      ...existing,
      status: game.status,
      homeScore: game.homeScore,
      awayScore: game.awayScore,
      innings: game.innings,
      isTie: game.isTie,
      note: game.note ?? existing.note,
      attendance: game.attendance ?? existing.attendance,
      externalLinks: game.externalLinks.length > 0 ? game.externalLinks : existing.externalLinks,
    };
  });

  const alignedBoxScores = scoreboard.boxScores.map((boxScore) => ({
    ...boxScore,
    gameId: gameIdMap.get(boxScore.gameId) ?? boxScore.gameId,
  }));

  return {
    ...scoreboard,
    games: alignedGames,
    boxScores: alignedBoxScores,
  };
}

function parseRecord(record: string) {
  const [winsText = "0", lossesText = "0", tiesText = "0"] = record.split("-");
  return {
    wins: Number.parseInt(winsText, 10) || 0,
    losses: Number.parseInt(lossesText, 10) || 0,
    ties: Number.parseInt(tiesText, 10) || 0,
  };
}

function buildRecentOutcomeMap(bundle: KboDataBundle, seasonId: string) {
  const outcomesBySeasonTeamId = new Map<string, string[]>();
  const finalGames = bundle.games
    .filter(
      (game) =>
        game.seasonId === seasonId &&
        game.status === "final" &&
        game.homeScore !== null &&
        game.awayScore !== null,
    )
    .sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt));

  for (const game of finalGames) {
    const homeOutcomes = outcomesBySeasonTeamId.get(game.homeSeasonTeamId) ?? [];
    const awayOutcomes = outcomesBySeasonTeamId.get(game.awaySeasonTeamId) ?? [];

    if (game.isTie || game.homeScore === game.awayScore) {
      homeOutcomes.push("T");
      awayOutcomes.push("T");
    } else if ((game.homeScore ?? 0) > (game.awayScore ?? 0)) {
      homeOutcomes.push("W");
      awayOutcomes.push("L");
    } else {
      homeOutcomes.push("L");
      awayOutcomes.push("W");
    }

    outcomesBySeasonTeamId.set(game.homeSeasonTeamId, homeOutcomes);
    outcomesBySeasonTeamId.set(game.awaySeasonTeamId, awayOutcomes);
  }

  return outcomesBySeasonTeamId;
}

function formatRecent10(outcomes: string[]) {
  const sample = outcomes.slice(-10);
  const wins = sample.filter((outcome) => outcome === "W").length;
  const losses = sample.filter((outcome) => outcome === "L").length;
  const ties = sample.filter((outcome) => outcome === "T").length;
  return `${wins}-${losses}${ties > 0 ? `-${ties}` : ""}`;
}

function looksMissingRecent10(record: string) {
  return record === "-" || record === "0-0" || record === "0-0-0";
}

function buildTeamSeasonStatsFromStandings(
  bundle: KboDataBundle,
  standings: NormalizedStandings,
): TeamSeasonStat[] {
  const previousById = Object.fromEntries(
    bundle.teamSeasonStats.map((item) => [item.seasonTeamId, item] as const),
  );
  const runsBySeasonTeamId = new Map<string, { scored: number; allowed: number }>();
  const recentOutcomesBySeasonTeamId = buildRecentOutcomeMap(bundle, standings.seasonId);

  for (const game of bundle.games) {
    if (game.seasonId !== standings.seasonId || game.status !== "final") {
      continue;
    }

    const homeRuns = game.homeScore ?? 0;
    const awayRuns = game.awayScore ?? 0;
    const currentHome = runsBySeasonTeamId.get(game.homeSeasonTeamId) ?? { scored: 0, allowed: 0 };
    const currentAway = runsBySeasonTeamId.get(game.awaySeasonTeamId) ?? { scored: 0, allowed: 0 };

    runsBySeasonTeamId.set(game.homeSeasonTeamId, {
      scored: currentHome.scored + homeRuns,
      allowed: currentHome.allowed + awayRuns,
    });
    runsBySeasonTeamId.set(game.awaySeasonTeamId, {
      scored: currentAway.scored + awayRuns,
      allowed: currentAway.allowed + homeRuns,
    });
  }

  return standings.rows.map((row) => {
    const previous = previousById[row.seasonTeamId];
    const homeRecord = parseRecord(row.homeRecord);
    const awayRecord = parseRecord(row.awayRecord);
    const runs = runsBySeasonTeamId.get(row.seasonTeamId);
    const recentOutcomes = recentOutcomesBySeasonTeamId.get(row.seasonTeamId) ?? [];
    const derivedLast10 = formatRecent10(recentOutcomes);

    return {
      seasonId: standings.seasonId,
      seasonTeamId: row.seasonTeamId,
      wins: row.wins,
      losses: row.losses,
      ties: row.ties,
      runsScored: row.runsScored ?? runs?.scored ?? previous?.runsScored ?? 0,
      runsAllowed: row.runsAllowed ?? runs?.allowed ?? previous?.runsAllowed ?? 0,
      homeWins: homeRecord.wins,
      homeLosses: homeRecord.losses,
      awayWins: awayRecord.wins,
      awayLosses: awayRecord.losses,
      last10: looksMissingRecent10(row.last10) && recentOutcomes.length > 0 ? derivedLast10 : row.last10,
      streak: row.streak,
      offensePlus: previous?.offensePlus ?? 100,
      pitchingPlus: previous?.pitchingPlus ?? 100,
      bullpenEra: previous?.bullpenEra ?? 4.2,
      teamWar: previous?.teamWar ?? 0,
    };
  });
}

function formatPct(wins: number, losses: number) {
  const games = wins + losses;
  if (games === 0) {
    return "0.000";
  }
  return (wins / games).toFixed(3);
}

function buildHomeAwaySplitStatsFromStandings(
  bundle: KboDataBundle,
  standings: NormalizedStandings,
): TeamSplitStat[] {
  const untouched = bundle.teamSplitStats.filter(
    (item) =>
      item.seasonId !== standings.seasonId || (item.splitType !== "home" && item.splitType !== "away"),
  );

  const overlay = standings.rows.flatMap((row) => {
    const home = parseRecord(row.homeRecord);
    const away = parseRecord(row.awayRecord);

    return [
      {
        splitId: `${row.seasonTeamId}:home`,
        seasonId: standings.seasonId,
        seasonTeamId: row.seasonTeamId,
        splitType: "home" as const,
        wins: home.wins,
        losses: home.losses,
        ties: home.ties,
        metricLabel: "홈",
        metricValue: `${home.wins}-${home.losses}${home.ties > 0 ? `-${home.ties}` : ""} / ${formatPct(
          home.wins,
          home.losses,
        )}`,
      },
      {
        splitId: `${row.seasonTeamId}:away`,
        seasonId: standings.seasonId,
        seasonTeamId: row.seasonTeamId,
        splitType: "away" as const,
        wins: away.wins,
        losses: away.losses,
        ties: away.ties,
        metricLabel: "원정",
        metricValue: `${away.wins}-${away.losses}${away.ties > 0 ? `-${away.ties}` : ""} / ${formatPct(
          away.wins,
          away.losses,
        )}`,
      },
    ];
  });

  return [...untouched, ...overlay];
}

function mergeRulesets(bundle: KboDataBundle, normalizedRulesets: NormalizedRulesets): KboSeasonRuleset[] {
  const incomingById = new Map(normalizedRulesets.rulesets.map((item) => [item.rulesetId, item]));
  const merged = bundle.rulesets.map((ruleset) => incomingById.get(ruleset.rulesetId) ?? ruleset);
  const existingIds = new Set(bundle.rulesets.map((item) => item.rulesetId));

  for (const ruleset of normalizedRulesets.rulesets) {
    if (!existingIds.has(ruleset.rulesetId)) {
      merged.push(ruleset);
    }
  }

  return merged;
}

function mergeAwards(bundle: KboDataBundle, normalizedAwards: NormalizedAwards): Award[] {
  return [...normalizedAwards.awards].sort(
    (left, right) => right.seasonId.localeCompare(left.seasonId) || left.label.localeCompare(right.label, "ko"),
  );
}

function mergePlayers(bundle: KboDataBundle, normalizedPlayers: NormalizedPlayers) {
  const existingById = new Map(bundle.players.map((player) => [player.playerId, player] as const));
  for (const player of normalizedPlayers.players) {
    existingById.set(player.playerId, {
      ...(existingById.get(player.playerId) ?? {}),
      ...player,
    });
  }

  return Array.from(existingById.values()).sort((left, right) => left.nameKo.localeCompare(right.nameKo, "ko"));
}

function mergePlayersFromStats(bundle: KboDataBundle, normalizedPlayerSeasonStats: NormalizedPlayerSeasonStats) {
  const existingById = new Map(bundle.players.map((player) => [player.playerId, player] as const));
  for (const player of normalizedPlayerSeasonStats.players) {
    existingById.set(player.playerId, {
      ...(existingById.get(player.playerId) ?? {}),
      ...player,
    });
  }

  return Array.from(existingById.values()).sort((left, right) => left.nameKo.localeCompare(right.nameKo, "ko"));
}

function mergePlayerSeasonStats(bundle: KboDataBundle, normalizedPlayerSeasonStats: NormalizedPlayerSeasonStats) {
  return [
    ...bundle.playerSeasonStats.filter((item) => item.seasonId !== normalizedPlayerSeasonStats.seasonId),
    ...normalizedPlayerSeasonStats.stats,
  ];
}

function mergePlayerGameStats(bundle: KboDataBundle, normalizedPlayerGameStats: NormalizedPlayerGameStats): PlayerGameStat[] {
  return [
    ...bundle.playerGameStats.filter((item) => item.seasonId !== normalizedPlayerGameStats.seasonId),
    ...normalizedPlayerGameStats.rows,
  ];
}

function mergePlayerSplitStats(bundle: KboDataBundle, normalizedPlayerSplitStats: NormalizedPlayerSplitStats): PlayerSplitStat[] {
  return [
    ...bundle.playerSplitStats.filter((item) => item.seasonId !== normalizedPlayerSplitStats.seasonId),
    ...normalizedPlayerSplitStats.rows,
  ];
}

function mergeTeamHitterStats(bundle: KboDataBundle, normalizedTeamHitterStats: NormalizedTeamHitterStats) {
  const incomingById = new Map(normalizedTeamHitterStats.rows.map((row) => [row.seasonTeamId, row] as const));

  return bundle.teamSeasonStats.map((stat) => {
    if (stat.seasonId !== normalizedTeamHitterStats.seasonId) {
      return stat;
    }

    const incoming = incomingById.get(stat.seasonTeamId);
    if (!incoming) {
      return stat;
    }

    return {
      ...stat,
      runsScored: incoming.runs,
      offensePlus: incoming.offensePlus,
    };
  });
}

function mergeTeamPitcherStats(bundle: KboDataBundle, normalizedTeamPitcherStats: NormalizedTeamPitcherStats) {
  const incomingById = new Map(normalizedTeamPitcherStats.rows.map((row) => [row.seasonTeamId, row] as const));

  return bundle.teamSeasonStats.map((stat) => {
    if (stat.seasonId !== normalizedTeamPitcherStats.seasonId) {
      return stat;
    }

    const incoming = incomingById.get(stat.seasonTeamId);
    if (!incoming) {
      return stat;
    }

    return {
      ...stat,
      runsAllowed: incoming.runsAllowed,
      pitchingPlus: incoming.pitchingPlus,
      bullpenEra: incoming.bullpenEra,
    };
  });
}

export function applyNormalizedIngestOverlay(
  bundle: KboDataBundle,
  inputs: IngestOverlayInputs,
): KboDataBundle {
  let nextBundle = { ...bundle };

  if (inputs.franchiseLineage) {
    const incomingFranchises = new Map(
      inputs.franchiseLineage.franchises.map((item) => [item.franchiseId, item] as const),
    );
    const incomingBrands = new Map(
      inputs.franchiseLineage.teamBrands.map((item) => [item.brandId, item] as const),
    );

    const mergedFranchises = nextBundle.franchises.map(
      (franchise) => incomingFranchises.get(franchise.franchiseId) ?? franchise,
    );
    const mergedBrands = nextBundle.teamBrands.map(
      (brand) => incomingBrands.get(brand.brandId) ?? brand,
    );

    for (const franchise of inputs.franchiseLineage.franchises) {
      if (!mergedFranchises.some((item) => item.franchiseId === franchise.franchiseId)) {
        mergedFranchises.push(franchise);
      }
    }

    for (const brand of inputs.franchiseLineage.teamBrands) {
      if (!mergedBrands.some((item) => item.brandId === brand.brandId)) {
        mergedBrands.push(brand);
      }
    }

    nextBundle = {
      ...nextBundle,
      franchises: mergedFranchises,
      teamBrands: mergedBrands,
    };
  }

  if (inputs.seriesGames) {
    nextBundle = {
      ...nextBundle,
      series: [
        ...nextBundle.series.filter((item) => item.seasonId !== inputs.seriesGames?.seasonId),
        ...inputs.seriesGames.series,
      ],
      games: [
        ...nextBundle.games.filter((item) => item.seasonId !== inputs.seriesGames?.seasonId),
        ...inputs.seriesGames.games,
      ],
    };
  }

  if (inputs.players) {
    nextBundle = {
      ...nextBundle,
      players: mergePlayers(nextBundle, inputs.players),
    };
  }

  if (inputs.awards) {
    nextBundle = {
      ...nextBundle,
      awards: mergeAwards(nextBundle, inputs.awards),
    };
  }

  if (inputs.playerSeasonStats) {
    nextBundle = {
      ...nextBundle,
      players: mergePlayersFromStats(nextBundle, inputs.playerSeasonStats),
      playerSeasonStats: mergePlayerSeasonStats(nextBundle, inputs.playerSeasonStats),
    };
  }

  if (inputs.playerGameStats) {
    nextBundle = {
      ...nextBundle,
      playerGameStats: mergePlayerGameStats(nextBundle, inputs.playerGameStats),
    };
  }

  if (inputs.playerSplitStats) {
    nextBundle = {
      ...nextBundle,
      playerSplitStats: mergePlayerSplitStats(nextBundle, inputs.playerSplitStats),
    };
  }

  if (inputs.standings) {
    const seasonId = inputs.standings.seasonId;
    nextBundle = {
      ...nextBundle,
      teamSeasonStats: [
        ...nextBundle.teamSeasonStats.filter((item) => item.seasonId !== seasonId),
        ...buildTeamSeasonStatsFromStandings(nextBundle, inputs.standings),
      ],
      teamSplitStats: buildHomeAwaySplitStatsFromStandings(nextBundle, inputs.standings),
    };
  }

  if (inputs.scoreboard) {
    const alignedScoreboard = alignScoreboardToExistingGames(nextBundle, inputs.scoreboard);
    const scoreboardGamesById = new Map(alignedScoreboard.games.map((item) => [item.gameId, item]));
    const untouchedGames = nextBundle.games.filter((item) => !scoreboardGamesById.has(item.gameId));
    const untouchedBoxScores = nextBundle.gameBoxScores.filter(
      (item) => !alignedScoreboard.boxScores.some((score) => score.gameId === item.gameId),
    );

    nextBundle = {
      ...nextBundle,
      games: [...untouchedGames, ...alignedScoreboard.games].sort((left, right) =>
        left.scheduledAt.localeCompare(right.scheduledAt),
      ),
      gameBoxScores: [...untouchedBoxScores, ...alignedScoreboard.boxScores],
    };
  }

  if (inputs.rosterEvents) {
    nextBundle = {
      ...nextBundle,
      rosterEvents: [
        ...nextBundle.rosterEvents.filter((item) => item.seasonId !== inputs.rosterEvents?.seasonId),
        ...inputs.rosterEvents.events,
      ],
    };
  }

  if (inputs.rulesets) {
    nextBundle = {
      ...nextBundle,
      rulesets: mergeRulesets(nextBundle, inputs.rulesets),
    };
  }

  if (inputs.teamHitterStats) {
    nextBundle = {
      ...nextBundle,
      teamSeasonStats: mergeTeamHitterStats(nextBundle, inputs.teamHitterStats),
    };
  }

  if (inputs.teamPitcherStats) {
    nextBundle = {
      ...nextBundle,
      teamSeasonStats: mergeTeamPitcherStats(nextBundle, inputs.teamPitcherStats),
    };
  }

  return nextBundle;
}
