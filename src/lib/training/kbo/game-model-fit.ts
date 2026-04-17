import type { TeamStrengthSnapshot } from "@/lib/domain/kbo/types";
import type { GameOutcomeTrainingExample } from "@/lib/data-sources/kbo/training-corpus-types";
import {
  buildGameProbabilityCoreSnapshot,
} from "@/lib/sim/kbo/probabilities";
import {
  buildProbabilityAdjustmentFeaturesFromTrainingExample,
  type ProbabilityAdjustmentFeatureVector,
} from "@/lib/sim/kbo/probability-adjustment";
import {
  DEFAULT_GAME_MODEL_PARAMETERS,
  gameModelParameterSetSchema,
  type GameModelParameterSet,
} from "@/lib/sim/kbo/model-parameters";
import type {
  CalibrationBucket,
  GameModelBacktestSummary,
  GameModelParameterArtifact,
  GamePredictionCalibration,
  GamePredictionMetrics,
} from "@/lib/training/kbo/model-types";

export type PreparedGameExample = {
  sampleId: string;
  year: number;
  seasonProgress: number;
  homeStrength: TeamStrengthSnapshot;
  awayStrength: TeamStrengthSnapshot;
  adjustmentFeatures: ProbabilityAdjustmentFeatureVector;
  actualIndex: 0 | 1 | 2;
  actualHomeWin: number;
  actualAwayWin: number;
  actualTie: number;
};

type EvaluationResult = {
  fit: GamePredictionMetrics;
  tune: GamePredictionMetrics | null;
  validation: GamePredictionMetrics | null;
  selectionScore: number;
};

type TunableKey = keyof GameModelParameterSet;

type ParameterSpec = {
  key: TunableKey;
  min: number;
  max: number;
  step: number;
  decay: number;
};

type FitOptions = {
  maxRounds?: number;
  initial?: GameModelParameterSet;
};

type FitResult = {
  artifact: GameModelParameterArtifact;
  backtest: GameModelBacktestSummary;
};

const PARAMETER_SPECS: ParameterSpec[] = [
  { key: "leagueRunEnvironment", min: 3.8, max: 5.2, step: 0.08, decay: 0.58 },
  { key: "awayRunEnvironmentOffset", min: 0, max: 0.35, step: 0.02, decay: 0.58 },
  { key: "offenseWeight", min: 0.004, max: 0.02, step: 0.001, decay: 0.62 },
  { key: "starterWeight", min: 0.003, max: 0.016, step: 0.0008, decay: 0.62 },
  { key: "bullpenWeight", min: 0.001, max: 0.01, step: 0.0006, decay: 0.62 },
  { key: "recentFormWeight", min: 0.02, max: 0.8, step: 0.04, decay: 0.65 },
  { key: "homeFieldWeightHome", min: 0, max: 0.45, step: 0.03, decay: 0.65 },
  { key: "homeFieldWeightAway", min: 0, max: 0.35, step: 0.03, decay: 0.65 },
  { key: "confidenceBase", min: 0.05, max: 0.8, step: 0.04, decay: 0.68 },
  { key: "confidenceScale", min: 0.2, max: 1.1, step: 0.05, decay: 0.68 },
  { key: "tieCarryRate", min: 0.1, max: 0.7, step: 0.03, decay: 0.65 },
  { key: "minTieProbability", min: 0.001, max: 0.05, step: 0.005, decay: 0.6 },
  { key: "maxTieProbability", min: 0.03, max: 0.14, step: 0.01, decay: 0.6 },
];

export const GAME_MODEL_OBJECTIVE = "recency-weighted-multiclass-log-loss" as const;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function roundMetric(value: number, digits = 6) {
  return Number(value.toFixed(digits));
}

