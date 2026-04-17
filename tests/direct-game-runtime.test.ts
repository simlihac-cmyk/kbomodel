import { describe, expect, it } from "vitest";

import type { Game, TeamStrengthSnapshot } from "@/lib/domain/kbo/types";
import type { GameOutcomeTrainingExample } from "@/lib/data-sources/kbo/training-corpus-types";
import { buildDirectGameFeaturesFromRuntime, buildDirectGameFeaturesFromTrainingExample } from "@/lib/sim/kbo/direct-game/feature-builder";
import { DEFAULT_DIRECT_GAME_MODEL_PARAMETERS } from "@/lib/sim/kbo/direct-game/model-types";
import { applyDirectGameRuntimeModel } from "@/lib/sim/kbo/direct-game/runtime";

function buildStrengthSnapshot(
  overrides: Partial<TeamStrengthSnapshot>,
): TeamStrengthSnapshot {
  return {
    seasonTeamId: "season:team",
    offenseRating: 100,
    starterRating: 100,
    bullpenRating: 100,
    winPct: 0.5,
    recent10WinRate: 0.5,
    opponentAdjustedRecent10WinRate: 0.5,
    homePct: 0.5,
    awayPct: 0.5,
    splitGap: 0,
    seasonProgress: 0.2,
    homeFieldAdjustment: 0.18,
    recentFormAdjustment: 0,
    confidenceScore: 0.5,
    priorWeight: 0.5,
    currentWeight: 0.5,
    scheduleDifficulty: 0,
    headToHeadLeverage: 0,
    explanationReasons: [],
    ...overrides,
  };
}

function buildTrainingExample(
  overrides: Partial<GameOutcomeTrainingExample> = {},
): GameOutcomeTrainingExample {
  return {
    sampleId: "sample-1",
    seasonId: "kbo-2026",
    year: 2026,
    gameKey: "game-1",
    date: "2026-04-17",
    scheduledAt: "2026-04-17T18:30:00+09:00",
    month: 4,
    homeFranchiseId: "home",
    awayFranchiseId: "away",
    homeBrandLabel: "Home",
    awayBrandLabel: "Away",
    homeRank: 2,
    awayRank: 7,
    rankGap: -5,
    homePct: 0.625,
    awayPct: 0.375,
    pctGap: 0.25,
    homeGamesBack: 1,
    awayGamesBack: 6,
    gamesBackGap: -5,
    homeRecent10WinRate: 0.7,
    awayRecent10WinRate: 0.3,
    recent10Gap: 0.4,
    homeRecent10OpponentAvgPriorPct: 0.56,
    awayRecent10OpponentAvgPriorPct: 0.44,
    recent10OpponentPriorGap: 0.12,
    homeOpponentAdjustedRecent10WinRate: 0.76,
    awayOpponentAdjustedRecent10WinRate: 0.24,
    opponentAdjustedRecent10Gap: 0.52,
    homeRunsScoredPerGame: 5.6,
    awayRunsScoredPerGame: 4.1,
    offenseGap: 1.5,
    homeRunsAllowedPerGame: 3.8,
    awayRunsAllowedPerGame: 4.9,
    defenseGap: -1.1,
    homeRunDiffPerGame: 1.8,
    awayRunDiffPerGame: -0.8,
    runDiffGap: 2.6,
    homeHomePct: 0.71,
    awayAwayPct: 0.32,
    venueSplitGap: 0.39,
    homeSeasonProgress: 0.18,
    awaySeasonProgress: 0.18,
    progressGap: 0,
    homeDerivedCurrentWeight: 0.14,
    awayDerivedCurrentWeight: 0.14,
    currentWeightGap: 0,
    homeDerivedOffenseRating: 103,
    awayDerivedOffenseRating: 98,
    offenseRatingGap: 5,
    homeDerivedStarterRating: 102,
    awayDerivedStarterRating: 97,
    starterRatingGap: 5,
    homeDerivedBullpenRating: 101,
    awayDerivedBullpenRating: 98,
    bullpenRatingGap: 3,
    homeDerivedConfidenceScore: 0.48,
    awayDerivedConfidenceScore: 0.41,
    confidenceScoreGap: 0.07,
    homeDerivedRecentFormAdjustment: 0.12,
    awayDerivedRecentFormAdjustment: -0.08,
    recentFormAdjustmentGap: 0.2,
    homeDerivedScheduleDifficulty: 0.02,
    awayDerivedScheduleDifficulty: -0.03,
    scheduleDifficultyGap: 0.05,
    homeDerivedHomeFieldAdjustment: 0.18,
    homeRestDays: 1,
    awayRestDays: 0,
    restGap: 1,
    outcome: "homeWin",
    homeWin: true,
    awayWin: false,
    tie: false,
    homeScore: 6,
    awayScore: 3,
    ...overrides,
  };
}

