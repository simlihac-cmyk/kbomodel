import { promises as fs } from "node:fs";

import { getRawSnapshotPaths } from "@/lib/data-sources/kbo/fetch/fetch-cache";
import {
  rawSourceSnapshotMetadataSchema,
  rawSourceSnapshotSchema,
  type DatasetId,
  type RawSourceSnapshot,
  type RawSourceSnapshotMetadata,
  type SourceId,
} from "@/lib/data-sources/kbo/dataset-types";
import type { RawSourceRepository } from "@/lib/repositories/kbo/contracts";

export class FileRawSourceRepository implements RawSourceRepository {
  async saveSnapshot(snapshot: RawSourceSnapshot) {
    const normalized = rawSourceSnapshotSchema.parse(snapshot);
    const { directory, htmlPath, metadataPath } = getRawSnapshotPaths(
      normalized.sourceId,
      normalized.datasetId,
      normalized.snapshotKey,
    );
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(htmlPath, normalized.html, "utf8");
    const metadata = {
      sourceId: normalized.sourceId,
      datasetId: normalized.datasetId,
      snapshotKey: normalized.snapshotKey,
      fetchedAt: normalized.fetchedAt,
      sourceUrl: normalized.sourceUrl,
      httpStatus: normalized.httpStatus,
      checksum: normalized.checksum,
      parserVersion: normalized.parserVersion,
      fixtureBacked: normalized.fixtureBacked,
    };
    await fs.writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
    return rawSourceSnapshotMetadataSchema.parse(metadata);
  }

  async getSnapshot(sourceId: SourceId, datasetId: DatasetId, snapshotKey: string) {
    const { htmlPath, metadataPath } = getRawSnapshotPaths(sourceId, datasetId, snapshotKey);
    try {
      const [html, metadataText] = await Promise.all([
        fs.readFile(htmlPath, "utf8"),
        fs.readFile(metadataPath, "utf8"),
      ]);
      const metadata = rawSourceSnapshotMetadataSchema.parse(JSON.parse(metadataText) as unknown);
      return rawSourceSnapshotSchema.parse({
        ...metadata,
        html,
      });
    } catch {
      return null;
    }
  }

  async getLatestSnapshot(sourceId: SourceId, datasetId: DatasetId) {
    const items = await this.listSnapshotMetadata(sourceId, datasetId);
    const latest = items.sort((left, right) => right.snapshotKey.localeCompare(left.snapshotKey))[0];
    if (!latest) {
      return null;
    }
    return this.getSnapshot(sourceId, datasetId, latest.snapshotKey);
  }

  async listSnapshotMetadata(sourceId: SourceId, datasetId: DatasetId) {
    const { directory } = getRawSnapshotPaths(sourceId, datasetId, "placeholder");
    try {
      const files = await fs.readdir(directory);
      const metadataFiles = files.filter((file) => file.endsWith(".json"));
      const metadata = await Promise.all(
        metadataFiles.map(async (fileName) =>
          rawSourceSnapshotMetadataSchema.parse(
            JSON.parse(await fs.readFile(`${directory}/${fileName}`, "utf8")) as unknown,
          ),
        ),
      );
      return metadata.sort((left, right) => left.snapshotKey.localeCompare(right.snapshotKey));
    } catch {
      return [] satisfies RawSourceSnapshotMetadata[];
    }
  }
}