function buildStrengthSnapshotFromGameExample(
  example: GameOutcomeTrainingExample,
  side: "home" | "away",
): TeamStrengthSnapshot {
  const prefix = side === "home" ? "home" : "away";
  const currentWeight = example[`${prefix}DerivedCurrentWeight`];

  return {
    seasonTeamId: side === "home" ? example.homeFranchiseId : example.awayFranchiseId,
    offenseRating: example[`${prefix}DerivedOffenseRating`],
    starterRating: example[`${prefix}DerivedStarterRating`],
    bullpenRating: example[`${prefix}DerivedBullpenRating`],
    winPct: example[`${prefix}Pct`],
    recent10WinRate: example[`${prefix}Recent10WinRate`],
    homePct: side === "home" ? example.homeHomePct : 0.5,
    awayPct: side === "away" ? example.awayAwayPct : 0.5,
    splitGap:
      side === "home"
        ? Number((example.homeHomePct - 0.5).toFixed(4))
        : Number((0.5 - example.awayAwayPct).toFixed(4)),
    seasonProgress: example[`${prefix}SeasonProgress`],
    homeFieldAdjustment:
      side === "home"
        ? example.homeDerivedHomeFieldAdjustment
        : 0,
    recentFormAdjustment: example[`${prefix}DerivedRecentFormAdjustment`],
    confidenceScore: example[`${prefix}DerivedConfidenceScore`],
    currentWeight,
    priorWeight: Number((1 - currentWeight).toFixed(4)),
    scheduleDifficulty: example[`${prefix}DerivedScheduleDifficulty`],
    headToHeadLeverage: 0,
    explanationReasons: [],
  };
}

export function prepareGameExamples(examples: GameOutcomeTrainingExample[]): PreparedGameExample[] {
  return examples.map((example) => {
    const actualIndex = example.homeWin ? 0 : example.awayWin ? 1 : 2;
    return {
      sampleId: example.sampleId,
      year: example.year,
      seasonProgress: Number(((example.homeSeasonProgress + example.awaySeasonProgress) / 2).toFixed(4)),
      homeStrength: buildStrengthSnapshotFromGameExample(example, "home"),
      awayStrength: buildStrengthSnapshotFromGameExample(example, "away"),
      adjustmentFeatures: buildProbabilityAdjustmentFeaturesFromTrainingExample(example),
      actualIndex,
      actualHomeWin: example.homeWin ? 1 : 0,
      actualAwayWin: example.awayWin ? 1 : 0,
      actualTie: example.tie ? 1 : 0,
    };
  });
}

function normalizeParameterSet(parameters: GameModelParameterSet): GameModelParameterSet {
  const next = { ...parameters };

  for (const spec of PARAMETER_SPECS) {
    next[spec.key] = clamp(next[spec.key], spec.min, spec.max);
  }

  const safeAwayOffsetCeiling = Math.max(0.05, next.leagueRunEnvironment - 2.2);
  next.awayRunEnvironmentOffset = clamp(next.awayRunEnvironmentOffset, 0, safeAwayOffsetCeiling);
  next.maxTieProbability = Math.max(next.maxTieProbability, next.minTieProbability + 0.005);

  return gameModelParameterSetSchema.parse(next);
}

function buildObjectiveWeight(
  example: PreparedGameExample,
  minYear: number,
  maxYear: number,
) {
  const yearSpan = Math.max(1, maxYear - minYear);
  const recencyWeight =
    maxYear === minYear
      ? 1
      : 1 + ((example.year - minYear) / yearSpan) * 0.35;
  const progress = clamp(example.seasonProgress, 0, 1);
  const earlySeasonWeight =
    progress <= 0.12
      ? 1.6
      : progress <= 0.22
        ? 1.45
        : progress <= 0.35
          ? 1.25
          : progress <= 0.55
            ? 1.1
            : 1;

  return recencyWeight * earlySeasonWeight;
}

