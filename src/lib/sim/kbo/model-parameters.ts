import { z } from "zod";

export const gameModelParameterSetSchema = z
  .object({
    leagueRunEnvironment: z.number().positive(),
    awayRunEnvironmentOffset: z.number().min(-1).max(1),
    offenseWeight: z.number().positive(),
    starterWeight: z.number().positive(),
    bullpenWeight: z.number().positive(),
    recentFormWeight: z.number().min(-2).max(2),
    homeFieldWeightHome: z.number().min(-2).max(2),
    homeFieldWeightAway: z.number().min(-2).max(2),
    confidenceBase: z.number().min(0).max(2),
    confidenceScale: z.number().min(0).max(2),
    tieCarryRate: z.number().positive(),
    minTieProbability: z.number().min(0).max(1),
    maxTieProbability: z.number().min(0).max(1),
  })
  .superRefine((value, context) => {
    if (value.maxTieProbability < value.minTieProbability) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["maxTieProbability"],
        message: "maxTieProbability must be greater than or equal to minTieProbability.",
      });
    }
  });

export type GameModelParameterSet = z.infer<typeof gameModelParameterSetSchema>;

export const DEFAULT_GAME_MODEL_PARAMETERS: GameModelParameterSet = gameModelParameterSetSchema.parse({
  leagueRunEnvironment: 4.35,
  awayRunEnvironmentOffset: 0.08,
  offenseWeight: 0.0105,
  starterWeight: 0.0075,
  bullpenWeight: 0.0035,
  recentFormWeight: 0.24,
  homeFieldWeightHome: 0.24,
  homeFieldWeightAway: 0.14,
  confidenceBase: 0.3,
  confidenceScale: 0.7,
  tieCarryRate: 0.34,
  minTieProbability: 0.015,
  maxTieProbability: 0.085,
});
