import { describe, expect, it } from "vitest";

import { FileKboRepository } from "@/lib/repositories/kbo/file-adapter";
import { runSimulationRequest, simulationInputSchema, workerRequestSchema } from "@/lib/workers/kbo-worker-contract";

describe("worker contract", () => {
  it("validates simulation input and returns a snapshot", async () => {
    const repository = new FileKboRepository();
    const seasonContext = await repository.getSeasonContext(2026);
    const seasons = await repository.listSeasons();
    const bundle = await repository.getBundle();
    const previous = seasons
      .filter((season) => season.year < 2026)
      .sort((left, right) => right.year - left.year)[0];
    const previousSeasonStats = previous
      ? bundle.teamSeasonStats.filter((item) => item.seasonId === previous.seasonId)
      : [];

    if (!seasonContext) {
      throw new Error("Expected season context");
    }

    const payload = {
      season: seasonContext.season,
      ruleset: seasonContext.ruleset,
      seasonTeams: seasonContext.seasonTeams,
      series: seasonContext.series,
      games: seasonContext.games,
      teamSeasonStats: seasonContext.teamSeasonStats,
      players: seasonContext.players,
      rosterEvents: seasonContext.rosterEvents,
      playerSeasonStats: seasonContext.playerSeasonStats,
      playerGameStats: seasonContext.playerGameStats,
      previousSeasonStats,
      scenarioOverrides: [],
    };

    expect(() => simulationInputSchema.parse(payload)).not.toThrow();
    expect(() =>
      workerRequestSchema.parse({
        type: "simulate",
        requestId: "request-1",
        iterations: 20,
        payload,
      }),
    ).not.toThrow();

    const snapshot = runSimulationRequest(payload, 20);
    expect(snapshot.iterations).toBe(20);
    expect(snapshot.rankDistributions).toHaveLength(10);
  });
});
