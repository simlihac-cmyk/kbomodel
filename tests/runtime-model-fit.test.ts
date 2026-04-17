import { describe, expect, it } from "vitest";

import type {
  GameOutcomeTrainingExample,
  TeamSnapshotTrainingExample,
  TrainingCorpusSeason,
} from "@/lib/data-sources/kbo/training-corpus-types";
import {
  runtimeModelBacktestSummarySchema,
  runtimeModelParameterArtifactSchema,
} from "@/lib/training/kbo/model-types";
import { fitRuntimeModelParameters } from "@/lib/training/kbo/runtime-model-fit";

function buildTeamExample(
  year: number,
  asOfDate: string,
  franchiseId: string,
  overrides: Partial<TeamSnapshotTrainingExample>,
): TeamSnapshotTrainingExample {
  const isHome = franchiseId === "home";
  return {
    sampleId: `kbo-${year}:${asOfDate}:${franchiseId}`,
    seasonId: `kbo-${year}`,
    year,
    asOfDate,
    snapshotIndex: 1,
    franchiseId,
    brandId: franchiseId,
    brandLabel: franchiseId === "home" ? "Home" : "Away",
    shortCode: franchiseId.toUpperCase(),
    currentRank: isHome ? 1 : 2,
    currentTop3: true,
    currentTop5: true,
    gamesPlayed: 12,
    gamesRemaining: 132,
    seasonProgress: 12 / 144,
    wins: isHome ? 8 : 4,
    losses: isHome ? 4 : 8,
    ties: 0,
    pct: isHome ? 0.667 : 0.333,
    gamesBack: isHome ? 0 : 4,
    recent10Wins: isHome ? 7 : 3,
    recent10Losses: isHome ? 3 : 7,
    recent10Ties: 0,
    recent10WinRate: isHome ? 0.7 : 0.3,
    recent10OpponentAvgPriorPct: isHome ? 0.56 : 0.44,
    opponentAdjustedRecent10WinRate: isHome ? 0.76 : 0.24,
    streakDirection: isHome ? 1 : -1,
    streakLength: 2,
    streakValue: isHome ? 2 : -2,
    runsScoredPerGame: isHome ? 5.8 : 4.1,
    runsAllowedPerGame: isHome ? 3.7 : 5.3,
    runDiffPerGame: isHome ? 2.1 : -1.2,
    homePct: isHome ? 0.75 : 0.35,
    awayPct: isHome ? 0.58 : 0.29,
    splitPctGap: isHome ? 0.17 : 0.06,
    remainingHomeShare: 0.5,
    remainingAwayShare: 0.5,
    remainingOpponentAvgPct: 0.5,
    remainingOpponentAvgGamesBack: 2,
    remainingOpponentAvgRunDiffPerGame: 0,
    remainingVsTop3: 30,
    remainingVsTop5: 60,
    remainingVsBottom3: 24,
    remainingVsWinningTeams: 66,
    derivedCurrentWeight: 0.12,
    derivedOffenseSignal: isHome ? 6 : -4,
    derivedRunPreventionSignal: isHome ? 5 : -4,
    derivedBullpenSignal: isHome ? 3 : -2,
    derivedOffenseRating: isHome ? 101 : 99,
    derivedStarterRating: isHome ? 100.8 : 99.2,
    derivedBullpenRating: isHome ? 100.4 : 99.6,
    derivedConfidenceScore: 0.32,
    derivedHomeFieldAdjustment: 0.2,
    derivedRecentFormAdjustment: isHome ? 0.18 : -0.18,
    derivedScheduleDifficulty: 0,
    finalRank: isHome ? 1 : 2,
    finalWins: isHome ? 86 : 58,
    finalLosses: isHome ? 58 : 86,
    finalTies: 0,
    finalTop3: isHome,
    finalTop5: true,
    finalChampion: isHome,
    winsRemaining: isHome ? 78 : 54,
    lossesRemaining: isHome ? 54 : 78,
    tiesRemaining: 0,
    rankDeltaToFinal: 0,
    ...overrides,
  };
}

