import {
  probabilityAdjustmentParameterSetSchema,
  type ProbabilityAdjustmentParameterSet,
} from "@/lib/sim/kbo/probability-adjustment-parameters";

export const CURRENT_PROBABILITY_ADJUSTMENT_PARAMETERS_SOURCE = {
  trainedAt: "2026-04-17T12:58:32.261Z",
  fitYears: [2021, 2022, 2023],
  tuneYears: [2024],
  validationYears: [2025],
  sourcePath: "trained-results/kbo-training-fit-20260417T125803Z/parameters.json",
} as const;

export const CURRENT_PROBABILITY_ADJUSTMENT_PARAMETERS: ProbabilityAdjustmentParameterSet =
  probabilityAdjustmentParameterSetSchema.parse({
    homeBias: 0,
    awayBias: 0,
    tieBias: 0,
    homeWeights: {
    recent10Gap: 0,
    pctGap: 0,
    venueSplitGap: 0,
    restGap: 0,
    seasonProgress: 0,
    recent10ByProgress: 0,
    pctByProgress: 0,
  },
    awayWeights: {
    recent10Gap: 0,
    pctGap: 0,
    venueSplitGap: 0,
    restGap: 0,
    seasonProgress: 0,
    recent10ByProgress: 0,
    pctByProgress: 0,
  },
    tieWeights: {
    recent10Gap: 0,
    pctGap: 0,
    venueSplitGap: 0,
    restGap: 0,
    seasonProgress: 0,
    recent10ByProgress: 0,
    pctByProgress: 0,
  },
  });
