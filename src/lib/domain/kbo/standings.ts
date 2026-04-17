import type {
  BucketOdds,
  Game,
  PostseasonOdds,
  StandingRow,
  TeamBrand,
  TeamSeasonStat,
} from "@/lib/domain/kbo/types";
import { sortStandingRowsWithTiebreakers } from "@/lib/domain/kbo/tiebreakers";

type PartialRecord = {
  wins: number;
  losses: number;
  ties: number;
  runsScored: number;
  runsAllowed: number;
  lastOutcomes: string[];
  streak: string[];
  homeWins: number;
  homeLosses: number;
  homeTies: number;
  awayWins: number;
  awayLosses: number;
  awayTies: number;
};

type BuildStandingsArgs = {
  games: Game[];
  teamSeasonStats: TeamSeasonStat[];
  teamDisplays: StandingRow[];
  bucketOdds?: BucketOdds[];
  postseasonOdds?: PostseasonOdds[];
  ruleset: {
    tiebreakerOrder: ("headToHead" | "runDifferential" | "runScored" | "teamCode")[];
    specialPlayoffGamePositions: number[];
  };
};

function createRecord(): PartialRecord {
  return {
    wins: 0,
    losses: 0,
    ties: 0,
    runsScored: 0,
    runsAllowed: 0,
    lastOutcomes: [],
    streak: [],
    homeWins: 0,
    homeLosses: 0,
    homeTies: 0,
    awayWins: 0,
    awayLosses: 0,
    awayTies: 0,
  };
}

function formatRecord(wins: number, losses: number, ties: number): string {
  return `${wins}-${losses}${ties > 0 ? `-${ties}` : ""}`;
}

function formatLast10(results: string[]): string {
  const sample = results.slice(-10);
  const wins = sample.filter((item) => item === "W").length;
  const losses = sample.filter((item) => item === "L").length;
  const ties = sample.filter((item) => item === "T").length;
  return `${wins}-${losses}${ties > 0 ? `-${ties}` : ""}`;
}

function formatStreak(results: string[]): string {
  if (results.length === 0) {
    return "-";
  }

  const latest = results.at(-1) ?? "T";
  let count = 0;
  for (let index = results.length - 1; index >= 0; index -= 1) {
    if (results[index] !== latest) {
      break;
    }
    count += 1;
  }

  if (latest === "T") {
    return `무${count}`;
  }

  return `${latest === "W" ? "승" : "패"}${count}`;
}

function calculateWinPct(wins: number, losses: number): number {
  if (wins + losses === 0) {
    return 0;
  }

  return Number((wins / (wins + losses)).toFixed(3));
}

function calculateGamesBack(leader: PartialRecord, challenger: PartialRecord): number {
  return Number(
    (((leader.wins - challenger.wins) + (challenger.losses - leader.losses)) / 2).toFixed(1),
  );
}

function hasMoreOfficialStandingsThanGames(teamSeasonStats: TeamSeasonStat[], finalGames: Game[]) {
  const officialGameCount = teamSeasonStats.reduce(
    (sum, stat) => sum + stat.wins + stat.losses + stat.ties,
    0,
  );
  const computedGameCount = finalGames.length * 2;
  return officialGameCount > computedGameCount;
}

export function buildTeamDisplayRows(
  teamSeasonStats: TeamSeasonStat[],
  teamBrands: TeamBrand[],
  teamDisplays: { seasonTeamId: string; franchiseId: string; brandId: string; teamSlug: string }[],
): StandingRow[] {
  const statsById = Object.fromEntries(teamSeasonStats.map((stat) => [stat.seasonTeamId, stat]));
  const brandById = Object.fromEntries(teamBrands.map((brand) => [brand.brandId, brand]));

  return teamDisplays.map((display) => {
    const stat = statsById[display.seasonTeamId];
    const brand = brandById[display.brandId];

    return {
      seasonTeamId: display.seasonTeamId,
      franchiseId: display.franchiseId,
      brandId: display.brandId,
      teamSlug: display.teamSlug,
      displayNameKo: brand.displayNameKo,
      shortNameKo: brand.shortNameKo,
      shortCode: brand.shortCode,
      primaryColor: brand.primaryColor,
      secondaryColor: brand.secondaryColor,
      rank: 0,
      games: stat.wins + stat.losses + stat.ties,
      wins: stat.wins,
      losses: stat.losses,
      ties: stat.ties,
      pct: calculateWinPct(stat.wins, stat.losses),
      gamesBack: 0,
      recent10: stat.last10,
      streak: stat.streak,
      home: `${stat.homeWins}-${stat.homeLosses}`,
      away: `${stat.awayWins}-${stat.awayLosses}`,
      runsScored: stat.runsScored,
      runsAllowed: stat.runsAllowed,
      offensePlus: stat.offensePlus,
      pitchingPlus: stat.pitchingPlus,
    };
  });
}

