import { describe, expect, it } from "vitest";

import {
  buildImportCandidatesFromImport,
  buildImportCandidateSeriesSuggestions,
  buildImportPreview,
  buildSchedulePatchesFromImport,
  parseRawImportPayload,
} from "@/lib/admin/import-preview";
import { FileKboRepository } from "@/lib/repositories/kbo/file-adapter";

describe("import preview", () => {
  it("classifies raw ingest rows against normalized games", async () => {
    const repository = new FileKboRepository();
    const bundle = await repository.getBundle();
    const raw = parseRawImportPayload(
      JSON.stringify({
        source: "test",
        extractedAt: "2026-04-15T08:45:00+09:00",
        scheduleRows: [
          {
            gameId: "legacy-import-id-1",
            scheduledAt: "2026-04-15T18:30:00+09:00",
            homeTeamId: "kbo-2026:ssg",
            awayTeamId: "kbo-2026:doosan",
            homeScore: 99,
            awayScore: 1,
            status: "final",
          },
          {
            gameId: "new-game-id",
            scheduledAt: "2026-05-01T18:30:00+09:00",
            homeTeamId: "kbo-2026:lg",
            awayTeamId: "kbo-2026:ssg",
            homeScore: null,
            awayScore: null,
            status: "scheduled",
          },
        ],
      }),
    );

    const preview = buildImportPreview(raw, bundle);
    expect(preview.summary.changedRows).toBe(1);
    expect(preview.summary.newRows).toBe(1);
    expect(preview.previewRows[0]?.kind).toBe("changed");
    expect(preview.previewRows[1]?.kind).toBe("new");

    const patches = buildSchedulePatchesFromImport(raw, bundle, "2026-04-15T12:00:00+09:00");
    expect(patches).toHaveLength(1);
    const patchedGame = bundle.games.find((game) => game.gameId === patches[0]?.gameId);
    expect(patchedGame?.homeSeasonTeamId).toBe("kbo-2026:ssg");
    expect(patchedGame?.awaySeasonTeamId).toBe("kbo-2026:doosan");

    const candidates = buildImportCandidatesFromImport(raw, bundle, "2026-04-15T12:00:00+09:00");
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.gameId).toBe("new-game-id");
  });

  it("groups queued candidates into series suggestions", async () => {
    const repository = new FileKboRepository();
    const bundle = await repository.getBundle();

    const suggestions = buildImportCandidateSeriesSuggestions(
      [
        {
          source: "manual-new-series-preview",
          gameId: "new-1",
          scheduledAt: "2026-06-10T09:30:00.000Z",
          homeTeamId: "kbo-2026:lg",
          awayTeamId: "kbo-2026:kia",
          homeScore: null,
          awayScore: null,
          status: "scheduled",
          note: "",
          importedAt: "2026-04-15T12:00:00+09:00",
        },
        {
          source: "manual-new-series-preview",
          gameId: "new-2",
          scheduledAt: "2026-06-11T09:30:00.000Z",
          homeTeamId: "kbo-2026:lg",
          awayTeamId: "kbo-2026:kia",
          homeScore: null,
          awayScore: null,
          status: "scheduled",
          note: "",
          importedAt: "2026-04-15T12:00:00+09:00",
        },
      ],
      bundle,
    );

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]?.gameIds).toEqual(["new-1", "new-2"]);
  });
});
