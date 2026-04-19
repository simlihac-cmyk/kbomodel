import { datasetIdSchema, type DatasetId } from "@/lib/data-sources/kbo/dataset-types";
import { kboSourceRegistry } from "@/lib/data-sources/kbo/source-registry";
import { mergeNormalizedAwards } from "@/lib/data-sources/kbo/normalize/awards";
import { FileKboRepository } from "@/lib/repositories/kbo/file-adapter";
import { FileKboIngestPatchRepository } from "@/lib/repositories/kbo/patch-repository";
import { FileNormalizedKboRepository } from "@/lib/repositories/kbo/normalized-repository";
import { FileRawSourceRepository } from "@/lib/repositories/kbo/raw-source-repository";
import {
  buildPublishedKboBundleFromNormalized,
  writePublishedKboBundle,
} from "@/lib/repositories/kbo/published-bundle";

const DATASET_TO_TARGET = {
  "schedule-calendar": "series-games",
  scoreboard: "scoreboard",
  standings: "standings",
  "player-register-all": "players",
  "player-awards-mvp-rookie": "awards",
  "player-awards-golden-glove": "awards",
  "player-awards-defense-prize": "awards",
  "player-awards-series-prize": "awards",
  "team-hitter": "team-hitter-stats",
  "team-pitcher": "team-pitcher-stats",
  "roster-movement": "roster-events",
  "historical-team-record": "historical-team-records",
  "team-history": "franchise-lineage",
  rules: "rulesets",
} as const;

async function normalizeDataset(datasetId: DatasetId) {
  const entry = kboSourceRegistry
    .filter((item) => item.datasetId === datasetId && item.enabled)
    .sort((left, right) => left.priority - right.priority)[0];
  if (!entry) {
    throw new Error(`No enabled source registry entry found for ${datasetId}`);
  }
  if (!entry.normalizer || !entry.normalizedTarget) {
    throw new Error(`Dataset ${datasetId} does not have a configured normalizer.`);
  }

  const rawRepository = new FileRawSourceRepository();
  const normalizedRepository = new FileNormalizedKboRepository();
  const patchRepository = new FileKboIngestPatchRepository();
  const repository = new FileKboRepository();

  const snapshot = await rawRepository.getLatestSnapshot(entry.sourceId, datasetId);
  if (!snapshot) {
    throw new Error(`No raw snapshot found for ${entry.sourceId}/${datasetId}`);
  }

  const [bundle, season] = await Promise.all([
    repository.getBundle(),
    repository.getCurrentSeason(),
  ]);
  const patches = await patchRepository.getManualSourcePatches();
  const parsed = entry.parser(snapshot.html) as never;
  const normalized = entry.normalizer({
    seasonId: season.seasonId,
    parsed,
    bundle,
    patches,
    sourceRef: {
      sourceId: entry.sourceId,
      datasetId: entry.datasetId,
      snapshotKey: snapshot.snapshotKey,
      parserVersion: entry.parserVersion,
    },
  }) as never;

  const snapshotKey =
    "seasonId" in (normalized as Record<string, unknown>)
      ? `${season.year}-${snapshot.snapshotKey}`
      : snapshot.snapshotKey;
  const mergedNormalized =
    entry.normalizedTarget === "awards"
      ? mergeNormalizedAwards(
          await normalizedRepository.getDatasetOutput("awards", snapshotKey),
          normalized as never,
        )
      : normalized;

  await normalizedRepository.saveDatasetOutput(entry.normalizedTarget, snapshotKey, mergedNormalized);
  console.log(`Normalized ${entry.sourceId}/${datasetId} -> ${entry.normalizedTarget}/${snapshotKey}`);
}

async function main() {
  const datasetArg = process.argv[2] ?? "all";
  if (datasetArg === "all") {
    const datasets = Object.keys(DATASET_TO_TARGET) as DatasetId[];
    for (const datasetId of datasets) {
      await normalizeDataset(datasetId);
    }
    const publishedBundle = await buildPublishedKboBundleFromNormalized();
    await writePublishedKboBundle(publishedBundle);
    return;
  }

  await normalizeDataset(datasetIdSchema.parse(datasetArg));
  const publishedBundle = await buildPublishedKboBundleFromNormalized();
  await writePublishedKboBundle(publishedBundle);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
