import { parseOfficialEnBattingTop5 } from "@/lib/data-sources/kbo/adapters/official-en/batting-top5";
import { parseOfficialEnPitchingTop5 } from "@/lib/data-sources/kbo/adapters/official-en/pitching-top5";
import { parseOfficialEnPlayerSearch } from "@/lib/data-sources/kbo/adapters/official-en/player-search";
import { parseOfficialEnPlayerGameLogsHitter } from "@/lib/data-sources/kbo/adapters/official-en/player-game-logs-hitter";
import { parseOfficialEnPlayerGameLogsPitcher } from "@/lib/data-sources/kbo/adapters/official-en/player-game-logs-pitcher";
import { parseOfficialEnPlayerSummaryHitter } from "@/lib/data-sources/kbo/adapters/official-en/player-summary-hitter";
import { parseOfficialEnPlayerSummaryPitcher } from "@/lib/data-sources/kbo/adapters/official-en/player-summary-pitcher";
import { parseOfficialKoPlayerProfile } from "@/lib/data-sources/kbo/adapters/official-ko/player-profile";
import { parseOfficialKoRegisterAll } from "@/lib/data-sources/kbo/adapters/official-ko/register-all";
import { checksumHtml } from "@/lib/data-sources/kbo/fetch/fetch-cache";
import { fetchOfficialEnPlayerSearchFiltered } from "@/lib/data-sources/kbo/fetch/fetch-english-player-search";
import { fetchHtml } from "@/lib/data-sources/kbo/fetch/fetch-html";
import { normalizePlayerCareerStats } from "@/lib/data-sources/kbo/normalize/player-career-stats";
import { normalizePlayerGameStats } from "@/lib/data-sources/kbo/normalize/player-game-stats";
import { enrichPlayerSeasonStatsWithOfficialKoProfiles } from "@/lib/data-sources/kbo/normalize/player-profiles";
import { normalizePlayerSeasonStats } from "@/lib/data-sources/kbo/normalize/player-season-stats";
import type { KboDataBundle } from "@/lib/domain/kbo/types";
import type {
  ManualSourcePatchBundle,
  NormalizedPlayerCareerStats,
  NormalizedPlayerSeasonStats,
  NormalizedPlayers,
  ParsedPlayerProfileRow,
  NormalizedSourceReference,
  ParsedPlayerGameLogHitterRow,
  ParsedPlayerGameLogPitcherRow,
  ParsedPlayerSearchRow,
  ParsedPlayerSummaryHitterRow,
  ParsedPlayerSummaryPitcherRow,
} from "@/lib/data-sources/kbo/dataset-types";
import { FileNormalizedKboRepository } from "@/lib/repositories/kbo/normalized-repository";
import { FileRawSourceRepository } from "@/lib/repositories/kbo/raw-source-repository";

const BASE_URL = "https://eng.koreabaseball.com";
const BATTING_TOP5_URL = `${BASE_URL}/stats/BattingTop5.aspx`;
const PITCHING_TOP5_URL = `${BASE_URL}/stats/PitchingTop5.aspx`;
const REGISTER_ALL_URL = "https://www.koreabaseball.com/Player/RegisterAll.aspx";
const PLAYER_STATS_PARSER_VERSION = "2026-04-18-player-stats-v3";

type RefreshOfficialEnPlayerSeasonStatsArgs = {
  seasonId: string;
  seasonYear: number;
  bundle: KboDataBundle;
  patches: ManualSourcePatchBundle;
  snapshotKey: string;
  rawRepository: FileRawSourceRepository;
  normalizedRepository: FileNormalizedKboRepository;
  mode?: "partial" | "full";
  logger?: (message: string) => void;
};

const TEAM_CODES = ["lg", "ss", "kt", "sk", "nc", "ht", "hh", "ob", "lt", "wo"] as const;
const POSITION_CODES = [
  { key: "pitcher", value: "1" },
  { key: "catcher", value: "2" },
  { key: "infielder", value: "3,4,5,6" },
  { key: "outfielder", value: "7,8,9" },
] as const;

function buildSummaryUrl(pathname: string) {
  return pathname.startsWith("http") ? pathname : new URL(pathname, BASE_URL).toString();
}

function buildGameLogsUrl(pathname: string) {
  return buildSummaryUrl(pathname).replace("/Summary.aspx?", "/GameLogs.aspx?");
}

