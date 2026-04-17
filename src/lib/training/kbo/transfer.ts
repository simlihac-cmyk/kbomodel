import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import type { TrainingArtifactFile, TrainingResultFileKind } from "@/lib/training/kbo/transfer-types";

export const KBO_TRAINING_PACKAGE_ROOT = path.join(process.cwd(), "artifacts", "kbo-training-packages");
export const KBO_TRAINING_RESULT_ROOT = path.join(process.cwd(), "artifacts", "kbo-training-results");
export const KBO_IMPORTED_MODEL_ROOT = path.join(process.cwd(), "data", "normalized", "kbo", "model-training");

export function normalizeRelativePath(relativePath: string) {
  return relativePath.split(path.sep).join("/");
}

export function buildTimestampId(prefix: string) {
  const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return `${prefix}-${now}`;
}

export async function readJsonFile<T = unknown>(filePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(filePath, "utf8")) as T;
}

export async function writeJsonFile(filePath: string, payload: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

export async function collectRelativeFiles(root: string): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      const nested = await collectRelativeFiles(entryPath);
      for (const nestedRelativePath of nested) {
        files.push(normalizeRelativePath(path.join(entry.name, nestedRelativePath)));
      }
      continue;
    }
    if (entry.isFile()) {
      files.push(normalizeRelativePath(entry.name));
    }
  }

  return files;
}

export async function copyRelativeFiles(sourceRoot: string, destinationRoot: string, relativePaths: string[]) {
  for (const relativePath of relativePaths) {
    const normalizedRelativePath = normalizeRelativePath(relativePath);
    const sourcePath = path.join(sourceRoot, normalizedRelativePath);
    const destinationPath = path.join(destinationRoot, normalizedRelativePath);
    await fs.mkdir(path.dirname(destinationPath), { recursive: true });
    await fs.copyFile(sourcePath, destinationPath);
  }
}

export async function describeFile(root: string, relativePath: string): Promise<TrainingArtifactFile> {
  const normalizedRelativePath = normalizeRelativePath(relativePath);
  const filePath = path.join(root, normalizedRelativePath);
  const buffer = await fs.readFile(filePath);
  const sha256 = createHash("sha256").update(buffer).digest("hex");

  return {
    relativePath: normalizedRelativePath,
    bytes: buffer.byteLength,
    sha256,
  };
}

export async function describeFiles(root: string, relativePaths: string[]): Promise<TrainingArtifactFile[]> {
  const files = await Promise.all(relativePaths.map((relativePath) => describeFile(root, relativePath)));
  return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

export function inferTrainingResultFileKind(relativePath: string): TrainingResultFileKind {
  const baseName = path.basename(relativePath).toLowerCase();
  if (baseName === "parameters.json") {
    return "parameters";
  }
  if (baseName === "calibration.json") {
    return "calibration";
  }
  if (baseName === "backtest-summary.json") {
    return "backtest";
  }
  if (baseName === "notes.md" || baseName === "notes.txt") {
    return "notes";
  }
  return "auxiliary";
}
