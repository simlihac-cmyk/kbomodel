import { z } from "zod";

const sha256Pattern = /^[a-f0-9]{64}$/;

export const trainingArtifactFileSchema = z.object({
  relativePath: z.string().min(1),
  bytes: z.number().int().nonnegative(),
  sha256: z.string().regex(sha256Pattern),
});
export type TrainingArtifactFile = z.infer<typeof trainingArtifactFileSchema>;

export const trainingSuggestedSplitSchema = z.object({
  trainYears: z.array(z.number().int()),
  validationYears: z.array(z.number().int()),
});
export type TrainingSuggestedSplit = z.infer<typeof trainingSuggestedSplitSchema>;

export const trainingInputPackageManifestSchema = z.object({
  manifestType: z.literal("training-input-package"),
  packageId: z.string().min(1),
  generatedAt: z.string().datetime(),
  gitCommit: z.string().nullable(),
  gitBranch: z.string().nullable(),
  nodeVersion: z.string().min(1),
  packageManager: z.string().min(1),
  years: z.array(z.number().int()).min(1),
  suggestedSplit: trainingSuggestedSplitSchema,
  sourcePaths: z.object({
    historyTrainingRoot: z.string().min(1),
    trainingCorpusRoot: z.string().min(1),
  }),
  files: z.array(trainingArtifactFileSchema).min(1),
});
export type TrainingInputPackageManifest = z.infer<typeof trainingInputPackageManifestSchema>;

export const trainingResultFileKindSchema = z.enum([
  "parameters",
  "calibration",
  "backtest",
  "notes",
  "auxiliary",
]);
export type TrainingResultFileKind = z.infer<typeof trainingResultFileKindSchema>;

export const trainingResultFileSchema = trainingArtifactFileSchema.extend({
  kind: trainingResultFileKindSchema,
});
export type TrainingResultFile = z.infer<typeof trainingResultFileSchema>;

export const trainingResultBundleManifestSchema = z
  .object({
    manifestType: z.literal("training-result-bundle"),
    bundleId: z.string().min(1),
    createdAt: z.string().datetime(),
    sourcePackageId: z.string().min(1),
    sourceGitCommit: z.string().nullable(),
    trainYears: z.array(z.number().int()).min(1),
    validationYears: z.array(z.number().int()),
    trainer: z.object({
      machineLabel: z.string().nullable(),
      nodeVersion: z.string().min(1),
    }),
    files: z.array(trainingResultFileSchema).min(1),
  })
  .superRefine((value, context) => {
    const hasParameters = value.files.some((file) => file.kind === "parameters");
    const hasBacktest = value.files.some((file) => file.kind === "backtest");

    if (!hasParameters) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Training result bundle must include a parameters file.",
        path: ["files"],
      });
    }

    if (!hasBacktest) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Training result bundle must include a backtest file.",
        path: ["files"],
      });
    }
  });
export type TrainingResultBundleManifest = z.infer<typeof trainingResultBundleManifestSchema>;

export const importedTrainingBundleRegistryEntrySchema = z.object({
  bundleId: z.string().min(1),
  importedAt: z.string().datetime(),
  sourcePackageId: z.string().min(1),
  sourceGitCommit: z.string().nullable(),
  trainYears: z.array(z.number().int()).min(1),
  validationYears: z.array(z.number().int()),
  bundlePath: z.string().min(1),
  manifestPath: z.string().min(1),
});
export type ImportedTrainingBundleRegistryEntry = z.infer<typeof importedTrainingBundleRegistryEntrySchema>;

export const importedTrainingBundleRegistrySchema = z.object({
  manifestType: z.literal("training-result-registry"),
  generatedAt: z.string().datetime(),
  latestBundleId: z.string().nullable(),
  bundles: z.array(importedTrainingBundleRegistryEntrySchema),
});
export type ImportedTrainingBundleRegistry = z.infer<typeof importedTrainingBundleRegistrySchema>;
