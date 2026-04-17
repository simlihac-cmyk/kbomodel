import { parseOfficialEnPlayerSearch } from "@/lib/data-sources/kbo/adapters/official-en/player-search";
import { parseOfficialEnPlayerGameLogsHitter } from "@/lib/data-sources/kbo/adapters/official-en/player-game-logs-hitter";
import { parseOfficialEnPlayerGameLogsPitcher } from "@/lib/data-sources/kbo/adapters/official-en/player-game-logs-pitcher";
import { parseOfficialKoRegisterAll } from "@/lib/data-sources/kbo/adapters/official-ko/register-all";
import { checksumHtml } from "@/lib/data-sources/kbo/fetch/fetch-cache";
import { fetchOfficialEnPlayerSearchFiltered } from "@/lib/data-sources/kbo/fetch/fetch-english-player-search";
import { fetchHtml } from "@/lib/data-sources/kbo/fetch/fetch-html";
import { normalizePlayerGameStats } from "@/lib/data-sources/kbo/normalize/player-game-stats";
import type { PlayerSeasonStat } from "@/lib/domain/kbo/types";
import type {
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
const FULL_MODE_HITTER_GAME_LOG_LIMIT = 60;
const FULL_MODE_PITCHER_GAME_LOG_LIMIT = 40;
const REGISTER_ALL_URL = "https://www.koreabaseball.com/Player/RegisterAll.aspx";
const GAME_LOGS_PARSER_VERSION = "2026-04-15-en-player-game-logs-v1";

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

function pickTopStats(stats: PlayerSeasonStat[], statType: "hitter" | "pitcher", limit: number) {
  return stats
    .filter((item) => item.statType === statType)
    .sort((left, right) => right.games - left.games)
    .slice(0, limit);
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
  const playersById = Object.fromEntries(bundle.players.map((player) => [player.playerId, player]));
  const seasonTeamById = Object.fromEntries(bundle.seasonTeams.map((team) => [team.seasonTeamId, team]));
  const brandById = Object.fromEntries(bundle.teamBrands.map((brand) => [brand.brandId, brand]));
  const currentSeasonStats = bundle.playerSeasonStats.filter((item) => item.seasonId === season.seasonId);

  const desiredStats = [
    ...pickTopStats(currentSeasonStats, "hitter", FULL_MODE_HITTER_GAME_LOG_LIMIT),
    ...pickTopStats(currentSeasonStats, "pitcher", FULL_MODE_PITCHER_GAME_LOG_LIMIT),
  ];

  const matchedEntries = desiredStats
    .map((stat) => {
      const player = playersById[stat.playerId];
      const seasonTeam = seasonTeamById[stat.seasonTeamId];
      const teamCode = brandById[seasonTeam?.brandId ?? ""]?.shortCode?.toLowerCase() ?? "";
      if (!player || !teamCode) {
        return null;
      }
      return (
        uniqueSearchRows.find(
          (row) =>
            row.statType === stat.statType &&
            row.teamName.toLowerCase() === teamCode &&
            normalizeName(row.playerName) === normalizeName(player.nameEn),
        ) ?? null
      );
    })
    .filter((row): row is ParsedPlayerSearchRow => row !== null && row.playerUrl !== null);

  const uniqueEntries = Array.from(new Map(matchedEntries.map((row) => [row.pcode, row] as const)).values());

  const hitterEntries = uniqueEntries
    .filter((row) => row.statType === "hitter")
    .map((row) => ({ pcode: row.pcode, playerUrl: buildGameLogsUrl(row.playerUrl!) }));
  const pitcherEntries = uniqueEntries
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
    bundle,
    patches,
    sourceRefs,
  });

  await normalizedRepository.saveDatasetOutput("player-game-stats", `${season.year}-${snapshotKey}`, normalized);
  const publishedBundle = await buildPublishedKboBundleFromNormalized();
  await writePublishedKboBundle(publishedBundle);
  console.log(`Published ${normalized.rows.length} official player game log rows into the current KBO bundle.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
