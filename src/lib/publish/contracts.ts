import { z } from "zod";

export const publishModeSchema = z.enum(["file", "signed-http", "blob-put", "blob-plan", "git"]);
export type PublishMode = z.infer<typeof publishModeSchema>;

export const publishDatasetNameSchema = z.enum([
  "current-state",
  "today-snapshot",
  "live-scoreboard",
  "simulation-input",
  "simulation-result",
]);
export type PublishDatasetName = z.infer<typeof publishDatasetNameSchema>;

export const freshnessEntrySchema = z.object({
  dataset: z.string(),
  fetchedAt: z.string().nullable(),
  sourceId: z.string().nullable(),
  stale: z.boolean(),
});
export type FreshnessEntry = z.infer<typeof freshnessEntrySchema>;

export const currentManifestSchema = z.object({
  manifestType: z.literal("current"),
  publishedAt: z.string(),
  dataVersion: z.string(),
  scheduleVersion: z.string().nullable(),
  scoreboardVersion: z.string().nullable(),
  standingsVersion: z.string().nullable(),
  simulationVersion: z.string().nullable(),
  hasLiveGames: z.boolean(),
  allGamesFinal: z.boolean(),
  changedGames: z.array(z.string()),
  freshnessByDataset: z.array(freshnessEntrySchema),
  simulationFreshness: z.enum(["fresh", "waiting-for-final", "stale"]),
});
export type CurrentManifest = z.infer<typeof currentManifestSchema>;

export const todayManifestSchema = z.object({
  manifestType: z.literal("today"),
  publishedAt: z.string(),
  dataVersion: z.string(),
  scheduleVersion: z.string().nullable(),
  scoreboardVersion: z.string().nullable(),
  hasLiveGames: z.boolean(),
  allGamesFinal: z.boolean(),
  changedGames: z.array(z.string()),
  freshnessByDataset: z.array(freshnessEntrySchema),
});
export type TodayManifest = z.infer<typeof todayManifestSchema>;

export const simulationManifestSchema = z.object({
  manifestType: z.literal("simulation"),
  publishedAt: z.string(),
  dataVersion: z.string(),
  simulationVersion: z.string().nullable(),
  standingsVersion: z.string().nullable(),
  scheduleVersion: z.string().nullable(),
  recomputedBecause: z.array(z.string()),
  freshnessByDataset: z.array(freshnessEntrySchema),
});
export type SimulationManifest = z.infer<typeof simulationManifestSchema>;

export const publishManifestSchema = z.discriminatedUnion("manifestType", [
  currentManifestSchema,
  todayManifestSchema,
  simulationManifestSchema,
]);
export type PublishManifest = z.infer<typeof publishManifestSchema>;

export type PublishPayloadMap = {
  "current-state": unknown;
  "today-snapshot": unknown;
  "live-scoreboard": unknown;
  "simulation-input": unknown;
  "simulation-result": unknown;
};

export type PublishArtifact<TDataset extends PublishDatasetName = PublishDatasetName> = {
  dataset: TDataset;
  payload: PublishPayloadMap[TDataset];
  version: string;
};

export type PublishResult = {
  mode: PublishMode;
  published: boolean;
  target: string;
};

export const blobUploadPlanItemSchema = z.object({
  path: z.string(),
  uploadUrl: z.string().url(),
  publicUrl: z.string().url().nullable(),
  method: z.enum(["PUT"]),
  headers: z.record(z.string()),
});
export type BlobUploadPlanItem = z.infer<typeof blobUploadPlanItemSchema>;

export const blobUploadPlanRequestItemSchema = z.object({
  path: z.string(),
  contentType: z.string().default("application/json"),
});
export type BlobUploadPlanRequestItem = z.infer<typeof blobUploadPlanRequestItemSchema>;

export const blobUploadPlanResponseSchema = z.object({
  generatedAt: z.string(),
  items: z.array(blobUploadPlanItemSchema),
});
export type BlobUploadPlanResponse = z.infer<typeof blobUploadPlanResponseSchema>;

export interface Publisher {
  mode: PublishMode;
  publishArtifacts(artifacts: PublishArtifact[], manifests: PublishManifest[]): Promise<PublishResult[]>;
}
