import { promises as fs } from "node:fs";
import path from "node:path";

import {
  gameModelParameterArtifactSchema,
  runtimeModelParameterArtifactSchema,
} from "@/lib/training/kbo/model-types";

const DEFAULT_SOURCE = path.join(
  process.cwd(),
  "trained-results",
  "kbo-training-fit-20260417T053534Z",
  "parameters.json",
);
const OUTPUT_GAME_PATH = path.join(
  process.cwd(),
  "src",
  "lib",
  "sim",
  "kbo",
  "current-model-parameters.ts",
);
const OUTPUT_STRENGTH_PATH = path.join(
  process.cwd(),
  "src",
  "lib",
  "sim",
  "kbo",
  "current-strength-model-parameters.ts",
);
const OUTPUT_CONTEXTUAL_PATH = path.join(
  process.cwd(),
  "src",
  "lib",
  "sim",
  "kbo",
  "current-probability-adjustment-parameters.ts",
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

function formatWeightObject(values: Record<string, number>) {
  return `{\n${Object.entries(values)
    .map(([key, value]) => `    ${key}: ${formatNumber(value)},`)
    .join("\n")}\n  }`;
}

function buildGameModuleSource(
  parametersPath: string,
  artifact:
    | ReturnType<typeof gameModelParameterArtifactSchema.parse>
    | ReturnType<typeof runtimeModelParameterArtifactSchema.parse>,
) {
  const fitted = artifact.manifestType === "kbo-runtime-model-parameters"
    ? artifact.fittedParameters.game
    : artifact.fittedParameters;
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

function buildStrengthModuleSource(
  parametersPath: string,
  artifact: ReturnType<typeof runtimeModelParameterArtifactSchema.parse>,
) {
  const fitted = artifact.fittedParameters.strength;
  const sourcePath = path.relative(process.cwd(), parametersPath).split(path.sep).join("/");

  return `import {
  strengthModelParameterSetSchema,
  type StrengthModelParameterSet,
} from "@/lib/sim/kbo/strength-model-parameters";

export const CURRENT_STRENGTH_MODEL_PARAMETERS_SOURCE = {
  trainedAt: "${artifact.trainedAt}",
  fitYears: ${formatArray(artifact.fitYears)},
  tuneYears: ${formatArray(artifact.tuneYears)},
  validationYears: ${formatArray(artifact.validationYears)},
  sourcePath: "${sourcePath}",
} as const;

export const CURRENT_STRENGTH_MODEL_PARAMETERS: StrengthModelParameterSet = strengthModelParameterSetSchema.parse({
  currentWeightProgressExponent: ${formatNumber(fitted.currentWeightProgressExponent)},
  currentWeightProgressMix: ${formatNumber(fitted.currentWeightProgressMix)},
  currentWeightShrinkageMultiplier: ${formatNumber(fitted.currentWeightShrinkageMultiplier)},
  currentWeightOpponentPriorPctWeight: ${formatNumber(fitted.currentWeightOpponentPriorPctWeight)},
  currentWeightMin: ${formatNumber(fitted.currentWeightMin)},
  currentWeightMax: ${formatNumber(fitted.currentWeightMax)},
  offenseRunsWeight: ${formatNumber(fitted.offenseRunsWeight)},
  offenseRunDiffWeight: ${formatNumber(fitted.offenseRunDiffWeight)},
  offenseRecentWeight: ${formatNumber(fitted.offenseRecentWeight)},
  runPreventionRunsAllowedWeight: ${formatNumber(fitted.runPreventionRunsAllowedWeight)},
  runPreventionRunDiffWeight: ${formatNumber(fitted.runPreventionRunDiffWeight)},
  runPreventionWinPctWeight: ${formatNumber(fitted.runPreventionWinPctWeight)},
  bullpenRunsAllowedWeight: ${formatNumber(fitted.bullpenRunsAllowedWeight)},
  bullpenRecentWeight: ${formatNumber(fitted.bullpenRecentWeight)},
  bullpenStreakWeight: ${formatNumber(fitted.bullpenStreakWeight)},
  homeFieldSplitWeight: ${formatNumber(fitted.homeFieldSplitWeight)},
  homeFieldMin: ${formatNumber(fitted.homeFieldMin)},
  homeFieldMax: ${formatNumber(fitted.homeFieldMax)},
  recentFormWinRateWeight: ${formatNumber(fitted.recentFormWinRateWeight)},
  recentFormStreakWeight: ${formatNumber(fitted.recentFormStreakWeight)},
  confidenceBase: ${formatNumber(fitted.confidenceBase)},
  confidenceCurrentWeightWeight: ${formatNumber(fitted.confidenceCurrentWeightWeight)},
  confidenceRunDiffWeight: ${formatNumber(fitted.confidenceRunDiffWeight)},
  confidenceRunDiffCap: ${formatNumber(fitted.confidenceRunDiffCap)},
  confidenceMin: ${formatNumber(fitted.confidenceMin)},
  confidenceMax: ${formatNumber(fitted.confidenceMax)},
});
`;
}

function buildContextualModuleSource(
  parametersPath: string,
  artifact: ReturnType<typeof runtimeModelParameterArtifactSchema.parse>,
) {
  const fitted = artifact.fittedParameters.contextual;
  const sourcePath = path.relative(process.cwd(), parametersPath).split(path.sep).join("/");

  return `import {
  probabilityAdjustmentParameterSetSchema,
  type ProbabilityAdjustmentParameterSet,
} from "@/lib/sim/kbo/probability-adjustment-parameters";

export const CURRENT_PROBABILITY_ADJUSTMENT_PARAMETERS_SOURCE = {
  trainedAt: "${artifact.trainedAt}",
  fitYears: ${formatArray(artifact.fitYears)},
  tuneYears: ${formatArray(artifact.tuneYears)},
  validationYears: ${formatArray(artifact.validationYears)},
  sourcePath: "${sourcePath}",
} as const;

export const CURRENT_PROBABILITY_ADJUSTMENT_PARAMETERS: ProbabilityAdjustmentParameterSet =
  probabilityAdjustmentParameterSetSchema.parse({
    homeBias: ${formatNumber(fitted.homeBias)},
    awayBias: ${formatNumber(fitted.awayBias)},
    tieBias: ${formatNumber(fitted.tieBias)},
    homeWeights: ${formatWeightObject(fitted.homeWeights)},
    awayWeights: ${formatWeightObject(fitted.awayWeights)},
    tieWeights: ${formatWeightObject(fitted.tieWeights)},
  });
`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const raw = JSON.parse(await fs.readFile(args.from, "utf8")) as unknown;
  const artifact =
    raw && typeof raw === "object" && "manifestType" in raw && raw.manifestType === "kbo-runtime-model-parameters"
      ? runtimeModelParameterArtifactSchema.parse(raw)
      : gameModelParameterArtifactSchema.parse(raw);
  const gameSource = buildGameModuleSource(args.from, artifact);

  await fs.mkdir(path.dirname(OUTPUT_GAME_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_GAME_PATH, gameSource, "utf8");

  if (artifact.manifestType === "kbo-runtime-model-parameters") {
    const strengthSource = buildStrengthModuleSource(args.from, artifact);
    const contextualSource = buildContextualModuleSource(args.from, artifact);
    await fs.writeFile(OUTPUT_STRENGTH_PATH, strengthSource, "utf8");
    await fs.writeFile(OUTPUT_CONTEXTUAL_PATH, contextualSource, "utf8");
  }

  console.log(`[training-promote] source -> ${args.from}`);
  console.log(`[training-promote] game output -> ${OUTPUT_GAME_PATH}`);
  if (artifact.manifestType === "kbo-runtime-model-parameters") {
    console.log(`[training-promote] strength output -> ${OUTPUT_STRENGTH_PATH}`);
    console.log(`[training-promote] contextual output -> ${OUTPUT_CONTEXTUAL_PATH}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
