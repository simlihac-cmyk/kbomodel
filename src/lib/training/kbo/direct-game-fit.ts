import {
  buildGameProbabilityCoreSnapshot,
} from "@/lib/sim/kbo/probabilities";
import {
  applyProbabilityAdjustment,
} from "@/lib/sim/kbo/probability-adjustment";
import {
  applyDirectGameRuntimeModel,
} from "@/lib/sim/kbo/direct-game/runtime";
import {
  DEFAULT_DIRECT_GAME_MODEL_PARAMETERS,
  DIRECT_GAME_FEATURE_KEYS,
  directGameParameterSetSchema,
  type DirectGameFeatureKey,
  type DirectGameParameterSet,
} from "@/lib/sim/kbo/direct-game/model-types";
import type { GameModelParameterSet } from "@/lib/sim/kbo/model-parameters";
import type { ProbabilityAdjustmentParameterSet } from "@/lib/sim/kbo/probability-adjustment-parameters";
import {
  buildDecisiveSpreadSnapshot,
  isPredictionMetricsMoreDiscriminative,
  type PreparedGameExample,
} from "@/lib/training/kbo/game-model-fit";
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

function buildBaseProbabilities(
  example: PreparedGameExample,
  gameParameters: GameModelParameterSet,
  adjustmentParameters: ProbabilityAdjustmentParameterSet,
) {
  const base = buildGameProbabilityCoreSnapshot(
    example.homeStrength,
    example.awayStrength,
    true,
    undefined,
    gameParameters,
  );

  return applyProbabilityAdjustment({
    homeWinProb: base.homeWinProb,
    awayWinProb: base.awayWinProb,
    tieProb: base.tieProb,
    features: example.adjustmentFeatures,
    parameters: adjustmentParameters,
  });
}

function initializeGradientAccumulator() {
  const zeroWeights = Object.fromEntries(
    DIRECT_GAME_FEATURE_KEYS.map((key) => [key, 0]),
  ) as Record<DirectGameFeatureKey, number>;

  return {
    decisiveBias: 0,
    decisiveWeights: { ...zeroWeights },
    tieBias: 0,
    tieWeights: { ...zeroWeights },
  };
}

function cloneParameters(parameters: DirectGameParameterSet): DirectGameParameterSet {
  return directGameParameterSetSchema.parse(JSON.parse(JSON.stringify(parameters)));
}

function normalizeParameters(parameters: DirectGameParameterSet): DirectGameParameterSet {
  const next = cloneParameters(parameters);

  next.decisiveBias = clamp(next.decisiveBias, -1.5, 1.5);
  next.tieBias = clamp(next.tieBias, -1.5, 1.5);

  for (const key of DIRECT_GAME_FEATURE_KEYS) {
    next.decisiveWeights[key] = clamp(next.decisiveWeights[key], -1.5, 1.5);
    next.tieWeights[key] = clamp(next.tieWeights[key], -1.5, 1.5);
  }

  next.tieMinProbability = clamp(next.tieMinProbability, 0, 0.2);
  next.tieMaxProbability = clamp(
    next.tieMaxProbability,
    next.tieMinProbability + 0.01,
    0.3,
  );

  return directGameParameterSetSchema.parse(next);
}

