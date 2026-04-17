import { beforeAll, describe, expect, it, vi } from "vitest";

import type { Game, StandingRow, TeamSplitStat, TeamStrengthSnapshot } from "@/lib/domain/kbo/types";

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
  };
});

const standingsRows: StandingRow[] = [
  {
    seasonTeamId: "t1",
    brandId: "b1",
    franchiseId: "f1",
    teamSlug: "lg-twins",
    displayNameKo: "LG 트윈스",
    shortNameKo: "LG",
    shortCode: "LG",
    primaryColor: "#a50034",
    secondaryColor: "#111111",
    rank: 1,
    games: 20,
    wins: 13,
    losses: 7,
    ties: 0,
    pct: 0.65,
    gamesBack: 0,
    recent10: "7-3",
    streak: "W2",
    home: "7-3",
    away: "6-4",
    runsScored: 90,
    runsAllowed: 70,
    offensePlus: 112,
    pitchingPlus: 103,
  },
  {
    seasonTeamId: "t2",
    brandId: "b2",
    franchiseId: "f2",
    teamSlug: "kia-tigers",
    displayNameKo: "KIA 타이거즈",
    shortNameKo: "KIA",
    shortCode: "KIA",
    primaryColor: "#ea0029",
    secondaryColor: "#111111",
    rank: 2,
    games: 20,
    wins: 12,
    losses: 8,
    ties: 0,
    pct: 0.6,
    gamesBack: 1,
    recent10: "6-4",
    streak: "L1",
    home: "6-4",
    away: "6-4",
    runsScored: 86,
    runsAllowed: 74,
    offensePlus: 109,
    pitchingPlus: 101,
  },
  {
    seasonTeamId: "t3",
    brandId: "b3",
    franchiseId: "f3",
    teamSlug: "ssg-landers",
    displayNameKo: "SSG 랜더스",
    shortNameKo: "SSG",
    shortCode: "SSG",
    primaryColor: "#c8102e",
    secondaryColor: "#111111",
    rank: 5,
    games: 20,
    wins: 10,
    losses: 10,
    ties: 0,
    pct: 0.5,
    gamesBack: 3,
    recent10: "5-5",
    streak: "W1",
    home: "5-5",
    away: "5-5",
    runsScored: 78,
    runsAllowed: 78,
    offensePlus: 100,
    pitchingPlus: 99,
  },
];

const teamStrengthById: Record<string, TeamStrengthSnapshot> = {
  t1: {
    seasonTeamId: "t1",
    offenseRating: 56,
    starterRating: 54,
    bullpenRating: 52,
    homeFieldAdjustment: 1.2,
    recentFormAdjustment: 0.4,
    confidenceScore: 0.72,
    priorWeight: 0.45,
    currentWeight: 0.55,
    scheduleDifficulty: 0.51,
    headToHeadLeverage: 0.32,
    explanationReasons: [],
  },
  t2: {
    seasonTeamId: "t2",
    offenseRating: 55,
    starterRating: 53,
    bullpenRating: 51,
    homeFieldAdjustment: 1.1,
    recentFormAdjustment: 0.1,
    confidenceScore: 0.69,
    priorWeight: 0.46,
    currentWeight: 0.54,
    scheduleDifficulty: 0.53,
    headToHeadLeverage: 0.28,
    explanationReasons: [],
  },
  t3: {
    seasonTeamId: "t3",
    offenseRating: 51,
    starterRating: 49,
    bullpenRating: 50,
    homeFieldAdjustment: 1,
    recentFormAdjustment: -0.2,
    confidenceScore: 0.63,
    priorWeight: 0.48,
    currentWeight: 0.52,
    scheduleDifficulty: 0.58,
    headToHeadLeverage: 0.18,
    explanationReasons: [],
  },
};

let buildDirectRaceOpponents: typeof import("@/lib/repositories/kbo/view-models").buildDirectRaceOpponents;
let buildRemainingOpponentCounts: typeof import("@/lib/repositories/kbo/view-models").buildRemainingOpponentCounts;
let buildTeamSplitSummary: typeof import("@/lib/repositories/kbo/view-models").buildTeamSplitSummary;

beforeAll(async () => {
  const viewModelModule = await import("@/lib/repositories/kbo/view-models");
  buildDirectRaceOpponents = viewModelModule.buildDirectRaceOpponents;
  buildRemainingOpponentCounts = viewModelModule.buildRemainingOpponentCounts;
  buildTeamSplitSummary = viewModelModule.buildTeamSplitSummary;
});