function buildOfficialKoProfileUrl(entry: { pcode: string; statType: "hitter" | "pitcher" }) {
  const detailPath = entry.statType === "pitcher" ? "PitcherDetail" : "HitterDetail";
  return `https://www.koreabaseball.com/Record/Player/${detailPath}/Basic.aspx?playerId=${entry.pcode}`;
}

async function loadLatestSeasonPlayerSeasonStats(
  normalizedRepository: FileNormalizedKboRepository,
  seasonYear: number,
) {
  const keys = await normalizedRepository.listDatasetKeys("player-season-stats");
  const latestKey = keys
    .filter((item) => item.startsWith(`${seasonYear}-`))
    .sort()
    .at(-1);
  if (!latestKey) {
    return null;
  }
  return normalizedRepository.getDatasetOutput("player-season-stats", latestKey);
}

async function loadLatestSeasonPlayerCareerStats(
  normalizedRepository: FileNormalizedKboRepository,
  seasonYear: number,
) {
  const keys = await normalizedRepository.listDatasetKeys("player-career-stats");
  const latestKey = keys
    .filter((item) => item.startsWith(`${seasonYear}-`))
    .sort()
    .at(-1);
  if (!latestKey) {
    return null;
  }
  return normalizedRepository.getDatasetOutput("player-career-stats", latestKey);
}

function mergeNormalizedPlayerSeasonStats(
  existing: NormalizedPlayerSeasonStats | null,
  incoming: NormalizedPlayerSeasonStats,
) {
  if (!existing) {
    return incoming;
  }

  const targetedStatIds = new Set(incoming.stats.map((stat) => stat.statId));
  const mergedSources = Array.from(
    new Map(
      [...existing.sources, ...incoming.sources].map((source) => [
        `${source.sourceId}:${source.datasetId}:${source.snapshotKey}:${source.parserVersion}`,
        source,
      ]),
    ).values(),
  );
  const mergedPlayers = Array.from(
    new Map(
      [...existing.players, ...incoming.players].map((player) => [player.playerId, player] as const),
    ).values(),
  );

  return {
    ...incoming,
    sources: mergedSources,
    players: mergedPlayers,
    stats: [...existing.stats.filter((stat) => !targetedStatIds.has(stat.statId)), ...incoming.stats],
  };
}

function mergeNormalizedPlayerCareerStats(
  existing: NormalizedPlayerCareerStats | null,
  incoming: NormalizedPlayerCareerStats,
) {
  if (!existing) {
    return incoming;
  }

  const targetedRowIds = new Set(incoming.rows.map((row) => row.playerCareerStatId));
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
    rows: [...existing.rows.filter((row) => !targetedRowIds.has(row.playerCareerStatId)), ...incoming.rows],
  };
}

function buildNormalizedPlayersFromSeasonStats(dataset: NormalizedPlayerSeasonStats): NormalizedPlayers {
  return {
    generatedAt: dataset.generatedAt,
    seasonId: dataset.seasonId,
    sources: dataset.sources,
    players: dataset.players,
  };
}

