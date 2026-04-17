import type { SimulationInput, TeamSeasonStat } from "@/lib/domain/kbo/types";
import type { SeasonContext } from "@/lib/repositories/kbo/contracts";

export function buildSimulationInputFromSeasonContext(
  seasonContext: SeasonContext,
  previousSeasonStats: TeamSeasonStat[] = [],
): SimulationInput {
  return {
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
}
