import { z } from "zod";

import { gameModelParameterSetSchema } from "@/lib/sim/kbo/model-parameters";
import { strengthModelParameterSetSchema } from "@/lib/sim/kbo/strength-model-parameters";

const trainingObjectiveSchema = z.enum([
  "multiclass-log-loss",
  "recency-weighted-multiclass-log-loss",
]);

export const gamePredictionMetricsSchema = z.object({
  sampleCount: z.number().int().nonnegative(),
  logLoss: z.number(),
  brierScore: z.number(),
  accuracy: z.number(),
  actualHomeWinRate: z.number(),
  actualAwayWinRate: z.number(),
  actualTieRate: z.number(),
  predictedHomeWinRate: z.number(),
  predictedAwayWinRate: z.number(),
  predictedTieRate: z.number(),
});
export type GamePredictionMetrics = z.infer<typeof gamePredictionMetricsSchema>;

export const calibrationBucketSchema = z.object({
  bucketLabel: z.string(),
  sampleCount: z.number().int().nonnegative(),
  meanPredicted: z.number(),
  actualRate: z.number(),
});
export type CalibrationBucket = z.infer<typeof calibrationBucketSchema>;

export const gamePredictionCalibrationSchema = z.object({
  outcomeKey: z.enum(["homeWin", "awayWin", "tie"]),
  buckets: z.array(calibrationBucketSchema),
});
export type GamePredictionCalibration = z.infer<typeof gamePredictionCalibrationSchema>;

export const gameModelParameterArtifactSchema = z.object({
  manifestType: z.literal("kbo-game-model-parameters"),
  version: z.literal(1),
  trainedAt: z.string().datetime(),
  objective: trainingObjectiveSchema,
  fitYears: z.array(z.number().int()).min(1),
  tuneYears: z.array(z.number().int()),
  validationYears: z.array(z.number().int()),
  search: z.object({
    rounds: z.number().int().positive(),
    evaluations: z.number().int().positive(),
  }),
  baselineParameters: gameModelParameterSetSchema,
  fittedParameters: gameModelParameterSetSchema,
});
export type GameModelParameterArtifact = z.infer<typeof gameModelParameterArtifactSchema>;

export const gameModelBacktestSummarySchema = z.object({
  manifestType: z.literal("kbo-game-model-backtest-summary"),
  version: z.literal(1),
  generatedAt: z.string().datetime(),
  objective: trainingObjectiveSchema,
  fitYears: z.array(z.number().int()).min(1),
  tuneYears: z.array(z.number().int()),
  validationYears: z.array(z.number().int()),
  baseline: z.object({
    fit: gamePredictionMetricsSchema,
    tune: gamePredictionMetricsSchema.nullable(),
    validation: gamePredictionMetricsSchema.nullable(),
  }),
  fitted: z.object({
    fit: gamePredictionMetricsSchema,
    tune: gamePredictionMetricsSchema.nullable(),
    validation: gamePredictionMetricsSchema.nullable(),
  }),
  deltas: z.object({
    fitLogLoss: z.number(),
    tuneLogLoss: z.number().nullable(),
    validationLogLoss: z.number().nullable(),
    fitBrierScore: z.number(),
    tuneBrierScore: z.number().nullable(),
    validationBrierScore: z.number().nullable(),
  }),
  calibration: z.object({
    baselineValidation: z.array(gamePredictionCalibrationSchema),
    fittedValidation: z.array(gamePredictionCalibrationSchema),
  }),
});
export type GameModelBacktestSummary = z.infer<typeof gameModelBacktestSummarySchema>;

export const runtimeModelParameterArtifactSchema = z.object({
  manifestType: z.literal("kbo-runtime-model-parameters"),
  version: z.literal(1),
  trainedAt: z.string().datetime(),
  objective: trainingObjectiveSchema,
  fitYears: z.array(z.number().int()).min(1),
  tuneYears: z.array(z.number().int()),
  validationYears: z.array(z.number().int()),
  search: z.object({
    starts: z.number().int().positive(),
    iterations: z.number().int().positive(),
    strengthRounds: z.number().int().positive(),
    gameRounds: z.number().int().positive(),
    evaluations: z.object({
      strength: z.number().int().positive(),
      game: z.number().int().positive(),
      total: z.number().int().positive(),
    }),
  }),
  baselineParameters: z.object({
    strength: strengthModelParameterSetSchema,
    game: gameModelParameterSetSchema,
  }),
  fittedParameters: z.object({
    strength: strengthModelParameterSetSchema,
    game: gameModelParameterSetSchema,
  }),
});
export type RuntimeModelParameterArtifact = z.infer<typeof runtimeModelParameterArtifactSchema>;

export const runtimeModelBacktestSummarySchema = z.object({
  manifestType: z.literal("kbo-runtime-model-backtest-summary"),
  version: z.literal(1),
  generatedAt: z.string().datetime(),
  objective: trainingObjectiveSchema,
  fitYears: z.array(z.number().int()).min(1),
  tuneYears: z.array(z.number().int()),
  validationYears: z.array(z.number().int()),
  baseline: z.object({
    fit: gamePredictionMetricsSchema,
    tune: gamePredictionMetricsSchema.nullable(),
    validation: gamePredictionMetricsSchema.nullable(),
  }),
  fitted: z.object({
    fit: gamePredictionMetricsSchema,
    tune: gamePredictionMetricsSchema.nullable(),
    validation: gamePredictionMetricsSchema.nullable(),
  }),
  deltas: z.object({
    fitLogLoss: z.number(),
    tuneLogLoss: z.number().nullable(),
    validationLogLoss: z.number().nullable(),
    fitBrierScore: z.number(),
    tuneBrierScore: z.number().nullable(),
    validationBrierScore: z.number().nullable(),
  }),
  calibration: z.object({
    baselineValidation: z.array(gamePredictionCalibrationSchema),
    fittedValidation: z.array(gamePredictionCalibrationSchema),
  }),
  selection: z.object({
    startCount: z.number().int().positive(),
    selectedStartIndex: z.number().int().nonnegative(),
    criterion: z.enum([
      "rolling-validation-log-loss",
      "validation-log-loss",
      "blended-validation-log-loss",
    ]),
  }),
  multiStarts: z.array(
    z.object({
      startIndex: z.number().int().nonnegative(),
      validationLogLoss: z.number().nullable(),
      rollingValidationLogLoss: z.number().nullable(),
      selected: z.boolean(),
    }),
  ),
  rollingValidation: z.array(
    z.object({
      trainYears: z.array(z.number().int()).min(2),
      validationYears: z.array(z.number().int()).min(1),
      validationLogLoss: z.number().nullable(),
      validationBrierScore: z.number().nullable(),
    }),
  ),
  iterations: z.array(
    z.object({
      iteration: z.number().int().positive(),
      strengthValidationLogLoss: z.number().nullable(),
      gameValidationLogLoss: z.number().nullable(),
    }),
  ),
});
export type RuntimeModelBacktestSummary = z.infer<typeof runtimeModelBacktestSummarySchema>;
