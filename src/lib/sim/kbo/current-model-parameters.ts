import { gameModelParameterSetSchema, type GameModelParameterSet } from "@/lib/sim/kbo/model-parameters";

export const CURRENT_GAME_MODEL_PARAMETERS_SOURCE = {
  trainedAt: "2026-04-17T12:58:32.261Z",
  fitYears: [2021, 2022, 2023],
  tuneYears: [2024],
  validationYears: [2025],
  sourcePath: "trained-results/kbo-training-fit-20260417T125803Z/parameters.json",
} as const;

export const CURRENT_GAME_MODEL_PARAMETERS: GameModelParameterSet = gameModelParameterSetSchema.parse({
  leagueRunEnvironment: 4.1886281858559995,
  awayRunEnvironmentOffset: 0,
  offenseWeight: 0.012025023356800002,
  starterWeight: 0.009412393088000001,
  bullpenWeight: 0.001,
  recentFormWeight: 0.07848762390625,
  homeFieldWeightHome: 0.16848762390625002,
  homeFieldWeightAway: 0.06848762390625,
  confidenceBase: 0.41659626397696004,
  confidenceScale: 0.48561033215999977,
  tieCarryRate: 0.16848762390624997,
  minTieProbability: 0.015,
  maxTieProbability: 0.085,
});