async function fetchSummaryPagesInBatches<TEntry extends { pcode: string; playerUrl: string }, TRow>(
  entries: TEntry[],
  datasetId: "player-summary-hitter" | "player-summary-pitcher" | "player-game-logs-hitter" | "player-game-logs-pitcher",
  parser: (html: string) => TRow[],
  snapshotKey: string,
  rawRepository: FileRawSourceRepository,
  sourceRefs: NormalizedSourceReference[],
  logger?: (message: string) => void,
) {
  const rows: TRow[] = [];
  const batchSize = 4;
  const totalBatches = Math.ceil(entries.length / batchSize);

  for (let index = 0; index < entries.length; index += batchSize) {
    const batch = entries.slice(index, index + batchSize);
    const batchNumber = Math.floor(index / batchSize) + 1;
    logger?.(`[${datasetId}] ${batchNumber}/${totalBatches} 배치 수집 중 (${batch.length}명)`);
    const results = await Promise.all(
      batch.map(async (entry) => {
        try {
          const sourceUrl = buildSummaryUrl(entry.playerUrl);
          const result = await fetchHtml(sourceUrl);
          const summarySnapshotKey = `${snapshotKey}-${entry.pcode}`;
          await rawRepository.saveSnapshot({
            sourceId: "official-kbo-en",
            datasetId,
            snapshotKey: summarySnapshotKey,
            fetchedAt: result.fetchedAt,
            sourceUrl: result.sourceUrl,
            httpStatus: result.httpStatus,
            checksum: result.checksum ?? checksumHtml(result.html),
            parserVersion: PLAYER_STATS_PARSER_VERSION,
            fixtureBacked: false,
            html: result.html,
          });
          sourceRefs.push({
            sourceId: "official-kbo-en",
            datasetId,
            snapshotKey: summarySnapshotKey,
            parserVersion: PLAYER_STATS_PARSER_VERSION,
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

    logger?.(`[${datasetId}] ${batchNumber}/${totalBatches} 배치 완료`);
  }

  return rows;
}

async function fetchOfficialKoPlayerProfilesInBatches(
  entries: Array<{ pcode: string; statType: "hitter" | "pitcher" }>,
  snapshotKey: string,
  rawRepository: FileRawSourceRepository,
  sourceRefs: NormalizedSourceReference[],
  logger?: (message: string) => void,
) {
  const rows: ParsedPlayerProfileRow[] = [];
  const batchSize = 4;
  const totalBatches = Math.ceil(entries.length / batchSize);

  for (let index = 0; index < entries.length; index += batchSize) {
    const batch = entries.slice(index, index + batchSize);
    const batchNumber = Math.floor(index / batchSize) + 1;
    logger?.(`[player-profile] ${batchNumber}/${totalBatches} 배치 수집 중 (${batch.length}명)`);

    const results = await Promise.all(
      batch.map(async (entry) => {
        const datasetId = entry.statType === "pitcher" ? "player-profile-pitcher" : "player-profile-hitter";
        try {
          const sourceUrl = buildOfficialKoProfileUrl(entry);
          const result = await fetchHtml(sourceUrl);
          const profileSnapshotKey = `${snapshotKey}-${entry.pcode}`;
          await rawRepository.saveSnapshot({
            sourceId: "official-kbo-ko",
            datasetId,
            snapshotKey: profileSnapshotKey,
            fetchedAt: result.fetchedAt,
            sourceUrl: result.sourceUrl,
            httpStatus: result.httpStatus,
            checksum: result.checksum ?? checksumHtml(result.html),
            parserVersion: PLAYER_STATS_PARSER_VERSION,
            fixtureBacked: false,
            html: result.html,
          });
          sourceRefs.push({
            sourceId: "official-kbo-ko",
            datasetId,
            snapshotKey: profileSnapshotKey,
            parserVersion: PLAYER_STATS_PARSER_VERSION,
          });
          return parseOfficialKoPlayerProfile(result.html, entry);
        } catch (error) {
          console.warn(`Skipped player profile for pcode=${entry.pcode}:`, error);
          return null;
        }
      }),
    );

    for (const result of results) {
      if (result) {
        rows.push(result);
      }
    }

    logger?.(`[player-profile] ${batchNumber}/${totalBatches} 배치 완료`);
  }

  return rows;
}

export async function refreshOfficialEnPlayerSeasonStats({
  seasonId,
  seasonYear,
  bundle,
  patches,
  snapshotKey,
  rawRepository,
  normalizedRepository,
  mode = "partial",
  logger,
}: RefreshOfficialEnPlayerSeasonStatsArgs) {
  const sourceRefs: NormalizedSourceReference[] = [
  ];
  let playerSearchRows: ParsedPlayerSearchRow[] = [];
  let uniqueHitterEntries: Array<{ pcode: string; playerUrl: string }> = [];
  let uniquePitcherEntries: Array<{ pcode: string; playerUrl: string }> = [];

  if (mode === "full") {
    logger?.("선수 검색 전체 수집을 시작합니다.");
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
          parserVersion: PLAYER_STATS_PARSER_VERSION,
          fixtureBacked: false,
          html: result.html,
        });
        sourceRefs.push({
          sourceId: "official-kbo-en",
          datasetId: "player-search",
          snapshotKey: filteredSnapshotKey,
          parserVersion: PLAYER_STATS_PARSER_VERSION,
        });
        playerSearchRows.push(...parseOfficialEnPlayerSearch(result.html));
      }
    }

    const uniqueRows = Array.from(new Map(playerSearchRows.map((row) => [row.pcode, row] as const)).values());
    playerSearchRows = uniqueRows;
    uniqueHitterEntries = uniqueRows
      .filter((row) => row.statType === "hitter" && row.playerUrl)
      .map((row) => ({ pcode: row.pcode, playerUrl: row.playerUrl! }));
    uniquePitcherEntries = uniqueRows
      .filter((row) => row.statType === "pitcher" && row.playerUrl)
      .map((row) => ({ pcode: row.pcode, playerUrl: row.playerUrl! }));
    logger?.(`선수 검색 전체 수집 완료: 타자 ${uniqueHitterEntries.length}명, 투수 ${uniquePitcherEntries.length}명`);
  } else {
    logger?.("Top5 기반 선수 요약 수집을 시작합니다.");
    const battingTop5 = await fetchHtml(BATTING_TOP5_URL);
    await rawRepository.saveSnapshot({
      sourceId: "official-kbo-en",
      datasetId: "batting-top5",
      snapshotKey,
      fetchedAt: battingTop5.fetchedAt,
      sourceUrl: battingTop5.sourceUrl,
      httpStatus: battingTop5.httpStatus,
      checksum: battingTop5.checksum,
      parserVersion: PLAYER_STATS_PARSER_VERSION,
      fixtureBacked: false,
      html: battingTop5.html,
    });

    const pitchingTop5 = await fetchHtml(PITCHING_TOP5_URL);
    await rawRepository.saveSnapshot({
      sourceId: "official-kbo-en",
      datasetId: "pitching-top5",
      snapshotKey,
      fetchedAt: pitchingTop5.fetchedAt,
      sourceUrl: pitchingTop5.sourceUrl,
      httpStatus: pitchingTop5.httpStatus,
      checksum: pitchingTop5.checksum,
      parserVersion: PLAYER_STATS_PARSER_VERSION,
      fixtureBacked: false,
      html: pitchingTop5.html,
    });

    const hitterEntries = parseOfficialEnBattingTop5(battingTop5.html);
    const pitcherEntries = parseOfficialEnPitchingTop5(pitchingTop5.html);

    uniqueHitterEntries = Array.from(new Map(hitterEntries.map((entry) => [entry.pcode, entry] as const)).values());
    uniquePitcherEntries = Array.from(new Map(pitcherEntries.map((entry) => [entry.pcode, entry] as const)).values());
    logger?.(`Top5 기반 수집 완료: 타자 ${uniqueHitterEntries.length}명, 투수 ${uniquePitcherEntries.length}명`);
    sourceRefs.push(
      {
        sourceId: "official-kbo-en",
        datasetId: "batting-top5",
        snapshotKey,
        parserVersion: PLAYER_STATS_PARSER_VERSION,
      },
      {
        sourceId: "official-kbo-en",
        datasetId: "pitching-top5",
        snapshotKey,
        parserVersion: PLAYER_STATS_PARSER_VERSION,
      },
    );
  }

  const hitterRows = await fetchSummaryPagesInBatches<{ pcode: string; playerUrl: string }, ParsedPlayerSummaryHitterRow>(
    uniqueHitterEntries,
    "player-summary-hitter",
    parseOfficialEnPlayerSummaryHitter,
    snapshotKey,
    rawRepository,
    sourceRefs,
    logger,
  );
  const pitcherRows = await fetchSummaryPagesInBatches<{ pcode: string; playerUrl: string }, ParsedPlayerSummaryPitcherRow>(
    uniquePitcherEntries,
    "player-summary-pitcher",
    parseOfficialEnPlayerSummaryPitcher,
    snapshotKey,
    rawRepository,
    sourceRefs,
    logger,
  );
  logger?.(`선수 요약 페이지 정규화 준비 완료: 타자 ${hitterRows.length}행, 투수 ${pitcherRows.length}행`);

  const registerResult = await fetchHtml(REGISTER_ALL_URL);
  const registerSnapshotKey = snapshotKey;
  await rawRepository.saveSnapshot({
    sourceId: "official-kbo-ko",
    datasetId: "player-register-all",
    snapshotKey: registerSnapshotKey,
    fetchedAt: registerResult.fetchedAt,
    sourceUrl: registerResult.sourceUrl,
    httpStatus: registerResult.httpStatus,
    checksum: registerResult.checksum ?? checksumHtml(registerResult.html),
    parserVersion: PLAYER_STATS_PARSER_VERSION,
    fixtureBacked: false,
    html: registerResult.html,
  });
  sourceRefs.push({
    sourceId: "official-kbo-ko",
    datasetId: "player-register-all",
    snapshotKey: registerSnapshotKey,
    parserVersion: PLAYER_STATS_PARSER_VERSION,
  });
  const registerRows = parseOfficialKoRegisterAll(registerResult.html);

  const normalizedBase = normalizePlayerSeasonStats({
    seasonId,
    sourceId: "official-kbo-en",
    hitters: hitterRows,
    pitchers: pitcherRows,
    registerRows,
    searchRows: playerSearchRows,
    bundle,
    patches,
    sourceRefs,
  });

  const playerProfileRows =
    mode === "full"
      ? await fetchOfficialKoPlayerProfilesInBatches(
          [
            ...uniqueHitterEntries.map((entry) => ({ pcode: entry.pcode, statType: "hitter" as const })),
            ...uniquePitcherEntries.map((entry) => ({ pcode: entry.pcode, statType: "pitcher" as const })),
          ],
          snapshotKey,
          rawRepository,
          sourceRefs,
          logger,
        )
      : [];
  if (playerProfileRows.length > 0) {
    logger?.(`국문 선수 프로필 정규화 준비 완료: ${playerProfileRows.length}명`);
  }

  const normalized =
    mode === "full"
      ? enrichPlayerSeasonStatsWithOfficialKoProfiles(normalizedBase, playerProfileRows)
      : normalizedBase;

  const mergedNormalized =
    mode === "partial"
      ? mergeNormalizedPlayerSeasonStats(
          await loadLatestSeasonPlayerSeasonStats(normalizedRepository, seasonYear),
          normalized,
        )
      : normalized;

  await normalizedRepository.saveDatasetOutput("player-season-stats", `${seasonYear}-${snapshotKey}`, mergedNormalized);
  logger?.(`player-season-stats 저장 완료: ${mergedNormalized.stats.length}행`);

  const normalizedCareerStats = normalizePlayerCareerStats({
    seasonId,
    sourceId: "official-kbo-en",
    hitters: hitterRows,
    pitchers: pitcherRows,
    registerRows,
    searchRows: playerSearchRows,
    bundle,
    patches,
    sourceRefs,
  });
  const mergedCareerStats = mergeNormalizedPlayerCareerStats(
    mode === "partial" ? await loadLatestSeasonPlayerCareerStats(normalizedRepository, seasonYear) : null,
    normalizedCareerStats,
  );
  await normalizedRepository.saveDatasetOutput("player-career-stats", `${seasonYear}-${snapshotKey}`, mergedCareerStats);
  logger?.(`player-career-stats 저장 완료: ${mergedCareerStats.rows.length}행`);

  if (mode !== "full") {
    return;
  }

  await normalizedRepository.saveDatasetOutput(
    "players",
    `${seasonYear}-${snapshotKey}`,
    buildNormalizedPlayersFromSeasonStats(mergedNormalized),
  );
  logger?.(`players 저장 완료: ${mergedNormalized.players.length}명`);

  const hitterGameLogRows = await fetchSummaryPagesInBatches<{ pcode: string; playerUrl: string }, ParsedPlayerGameLogHitterRow>(
    uniqueHitterEntries.map((entry) => ({ ...entry, playerUrl: buildGameLogsUrl(entry.playerUrl) })),
    "player-game-logs-hitter",
    parseOfficialEnPlayerGameLogsHitter,
    snapshotKey,
    rawRepository,
    sourceRefs,
    logger,
  );
  const pitcherGameLogRows = await fetchSummaryPagesInBatches<{ pcode: string; playerUrl: string }, ParsedPlayerGameLogPitcherRow>(
    uniquePitcherEntries.map((entry) => ({ ...entry, playerUrl: buildGameLogsUrl(entry.playerUrl) })),
    "player-game-logs-pitcher",
    parseOfficialEnPlayerGameLogsPitcher,
    snapshotKey,
    rawRepository,
    sourceRefs,
    logger,
  );
  logger?.(`선수 경기 로그 정규화 준비 완료: 타자 ${hitterGameLogRows.length}행, 투수 ${pitcherGameLogRows.length}행`);

  const normalizedGameLogs = normalizePlayerGameStats({
    seasonId,
    sourceId: "official-kbo-en",
    hitters: hitterGameLogRows,
    pitchers: pitcherGameLogRows,
    registerRows,
    searchRows: playerSearchRows,
    bundle,
    patches,
    sourceRefs,
  });

  await normalizedRepository.saveDatasetOutput("player-game-stats", `${seasonYear}-${snapshotKey}`, normalizedGameLogs);
  logger?.(`player-game-stats 저장 완료: ${normalizedGameLogs.rows.length}행`);
}
