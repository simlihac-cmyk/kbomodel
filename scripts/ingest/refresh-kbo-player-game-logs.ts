import { parseOfficialEnPlayerSearch } from "@/lib/data-sources/kbo/adapters/official-en/player-search";
import { parseOfficialEnPlayerGameLogsHitter } from "@/lib/data-sources/kbo/adapters/official-en/player-game-logs-hitter";
import { parseOfficialEnPlayerGameLogsPitcher } from "@/lib/data-sources/kbo/adapters/official-en/player-game-logs-pitcher";
import { parseOfficialKoRegisterAll } from "@/lib/data-sources/kbo/adapters/official-ko/register-all";
import { checksumHtml } from "@/lib/data-sources/kbo/fetch/fetch-cache";
import { fetchOfficialEnPlayerSearchFiltered } from "@/lib/data-sources/kbo/fetch/fetch-english-player-search";
import { fetchHtml } from "@/lib/data-sources/kbo/fetch/fetch-html";
import { normalizePlayerGameStats } from "@/lib/data-sources/kbo/normalize/player-game-stats";
import type {
  NormalizedPlayerGameStats,
  NormalizedSourceReference,
  ParsedPlayerGameLogHitterRow,
  ParsedPlayerGameLogPitcherRow,
  ParsedPlayerSearchRow,
} from "@/lib/data-sources/kbo/dataset-types";
import { FileKboRepository } from "@/lib/repositories/kbo/file-adapter";
import { FileKboIngestPatchRepository } from "@/lib/repositories/kbo/patch-repository";
import { FileNormalizedKboRepository } from "@/lib/repositories/kbo/normalized-repository";
import { FileRawSourceRepository } from "@/lib/repositories/kbo/raw-source-repository";
import { buildPublishedKboBundleFromNormalized, writePublishedKboBundle } from "@/lib/repositories/kbo/published-bundle";
import { getKboDateKey } from "@/lib/scheduler/kbo/windows";

const TEAM_CODES = ["lg", "ss", "kt", "sk", "nc", "ht", "hh", "ob", "lt", "wo"] as const;
const POSITION_CODES = [
  { key: "pitcher", value: "1" },
  { key: "catcher", value: "2" },
  { key: "infielder", value: "3,4,5,6" },
  { key: "outfielder", value: "7,8,9" },
] as const;
const REGISTER_ALL_URL = "https://www.koreabaseball.com/Player/RegisterAll.aspx";
const GAME_LOGS_PARSER_VERSION = "2026-04-15-en-player-game-logs-v1";

function parsePositiveInt(value: string | undefined) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Math.floor(parsed);
}

