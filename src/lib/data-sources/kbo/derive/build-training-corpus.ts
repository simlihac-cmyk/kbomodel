import {
  trainingCorpusBundleSchema,
  trainingCorpusSeasonSchema,
  type GameOutcomeTrainingExample,
  type TeamSnapshotTrainingExample,
  type TrainingCorpusBundle,
  type TrainingCorpusSeason,
} from "@/lib/data-sources/kbo/training-corpus-types";
import type {
  HistoryTrainingDailySnapshot,
  HistoryTrainingSeason,
  HistoryTrainingTeamSnapshot,
} from "@/lib/data-sources/kbo/history-training-types";
import { BASE_HOME_FIELD_ADVANTAGE } from "@/lib/domain/kbo/constants";
import type { TeamSeasonStat } from "@/lib/domain/kbo/types";
import {
  buildFactBasedOperationalSnapshot,
  buildRemainingScheduleDifficulty,
  buildTeamStateLeagueAverages,
  buildTeamStateSnapshot,
  type FactBasedOperationalSnapshot,
  type TeamStateLeagueAverages,
  type TeamStateSnapshot,
} from "@/lib/sim/kbo/shared-team-state";

type ParsedRecent10 = {
  wins: number;
  losses: number;
  ties: number;
  winRate: number;
};

