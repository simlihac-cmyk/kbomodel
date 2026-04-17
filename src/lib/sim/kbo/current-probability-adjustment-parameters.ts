import {
  DEFAULT_PROBABILITY_ADJUSTMENT_PARAMETERS,
  probabilityAdjustmentParameterSetSchema,
  type ProbabilityAdjustmentParameterSet,
} from "@/lib/sim/kbo/probability-adjustment-parameters";

export const CURRENT_PROBABILITY_ADJUSTMENT_PARAMETERS_SOURCE = {
  trainedAt: null,
  fitYears: [] as number[],
  tuneYears: [] as number[],
  validationYears: [] as number[],
  sourcePath: null,
} as const;

export const CURRENT_PROBABILITY_ADJUSTMENT_PARAMETERS: ProbabilityAdjustmentParameterSet =
  probabilityAdjustmentParameterSetSchema.parse(DEFAULT_PROBABILITY_ADJUSTMENT_PARAMETERS);
