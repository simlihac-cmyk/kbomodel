import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
  };
});

vi.mock("@/lib/scheduler/kbo/windows", async () => {
  const actual = await vi.importActual<typeof import("@/lib/scheduler/kbo/windows")>(
    "@/lib/scheduler/kbo/windows",
  );
  return {
    ...actual,
    getKboDateKey: (input?: Date) =>
      actual.getKboDateKey(input ?? new Date("2026-04-19T12:00:00+09:00")),
  };
});

let getTeamConditionPageData: typeof import("@/lib/team/team-condition-data").getTeamConditionPageData;
let originalFetch: typeof fetch;
let mockedGameListPayload: unknown = { game: [] };
let mockedLineupPayload: unknown = null;
const fixturePitcherSummary61101 = readFileSync(
  "src/lib/data-sources/kbo/fixtures/official-en/player-summary-pitcher-61101.html",
  "utf8",
);
const fixturePitcherGameLogs61101 = readFileSync(
  "src/lib/data-sources/kbo/fixtures/official-en/player-game-logs-pitcher-61101.html",
  "utf8",
);

function buildLineupGrid(names: Array<{ slot: number; position: string; playerName: string; war?: string }>) {
  return JSON.stringify({
    rows: names.map((item) => ({
      row: [
        { Text: String(item.slot) },
        { Text: item.position },
        { Text: item.playerName },
        { Text: item.war ?? "0.00" },
      ],
    })),
  });
}

