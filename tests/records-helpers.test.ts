import { describe, expect, it } from "vitest";

import type { Game, Player, PlayerSeasonStat, TeamDisplay, TeamSeasonStat, TeamSplitStat } from "@/lib/domain/kbo/types";
import {
  buildGameLogRows,
  buildHitterLeaderRows,
  buildPitcherLeaderRows,
  buildSplitExplorerRows,
  buildTeamRecordRows,
} from "@/lib/records/kbo-records";

const displayById: Record<string, TeamDisplay> = {
  "season:lg": {
    seasonTeamId: "season:lg",
    brandId: "lg",
    franchiseId: "lg",
    teamSlug: "lg-twins",
    displayNameKo: "LG 트윈스",
    shortNameKo: "LG",
    shortCode: "LG",
    primaryColor: "#a50034",
    secondaryColor: "#111111",
  },
  "season:kia": {
    seasonTeamId: "season:kia",
    brandId: "kia",
    franchiseId: "kia",
    teamSlug: "kia-tigers",
    displayNameKo: "KIA 타이거즈",
    shortNameKo: "KIA",
    shortCode: "KIA",
    primaryColor: "#ea0029",
    secondaryColor: "#111111",
  },
};

describe("records helpers", () => {
  it("sorts team records by selected metric", () => {
    const rows: TeamSeasonStat[] = [
      {
        seasonId: "season",
        seasonTeamId: "season:lg",
        wins: 12,
        losses: 8,
        ties: 0,
        runsScored: 90,
        runsAllowed: 80,
        homeWins: 6,
        homeLosses: 4,
        awayWins: 6,
        awayLosses: 4,
        last10: "6-4",
        streak: "승1",
        offensePlus: 110,
        pitchingPlus: 101,
        bullpenEra: 3.8,
        teamWar: 12.2,
      },
      {
        seasonId: "season",
        seasonTeamId: "season:kia",
        wins: 11,
        losses: 9,
        ties: 0,
        runsScored: 88,
        runsAllowed: 76,
        homeWins: 5,
        homeLosses: 5,
        awayWins: 6,
        awayLosses: 4,
        last10: "5-5",
        streak: "패1",
        offensePlus: 106,
        pitchingPlus: 108,
        bullpenEra: 3.5,
        teamWar: 12.9,
      },
    ];

    expect(buildTeamRecordRows(rows, displayById, "wins", "")[0]?.seasonTeamId).toBe("season:lg");
    expect(buildTeamRecordRows(rows, displayById, "runsAllowed", "")[0]?.seasonTeamId).toBe("season:kia");
    expect(buildTeamRecordRows(rows, displayById, "runDiff", "")[0]?.seasonTeamId).toBe("season:kia");
  });

  it("builds hitter, pitcher, split, and game rows with filtering", () => {
    const players: Player[] = [
      {
        playerId: "p1",
        slug: "p1",
        nameKo: "김타자",
        nameEn: "Kim",
        birthDate: null,
        batsThrows: null,
        primaryPositions: ["OF"],
        debutYear: 2020,
        franchiseIds: ["lg"],
        bio: "",
      },
      {
        playerId: "p2",
        slug: "p2",
        nameKo: "박투수",
        nameEn: "Park",
        birthDate: null,
        batsThrows: null,
        primaryPositions: ["SP"],
        debutYear: 2020,
        franchiseIds: ["kia"],
        bio: "",
      },
    ];
    const stats: PlayerSeasonStat[] = [
      {
        statId: "h1",
        seasonId: "season",
        playerId: "p1",
        seasonTeamId: "season:lg",
        statType: "hitter",
        games: 20,
        plateAppearances: 80,
        atBats: 70,
        hits: 25,
        homeRuns: 6,
        ops: 0.945,
        era: null,
        inningsPitched: null,
        strikeouts: null,
        saves: null,
        wins: null,
        losses: null,
        war: 1.8,
      },
      {
        statId: "p1",
        seasonId: "season",
        playerId: "p2",
        seasonTeamId: "season:kia",
        statType: "pitcher",
        games: 5,
        plateAppearances: null,
        atBats: null,
        hits: null,
        homeRuns: null,
        ops: null,
        era: 2.33,
        inningsPitched: 27,
        strikeouts: 31,
        saves: 0,
        wins: 3,
        losses: 1,
        war: 1.6,
      },
    ];
    const splits: TeamSplitStat[] = [
      {
        splitId: "s1",
        seasonId: "season",
        seasonTeamId: "season:lg",
        splitType: "home",
        wins: 6,
        losses: 4,
        ties: 0,
        metricLabel: "홈",
        metricValue: "6-4 / .600",
      },
    ];
    const games: Game[] = [
      {
        gameId: "g1",
        seasonId: "season",
        seriesId: "series-1",
        homeSeasonTeamId: "season:lg",
        awaySeasonTeamId: "season:kia",
        scheduledAt: "2026-04-15T09:30:00.000Z",
        status: "final",
        originalScheduledAt: null,
        rescheduledFromGameId: null,
        homeScore: 5,
        awayScore: 3,
        innings: 9,
        isTie: false,
        note: null,
        attendance: 15000,
        externalLinks: [],
      },
    ];

    expect(buildHitterLeaderRows(stats, players, displayById, "ops", "김")[0]?.playerId).toBe("p1");
    expect(buildPitcherLeaderRows(stats, players, displayById, "era", "박")[0]?.playerId).toBe("p2");
    expect(buildSplitExplorerRows(splits, displayById, "home", "LG")).toHaveLength(1);
    expect(buildGameLogRows(games, displayById, "KIA", true)).toHaveLength(1);
  });
});
