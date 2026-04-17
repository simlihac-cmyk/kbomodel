import { z } from "zod";

import { gameModelParameterSetSchema } from "@/lib/sim/kbo/model-parameters";

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
  objective: z.literal("multiclass-log-loss"),
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
  objective: z.literal("multiclass-log-loss"),
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
