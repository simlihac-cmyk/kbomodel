import { fetchOfficialHistoricalTeamRecordPages } from "@/lib/data-sources/kbo/fetch/historical-team-record-pages";
import { fetchHtml, type FetchHtmlResult } from "@/lib/data-sources/kbo/fetch/fetch-html";
import type { DatasetId } from "@/lib/data-sources/kbo/dataset-types";

export async function fetchSnapshotForKboDataset(
  datasetId: DatasetId,
  sourceUrl: string,
): Promise<FetchHtmlResult> {
  if (datasetId === "historical-team-record") {
    return fetchOfficialHistoricalTeamRecordPages();
  }

  return fetchHtml(sourceUrl);
}
