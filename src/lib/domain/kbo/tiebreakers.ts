import type {
  Game,
  KboSeasonRuleset,
  SeasonTeam,
  StandingRow,
  TeamSeasonStat,
  TiebreakerKey,
  TieAlert,
} from "@/lib/domain/kbo/types";

type TeamRecord = {
  wins: number;
  losses: number;
  ties: number;
  runsScored: number;
  runsAllowed: number;
};

type HeadToHeadTable = Record<string, Record<string, TeamRecord>>;

function createEmptyRecord(): TeamRecord {
  return {
    wins: 0,
    losses: 0,
    ties: 0,
    runsScored: 0,
    runsAllowed: 0,
  };
}

export function buildHeadToHeadTable(games: Game[]): HeadToHeadTable {
  const table: HeadToHeadTable = {};

  for (const game of games) {
    if (game.status !== "final" || game.homeScore === null || game.awayScore === null) {
      continue;
    }

    const homeId = game.homeSeasonTeamId;
    const awayId = game.awaySeasonTeamId;
    table[homeId] ??= {};
    table[awayId] ??= {};
    table[homeId][awayId] ??= createEmptyRecord();
    table[awayId][homeId] ??= createEmptyRecord();

    table[homeId][awayId].runsScored += game.homeScore;
    table[homeId][awayId].runsAllowed += game.awayScore;
    table[awayId][homeId].runsScored += game.awayScore;
    table[awayId][homeId].runsAllowed += game.homeScore;

    if (game.isTie || game.homeScore === game.awayScore) {
      table[homeId][awayId].ties += 1;
      table[awayId][homeId].ties += 1;
      continue;
    }

    if (game.homeScore > game.awayScore) {
      table[homeId][awayId].wins += 1;
      table[awayId][homeId].losses += 1;
    } else {
      table[awayId][homeId].wins += 1;
      table[homeId][awayId].losses += 1;
    }
  }

  return table;
}

function compareHeadToHead(
  homeTable: HeadToHeadTable,
  leftId: string,
  rightId: string,
): number {
  const record = homeTable[leftId]?.[rightId];
  const inverse = homeTable[rightId]?.[leftId];

  if (!record || !inverse) {
    return 0;
  }

  const leftPct = record.wins / Math.max(1, record.wins + record.losses);
  const rightPct = inverse.wins / Math.max(1, inverse.wins + inverse.losses);
  return rightPct - leftPct;
}

function compareRunDifferential(stats: Record<string, TeamSeasonStat>, leftId: string, rightId: string): number {
  const left = stats[leftId];
  const right = stats[rightId];
  const leftDiff = (left?.runsScored ?? 0) - (left?.runsAllowed ?? 0);
  const rightDiff = (right?.runsScored ?? 0) - (right?.runsAllowed ?? 0);
  return rightDiff - leftDiff;
}

function compareRunsScored(stats: Record<string, TeamSeasonStat>, leftId: string, rightId: string): number {
  return (stats[rightId]?.runsScored ?? 0) - (stats[leftId]?.runsScored ?? 0);
}

function compareTeamCode(
  rowsById: Record<string, StandingRow>,
  leftId: string,
  rightId: string,
): number {
  return rowsById[leftId].shortCode.localeCompare(rowsById[rightId].shortCode, "ko");
}

function compareByKey(
  key: TiebreakerKey,
  rowsById: Record<string, StandingRow>,
  statsById: Record<string, TeamSeasonStat>,
  headToHead: HeadToHeadTable,
  leftId: string,
  rightId: string,
): number {
  switch (key) {
    case "headToHead":
      return compareHeadToHead(headToHead, leftId, rightId);
    case "runDifferential":
      return compareRunDifferential(statsById, leftId, rightId);
    case "runScored":
      return compareRunsScored(statsById, leftId, rightId);
    case "teamCode":
      return compareTeamCode(rowsById, leftId, rightId);
    default:
      return 0;
  }
}

export function sortStandingRowsWithTiebreakers(
  rows: StandingRow[],
  games: Game[],
  ruleset: KboSeasonRuleset,
  teamSeasonStats: TeamSeasonStat[],
): { rows: StandingRow[]; tieAlerts: TieAlert[] } {
  const headToHead = buildHeadToHeadTable(games);
  const statsById = Object.fromEntries(teamSeasonStats.map((stat) => [stat.seasonTeamId, stat]));
  const rowsById = Object.fromEntries(rows.map((row) => [row.seasonTeamId, row]));

  const sorted = [...rows].sort((left, right) => {
    if (right.pct !== left.pct) {
      return right.pct - left.pct;
    }

    for (const key of ruleset.tiebreakerOrder) {
      const result = compareByKey(key, rowsById, statsById, headToHead, left.seasonTeamId, right.seasonTeamId);
      if (result !== 0) {
        return result;
      }
    }

    return left.displayNameKo.localeCompare(right.displayNameKo, "ko");
  });

  const tieAlerts: TieAlert[] = [];
  let cursor = 0;

  while (cursor < sorted.length) {
    const group = [sorted[cursor]];
    let next = cursor + 1;

    while (next < sorted.length && sorted[next].pct === sorted[cursor].pct) {
      group.push(sorted[next]);
      next += 1;
    }

    if (group.length > 1) {
      const positions = group.map((_, index) => cursor + index + 1);
      const keyPositions = positions.filter((position) =>
        ruleset.specialPlayoffGamePositions.includes(position),
      );

      if (keyPositions.length > 0) {
        tieAlerts.push({
          positions: keyPositions,
          seasonTeamIds: group.map((row) => row.seasonTeamId),
          probability: 1,
          note: `${keyPositions.join(", ")}위 선상 동률이어서 시즌 규정상 결정전 가능성을 확인해야 합니다.`,
        });
      }
    }

    cursor = next;
  }

  return { rows: sorted, tieAlerts };
}

export function buildSeasonTeamLookup(seasonTeams: SeasonTeam[]): Record<string, SeasonTeam> {
  return Object.fromEntries(seasonTeams.map((seasonTeam) => [seasonTeam.seasonTeamId, seasonTeam]));
}
