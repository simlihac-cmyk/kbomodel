import { beforeAll, describe, expect, it, vi } from "vitest";

import type { PlayerSeasonStat } from "@/lib/domain/kbo/types";

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
  };
});

let buildPlayerSeasonRankingContext: typeof import("@/lib/repositories/kbo/view-models").buildPlayerSeasonRankingContext;
let buildSituationSplitGroups: typeof import("@/lib/repositories/kbo/view-models").buildSituationSplitGroups;

beforeAll(async () => {
  const viewModelModule = await import("@/lib/repositories/kbo/view-models");
  buildPlayerSeasonRankingContext = viewModelModule.buildPlayerSeasonRankingContext;
  buildSituationSplitGroups = viewModelModule.buildSituationSplitGroups;
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
});
