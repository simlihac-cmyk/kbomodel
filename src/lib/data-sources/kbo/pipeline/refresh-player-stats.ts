import { parseOfficialEnBattingTop5 } from "@/lib/data-sources/kbo/adapters/official-en/batting-top5";
import { parseOfficialEnPitchingTop5 } from "@/lib/data-sources/kbo/adapters/official-en/pitching-top5";
import { parseOfficialEnPlayerSearch } from "@/lib/data-sources/kbo/adapters/official-en/player-search";
import { parseOfficialEnPlayerGameLogsHitter } from "@/lib/data-sources/kbo/adapters/official-en/player-game-logs-hitter";
import { parseOfficialEnPlayerGameLogsPitcher } from "@/lib/data-sources/kbo/adapters/official-en/player-game-logs-pitcher";
import { parseOfficialEnPlayerSummaryHitter } from "@/lib/data-sources/kbo/adapters/official-en/player-summary-hitter";
import { parseOfficialEnPlayerSummaryPitcher } from "@/lib/data-sources/kbo/adapters/official-en/player-summary-pitcher";
import { parseOfficialKoRegisterAll } from "@/lib/data-sources/kbo/adapters/official-ko/register-all";
import { checksumHtml } from "@/lib/data-sources/kbo/fetch/fetch-cache";
import { fetchOfficialEnPlayerSearchFiltered } from "@/lib/data-sources/kbo/fetch/fetch-english-player-search";
import { fetchHtml } from "@/lib/data-sources/kbo/fetch/fetch-html";
import { normalizePlayerGameStats } from "@/lib/data-sources/kbo/normalize/player-game-stats";
import { normalizePlayerSeasonStats } from "@/lib/data-sources/kbo/normalize/player-season-stats";
import type { KboDataBundle } from "@/lib/domain/kbo/types";
import type {
  ManualSourcePatchBundle,
  NormalizedSourceReference,
  ParsedPlayerGameLogHitterRow,
  ParsedPlayerGameLogPitcherRow,
  ParsedPlayerSummaryHitterRow,
  ParsedPlayerSummaryPitcherRow,
} from "@/lib/data-sources/kbo/dataset-types";
import { FileNormalizedKboRepository } from "@/lib/repositories/kbo/normalized-repository";
import { FileRawSourceRepository } from "@/lib/repositories/kbo/raw-source-repository";

const BASE_URL = "https://eng.koreabaseball.com";
const BATTING_TOP5_URL = `${BASE_URL}/stats/BattingTop5.aspx`;
const PITCHING_TOP5_URL = `${BASE_URL}/stats/PitchingTop5.aspx`;
const REGISTER_ALL_URL = "https://www.koreabaseball.com/Player/RegisterAll.aspx";
const PLAYER_STATS_PARSER_VERSION = "2026-04-15-en-player-stats-v1";

type RefreshOfficialEnPlayerSeasonStatsArgs = {
  seasonId: string;
  seasonYear: number;
  bundle: KboDataBundle;
  patches: ManualSourcePatchBundle;
  snapshotKey: string;
  rawRepository: FileRawSourceRepository;
  normalizedRepository: FileNormalizedKboRepository;
  mode?: "partial" | "full";
};

const TEAM_CODES = ["lg", "ss", "kt", "sk", "nc", "ht", "hh", "ob", "lt", "wo"] as const;
const FULL_MODE_HITTER_GAME_LOG_LIMIT = 60;
const FULL_MODE_PITCHER_GAME_LOG_LIMIT = 40;
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

function pickPriorityGameLogEntries<TEntry extends { pcode: string; playerUrl: string }, TRow extends { pcode: string; games: number }>(
  entries: TEntry[],
  rows: TRow[],
  limit: number,
) {
  const chosenPcodes = new Set(
    [...rows]
      .sort((left, right) => right.games - left.games)
      .slice(0, limit)
      .map((row) => row.pcode),
  );

  return entries.filter((entry) => chosenPcodes.has(entry.pcode));
}

async function fetchSummaryPagesInBatches<TEntry extends { pcode: string; playerUrl: string }, TRow>(
  entries: TEntry[],
  datasetId: "player-summary-hitter" | "player-summary-pitcher" | "player-game-logs-hitter" | "player-game-logs-pitcher",
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
}: RefreshOfficialEnPlayerSeasonStatsArgs) {
  const sourceRefs: NormalizedSourceReference[] = [
  ];
  let uniqueHitterEntries: Array<{ pcode: string; playerUrl: string }> = [];
  let uniquePitcherEntries: Array<{ pcode: string; playerUrl: string }> = [];

  if (mode === "full") {
    const playerSearchRows = [];
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
    uniqueHitterEntries = uniqueRows
      .filter((row) => row.statType === "hitter" && row.playerUrl)
      .map((row) => ({ pcode: row.pcode, playerUrl: row.playerUrl! }));
    uniquePitcherEntries = uniqueRows
      .filter((row) => row.statType === "pitcher" && row.playerUrl)
      .map((row) => ({ pcode: row.pcode, playerUrl: row.playerUrl! }));
  } else {
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
  );
  const pitcherRows = await fetchSummaryPagesInBatches<{ pcode: string; playerUrl: string }, ParsedPlayerSummaryPitcherRow>(
    uniquePitcherEntries,
    "player-summary-pitcher",
    parseOfficialEnPlayerSummaryPitcher,
    snapshotKey,
    rawRepository,
    sourceRefs,
  );

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

  const normalized = normalizePlayerSeasonStats({
    seasonId,
    sourceId: "official-kbo-en",
    hitters: hitterRows,
    pitchers: pitcherRows,
    registerRows,
    bundle,
    patches,
    sourceRefs,
  });

  await normalizedRepository.saveDatasetOutput("player-season-stats", `${seasonYear}-${snapshotKey}`, normalized);

  if (mode !== "full") {
    return;
  }

  const priorityHitterGameLogEntries = pickPriorityGameLogEntries(
    uniqueHitterEntries,
    hitterRows,
    FULL_MODE_HITTER_GAME_LOG_LIMIT,
  );
  const priorityPitcherGameLogEntries = pickPriorityGameLogEntries(
    uniquePitcherEntries,
    pitcherRows,
    FULL_MODE_PITCHER_GAME_LOG_LIMIT,
  );

  const hitterGameLogRows = await fetchSummaryPagesInBatches<{ pcode: string; playerUrl: string }, ParsedPlayerGameLogHitterRow>(
    priorityHitterGameLogEntries.map((entry) => ({ ...entry, playerUrl: buildGameLogsUrl(entry.playerUrl) })),
    "player-game-logs-hitter",
    parseOfficialEnPlayerGameLogsHitter,
    snapshotKey,
    rawRepository,
    sourceRefs,
  );
  const pitcherGameLogRows = await fetchSummaryPagesInBatches<{ pcode: string; playerUrl: string }, ParsedPlayerGameLogPitcherRow>(
    priorityPitcherGameLogEntries.map((entry) => ({ ...entry, playerUrl: buildGameLogsUrl(entry.playerUrl) })),
    "player-game-logs-pitcher",
    parseOfficialEnPlayerGameLogsPitcher,
    snapshotKey,
    rawRepository,
    sourceRefs,
  );

  const normalizedGameLogs = normalizePlayerGameStats({
    seasonId,
    sourceId: "official-kbo-en",
    hitters: hitterGameLogRows,
    pitchers: pitcherGameLogRows,
    registerRows,
    bundle,
    patches,
    sourceRefs,
  });

  await normalizedRepository.saveDatasetOutput("player-game-stats", `${seasonYear}-${snapshotKey}`, normalizedGameLogs);
}
