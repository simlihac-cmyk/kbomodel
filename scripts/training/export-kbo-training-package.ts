import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";

import {
  KBO_TRAINING_PACKAGE_ROOT,
  buildTimestampId,
  copyRelativeFiles,
  describeFiles,
  readJsonFile,
  writeJsonFile,
} from "@/lib/training/kbo/transfer";
import { trainingInputPackageManifestSchema } from "@/lib/training/kbo/transfer-types";

const execFileAsync = promisify(execFile);
const HISTORY_TRAINING_ROOT = path.join(process.cwd(), "data", "normalized", "kbo", "history-training");
const TRAINING_CORPUS_ROOT = path.join(process.cwd(), "data", "normalized", "kbo", "training-corpus");

const historyManifestSchema = z.object({
  years: z.array(
    z.object({
      year: z.number().int(),
    }),
  ),
});

const corpusManifestSchema = z.object({
  years: z.array(
    z.object({
      year: z.number().int(),
    }),
  ),
  suggestedSplit: z.object({
    trainYears: z.array(z.number().int()),
    validationYears: z.array(z.number().int()),
  }),
});

type ExportArgs = {
  years: number[] | null;
  packageId: string;
  archive: boolean;
};

function parseArgs(argv: string[]): ExportArgs {
  const yearsFlag = argv.find((arg) => arg.startsWith("--years="));
  const packageId = argv.find((arg) => arg.startsWith("--package-id="))?.split("=")[1] ?? buildTimestampId("kbo-training-input");
  const archive = !argv.includes("--no-archive");

  const years = yearsFlag
    ? yearsFlag
        .split("=")[1]
        .split(",")
        .map((value) => Number.parseInt(value.trim(), 10))
        .filter((value) => Number.isFinite(value))
    : null;

  return {
    years: years ? Array.from(new Set(years)).sort((left, right) => left - right) : null,
    packageId,
    archive,
  };
}

async function maybeRunGit(args: string[]) {
  try {
    const result = await execFileAsync("git", args, { cwd: process.cwd() });
    return result.stdout.trim() || null;
  } catch {
    return null;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rawHistoryManifest = await readJsonFile(path.join(HISTORY_TRAINING_ROOT, "manifest.json"));
  const rawCorpusManifest = await readJsonFile(path.join(TRAINING_CORPUS_ROOT, "manifest.json"));
  const historyManifest = historyManifestSchema.parse(rawHistoryManifest);
  const corpusManifest = corpusManifestSchema.parse(rawCorpusManifest);

  const availableYears = Array.from(
    new Set([
      ...historyManifest.years.map((entry) => entry.year),
      ...corpusManifest.years.map((entry) => entry.year),
    ]),
  ).sort((left, right) => left - right);
  const years = args.years ?? availableYears;

  if (years.length === 0) {
    throw new Error("No years selected for training package export.");
  }

  for (const year of years) {
    if (!availableYears.includes(year)) {
      throw new Error(`Training package export cannot find prepared datasets for ${year}.`);
    }
  }

  const packageRoot = path.join(KBO_TRAINING_PACKAGE_ROOT, args.packageId);
  const inputRoot = path.join(packageRoot, "inputs");
  await fs.rm(packageRoot, { recursive: true, force: true });
  await fs.mkdir(inputRoot, { recursive: true });

  const historyFiles = ["manifest.json", ...years.map((year) => `${year}.json`)];
  const corpusFiles = ["manifest.json", ...years.map((year) => `${year}.json`)];

  await copyRelativeFiles(HISTORY_TRAINING_ROOT, path.join(inputRoot, "history-training"), historyFiles);
  await copyRelativeFiles(TRAINING_CORPUS_ROOT, path.join(inputRoot, "training-corpus"), corpusFiles);

  const packageFiles = await describeFiles(packageRoot, await (async () => {
    const historyRelativePaths = historyFiles.map((file) => path.join("inputs", "history-training", file));
    const corpusRelativePaths = corpusFiles.map((file) => path.join("inputs", "training-corpus", file));
    return [...historyRelativePaths, ...corpusRelativePaths];
  })());

  const manifest = trainingInputPackageManifestSchema.parse({
    manifestType: "training-input-package",
    packageId: args.packageId,
    generatedAt: new Date().toISOString(),
    gitCommit: await maybeRunGit(["rev-parse", "HEAD"]),
    gitBranch: await maybeRunGit(["rev-parse", "--abbrev-ref", "HEAD"]),
    nodeVersion: process.version,
    packageManager: "pnpm",
    years,
    suggestedSplit: {
      trainYears: corpusManifest.suggestedSplit.trainYears.filter((year) => years.includes(year)),
      validationYears: corpusManifest.suggestedSplit.validationYears.filter((year) => years.includes(year)),
    },
    sourcePaths: {
      historyTrainingRoot: HISTORY_TRAINING_ROOT,
      trainingCorpusRoot: TRAINING_CORPUS_ROOT,
    },
    files: packageFiles,
  });

  await writeJsonFile(path.join(packageRoot, "manifest.json"), manifest);

  let archivePath: string | null = null;
  if (args.archive) {
    archivePath = path.join(KBO_TRAINING_PACKAGE_ROOT, `${args.packageId}.tar.gz`);
    await fs.rm(archivePath, { force: true });
    await execFileAsync("tar", ["-czf", archivePath, "-C", KBO_TRAINING_PACKAGE_ROOT, args.packageId]);
  }

  console.log(`[training-export] package -> ${packageRoot}`);
  if (archivePath) {
    console.log(`[training-export] archive -> ${archivePath}`);
  }
  console.log(`[training-export] years -> ${years.join(", ")}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