export function scorePreparedExamples(
  examples: PreparedGameExample[],
  parameters: GameModelParameterSet,
): GamePredictionMetrics {
  if (examples.length === 0) {
    return {
      sampleCount: 0,
      logLoss: 0,
      brierScore: 0,
      accuracy: 0,
      actualHomeWinRate: 0,
      actualAwayWinRate: 0,
      actualTieRate: 0,
      predictedHomeWinRate: 0,
      predictedAwayWinRate: 0,
      predictedTieRate: 0,
    };
  }

  const years = examples.map((example) => example.year);
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  let logLoss = 0;
  let brierScore = 0;
  let correct = 0;
  let actualHomeWinTotal = 0;
  let actualAwayWinTotal = 0;
  let actualTieTotal = 0;
  let predictedHomeWinTotal = 0;
  let predictedAwayWinTotal = 0;
  let predictedTieTotal = 0;
  let totalWeight = 0;

  for (const example of examples) {
    const weight = buildObjectiveWeight(example, minYear, maxYear);
    const prediction = buildGameProbabilityCoreSnapshot(
      example.homeStrength,
      example.awayStrength,
      true,
      undefined,
      parameters,
    );
    const probabilities = [
      prediction.homeWinProb,
      prediction.awayWinProb,
      prediction.tieProb,
    ];
    const actuals = [
      example.actualHomeWin,
      example.actualAwayWin,
      example.actualTie,
    ];

    totalWeight += weight;
    logLoss -= Math.log(Math.max(probabilities[example.actualIndex] ?? 0, 1e-9)) * weight;
    brierScore += probabilities.reduce((sum, probability, index) => {
      const delta = probability - actuals[index]!;
      return sum + delta * delta;
    }, 0) / 3 * weight;

    const predictedIndex = probabilities.indexOf(Math.max(...probabilities));
    if (predictedIndex === example.actualIndex) {
      correct += weight;
    }

    actualHomeWinTotal += example.actualHomeWin * weight;
    actualAwayWinTotal += example.actualAwayWin * weight;
    actualTieTotal += example.actualTie * weight;
    predictedHomeWinTotal += probabilities[0]! * weight;
    predictedAwayWinTotal += probabilities[1]! * weight;
    predictedTieTotal += probabilities[2]! * weight;
  }

  return {
    sampleCount: examples.length,
    logLoss: roundMetric(logLoss / totalWeight),
    brierScore: roundMetric(brierScore / totalWeight),
    accuracy: roundMetric(correct / totalWeight),
    actualHomeWinRate: roundMetric(actualHomeWinTotal / totalWeight),
    actualAwayWinRate: roundMetric(actualAwayWinTotal / totalWeight),
    actualTieRate: roundMetric(actualTieTotal / totalWeight),
    predictedHomeWinRate: roundMetric(predictedHomeWinTotal / totalWeight),
    predictedAwayWinRate: roundMetric(predictedAwayWinTotal / totalWeight),
    predictedTieRate: roundMetric(predictedTieTotal / totalWeight),
  };
}

function buildCalibrationBuckets(
  examples: PreparedGameExample[],
  parameters: GameModelParameterSet,
  outcomeKey: "homeWin" | "awayWin" | "tie",
): CalibrationBucket[] {
  const index = outcomeKey === "homeWin" ? 0 : outcomeKey === "awayWin" ? 1 : 2;
  const buckets = Array.from({ length: 10 }, (_, bucketIndex) => ({
    bucketLabel: `${(bucketIndex * 10).toString().padStart(2, "0")}-${((bucketIndex + 1) * 10).toString().padStart(2, "0")}%`,
    sampleCount: 0,
    predictedTotal: 0,
    actualTotal: 0,
  }));

  for (const example of examples) {
    const prediction = buildGameProbabilityCoreSnapshot(
      example.homeStrength,
      example.awayStrength,
      true,
      undefined,
      parameters,
    );
    const probability = [prediction.homeWinProb, prediction.awayWinProb, prediction.tieProb][index]!;
    const actual = [example.actualHomeWin, example.actualAwayWin, example.actualTie][index]!;
    const bucketIndex = Math.min(9, Math.max(0, Math.floor(probability * 10)));
    const bucket = buckets[bucketIndex]!;
    bucket.sampleCount += 1;
    bucket.predictedTotal += probability;
    bucket.actualTotal += actual;
  }

  return buckets.map((bucket) => ({
    bucketLabel: bucket.bucketLabel,
    sampleCount: bucket.sampleCount,
    meanPredicted:
      bucket.sampleCount > 0
        ? roundMetric(bucket.predictedTotal / bucket.sampleCount)
        : 0,
    actualRate:
      bucket.sampleCount > 0
        ? roundMetric(bucket.actualTotal / bucket.sampleCount)
        : 0,
  }));
}

