import { describe, expect, it } from "vitest";

import type { GameOutcomeTrainingExample } from "@/lib/data-sources/kbo/training-corpus-types";
import { fitGameModelParameters } from "@/lib/training/kbo/game-model-fit";
import {
  gameModelBacktestSummarySchema,
  gameModelParameterArtifactSchema,
} from "@/lib/training/kbo/model-types";

function buildExample(
  sampleId: string,
  year: number,
  overrides: Partial<GameOutcomeTrainingExample>,
): GameOutcomeTrainingExample {
  return {
    sampleId,
    seasonId: `kbo-${year}`,
    year,
    gameKey: `${sampleId}-game`,
    date: `${year}-04-01`,
    scheduledAt: `${year}-04-01T18:30:00+09:00`,
    month: 4,
    homeFranchiseId: "home",
    awayFranchiseId: "away",
    homeBrandLabel: "Home",
    awayBrandLabel: "Away",
    homeRank: 1,
    awayRank: 8,
    rankGap: -7,
    homePct: 0.65,
    awayPct: 0.35,
    pctGap: 0.3,
    homeGamesBack: 0,
    awayGamesBack: 8,
    gamesBackGap: -8,
    homeRecent10WinRate: 0.7,
    awayRecent10WinRate: 0.3,
    recent10Gap: 0.4,
    homeRunsScoredPerGame: 5.6,
    awayRunsScoredPerGame: 3.9,
    offenseGap: 1.7,
    homeRunsAllowedPerGame: 3.6,
    awayRunsAllowedPerGame: 5.1,
    defenseGap: -1.5,
    homeRunDiffPerGame: 2,
    awayRunDiffPerGame: -1.2,
    runDiffGap: 3.2,
    homeHomePct: 0.72,
    awayAwayPct: 0.31,
    venueSplitGap: 0.41,
    homeSeasonProgress: 0.32,
    awaySeasonProgress: 0.32,
    progressGap: 0,
    homeDerivedCurrentWeight: 0.26,
    awayDerivedCurrentWeight: 0.26,
    currentWeightGap: 0,
    homeDerivedOffenseRating: 106,
    awayDerivedOffenseRating: 96,
    offenseRatingGap: 10,
    homeDerivedStarterRating: 104,
    awayDerivedStarterRating: 95,
    starterRatingGap: 9,
    homeDerivedBullpenRating: 103,
    awayDerivedBullpenRating: 97,
    bullpenRatingGap: 6,
    homeDerivedConfidenceScore: 0.74,
    awayDerivedConfidenceScore: 0.7,
    confidenceScoreGap: 0.04,
    homeDerivedRecentFormAdjustment: 0.11,
    awayDerivedRecentFormAdjustment: -0.09,
    recentFormAdjustmentGap: 0.2,
    homeDerivedScheduleDifficulty: 0.08,
    awayDerivedScheduleDifficulty: -0.02,
    scheduleDifficultyGap: 0.1,
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

describe("fitGameModelParameters", () => {
  it("returns parseable parameter and backtest artifacts and improves fit objective", () => {
    const examplesByYear: Record<number, GameOutcomeTrainingExample[]> = {
      2021: [
        buildExample("y2021-a", 2021, {}),
        buildExample("y2021-b", 2021, {
          homeDerivedOffenseRating: 109,
          awayDerivedStarterRating: 94,
          homeScore: 7,
          awayScore: 2,
        }),
      ],
      2022: [
        buildExample("y2022-a", 2022, {
          homeDerivedOffenseRating: 97,
          awayDerivedOffenseRating: 104,
          homeDerivedStarterRating: 96,
          awayDerivedStarterRating: 103,
          homeDerivedBullpenRating: 97,
          awayDerivedBullpenRating: 104,
          homeDerivedRecentFormAdjustment: -0.05,
          awayDerivedRecentFormAdjustment: 0.08,
          homeDerivedHomeFieldAdjustment: 0.16,
          outcome: "awayWin",
          homeWin: false,
          awayWin: true,
          homeScore: 2,
          awayScore: 5,
        }),
      ],
      2023: [
        buildExample("y2023-a", 2023, {
          homeDerivedOffenseRating: 104,
          awayDerivedOffenseRating: 99,
          outcome: "homeWin",
        }),
      ],
    };

    const result = fitGameModelParameters(examplesByYear, [2021, 2022], [2023], {
      maxRounds: 3,
    });

    expect(gameModelParameterArtifactSchema.parse(result.artifact).fittedParameters).toBeTruthy();
    expect(gameModelBacktestSummarySchema.parse(result.backtest).fitted.fit.sampleCount).toBeGreaterThan(0);
    expect(result.backtest.fitted.fit.logLoss).toBeLessThanOrEqual(result.backtest.baseline.fit.logLoss);
  });
});
