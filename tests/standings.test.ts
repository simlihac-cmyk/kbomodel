import { describe, expect, it } from "vitest";

import { buildStandingsTable } from "@/lib/domain/kbo/standings";
import type { Game, TeamSeasonStat } from "@/lib/domain/kbo/types";

describe("buildStandingsTable", () => {
  it("calculates wins, losses, ties and games back from final games", () => {
    const teamDisplays = [
      {
        seasonTeamId: "season:a",
        brandId: "a",
        franchiseId: "a",
        teamSlug: "a",
        displayNameKo: "A",
        shortNameKo: "A",
        shortCode: "A",
        primaryColor: "#000000",
        secondaryColor: "#ffffff",
        rank: 0,
        games: 0,
        wins: 0,
        losses: 0,
        ties: 0,
        pct: 0,
        gamesBack: 0,
        recent10: "-",
        streak: "-",
        home: "-",
        away: "-",
        runsScored: 0,
        runsAllowed: 0,
        offensePlus: 100,
        pitchingPlus: 100,
      },
      {
        seasonTeamId: "season:b",
        brandId: "b",
        franchiseId: "b",
        teamSlug: "b",
        displayNameKo: "B",
        shortNameKo: "B",
        shortCode: "B",
        primaryColor: "#000000",
        secondaryColor: "#ffffff",
        rank: 0,
        games: 0,
        wins: 0,
        losses: 0,
        ties: 0,
        pct: 0,
        gamesBack: 0,
        recent10: "-",
        streak: "-",
        home: "-",
        away: "-",
        runsScored: 0,
        runsAllowed: 0,
        offensePlus: 100,
        pitchingPlus: 100,
      },
    ];
    const games: Game[] = [
      {
        gameId: "g1",
        seasonId: "season",
        seriesId: "s1",
        homeSeasonTeamId: "season:a",
        awaySeasonTeamId: "season:b",
        scheduledAt: "2026-04-01T18:30:00+09:00",
        status: "final",
        originalScheduledAt: null,
        rescheduledFromGameId: null,
        homeScore: 5,
        awayScore: 3,
        innings: 9,
        isTie: false,
        note: null,
        attendance: 10000,
        externalLinks: [],
      },
      {
        gameId: "g2",
        seasonId: "season",
        seriesId: "s1",
        homeSeasonTeamId: "season:b",
        awaySeasonTeamId: "season:a",
        scheduledAt: "2026-04-02T18:30:00+09:00",
        status: "final",
        originalScheduledAt: null,
        rescheduledFromGameId: null,
        homeScore: 2,
        awayScore: 2,
        innings: 12,
        isTie: true,
        note: null,
        attendance: 9800,
        externalLinks: [],
      },
    ];
    const teamSeasonStats: TeamSeasonStat[] = [
      {
        seasonId: "season",
        seasonTeamId: "season:a",
        wins: 0,
        losses: 0,
        ties: 0,
        runsScored: 0,
        runsAllowed: 0,
        homeWins: 0,
        homeLosses: 0,
        awayWins: 0,
        awayLosses: 0,
        last10: "-",
        streak: "-",
        offensePlus: 100,
        pitchingPlus: 100,
        bullpenEra: 4,
        teamWar: 0,
      },
      {
        seasonId: "season",
        seasonTeamId: "season:b",
        wins: 0,
        losses: 0,
        ties: 0,
        runsScored: 0,
        runsAllowed: 0,
        homeWins: 0,
        homeLosses: 0,
        awayWins: 0,
        awayLosses: 0,
        last10: "-",
        streak: "-",
        offensePlus: 100,
        pitchingPlus: 100,
        bullpenEra: 4,
        teamWar: 0,
      },
    ];

    const result = buildStandingsTable({
      games,
      teamSeasonStats,
      teamDisplays,
      ruleset: {
        tiebreakerOrder: ["headToHead", "runDifferential", "runScored", "teamCode"],
        specialPlayoffGamePositions: [],
      },
    });

    expect(result.rows[0].seasonTeamId).toBe("season:a");
    expect(result.rows[0].wins).toBe(1);
    expect(result.rows[0].ties).toBe(1);
    expect(result.rows[1].losses).toBe(1);
    expect(result.rows[1].gamesBack).toBe(1);
  });
});
