import { describe, expect, it } from "vitest";

import { buildPublishedKboBundleFromNormalized } from "@/lib/repositories/kbo/published-bundle";

describe("published ingest bundle", () => {
  it("builds an app-ready bundle from normalized datasets", async () => {
    const bundle = await buildPublishedKboBundleFromNormalized();

    expect(
      bundle.games.some(
        (game) =>
          game.scheduledAt.startsWith("2026-04-15") &&
          game.awaySeasonTeamId === "kbo-2026:lotte" &&
          game.homeSeasonTeamId === "kbo-2026:lg",
      ),
    ).toBe(true);
    expect(bundle.teamSeasonStats.find((stat) => stat.seasonTeamId === "kbo-2026:lg")?.wins).toBeGreaterThan(0);
    expect(bundle.teamSeasonStats.find((stat) => stat.seasonTeamId === "kbo-2026:lg")?.pitchingPlus).toBeGreaterThan(100);
    expect(bundle.players.some((player) => player.nameKo === "임찬규")).toBe(true);
    expect(bundle.playerSeasonStats.filter((stat) => stat.seasonId === "kbo-2026").length).toBeGreaterThan(0);
  });
});
