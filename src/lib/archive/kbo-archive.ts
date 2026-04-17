import type { NormalizedHistoricalTeamRecords } from "@/lib/data-sources/kbo/dataset-types";
import type { StandingRow, TeamDisplay } from "@/lib/domain/kbo/types";

export type HistoricalArchiveRow = NormalizedHistoricalTeamRecords["rows"][number];

function sortHistoricalRows(rows: HistoricalArchiveRow[]) {
  return [...rows].sort((left, right) => left.rank - right.rank || right.wins - left.wins);
}

function findChampion(rows: HistoricalArchiveRow[]) {
  return rows.find((row) => (row.postseasonResult ?? "").includes("우승")) ?? null;
}

function calculateWinPct(wins: number, losses: number) {
  if (wins + losses === 0) {
    return 0;
  }

  return Number((wins / (wins + losses)).toFixed(3));
}

function calculateGamesBack(
  leader: Pick<HistoricalArchiveRow, "wins" | "losses">,
  challenger: Pick<HistoricalArchiveRow, "wins" | "losses">,
) {
  return Number(
    (((leader.wins - challenger.wins) + (challenger.losses - leader.losses)) / 2).toFixed(1),
  );
}

export function getHistoricalRowsForYear(rows: HistoricalArchiveRow[], year: number) {
  return sortHistoricalRows(rows.filter((row) => row.year === year));
}

export function getHistoricalRowsForFranchise(rows: HistoricalArchiveRow[], franchiseId: string) {
  return [...rows]
    .filter((row) => row.franchiseId === franchiseId)
    .sort((left, right) => right.year - left.year || left.rank - right.rank);
}

export function buildArchiveHeadline(year: number, rows: HistoricalArchiveRow[]) {
  const champion = findChampion(rows);
  if (champion) {
    return `${year} ${champion.brandLabel} 우승 시즌`;
  }

  const regularWinner = rows[0];
  if (regularWinner) {
    return `${year} ${regularWinner.brandLabel} 정규시즌 1위`;
  }

  return `${year} 시즌 아카이브`;
}

export function buildArchiveNarrative(year: number, rows: HistoricalArchiveRow[]) {
  const ordered = sortHistoricalRows(rows);
  if (!ordered.length) {
    return [`${year} 시즌 공식 historical record ingest가 확보되면 이 시즌의 서사를 여기에 붙입니다.`];
  }

  const regularWinner = ordered[0];
  const champion = findChampion(ordered);
  const lines = [
    `${year}년 공식 historical record 기준 정규시즌 1위는 ${regularWinner.brandLabel} (${regularWinner.wins}-${regularWinner.losses}-${regularWinner.ties})였습니다.`,
  ];

  if (champion && champion.franchiseId !== regularWinner.franchiseId) {
    lines.push(`포스트시즌에서는 ${champion.brandLabel}가 ${champion.postseasonResult}로 시즌을 마무리했습니다.`);
  } else if (champion) {
    lines.push(`${champion.brandLabel}가 포스트시즌에서도 ${champion.postseasonResult}로 시즌 정점을 찍었습니다.`);
  } else if (regularWinner.postseasonResult) {
    lines.push(`${regularWinner.brandLabel}의 가을야구 결과는 ${regularWinner.postseasonResult}로 기록되어 있습니다.`);
  }

  const bubbleRows = ordered.filter((row) => row.rank >= 3 && row.rank <= 5).slice(0, 2);
  if (bubbleRows.length) {
    lines.push(
      bubbleRows
        .map((row) => `${row.brandLabel} ${row.rank}위 (${row.wins}-${row.losses}-${row.ties})`)
        .join(" · "),
    );
  }

  return lines;
}

export function summarizeHistoricalCoverage(rows: HistoricalArchiveRow[]) {
  if (!rows.length) {
    return "공식 historical record 미확보";
  }

  const years = Array.from(new Set(rows.map((row) => row.year))).sort((left, right) => right - left);
  if (years.length === 1) {
    return `${years[0]} 시즌 공식 historical record`;
  }

  return `${years.at(-1)}-${years[0]} 공식 historical record`;
}

export function hasCompleteHistoricalStandings(rows: HistoricalArchiveRow[], expectedTeamCount: number) {
  return expectedTeamCount > 0 && rows.length >= expectedTeamCount;
}

export function inferHistoricalGameCount(rows: HistoricalArchiveRow[]) {
  const totalGames = rows.reduce((sum, row) => sum + row.wins + row.losses + row.ties, 0);
  return totalGames > 0 ? totalGames / 2 : 0;
}

export function buildArchiveStandingsRows(rows: HistoricalArchiveRow[], teamDisplays: TeamDisplay[]): StandingRow[] {
  const ordered = sortHistoricalRows(rows);
  const leader = ordered[0];
  const displayByFranchiseId = Object.fromEntries(
    teamDisplays.map((teamDisplay) => [teamDisplay.franchiseId, teamDisplay]),
  );

  return ordered
    .map((row) => {
      const display = displayByFranchiseId[row.franchiseId];
      if (!display) {
        return null;
      }

      return {
        ...display,
        rank: row.rank,
        games: row.wins + row.losses + row.ties,
        wins: row.wins,
        losses: row.losses,
        ties: row.ties,
        pct: calculateWinPct(row.wins, row.losses),
        gamesBack: leader ? calculateGamesBack(leader, row) : 0,
        recent10: "-",
        streak: "-",
        home: "-",
        away: "-",
        runsScored: 0,
        runsAllowed: 0,
        offensePlus: 100,
        pitchingPlus: 100,
      } satisfies StandingRow;
    })
    .filter((row): row is StandingRow => row !== null);
}
