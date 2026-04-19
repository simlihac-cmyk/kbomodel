import { beforeAll, describe, expect, it, vi } from "vitest";

import type {
  Award,
  Franchise,
  Player,
  PlayerCareerStat,
  PlayerSeasonStat,
  Season,
  SeasonTeam,
  TeamBrand,
} from "@/lib/domain/kbo/types";

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
  };
});

let buildPlayerSeasonRankingContext: typeof import("@/lib/repositories/kbo/view-models").buildPlayerSeasonRankingContext;
let buildSituationSplitGroups: typeof import("@/lib/repositories/kbo/view-models").buildSituationSplitGroups;
let buildPlayerAwardHistory: typeof import("@/lib/repositories/kbo/view-models").buildPlayerAwardHistory;

beforeAll(async () => {
  const viewModelModule = await import("@/lib/repositories/kbo/view-models");
  buildPlayerSeasonRankingContext = viewModelModule.buildPlayerSeasonRankingContext;
  buildSituationSplitGroups = viewModelModule.buildSituationSplitGroups;
  buildPlayerAwardHistory = viewModelModule.buildPlayerAwardHistory;
});

describe("player view-model helpers", () => {
  it("builds hitter ranking context for league and team positions", () => {
    const target: PlayerSeasonStat = {
      statId: "s-1",
      seasonId: "kbo-2026",
      playerId: "player:kbo-2026:kbo-2026:lg:오지환",
      seasonTeamId: "kbo-2026:lg",
      statType: "hitter",
      games: 13,
      plateAppearances: 55,
      atBats: 47,
      hits: 16,
      homeRuns: 4,
      ops: 0.955,
      era: null,
      inningsPitched: null,
      strikeouts: null,
      saves: null,
      wins: null,
      losses: null,
      war: null,
    };

    const context = buildPlayerSeasonRankingContext(target, [
      target,
      {
        ...target,
        statId: "s-2",
        playerId: "player:kbo-2026:kbo-2026:lg:오스틴",
        hits: 18,
        homeRuns: 5,
        ops: 1.171,
      },
      {
        ...target,
        statId: "s-3",
        playerId: "player:kbo-2026:kbo-2026:kt:강백호",
        seasonTeamId: "kbo-2026:kt",
        hits: 17,
        homeRuns: 3,
        ops: 0.988,
      },
    ]);

    expect(context.find((item) => item.key === "ops")).toMatchObject({
      leagueRank: 3,
      leagueTotal: 3,
      teamRank: 2,
      teamTotal: 2,
    });
    expect(context.find((item) => item.key === "homeRuns")?.valueLabel).toBe("4");
  });

  it("builds pitcher ranking context with ERA ascending", () => {
    const target: PlayerSeasonStat = {
      statId: "p-1",
      seasonId: "kbo-2026",
      playerId: "player:kbo-2026:kbo-2026:lg:임찬규",
      seasonTeamId: "kbo-2026:lg",
      statType: "pitcher",
      games: 4,
      plateAppearances: null,
      atBats: null,
      hits: null,
      homeRuns: null,
      ops: null,
      era: 2.10,
      inningsPitched: 25,
      strikeouts: 21,
      saves: 0,
      wins: 2,
      losses: 0,
      war: null,
    };

    const context = buildPlayerSeasonRankingContext(target, [
      target,
      {
        ...target,
        statId: "p-2",
        playerId: "player:kbo-2026:kbo-2026:lg:송승기",
        era: 0.59,
        strikeouts: 13,
        wins: 3,
      },
      {
        ...target,
        statId: "p-3",
        playerId: "player:kbo-2026:kbo-2026:kt:쿠에바스",
        seasonTeamId: "kbo-2026:kt",
        era: 3.45,
        strikeouts: 24,
        wins: 1,
      },
    ]);

    expect(context.find((item) => item.key === "era")).toMatchObject({
      leagueRank: 2,
      teamRank: 2,
    });
    expect(context.find((item) => item.key === "strikeouts")).toMatchObject({
      leagueRank: 2,
      teamRank: 1,
    });
  });

  it("groups and sorts player situation splits in baseball-friendly order", () => {
    const groups = buildSituationSplitGroups([
      {
        playerSplitStatId: "1",
        splitKey: "BASES LOADED",
        splitLabel: "만루",
        teamLabel: "LG 트윈스",
        summaryLine: "만루 .300",
        games: 0,
      },
      {
        playerSplitStatId: "2",
        splitKey: "VS RIGHTY",
        splitLabel: "우투 상대",
        teamLabel: "LG 트윈스",
        summaryLine: "우투 .320",
        games: 0,
      },
      {
        playerSplitStatId: "3",
        splitKey: "1-2",
        splitLabel: "카운트 1-2",
        teamLabel: "LG 트윈스",
        summaryLine: "1-2 .250",
        games: 0,
      },
      {
        playerSplitStatId: "4",
        splitKey: "NO OUT",
        splitLabel: "무사",
        teamLabel: "LG 트윈스",
        summaryLine: "무사 .333",
        games: 0,
      },
      {
        playerSplitStatId: "5",
        splitKey: "1ST INNING",
        splitLabel: "1회",
        teamLabel: "LG 트윈스",
        summaryLine: "1회 .280",
        games: 0,
      },
      {
        playerSplitStatId: "6",
        splitKey: "BATTING #3",
        splitLabel: "타순 3번",
        teamLabel: "LG 트윈스",
        summaryLine: "3번 .310",
        games: 0,
      },
      {
        playerSplitStatId: "7",
        splitKey: "VS LEFTY",
        splitLabel: "좌투 상대",
        teamLabel: "LG 트윈스",
        summaryLine: "좌투 .210",
        games: 0,
      },
    ]);

    expect(groups.map((group) => group.key)).toEqual([
      "matchup",
      "count",
      "out",
      "inning",
      "runner",
      "batting-order",
    ]);
    expect(groups[0]?.splits.map((item) => item.splitLabel)).toEqual(["좌투 상대", "우투 상대"]);
    expect(groups[5]?.splits[0]?.splitLabel).toBe("타순 3번");
  });

  it("builds player award history from direct ids and fallback name/team matching", () => {
    const player: Player = {
      playerId: "player:kbo-2026:kbo-2026:lg:박동원",
      slug: "park-dong-won",
      nameKo: "박동원",
      nameEn: "PARK Dong Won",
      officialPlayerCode: "79365",
      birthDate: "1990-04-07",
      batsThrows: "R/R",
      heightWeight: "178cm/92kg",
      careerHistory: "수창초-강릉중-강릉고-LG",
      draftInfo: "09 LG 2차 3라운드 19순위",
      joinInfo: "09LG",
      primaryPositions: ["C"],
      debutYear: 2009,
      franchiseIds: ["lg"],
      bio: "테스트 선수",
    };
    const seasons: Season[] = [
      {
        seasonId: "kbo-2026",
        year: 2026,
        label: "2026 KBO",
        status: "ongoing",
        phase: "regular",
        rulesetId: "rules-2026",
        openingDay: "2026-03-21T05:00:00.000Z",
        regularSeasonStart: "2026-03-21T05:00:00.000Z",
        regularSeasonEnd: "2026-09-30T05:00:00.000Z",
        postseasonStart: "2026-10-02T05:00:00.000Z",
        postseasonEnd: "2026-11-15T05:00:00.000Z",
        updatedAt: "2026-04-18T00:00:00.000Z",
      },
      {
        seasonId: "kbo-2025",
        year: 2025,
        label: "2025 KBO",
        status: "completed",
        phase: "completed",
        rulesetId: "rules-2025",
        openingDay: "2025-03-22T05:00:00.000Z",
        regularSeasonStart: "2025-03-22T05:00:00.000Z",
        regularSeasonEnd: "2025-09-29T05:00:00.000Z",
        postseasonStart: "2025-10-01T05:00:00.000Z",
        postseasonEnd: "2025-11-13T05:00:00.000Z",
        updatedAt: "2026-04-18T00:00:00.000Z",
      },
    ];
    const franchises: Franchise[] = [
      {
        franchiseId: "lg",
        slug: "lg",
        canonicalNameKo: "LG 트윈스",
        shortNameKo: "LG",
        regionKo: "서울",
        foundedYear: 1982,
        primaryVenueId: "jamsil",
        championships: 3,
        brandHistorySummary: "테스트",
      },
      {
        franchiseId: "kt",
        slug: "kt",
        canonicalNameKo: "KT 위즈",
        shortNameKo: "KT",
        regionKo: "수원",
        foundedYear: 2015,
        primaryVenueId: "suwon",
        championships: 1,
        brandHistorySummary: "테스트",
      },
    ];
    const teamBrands: TeamBrand[] = [
      {
        brandId: "lg-brand",
        franchiseId: "lg",
        displayNameKo: "LG 트윈스",
        shortNameKo: "LG",
        shortCode: "LG",
        seasonStartYear: 1990,
        seasonEndYear: null,
        primaryColor: "#000",
        secondaryColor: "#fff",
        wordmarkText: "LG",
        logoPath: "/lg.svg",
      },
      {
        brandId: "kt-brand",
        franchiseId: "kt",
        displayNameKo: "KT 위즈",
        shortNameKo: "KT",
        shortCode: "KT",
        seasonStartYear: 2015,
        seasonEndYear: null,
        primaryColor: "#000",
        secondaryColor: "#fff",
        wordmarkText: "KT",
        logoPath: "/kt.svg",
      },
    ];
    const seasonTeams: SeasonTeam[] = [
      {
        seasonTeamId: "kbo-2025:lg",
        seasonId: "kbo-2025",
        franchiseId: "lg",
        brandId: "lg-brand",
        venueId: "jamsil",
        managerNameKo: "감독A",
        preseasonPriors: { offenseRating: 0, starterRating: 0, bullpenRating: 0 },
        manualAdjustments: [],
        preseasonOutlook: "테스트",
      },
      {
        seasonTeamId: "kbo-2025:kt",
        seasonId: "kbo-2025",
        franchiseId: "kt",
        brandId: "kt-brand",
        venueId: "suwon",
        managerNameKo: "감독B",
        preseasonPriors: { offenseRating: 0, starterRating: 0, bullpenRating: 0 },
        manualAdjustments: [],
        preseasonOutlook: "테스트",
      },
      {
        seasonTeamId: "kbo-2026:lg",
        seasonId: "kbo-2026",
        franchiseId: "lg",
        brandId: "lg-brand",
        venueId: "jamsil",
        managerNameKo: "감독C",
        preseasonPriors: { offenseRating: 0, starterRating: 0, bullpenRating: 0 },
        manualAdjustments: [],
        preseasonOutlook: "테스트",
      },
    ];
    const seasonStats: PlayerSeasonStat[] = [
      {
        statId: "ps-2026",
        seasonId: "kbo-2026",
        playerId: player.playerId,
        seasonTeamId: "kbo-2026:lg",
        statType: "hitter",
        games: 12,
        plateAppearances: 48,
        atBats: 41,
        hits: 13,
        homeRuns: 2,
        ops: 0.911,
        era: null,
        inningsPitched: null,
        strikeouts: null,
        saves: null,
        wins: null,
        losses: null,
        war: null,
      },
    ];
    const careerStats: PlayerCareerStat[] = [
      {
        playerCareerStatId: "career-2025-lg",
        playerId: player.playerId,
        year: 2025,
        teamLabel: "LG",
        statType: "hitter",
        games: 130,
        plateAppearances: null,
        battingAverage: 0.301,
        atBats: 430,
        runs: 58,
        hits: 129,
        homeRuns: 20,
        rbi: 72,
        stolenBases: 0,
        walks: 44,
        onBasePct: null,
        sluggingPct: null,
        ops: null,
        era: null,
        inningsPitched: null,
        strikeouts: 78,
        saves: null,
        wins: null,
        losses: null,
        holds: null,
        whip: null,
        hitsAllowed: null,
        homeRunsAllowed: null,
        runsAllowed: null,
        earnedRuns: null,
        opponentAvg: null,
      },
    ];
    const awards: Award[] = [
      {
        awardId: "award-1",
        seasonId: "kbo-2025",
        label: "KBO 올스타전 MVP",
        playerId: null,
        seasonTeamId: "kbo-2025:lg",
        note: "박동원 · LG · 포수",
      },
      {
        awardId: "award-2",
        seasonId: "kbo-2026",
        label: "주간 MVP",
        playerId: player.playerId,
        seasonTeamId: "kbo-2026:lg",
        note: "박동원 · LG · 포수",
      },
      {
        awardId: "award-3",
        seasonId: "kbo-2025",
        label: "동명이인 체크",
        playerId: null,
        seasonTeamId: "kbo-2025:kt",
        note: "박동원 · KT · 포수",
      },
    ];

    const history = buildPlayerAwardHistory({
      player,
      awards,
      seasons,
      seasonTeams,
      teamBrands,
      franchises,
      seasonStats,
      careerStats,
    });

    expect(history).toHaveLength(2);
    expect(history.map((award) => award.awardId)).toEqual(["award-2", "award-1"]);
    expect(history.find((award) => award.awardId === "award-1")).toMatchObject({
      label: "KBO 올스타전 MVP",
      teamLabel: "LG 트윈스",
      directMatch: false,
    });
    expect(history.find((award) => award.awardId === "award-2")?.directMatch).toBe(true);
  });
});
