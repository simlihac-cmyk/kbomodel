import os from "node:os";
import path from "node:path";

import {
  buildTimestampId,
  collectRelativeFiles,
  describeFiles,
  inferTrainingResultFileKind,
  readJsonFile,
  writeJsonFile,
} from "@/lib/training/kbo/transfer";
import { trainingInputPackageManifestSchema, trainingResultBundleManifestSchema } from "@/lib/training/kbo/transfer-types";

type PackArgs = {
  sourcePackageManifestPath: string;
  resultsDir: string;
  bundleId: string;
  trainYears: number[] | null;
  validationYears: number[] | null;
};

function parseArgs(argv: string[]): PackArgs {
  const sourcePackageManifestPath = argv.find((arg) => arg.startsWith("--source-package="))?.split("=")[1];
  const resultsDir = argv.find((arg) => arg.startsWith("--results-dir="))?.split("=")[1];
  const bundleId = argv.find((arg) => arg.startsWith("--bundle-id="))?.split("=")[1] ?? buildTimestampId("kbo-training-result");
  const trainYearsFlag = argv.find((arg) => arg.startsWith("--train-years="));
  const validationYearsFlag = argv.find((arg) => arg.startsWith("--validation-years="));

  if (!sourcePackageManifestPath) {
    throw new Error("Missing --source-package=/absolute/or/relative/path/to/manifest.json");
  }
  if (!resultsDir) {
    throw new Error("Missing --results-dir=/absolute/or/relative/path/to/results");
  }

  const parseYearList = (value: string | undefined) =>
    value
      ? value
          .split(",")
          .map((entry) => Number.parseInt(entry.trim(), 10))
          .filter((entry) => Number.isFinite(entry))
      : null;

  return {
    sourcePackageManifestPath,
    resultsDir,
    bundleId,
    trainYears: parseYearList(trainYearsFlag?.split("=")[1]),
    validationYears: parseYearList(validationYearsFlag?.split("=")[1]),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sourceManifest = trainingInputPackageManifestSchema.parse(await readJsonFile(args.sourcePackageManifestPath));
  const relativeFiles = (await collectRelativeFiles(args.resultsDir)).filter((relativePath) => relativePath !== "manifest.json");

  if (!relativeFiles.includes("parameters.json")) {
    throw new Error(`Training result bundle at ${args.resultsDir} must include parameters.json`);
  }
  if (!relativeFiles.includes("backtest-summary.json")) {
    throw new Error(`Training result bundle at ${args.resultsDir} must include backtest-summary.json`);
  }

  const files = (await describeFiles(args.resultsDir, relativeFiles)).map((file) => ({
    ...file,
    kind: inferTrainingResultFileKind(file.relativePath),
  }));

  const manifest = trainingResultBundleManifestSchema.parse({
    manifestType: "training-result-bundle",
    bundleId: args.bundleId,
    createdAt: new Date().toISOString(),
    sourcePackageId: sourceManifest.packageId,
    sourceGitCommit: sourceManifest.gitCommit,
    trainYears: args.trainYears ?? sourceManifest.suggestedSplit.trainYears,
    validationYears: args.validationYears ?? sourceManifest.suggestedSplit.validationYears,
    trainer: {
      machineLabel: os.hostname(),
      nodeVersion: process.version,
    },
    files,
  });

  await writeJsonFile(path.join(args.resultsDir, "manifest.json"), manifest);
  console.log(`[training-results] manifest -> ${path.join(args.resultsDir, "manifest.json")}`);
  console.log(`[training-results] bundle -> ${args.bundleId}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
