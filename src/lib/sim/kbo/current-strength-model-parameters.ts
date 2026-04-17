import {
  DEFAULT_STRENGTH_MODEL_PARAMETERS,
  strengthModelParameterSetSchema,
  type StrengthModelParameterSet,
} from "@/lib/sim/kbo/strength-model-parameters";

export const CURRENT_STRENGTH_MODEL_PARAMETERS_SOURCE = {
  trainedAt: null,
  fitYears: [] as number[],
  tuneYears: [] as number[],
  validationYears: [] as number[],
  sourcePath: "manual-defaults",
} as const;

export const CURRENT_STRENGTH_MODEL_PARAMETERS: StrengthModelParameterSet =
  strengthModelParameterSetSchema.parse(DEFAULT_STRENGTH_MODEL_PARAMETERS);
