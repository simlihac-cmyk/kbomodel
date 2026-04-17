import type { KboDataBundle, PlayerGameStat } from "@/lib/domain/kbo/types";
import {
  normalizedPlayerGameStatsSchema,
  type ManualSourcePatchBundle,
  type NormalizedSourceReference,
  type ParsedPlayerGameLogHitterRow,
  type ParsedPlayerGameLogPitcherRow,
  type ParsedPlayerRegisterRow,
  type SourceId,
} from "@/lib/data-sources/kbo/dataset-types";
import { resolveSeasonTeamId } from "@/lib/data-sources/kbo/merge/apply-manual-patches";
import {
  buildOfficialRegisterLookup,
  resolveOfficialPlayerIdentity,
} from "@/lib/data-sources/kbo/normalize/player-season-stats";

type NormalizePlayerGameStatsArgs = {
  seasonId: string;
  sourceId: SourceId;
  hitters: ParsedPlayerGameLogHitterRow[];
  pitchers: ParsedPlayerGameLogPitcherRow[];
  registerRows: ParsedPlayerRegisterRow[];
  bundle: KboDataBundle;
  patches: ManualSourcePatchBundle;
  sourceRefs: NormalizedSourceReference[];
};

function buildGameDate(seasonId: string, shortDate: string) {
  const year = seasonId.match(/(\d{4})/)?.[1] ?? "2026";
  const [month = "01", day = "01"] = shortDate.split("-");
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function findMatchingGameId(
  bundle: KboDataBundle,
  seasonId: string,
  seasonTeamId: string,
  opponentSeasonTeamId: string,
  gameDate: string,
) {
  const candidates = bundle.games.filter((game) => {
    if (game.seasonId !== seasonId) {
      return false;
    }
    if (!game.scheduledAt.startsWith(gameDate)) {
      return false;
    }
    const involvesTarget =
      (game.homeSeasonTeamId === seasonTeamId && game.awaySeasonTeamId === opponentSeasonTeamId) ||
      (game.awaySeasonTeamId === seasonTeamId && game.homeSeasonTeamId === opponentSeasonTeamId);
    return involvesTarget;
  });

  return candidates[0]?.gameId ?? null;
}

function summarizeHitterRow(row: ParsedPlayerGameLogHitterRow) {
  return `${row.opponentTeamName}전 ${row.atBats}타수 ${row.hits}안타 ${row.homeRuns}홈런 ${row.rbi}타점`;
}

function summarizePitcherRow(row: ParsedPlayerGameLogPitcherRow) {
  const resultLabel = row.result ? ` ${row.result}` : "";
  return `${row.opponentTeamName}전${resultLabel} ${row.inningsPitched}이닝 ${row.earnedRuns}자책 ${row.strikeouts}K`;
}

function createPlayerGameStat(
  seasonId: string,
  playerId: string,
  seasonTeamId: string,
  gameId: string,
  statType: "hitter" | "pitcher",
  summaryLine: string,
): PlayerGameStat {
  return {
    playerGameStatId: `pgs:${seasonId}:${playerId}:${gameId}:${statType}`,
    gameId,
    seasonId,
    playerId,
    seasonTeamId,
    statType,
    summaryLine,
  };
}

export function normalizePlayerGameStats({
  seasonId,
  sourceId,
  hitters,
  pitchers,
  registerRows,
  bundle,
  patches,
  sourceRefs,
}: NormalizePlayerGameStatsArgs) {
  const registerLookup = buildOfficialRegisterLookup(registerRows, seasonId, bundle, patches);
  const rows: PlayerGameStat[] = [];

  for (const row of hitters) {
    const identity = resolveOfficialPlayerIdentity({
      seasonId,
      sourceId,
      payload: row,
      registerLookup,
      bundle,
      patches,
    });
    if (!identity) {
      continue;
    }
    const opponentSeasonTeamId = resolveSeasonTeamId(
      row.opponentTeamName,
      sourceId,
      seasonId,
      bundle,
      patches,
    );
    if (!opponentSeasonTeamId) {
      continue;
    }
    const gameId = findMatchingGameId(
      bundle,
      seasonId,
      identity.seasonTeamId,
      opponentSeasonTeamId,
      buildGameDate(seasonId, row.date),
    );
    if (!gameId) {
      continue;
    }
    rows.push(
      createPlayerGameStat(
        seasonId,
        identity.player.playerId,
        identity.seasonTeamId,
        gameId,
        "hitter",
        summarizeHitterRow(row),
      ),
    );
  }

  for (const row of pitchers) {
    const identity = resolveOfficialPlayerIdentity({
      seasonId,
      sourceId,
      payload: row,
      registerLookup,
      bundle,
      patches,
    });
    if (!identity) {
      continue;
    }
    const opponentSeasonTeamId = resolveSeasonTeamId(
      row.opponentTeamName,
      sourceId,
      seasonId,
      bundle,
      patches,
    );
    if (!opponentSeasonTeamId) {
      continue;
    }
    const gameId = findMatchingGameId(
      bundle,
      seasonId,
      identity.seasonTeamId,
      opponentSeasonTeamId,
      buildGameDate(seasonId, row.date),
    );
    if (!gameId) {
      continue;
    }
    rows.push(
      createPlayerGameStat(
        seasonId,
        identity.player.playerId,
        identity.seasonTeamId,
        gameId,
        "pitcher",
        summarizePitcherRow(row),
      ),
    );
  }

  return normalizedPlayerGameStatsSchema.parse({
    generatedAt: new Date().toISOString(),
    seasonId,
    sources: sourceRefs,
    rows: Array.from(new Map(rows.map((row) => [row.playerGameStatId, row] as const)).values()),
  });
}
