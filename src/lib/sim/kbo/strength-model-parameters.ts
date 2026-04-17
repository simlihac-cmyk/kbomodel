import { z } from "zod";

export const strengthModelParameterSetSchema = z
  .object({
    currentWeightProgressExponent: z.number().positive(),
    currentWeightProgressMix: z.number().min(0).max(1),
    currentWeightShrinkageMultiplier: z.number().positive(),
    currentWeightMin: z.number().min(0).max(1),
    currentWeightMax: z.number().min(0).max(1),
    offenseRunsWeight: z.number().positive(),
    offenseRunDiffWeight: z.number().min(0),
    offenseRecentWeight: z.number().min(0).max(20),
    runPreventionRunsAllowedWeight: z.number().positive(),
    runPreventionRunDiffWeight: z.number().min(0),
    runPreventionWinPctWeight: z.number().min(0).max(20),
    bullpenRunsAllowedWeight: z.number().positive(),
    bullpenRecentWeight: z.number().min(0).max(20),
    bullpenStreakWeight: z.number().min(0).max(5),
    homeFieldSplitWeight: z.number().min(0).max(2),
    homeFieldMin: z.number().min(0).max(1),
    homeFieldMax: z.number().min(0).max(1),
    recentFormWinRateWeight: z.number().min(0).max(5),
    recentFormStreakWeight: z.number().min(0).max(2),
    confidenceBase: z.number().min(0).max(2),
    confidenceCurrentWeightWeight: z.number().min(0).max(2),
    confidenceRunDiffWeight: z.number().min(0).max(2),
    confidenceRunDiffCap: z.number().min(0).max(2),
    confidenceMin: z.number().min(0).max(1),
    confidenceMax: z.number().min(0).max(1),
  })
  .superRefine((value, context) => {
    if (value.currentWeightMax < value.currentWeightMin) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["currentWeightMax"],
        message: "currentWeightMax must be greater than or equal to currentWeightMin.",
      });
    }

    if (value.homeFieldMax < value.homeFieldMin) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["homeFieldMax"],
        message: "homeFieldMax must be greater than or equal to homeFieldMin.",
      });
    }

    if (value.confidenceMax < value.confidenceMin) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confidenceMax"],
        message: "confidenceMax must be greater than or equal to confidenceMin.",
      });
    }
  });

export type StrengthModelParameterSet = z.infer<typeof strengthModelParameterSetSchema>;

export const DEFAULT_STRENGTH_MODEL_PARAMETERS: StrengthModelParameterSet = strengthModelParameterSetSchema.parse({
  currentWeightProgressExponent: 1.35,
  currentWeightProgressMix: 0.55,
  currentWeightShrinkageMultiplier: 2.2,
  currentWeightMin: 0.08,
  currentWeightMax: 0.84,
  offenseRunsWeight: 6.8,
  offenseRunDiffWeight: 0,
  offenseRecentWeight: 8.8,
  runPreventionRunsAllowedWeight: 6.8,
  runPreventionRunDiffWeight: 0,
  runPreventionWinPctWeight: 10.8,
  bullpenRunsAllowedWeight: 4.4,
  bullpenRecentWeight: 9.2,
  bullpenStreakWeight: 0.35,
  homeFieldSplitWeight: 0.22,
  homeFieldMin: 0.08,
  homeFieldMax: 0.3,
  recentFormWinRateWeight: 1.7,
  recentFormStreakWeight: 0.05,
  confidenceBase: 0.24,
  confidenceCurrentWeightWeight: 0.68,
  confidenceRunDiffWeight: 0.1,
  confidenceRunDiffCap: 0.14,
  confidenceMin: 0.16,
  confidenceMax: 0.92,
});
