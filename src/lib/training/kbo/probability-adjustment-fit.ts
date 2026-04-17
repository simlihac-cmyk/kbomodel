import { buildGameProbabilityCoreSnapshot } from "@/lib/sim/kbo/probabilities";
import {
  applyProbabilityAdjustment,
} from "@/lib/sim/kbo/probability-adjustment";
import {
  DEFAULT_PROBABILITY_ADJUSTMENT_PARAMETERS,
  PROBABILITY_ADJUSTMENT_FEATURE_KEYS,
  probabilityAdjustmentParameterSetSchema,
  type ProbabilityAdjustmentFeatureKey,
  type ProbabilityAdjustmentParameterSet,
} from "@/lib/sim/kbo/probability-adjustment-parameters";
import type { GameModelParameterSet } from "@/lib/sim/kbo/model-parameters";
import type { PreparedGameExample } from "@/lib/training/kbo/game-model-fit";
import type {
  GamePredictionCalibration,
  GamePredictionMetrics,
} from "@/lib/training/kbo/model-types";

function roundMetric(value: number, digits = 6) {
  return Number(value.toFixed(digits));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function buildObjectiveWeight(example: PreparedGameExample, minYear: number, maxYear: number) {
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

function buildBaseProbabilities(example: PreparedGameExample, gameParameters: GameModelParameterSet) {
  return buildGameProbabilityCoreSnapshot(
    example.homeStrength,
    example.awayStrength,
    true,
    undefined,
    gameParameters,
  );
}

export function scorePreparedExamplesWithAdjustment(
  examples: PreparedGameExample[],
  gameParameters: GameModelParameterSet,
  adjustmentParameters: ProbabilityAdjustmentParameterSet,
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
    const base = buildBaseProbabilities(example, gameParameters);
    const adjusted = applyProbabilityAdjustment({
      homeWinProb: base.homeWinProb,
      awayWinProb: base.awayWinProb,
      tieProb: base.tieProb,
      features: example.adjustmentFeatures,
      parameters: adjustmentParameters,
    });
    const probabilities = [adjusted.homeWinProb, adjusted.awayWinProb, adjusted.tieProb];
    const actuals = [example.actualHomeWin, example.actualAwayWin, example.actualTie];

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

export function buildAdjustmentCalibrationSummary(
  examples: PreparedGameExample[],
  gameParameters: GameModelParameterSet,
  adjustmentParameters: ProbabilityAdjustmentParameterSet,
): GamePredictionCalibration[] {
  return (["homeWin", "awayWin", "tie"] as const).map((outcomeKey) => {
    const index = outcomeKey === "homeWin" ? 0 : outcomeKey === "awayWin" ? 1 : 2;
    const buckets = Array.from({ length: 10 }, (_, bucketIndex) => ({
      bucketLabel: `${(bucketIndex * 10).toString().padStart(2, "0")}-${((bucketIndex + 1) * 10).toString().padStart(2, "0")}%`,
      sampleCount: 0,
      predictedTotal: 0,
      actualTotal: 0,
    }));

    for (const example of examples) {
      const base = buildBaseProbabilities(example, gameParameters);
      const adjusted = applyProbabilityAdjustment({
        homeWinProb: base.homeWinProb,
        awayWinProb: base.awayWinProb,
        tieProb: base.tieProb,
        features: example.adjustmentFeatures,
        parameters: adjustmentParameters,
      });
      const probability = [adjusted.homeWinProb, adjusted.awayWinProb, adjusted.tieProb][index]!;
      const actual = [example.actualHomeWin, example.actualAwayWin, example.actualTie][index]!;
      const bucketIndex = Math.min(9, Math.max(0, Math.floor(probability * 10)));
      const bucket = buckets[bucketIndex]!;
      bucket.sampleCount += 1;
      bucket.predictedTotal += probability;
      bucket.actualTotal += actual;
    }

    return {
      outcomeKey,
      buckets: buckets.map((bucket) => ({
        bucketLabel: bucket.bucketLabel,
        sampleCount: bucket.sampleCount,
        meanPredicted: bucket.sampleCount > 0 ? roundMetric(bucket.predictedTotal / bucket.sampleCount) : 0,
        actualRate: bucket.sampleCount > 0 ? roundMetric(bucket.actualTotal / bucket.sampleCount) : 0,
      })),
    };
  });
}

type AdjustmentEvaluationResult = {
  fit: GamePredictionMetrics;
  tune: GamePredictionMetrics | null;
  validation: GamePredictionMetrics | null;
  selectionScore: number;
};

function evaluateAdjustmentSet(
  fitExamples: PreparedGameExample[],
  tuneExamples: PreparedGameExample[],
  validationExamples: PreparedGameExample[],
  gameParameters: GameModelParameterSet,
  adjustmentParameters: ProbabilityAdjustmentParameterSet,
): AdjustmentEvaluationResult {
  const fit = scorePreparedExamplesWithAdjustment(fitExamples, gameParameters, adjustmentParameters);
  const tune =
    tuneExamples.length > 0
      ? scorePreparedExamplesWithAdjustment(tuneExamples, gameParameters, adjustmentParameters)
      : null;
  const validation =
    validationExamples.length > 0
      ? scorePreparedExamplesWithAdjustment(validationExamples, gameParameters, adjustmentParameters)
      : null;

  return {
    fit,
    tune,
    validation,
    selectionScore: validation?.logLoss ?? tune?.logLoss ?? fit.logLoss,
  };
}

function initializeGradientAccumulator() {
  const zeroWeights = Object.fromEntries(
    PROBABILITY_ADJUSTMENT_FEATURE_KEYS.map((key) => [key, 0]),
  ) as Record<ProbabilityAdjustmentFeatureKey, number>;

  return {
    homeBias: 0,
    awayBias: 0,
    tieBias: 0,
    homeWeights: { ...zeroWeights },
    awayWeights: { ...zeroWeights },
    tieWeights: { ...zeroWeights },
  };
}

function cloneParameters(parameters: ProbabilityAdjustmentParameterSet): ProbabilityAdjustmentParameterSet {
  return probabilityAdjustmentParameterSetSchema.parse(JSON.parse(JSON.stringify(parameters)));
}

export function fitProbabilityAdjustmentParameters(args: {
  examplesByYear: Record<number, PreparedGameExample[]>;
  trainYears: number[];
  validationYears: number[];
  gameParameters: GameModelParameterSet;
  initial?: ProbabilityAdjustmentParameterSet;
  maxRounds?: number;
  learningRate?: number;
  l2Penalty?: number;
}) {
  const initial = probabilityAdjustmentParameterSetSchema.parse(
    args.initial ?? DEFAULT_PROBABILITY_ADJUSTMENT_PARAMETERS,
  );
  const fitYears = args.trainYears.length > 1 ? args.trainYears.slice(0, -1) : [...args.trainYears];
  const tuneYears = args.trainYears.length > 1 ? [args.trainYears.at(-1)!] : [];
  const fitExamples = fitYears.flatMap((year) => args.examplesByYear[year] ?? []);
  const tuneExamples = tuneYears.flatMap((year) => args.examplesByYear[year] ?? []);
  const validationExamples = args.validationYears.flatMap((year) => args.examplesByYear[year] ?? []);
  const maxRounds = args.maxRounds ?? 48;
  const learningRate = args.learningRate ?? 0.08;
  const l2Penalty = args.l2Penalty ?? 0.0015;

  if (fitExamples.length === 0) {
    throw new Error("Probability adjustment fit requires at least one fit example.");
  }

  let current = cloneParameters(initial);
  let best = cloneParameters(initial);
  let bestEvaluation = evaluateAdjustmentSet(
    fitExamples,
    tuneExamples,
    validationExamples,
    args.gameParameters,
    current,
  );
  let evaluations = 1;

  const years = fitExamples.map((example) => example.year);
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);

  for (let round = 0; round < maxRounds; round += 1) {
    const gradient = initializeGradientAccumulator();
    let totalWeight = 0;

    for (const example of fitExamples) {
      const base = buildBaseProbabilities(example, args.gameParameters);
      const adjusted = applyProbabilityAdjustment({
        homeWinProb: base.homeWinProb,
        awayWinProb: base.awayWinProb,
        tieProb: base.tieProb,
        features: example.adjustmentFeatures,
        parameters: current,
      });
      const probabilities = [adjusted.homeWinProb, adjusted.awayWinProb, adjusted.tieProb];
      const actuals = [example.actualHomeWin, example.actualAwayWin, example.actualTie];
      const weight = buildObjectiveWeight(example, minYear, maxYear);
      totalWeight += weight;
      const deltas = probabilities.map((probability, index) => (probability - actuals[index]!) * weight);

      gradient.homeBias += deltas[0]!;
      gradient.awayBias += deltas[1]!;
      gradient.tieBias += deltas[2]!;

      for (const key of PROBABILITY_ADJUSTMENT_FEATURE_KEYS) {
        const value = example.adjustmentFeatures[key];
        gradient.homeWeights[key] += deltas[0]! * value;
        gradient.awayWeights[key] += deltas[1]! * value;
        gradient.tieWeights[key] += deltas[2]! * value;
      }
    }

    const step = learningRate / Math.max(1, totalWeight);
    current.homeBias -= step * gradient.homeBias;
    current.awayBias -= step * gradient.awayBias;
    current.tieBias -= step * gradient.tieBias;

    for (const key of PROBABILITY_ADJUSTMENT_FEATURE_KEYS) {
      current.homeWeights[key] -= step * (gradient.homeWeights[key] + current.homeWeights[key] * l2Penalty);
      current.awayWeights[key] -= step * (gradient.awayWeights[key] + current.awayWeights[key] * l2Penalty);
      current.tieWeights[key] -= step * (gradient.tieWeights[key] + current.tieWeights[key] * l2Penalty);
    }

    current = probabilityAdjustmentParameterSetSchema.parse(current);
    const evaluation = evaluateAdjustmentSet(
      fitExamples,
      tuneExamples,
      validationExamples,
      args.gameParameters,
      current,
    );
    evaluations += 1;

    if (evaluation.selectionScore < bestEvaluation.selectionScore) {
      best = cloneParameters(current);
      bestEvaluation = evaluation;
    }
  }

  const baselineEvaluation = evaluateAdjustmentSet(
    fitExamples,
    tuneExamples,
    validationExamples,
    args.gameParameters,
    initial,
  );

  return {
    baselineParameters: initial,
    fittedParameters: best,
    baselineEvaluation,
    fittedEvaluation: bestEvaluation,
    evaluations,
    calibration: {
      baselineValidation: buildAdjustmentCalibrationSummary(validationExamples, args.gameParameters, initial),
      fittedValidation: buildAdjustmentCalibrationSummary(validationExamples, args.gameParameters, best),
    },
  };
}
