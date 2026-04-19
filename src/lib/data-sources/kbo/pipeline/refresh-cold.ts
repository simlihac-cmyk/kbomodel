import { datasetIdSchema, type DatasetId } from "@/lib/data-sources/kbo/dataset-types";
import { mergeNormalizedAwards } from "@/lib/data-sources/kbo/normalize/awards";
import { kboSourceRegistry } from "@/lib/data-sources/kbo/source-registry";
import { FileKboRepository } from "@/lib/repositories/kbo/file-adapter";
import { FileKboIngestPatchRepository } from "@/lib/repositories/kbo/patch-repository";
import { FileNormalizedKboRepository } from "@/lib/repositories/kbo/normalized-repository";
import { FileRawSourceRepository } from "@/lib/repositories/kbo/raw-source-repository";
import { buildPublishedKboBundleFromNormalized, writePublishedKboBundle } from "@/lib/repositories/kbo/published-bundle";
import { fetchSnapshotForKboDataset } from "@/lib/data-sources/kbo/fetch/fetch-source-snapshot";
import { getKboDateKey } from "@/lib/scheduler/kbo/windows";

const COLD_DATASETS: DatasetId[] = [
  "historical-team-record",
  "team-history",
  "rules",
  "player-awards-mvp-rookie",
  "player-awards-golden-glove",
  "player-awards-defense-prize",
  "player-awards-series-prize",
];

async function runDataset(datasetId: DatasetId) {
  const entry = kboSourceRegistry
    .filter((item) => item.datasetId === datasetId && item.enabled)
    .sort((left, right) => left.priority - right.priority)[0];
  if (!entry || !entry.normalizer || !entry.normalizedTarget) {
    return;
  }

  const rawRepository = new FileRawSourceRepository();
  const normalizedRepository = new FileNormalizedKboRepository();
  const patchRepository = new FileKboIngestPatchRepository();
  const repository = new FileKboRepository();
  const [bundle, season] = await Promise.all([
    repository.getBundle(),
    repository.getCurrentSeason(),
  ]);
  const patches = await patchRepository.getManualSourcePatches();
  const snapshot = await fetchSnapshotForKboDataset(datasetId, entry.sourceUrl);
  const snapshotKey = getKboDateKey();

  await rawRepository.saveSnapshot({
    sourceId: entry.sourceId,
    datasetId: datasetIdSchema.parse(datasetId),
    snapshotKey,
    fetchedAt: snapshot.fetchedAt,
    sourceUrl: snapshot.sourceUrl,
    httpStatus: snapshot.httpStatus,
    checksum: snapshot.checksum,
    parserVersion: entry.parserVersion,
    fixtureBacked: false,
    html: snapshot.html,
  });

  const parsed = entry.parser(snapshot.html) as never;
  const normalized = entry.normalizer({
    seasonId: season.seasonId,
    parsed,
    bundle,
    patches,
    sourceRef: {
      sourceId: entry.sourceId,
      datasetId: entry.datasetId,
      snapshotKey,
      parserVersion: entry.parserVersion,
    },
  }) as never;
  const outputKey =
    "seasonId" in (normalized as Record<string, unknown>) ? `${season.year}-${snapshotKey}` : snapshotKey;
  const mergedNormalized =
    entry.normalizedTarget === "awards"
      ? mergeNormalizedAwards(
          await normalizedRepository.getDatasetOutput("awards", outputKey),
          normalized as never,
        )
      : normalized;
  await normalizedRepository.saveDatasetOutput(entry.normalizedTarget, outputKey, mergedNormalized);
}

export async function refreshColdPathSources() {
  for (const datasetId of COLD_DATASETS) {
    await runDataset(datasetId);
  }

  const publishedBundle = await buildPublishedKboBundleFromNormalized({
    allowFixturePublish: process.env.ALLOW_FIXTURE_PUBLISH === "true",
  });
  await writePublishedKboBundle(publishedBundle);
}
