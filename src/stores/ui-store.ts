"use client";

import { create } from "zustand";

type ScenarioMode = "quick" | "team" | "race" | "advanced";

type UiState = {
  selectedTeamSlug: string | null;
  raceFilter: "first" | "second" | "fifth" | "all";
  scenarioMode: ScenarioMode;
  setSelectedTeamSlug: (teamSlug: string | null) => void;
  setRaceFilter: (filter: UiState["raceFilter"]) => void;
  setScenarioMode: (mode: ScenarioMode) => void;
};

export const useUiStore = create<UiState>((set) => ({
  selectedTeamSlug: null,
  raceFilter: "all",
  scenarioMode: "quick",
  setSelectedTeamSlug: (selectedTeamSlug) => set({ selectedTeamSlug }),
  setRaceFilter: (raceFilter) => set({ raceFilter }),
  setScenarioMode: (scenarioMode) => set({ scenarioMode }),
}));