export function buildStandingsTable({
  games,
  teamSeasonStats,
  teamDisplays,
  bucketOdds,
  postseasonOdds,
  ruleset,
}: BuildStandingsArgs): { rows: StandingRow[]; tieAlerts: ReturnType<typeof sortStandingRowsWithTiebreakers>["tieAlerts"] } {
  const recordMap: Record<string, PartialRecord> = {};

  for (const display of teamDisplays) {
    recordMap[display.seasonTeamId] = createRecord();
  }

  const finalGames = [...games]
    .filter((game) => game.status === "final" && game.homeScore !== null && game.awayScore !== null)
    .sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt));

  for (const game of finalGames) {
    const home = recordMap[game.homeSeasonTeamId];
    const away = recordMap[game.awaySeasonTeamId];

    home.runsScored += game.homeScore ?? 0;
    home.runsAllowed += game.awayScore ?? 0;
    away.runsScored += game.awayScore ?? 0;
    away.runsAllowed += game.homeScore ?? 0;

    if (game.isTie || game.homeScore === game.awayScore) {
      home.ties += 1;
      away.ties += 1;
      home.homeTies += 1;
      away.awayTies += 1;
      home.lastOutcomes.push("T");
      away.lastOutcomes.push("T");
      continue;
    }

    if ((game.homeScore ?? 0) > (game.awayScore ?? 0)) {
      home.wins += 1;
      away.losses += 1;
      home.homeWins += 1;
      away.awayLosses += 1;
      home.lastOutcomes.push("W");
      away.lastOutcomes.push("L");
    } else {
      away.wins += 1;
      home.losses += 1;
      away.awayWins += 1;
      home.homeLosses += 1;
      away.lastOutcomes.push("W");
      home.lastOutcomes.push("L");
    }
  }

  const bucketById = Object.fromEntries((bucketOdds ?? []).map((item) => [item.seasonTeamId, item]));
  const postseasonById = Object.fromEntries((postseasonOdds ?? []).map((item) => [item.seasonTeamId, item]));
  const useOfficialStatsBaseline = hasMoreOfficialStandingsThanGames(teamSeasonStats, finalGames);

  const provisionalRows = teamDisplays.map((display) => {
    const record = recordMap[display.seasonTeamId];
    const teamStat = teamSeasonStats.find((stat) => stat.seasonTeamId === display.seasonTeamId);

    if (useOfficialStatsBaseline && teamStat) {
      return {
        ...display,
        rank: 0,
        games: teamStat.wins + teamStat.losses + teamStat.ties,
        wins: teamStat.wins,
        losses: teamStat.losses,
        ties: teamStat.ties,
        pct: calculateWinPct(teamStat.wins, teamStat.losses),
        gamesBack: 0,
        recent10: teamStat.last10,
        streak: teamStat.streak,
        home: formatRecord(teamStat.homeWins, teamStat.homeLosses, 0),
        away: formatRecord(teamStat.awayWins, teamStat.awayLosses, 0),
        runsScored: teamStat.runsScored,
        runsAllowed: teamStat.runsAllowed,
        offensePlus: teamStat.offensePlus,
        pitchingPlus: teamStat.pitchingPlus,
        bucketOdds: bucketById[display.seasonTeamId],
        postseasonOdds: postseasonById[display.seasonTeamId],
      };
    }

    return {
      ...display,
      rank: 0,
      games: record.wins + record.losses + record.ties,
      wins: record.wins,
      losses: record.losses,
      ties: record.ties,
      pct: calculateWinPct(record.wins, record.losses),
      gamesBack: 0,
      recent10: formatLast10(record.lastOutcomes),
      streak: formatStreak(record.lastOutcomes),
      home: formatRecord(record.homeWins, record.homeLosses, record.homeTies),
      away: formatRecord(record.awayWins, record.awayLosses, record.awayTies),
      runsScored: record.runsScored,
      runsAllowed: record.runsAllowed,
      offensePlus: teamStat?.offensePlus ?? 100,
      pitchingPlus: teamStat?.pitchingPlus ?? 100,
      bucketOdds: bucketById[display.seasonTeamId],
      postseasonOdds: postseasonById[display.seasonTeamId],
    };
  });

  const { rows: sortedRows, tieAlerts } = sortStandingRowsWithTiebreakers(
    provisionalRows,
    finalGames,
    {
      rulesetId: "computed",
      label: "computed",
      regularSeasonGamesPerTeam: 0,
      gamesPerOpponent: 0,
      tiesAllowed: true,
      tiebreakerOrder: ruleset.tiebreakerOrder,
      specialPlayoffGamePositions: ruleset.specialPlayoffGamePositions,
      postseasonFormat: [],
      notes: [],
    },
    teamSeasonStats,
  );

  const leaderRecord =
    useOfficialStatsBaseline
      ? {
          wins: sortedRows[0].wins,
          losses: sortedRows[0].losses,
        }
      : recordMap[sortedRows[0].seasonTeamId];
  const rows = sortedRows.map((row, index) => ({
    ...row,
    rank: index + 1,
    gamesBack:
      index === 0
        ? 0
        : calculateGamesBack(
            leaderRecord as PartialRecord,
            useOfficialStatsBaseline
              ? ({ wins: row.wins, losses: row.losses } as PartialRecord)
              : recordMap[row.seasonTeamId],
          ),
  }));

  return { rows, tieAlerts };
}
