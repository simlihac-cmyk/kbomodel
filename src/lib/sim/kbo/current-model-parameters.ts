import { gameModelParameterSetSchema, type GameModelParameterSet } from "@/lib/sim/kbo/model-parameters";

export const CURRENT_GAME_MODEL_PARAMETERS_SOURCE = {
  trainedAt: "2026-04-17T06:09:57.104Z",
  fitYears: [2021, 2022, 2023],
  tuneYears: [2024],
  validationYears: [2025],
  sourcePath: "trained-results/kbo-training-fit-20260417T060948Z/parameters.json",
} as const;

export const CURRENT_GAME_MODEL_PARAMETERS: GameModelParameterSet = gameModelParameterSetSchema.parse({
  leagueRunEnvironment: 4.268628185856,
  awayRunEnvironmentOffset: 0,
  offenseWeight: 0.011025023356800001,
  starterWeight: 0.009412393088000001,
  bullpenWeight: 0.001,
  recentFormWeight: 0.038487623906250004,
  homeFieldWeightHome: 0.13848762390625002,
  homeFieldWeightAway: 0.038487623906250004,
  confidenceBase: 0.41659626397696004,
  confidenceScale: 0.48561033215999977,
  tieCarryRate: 0.19848762390624997,
  minTieProbability: 0.015,
  maxTieProbability: 0.085,
});
