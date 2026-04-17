import { describe, expect, it } from "vitest";

import type { TeamSeasonStat } from "@/lib/domain/kbo/types";
import {
  buildBullpenProxySignal,
  buildCurrentWeight,
  buildHomeFieldAdjustmentFromState,
  buildOffenseSignal,
  parseRecent10,
  buildRunPreventionSignal,
  buildScheduleStrengthValue,
  buildTeamStateLeagueAverages,
  buildTeamStateSnapshot,
} from "@/lib/sim/kbo/shared-team-state";
import { DEFAULT_STRENGTH_MODEL_PARAMETERS } from "@/lib/sim/kbo/strength-model-parameters";

describe("shared team state signals", () => {
  const buildStat = (overrides: Partial<TeamSeasonStat>): TeamSeasonStat => ({
    seasonId: "kbo-2026",
    seasonTeamId: "kbo-2026:lg",
    wins: 12,
    losses: 8,
    ties: 0,
    runsScored: 98,
    runsAllowed: 80,
    homeWins: 7,
    homeLosses: 3,
    awayWins: 5,
    awayLosses: 5,
    last10: "6-4-0",
    streak: "승2",
    offensePlus: 104,
    pitchingPlus: 101,
    bullpenEra: 3.9,
    teamWar: 1.2,
    ...overrides,
  });

  it("derives offense and prevention from score-based state instead of team-plus fields", () => {
    const strong = buildTeamStateSnapshot(buildStat({ runsScored: 110, runsAllowed: 72, offensePlus: 90, pitchingPlus: 90 }));
    const weak = buildTeamStateSnapshot(buildStat({ seasonTeamId: "kbo-2026:ssg", wins: 9, losses: 11, runsScored: 75, runsAllowed: 98, offensePlus: 120, pitchingPlus: 120 }));
    const league = buildTeamStateLeagueAverages([strong, weak]);

    expect(buildOffenseSignal(strong, league)).toBeGreaterThan(buildOffenseSignal(weak, league));
    expect(buildRunPreventionSignal(strong, league)).toBeGreaterThan(buildRunPreventionSignal(weak, league));
    expect(buildBullpenProxySignal(strong, league)).toBeGreaterThan(buildBullpenProxySignal(weak, league));
  });

  it("builds home field and schedule values from shared live/historical state", () => {
    const homeStrong = buildTeamStateSnapshot(buildStat({ homeWins: 9, homeLosses: 1, awayWins: 3, awayLosses: 7 }));
    const roadStrong = buildTeamStateSnapshot(buildStat({ seasonTeamId: "kbo-2026:kt", homeWins: 4, homeLosses: 6, awayWins: 8, awayLosses: 2 }));
    const league = buildTeamStateLeagueAverages([homeStrong, roadStrong]);

    expect(buildHomeFieldAdjustmentFromState(homeStrong, league, 0.18)).toBeGreaterThan(0.18);
    expect(buildScheduleStrengthValue(homeStrong, league)).not.toBeNaN();
  });

  it("treats an empty recent-10 sample as neutral instead of negative", () => {
    expect(parseRecent10("0-0").winRate).toBe(0.5);
    expect(parseRecent10("0-0-0").winRate).toBe(0.5);
  });

  it("lets current-weight conservatism move with learned parameters", () => {
    const conservative = buildCurrentWeight(14, 144, {
      ...DEFAULT_STRENGTH_MODEL_PARAMETERS,
      currentWeightProgressExponent: 1.8,
      currentWeightProgressMix: 0.62,
      currentWeightShrinkageMultiplier: 2.8,
    });
    const aggressive = buildCurrentWeight(14, 144, {
      ...DEFAULT_STRENGTH_MODEL_PARAMETERS,
      currentWeightProgressExponent: 0.9,
      currentWeightProgressMix: 0.35,
      currentWeightShrinkageMultiplier: 1.2,
    });

    expect(aggressive).toBeGreaterThan(conservative);
  });
});
