import { describe, expect, it } from "vitest";

import type { Game } from "@/lib/domain/kbo/types";
import { determineKboPhase } from "@/lib/scheduler/kbo/decisions";

function createGame(overrides: Partial<Game> = {}): Game {
  return {
    gameId: "game:test:1",
    seasonId: "kbo-2026",
    seriesId: "series:test:1",
    homeSeasonTeamId: "kbo-2026:lg",
    awaySeasonTeamId: "kbo-2026:kia",
    scheduledAt: "2026-04-15T18:30:00+09:00",
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
    ...overrides,
  };
}

describe("KBO scheduler phase decisions", () => {
  it("returns QUIET when there are no games today", () => {
    const decision = determineKboPhase({
      gamesToday: [],
      now: new Date("2026-04-15T10:00:00+09:00"),
    });

    expect(decision.phase).toBe("QUIET");
    expect(decision.reasonCodes).toContain("no-games-today");
  });

  it("returns PREGAME before first pitch when baseline is stale", () => {
    const decision = determineKboPhase({
      gamesToday: [createGame()],
      stalePregameData: true,
      now: new Date("2026-04-15T12:05:00+09:00"),
    });

    expect(decision.phase).toBe("PREGAME");
    expect(decision.shouldRefreshHotPath).toBe(true);
  });

  it("returns LIVE when a game has live scores but is not final", () => {
    const decision = determineKboPhase({
      gamesToday: [
        createGame({
          homeScore: 3,
          awayScore: 2,
          innings: 5,
        }),
      ],
      previousTodayGames: [
        createGame({
          homeScore: 2,
          awayScore: 2,
          innings: 4,
        }),
      ],
      now: new Date("2026-04-15T19:00:00+09:00"),
    });

    expect(decision.phase).toBe("LIVE");
    expect(decision.shouldRerunSimulation).toBe(false);
  });

  it("returns FINALIZATION when a game transitions to final", () => {
    const decision = determineKboPhase({
      gamesToday: [
        createGame({
          status: "final",
          homeScore: 5,
          awayScore: 3,
          innings: 9,
        }),
      ],
      previousTodayGames: [
        createGame({
          homeScore: 5,
          awayScore: 3,
          innings: 8,
        }),
      ],
      now: new Date("2026-04-15T22:10:00+09:00"),
    });

    expect(decision.phase).toBe("FINALIZATION");
    expect(decision.shouldRerunSimulation).toBe(true);
  });
});
