import { FileKboIngestPatchRepository } from "@/lib/repositories/kbo/patch-repository";
import { FileNormalizedKboRepository } from "@/lib/repositories/kbo/normalized-repository";
import { FileRawSourceRepository } from "@/lib/repositories/kbo/raw-source-repository";
import { buildPublishedKboBundleFromNormalized, writePublishedKboBundle } from "@/lib/repositories/kbo/published-bundle";
import { refreshOfficialEnPlayerSeasonStats } from "@/lib/data-sources/kbo/pipeline/refresh-player-stats";
import { FileKboRepository } from "@/lib/repositories/kbo/file-adapter";
import { getKboDateKey } from "@/lib/scheduler/kbo/windows";

async function main() {
  const rawRepository = new FileRawSourceRepository();
  const normalizedRepository = new FileNormalizedKboRepository();
  const patchRepository = new FileKboIngestPatchRepository();
  const repository = new FileKboRepository();
  const [bundle, season] = await Promise.all([repository.getBundle(), repository.getCurrentSeason()]);
  const patches = await patchRepository.getManualSourcePatches();
  const snapshotKey = getKboDateKey();
  const mode = process.env.KBO_PLAYER_INGEST_MODE === "partial" ? "partial" : "full";

  console.log(`[player-stats] ${season.year} 시즌 공식 선수 기록 수집을 시작합니다. mode=${mode}`);

  await refreshOfficialEnPlayerSeasonStats({
    seasonId: season.seasonId,
    seasonYear: season.year,
    bundle,
    patches,
    snapshotKey,
    rawRepository,
    normalizedRepository,
    mode,
    logger: (message) => console.log(`[player-stats] ${message}`),
  });

  const publishedBundle = await buildPublishedKboBundleFromNormalized();
  await writePublishedKboBundle(publishedBundle);
  console.log("[player-stats] Published official player stats into the current KBO bundle.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
