import { describe, expect, it } from "vitest";

import {
  buildScenarioExportPayload,
  buildScenarioShareToken,
  parseScenarioImport,
  parseScenarioShareToken,
  resolveForcedOutcomeForGame,
} from "@/lib/sim/kbo/scenario";
import type { Game, ScenarioOverride, Series } from "@/lib/domain/kbo/types";

describe("resolveForcedOutcomeForGame", () => {
  it("applies series overrides to remaining games in order", () => {
    const series: Series = {
      seriesId: "series-1",
      seasonId: "season",
      type: "regular",
      homeSeasonTeamId: "season:a",
      awaySeasonTeamId: "season:b",
      plannedLength: 3,
      actualLength: 1,
      startDate: "2026-04-15",
      endDate: "2026-04-17",
      venueId: "venue",
      status: "in_progress",
    };
    const games: Game[] = [
      {
        gameId: "g2",
        seasonId: "season",
        seriesId: series.seriesId,
        homeSeasonTeamId: "season:a",
        awaySeasonTeamId: "season:b",
        scheduledAt: "2026-04-16T18:30:00+09:00",
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
        seasonId: "season",
        seriesId: series.seriesId,
        homeSeasonTeamId: "season:a",
        awaySeasonTeamId: "season:b",
        scheduledAt: "2026-04-17T18:30:00+09:00",
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
    const overrides: ScenarioOverride[] = [
      {
        overrideId: "series-1",
        targetType: "series",
        targetId: series.seriesId,
        forcedOutcome: "homeSeriesWin",
        note: "",
      },
    ];

    const outcome = resolveForcedOutcomeForGame(games[0], games, { [series.seriesId]: series }, overrides);
    expect(outcome).toBe("homeWin");
  });

  it("round-trips scenario export and import", () => {
    const exported = buildScenarioExportPayload({
      scenarioId: "saved:kbo-2026:1",
      seasonId: "kbo-2026",
      name: "상위권 실험",
      createdAt: "2026-04-15T09:00:00+09:00",
      updatedAt: "2026-04-15T09:00:00+09:00",
      overrides: [
        {
          overrideId: "series:1",
          targetType: "series",
          targetId: "series-1",
          forcedOutcome: "homeSeriesWin",
          note: "",
        },
      ],
    });

    const parsed = parseScenarioImport(exported, "kbo-2026");
    expect(parsed.name).toBe("상위권 실험");
    expect(parsed.overrides).toHaveLength(1);
    expect(parsed.overrides[0]?.forcedOutcome).toBe("homeSeriesWin");
  });

  it("round-trips scenario share tokens", () => {
    const token = buildScenarioShareToken({
      scenarioId: "saved:kbo-2026:2",
      seasonId: "kbo-2026",
      name: "공유 테스트",
      createdAt: "2026-04-15T09:00:00+09:00",
      updatedAt: "2026-04-15T09:00:00+09:00",
      overrides: [
        {
          overrideId: "game:1",
          targetType: "game",
          targetId: "game-1",
          forcedOutcome: "homeWin",
          note: "",
        },
      ],
    });

    const parsed = parseScenarioShareToken(token, "kbo-2026");
    expect(parsed.name).toBe("공유 테스트");
    expect(parsed.overrides[0]?.forcedOutcome).toBe("homeWin");
  });
});