export function scorePreparedExamplesWithDirectGameModel(
  examples: PreparedGameExample[],
  gameParameters: GameModelParameterSet,
  adjustmentParameters: ProbabilityAdjustmentParameterSet,
  directParameters: DirectGameParameterSet,
): GamePredictionMetrics {
  if (examples.length === 0) {
    return {
      sampleCount: 0,
      logLoss: 0,
      brierScore: 0,
      accuracy: 0,
      meanDecisiveFavoriteShare: 0,
      meanDecisiveMargin: 0,
      coinFlipRate55: 0,
      confidentRate60: 0,
      strongRate70: 0,
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
  let decisiveFavoriteShareTotal = 0;
  let decisiveMarginTotal = 0;
  let coinFlip55Total = 0;
  let confident60Total = 0;
  let strong70Total = 0;
  let totalWeight = 0;

  for (const example of examples) {
    const weight = buildObjectiveWeight(example, minYear, maxYear);
    const base = buildBaseProbabilities(example, gameParameters, adjustmentParameters);
    const adjusted = applyDirectGameRuntimeModel({
      homeWinProb: base.homeWinProb,
      awayWinProb: base.awayWinProb,
      tieProb: base.tieProb,
      features: example.directGameFeatures,
      parameters: directParameters,
    });
    const probabilities = [adjusted.homeWinProb, adjusted.awayWinProb, adjusted.tieProb] as const;
    const actuals = [example.actualHomeWin, example.actualAwayWin, example.actualTie];
    const spread = buildDecisiveSpreadSnapshot(probabilities);

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
    decisiveFavoriteShareTotal += spread.favoriteShare * weight;
    decisiveMarginTotal += spread.margin * weight;
    coinFlip55Total += spread.coinFlip55 * weight;
    confident60Total += spread.confident60 * weight;
    strong70Total += spread.strong70 * weight;
  }

  return {
    sampleCount: examples.length,
    logLoss: roundMetric(logLoss / totalWeight),
    brierScore: roundMetric(brierScore / totalWeight),
    accuracy: roundMetric(correct / totalWeight),
    meanDecisiveFavoriteShare: roundMetric(decisiveFavoriteShareTotal / totalWeight),
    meanDecisiveMargin: roundMetric(decisiveMarginTotal / totalWeight),
    coinFlipRate55: roundMetric(coinFlip55Total / totalWeight),
    confidentRate60: roundMetric(confident60Total / totalWeight),
    strongRate70: roundMetric(strong70Total / totalWeight),
    actualHomeWinRate: roundMetric(actualHomeWinTotal / totalWeight),
    actualAwayWinRate: roundMetric(actualAwayWinTotal / totalWeight),
    actualTieRate: roundMetric(actualTieTotal / totalWeight),
    predictedHomeWinRate: roundMetric(predictedHomeWinTotal / totalWeight),
    predictedAwayWinRate: roundMetric(predictedAwayWinTotal / totalWeight),
    predictedTieRate: roundMetric(predictedTieTotal / totalWeight),
  };
}

export function buildDirectGameCalibrationSummary(
  examples: PreparedGameExample[],
  gameParameters: GameModelParameterSet,
  adjustmentParameters: ProbabilityAdjustmentParameterSet,
  directParameters: DirectGameParameterSet,
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
      const base = buildBaseProbabilities(example, gameParameters, adjustmentParameters);
      const adjusted = applyDirectGameRuntimeModel({
        homeWinProb: base.homeWinProb,
        awayWinProb: base.awayWinProb,
        tieProb: base.tieProb,
        features: example.directGameFeatures,
        parameters: directParameters,
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

type DirectEvaluationResult = {
  fit: GamePredictionMetrics;
  tune: GamePredictionMetrics | null;
  validation: GamePredictionMetrics | null;
  selectionScore: number;
};

function getPrimarySelectionMetric(evaluation: DirectEvaluationResult) {
  return evaluation.validation ?? evaluation.tune ?? evaluation.fit;
}

function isDirectEvaluationBetter(
  next: DirectEvaluationResult,
  current: DirectEvaluationResult,
) {
  if (next.selectionScore < current.selectionScore - 0.0015) {
    return true;
  }
  if (next.selectionScore > current.selectionScore + 0.0015) {
    return false;
  }
  return isPredictionMetricsMoreDiscriminative(
    getPrimarySelectionMetric(next),
    getPrimarySelectionMetric(current),
  );
}

function evaluateDirectParameterSet(
  fitExamples: PreparedGameExample[],
  tuneExamples: PreparedGameExample[],
  validationExamples: PreparedGameExample[],
  gameParameters: GameModelParameterSet,
  adjustmentParameters: ProbabilityAdjustmentParameterSet,
  directParameters: DirectGameParameterSet,
): DirectEvaluationResult {
  const fit = scorePreparedExamplesWithDirectGameModel(
    fitExamples,
    gameParameters,
    adjustmentParameters,
    directParameters,
  );
  const tune =
    tuneExamples.length > 0
      ? scorePreparedExamplesWithDirectGameModel(
          tuneExamples,
          gameParameters,
          adjustmentParameters,
          directParameters,
        )
      : null;
  const validation =
    validationExamples.length > 0
      ? scorePreparedExamplesWithDirectGameModel(
          validationExamples,
          gameParameters,
          adjustmentParameters,
          directParameters,
        )
      : null;

  return {
    fit,
    tune,
    validation,
    selectionScore: validation?.logLoss ?? tune?.logLoss ?? fit.logLoss,
  };
}

export function fitDirectGameParameters(args: {
  examplesByYear: Record<number, PreparedGameExample[]>;
  trainYears: number[];
  validationYears: number[];
  gameParameters: GameModelParameterSet;
  adjustmentParameters: ProbabilityAdjustmentParameterSet;
  initial?: DirectGameParameterSet;
  maxRounds?: number;
  learningRate?: number;
  l2Penalty?: number;
}) {
  const initial = normalizeParameters(directGameParameterSetSchema.parse(
    args.initial ?? DEFAULT_DIRECT_GAME_MODEL_PARAMETERS,
  ));
  const fitYears = args.trainYears.length > 1 ? args.trainYears.slice(0, -1) : [...args.trainYears];
  const tuneYears = args.trainYears.length > 1 ? [args.trainYears.at(-1)!] : [];
  const fitExamples = fitYears.flatMap((year) => args.examplesByYear[year] ?? []);
  const tuneExamples = tuneYears.flatMap((year) => args.examplesByYear[year] ?? []);
  const validationExamples = args.validationYears.flatMap((year) => args.examplesByYear[year] ?? []);
  const maxRounds = args.maxRounds ?? 36;
  const learningRate = args.learningRate ?? 0.08;
  const l2Penalty = args.l2Penalty ?? 0.015;

  if (fitExamples.length === 0) {
    throw new Error("Direct game fit requires at least one fit example.");
  }

  let current = cloneParameters(initial);
  let best = cloneParameters(initial);
  let bestEvaluation = evaluateDirectParameterSet(
    fitExamples,
    tuneExamples,
    validationExamples,
    args.gameParameters,
    args.adjustmentParameters,
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
      const base = buildBaseProbabilities(
        example,
        args.gameParameters,
        args.adjustmentParameters,
      );
      const adjusted = applyDirectGameRuntimeModel({
        homeWinProb: base.homeWinProb,
        awayWinProb: base.awayWinProb,
        tieProb: base.tieProb,
        features: example.directGameFeatures,
        parameters: current,
      });
      const weight = buildObjectiveWeight(example, minYear, maxYear);
      totalWeight += weight;

      const tieError = (adjusted.tieProb - example.actualTie) * weight;
      gradient.tieBias += tieError;

      for (const key of DIRECT_GAME_FEATURE_KEYS) {
        const value = example.directGameFeatures[key];
        gradient.tieWeights[key] += tieError * value;
      }

      if (example.actualTie) {
        continue;
      }

      const decisiveTotal = Math.max(adjusted.homeWinProb + adjusted.awayWinProb, 1e-9);
      const homeDecisiveProb = adjusted.homeWinProb / decisiveTotal;
      const decisiveError = (homeDecisiveProb - example.actualHomeWin) * weight;
      gradient.decisiveBias += decisiveError;

      for (const key of DIRECT_GAME_FEATURE_KEYS) {
        const value = example.directGameFeatures[key];
        gradient.decisiveWeights[key] += decisiveError * value;
      }
    }

    const step = learningRate / Math.max(1, totalWeight);
    current.decisiveBias -= step * (gradient.decisiveBias + current.decisiveBias * l2Penalty);
    current.tieBias -= step * (gradient.tieBias + current.tieBias * l2Penalty);

    for (const key of DIRECT_GAME_FEATURE_KEYS) {
      current.decisiveWeights[key] -= step * (
        gradient.decisiveWeights[key] +
        current.decisiveWeights[key] * l2Penalty
      );
      current.tieWeights[key] -= step * (
        gradient.tieWeights[key] +
        current.tieWeights[key] * l2Penalty
      );
    }

    current = normalizeParameters(current);
    const evaluation = evaluateDirectParameterSet(
      fitExamples,
      tuneExamples,
      validationExamples,
      args.gameParameters,
      args.adjustmentParameters,
      current,
    );
    evaluations += 1;

    if (isDirectEvaluationBetter(evaluation, bestEvaluation)) {
      best = cloneParameters(current);
      bestEvaluation = evaluation;
    }
  }

  const baselineEvaluation = evaluateDirectParameterSet(
    fitExamples,
    tuneExamples,
    validationExamples,
    args.gameParameters,
    args.adjustmentParameters,
    initial,
  );

  return {
    baselineParameters: initial,
    fittedParameters: best,
    baselineEvaluation,
    fittedEvaluation: bestEvaluation,
    evaluations,
    calibration: {
      baselineValidation: buildDirectGameCalibrationSummary(
        validationExamples,
        args.gameParameters,
        args.adjustmentParameters,
        initial,
      ),
      fittedValidation: buildDirectGameCalibrationSummary(
        validationExamples,
        args.gameParameters,
        args.adjustmentParameters,
        best,
      ),
    },
  };
}
