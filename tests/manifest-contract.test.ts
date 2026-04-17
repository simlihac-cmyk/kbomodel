import { describe, expect, it } from "vitest";

import { currentManifestSchema, simulationManifestSchema, todayManifestSchema } from "@/lib/publish/contracts";

describe("publish manifest contracts", () => {
  it("accepts current manifest payloads with freshness metadata", () => {
    const parsed = currentManifestSchema.parse({
      manifestType: "current",
      publishedAt: "2026-04-15T12:00:00+09:00",
      dataVersion: "abc",
      scheduleVersion: "s1",
      scoreboardVersion: "b1",
      standingsVersion: "st1",
      simulationVersion: "sim1",
      hasLiveGames: true,
      allGamesFinal: false,
      changedGames: ["g1"],
      freshnessByDataset: [
        {
          dataset: "scoreboard",
          fetchedAt: "2026-04-15T11:58:00+09:00",
          sourceId: "official-kbo-en",
          stale: false,
        },
      ],
      simulationFreshness: "waiting-for-final",
    });

    expect(parsed.hasLiveGames).toBe(true);
  });

  it("accepts today and simulation manifests", () => {
    expect(() =>
      todayManifestSchema.parse({
        manifestType: "today",
        publishedAt: "2026-04-15T12:00:00+09:00",
        dataVersion: "abc",
        scheduleVersion: "s1",
        scoreboardVersion: "b1",
        hasLiveGames: false,
        allGamesFinal: true,
        changedGames: [],
        freshnessByDataset: [],
      }),
    ).not.toThrow();

    expect(() =>
      simulationManifestSchema.parse({
        manifestType: "simulation",
        publishedAt: "2026-04-15T12:00:00+09:00",
        dataVersion: "abc",
        simulationVersion: "sim1",
        standingsVersion: "st1",
        scheduleVersion: "s1",
        recomputedBecause: ["final-result"],
        freshnessByDataset: [],
      }),
    ).not.toThrow();
  });
});
