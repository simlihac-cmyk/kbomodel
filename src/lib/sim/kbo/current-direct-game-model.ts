import {
  DEFAULT_DIRECT_GAME_MODEL_PARAMETERS,
  directGameParameterSetSchema,
  type DirectGameParameterSet,
} from "@/lib/sim/kbo/direct-game/model-types";

export const CURRENT_DIRECT_GAME_MODEL_SOURCE = {
  trainedAt: null,
  fitYears: [] as number[],
  tuneYears: [] as number[],
  validationYears: [] as number[],
  sourcePath: null,
} as const;

export const CURRENT_DIRECT_GAME_MODEL_PARAMETERS: DirectGameParameterSet =
  directGameParameterSetSchema.parse(DEFAULT_DIRECT_GAME_MODEL_PARAMETERS);
