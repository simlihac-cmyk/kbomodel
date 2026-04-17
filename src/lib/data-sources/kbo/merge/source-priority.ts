import type { DatasetId } from "@/lib/data-sources/kbo/dataset-types";
import type { SourceRegistryEntry } from "@/lib/data-sources/kbo/source-registry";

export function resolveSourcePriority(
  datasetId: DatasetId,
  registry: SourceRegistryEntry[],
  enabledOnly = true,
) {
  return registry
    .filter((entry) => entry.datasetId === datasetId)
    .filter((entry) => (enabledOnly ? entry.enabled : true))
    .sort((left, right) => left.priority - right.priority);
}

export function pickPreferredSource(
  datasetId: DatasetId,
  registry: SourceRegistryEntry[],
  availableSourceIds: string[],
) {
  return resolveSourcePriority(datasetId, registry).find((entry) => availableSourceIds.includes(entry.sourceId)) ?? null;
}
