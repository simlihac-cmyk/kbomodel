import path from "node:path";
import { promises as fs } from "node:fs";

import { kboSourceRegistry } from "@/lib/data-sources/kbo/source-registry";
import { FileKboRepository } from "@/lib/repositories/kbo/file-adapter";
import { FileKboIngestPatchRepository } from "@/lib/repositories/kbo/patch-repository";
import { FileNormalizedKboRepository } from "@/lib/repositories/kbo/normalized-repository";
import { FileRawSourceRepository } from "@/lib/repositories/kbo/raw-source-repository";
import {
  buildPublishedKboBundleFromNormalized,
  loadFixtureSourceKboBundle,
  writePublishedKboBundle,
} from "@/lib/repositories/kbo/published-bundle";
import { checksumHtml } from "@/lib/data-sources/kbo/fetch/fetch-cache";

async function main() {
  const rawRepository = new FileRawSourceRepository();
  const normalizedRepository = new FileNormalizedKboRepository();
  const patchRepository = new FileKboIngestPatchRepository();
  const bundle = await loadFixtureSourceKboBundle();
  const season =
    [...bundle.seasons].sort((left, right) => right.year - left.year).find((item) => item.status === "ongoing") ??
    [...bundle.seasons].sort((left, right) => right.year - left.year)[0];
  const patches = await patchRepository.getManualSourcePatches();
  const snapshotKey = new Date().toISOString().slice(0, 10);
  const preferredByDataset = new Map<string, string>();
  for (const entry of kboSourceRegistry
    .filter((item) => item.enabled)
    .sort((left, right) => left.priority - right.priority)) {
    if (!preferredByDataset.has(entry.datasetId)) {
      preferredByDataset.set(entry.datasetId, `${entry.sourceId}:${entry.datasetId}`);
    }
  }
  const preferredEntryIds = new Set(preferredByDataset.values());

  for (const entry of kboSourceRegistry.filter((item) => item.fixturePath && item.enabled && item.normalizer)) {
    const absoluteFixturePath = path.join(process.cwd(), entry.fixturePath ?? "");
    const html = await fs.readFile(absoluteFixturePath, "utf8");

    await rawRepository.saveSnapshot({
      sourceId: entry.sourceId,
      datasetId: entry.datasetId,
      snapshotKey,
      fetchedAt: new Date().toISOString(),
      sourceUrl: entry.sourceUrl,
      httpStatus: 200,
      checksum: checksumHtml(html),
      parserVersion: entry.parserVersion,
      fixtureBacked: true,
      html,
    });

    const parsed = entry.parser(html) as never;
    if (preferredEntryIds.has(`${entry.sourceId}:${entry.datasetId}`)) {
      const normalized = entry.normalizer!({
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

      const normalizedKey =
        entry.normalizedTarget === "series-games" ||
        entry.normalizedTarget === "scoreboard" ||
        entry.normalizedTarget === "standings" ||
        entry.normalizedTarget === "roster-events"
          ? `${season.year}-${snapshotKey}`
          : snapshotKey;

      await normalizedRepository.saveDatasetOutput(entry.normalizedTarget!, normalizedKey, normalized);
    }
  }

  const publishedBundle = await buildPublishedKboBundleFromNormalized({ allowFixturePublish: true });
  await writePublishedKboBundle(publishedBundle);

  console.log("Refreshed fallback-backed KBO raw snapshots, normalized outputs, and published app bundle.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
