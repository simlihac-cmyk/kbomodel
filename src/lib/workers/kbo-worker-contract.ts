import { z } from "zod";

import { DEFAULT_SIMULATION_ITERATIONS } from "@/lib/domain/kbo/constants";
import {
  gameSchema,
  playerSchema,
  playerGameStatSchema,
  playerSeasonStatSchema,
  rosterEventSchema,
  rulesetSchema,
  scenarioOverrideSchema,
  seasonSchema,
  seasonTeamSchema,
  seriesSchema,
  simulationSnapshotSchema,
  teamSeasonStatSchema,
} from "@/lib/domain/kbo/schemas";
import type { SimulationInput } from "@/lib/domain/kbo/types";
import { simulateSeason } from "@/lib/sim/kbo";

export const simulationInputSchema = z.object({
  season: seasonSchema,
  ruleset: rulesetSchema,
  seasonTeams: z.array(seasonTeamSchema),
  series: z.array(seriesSchema),
  games: z.array(gameSchema),
  teamSeasonStats: z.array(teamSeasonStatSchema),
  players: z.array(playerSchema),
  rosterEvents: z.array(rosterEventSchema),
  playerSeasonStats: z.array(playerSeasonStatSchema),
  playerGameStats: z.array(playerGameStatSchema),
  previousSeasonStats: z.array(teamSeasonStatSchema),
  scenarioOverrides: z.array(scenarioOverrideSchema),
});

export const workerRequestSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("simulate"),
    requestId: z.string(),
    payload: simulationInputSchema,
    iterations: z.number().int().positive().default(DEFAULT_SIMULATION_ITERATIONS),
  }),
  z.object({
    type: z.literal("cancel"),
    requestId: z.string(),
  }),
]);

export const workerResponseSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("result"),
    requestId: z.string(),
    payload: simulationSnapshotSchema,
  }),
  z.object({
    type: z.literal("cancelled"),
    requestId: z.string(),
  }),
  z.object({
    type: z.literal("error"),
    requestId: z.string(),
    error: z.string(),
  }),
]);

export type WorkerRequest = z.infer<typeof workerRequestSchema>;
export type WorkerResponse = z.infer<typeof workerResponseSchema>;

export function runSimulationRequest(
  input: SimulationInput,
  iterations = DEFAULT_SIMULATION_ITERATIONS,
) {
  return simulateSeason(input, iterations);
}
