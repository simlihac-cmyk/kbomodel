import { describe, expect, it } from "vitest";

import type { Game, TeamStrengthSnapshot } from "@/lib/domain/kbo/types";
import { buildGameProbabilitySnapshot } from "@/lib/sim/kbo/probabilities";

function buildStrengthSnapshot(
  overrides: Partial<TeamStrengthSnapshot>,
): TeamStrengthSnapshot {
  return {
    seasonTeamId: "season:team",
    offenseRating: 100,
    starterRating: 100,
    bullpenRating: 100,
    homeFieldAdjustment: 0.18,
    recentFormAdjustment: 0,
    confidenceScore: 0.8,
    priorWeight: 0.4,
    currentWeight: 0.6,
    scheduleDifficulty: 0,
    headToHeadLeverage: 0,
    explanationReasons: [],
    ...overrides,
  };
}

describe("buildGameProbabilitySnapshot", () => {
  const game: Game = {
    gameId: "game-1",
    seasonId: "kbo-2026",
    seriesId: "series-1",
    homeSeasonTeamId: "season:home",
    awaySeasonTeamId: "season:away",
    scheduledAt: "2026-05-01T18:30:00+09:00",
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

  it("produces probabilities that sum to 1 and favors the stronger home team", () => {
    const snapshot = buildGameProbabilitySnapshot(
      game,
      buildStrengthSnapshot({
        seasonTeamId: "season:home",
        offenseRating: 109,
        starterRating: 107,
        bullpenRating: 105,
        recentFormAdjustment: 0.08,
      }),
      buildStrengthSnapshot({
        seasonTeamId: "season:away",
        offenseRating: 98,
        starterRating: 97,
        bullpenRating: 96,
        recentFormAdjustment: -0.04,
      }),
      true,
    );

    const total =
      snapshot.homeWinProb + snapshot.awayWinProb + snapshot.tieProb;

    expect(total).toBeCloseTo(1, 4);
    expect(snapshot.homeWinProb).toBeGreaterThan(snapshot.awayWinProb);
    expect(snapshot.expectedRunsHome).toBeGreaterThan(snapshot.expectedRunsAway);
  });

  it("shrinks edge intensity when confidence is low", () => {
    const highConfidence = buildGameProbabilitySnapshot(
      game,
      buildStrengthSnapshot({
        seasonTeamId: "season:home",
        offenseRating: 108,
        starterRating: 106,
        bullpenRating: 104,
        confidenceScore: 0.94,
      }),
      buildStrengthSnapshot({
        seasonTeamId: "season:away",
        offenseRating: 97,
        starterRating: 96,
        bullpenRating: 95,
        confidenceScore: 0.94,
      }),
      true,
    );
    const lowConfidence = buildGameProbabilitySnapshot(
      game,
      buildStrengthSnapshot({
        seasonTeamId: "season:home",
        offenseRating: 108,
        starterRating: 106,
        bullpenRating: 104,
        confidenceScore: 0.32,
      }),
      buildStrengthSnapshot({
        seasonTeamId: "season:away",
        offenseRating: 97,
        starterRating: 96,
        bullpenRating: 95,
        confidenceScore: 0.32,
      }),
      true,
    );

    expect(highConfidence.homeWinProb).toBeGreaterThan(lowConfidence.homeWinProb);
    expect(highConfidence.expectedRunsHome - highConfidence.expectedRunsAway).toBeGreaterThan(
      lowConfidence.expectedRunsHome - lowConfidence.expectedRunsAway,
    );
  });

  it("does not double-count remaining schedule difficulty in a single-game probability", () => {
    const easierFuture = buildGameProbabilitySnapshot(
      game,
      buildStrengthSnapshot({
        seasonTeamId: "season:home",
      }),
      buildStrengthSnapshot({
        seasonTeamId: "season:away",
        scheduleDifficulty: -0.9,
      }),
      true,
    );
    const harderFuture = buildGameProbabilitySnapshot(
      game,
      buildStrengthSnapshot({
        seasonTeamId: "season:home",
      }),
      buildStrengthSnapshot({
        seasonTeamId: "season:away",
        scheduleDifficulty: 1.4,
      }),
      true,
    );

    expect(easierFuture.homeWinProb).toBeCloseTo(harderFuture.homeWinProb, 4);
    expect(easierFuture.awayWinProb).toBeCloseTo(harderFuture.awayWinProb, 4);
    expect(easierFuture.tieProb).toBeCloseTo(harderFuture.tieProb, 4);
  });

  it("applies projected starter turns at the game level", () => {
    const baseline = buildGameProbabilitySnapshot(
      game,
      buildStrengthSnapshot({
        seasonTeamId: "season:home",
        starterRating: 101,
      }),
      buildStrengthSnapshot({
        seasonTeamId: "season:away",
        starterRating: 101,
      }),
      true,
    );
    const withProjectedStarter = buildGameProbabilitySnapshot(
      game,
      buildStrengthSnapshot({
        seasonTeamId: "season:home",
        starterRating: 101,
      }),
      buildStrengthSnapshot({
        seasonTeamId: "season:away",
        starterRating: 101,
      }),
      true,
      {
        home: {
          playerId: "home-sp",
          playerName: "홈 선발",
          starterDelta: 3.2,
          availability: "active",
          note: "rotation turn",
        },
        away: null,
      },
    );

    expect(withProjectedStarter.homeWinProb).toBeGreaterThan(baseline.homeWinProb);
    expect(withProjectedStarter.expectedRunsAway).toBeLessThan(baseline.expectedRunsAway);
    expect(withProjectedStarter.homeLikelyStarterId).toBe("home-sp");
    expect(withProjectedStarter.starterAdjustmentApplied).toBe(true);
  });
});
