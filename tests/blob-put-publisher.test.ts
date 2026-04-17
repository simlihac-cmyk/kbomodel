import { describe, expect, it } from "vitest";

import { buildArtifactPublishPath, buildManifestPublishPath, joinBlobPublishUrl } from "@/lib/publish/paths";

describe("blob put publisher paths", () => {
  it("builds stable relative paths for artifacts and manifests", () => {
    expect(
      buildArtifactPublishPath({
        dataset: "current-state",
        payload: {},
        version: "v1",
      }),
    ).toBe("publish/current-state.json");

    expect(
      buildManifestPublishPath({
        manifestType: "current",
        publishedAt: "2026-04-15T12:00:00+09:00",
        dataVersion: "v1",
        scheduleVersion: null,
        scoreboardVersion: null,
        standingsVersion: null,
        simulationVersion: null,
        hasLiveGames: false,
        allGamesFinal: false,
        changedGames: [],
        freshnessByDataset: [],
        simulationFreshness: "stale",
      }),
    ).toBe("manifests/current.json");
  });

  it("joins base URL, optional prefix, and relative path cleanly", () => {
    expect(joinBlobPublishUrl("https://blob.example.com/base/", "publish/current-state.json")).toBe(
      "https://blob.example.com/base/publish/current-state.json",
    );
    expect(joinBlobPublishUrl("https://blob.example.com/base", "manifests/current.json", "/kbo/live/")).toBe(
      "https://blob.example.com/base/kbo/live/manifests/current.json",
    );
  });
});