describe("team view-model helpers", () => {
  it("prioritizes nearby direct race opponents", () => {
    const opponents = buildDirectRaceOpponents(
      "t2",
      standingsRows,
      [
        { seasonTeamId: "t3", label: "SSG", remaining: 5 },
        { seasonTeamId: "t1", label: "LG", remaining: 3 },
      ],
      {
        t1: { first: 0.34, fifth: 0.02, missPostseason: 0.05 },
        t2: { first: 0.28, fifth: 0.04, missPostseason: 0.08 },
        t3: { first: 0.05, fifth: 0.18, missPostseason: 0.31 },
      },
      teamStrengthById,
    );

    expect(opponents[0]?.seasonTeamId).toBe("t1");
    expect(opponents[0]?.leverageNote).toContain("1위선");
    expect(opponents[1]?.seasonTeamId).toBe("t3");
  });

  it("returns split summary in preferred display order", () => {
    const splits: TeamSplitStat[] = [
      {
        splitId: "s3",
        seasonId: "2026",
        seasonTeamId: "t2",
        splitType: "oneRun",
        wins: 4,
        losses: 2,
        ties: 0,
        metricLabel: "1점차 경기",
        metricValue: "4-2",
      },
      {
        splitId: "s1",
        seasonId: "2026",
        seasonTeamId: "t2",
        splitType: "away",
        wins: 6,
        losses: 4,
        ties: 0,
        metricLabel: "원정",
        metricValue: "6-4",
      },
      {
        splitId: "s0",
        seasonId: "2026",
        seasonTeamId: "t2",
        splitType: "home",
        wins: 6,
        losses: 4,
        ties: 0,
        metricLabel: "홈",
        metricValue: "6-4",
      },
    ];

    const summary = buildTeamSplitSummary("t2", splits);
    expect(summary.map((item) => item.splitId)).toEqual(["s0", "s1", "s3"]);
  });

  it("backs remaining opponent counts with ruleset totals when future schedule is short", () => {
    const games: Game[] = [
      {
        gameId: "g1",
        seasonId: "2026",
        seriesId: "s1",
        homeSeasonTeamId: "t1",
        awaySeasonTeamId: "t2",
        scheduledAt: "2026-04-01T18:30:00+09:00",
        status: "final",
        originalScheduledAt: null,
        rescheduledFromGameId: null,
        homeScore: 4,
        awayScore: 2,
        innings: 9,
        isTie: false,
        note: null,
        attendance: null,
        externalLinks: [],
      },
      {
        gameId: "g2",
        seasonId: "2026",
        seriesId: "s1",
        homeSeasonTeamId: "t2",
        awaySeasonTeamId: "t1",
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
      },
      {
        gameId: "g3",
        seasonId: "2026",
        seriesId: "s2",
        homeSeasonTeamId: "t2",
        awaySeasonTeamId: "t1",
        scheduledAt: "2026-05-02T18:30:00+09:00",
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
      },
    ];

    const counts = buildRemainingOpponentCounts(
      "t1",
      games,
      {
        t1: { seasonTeamId: "t1", brandId: "b1", franchiseId: "f1", teamSlug: "lg", displayNameKo: "LG", shortNameKo: "LG", shortCode: "LG", primaryColor: "#000", secondaryColor: "#fff" },
        t2: { seasonTeamId: "t2", brandId: "b2", franchiseId: "f2", teamSlug: "kia", displayNameKo: "KIA", shortNameKo: "KIA", shortCode: "KIA", primaryColor: "#000", secondaryColor: "#fff" },
        t3: { seasonTeamId: "t3", brandId: "b3", franchiseId: "f3", teamSlug: "ssg", displayNameKo: "SSG", shortNameKo: "SSG", shortCode: "SSG", primaryColor: "#000", secondaryColor: "#fff" },
      },
      {
        regularSeasonGamesPerTeam: 8,
        seasonTeamIds: ["t1", "t2", "t3"],
      },
    );

    expect(counts.find((item) => item.seasonTeamId === "t2")?.remaining).toBe(3);
    expect(counts.find((item) => item.seasonTeamId === "t3")?.remaining).toBe(4);
  });
});