export function buildCalibrationSummary(
  examples: PreparedGameExample[],
  parameters: GameModelParameterSet,
): GamePredictionCalibration[] {
  return (["homeWin", "awayWin", "tie"] as const).map((outcomeKey) => ({
    outcomeKey,
    buckets: buildCalibrationBuckets(examples, parameters, outcomeKey),
  }));
}

function isFitMetricBetter(next: GamePredictionMetrics, current: GamePredictionMetrics) {
  if (next.logLoss !== current.logLoss) {
    return next.logLoss < current.logLoss;
  }
  if (next.brierScore !== current.brierScore) {
    return next.brierScore < current.brierScore;
  }
  return next.accuracy > current.accuracy;
}

function isSelectionBetter(next: EvaluationResult, current: EvaluationResult) {
  if (next.selectionScore !== current.selectionScore) {
    return next.selectionScore < current.selectionScore;
  }
  return isFitMetricBetter(next.fit, current.fit);
}

function evaluateParameterSet(
  fitExamples: PreparedGameExample[],
  tuneExamples: PreparedGameExample[],
  validationExamples: PreparedGameExample[],
  parameters: GameModelParameterSet,
): EvaluationResult {
  const fit = scorePreparedExamples(fitExamples, parameters);
  const tune = tuneExamples.length > 0 ? scorePreparedExamples(tuneExamples, parameters) : null;
  const validation =
    validationExamples.length > 0
      ? scorePreparedExamples(validationExamples, parameters)
      : null;

  return {
    fit,
    tune,
    validation,
    selectionScore: tune?.logLoss ?? fit.logLoss,
  };
}

export function splitTrainYears(trainYears: number[]) {
  if (trainYears.length <= 1) {
    return {
      fitYears: [...trainYears],
      tuneYears: [] as number[],
    };
  }

  return {
    fitYears: trainYears.slice(0, -1),
    tuneYears: [trainYears.at(-1)!],
  };
}

function adjustParameter(
  parameters: GameModelParameterSet,
  key: TunableKey,
  delta: number,
): GameModelParameterSet {
  return normalizeParameterSet({
    ...parameters,
    [key]: parameters[key] + delta,
  });
}

