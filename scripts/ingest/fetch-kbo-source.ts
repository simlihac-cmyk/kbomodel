import { promises as fs } from "node:fs";
import path from "node:path";

import { kboSourceRegistry } from "@/lib/data-sources/kbo/source-registry";
import { FileRawSourceRepository } from "@/lib/repositories/kbo/raw-source-repository";
import { checksumHtml } from "@/lib/data-sources/kbo/fetch/fetch-cache";
import { datasetIdSchema, type DatasetId } from "@/lib/data-sources/kbo/dataset-types";
import { fetchSnapshotForKboDataset } from "@/lib/data-sources/kbo/fetch/fetch-source-snapshot";
import { getKboDateKey } from "@/lib/scheduler/kbo/windows";

async function main() {
  const datasetId = datasetIdSchema.parse(process.argv[2]) as DatasetId;
  const fixtureMode = process.argv.includes("--fixture");
  const entry = kboSourceRegistry
    .filter((item) => item.datasetId === datasetId && item.enabled)
    .sort((left, right) => left.priority - right.priority)[0];

  if (!entry) {
    throw new Error(`No enabled source registry entry found for ${datasetId}`);
  }

  const snapshotKey = getKboDateKey();
  const repository = new FileRawSourceRepository();

  if (fixtureMode) {
    if (!entry.fixturePath) {
      throw new Error(`Dataset ${datasetId} does not have a fixture path.`);
    }
    const absoluteFixturePath = path.join(process.cwd(), entry.fixturePath);
    const html = await fs.readFile(absoluteFixturePath, "utf8");
    await repository.saveSnapshot({
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
    console.log(`Saved fixture-backed snapshot for ${entry.sourceId}/${datasetId} -> ${snapshotKey}`);
    return;
  }

  const result = await fetchSnapshotForKboDataset(datasetId, entry.sourceUrl);
  await repository.saveSnapshot({
    sourceId: entry.sourceId,
    datasetId: entry.datasetId,
    snapshotKey,
    fetchedAt: result.fetchedAt,
    sourceUrl: result.sourceUrl,
    httpStatus: result.httpStatus,
    checksum: result.checksum,
    parserVersion: entry.parserVersion,
    fixtureBacked: false,
    html: result.html,
  });
  console.log(`Fetched ${entry.sourceId}/${datasetId} -> ${snapshotKey}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
