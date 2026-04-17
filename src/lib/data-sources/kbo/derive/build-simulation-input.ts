import { FileNormalizedKboRepository } from "@/lib/repositories/kbo/normalized-repository";
import type {
  NormalizedRosterEvents,
  NormalizedScoreboard,
  NormalizedSeriesGames,
  NormalizedStandings,
  SimulationSeedInput,
} from "@/lib/data-sources/kbo/dataset-types";
import { buildSimulationSeedInputs } from "@/lib/data-sources/kbo/normalize/simulation-inputs";

export async function buildLatestSimulationSeedInput(year: number): Promise<SimulationSeedInput | null> {
  const repository = new FileNormalizedKboRepository();

  const pickLatest = async <T,>(datasetName: "standings" | "series-games" | "scoreboard" | "roster-events") => {
    const key = (await repository.listDatasetKeys(datasetName))
      .filter((item) => item.startsWith(`${year}-`))
      .sort()
      .at(-1);
    if (!key) {
      return null;
    }
    return (await repository.getDatasetOutput(datasetName, key)) as T | null;
  };

  const [standings, seriesGames, scoreboard, rosterEvents] = await Promise.all([
    pickLatest<NormalizedStandings>("standings"),
    pickLatest<NormalizedSeriesGames>("series-games"),
    pickLatest<NormalizedScoreboard>("scoreboard"),
    pickLatest<NormalizedRosterEvents>("roster-events"),
  ]);

  if (!standings || !seriesGames) {
    return null;
  }

  return buildSimulationSeedInputs({
    standings,
    seriesGames,
    scoreboard,
    rosterEvents: rosterEvents ?? {
      generatedAt: new Date().toISOString(),
      seasonId: standings.seasonId,
      sources: [],
      events: [],
    },
  });
}
