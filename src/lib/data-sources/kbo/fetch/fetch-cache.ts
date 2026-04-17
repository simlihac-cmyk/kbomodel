import crypto from "node:crypto";
import path from "node:path";

import type { DatasetId, SourceId } from "@/lib/data-sources/kbo/dataset-types";

export const DEFAULT_RAW_KBO_ROOT = path.join(process.cwd(), "data", "raw", "kbo");

export function getRawSnapshotPaths(sourceId: SourceId, datasetId: DatasetId, snapshotKey: string) {
  const directory = path.join(DEFAULT_RAW_KBO_ROOT, sourceId, datasetId);
  return {
    directory,
    htmlPath: path.join(directory, `${snapshotKey}.html`),
    metadataPath: path.join(directory, `${snapshotKey}.json`),
  };
}

export function checksumHtml(html: string) {
  return crypto.createHash("sha256").update(html, "utf8").digest("hex");
}
