import { promises as fs } from "node:fs";
import path from "node:path";

import {
  manualSourcePatchBundleSchema,
  type ManualSourcePatchBundle,
} from "@/lib/data-sources/kbo/dataset-types";
import type { KboIngestPatchRepository } from "@/lib/repositories/kbo/contracts";

const PATCH_PATH = path.join(process.cwd(), "data", "manual-patches", "kbo", "source-overrides.json");

export class FileKboIngestPatchRepository implements KboIngestPatchRepository {
  async getManualSourcePatches(): Promise<ManualSourcePatchBundle> {
    const raw = JSON.parse(await fs.readFile(PATCH_PATH, "utf8")) as unknown;
    return manualSourcePatchBundleSchema.parse(raw);
  }
}
