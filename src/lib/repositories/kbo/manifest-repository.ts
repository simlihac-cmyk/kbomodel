import { promises as fs } from "node:fs";
import path from "node:path";

import {
  publishDatasetNameSchema,
  publishManifestSchema,
  type PublishDatasetName,
  type PublishManifest,
} from "@/lib/publish/contracts";

const DEFAULT_BASE_ROOT = path.join(process.cwd(), "data", "normalized", "kbo");

type FileKboManifestRepositoryOptions = {
  baseRoot?: string;
};

export class FileKboManifestRepository {
  constructor(private readonly options: FileKboManifestRepositoryOptions = {}) {}

  private get baseRoot() {
    return this.options.baseRoot ?? process.env.INGEST_PUBLISH_FILE_ROOT ?? DEFAULT_BASE_ROOT;
  }

  private getManifestPath(name: "current" | "today" | "simulation") {
    return path.join(this.baseRoot, "manifests", `${name}.json`);
  }

  private getDatasetPath(name: PublishDatasetName) {
    return path.join(this.baseRoot, "publish", `${name}.json`);
  }

  async saveManifest(manifest: PublishManifest) {
    const parsed = publishManifestSchema.parse(manifest);
    const name = parsed.manifestType;
    const filePath = this.getManifestPath(name);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
  }

  async getManifest(name: "current" | "today" | "simulation") {
    try {
      const raw = JSON.parse(await fs.readFile(this.getManifestPath(name), "utf8")) as unknown;
      return publishManifestSchema.parse(raw);
    } catch {
      return null;
    }
  }

  async savePublishedDataset(name: PublishDatasetName, payload: unknown) {
    publishDatasetNameSchema.parse(name);
    const filePath = this.getDatasetPath(name);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  }

  async getPublishedDataset(name: PublishDatasetName) {
    publishDatasetNameSchema.parse(name);
    try {
      return JSON.parse(await fs.readFile(this.getDatasetPath(name), "utf8")) as unknown;
    } catch {
      return null;
    }
  }

  getStorageRoot() {
    return this.baseRoot;
  }
}
