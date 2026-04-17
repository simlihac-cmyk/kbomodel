import { CURRENT_DIRECT_GAME_MODEL_PARAMETERS } from "@/lib/sim/kbo/current-direct-game-model";
import {
  DIRECT_GAME_FEATURE_KEYS,
  type DirectGameFeatureVector,
  type DirectGameParameterSet,
} from "@/lib/sim/kbo/direct-game/model-types";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function sigmoid(value: number) {
  return 1 / (1 + Math.exp(-value));
}

function dotProduct(
  weights: Record<(typeof DIRECT_GAME_FEATURE_KEYS)[number], number>,
  features: DirectGameFeatureVector,
) {
  return DIRECT_GAME_FEATURE_KEYS.reduce(
    (sum, key) => sum + weights[key] * features[key],
    0,
  );
}

export type DirectGameBaseProbabilities = {
  homeWinProb: number;
  awayWinProb: number;
  tieProb: number;
};

export type DirectGameRuntimeArgs = DirectGameBaseProbabilities & {
  features: DirectGameFeatureVector;
  parameters?: DirectGameParameterSet;
};

export function applyDirectGameRuntimeModel(
  args: DirectGameRuntimeArgs,
): DirectGameBaseProbabilities {
  const parameters = args.parameters ?? CURRENT_DIRECT_GAME_MODEL_PARAMETERS;
  const decisiveTotal = Math.max(args.homeWinProb + args.awayWinProb, 1e-9);
  const baseHomeDecisiveProb = args.homeWinProb / decisiveTotal;
  const rawDecisiveScore =
    parameters.decisiveBias +
    dotProduct(parameters.decisiveWeights, args.features);
  const logisticHomeDecisiveProb = sigmoid(
    rawDecisiveScore * parameters.decisiveLogitScale,
  );
  const homeDecisiveProb = clamp(
    baseHomeDecisiveProb * (1 - parameters.decisiveBlend) +
      logisticHomeDecisiveProb * parameters.decisiveBlend,
    1e-6,
    1 - 1e-6,
  );

  const tieProb = args.tieProb;
  const homeWinProb = (1 - tieProb) * homeDecisiveProb;
  const awayWinProb = (1 - tieProb) * (1 - homeDecisiveProb);

  return {
    homeWinProb: Number(homeWinProb.toFixed(6)),
    awayWinProb: Number(awayWinProb.toFixed(6)),
    tieProb: Number(tieProb.toFixed(6)),
  };
}
