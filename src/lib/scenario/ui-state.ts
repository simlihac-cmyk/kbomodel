import { normalizeTeamSlug } from "@/lib/utils/routes";

export type ScenarioPageMode = "quick" | "team" | "race" | "advanced" | null;
export type ScenarioPageRaceFilter = "first" | "second" | "fifth" | "all" | null;

export function resolveInitialScenarioUiState(
  initialMode: ScenarioPageMode,
  initialTeamSlug: string | null,
  initialRaceFilter: ScenarioPageRaceFilter = null,
) {
  return {
    scenarioMode: initialMode ?? "quick",
    selectedTeamSlug: initialTeamSlug ? normalizeTeamSlug(initialTeamSlug) : null,
    raceFilter: initialRaceFilter ?? "all",
  };
}
