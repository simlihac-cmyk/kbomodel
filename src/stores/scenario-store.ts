"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { ScenarioForcedOutcome, ScenarioOverride, UserScenario } from "@/lib/domain/kbo/types";

type ScenarioState = {
  scenariosBySeason: Record<string, UserScenario>;
  savedScenariosBySeason: Record<string, UserScenario[]>;
  setScenarioName: (seasonId: string, name: string) => void;
  setSeriesOverride: (seasonId: string, seriesId: string, forcedOutcome: ScenarioForcedOutcome) => void;
  setGameOverride: (seasonId: string, gameId: string, forcedOutcome: ScenarioForcedOutcome) => void;
  saveCurrentScenario: (seasonId: string) => void;
  loadSavedScenario: (seasonId: string, scenarioId: string) => void;
  renameSavedScenario: (seasonId: string, scenarioId: string, name: string) => void;
  deleteSavedScenario: (seasonId: string, scenarioId: string) => void;
  importScenario: (seasonId: string, scenario: UserScenario) => void;
  resetSeason: (seasonId: string) => void;
};

function buildDraftScenarioId(seasonId: string) {
  return `scenario:${seasonId}`;
}

function normalizeScenarioName(name: string) {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : "내 시나리오";
}

export function buildEmptyScenario(
  seasonId: string,
  timestamp = new Date().toISOString(),
): UserScenario {
  return {
    scenarioId: buildDraftScenarioId(seasonId),
    seasonId,
    name: "내 시나리오",
    createdAt: timestamp,
    updatedAt: timestamp,
    overrides: [],
  };
}

function upsertOverride(
  scenario: UserScenario,
  nextOverride: ScenarioOverride,
): UserScenario {
  const filtered = scenario.overrides.filter(
    (override) =>
      !(override.targetType === nextOverride.targetType && override.targetId === nextOverride.targetId),
  );
  const overrides =
    nextOverride.forcedOutcome === "model"
      ? filtered
      : [...filtered, nextOverride];

  return {
    ...scenario,
    updatedAt: new Date().toISOString(),
    overrides,
  };
}

function cloneScenario(scenario: UserScenario): UserScenario {
  return {
    ...scenario,
    overrides: scenario.overrides.map((override) => ({ ...override })),
  };
}

function createDraftScenario(
  seasonId: string,
  scenario: UserScenario,
  timestamp = new Date().toISOString(),
): UserScenario {
  return {
    ...cloneScenario(scenario),
    scenarioId: buildDraftScenarioId(seasonId),
    seasonId,
    updatedAt: timestamp,
  };
}

export const useScenarioStore = create<ScenarioState>()(
  persist(
    (set) => ({
      scenariosBySeason: {},
      savedScenariosBySeason: {},
      setScenarioName: (seasonId, name) =>
        set((state) => {
          const current = state.scenariosBySeason[seasonId] ?? buildEmptyScenario(seasonId);
          return {
            scenariosBySeason: {
              ...state.scenariosBySeason,
              [seasonId]: {
                ...current,
                name: normalizeScenarioName(name),
                updatedAt: new Date().toISOString(),
              },
            },
          };
        }),
      setSeriesOverride: (seasonId, seriesId, forcedOutcome) =>
        set((state) => {
          const current = state.scenariosBySeason[seasonId] ?? buildEmptyScenario(seasonId);
          return {
            scenariosBySeason: {
              ...state.scenariosBySeason,
              [seasonId]: upsertOverride(current, {
                overrideId: `series:${seriesId}`,
                targetType: "series",
                targetId: seriesId,
                forcedOutcome,
                note: "",
              }),
            },
          };
        }),
      setGameOverride: (seasonId, gameId, forcedOutcome) =>
        set((state) => {
          const current = state.scenariosBySeason[seasonId] ?? buildEmptyScenario(seasonId);
          return {
            scenariosBySeason: {
              ...state.scenariosBySeason,
              [seasonId]: upsertOverride(current, {
                overrideId: `game:${gameId}`,
                targetType: "game",
                targetId: gameId,
                forcedOutcome,
                note: "",
              }),
            },
          };
        }),
      saveCurrentScenario: (seasonId) =>
        set((state) => {
          const current = state.scenariosBySeason[seasonId] ?? buildEmptyScenario(seasonId);
          const saved = state.savedScenariosBySeason[seasonId] ?? [];
          const timestamp = new Date().toISOString();
          const normalizedName = normalizeScenarioName(current.name);
          const existingScenario = saved.find(
            (item) => normalizeScenarioName(item.name) === normalizedName,
          );
          const snapshot = {
            ...cloneScenario(current),
            scenarioId: existingScenario?.scenarioId ?? `saved:${seasonId}:${Date.now()}`,
            name: normalizedName,
            createdAt: existingScenario?.createdAt ?? current.createdAt,
            updatedAt: timestamp,
          };

          const nextSaved = [
            snapshot,
            ...saved.filter((item) => item.scenarioId !== snapshot.scenarioId),
          ].slice(0, 8);

          return {
            scenariosBySeason: {
              ...state.scenariosBySeason,
              [seasonId]: createDraftScenario(
                seasonId,
                {
                  ...current,
                  name: normalizedName,
                },
                timestamp,
              ),
            },
            savedScenariosBySeason: {
              ...state.savedScenariosBySeason,
              [seasonId]: nextSaved,
            },
          };
        }),
      loadSavedScenario: (seasonId, scenarioId) =>
        set((state) => {
          const saved = state.savedScenariosBySeason[seasonId] ?? [];
          const target = saved.find((item) => item.scenarioId === scenarioId);
          if (!target) {
            return state;
          }

          return {
            scenariosBySeason: {
              ...state.scenariosBySeason,
              [seasonId]: createDraftScenario(seasonId, target),
            },
          };
        }),
      renameSavedScenario: (seasonId, scenarioId, name) =>
        set((state) => {
          const normalizedName = normalizeScenarioName(name);
          return {
            savedScenariosBySeason: {
              ...state.savedScenariosBySeason,
              [seasonId]: (state.savedScenariosBySeason[seasonId] ?? []).map((item) =>
                item.scenarioId === scenarioId
                  ? {
                      ...item,
                      name: normalizedName,
                      updatedAt: new Date().toISOString(),
                    }
                  : item,
              ),
            },
          };
        }),
      deleteSavedScenario: (seasonId, scenarioId) =>
        set((state) => ({
          savedScenariosBySeason: {
            ...state.savedScenariosBySeason,
            [seasonId]: (state.savedScenariosBySeason[seasonId] ?? []).filter(
              (item) => item.scenarioId !== scenarioId,
            ),
          },
        })),
      importScenario: (seasonId, scenario) =>
        set((state) => {
          const imported = createDraftScenario(seasonId, scenario);

          return {
            scenariosBySeason: {
              ...state.scenariosBySeason,
              [seasonId]: imported,
            },
          };
        }),
      resetSeason: (seasonId) =>
        set((state) => ({
          scenariosBySeason: {
            ...state.scenariosBySeason,
            [seasonId]: buildEmptyScenario(seasonId),
          },
        })),
    }),
    {
      name: "kbo-scenario-store",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
