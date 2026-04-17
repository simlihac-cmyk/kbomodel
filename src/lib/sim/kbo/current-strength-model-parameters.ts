import {
  strengthModelParameterSetSchema,
  type StrengthModelParameterSet,
} from "@/lib/sim/kbo/strength-model-parameters";

export const CURRENT_STRENGTH_MODEL_PARAMETERS_SOURCE = {
  trainedAt: "2026-04-17T06:09:57.104Z",
  fitYears: [2021, 2022, 2023],
  tuneYears: [2024],
  validationYears: [2025],
  sourcePath: "trained-results/kbo-training-fit-20260417T060948Z/parameters.json",
} as const;

export const CURRENT_STRENGTH_MODEL_PARAMETERS: StrengthModelParameterSet = strengthModelParameterSetSchema.parse({
  currentWeightProgressExponent: 1.5900000000000003,
  currentWeightProgressMix: 0.55,
  currentWeightShrinkageMultiplier: 2.2,
  currentWeightMin: 0.08,
  currentWeightMax: 0.84,
  offenseRunsWeight: 9.4,
  offenseRunDiffWeight: 2.6,
  offenseRecentWeight: 4.2,
  runPreventionRunsAllowedWeight: 9.8,
  runPreventionRunDiffWeight: 3.1,
  runPreventionWinPctWeight: 8.4,
  bullpenRunsAllowedWeight: 6.6,
  bullpenRecentWeight: 5.8,
  bullpenStreakWeight: 0.35,
  homeFieldSplitWeight: 0.22,
  homeFieldMin: 0.08,
  homeFieldMax: 0.3,
  recentFormWinRateWeight: 0.8,
  recentFormStreakWeight: 0.08,
  confidenceBase: 0.24,
  confidenceCurrentWeightWeight: 0.68,
  confidenceRunDiffWeight: 0.04,
  confidenceRunDiffCap: 0.08,
  confidenceMin: 0.16,
  confidenceMax: 0.92,
});
