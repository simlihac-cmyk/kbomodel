import { z } from "zod";

export const DIRECT_GAME_FEATURE_KEYS = [
  "eloDiff",
  "pctGap",
  "recent10Gap",
  "opponentAdjustedRecent10Gap",
  "venueSplitGap",
  "restGap",
  "seasonProgress",
  "progressXEloDiff",
  "progressXPctGap",
  "progressXOpponentAdjustedRecent10Gap",
] as const;

export type DirectGameFeatureKey = (typeof DIRECT_GAME_FEATURE_KEYS)[number];

const featureShape = Object.fromEntries(
  DIRECT_GAME_FEATURE_KEYS.map((key) => [key, z.number()]),
) as Record<DirectGameFeatureKey, z.ZodNumber>;

export const directGameFeatureVectorSchema = z.object(featureShape);
export type DirectGameFeatureVector = z.infer<typeof directGameFeatureVectorSchema>;

export const directGameWeightVectorSchema = z.object(featureShape);
export type DirectGameWeightVector = z.infer<typeof directGameWeightVectorSchema>;

export const directGameParameterSetSchema = z.object({
  decisiveBlend: z.number().min(0).max(1),
  decisiveBias: z.number(),
  decisiveWeights: directGameWeightVectorSchema,
  tieBias: z.number(),
  tieWeights: directGameWeightVectorSchema,
  tieMinProbability: z.number().min(0).max(0.5),
  tieMaxProbability: z.number().min(0).max(1),
});
export type DirectGameParameterSet = z.infer<typeof directGameParameterSetSchema>;

function zeroWeights(): DirectGameWeightVector {
  return directGameWeightVectorSchema.parse(
    Object.fromEntries(DIRECT_GAME_FEATURE_KEYS.map((key) => [key, 0])),
  );
}

export const DEFAULT_DIRECT_GAME_MODEL_PARAMETERS: DirectGameParameterSet =
  directGameParameterSetSchema.parse({
    decisiveBlend: 0,
    decisiveBias: 0,
    decisiveWeights: zeroWeights(),
    tieBias: 0,
    tieWeights: zeroWeights(),
    tieMinProbability: 0,
    tieMaxProbability: 1,
  });
