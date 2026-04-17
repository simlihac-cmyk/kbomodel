import { parseOfficialEnPlayerSearch } from "@/lib/data-sources/kbo/adapters/official-en/player-search";
import { parseOfficialEnPlayerSplitsMonthHitter } from "@/lib/data-sources/kbo/adapters/official-en/player-splits-month-hitter";
import { parseOfficialEnPlayerSplitsMonthPitcher } from "@/lib/data-sources/kbo/adapters/official-en/player-splits-month-pitcher";
import { parseOfficialEnPlayerSituationsHitter } from "@/lib/data-sources/kbo/adapters/official-en/player-situations-hitter";
import { parseOfficialEnPlayerSituationsPitcher } from "@/lib/data-sources/kbo/adapters/official-en/player-situations-pitcher";
import { parseOfficialEnPlayerSituationsCountHitter } from "@/lib/data-sources/kbo/adapters/official-en/player-situations-count-hitter";
import { parseOfficialEnPlayerSituationsCountPitcher } from "@/lib/data-sources/kbo/adapters/official-en/player-situations-count-pitcher";
import { parseOfficialEnPlayerSituationsRunnerHitter } from "@/lib/data-sources/kbo/adapters/official-en/player-situations-runner-hitter";
import { parseOfficialEnPlayerSituationsRunnerPitcher } from "@/lib/data-sources/kbo/adapters/official-en/player-situations-runner-pitcher";
import { parseOfficialEnPlayerSituationsOutHitter } from "@/lib/data-sources/kbo/adapters/official-en/player-situations-out-hitter";
import { parseOfficialEnPlayerSituationsOutPitcher } from "@/lib/data-sources/kbo/adapters/official-en/player-situations-out-pitcher";
import { parseOfficialEnPlayerSituationsInningHitter } from "@/lib/data-sources/kbo/adapters/official-en/player-situations-inning-hitter";
import { parseOfficialEnPlayerSituationsInningPitcher } from "@/lib/data-sources/kbo/adapters/official-en/player-situations-inning-pitcher";
import { parseOfficialEnPlayerSituationsBattingOrderHitter } from "@/lib/data-sources/kbo/adapters/official-en/player-situations-batting-order-hitter";
import { parseOfficialEnPlayerSituationsBattingOrderPitcher } from "@/lib/data-sources/kbo/adapters/official-en/player-situations-batting-order-pitcher";
import { parseOfficialKoRegisterAll } from "@/lib/data-sources/kbo/adapters/official-ko/register-all";
import { checksumHtml } from "@/lib/data-sources/kbo/fetch/fetch-cache";
import { fetchOfficialEnPlayerSearchFiltered } from "@/lib/data-sources/kbo/fetch/fetch-english-player-search";
import { fetchHtml } from "@/lib/data-sources/kbo/fetch/fetch-html";
import { normalizePlayerSplitStats } from "@/lib/data-sources/kbo/normalize/player-split-stats";
import type { PlayerSeasonStat } from "@/lib/domain/kbo/types";
import type {
  NormalizedSourceReference,
  ParsedPlayerSearchRow,
  ParsedPlayerSituationHitterRow,
  ParsedPlayerSituationPitcherRow,
  ParsedPlayerSplitMonthHitterRow,
  ParsedPlayerSplitMonthPitcherRow,
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
const FULL_MODE_HITTER_SPLIT_LIMIT = 60;
const FULL_MODE_PITCHER_SPLIT_LIMIT = 40;
const REGISTER_ALL_URL = "https://www.koreabaseball.com/Player/RegisterAll.aspx";
const PLAYER_SPLITS_PARSER_VERSION = "2026-04-15-en-player-splits-month-v1";

function normalizeName(value: string | null | undefined) {
  return (value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function buildSplitsMonthUrl(pathname: string) {
  const base = pathname.startsWith("http") ? pathname : new URL(pathname, "https://eng.koreabaseball.com").toString();
  return base.replace("/Summary.aspx?", "/SplitsMonth.aspx?");
}

function buildSituationsUrl(pathname: string, statType: "hitter" | "pitcher") {
  const base = pathname.startsWith("http") ? pathname : new URL(pathname, "https://eng.koreabaseball.com").toString();
  return statType === "hitter"
    ? base.replace("/Summary.aspx?", "/SituationsPitcher.aspx?")
    : base.replace("/Summary.aspx?", "/SituationsBatter.aspx?");
}

function buildSituationsCountUrl(pathname: string) {
  const base = pathname.startsWith("http") ? pathname : new URL(pathname, "https://eng.koreabaseball.com").toString();
  return base.replace("/Summary.aspx?", "/SituationsCount.aspx?");
}

function buildSituationsRunnerUrl(pathname: string) {
  const base = pathname.startsWith("http") ? pathname : new URL(pathname, "https://eng.koreabaseball.com").toString();
  return base.replace("/Summary.aspx?", "/SituationsRunner.aspx?");
}

function buildSituationsOutUrl(pathname: string) {
  const base = pathname.startsWith("http") ? pathname : new URL(pathname, "https://eng.koreabaseball.com").toString();
  return base.replace("/Summary.aspx?", "/SituationsOut.aspx?");
}

function buildSituationsInningUrl(pathname: string) {
  const base = pathname.startsWith("http") ? pathname : new URL(pathname, "https://eng.koreabaseball.com").toString();
  return base.replace("/Summary.aspx?", "/SituationsInning.aspx?");
}

function buildSituationsBattingOrderUrl(pathname: string) {
  const base = pathname.startsWith("http") ? pathname : new URL(pathname, "https://eng.koreabaseball.com").toString();
  return base.replace("/Summary.aspx?", "/SituationsBattingOrder.aspx?");
}

async function fetchInBatches<TEntry extends { pcode: string; playerUrl: string }, TRow>(
  entries: TEntry[],
  datasetId:
    | "player-splits-month-hitter"
    | "player-splits-month-pitcher"
    | "player-situations-hitter"
    | "player-situations-pitcher"
    | "player-situations-count-hitter"
    | "player-situations-count-pitcher"
    | "player-situations-runner-hitter"
    | "player-situations-runner-pitcher"
    | "player-situations-out-hitter"
    | "player-situations-out-pitcher"
    | "player-situations-inning-hitter"
    | "player-situations-inning-pitcher"
    | "player-situations-batting-order-hitter"
    | "player-situations-batting-order-pitcher",
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
            parserVersion: PLAYER_SPLITS_PARSER_VERSION,
            fixtureBacked: false,
            html: result.html,
          });
          sourceRefs.push({
            sourceId: "official-kbo-en",
            datasetId,
            snapshotKey: rowSnapshotKey,
            parserVersion: PLAYER_SPLITS_PARSER_VERSION,
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
        parserVersion: PLAYER_SPLITS_PARSER_VERSION,
        fixtureBacked: false,
        html: result.html,
      });
      sourceRefs.push({
        sourceId: "official-kbo-en",
        datasetId: "player-search",
        snapshotKey: filteredSnapshotKey,
        parserVersion: PLAYER_SPLITS_PARSER_VERSION,
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
    ...pickTopStats(currentSeasonStats, "hitter", FULL_MODE_HITTER_SPLIT_LIMIT),
    ...pickTopStats(currentSeasonStats, "pitcher", FULL_MODE_PITCHER_SPLIT_LIMIT),
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
    .map((row) => ({ pcode: row.pcode, playerUrl: buildSplitsMonthUrl(row.playerUrl!) }));
  const pitcherEntries = uniqueEntries
    .filter((row) => row.statType === "pitcher")
    .map((row) => ({ pcode: row.pcode, playerUrl: buildSplitsMonthUrl(row.playerUrl!) }));
  const hitterSituationEntries = uniqueEntries
    .filter((row) => row.statType === "hitter")
    .map((row) => ({ pcode: row.pcode, playerUrl: buildSituationsUrl(row.playerUrl!, "hitter") }));
  const pitcherSituationEntries = uniqueEntries
    .filter((row) => row.statType === "pitcher")
    .map((row) => ({ pcode: row.pcode, playerUrl: buildSituationsUrl(row.playerUrl!, "pitcher") }));
  const hitterCountEntries = uniqueEntries
    .filter((row) => row.statType === "hitter")
    .map((row) => ({ pcode: row.pcode, playerUrl: buildSituationsCountUrl(row.playerUrl!) }));
  const pitcherCountEntries = uniqueEntries
    .filter((row) => row.statType === "pitcher")
    .map((row) => ({ pcode: row.pcode, playerUrl: buildSituationsCountUrl(row.playerUrl!) }));
  const hitterRunnerEntries = uniqueEntries
    .filter((row) => row.statType === "hitter")
    .map((row) => ({ pcode: row.pcode, playerUrl: buildSituationsRunnerUrl(row.playerUrl!) }));
  const pitcherRunnerEntries = uniqueEntries
    .filter((row) => row.statType === "pitcher")
    .map((row) => ({ pcode: row.pcode, playerUrl: buildSituationsRunnerUrl(row.playerUrl!) }));
  const hitterOutEntries = uniqueEntries
    .filter((row) => row.statType === "hitter")
    .map((row) => ({ pcode: row.pcode, playerUrl: buildSituationsOutUrl(row.playerUrl!) }));
  const pitcherOutEntries = uniqueEntries
    .filter((row) => row.statType === "pitcher")
    .map((row) => ({ pcode: row.pcode, playerUrl: buildSituationsOutUrl(row.playerUrl!) }));
  const hitterInningEntries = uniqueEntries
    .filter((row) => row.statType === "hitter")
    .map((row) => ({ pcode: row.pcode, playerUrl: buildSituationsInningUrl(row.playerUrl!) }));
  const pitcherInningEntries = uniqueEntries
    .filter((row) => row.statType === "pitcher")
    .map((row) => ({ pcode: row.pcode, playerUrl: buildSituationsInningUrl(row.playerUrl!) }));
  const hitterBattingOrderEntries = uniqueEntries
    .filter((row) => row.statType === "hitter")
    .map((row) => ({ pcode: row.pcode, playerUrl: buildSituationsBattingOrderUrl(row.playerUrl!) }));
  const pitcherBattingOrderEntries = uniqueEntries
    .filter((row) => row.statType === "pitcher")
    .map((row) => ({ pcode: row.pcode, playerUrl: buildSituationsBattingOrderUrl(row.playerUrl!) }));

  const [hitterRows, pitcherRows, registerResult] = await Promise.all([
    fetchInBatches<typeof hitterEntries[number], ParsedPlayerSplitMonthHitterRow>(
      hitterEntries,
      "player-splits-month-hitter",
      parseOfficialEnPlayerSplitsMonthHitter,
      snapshotKey,
      rawRepository,
      sourceRefs,
    ),
    fetchInBatches<typeof pitcherEntries[number], ParsedPlayerSplitMonthPitcherRow>(
      pitcherEntries,
      "player-splits-month-pitcher",
      parseOfficialEnPlayerSplitsMonthPitcher,
      snapshotKey,
      rawRepository,
      sourceRefs,
    ),
    fetchHtml(REGISTER_ALL_URL),
  ]);

  const [
    hitterSituationRows,
    pitcherSituationRows,
    hitterCountRows,
    pitcherCountRows,
    hitterRunnerRows,
    pitcherRunnerRows,
    hitterOutRows,
    pitcherOutRows,
    hitterInningRows,
    pitcherInningRows,
    hitterBattingOrderRows,
    pitcherBattingOrderRows,
  ] = await Promise.all([
    fetchInBatches<typeof hitterEntries[number], ParsedPlayerSituationHitterRow>(
      hitterSituationEntries,
      "player-situations-hitter",
      parseOfficialEnPlayerSituationsHitter,
      snapshotKey,
      rawRepository,
      sourceRefs,
    ),
    fetchInBatches<typeof pitcherEntries[number], ParsedPlayerSituationPitcherRow>(
      pitcherSituationEntries,
      "player-situations-pitcher",
      parseOfficialEnPlayerSituationsPitcher,
      snapshotKey,
      rawRepository,
      sourceRefs,
    ),
    fetchInBatches<typeof hitterEntries[number], ParsedPlayerSituationHitterRow>(
      hitterCountEntries,
      "player-situations-count-hitter",
      parseOfficialEnPlayerSituationsCountHitter,
      snapshotKey,
      rawRepository,
      sourceRefs,
    ),
    fetchInBatches<typeof pitcherEntries[number], ParsedPlayerSituationPitcherRow>(
      pitcherCountEntries,
      "player-situations-count-pitcher",
      parseOfficialEnPlayerSituationsCountPitcher,
      snapshotKey,
      rawRepository,
      sourceRefs,
    ),
    fetchInBatches<typeof hitterEntries[number], ParsedPlayerSituationHitterRow>(
      hitterRunnerEntries,
      "player-situations-runner-hitter",
      parseOfficialEnPlayerSituationsRunnerHitter,
      snapshotKey,
      rawRepository,
      sourceRefs,
    ),
    fetchInBatches<typeof pitcherEntries[number], ParsedPlayerSituationPitcherRow>(
      pitcherRunnerEntries,
      "player-situations-runner-pitcher",
      parseOfficialEnPlayerSituationsRunnerPitcher,
      snapshotKey,
      rawRepository,
      sourceRefs,
    ),
    fetchInBatches<typeof hitterEntries[number], ParsedPlayerSituationHitterRow>(
      hitterOutEntries,
      "player-situations-out-hitter",
      parseOfficialEnPlayerSituationsOutHitter,
      snapshotKey,
      rawRepository,
      sourceRefs,
    ),
    fetchInBatches<typeof pitcherEntries[number], ParsedPlayerSituationPitcherRow>(
      pitcherOutEntries,
      "player-situations-out-pitcher",
      parseOfficialEnPlayerSituationsOutPitcher,
      snapshotKey,
      rawRepository,
      sourceRefs,
    ),
    fetchInBatches<typeof hitterEntries[number], ParsedPlayerSituationHitterRow>(
      hitterInningEntries,
      "player-situations-inning-hitter",
      parseOfficialEnPlayerSituationsInningHitter,
      snapshotKey,
      rawRepository,
      sourceRefs,
    ),
    fetchInBatches<typeof pitcherEntries[number], ParsedPlayerSituationPitcherRow>(
      pitcherInningEntries,
      "player-situations-inning-pitcher",
      parseOfficialEnPlayerSituationsInningPitcher,
      snapshotKey,
      rawRepository,
      sourceRefs,
    ),
    fetchInBatches<typeof hitterEntries[number], ParsedPlayerSituationHitterRow>(
      hitterBattingOrderEntries,
      "player-situations-batting-order-hitter",
      parseOfficialEnPlayerSituationsBattingOrderHitter,
      snapshotKey,
      rawRepository,
      sourceRefs,
    ),
    fetchInBatches<typeof pitcherEntries[number], ParsedPlayerSituationPitcherRow>(
      pitcherBattingOrderEntries,
      "player-situations-batting-order-pitcher",
      parseOfficialEnPlayerSituationsBattingOrderPitcher,
      snapshotKey,
      rawRepository,
      sourceRefs,
    ),
  ]);

  await rawRepository.saveSnapshot({
    sourceId: "official-kbo-ko",
    datasetId: "player-register-all",
    snapshotKey,
    fetchedAt: registerResult.fetchedAt,
    sourceUrl: registerResult.sourceUrl,
    httpStatus: registerResult.httpStatus,
    checksum: registerResult.checksum ?? checksumHtml(registerResult.html),
    parserVersion: PLAYER_SPLITS_PARSER_VERSION,
    fixtureBacked: false,
    html: registerResult.html,
  });
  sourceRefs.push({
    sourceId: "official-kbo-ko",
    datasetId: "player-register-all",
    snapshotKey,
    parserVersion: PLAYER_SPLITS_PARSER_VERSION,
  });

  const normalized = normalizePlayerSplitStats({
    seasonId: season.seasonId,
    sourceId: "official-kbo-en",
    hitters: hitterRows,
    pitchers: pitcherRows,
    hitterSituations: [
      ...hitterSituationRows,
      ...hitterCountRows,
      ...hitterRunnerRows,
      ...hitterOutRows,
      ...hitterInningRows,
      ...hitterBattingOrderRows,
    ],
    pitcherSituations: [
      ...pitcherSituationRows,
      ...pitcherCountRows,
      ...pitcherRunnerRows,
      ...pitcherOutRows,
      ...pitcherInningRows,
      ...pitcherBattingOrderRows,
    ],
    registerRows: parseOfficialKoRegisterAll(registerResult.html),
    bundle,
    patches,
    sourceRefs,
  });

  await normalizedRepository.saveDatasetOutput("player-split-stats", `${season.year}-${snapshotKey}`, normalized);
  const publishedBundle = await buildPublishedKboBundleFromNormalized();
  await writePublishedKboBundle(publishedBundle);
  console.log(`Published ${normalized.rows.length} official player split rows into the current KBO bundle.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
