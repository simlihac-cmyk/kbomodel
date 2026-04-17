import fs from "node:fs/promises";
import path from "node:path";

import {
  auditLogBundleSchema,
  importCandidateBundleSchema,
  kboDataBundleSchema,
  manualAdjustmentBundleSchema,
  schedulePatchBundleSchema,
  seasonMetaPatchBundleSchema,
  teamBrandPatchBundleSchema,
} from "@/lib/domain/kbo/schemas";
import { manualSourcePatchBundleSchema as ingestManualSourcePatchBundleSchema } from "@/lib/data-sources/kbo/dataset-types";

async function main() {
  const bundleRaw = JSON.parse(
    await fs.readFile(path.join(process.cwd(), "data", "kbo", "bundle.json"), "utf8"),
  ) as unknown;
  const manualRaw = JSON.parse(
    await fs.readFile(path.join(process.cwd(), "data", "kbo", "manual-adjustments.json"), "utf8"),
  ) as unknown;
  const auditRaw = JSON.parse(
    await fs.readFile(path.join(process.cwd(), "data", "kbo", "audit-log.json"), "utf8"),
  ) as unknown;
  const schedulePatchRaw = JSON.parse(
    await fs.readFile(path.join(process.cwd(), "data", "kbo", "schedule-patches.json"), "utf8"),
  ) as unknown;
  const seasonMetaPatchRaw = JSON.parse(
    await fs.readFile(path.join(process.cwd(), "data", "kbo", "season-meta-patches.json"), "utf8"),
  ) as unknown;
  const teamBrandPatchRaw = JSON.parse(
    await fs.readFile(path.join(process.cwd(), "data", "kbo", "team-brand-patches.json"), "utf8"),
  ) as unknown;
  const importCandidatesRaw = JSON.parse(
    await fs.readFile(path.join(process.cwd(), "data", "kbo", "import-candidates.json"), "utf8"),
  ) as unknown;
  const sourceOverridesRaw = JSON.parse(
    await fs.readFile(path.join(process.cwd(), "data", "manual-patches", "kbo", "source-overrides.json"), "utf8"),
  ) as unknown;
  const publishedBundleRaw = JSON.parse(
    await fs.readFile(
      path.join(process.cwd(), "data", "normalized", "kbo", "app-bundle", "latest.json"),
      "utf8",
    ),
  ) as unknown;

  kboDataBundleSchema.parse(bundleRaw);
  manualAdjustmentBundleSchema.parse(manualRaw);
  auditLogBundleSchema.parse(auditRaw);
  schedulePatchBundleSchema.parse(schedulePatchRaw);
  seasonMetaPatchBundleSchema.parse(seasonMetaPatchRaw);
  teamBrandPatchBundleSchema.parse(teamBrandPatchRaw);
  importCandidateBundleSchema.parse(importCandidatesRaw);
  ingestManualSourcePatchBundleSchema.parse(sourceOverridesRaw);
  kboDataBundleSchema.parse(publishedBundleRaw);

  console.log("KBO data validation passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
