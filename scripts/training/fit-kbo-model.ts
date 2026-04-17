import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";

import { trainingCorpusSeasonSchema } from "@/lib/data-sources/kbo/training-corpus-types";
import {
  fitGameModelParameters,
} from "@/lib/training/kbo/game-model-fit";
import {
  KBO_TRAINING_RESULT_ROOT,
  buildTimestampId,
  writeJsonFile,
} from "@/lib/training/kbo/transfer";
import {
  gameModelBacktestSummarySchema,
  gameModelParameterArtifactSchema,
} from "@/lib/training/kbo/model-types";

const TRAINING_CORPUS_ROOT = path.join(process.cwd(), "data", "normalized", "kbo", "training-corpus");

const trainingCorpusManifestSchema = z.object({
  suggestedSplit: z.object({
    trainYears: z.array(z.number().int()),
    validationYears: z.array(z.number().int()),
  }),
});

type FitArgs = {
  corpusRoot: string;
  outputDir: string;
  trainYears: number[] | null;
  validationYears: number[] | null;
  maxRounds: number;
};

function parseArgs(argv: string[]): FitArgs {
  const readYears = (flag: string) =>
    argv
      .find((arg) => arg.startsWith(`${flag}=`))
      ?.split("=")[1]
      .split(",")
      .map((value) => Number.parseInt(value.trim(), 10))
      .filter((value) => Number.isFinite(value)) ?? null;

  const outputDir =
    argv.find((arg) => arg.startsWith("--output-dir="))?.split("=")[1] ??
    path.join(KBO_TRAINING_RESULT_ROOT, buildTimestampId("kbo-training-fit"));

  return {
    corpusRoot:
      argv.find((arg) => arg.startsWith("--corpus-root="))?.split("=")[1] ??
      TRAINING_CORPUS_ROOT,
    outputDir,
    trainYears: readYears("--train-years"),
    validationYears: readYears("--validation-years"),
    maxRounds: Number.parseInt(
      argv.find((arg) => arg.startsWith("--max-rounds="))?.split("=")[1] ?? "7",
      10,
    ),
  };
}

async function loadTrainingCorpusSeason(corpusRoot: string, year: number) {
  const filePath = path.join(corpusRoot, `${year}.json`);
  const raw = JSON.parse(await fs.readFile(filePath, "utf8")) as unknown;
  return trainingCorpusSeasonSchema.parse(raw);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifest = trainingCorpusManifestSchema.parse(
    JSON.parse(await fs.readFile(path.join(args.corpusRoot, "manifest.json"), "utf8")) as unknown,
  );
  const trainYears = args.trainYears ?? manifest.suggestedSplit.trainYears;
  const validationYears = args.validationYears ?? manifest.suggestedSplit.validationYears;

  if (trainYears.length === 0) {
    throw new Error("training:kbo:fit requires at least one train year.");
  }

  const selectedYears = Array.from(new Set([...trainYears, ...validationYears])).sort((left, right) => left - right);
  const seasons = await Promise.all(selectedYears.map((year) => loadTrainingCorpusSeason(args.corpusRoot, year)));
  const examplesByYear = Object.fromEntries(
    seasons.map((season) => [season.year, season.gameExamples]),
  ) as Record<number, (typeof seasons)[number]["gameExamples"]>;

  const result = fitGameModelParameters(examplesByYear, trainYears, validationYears, {
    maxRounds: args.maxRounds,
  });
  const parameters = gameModelParameterArtifactSchema.parse(result.artifact);
  const backtest = gameModelBacktestSummarySchema.parse(result.backtest);

  await fs.mkdir(args.outputDir, { recursive: true });
  await writeJsonFile(path.join(args.outputDir, "parameters.json"), parameters);
  await writeJsonFile(path.join(args.outputDir, "backtest-summary.json"), backtest);

  console.log(`[training-fit] output -> ${args.outputDir}`);
  console.log(`[training-fit] fit years -> ${parameters.fitYears.join(", ")}`);
  console.log(`[training-fit] tune years -> ${parameters.tuneYears.join(", ") || "-"}`);
  console.log(`[training-fit] validation years -> ${parameters.validationYears.join(", ") || "-"}`);
  console.log(
    `[training-fit] baseline validation logLoss -> ${backtest.baseline.validation?.logLoss ?? "n/a"}`,
  );
  console.log(
    `[training-fit] fitted validation logLoss -> ${backtest.fitted.validation?.logLoss ?? "n/a"}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
