import { describe, expect, it } from "vitest";

import type { Game } from "@/lib/domain/kbo/types";
import { detectSimulationTriggerEvents, shouldRerunFullSimulationForEvent } from "@/lib/scheduler/kbo/triggers";

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

describe("finalize trigger rules", () => {
  it("does not rerun full sim for live inning changes", () => {
    const events = detectSimulationTriggerEvents(
      [createGame({ homeScore: 1, awayScore: 0, innings: 3 })],
      [createGame({ homeScore: 2, awayScore: 0, innings: 4 })],
    );

    expect(events).toContain("live-inning-update");
    expect(events.some((event) => shouldRerunFullSimulationForEvent(event))).toBe(false);
  });

  it("reruns full sim for final results", () => {
    const events = detectSimulationTriggerEvents(
      [createGame({ homeScore: 5, awayScore: 3, innings: 8 })],
      [createGame({ status: "final", homeScore: 5, awayScore: 3, innings: 9 })],
    );

    expect(events).toContain("final-result");
    expect(events.some((event) => shouldRerunFullSimulationForEvent(event))).toBe(true);
  });

  it("reruns full sim for postponements that change schedule shape", () => {
    const events = detectSimulationTriggerEvents(
      [createGame()],
      [createGame({ status: "postponed", note: "우천 취소" })],
    );

    expect(events).toContain("postponement");
    expect(events.some((event) => shouldRerunFullSimulationForEvent(event))).toBe(true);
  });
});