describe("direct game runtime", () => {
  it("builds factual runtime features from strength snapshots", () => {
    const game: Game = {
      gameId: "game-1",
      seasonId: "kbo-2026",
      seriesId: "series-1",
      homeSeasonTeamId: "season:home",
      awaySeasonTeamId: "season:away",
      scheduledAt: "2026-04-17T18:30:00+09:00",
      status: "scheduled",
      originalScheduledAt: null,
      rescheduledFromGameId: null,
      homeScore: null,
      awayScore: null,
      innings: null,
      isTie: false,
      note: null,
      attendance: null,
      externalLinks: [],
    };

    const features = buildDirectGameFeaturesFromRuntime({
      game,
      homeStrength: buildStrengthSnapshot({
        seasonTeamId: "season:home",
        winPct: 0.625,
        recent10WinRate: 0.7,
        opponentAdjustedRecent10WinRate: 0.76,
        offenseRating: 104,
        starterRating: 103,
        bullpenRating: 101,
        confidenceScore: 0.52,
        homePct: 0.72,
        seasonProgress: 0.18,
      }),
      awayStrength: buildStrengthSnapshot({
        seasonTeamId: "season:away",
        winPct: 0.375,
        recent10WinRate: 0.3,
        opponentAdjustedRecent10WinRate: 0.24,
        offenseRating: 98,
        starterRating: 97,
        bullpenRating: 99,
        confidenceScore: 0.42,
        awayPct: 0.31,
        seasonProgress: 0.18,
      }),
      context: {
        restGap: 1,
      },
    });

    expect(features.pctGap).toBeCloseTo(0.25, 6);
    expect(features.opponentAdjustedRecent10Gap).toBeCloseTo(0.52, 6);
    expect(features.restXBullpenGap).toBeCloseTo(2, 6);
  });

  it("maps training examples into the same direct-game feature space", () => {
    const features = buildDirectGameFeaturesFromTrainingExample(buildTrainingExample());

    expect(features.pctGap).toBeCloseTo(0.25, 6);
    expect(features.opponentAdjustedRecent10Gap).toBeCloseTo(0.52, 6);
    expect(features.progressXPctGap).toBeCloseTo(0.045, 6);
  });

  it("preserves base probabilities with the zero-weight current model", () => {
    const adjusted = applyDirectGameRuntimeModel({
      homeWinProb: 0.56,
      awayWinProb: 0.39,
      tieProb: 0.05,
      features: buildDirectGameFeaturesFromTrainingExample(buildTrainingExample()),
      parameters: DEFAULT_DIRECT_GAME_MODEL_PARAMETERS,
    });

    expect(adjusted.homeWinProb).toBeCloseTo(0.56, 4);
    expect(adjusted.awayWinProb).toBeCloseTo(0.39, 4);
    expect(adjusted.tieProb).toBeCloseTo(0.05, 4);
  });

  it("can learn to widen decisive edges without changing the tie rate", () => {
    const features = buildDirectGameFeaturesFromTrainingExample(buildTrainingExample());
    const adjusted = applyDirectGameRuntimeModel({
      homeWinProb: 0.52,
      awayWinProb: 0.43,
      tieProb: 0.05,
      features,
      parameters: {
        ...DEFAULT_DIRECT_GAME_MODEL_PARAMETERS,
        decisiveWeights: {
          ...DEFAULT_DIRECT_GAME_MODEL_PARAMETERS.decisiveWeights,
          opponentAdjustedRecent10Gap: 1.1,
          pctGap: 0.8,
        },
      },
    });

    expect(adjusted.homeWinProb).toBeGreaterThan(0.52);
    expect(adjusted.awayWinProb).toBeLessThan(0.43);
    expect(adjusted.tieProb).toBeCloseTo(0.05, 4);
  });
});