type ParsedStreak = {
  direction: number;
  length: number;
  value: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function calculatePct(wins: number, losses: number) {
  if (wins + losses === 0) {
    return 0;
  }
  return Number((wins / (wins + losses)).toFixed(3));
}

function parseRecent10(value: string): ParsedRecent10 {
  const match = value.match(/^(\d+)-(\d+)(?:-(\d+))?$/);
  const wins = Number.parseInt(match?.[1] ?? "0", 10);
  const losses = Number.parseInt(match?.[2] ?? "0", 10);
  const ties = Number.parseInt(match?.[3] ?? "0", 10);
  const hasDecisiveGames = wins + losses > 0;
  return {
    wins,
    losses,
    ties,
    winRate: hasDecisiveGames ? Number((wins / (wins + losses)).toFixed(3)) : 0.5,
  };
}

function parseStreak(value: string): ParsedStreak {
  if (value === "-" || value.trim().length === 0) {
    return { direction: 0, length: 0, value: 0 };
  }

  const win = value.match(/^승(\d+)$/);
  if (win) {
    const length = Number.parseInt(win[1], 10);
    return { direction: 1, length, value: length };
  }

  const loss = value.match(/^패(\d+)$/);
  if (loss) {
    const length = Number.parseInt(loss[1], 10);
    return { direction: -1, length, value: -length };
  }

  const tie = value.match(/^무(\d+)$/);
  if (tie) {
    const length = Number.parseInt(tie[1], 10);
    return { direction: 0, length, value: 0 };
  }

  return { direction: 0, length: 0, value: 0 };
}

function safeRate(numerator: number, denominator: number) {
  if (denominator <= 0) {
    return 0;
  }
  return Number((numerator / denominator).toFixed(4));
}

function inferRegularSeasonGamesPerTeam(season: HistoryTrainingSeason) {
  if (season.teamCount <= 0) {
    return 144;
  }
  const inferred = Math.round((season.scheduledGameCount * 2) / season.teamCount);
  return inferred > 0 ? inferred : 144;
}

function buildSnapshotTeamMap(snapshot: HistoryTrainingDailySnapshot) {
  return Object.fromEntries(snapshot.teams.map((team) => [team.franchiseId, team]));
}

function buildTeamSeasonStatFromSnapshotTeam(
  season: HistoryTrainingSeason,
  team: HistoryTrainingTeamSnapshot,
): TeamSeasonStat {
  return {
    seasonId: season.seasonId,
    seasonTeamId: `${season.seasonId}:${team.franchiseId}`,
    wins: team.wins,
    losses: team.losses,
    ties: team.ties,
    runsScored: team.runsScored,
    runsAllowed: team.runsAllowed,
    homeWins: team.homeWins,
    homeLosses: team.homeLosses,
    awayWins: team.awayWins,
    awayLosses: team.awayLosses,
    last10: team.recent10,
    streak: team.streak,
    offensePlus: 100,
    pitchingPlus: 100,
    bullpenEra: 4,
    teamWar: 0,
  };
}

type SnapshotOperationalContext = {
  teamStateById: Record<string, TeamStateSnapshot>;
  league: TeamStateLeagueAverages;
  derivedById: Record<string, FactBasedOperationalSnapshot>;
};

function buildSnapshotOperationalContext(
  season: HistoryTrainingSeason,
  snapshot: HistoryTrainingDailySnapshot,
): SnapshotOperationalContext {
  const regularSeasonGamesPerTeam = inferRegularSeasonGamesPerTeam(season);
  const states = snapshot.teams.map((team) =>
    buildTeamStateSnapshot(buildTeamSeasonStatFromSnapshotTeam(season, team)),
  );
  const teamStateById = Object.fromEntries(
    snapshot.teams.map((team, index) => [team.franchiseId, states[index]!]),
  );
  const league = buildTeamStateLeagueAverages(states);
  const derivedById = Object.fromEntries(
    Object.entries(teamStateById).map(([franchiseId, state]) => [
      franchiseId,
      buildFactBasedOperationalSnapshot({
        state,
        league,
        regularSeasonGamesPerTeam,
        baseHomeFieldAdjustment: BASE_HOME_FIELD_ADVANTAGE,
      }),
    ]),
  );

  return {
    teamStateById,
    league,
    derivedById,
  };
}

function buildRemainingOpponentFeatures(
  team: HistoryTrainingTeamSnapshot,
  teamMap: Record<string, HistoryTrainingTeamSnapshot>,
) {
  const entries = Object.entries(team.remainingByOpponent);
  const totalRemaining = entries.reduce((sum, [, count]) => sum + count, 0);

  if (totalRemaining === 0) {
    return {
      remainingOpponentAvgPct: 0,
      remainingOpponentAvgGamesBack: 0,
      remainingOpponentAvgRunDiffPerGame: 0,
      remainingVsTop3: 0,
      remainingVsTop5: 0,
      remainingVsBottom3: 0,
      remainingVsWinningTeams: 0,
    };
  }

  let weightedPct = 0;
  let weightedGamesBack = 0;
  let weightedRunDiffPerGame = 0;
  let remainingVsTop3 = 0;
  let remainingVsTop5 = 0;
  let remainingVsBottom3 = 0;
  let remainingVsWinningTeams = 0;

  for (const [opponentId, count] of entries) {
    const opponent = teamMap[opponentId];
    if (!opponent) {
      continue;
    }

    weightedPct += opponent.pct * count;
    weightedGamesBack += opponent.gamesBack * count;
    weightedRunDiffPerGame += safeRate(opponent.runDifferential, Math.max(opponent.games, 1)) * count;

    if (opponent.rank <= 3) {
      remainingVsTop3 += count;
    }
    if (opponent.rank <= 5) {
      remainingVsTop5 += count;
    }
    if (opponent.rank >= 8) {
      remainingVsBottom3 += count;
    }
    if (opponent.pct >= 0.5) {
      remainingVsWinningTeams += count;
    }
  }

  return {
    remainingOpponentAvgPct: Number((weightedPct / totalRemaining).toFixed(4)),
    remainingOpponentAvgGamesBack: Number((weightedGamesBack / totalRemaining).toFixed(4)),
    remainingOpponentAvgRunDiffPerGame: Number((weightedRunDiffPerGame / totalRemaining).toFixed(4)),
    remainingVsTop3,
    remainingVsTop5,
    remainingVsBottom3,
    remainingVsWinningTeams,
  };
}

function buildTeamExample(args: {
  season: HistoryTrainingSeason;
  snapshot: HistoryTrainingDailySnapshot;
  snapshotIndex: number;
  team: HistoryTrainingTeamSnapshot;
  teamMap: Record<string, HistoryTrainingTeamSnapshot>;
  operationalContext: SnapshotOperationalContext;
}): TeamSnapshotTrainingExample {
  const regularSeasonGamesPerTeam = inferRegularSeasonGamesPerTeam(args.season);
  const recent10 = parseRecent10(args.team.recent10);
  const streak = parseStreak(args.team.streak);
  const homePct = calculatePct(args.team.homeWins, args.team.homeLosses);
  const awayPct = calculatePct(args.team.awayWins, args.team.awayLosses);
  const remaining = buildRemainingOpponentFeatures(args.team, args.teamMap);
  const derived = args.operationalContext.derivedById[args.team.franchiseId]!;
  const scheduleDifficulty = buildRemainingScheduleDifficulty({
    remainingByOpponent: args.team.remainingByOpponent,
    teamStateById: args.operationalContext.teamStateById,
    league: args.operationalContext.league,
  });

  return {
    sampleId: `${args.season.seasonId}:${args.snapshot.asOfDate}:${args.team.franchiseId}`,
    seasonId: args.season.seasonId,
    year: args.season.year,
    asOfDate: args.snapshot.asOfDate,
    snapshotIndex: args.snapshotIndex,
    franchiseId: args.team.franchiseId,
    brandId: args.team.brandId,
    brandLabel: args.team.brandLabel,
    shortCode: args.team.shortCode,
    currentRank: args.team.rank,
    currentTop3: args.team.rank <= 3,
    currentTop5: args.team.rank <= 5,
    gamesPlayed: args.team.games,
    gamesRemaining: args.team.remainingGames,
    seasonProgress: Number((args.team.games / regularSeasonGamesPerTeam).toFixed(4)),
    wins: args.team.wins,
    losses: args.team.losses,
    ties: args.team.ties,
    pct: args.team.pct,
    gamesBack: args.team.gamesBack,
    recent10Wins: recent10.wins,
    recent10Losses: recent10.losses,
    recent10Ties: recent10.ties,
    recent10WinRate: recent10.winRate,
    streakDirection: streak.direction,
    streakLength: streak.length,
    streakValue: streak.value,
    runsScoredPerGame: safeRate(args.team.runsScored, Math.max(args.team.games, 1)),
    runsAllowedPerGame: safeRate(args.team.runsAllowed, Math.max(args.team.games, 1)),
    runDiffPerGame: safeRate(args.team.runDifferential, Math.max(args.team.games, 1)),
    homePct,
    awayPct,
    splitPctGap: Number((homePct - awayPct).toFixed(4)),
    remainingHomeShare: safeRate(args.team.remainingHomeGames, Math.max(args.team.remainingGames, 1)),
    remainingAwayShare: safeRate(args.team.remainingAwayGames, Math.max(args.team.remainingGames, 1)),
    remainingOpponentAvgPct: remaining.remainingOpponentAvgPct,
    remainingOpponentAvgGamesBack: remaining.remainingOpponentAvgGamesBack,
    remainingOpponentAvgRunDiffPerGame: remaining.remainingOpponentAvgRunDiffPerGame,
    remainingVsTop3: remaining.remainingVsTop3,
    remainingVsTop5: remaining.remainingVsTop5,
    remainingVsBottom3: remaining.remainingVsBottom3,
    remainingVsWinningTeams: remaining.remainingVsWinningTeams,
    derivedCurrentWeight: derived.currentWeight,
    derivedOffenseSignal: derived.offenseSignal,
    derivedRunPreventionSignal: derived.runPreventionSignal,
    derivedBullpenSignal: derived.bullpenSignal,
    derivedOffenseRating: derived.offenseRating,
    derivedStarterRating: derived.starterRating,
    derivedBullpenRating: derived.bullpenRating,
    derivedConfidenceScore: derived.confidenceScore,
    derivedHomeFieldAdjustment: derived.homeFieldAdjustment,
    derivedRecentFormAdjustment: derived.recentFormAdjustment,
    derivedScheduleDifficulty: scheduleDifficulty,
    finalRank: args.team.finalRank,
    finalWins: args.team.finalWins,
    finalLosses: args.team.finalLosses,
    finalTies: args.team.finalTies,
    finalTop3: args.team.finalRank <= 3,
    finalTop5: args.team.finalRank <= 5,
    finalChampion: args.team.finalRank === 1,
    winsRemaining: args.team.winsRemainingToFinal,
    lossesRemaining: args.team.lossesRemainingToFinal,
    tiesRemaining: args.team.tiesRemainingToFinal,
    rankDeltaToFinal: args.team.rank - args.team.finalRank,
  };
}

function findPregameSnapshot(
  snapshots: HistoryTrainingDailySnapshot[],
  gameDate: string,
) {
  for (let index = snapshots.length - 1; index >= 0; index -= 1) {
    if (snapshots[index].asOfDate < gameDate) {
      return snapshots[index];
    }
  }

  return null;
}

function buildRestDaysMap(season: HistoryTrainingSeason) {
  const lastPlayedDateByTeam = new Map<string, string>();
  const restByGameKey = new Map<string, { homeRestDays: number | null; awayRestDays: number | null }>();

  for (const game of season.gameLedger) {
    const homeLastDate = lastPlayedDateByTeam.get(game.homeFranchiseId) ?? null;
    const awayLastDate = lastPlayedDateByTeam.get(game.awayFranchiseId) ?? null;
    restByGameKey.set(game.gameKey, {
      homeRestDays: homeLastDate ? clamp(daysBetween(game.date, homeLastDate) - 1, 0, 30) : null,
      awayRestDays: awayLastDate ? clamp(daysBetween(game.date, awayLastDate) - 1, 0, 30) : null,
    });
    lastPlayedDateByTeam.set(game.homeFranchiseId, game.date);
    lastPlayedDateByTeam.set(game.awayFranchiseId, game.date);
  }

  return restByGameKey;
}

function daysBetween(leftDate: string, rightDate: string) {
  const left = new Date(`${leftDate}T00:00:00+09:00`).getTime();
  const right = new Date(`${rightDate}T00:00:00+09:00`).getTime();
  return Math.round((left - right) / 86_400_000);
}

function buildGameExample(args: {
  season: HistoryTrainingSeason;
  game: HistoryTrainingSeason["gameLedger"][number];
  snapshots: HistoryTrainingDailySnapshot[];
  restByGameKey: Map<string, { homeRestDays: number | null; awayRestDays: number | null }>;
}): GameOutcomeTrainingExample | null {
  const regularSeasonGamesPerTeam = inferRegularSeasonGamesPerTeam(args.season);
  const pregameSnapshot = findPregameSnapshot(args.snapshots, args.game.date);
  if (!pregameSnapshot) {
    return null;
  }

  const teamMap = buildSnapshotTeamMap(pregameSnapshot);
  const operationalContext = buildSnapshotOperationalContext(args.season, pregameSnapshot);
  const home = teamMap[args.game.homeFranchiseId];
  const away = teamMap[args.game.awayFranchiseId];
  if (!home || !away) {
    return null;
  }

  const homeRecent10 = parseRecent10(home.recent10);
  const awayRecent10 = parseRecent10(away.recent10);
  const homeHomePct = calculatePct(home.homeWins, home.homeLosses);
  const awayAwayPct = calculatePct(away.awayWins, away.awayLosses);
  const homeRunsScoredPerGame = safeRate(home.runsScored, Math.max(home.games, 1));
  const awayRunsScoredPerGame = safeRate(away.runsScored, Math.max(away.games, 1));
  const homeRunsAllowedPerGame = safeRate(home.runsAllowed, Math.max(home.games, 1));
  const awayRunsAllowedPerGame = safeRate(away.runsAllowed, Math.max(away.games, 1));
  const homeRunDiffPerGame = safeRate(home.runDifferential, Math.max(home.games, 1));
  const awayRunDiffPerGame = safeRate(away.runDifferential, Math.max(away.games, 1));
  const rest = args.restByGameKey.get(args.game.gameKey) ?? { homeRestDays: null, awayRestDays: null };
  const homeDerived = operationalContext.derivedById[home.franchiseId]!;
  const awayDerived = operationalContext.derivedById[away.franchiseId]!;
  const homeScheduleDifficulty = buildRemainingScheduleDifficulty({
    remainingByOpponent: home.remainingByOpponent,
    teamStateById: operationalContext.teamStateById,
    league: operationalContext.league,
  });
  const awayScheduleDifficulty = buildRemainingScheduleDifficulty({
    remainingByOpponent: away.remainingByOpponent,
    teamStateById: operationalContext.teamStateById,
    league: operationalContext.league,
  });
  const outcome =
    args.game.isTie || args.game.homeScore === args.game.awayScore
      ? "tie"
      : (args.game.homeScore ?? 0) > (args.game.awayScore ?? 0)
        ? "homeWin"
        : "awayWin";

  return {
    sampleId: `${args.season.seasonId}:${args.game.gameKey}`,
    seasonId: args.season.seasonId,
    year: args.season.year,
    gameKey: args.game.gameKey,
    date: args.game.date,
    scheduledAt: args.game.scheduledAt,
    month: Number.parseInt(args.game.date.slice(5, 7), 10),
    homeFranchiseId: args.game.homeFranchiseId,
    awayFranchiseId: args.game.awayFranchiseId,
    homeBrandLabel: args.game.homeBrandLabel,
    awayBrandLabel: args.game.awayBrandLabel,
    homeRank: home.rank,
    awayRank: away.rank,
    rankGap: away.rank - home.rank,
    homePct: home.pct,
    awayPct: away.pct,
    pctGap: Number((home.pct - away.pct).toFixed(4)),
    homeGamesBack: home.gamesBack,
    awayGamesBack: away.gamesBack,
    gamesBackGap: Number((away.gamesBack - home.gamesBack).toFixed(4)),
    homeRecent10WinRate: homeRecent10.winRate,
    awayRecent10WinRate: awayRecent10.winRate,
    recent10Gap: Number((homeRecent10.winRate - awayRecent10.winRate).toFixed(4)),
    homeRunsScoredPerGame,
    awayRunsScoredPerGame,
    offenseGap: Number((homeRunsScoredPerGame - awayRunsScoredPerGame).toFixed(4)),
    homeRunsAllowedPerGame,
    awayRunsAllowedPerGame,
    defenseGap: Number((awayRunsAllowedPerGame - homeRunsAllowedPerGame).toFixed(4)),
    homeRunDiffPerGame,
    awayRunDiffPerGame,
    runDiffGap: Number((homeRunDiffPerGame - awayRunDiffPerGame).toFixed(4)),
    homeHomePct,
    awayAwayPct,
    venueSplitGap: Number((homeHomePct - awayAwayPct).toFixed(4)),
    homeSeasonProgress: Number((home.games / regularSeasonGamesPerTeam).toFixed(4)),
    awaySeasonProgress: Number((away.games / regularSeasonGamesPerTeam).toFixed(4)),
    progressGap: Number(((home.games - away.games) / regularSeasonGamesPerTeam).toFixed(4)),
    homeDerivedCurrentWeight: homeDerived.currentWeight,
    awayDerivedCurrentWeight: awayDerived.currentWeight,
    currentWeightGap: Number((homeDerived.currentWeight - awayDerived.currentWeight).toFixed(4)),
    homeDerivedOffenseRating: homeDerived.offenseRating,
    awayDerivedOffenseRating: awayDerived.offenseRating,
    offenseRatingGap: Number((homeDerived.offenseRating - awayDerived.offenseRating).toFixed(4)),
    homeDerivedStarterRating: homeDerived.starterRating,
    awayDerivedStarterRating: awayDerived.starterRating,
    starterRatingGap: Number((homeDerived.starterRating - awayDerived.starterRating).toFixed(4)),
    homeDerivedBullpenRating: homeDerived.bullpenRating,
    awayDerivedBullpenRating: awayDerived.bullpenRating,
    bullpenRatingGap: Number((homeDerived.bullpenRating - awayDerived.bullpenRating).toFixed(4)),
    homeDerivedConfidenceScore: homeDerived.confidenceScore,
    awayDerivedConfidenceScore: awayDerived.confidenceScore,
    confidenceScoreGap: Number((homeDerived.confidenceScore - awayDerived.confidenceScore).toFixed(4)),
    homeDerivedRecentFormAdjustment: homeDerived.recentFormAdjustment,
    awayDerivedRecentFormAdjustment: awayDerived.recentFormAdjustment,
    recentFormAdjustmentGap: Number(
      (homeDerived.recentFormAdjustment - awayDerived.recentFormAdjustment).toFixed(4),
    ),
    homeDerivedScheduleDifficulty: homeScheduleDifficulty,
    awayDerivedScheduleDifficulty: awayScheduleDifficulty,
    scheduleDifficultyGap: Number((homeScheduleDifficulty - awayScheduleDifficulty).toFixed(4)),
    homeDerivedHomeFieldAdjustment: homeDerived.homeFieldAdjustment,
    homeRestDays: rest.homeRestDays,
    awayRestDays: rest.awayRestDays,
    restGap:
      rest.homeRestDays === null || rest.awayRestDays === null
        ? null
        : rest.homeRestDays - rest.awayRestDays,
    outcome,
    homeWin: outcome === "homeWin",
    awayWin: outcome === "awayWin",
    tie: outcome === "tie",
    homeScore: args.game.homeScore ?? 0,
    awayScore: args.game.awayScore ?? 0,
  };
}

export function buildTrainingCorpusSeason(season: HistoryTrainingSeason): TrainingCorpusSeason {
  const usableSnapshots = season.snapshots.filter((snapshot) => snapshot.remainingGames > 0);
  const teamExamples = usableSnapshots.flatMap((snapshot, index) => {
    const teamMap = buildSnapshotTeamMap(snapshot);
    const operationalContext = buildSnapshotOperationalContext(season, snapshot);
    return snapshot.teams.map((team) =>
      buildTeamExample({
        season,
        snapshot,
        snapshotIndex: index + 1,
        team,
        teamMap,
        operationalContext,
      }),
    );
  });

  const restByGameKey = buildRestDaysMap(season);
  const gameExamples = season.gameLedger
    .map((game) =>
      buildGameExample({
        season,
        game,
        snapshots: usableSnapshots,
        restByGameKey,
      }),
    )
    .filter((example): example is GameOutcomeTrainingExample => example !== null);

  return trainingCorpusSeasonSchema.parse({
    generatedAt: new Date().toISOString(),
    seasonId: season.seasonId,
    year: season.year,
    teamExampleCount: teamExamples.length,
    gameExampleCount: gameExamples.length,
    teamExamples,
    gameExamples,
  });
}

export function buildTrainingCorpusBundle(seasons: HistoryTrainingSeason[]): TrainingCorpusBundle {
  const seasonCorpora = seasons.map((season) => buildTrainingCorpusSeason(season));
  const teamExamples = seasonCorpora.flatMap((season) => season.teamExamples);
  const gameExamples = seasonCorpora.flatMap((season) => season.gameExamples);

  return trainingCorpusBundleSchema.parse({
    generatedAt: new Date().toISOString(),
    years: seasonCorpora.map((season) => season.year),
    teamExampleCount: teamExamples.length,
    gameExampleCount: gameExamples.length,
    teamExamples,
    gameExamples,
  });
}
