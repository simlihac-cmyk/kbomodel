import { gameModelParameterSetSchema, type GameModelParameterSet } from "@/lib/sim/kbo/model-parameters";

export const CURRENT_GAME_MODEL_PARAMETERS_SOURCE = {
  trainedAt: "2026-04-17T05:35:35.977Z",
  fitYears: [2021, 2022, 2023],
  tuneYears: [2024],
  validationYears: [2025],
  sourcePath: "trained-results/kbo-training-fit-20260417T053534Z/parameters.json",
} as const;

export const CURRENT_GAME_MODEL_PARAMETERS: GameModelParameterSet = gameModelParameterSetSchema.parse({
  leagueRunEnvironment: 4.428628185856,
  awayRunEnvironmentOffset: 0.03343237341312,
  offenseWeight: 0.0090250233568,
  starterWeight: 0.0078123930880000005,
  bullpenWeight: 0.0019766570727296003,
  recentFormWeight: 0.09848762390625,
  homeFieldWeightHome: 0.19848762390625002,
  homeFieldWeightAway: 0.09848762390625,
  confidenceBase: 0.3365962639769601,
  confidenceScale: 0.5856103321599998,
  tieCarryRate: 0.25848762390624996,
  minTieProbability: 0.015,
  maxTieProbability: 0.085,
});
