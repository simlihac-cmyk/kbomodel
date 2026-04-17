import { FileRawSourceRepository } from "@/lib/repositories/kbo/raw-source-repository";
import type { FreshnessEntry } from "@/lib/publish/contracts";
import type { DatasetId, SourceId } from "@/lib/data-sources/kbo/dataset-types";

type FreshnessSourceTarget = {
  dataset: string;
  sourceId: SourceId;
  datasetId: DatasetId;
  staleAfterMs: number;
};

export async function buildFreshnessEntries(targets: FreshnessSourceTarget[]): Promise<FreshnessEntry[]> {
  const repository = new FileRawSourceRepository();
  const now = Date.now();

  return Promise.all(
    targets.map(async (target) => {
      const snapshot = await repository.getLatestSnapshot(target.sourceId, target.datasetId);
      const fetchedAt = snapshot?.fetchedAt ?? null;
      const stale = !fetchedAt || now - new Date(fetchedAt).getTime() > target.staleAfterMs;

      return {
        dataset: target.dataset,
        fetchedAt,
        sourceId: snapshot?.sourceId ?? null,
        stale,
      } satisfies FreshnessEntry;
    }),
  );
}
