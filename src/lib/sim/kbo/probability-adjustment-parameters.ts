import { z } from "zod";

export const PROBABILITY_ADJUSTMENT_FEATURE_KEYS = [
  "recent10Gap",
  "pctGap",
  "venueSplitGap",
  "restGap",
  "monthValue",
  "seasonProgress",
  "offenseGap",
  "starterGap",
  "bullpenGap",
  "confidenceGap",
  "recentFormGap",
  "currentWeightGap",
  "homeFieldValue",
  "recent10ByProgress",
  "pctByProgress",
  "offenseByProgress",
  "bullpenByRest",
  "homeFieldByRecent10",
  "confidenceByRecent10",
] as const;

export type ProbabilityAdjustmentFeatureKey =
  typeof PROBABILITY_ADJUSTMENT_FEATURE_KEYS[number];

const featureWeightShape = Object.fromEntries(
  PROBABILITY_ADJUSTMENT_FEATURE_KEYS.map((key) => [key, z.number()]),
) as Record<ProbabilityAdjustmentFeatureKey, z.ZodNumber>;

export const probabilityAdjustmentFeatureWeightsSchema = z.object(featureWeightShape);
export type ProbabilityAdjustmentFeatureWeights = z.infer<typeof probabilityAdjustmentFeatureWeightsSchema>;

export const probabilityAdjustmentParameterSetSchema = z.object({
  homeBias: z.number(),
  awayBias: z.number(),
  tieBias: z.number(),
  homeWeights: probabilityAdjustmentFeatureWeightsSchema,
  awayWeights: probabilityAdjustmentFeatureWeightsSchema,
  tieWeights: probabilityAdjustmentFeatureWeightsSchema,
});
export type ProbabilityAdjustmentParameterSet = z.infer<typeof probabilityAdjustmentParameterSetSchema>;

function zeroWeights(): ProbabilityAdjustmentFeatureWeights {
  return probabilityAdjustmentFeatureWeightsSchema.parse(
    Object.fromEntries(PROBABILITY_ADJUSTMENT_FEATURE_KEYS.map((key) => [key, 0])),
  );
}

export const DEFAULT_PROBABILITY_ADJUSTMENT_PARAMETERS: ProbabilityAdjustmentParameterSet =
  probabilityAdjustmentParameterSetSchema.parse({
    homeBias: 0,
    awayBias: 0,
    tieBias: 0,
    homeWeights: zeroWeights(),
    awayWeights: zeroWeights(),
    tieWeights: zeroWeights(),
  });
