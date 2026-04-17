import { promises as fs } from "node:fs";
import path from "node:path";

import { buildTrainingCorpusBundle, buildTrainingCorpusSeason } from "@/lib/data-sources/kbo/derive/build-training-corpus";
import { historyTrainingSeasonSchema } from "@/lib/data-sources/kbo/history-training-types";

const DEFAULT_START_YEAR = 2021;
const DEFAULT_END_YEAR = 2025;
const HISTORY_TRAINING_ROOT = path.join(process.cwd(), "data", "normalized", "kbo", "history-training");
const OUTPUT_ROOT = path.join(process.cwd(), "data", "normalized", "kbo", "training-corpus");

type BuildArgs = {
  years: number[];
};

function parseArgs(argv: string[]): BuildArgs {
  const yearsFlag = argv.find((arg) => arg.startsWith("--years="));
  const startYear = Number.parseInt(
    argv.find((arg) => arg.startsWith("--start-year="))?.split("=")[1] ?? `${DEFAULT_START_YEAR}`,
    10,
  );
  const endYear = Number.parseInt(
    argv.find((arg) => arg.startsWith("--end-year="))?.split("=")[1] ?? `${DEFAULT_END_YEAR}`,
    10,
  );

  const years = yearsFlag
    ? yearsFlag
        .split("=")[1]
        .split(",")
        .map((value) => Number.parseInt(value.trim(), 10))
        .filter((value) => Number.isFinite(value))
    : Array.from({ length: endYear - startYear + 1 }, (_, index) => startYear + index);

  return {
    years: Array.from(new Set(years)).sort((left, right) => left - right),
  };
}

async function loadHistoryTrainingSeason(year: number) {
  const filePath = path.join(HISTORY_TRAINING_ROOT, `${year}.json`);
  const raw = JSON.parse(await fs.readFile(filePath, "utf8")) as unknown;
  return historyTrainingSeasonSchema.parse(raw);
}

async function writeJsonFile(filePath: string, payload: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.years.length === 0) {
    throw new Error("No years selected for training corpus build.");
  }

  const seasons = await Promise.all(args.years.map((year) => loadHistoryTrainingSeason(year)));
  const seasonCorpora = seasons.map((season) => buildTrainingCorpusSeason(season));

  for (const seasonCorpus of seasonCorpora) {
    const filePath = path.join(OUTPUT_ROOT, `${seasonCorpus.year}.json`);
    await writeJsonFile(filePath, seasonCorpus);
    console.log(
      `[training-corpus] ${seasonCorpus.year} teams=${seasonCorpus.teamExampleCount} games=${seasonCorpus.gameExampleCount}`,
    );
  }

  const bundle = buildTrainingCorpusBundle(seasons);
  await writeJsonFile(path.join(OUTPUT_ROOT, "all.json"), bundle);

  const latestYear = args.years.at(-1) ?? DEFAULT_END_YEAR;
  const manifest = {
    generatedAt: new Date().toISOString(),
    years: seasonCorpora.map((seasonCorpus) => ({
      year: seasonCorpus.year,
      output: path.join(OUTPUT_ROOT, `${seasonCorpus.year}.json`),
      teamExampleCount: seasonCorpus.teamExampleCount,
      gameExampleCount: seasonCorpus.gameExampleCount,
    })),
    combinedOutput: path.join(OUTPUT_ROOT, "all.json"),
    suggestedSplit: {
      trainYears: args.years.filter((year) => year !== latestYear),
      validationYears: [latestYear],
    },
  };
  await writeJsonFile(path.join(OUTPUT_ROOT, "manifest.json"), manifest);
  console.log(`[training-corpus] all teams=${bundle.teamExampleCount} games=${bundle.gameExampleCount}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
