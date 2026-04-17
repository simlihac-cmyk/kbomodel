import type {
  NormalizedRosterEvents,
  NormalizedScoreboard,
  NormalizedSeriesGames,
  NormalizedStandings,
  ParsedWeatherRow,
} from "@/lib/data-sources/kbo/dataset-types";
import { simulationSeedInputSchema } from "@/lib/data-sources/kbo/dataset-types";

type BuildSimulationSeedInputsArgs = {
  standings: NormalizedStandings;
  seriesGames: NormalizedSeriesGames;
  rosterEvents: NormalizedRosterEvents;
  scoreboard?: NormalizedScoreboard | null;
  weather?: ParsedWeatherRow[];
};

export function buildSimulationSeedInputs({
  standings,
  seriesGames,
  rosterEvents,
  scoreboard,
  weather = [],
}: BuildSimulationSeedInputsArgs) {
  const remainingSchedule = seriesGames.games.filter((game) => game.status !== "final");
  const headToHeadRemainingGames = remainingSchedule.reduce<Record<string, number>>((accumulator, game) => {
    const key = [game.homeSeasonTeamId, game.awaySeasonTeamId].sort().join("__");
    accumulator[key] = (accumulator[key] ?? 0) + 1;
    return accumulator;
  }, {});

  const pitcherUsageInputs = standings.rows.map((row) => {
    const teamGames = scoreboard?.games.filter(
      (game) => game.homeSeasonTeamId === row.seasonTeamId || game.awaySeasonTeamId === row.seasonTeamId,
    );
    const recentInnings = teamGames?.reduce((sum, game) => sum + (game.innings ?? 9), 0) ?? 0;
    return {
      seasonTeamId: row.seasonTeamId,
      recentInnings,
      recentBullpenLoad: Number((recentInnings / Math.max(teamGames?.length ?? 1, 1)).toFixed(2)),
    };
  });

  return simulationSeedInputSchema.parse({
    seasonId: standings.seasonId,
    generatedAt: new Date().toISOString(),
    currentStandings: standings,
    remainingSchedule,
    headToHeadRemainingGames,
    homeAwaySplits: standings.rows.map((row) => ({
      seasonTeamId: row.seasonTeamId,
      homeRecord: row.homeRecord,
      awayRecord: row.awayRecord,
    })),
    rosterAvailabilityEvents: rosterEvents.events,
    teamOffenseInputs: standings.rows.map((row) => ({
      seasonTeamId: row.seasonTeamId,
      runsScored: row.runsScored,
      gamesPlayed: row.games,
    })),
    pitcherUsageInputs,
    weatherInputs: weather,
  });
}
