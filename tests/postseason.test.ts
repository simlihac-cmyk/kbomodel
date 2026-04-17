import { describe, expect, it } from "vitest";

import { simulatePostseasonRun } from "@/lib/domain/kbo/postseason";
import type { KboSeasonRuleset, StandingRow, TeamStrengthSnapshot } from "@/lib/domain/kbo/types";

describe("simulatePostseasonRun", () => {
  it("advances stronger higher seeds through the ladder", () => {
    const rows = Array.from({ length: 5 }, (_, index) => ({
      seasonTeamId: `season:${index + 1}`,
      brandId: `${index + 1}`,
      franchiseId: `${index + 1}`,
      teamSlug: `${index + 1}`,
      displayNameKo: `${index + 1}`,
      shortNameKo: `${index + 1}`,
      shortCode: `${index + 1}`,
      primaryColor: "#000000",
      secondaryColor: "#ffffff",
      rank: index + 1,
      games: 10,
      wins: 10 - index,
      losses: index,
      ties: 0,
      pct: 1 - index * 0.1,
      gamesBack: index,
      recent10: "-",
      streak: "-",
      home: "-",
      away: "-",
      runsScored: 50,
      runsAllowed: 40,
      offensePlus: 100,
      pitchingPlus: 100,
    })) satisfies StandingRow[];
    const strengthMap = Object.fromEntries(
      rows.map((row, index) => [
        row.seasonTeamId,
        {
          seasonTeamId: row.seasonTeamId,
          offenseRating: 110 - index,
          starterRating: 110 - index,
          bullpenRating: 110 - index,
          winPct: row.pct,
          recent10WinRate: row.pct,
          homePct: row.pct,
          awayPct: row.pct,
          splitGap: 0,
          seasonProgress: 1,
          homeFieldAdjustment: 0.2,
          recentFormAdjustment: 0,
          confidenceScore: 0.8,
          priorWeight: 0.4,
          currentWeight: 0.6,
          scheduleDifficulty: 0,
          headToHeadLeverage: 0,
          explanationReasons: [],
        } satisfies TeamStrengthSnapshot,
      ]),
    );
    const ruleset: KboSeasonRuleset = {
      rulesetId: "test",
      label: "test",
      regularSeasonGamesPerTeam: 144,
      gamesPerOpponent: 16,
      tiesAllowed: true,
      tiebreakerOrder: ["headToHead", "runDifferential", "runScored", "teamCode"],
      specialPlayoffGamePositions: [],
      postseasonFormat: [
        { round: "wildcard", label: "WC", bestOf: 3, higherSeedAdvantageWins: 1 },
        { round: "semipo", label: "Semi", bestOf: 5, higherSeedAdvantageWins: 0 },
        { round: "po", label: "PO", bestOf: 5, higherSeedAdvantageWins: 0 },
        { round: "ks", label: "KS", bestOf: 7, higherSeedAdvantageWins: 0 },
      ],
      notes: [],
    };

    const roundReached = simulatePostseasonRun(rows, strengthMap, ruleset, () => 0.01);
    expect(roundReached["season:1"]).toBe(5);
    expect(roundReached["season:4"]).toBeGreaterThanOrEqual(1);
  });
});
