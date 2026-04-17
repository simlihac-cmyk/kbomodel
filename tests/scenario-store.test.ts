import { beforeEach, describe, expect, it } from "vitest";
import { createJSONStorage } from "zustand/middleware";

import { useScenarioStore } from "@/stores/scenario-store";

describe("scenario store", () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    const memoryStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
    };
    useScenarioStore.persist.setOptions({
      storage: createJSONStorage(() => memoryStorage),
    });
    useScenarioStore.setState({
      scenariosBySeason: {},
      savedScenariosBySeason: {},
    });
  });

  it("keeps the active scenario as a draft when saving", () => {
    const seasonId = "kbo-2026";
    const store = useScenarioStore.getState();

    store.setScenarioName(seasonId, "5위 경쟁");
    store.setSeriesOverride(seasonId, "series-1", "homeSeriesWin");
    store.saveCurrentScenario(seasonId);

    const next = useScenarioStore.getState();
    expect(next.scenariosBySeason[seasonId]?.scenarioId).toBe(`scenario:${seasonId}`);
    expect(next.scenariosBySeason[seasonId]?.name).toBe("5위 경쟁");
    expect(next.scenariosBySeason[seasonId]?.overrides).toHaveLength(1);
    expect(next.savedScenariosBySeason[seasonId]).toHaveLength(1);
    expect(next.savedScenariosBySeason[seasonId]?.[0]?.scenarioId).toMatch(
      new RegExp(`^saved:${seasonId}:`),
    );
  });

  it("loads saved and imported scenarios back into the draft slot", () => {
    const seasonId = "kbo-2026";
    const store = useScenarioStore.getState();

    store.setScenarioName(seasonId, "1위 레이스");
    store.setGameOverride(seasonId, "game-1", "awayWin");
    store.saveCurrentScenario(seasonId);

    const savedScenarioId = useScenarioStore.getState().savedScenariosBySeason[seasonId]?.[0]?.scenarioId;
    expect(savedScenarioId).toBeTruthy();

    store.resetSeason(seasonId);
    store.loadSavedScenario(seasonId, savedScenarioId!);

    let next = useScenarioStore.getState();
    expect(next.scenariosBySeason[seasonId]?.scenarioId).toBe(`scenario:${seasonId}`);
    expect(next.scenariosBySeason[seasonId]?.name).toBe("1위 레이스");
    expect(next.scenariosBySeason[seasonId]?.overrides).toHaveLength(1);

    store.importScenario(seasonId, {
      ...next.scenariosBySeason[seasonId]!,
      scenarioId: "imported:abc",
      name: "외부 시나리오",
    });

    next = useScenarioStore.getState();
    expect(next.scenariosBySeason[seasonId]?.scenarioId).toBe(`scenario:${seasonId}`);
    expect(next.scenariosBySeason[seasonId]?.name).toBe("외부 시나리오");
  });

  it("overwrites an existing saved slot when the draft uses the same name", () => {
    const seasonId = "kbo-2026";
    const store = useScenarioStore.getState();

    store.setScenarioName(seasonId, "5위 경쟁");
    store.setSeriesOverride(seasonId, "series-1", "homeSeriesWin");
    store.saveCurrentScenario(seasonId);

    const firstSaved = useScenarioStore.getState().savedScenariosBySeason[seasonId]?.[0];
    expect(firstSaved?.overrides).toHaveLength(1);

    store.setGameOverride(seasonId, "game-2", "awayWin");
    store.saveCurrentScenario(seasonId);

    const next = useScenarioStore.getState();
    expect(next.savedScenariosBySeason[seasonId]).toHaveLength(1);
    expect(next.savedScenariosBySeason[seasonId]?.[0]?.scenarioId).toBe(firstSaved?.scenarioId);
    expect(next.savedScenariosBySeason[seasonId]?.[0]?.overrides).toHaveLength(2);
  });

  it("renames a saved scenario without touching the active draft", () => {
    const seasonId = "kbo-2026";
    const store = useScenarioStore.getState();

    store.setScenarioName(seasonId, "원본 시나리오");
    store.saveCurrentScenario(seasonId);

    const savedScenarioId = useScenarioStore.getState().savedScenariosBySeason[seasonId]?.[0]?.scenarioId;
    expect(savedScenarioId).toBeTruthy();

    store.renameSavedScenario(seasonId, savedScenarioId!, "새 이름");

    const next = useScenarioStore.getState();
    expect(next.savedScenariosBySeason[seasonId]?.[0]?.name).toBe("새 이름");
    expect(next.scenariosBySeason[seasonId]?.name).toBe("원본 시나리오");
  });
});
