import { fetchHtml } from "@/lib/data-sources/kbo/fetch/fetch-html";
import { checksumHtml } from "@/lib/data-sources/kbo/fetch/fetch-cache";
import type { DatasetId } from "@/lib/data-sources/kbo/dataset-types";
import { fetchOfficialKoSeasonScheduleService } from "@/lib/data-sources/kbo/fetch/fetch-korean-schedule-service";
import { refreshOfficialEnPlayerSeasonStats } from "@/lib/data-sources/kbo/pipeline/refresh-player-stats";
import { kboSourceRegistry } from "@/lib/data-sources/kbo/source-registry";
import { FileKboIngestPatchRepository } from "@/lib/repositories/kbo/patch-repository";
import { FileNormalizedKboRepository } from "@/lib/repositories/kbo/normalized-repository";
import { FileRawSourceRepository } from "@/lib/repositories/kbo/raw-source-repository";
import { buildPublishedKboBundleFromNormalized, loadFixtureSourceKboBundle, writePublishedKboBundle } from "@/lib/repositories/kbo/published-bundle";
import { getKboDateKey } from "@/lib/scheduler/kbo/windows";

const CURRENT_SEASON_DATASETS: DatasetId[] = [
  "schedule-calendar",
  "standings",
  "scoreboard",
  "player-register-all",
  "team-hitter",
  "team-pitcher",
];

export async function refreshCurrentLiveBundle() {
  const rawRepository = new FileRawSourceRepository();
  const normalizedRepository = new FileNormalizedKboRepository();
  const patchRepository = new FileKboIngestPatchRepository();
  const bundle = await loadFixtureSourceKboBundle();
  const season =
    [...bundle.seasons].sort((left, right) => right.year - left.year).find((item) => item.status === "ongoing") ??
    [...bundle.seasons].sort((left, right) => right.year - left.year)[0];
  const patches = await patchRepository.getManualSourcePatches();
  const snapshotKey = getKboDateKey();

  for (const datasetId of CURRENT_SEASON_DATASETS) {
    const preferredSourceId =
      datasetId === "schedule-calendar" || datasetId === "player-register-all" || datasetId === "team-hitter" || datasetId === "team-pitcher"
        ? "official-kbo-ko"
        : "official-kbo-en";
    const entry = kboSourceRegistry
      .filter((item) => item.datasetId === datasetId && item.enabled && item.sourceId === preferredSourceId)
      .sort((left, right) => left.priority - right.priority)[0];

    if (!entry || !entry.normalizer || !entry.normalizedTarget) {
      throw new Error(`No live ingest entry is configured for ${datasetId}`);
    }

    const result =
      datasetId === "schedule-calendar"
        ? await (async () => {
            const seasonSchedule = await fetchOfficialKoSeasonScheduleService(season.year);
            const html = JSON.stringify(seasonSchedule, null, 2);
            return {
              html,
              fetchedAt: new Date().toISOString(),
              httpStatus: 200,
              checksum: checksumHtml(html),
              sourceUrl: "https://www.koreabaseball.com/ws/Schedule.asmx/GetScheduleList",
            };
          })()
        : await fetchHtml(entry.sourceUrl);

    await rawRepository.saveSnapshot({
      sourceId: entry.sourceId,
      datasetId: entry.datasetId,
      snapshotKey,
      fetchedAt: result.fetchedAt,
      sourceUrl: result.sourceUrl,
      httpStatus: result.httpStatus,
      checksum: result.checksum ?? checksumHtml(result.html),
      parserVersion: entry.parserVersion,
      fixtureBacked: false,
      html: result.html,
    });

    const parsed = entry.parser(result.html) as never;
    const normalized = entry.normalizer({
      seasonId: season.seasonId,
      parsed,
      bundle,
      patches,
      sourceRef: {
        sourceId: entry.sourceId,
        datasetId: entry.datasetId,
        snapshotKey,
        parserVersion: entry.parserVersion,
      },
    }) as never;

    await normalizedRepository.saveDatasetOutput(entry.normalizedTarget, `${season.year}-${snapshotKey}`, normalized);
  }

  await refreshOfficialEnPlayerSeasonStats({
    seasonId: season.seasonId,
    seasonYear: season.year,
    bundle,
    patches,
    snapshotKey,
    rawRepository,
    normalizedRepository,
  });

  const publishedBundle = await buildPublishedKboBundleFromNormalized();
  await writePublishedKboBundle(publishedBundle);
}
