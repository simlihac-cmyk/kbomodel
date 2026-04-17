import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  collectRelativeFiles,
  describeFiles,
  inferTrainingResultFileKind,
} from "@/lib/training/kbo/transfer";
import {
  importedTrainingBundleRegistrySchema,
  trainingInputPackageManifestSchema,
  trainingResultBundleManifestSchema,
} from "@/lib/training/kbo/transfer-types";

describe("training transfer helpers", () => {
  it("collects relative files with normalized nested paths", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "kbo-training-transfer-"));
    await fs.mkdir(path.join(tempRoot, "nested"), { recursive: true });
    await fs.writeFile(path.join(tempRoot, "a.txt"), "alpha", "utf8");
    await fs.writeFile(path.join(tempRoot, "nested", "b.txt"), "beta", "utf8");

    const files = await collectRelativeFiles(tempRoot);
    const descriptions = await describeFiles(tempRoot, files);

    expect(files).toEqual(["a.txt", "nested/b.txt"]);
    expect(descriptions.map((file) => file.relativePath)).toEqual(["a.txt", "nested/b.txt"]);
    expect(descriptions.every((file) => file.sha256.length === 64)).toBe(true);
  });

  it("infers result file kind from conventional filenames", () => {
    expect(inferTrainingResultFileKind("parameters.json")).toBe("parameters");
    expect(inferTrainingResultFileKind("calibration.json")).toBe("calibration");
    expect(inferTrainingResultFileKind("backtest-summary.json")).toBe("backtest");
    expect(inferTrainingResultFileKind("notes.md")).toBe("notes");
    expect(inferTrainingResultFileKind("reports/metrics.csv")).toBe("auxiliary");
  });
});

describe("training transfer schemas", () => {
  it("accepts a training input package manifest", () => {
    const manifest = trainingInputPackageManifestSchema.parse({
      manifestType: "training-input-package",
      packageId: "kbo-training-input-20260417T150000Z",
      generatedAt: "2026-04-17T06:00:00.000Z",
      gitCommit: "abc123",
      gitBranch: "main",
      nodeVersion: "v25.6.1",
      packageManager: "pnpm",
      years: [2021, 2022, 2023, 2024, 2025],
      suggestedSplit: {
        trainYears: [2021, 2022, 2023, 2024],
        validationYears: [2025],
      },
      sourcePaths: {
        historyTrainingRoot: "/tmp/history-training",
        trainingCorpusRoot: "/tmp/training-corpus",
      },
      files: [
        {
          relativePath: "inputs/history-training/2025.json",
          bytes: 123,
          sha256: "a".repeat(64),
        },
      ],
    });

    expect(manifest.packageId).toContain("kbo-training-input");
  });

  it("accepts a training result bundle manifest and registry", () => {
    const manifest = trainingResultBundleManifestSchema.parse({
      manifestType: "training-result-bundle",
      bundleId: "kbo-training-result-20260417T150000Z",
      createdAt: "2026-04-17T06:30:00.000Z",
      sourcePackageId: "kbo-training-input-20260417T150000Z",
      sourceGitCommit: "abc123",
      trainYears: [2021, 2022, 2023, 2024],
      validationYears: [2025],
      trainer: {
        machineLabel: "macbook-pro",
        nodeVersion: "v25.6.1",
      },
      files: [
        {
          kind: "parameters",
          relativePath: "parameters.json",
          bytes: 100,
          sha256: "b".repeat(64),
        },
        {
          kind: "backtest",
          relativePath: "backtest-summary.json",
          bytes: 200,
          sha256: "c".repeat(64),
        },
      ],
    });

    const registry = importedTrainingBundleRegistrySchema.parse({
      manifestType: "training-result-registry",
      generatedAt: "2026-04-17T07:00:00.000Z",
      latestBundleId: manifest.bundleId,
      bundles: [
        {
          bundleId: manifest.bundleId,
          importedAt: "2026-04-17T07:00:00.000Z",
          sourcePackageId: manifest.sourcePackageId,
          sourceGitCommit: manifest.sourceGitCommit,
          trainYears: manifest.trainYears,
          validationYears: manifest.validationYears,
          bundlePath: "/tmp/model-training/bundles/kbo-training-result-20260417T150000Z",
          manifestPath: "/tmp/model-training/bundles/kbo-training-result-20260417T150000Z/manifest.json",
        },
      ],
    });

    expect(registry.latestBundleId).toBe(manifest.bundleId);
  });
});