function buildGameExample(
  year: number,
  sampleId: string,
  overrides: Partial<GameOutcomeTrainingExample>,
): GameOutcomeTrainingExample {
  return {
    sampleId,
    seasonId: `kbo-${year}`,
    year,
    gameKey: `${sampleId}-game`,
    date: `${year}-04-02`,
    scheduledAt: `${year}-04-02T18:30:00+09:00`,
    month: 4,
    homeFranchiseId: "home",
    awayFranchiseId: "away",
    homeBrandLabel: "Home",
    awayBrandLabel: "Away",
    homeRank: 1,
    awayRank: 2,
    rankGap: 1,
    homePct: 0.667,
    awayPct: 0.333,
    pctGap: 0.334,
    homeGamesBack: 0,
    awayGamesBack: 4,
    gamesBackGap: 4,
    homeRecent10WinRate: 0.7,
    awayRecent10WinRate: 0.3,
    recent10Gap: 0.4,
    homeRecent10OpponentAvgPriorPct: 0.56,
    awayRecent10OpponentAvgPriorPct: 0.44,
    recent10OpponentPriorGap: 0.12,
    homeOpponentAdjustedRecent10WinRate: 0.76,
    awayOpponentAdjustedRecent10WinRate: 0.24,
    opponentAdjustedRecent10Gap: 0.52,
    homeRunsScoredPerGame: 5.8,
    awayRunsScoredPerGame: 4.1,
    offenseGap: 1.7,
    homeRunsAllowedPerGame: 3.7,
    awayRunsAllowedPerGame: 5.3,
    defenseGap: 1.6,
    homeRunDiffPerGame: 2.1,
    awayRunDiffPerGame: -1.2,
    runDiffGap: 3.3,
    homeHomePct: 0.75,
    awayAwayPct: 0.29,
    venueSplitGap: 0.46,
    homeSeasonProgress: 12 / 144,
    awaySeasonProgress: 12 / 144,
    progressGap: 0,
    homeDerivedCurrentWeight: 0.12,
    awayDerivedCurrentWeight: 0.12,
    currentWeightGap: 0,
    homeDerivedOffenseRating: 101,
    awayDerivedOffenseRating: 99,
    offenseRatingGap: 2,
    homeDerivedStarterRating: 100.8,
    awayDerivedStarterRating: 99.2,
    starterRatingGap: 1.6,
    homeDerivedBullpenRating: 100.4,
    awayDerivedBullpenRating: 99.6,
    bullpenRatingGap: 0.8,
    homeDerivedConfidenceScore: 0.32,
    awayDerivedConfidenceScore: 0.32,
    confidenceScoreGap: 0,
    homeDerivedRecentFormAdjustment: 0.18,
    awayDerivedRecentFormAdjustment: -0.18,
    recentFormAdjustmentGap: 0.36,
    homeDerivedScheduleDifficulty: 0,
    awayDerivedScheduleDifficulty: 0,
    scheduleDifficultyGap: 0,
    homeDerivedHomeFieldAdjustment: 0.2,
    homeRestDays: 1,
    awayRestDays: 1,
    restGap: 0,
    outcome: "homeWin",
    homeWin: true,
    awayWin: false,
    tie: false,
    homeScore: 6,
    awayScore: 3,
    ...overrides,
  };
}

function buildSeason(year: number, gameOverrides: Partial<GameOutcomeTrainingExample> = {}): TrainingCorpusSeason {
  return {
    generatedAt: `${year}-10-01T00:00:00.000Z`,
    seasonId: `kbo-${year}`,
    year,
    teamExampleCount: 2,
    gameExampleCount: 1,
    teamExamples: [
      buildTeamExample(year, `${year}-04-01`, "home", {}),
      buildTeamExample(year, `${year}-04-01`, "away", {}),
    ],
    gameExamples: [
      buildGameExample(year, `y${year}-g1`, gameOverrides),
    ],
  };
}

describe("fitRuntimeModelParameters", () => {
  it("returns parseable combined runtime artifacts", () => {
    const seasons = [
      buildSeason(2021, {}),
      buildSeason(2022, {
        homeRunsScoredPerGame: 4.2,
        awayRunsScoredPerGame: 5.5,
        homeRunsAllowedPerGame: 5.1,
        awayRunsAllowedPerGame: 3.8,
        offenseGap: -1.3,
        defenseGap: -1.3,
        homeDerivedRecentFormAdjustment: -0.12,
        awayDerivedRecentFormAdjustment: 0.12,
        recentFormAdjustmentGap: -0.24,
        outcome: "awayWin",
        homeWin: false,
        awayWin: true,
        homeScore: 2,
        awayScore: 5,
      }),
      buildSeason(2023, {}),
    ];

    const result = fitRuntimeModelParameters(seasons, [2021, 2022], [2023], {
      iterations: 1,
      strengthMaxRounds: 1,
      gameMaxRounds: 1,
    });

    expect(runtimeModelParameterArtifactSchema.parse(result.artifact).fittedParameters.game).toBeTruthy();
    expect(runtimeModelParameterArtifactSchema.parse(result.artifact).fittedParameters.contextual).toBeTruthy();
    expect(runtimeModelParameterArtifactSchema.parse(result.artifact).fittedParameters.direct).toBeTruthy();
    expect(runtimeModelBacktestSummarySchema.parse(result.backtest).fitted.fit.sampleCount).toBeGreaterThan(0);
    expect(result.artifact.search.evaluations.total).toBeGreaterThan(0);
    expect(result.artifact.search.evaluations.contextual).toBeGreaterThan(0);
    expect(result.artifact.search.evaluations.direct).toBeGreaterThan(0);
    expect(result.artifact.search.starts).toBeGreaterThan(0);
    expect(result.backtest.multiStarts.length).toBeGreaterThan(0);
    expect(result.backtest.rollingValidation.length).toBeGreaterThan(0);
  });

  it("honors start counts above the old five-candidate cap", () => {
    const seasons = [
      buildSeason(2021, {}),
      buildSeason(2022, {
        outcome: "awayWin",
        homeWin: false,
        awayWin: true,
        homeScore: 2,
        awayScore: 5,
      }),
      buildSeason(2023, {}),
      buildSeason(2024, {}),
      buildSeason(2025, {}),
    ];

    const result = fitRuntimeModelParameters(seasons, [2021, 2022, 2023, 2024], [2025], {
      iterations: 1,
      strengthMaxRounds: 1,
      gameMaxRounds: 1,
      starts: 7,
    });

    expect(result.artifact.search.starts).toBe(7);
    expect(result.backtest.multiStarts).toHaveLength(7);
  });
});
