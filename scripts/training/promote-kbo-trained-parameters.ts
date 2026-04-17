import { promises as fs } from "node:fs";
import path from "node:path";

import { gameModelParameterArtifactSchema } from "@/lib/training/kbo/model-types";

const DEFAULT_SOURCE = path.join(
  process.cwd(),
  "trained-results",
  "kbo-training-fit-20260417T053534Z",
  "parameters.json",
);
const OUTPUT_PATH = path.join(
  process.cwd(),
  "src",
  "lib",
  "sim",
  "kbo",
  "current-model-parameters.ts",
);

function parseArgs(argv: string[]) {
  return {
    from:
      argv.find((arg) => arg.startsWith("--from="))?.split("=")[1] ??
      DEFAULT_SOURCE,
  };
}

function formatArray(values: number[]) {
  return `[${values.join(", ")}]`;
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? `${value}` : `${value}`;
}

function buildModuleSource(parametersPath: string, artifact: ReturnType<typeof gameModelParameterArtifactSchema.parse>) {
  const fitted = artifact.fittedParameters;
  const sourcePath = path.relative(process.cwd(), parametersPath).split(path.sep).join("/");

  return `import { gameModelParameterSetSchema, type GameModelParameterSet } from "@/lib/sim/kbo/model-parameters";

export const CURRENT_GAME_MODEL_PARAMETERS_SOURCE = {
  trainedAt: "${artifact.trainedAt}",
  fitYears: ${formatArray(artifact.fitYears)},
  tuneYears: ${formatArray(artifact.tuneYears)},
  validationYears: ${formatArray(artifact.validationYears)},
  sourcePath: "${sourcePath}",
} as const;

export const CURRENT_GAME_MODEL_PARAMETERS: GameModelParameterSet = gameModelParameterSetSchema.parse({
  leagueRunEnvironment: ${formatNumber(fitted.leagueRunEnvironment)},
  awayRunEnvironmentOffset: ${formatNumber(fitted.awayRunEnvironmentOffset)},
  offenseWeight: ${formatNumber(fitted.offenseWeight)},
  starterWeight: ${formatNumber(fitted.starterWeight)},
  bullpenWeight: ${formatNumber(fitted.bullpenWeight)},
  recentFormWeight: ${formatNumber(fitted.recentFormWeight)},
  homeFieldWeightHome: ${formatNumber(fitted.homeFieldWeightHome)},
  homeFieldWeightAway: ${formatNumber(fitted.homeFieldWeightAway)},
  confidenceBase: ${formatNumber(fitted.confidenceBase)},
  confidenceScale: ${formatNumber(fitted.confidenceScale)},
  tieCarryRate: ${formatNumber(fitted.tieCarryRate)},
  minTieProbability: ${formatNumber(fitted.minTieProbability)},
  maxTieProbability: ${formatNumber(fitted.maxTieProbability)},
});
`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const raw = JSON.parse(await fs.readFile(args.from, "utf8")) as unknown;
  const artifact = gameModelParameterArtifactSchema.parse(raw);
  const source = buildModuleSource(args.from, artifact);

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, source, "utf8");

  console.log(`[training-promote] source -> ${args.from}`);
  console.log(`[training-promote] output -> ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