beforeAll(async () => {
  originalFetch = global.fetch;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes("/ws/Main.asmx/GetKboGameList")) {
        return new Response(JSON.stringify(mockedGameListPayload), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.includes("/ws/Schedule.asmx/GetLineUpAnalysis")) {
        return new Response(JSON.stringify(mockedLineupPayload), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.includes("/Teams/PlayerInfoPitcher/Summary.aspx?pcode=61101")) {
        return new Response(fixturePitcherSummary61101, {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }
      if (url.includes("/Teams/PlayerInfoPitcher/GameLogs.aspx?pcode=61101")) {
        return new Response(fixturePitcherGameLogs61101, {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }
      return originalFetch(input, init);
    }),
  );
  ({ getTeamConditionPageData } = await import("@/lib/team/team-condition-data"));
});

beforeEach(() => {
  mockedGameListPayload = { game: [] };
  mockedLineupPayload = null;
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("team condition page data", () => {
  it("builds a pregame view-model for a valid team route", async () => {
    const data = await getTeamConditionPageData(2026, "ssg-landers");

    expect(data).not.toBeNull();
    expect(data?.focusGame.label).toBe("오늘 경기");
    expect(data?.focusGame.homeAwayLabel).toMatch(/홈|원정/);
    expect(data?.opponent.displayNameKo).toBeTruthy();
    expect(data?.strengthOverview.team.overallScore).toBeGreaterThan(0);
    expect(data?.strengthOverview.team.metrics).toHaveLength(5);
    expect(data?.strengthOverview.opponent.metrics).toHaveLength(5);
    expect(data?.starterMatchup.teamStarter.playerName).toBeTruthy();
    expect(data?.bullpenComparison.team.anchors.length).toBeGreaterThan(0);
    expect(data?.expectedLineup.length).toBeGreaterThan(0);
    expect(data?.keyPlayers.length).toBeGreaterThan(0);
    expect(data?.lineupStatus.isConfirmed).toBe(false);
  });

  it("uses the official confirmed lineup when gamecenter publishes it", async () => {
    mockedGameListPayload = {
      game: [
        {
          LE_ID: 1,
          SR_ID: 0,
          SEASON_ID: 2026,
          G_ID: "20260419SKNC0",
          LINEUP_CK: 20,
        },
      ],
    };
    mockedLineupPayload = [
      [{ LINEUP_CK: true }],
      [{ T_ID: "NC" }],
      [{ T_ID: "SK" }],
      [
        buildLineupGrid([
          { slot: 1, position: "2루수", playerName: "박민우", war: "1.22" },
          { slot: 2, position: "유격수", playerName: "김주원", war: "0.80" },
          { slot: 3, position: "우익수", playerName: "박건우", war: "1.63" },
        ]),
      ],
      [
        buildLineupGrid([
          { slot: 1, position: "유격수", playerName: "박성한", war: "1.44" },
          { slot: 2, position: "중견수", playerName: "최지훈", war: "0.95" },
          { slot: 3, position: "3루수", playerName: "최정", war: "1.71" },
        ]),
      ],
    ];

    const data = await getTeamConditionPageData(2026, "ssg-landers");

    expect(data).not.toBeNull();
    expect(data?.lineupStatus.isConfirmed).toBe(true);
    expect(data?.lineupStatus.badgeLabel).toBe("공식 발표 완료");
    expect(data?.expectedLineup[0]?.playerName).toBe("박성한");
    expect(data?.expectedLineup[0]?.note).toContain("공식 확정 라인업");
  });

  it("uses the official starting pitchers when gamecenter publishes them", async () => {
    mockedGameListPayload = {
      game: [
        {
          LE_ID: 1,
          SR_ID: 0,
          SEASON_ID: 2026,
          G_ID: "20260419LGSS0",
          START_PIT_CK: 1,
          T_PIT_P_ID: 55130,
          T_PIT_P_NM: "톨허스트 ",
          B_PIT_P_ID: 69446,
          B_PIT_P_NM: "원태인 ",
        },
      ],
    };

    const data = await getTeamConditionPageData(2026, "samsung-lions");

    expect(data).not.toBeNull();
    expect(data?.starterMatchup.teamStarter.playerName).toBe("원태인");
    expect(data?.starterMatchup.teamStarter.note).toContain("KBO 공식 선발 반영");
    expect(data?.starterMatchup.opponentStarter.playerName).toBe("톨허스트");
    expect(data?.strengthOverview.team.metrics.find((metric) => metric.key === "starter")?.isProvisional).toBeFalsy();
  });

  it("falls back to team/name matching when official starter code is missing", async () => {
    mockedGameListPayload = {
      game: [
        {
          LE_ID: 1,
          SR_ID: 0,
          SEASON_ID: 2026,
          G_ID: "20260419LGSS0",
          START_PIT_CK: 1,
          T_PIT_P_ID: null,
          T_PIT_P_NM: "톨허스트 ",
          B_PIT_P_ID: null,
          B_PIT_P_NM: "원태인 ",
        },
      ],
    };

    const data = await getTeamConditionPageData(2026, "samsung-lions");

    expect(data).not.toBeNull();
    expect(data?.starterMatchup.teamStarter.playerName).toBe("원태인");
    expect(data?.starterMatchup.teamStarter.announced).toBe(true);
    expect(data?.starterMatchup.teamStarter.playerId).toBeTruthy();
    expect(data?.starterMatchup.opponentStarter.playerName).toBe("톨허스트");
    expect(data?.starterMatchup.opponentStarter.announced).toBe(true);
  });

  it("falls back to official summary fetch when announced starter cannot be matched to local player data", async () => {
    mockedGameListPayload = {
      game: [
        {
          LE_ID: 1,
          SR_ID: 0,
          SEASON_ID: 2026,
          G_ID: "20260419LGSS0",
          START_PIT_CK: 1,
          T_PIT_P_ID: 61101,
          T_PIT_P_NM: "임찬규 ",
          B_PIT_P_ID: null,
          B_PIT_P_NM: "원태인 ",
        },
      ],
    };

    const data = await getTeamConditionPageData(2026, "lg-twins");

    expect(data).not.toBeNull();
    expect(data?.starterMatchup.teamStarter.playerName).toBe("임찬규");
    expect(data?.starterMatchup.teamStarter.seasonRecordLabel).not.toBe("-");
    expect(data?.starterMatchup.teamStarter.eraLabel).not.toBe("-");
    expect(data?.starterMatchup.teamStarter.inningsLabel).not.toBe("-");
    expect(data?.starterMatchup.teamStarter.versusOpponentLabel).not.toBe("상대 전적 없음");
    expect(data?.starterMatchup.teamStarter.recentFormLabel).not.toBe("최근 등판 기록 없음");
  });
});
