import { promises as fs } from "node:fs";
import path from "node:path";

import {
  KBO_IMPORTED_MODEL_ROOT,
  describeFile,
  readJsonFile,
  writeJsonFile,
} from "@/lib/training/kbo/transfer";
import {
  importedTrainingBundleRegistrySchema,
  trainingResultBundleManifestSchema,
} from "@/lib/training/kbo/transfer-types";

type ImportArgs = {
  sourceDir: string;
  force: boolean;
};

function parseArgs(argv: string[]): ImportArgs {
  const sourceDir = argv.find((arg) => arg.startsWith("--from="))?.split("=")[1];
  if (!sourceDir) {
    throw new Error("Missing --from=/absolute/or/relative/path/to/results-dir");
  }

  return {
    sourceDir,
    force: argv.includes("--force"),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifestPath = path.join(args.sourceDir, "manifest.json");
  const manifest = trainingResultBundleManifestSchema.parse(await readJsonFile(manifestPath));

  for (const file of manifest.files) {
    const actual = await describeFile(args.sourceDir, file.relativePath);
    if (actual.bytes !== file.bytes || actual.sha256 !== file.sha256) {
      throw new Error(`Checksum mismatch for ${file.relativePath}`);
    }
  }

  const bundlesRoot = path.join(KBO_IMPORTED_MODEL_ROOT, "bundles");
  const destinationRoot = path.join(bundlesRoot, manifest.bundleId);
  if (!args.force) {
    try {
      await fs.access(destinationRoot);
      throw new Error(`Imported bundle already exists at ${destinationRoot}. Use --force to overwrite.`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  await fs.rm(destinationRoot, { recursive: true, force: true });
  await fs.mkdir(bundlesRoot, { recursive: true });
  await fs.cp(args.sourceDir, destinationRoot, { recursive: true });

  const registryPath = path.join(KBO_IMPORTED_MODEL_ROOT, "registry.json");
  const nextEntry = {
    bundleId: manifest.bundleId,
    importedAt: new Date().toISOString(),
    sourcePackageId: manifest.sourcePackageId,
    sourceGitCommit: manifest.sourceGitCommit,
    trainYears: manifest.trainYears,
    validationYears: manifest.validationYears,
    bundlePath: destinationRoot,
    manifestPath: path.join(destinationRoot, "manifest.json"),
  };

  const currentRegistry = await (async () => {
    try {
      return importedTrainingBundleRegistrySchema.parse(await readJsonFile(registryPath));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return importedTrainingBundleRegistrySchema.parse({
          manifestType: "training-result-registry",
          generatedAt: new Date().toISOString(),
          latestBundleId: null,
          bundles: [],
        });
      }
      throw error;
    }
  })();

  const nextRegistry = importedTrainingBundleRegistrySchema.parse({
    manifestType: "training-result-registry",
    generatedAt: new Date().toISOString(),
    latestBundleId: manifest.bundleId,
    bundles: [
      nextEntry,
      ...currentRegistry.bundles.filter((entry) => entry.bundleId !== manifest.bundleId),
    ].sort((left, right) => right.importedAt.localeCompare(left.importedAt)),
  });

  await writeJsonFile(registryPath, nextRegistry);
  await writeJsonFile(path.join(KBO_IMPORTED_MODEL_ROOT, "latest.json"), nextEntry);

  console.log(`[training-import] bundle -> ${destinationRoot}`);
  console.log(`[training-import] registry -> ${registryPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