export function fitGameModelParametersFromPreparedExamples(
  examplesByYear: Record<number, PreparedGameExample[]>,
  trainYears: number[],
  validationYears: number[],
  options: FitOptions = {},
): FitResult {
  const initialParameters = normalizeParameterSet(options.initial ?? DEFAULT_GAME_MODEL_PARAMETERS);
  const { fitYears, tuneYears } = splitTrainYears(trainYears);
  const maxRounds = options.maxRounds ?? 7;

  const fitExamples = fitYears.flatMap((year) => examplesByYear[year] ?? []);
  const tuneExamples = tuneYears.flatMap((year) => examplesByYear[year] ?? []);
  const validationExamples = validationYears.flatMap((year) => examplesByYear[year] ?? []);

  if (fitExamples.length === 0) {
    throw new Error("Game model fit requires at least one fit-year example.");
  }

  let evaluations = 1;
  let currentParameters = initialParameters;
  let currentEvaluation = evaluateParameterSet(fitExamples, tuneExamples, validationExamples, currentParameters);
  let bestSelectionParameters = currentParameters;
  let bestSelectionEvaluation = currentEvaluation;
  const steps = Object.fromEntries(
    PARAMETER_SPECS.map((spec) => [spec.key, spec.step]),
  ) as Record<TunableKey, number>;

  for (let round = 0; round < maxRounds; round += 1) {
    let roundImproved = false;

    for (const spec of PARAMETER_SPECS) {
      let bestFitParameters = currentParameters;
      let bestFitEvaluation = currentEvaluation;

      for (const direction of [-1, 1] as const) {
        const candidateParameters = adjustParameter(
          currentParameters,
          spec.key,
          direction * steps[spec.key],
        );
        const candidateEvaluation = evaluateParameterSet(
          fitExamples,
          tuneExamples,
          validationExamples,
          candidateParameters,
        );
        evaluations += 1;

        if (isFitMetricBetter(candidateEvaluation.fit, bestFitEvaluation.fit)) {
          bestFitParameters = candidateParameters;
          bestFitEvaluation = candidateEvaluation;
        }

        if (isSelectionBetter(candidateEvaluation, bestSelectionEvaluation)) {
          bestSelectionParameters = candidateParameters;
          bestSelectionEvaluation = candidateEvaluation;
        }
      }

      if (bestFitParameters !== currentParameters) {
        currentParameters = bestFitParameters;
        currentEvaluation = bestFitEvaluation;
        roundImproved = true;
      }
    }

    for (const spec of PARAMETER_SPECS) {
      steps[spec.key] *= roundImproved ? spec.decay : spec.decay * 0.9;
    }
  }

  const baselineEvaluation = evaluateParameterSet(
    fitExamples,
    tuneExamples,
    validationExamples,
    initialParameters,
  );
  const fittedParameters = bestSelectionParameters;
  const fittedEvaluation = bestSelectionEvaluation;

  return {
    artifact: {
      manifestType: "kbo-game-model-parameters",
      version: 1,
      trainedAt: new Date().toISOString(),
      objective: GAME_MODEL_OBJECTIVE,
      fitYears,
      tuneYears,
      validationYears,
      search: {
        rounds: maxRounds,
        evaluations,
      },
      baselineParameters: initialParameters,
      fittedParameters,
    },
    backtest: {
      manifestType: "kbo-game-model-backtest-summary",
      version: 1,
      generatedAt: new Date().toISOString(),
      objective: GAME_MODEL_OBJECTIVE,
      fitYears,
      tuneYears,
      validationYears,
      baseline: {
        fit: baselineEvaluation.fit,
        tune: baselineEvaluation.tune,
        validation: baselineEvaluation.validation,
      },
      fitted: {
        fit: fittedEvaluation.fit,
        tune: fittedEvaluation.tune,
        validation: fittedEvaluation.validation,
      },
      deltas: {
        fitLogLoss: roundMetric(fittedEvaluation.fit.logLoss - baselineEvaluation.fit.logLoss),
        tuneLogLoss:
          fittedEvaluation.tune && baselineEvaluation.tune
            ? roundMetric(fittedEvaluation.tune.logLoss - baselineEvaluation.tune.logLoss)
            : null,
        validationLogLoss:
          fittedEvaluation.validation && baselineEvaluation.validation
            ? roundMetric(fittedEvaluation.validation.logLoss - baselineEvaluation.validation.logLoss)
            : null,
        fitBrierScore: roundMetric(fittedEvaluation.fit.brierScore - baselineEvaluation.fit.brierScore),
        tuneBrierScore:
          fittedEvaluation.tune && baselineEvaluation.tune
            ? roundMetric(fittedEvaluation.tune.brierScore - baselineEvaluation.tune.brierScore)
            : null,
        validationBrierScore:
          fittedEvaluation.validation && baselineEvaluation.validation
            ? roundMetric(fittedEvaluation.validation.brierScore - baselineEvaluation.validation.brierScore)
            : null,
      },
      calibration: {
        baselineValidation: buildCalibrationSummary(validationExamples, initialParameters),
        fittedValidation: buildCalibrationSummary(validationExamples, fittedParameters),
      },
    },
  };
}

export function fitGameModelParameters(
  examplesByYear: Record<number, GameOutcomeTrainingExample[]>,
  trainYears: number[],
  validationYears: number[],
  options: FitOptions = {},
): FitResult {
  const preparedByYear = Object.fromEntries(
    Object.entries(examplesByYear).map(([year, examples]) => [Number(year), prepareGameExamples(examples)]),
  ) as Record<number, PreparedGameExample[]>;

  return fitGameModelParametersFromPreparedExamples(
    preparedByYear,
    trainYears,
    validationYears,
    options,
  );
}
