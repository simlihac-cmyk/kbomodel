import { describe, expect, it } from "vitest";

import { resolveInitialScenarioUiState } from "@/lib/scenario/ui-state";

describe("scenario UI state", () => {
  it("defaults to quick mode with no team filter", () => {
    expect(resolveInitialScenarioUiState(null, null)).toEqual({
      scenarioMode: "quick",
      selectedTeamSlug: null,
      raceFilter: "all",
    });
  });

  it("keeps normalized team filter when a team is preselected", () => {
    expect(resolveInitialScenarioUiState("team", "lg-twins")).toEqual({
      scenarioMode: "team",
      selectedTeamSlug: "lg-twins",
      raceFilter: "all",
    });
    expect(resolveInitialScenarioUiState("quick", "lg-twins")).toEqual({
      scenarioMode: "quick",
      selectedTeamSlug: "lg-twins",
      raceFilter: "all",
    });
  });

  it("normalizes aliased team slugs and preserves race filter", () => {
    expect(resolveInitialScenarioUiState("race", "키움-히어로즈", "fifth")).toEqual({
      scenarioMode: "race",
      selectedTeamSlug: "kiwoom-heroes",
      raceFilter: "fifth",
    });
  });
});