function normalizeName(value: string | null | undefined) {
  return (value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function buildGameLogsUrl(pathname: string) {
  const base = pathname.startsWith("http") ? pathname : new URL(pathname, "https://eng.koreabaseball.com").toString();
  return base.replace("/Summary.aspx?", "/GameLogs.aspx?");
}

async function fetchInBatches<TEntry extends { pcode: string; playerUrl: string }, TRow>(
  entries: TEntry[],
  datasetId: "player-game-logs-hitter" | "player-game-logs-pitcher",
  parser: (html: string) => TRow[],
  snapshotKey: string,
  rawRepository: FileRawSourceRepository,
  sourceRefs: NormalizedSourceReference[],
) {
  const rows: TRow[] = [];
  const batchSize = 4;

  for (let index = 0; index < entries.length; index += batchSize) {
    const batch = entries.slice(index, index + batchSize);
    const results = await Promise.all(
      batch.map(async (entry) => {
        try {
          const result = await fetchHtml(entry.playerUrl);
          const rowSnapshotKey = `${snapshotKey}-${entry.pcode}`;
          await rawRepository.saveSnapshot({
            sourceId: "official-kbo-en",
            datasetId,
            snapshotKey: rowSnapshotKey,
            fetchedAt: result.fetchedAt,
            sourceUrl: result.sourceUrl,
            httpStatus: result.httpStatus,
            checksum: result.checksum ?? checksumHtml(result.html),
            parserVersion: GAME_LOGS_PARSER_VERSION,
            fixtureBacked: false,
            html: result.html,
          });
          sourceRefs.push({
            sourceId: "official-kbo-en",
            datasetId,
            snapshotKey: rowSnapshotKey,
            parserVersion: GAME_LOGS_PARSER_VERSION,
          });
          return parser(result.html);
        } catch (error) {
          console.warn(`Skipped ${datasetId} for pcode=${entry.pcode}:`, error);
          return [];
        }
      }),
    );

    for (const result of results) {
      rows.push(...result);
    }
  }

  return rows;
}

async function loadLatestSeasonPlayerGameStats(
  normalizedRepository: FileNormalizedKboRepository,
  seasonYear: number,
) {
  const keys = await normalizedRepository.listDatasetKeys("player-game-stats");
  const latestKey = keys
    .filter((item) => item.startsWith(`${seasonYear}-`))
    .sort()
    .at(-1);
  if (!latestKey) {
    return null;
  }
  return normalizedRepository.getDatasetOutput("player-game-stats", latestKey);
}

function mergeNormalizedGameStats(existing: NormalizedPlayerGameStats | null, incoming: NormalizedPlayerGameStats) {
  if (!existing) {
    return incoming;
  }

  const targetedPlayerIds = new Set(incoming.rows.map((row) => row.playerId));
  const mergedSources = Array.from(
    new Map(
      [...existing.sources, ...incoming.sources].map((source) => [
        `${source.sourceId}:${source.datasetId}:${source.snapshotKey}:${source.parserVersion}`,
        source,
      ]),
    ).values(),
  );

  return {
    ...incoming,
    sources: mergedSources,
    rows: [...existing.rows.filter((row) => !targetedPlayerIds.has(row.playerId)), ...incoming.rows],
  };
}

async function main() {
  const repository = new FileKboRepository();
  const patchRepository = new FileKboIngestPatchRepository();
  const rawRepository = new FileRawSourceRepository();
  const normalizedRepository = new FileNormalizedKboRepository();
  const [bundle, season, patches] = await Promise.all([
    repository.getBundle(),
    repository.getCurrentSeason(),
    patchRepository.getManualSourcePatches(),
  ]);
  const snapshotKey = getKboDateKey();
  const sourceRefs: NormalizedSourceReference[] = [];
  const limit = parsePositiveInt(process.env.KBO_PLAYER_GAME_LOGS_LIMIT);
  const statTypeFilter =
    process.env.KBO_PLAYER_GAME_LOGS_STAT_TYPE === "hitter" || process.env.KBO_PLAYER_GAME_LOGS_STAT_TYPE === "pitcher"
      ? process.env.KBO_PLAYER_GAME_LOGS_STAT_TYPE
      : "all";
  console.log(
    `[player-game-logs] ${season.year} 시즌 공식 경기 로그 수집을 시작합니다. statType=${statTypeFilter}, limit=${limit ?? "all"}`,
  );

  const searchRows: ParsedPlayerSearchRow[] = [];
  for (const teamCode of TEAM_CODES) {
    for (const positionCode of POSITION_CODES) {
      const result = await fetchOfficialEnPlayerSearchFiltered(teamCode, positionCode.value);
      const filteredSnapshotKey = `${snapshotKey}-${teamCode}-${positionCode.key}`;
      await rawRepository.saveSnapshot({
        sourceId: "official-kbo-en",
        datasetId: "player-search",
        snapshotKey: filteredSnapshotKey,
        fetchedAt: result.fetchedAt,
        sourceUrl: result.sourceUrl,
        httpStatus: result.httpStatus,
        checksum: result.checksum,
        parserVersion: GAME_LOGS_PARSER_VERSION,
        fixtureBacked: false,
        html: result.html,
      });
      sourceRefs.push({
        sourceId: "official-kbo-en",
        datasetId: "player-search",
        snapshotKey: filteredSnapshotKey,
        parserVersion: GAME_LOGS_PARSER_VERSION,
      });
      searchRows.push(...parseOfficialEnPlayerSearch(result.html));
    }
  }

  const uniqueSearchRows = Array.from(new Map(searchRows.map((row) => [row.pcode, row] as const)).values());
  const uniqueEntries = uniqueSearchRows
    .filter((row) => (statTypeFilter === "all" ? true : row.statType === statTypeFilter))
    .filter((row): row is ParsedPlayerSearchRow => row.playerUrl !== null);
  const scopedEntries = limit ? uniqueEntries.slice(0, limit) : uniqueEntries;
  console.log(`[player-game-logs] 경기 로그 대상 선수 ${uniqueEntries.length}명`);

  const hitterEntries = scopedEntries
    .filter((row) => row.statType === "hitter")
    .map((row) => ({ pcode: row.pcode, playerUrl: buildGameLogsUrl(row.playerUrl!) }));
  const pitcherEntries = scopedEntries
    .filter((row) => row.statType === "pitcher")
    .map((row) => ({ pcode: row.pcode, playerUrl: buildGameLogsUrl(row.playerUrl!) }));

  const [hitterRows, pitcherRows, registerResult] = await Promise.all([
    fetchInBatches<typeof hitterEntries[number], ParsedPlayerGameLogHitterRow>(
      hitterEntries,
      "player-game-logs-hitter",
      parseOfficialEnPlayerGameLogsHitter,
      snapshotKey,
      rawRepository,
      sourceRefs,
    ),
    fetchInBatches<typeof pitcherEntries[number], ParsedPlayerGameLogPitcherRow>(
      pitcherEntries,
      "player-game-logs-pitcher",
      parseOfficialEnPlayerGameLogsPitcher,
      snapshotKey,
      rawRepository,
      sourceRefs,
    ),
    fetchHtml(REGISTER_ALL_URL),
  ]);

  await rawRepository.saveSnapshot({
    sourceId: "official-kbo-ko",
    datasetId: "player-register-all",
    snapshotKey,
    fetchedAt: registerResult.fetchedAt,
    sourceUrl: registerResult.sourceUrl,
    httpStatus: registerResult.httpStatus,
    checksum: registerResult.checksum ?? checksumHtml(registerResult.html),
    parserVersion: GAME_LOGS_PARSER_VERSION,
    fixtureBacked: false,
    html: registerResult.html,
  });
  sourceRefs.push({
    sourceId: "official-kbo-ko",
    datasetId: "player-register-all",
    snapshotKey,
    parserVersion: GAME_LOGS_PARSER_VERSION,
  });

  const normalized = normalizePlayerGameStats({
    seasonId: season.seasonId,
    sourceId: "official-kbo-en",
    hitters: hitterRows,
    pitchers: pitcherRows,
    registerRows: parseOfficialKoRegisterAll(registerResult.html),
    searchRows: uniqueSearchRows,
    bundle,
    patches,
    sourceRefs,
  });

  const shouldMergeWithExisting = limit !== null || statTypeFilter !== "all";
  const mergedNormalized =
    shouldMergeWithExisting
      ? mergeNormalizedGameStats(
          await loadLatestSeasonPlayerGameStats(normalizedRepository, season.year),
          normalized,
        )
      : normalized;

  await normalizedRepository.saveDatasetOutput("player-game-stats", `${season.year}-${snapshotKey}`, mergedNormalized);
  const publishedBundle = await buildPublishedKboBundleFromNormalized();
  await writePublishedKboBundle(publishedBundle);
  console.log(`[player-game-logs] Published ${mergedNormalized.rows.length} official player game log rows into the current KBO bundle.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
