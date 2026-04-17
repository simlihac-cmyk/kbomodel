import { promises as fs } from "node:fs";
import path from "node:path";

import {
  normalizedDatasetFileNameSchema,
  normalizedFranchiseLineageSchema,
  normalizedPlayerGameStatsSchema,
  normalizedPlayerSplitStatsSchema,
  normalizedHistoricalTeamRecordsSchema,
  normalizedPlayerSeasonStatsSchema,
  normalizedPlayersSchema,
  normalizedRosterEventsSchema,
  normalizedRulesetsSchema,
  normalizedScoreboardSchema,
  normalizedSeriesGamesSchema,
  normalizedStandingsSchema,
  normalizedTeamHitterStatsSchema,
  normalizedTeamPitcherStatsSchema,
  type NormalizedDatasetFileName,
  type NormalizedDatasetOutputMap,
} from "@/lib/data-sources/kbo/dataset-types";
import type { NormalizedKboSourceRepository } from "@/lib/repositories/kbo/contracts";

const DEFAULT_NORMALIZED_ROOT = path.join(process.cwd(), "data", "normalized", "kbo");

const schemaMap = {
  "series-games": normalizedSeriesGamesSchema,
  scoreboard: normalizedScoreboardSchema,
  standings: normalizedStandingsSchema,
  players: normalizedPlayersSchema,
  "player-season-stats": normalizedPlayerSeasonStatsSchema,
  "player-game-stats": normalizedPlayerGameStatsSchema,
  "player-split-stats": normalizedPlayerSplitStatsSchema,
  "roster-events": normalizedRosterEventsSchema,
  "franchise-lineage": normalizedFranchiseLineageSchema,
  "historical-team-records": normalizedHistoricalTeamRecordsSchema,
  "team-hitter-stats": normalizedTeamHitterStatsSchema,
  "team-pitcher-stats": normalizedTeamPitcherStatsSchema,
  rulesets: normalizedRulesetsSchema,
} as const;

export class FileNormalizedKboRepository implements NormalizedKboSourceRepository {
  private getFilePath(datasetName: NormalizedDatasetFileName, snapshotKey: string) {
    return path.join(DEFAULT_NORMALIZED_ROOT, datasetName, `${snapshotKey}.json`);
  }

  async saveDatasetOutput<TDataset extends NormalizedDatasetFileName>(
    datasetName: TDataset,
    snapshotKey: string,
    payload: NormalizedDatasetOutputMap[TDataset],
  ) {
    const schema = schemaMap[datasetName];
    const parsed = schema.parse(payload);
    const filePath = this.getFilePath(datasetName, snapshotKey);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
  }

  async getDatasetOutput<TDataset extends NormalizedDatasetFileName>(datasetName: TDataset, snapshotKey: string) {
    const schema = schemaMap[datasetName];
    const filePath = this.getFilePath(datasetName, snapshotKey);
    try {
      const raw = JSON.parse(await fs.readFile(filePath, "utf8")) as unknown;
      return schema.parse(raw) as NormalizedDatasetOutputMap[TDataset];
    } catch {
      return null;
    }
  }

  async listDatasetKeys(datasetName: NormalizedDatasetFileName) {
    normalizedDatasetFileNameSchema.parse(datasetName);
    const directory = path.join(DEFAULT_NORMALIZED_ROOT, datasetName);
    try {
      const files = await fs.readdir(directory);
      return files
        .filter((file) => file.endsWith(".json"))
        .map((file) => file.replace(/\.json$/, ""))
        .sort();
    } catch {
      return [];
    }
  }
}
