import type { KboDataBundle } from "@/lib/domain/kbo/types";
import type {
  NormalizedHistoricalTeamRecords,
  ParsedScheduleRow,
  ParsedScoreboardRow,
} from "@/lib/data-sources/kbo/dataset-types";
import {
  historyTrainingSeasonSchema,
  type HistoryTrainingDailySnapshot,
  type HistoryTrainingGame,
  type HistoryTrainingSeason,
  type HistoryTrainingTeamMeta,
} from "@/lib/data-sources/kbo/history-training-types";

type ParsedSnapshot<TRow> = {
  snapshotKey: string;
  rows: TRow[];
};

type BuildHistoryTrainingSeasonArgs = {
  year: number;
  historicalSnapshotKey: string;
  historicalRows: NormalizedHistoricalTeamRecords["rows"];
  bundle: Pick<KboDataBundle, "teamBrands">;
  snapshotDates: string[];
  scheduleSnapshots: ParsedSnapshot<ParsedScheduleRow>[];
  scoreboardSnapshots: ParsedSnapshot<ParsedScoreboardRow>[];
};

type TeamRecordAccumulator = {
  wins: number;
  losses: number;
  ties: number;
  runsScored: number;
  runsAllowed: number;
  homeWins: number;
  homeLosses: number;
  homeTies: number;
  awayWins: number;
  awayLosses: number;
  awayTies: number;
  outcomes: string[];
};

type HeadToHeadRecord = {
  wins: number;
  losses: number;
  ties: number;
  runsScored: number;
  runsAllowed: number;
};

const ENGLISH_TEAM_ALIASES: Record<string, string> = {
  DOOSAN: "doosan",
  BEARS: "doosan",
  LG: "lg",
  KIA: "kia",
  SAMSUNG: "samsung",
  LIONS: "samsung",
  LOTTE: "lotte",
  GIANTS: "lotte",
  HANWHA: "hanwha",
  EAGLES: "hanwha",
  KT: "kt",
  WIZ: "kt",
  NC: "nc",
  DINOS: "nc",
  SSG: "ssg",
  LANDERS: "ssg",
  SK: "ssg",
  WYVERNS: "ssg",
  KIWOOM: "heroes",
  HEROES: "heroes",
  NEXEN: "heroes",
};

function normalizeToken(value: string) {
  return value.replace(/[\s._-]+/g, "").toUpperCase();
}

function extractTimeKey(scheduledAt: string) {
  return scheduledAt.split("T")[1]?.slice(0, 5) ?? "00:00";
}

function buildCanonicalGameKey(args: {
  date: string;
  awayFranchiseId: string;
  homeFranchiseId: string;
  scheduledAt: string;
}) {
  return [
    args.date.replace(/-/g, ""),
    args.awayFranchiseId,
    args.homeFranchiseId,
    extractTimeKey(args.scheduledAt),
  ].join("-");
}

function isBrandActiveInYear(startYear: number, endYear: number | null, year: number) {
  return startYear <= year && (endYear === null || year <= endYear);
}

function resolveBrandId(
  bundle: Pick<KboDataBundle, "teamBrands">,
  franchiseId: string,
  brandLabel: string,
  year: number,
) {
  const exact = bundle.teamBrands.find(
    (brand) =>
      brand.franchiseId === franchiseId &&
      brand.displayNameKo === brandLabel &&
      isBrandActiveInYear(brand.seasonStartYear, brand.seasonEndYear, year),
  );
  if (exact) {
    return exact.brandId;
  }

  return (
    bundle.teamBrands.find(
      (brand) =>
        brand.franchiseId === franchiseId &&
        isBrandActiveInYear(brand.seasonStartYear, brand.seasonEndYear, year),
    )?.brandId ?? null
  );
}

function resolveShortCode(
  bundle: Pick<KboDataBundle, "teamBrands">,
  franchiseId: string,
  brandId: string | null,
  brandLabel: string,
) {
  const brand =
    (brandId ? bundle.teamBrands.find((item) => item.brandId === brandId) : null) ??
    bundle.teamBrands.find((item) => item.franchiseId === franchiseId);
  if (brand?.shortCode) {
    return brand.shortCode;
  }
  const leadingToken = brandLabel.split(/\s+/).find((token) => token.length > 0);
  return (leadingToken ?? franchiseId).toUpperCase();
}

function buildTeamMetaByFranchise(args: {
  year: number;
  historicalRows: NormalizedHistoricalTeamRecords["rows"];
  bundle: Pick<KboDataBundle, "teamBrands">;
}) {
  const rows = args.historicalRows.filter((row) => row.year === args.year).sort((left, right) => left.rank - right.rank);
  if (rows.length === 0) {
    throw new Error(`No historical final rows available for ${args.year}.`);
  }

  return Object.fromEntries(
    rows.map((row) => {
      const brandId = resolveBrandId(args.bundle, row.franchiseId, row.brandLabel, args.year);
      const shortCode = resolveShortCode(args.bundle, row.franchiseId, brandId, row.brandLabel);
      const teamKey = `history-${args.year}-${row.franchiseId}`;
      const teamMeta: HistoryTrainingTeamMeta = {
        teamKey,
        franchiseId: row.franchiseId,
        brandId,
        brandLabel: row.brandLabel,
        shortCode,
      };
      return [row.franchiseId, teamMeta] as const;
    }),
  );
}

function buildFranchiseAliasMap(
  bundle: Pick<KboDataBundle, "teamBrands">,
  teamMetaByFranchise: Record<string, HistoryTrainingTeamMeta>,
) {
  const aliasMap = new Map<string, string>();

  for (const [alias, franchiseId] of Object.entries(ENGLISH_TEAM_ALIASES)) {
    if (teamMetaByFranchise[franchiseId]) {
      aliasMap.set(normalizeToken(alias), franchiseId);
    }
  }

  for (const brand of bundle.teamBrands) {
    if (!teamMetaByFranchise[brand.franchiseId]) {
      continue;
    }
    aliasMap.set(normalizeToken(brand.displayNameKo), brand.franchiseId);
    aliasMap.set(normalizeToken(brand.shortNameKo), brand.franchiseId);
    aliasMap.set(normalizeToken(brand.shortCode), brand.franchiseId);
    aliasMap.set(normalizeToken(brand.franchiseId), brand.franchiseId);
  }

  for (const teamMeta of Object.values(teamMetaByFranchise)) {
    aliasMap.set(normalizeToken(teamMeta.brandLabel), teamMeta.franchiseId);
    aliasMap.set(normalizeToken(teamMeta.shortCode), teamMeta.franchiseId);
  }

  return aliasMap;
}

function resolveFranchiseId(
  rawTeamName: string,
  aliasMap: Map<string, string>,
) {
  return aliasMap.get(normalizeToken(rawTeamName)) ?? null;
}

function buildGameVersionPriority(game: HistoryTrainingGame) {
  const statusPriority =
    game.status === "final"
      ? 50
      : game.status === "scheduled"
        ? 30
        : game.status === "tbd"
          ? 20
          : game.status === "postponed"
            ? 10
            : 5;
  const sourcePriority = (game.scoreboardSeen ? 20 : 0) + (game.scheduleSeen ? 5 : 0);
  const detailPriority =
    (game.homeScore !== null ? 2 : 0) +
    (game.awayScore !== null ? 2 : 0) +
    (game.innings !== null ? 1 : 0);
  return statusPriority + sourcePriority + detailPriority;
}

function mergeGameVersions(existing: HistoryTrainingGame | undefined, candidate: HistoryTrainingGame) {
  if (!existing) {
    return candidate;
  }

  const preferred =
    buildGameVersionPriority(candidate) > buildGameVersionPriority(existing) ? candidate : existing;
  const fallback = preferred === candidate ? existing : candidate;

  return {
    ...preferred,
    homeScore: preferred.homeScore ?? fallback.homeScore,
    awayScore: preferred.awayScore ?? fallback.awayScore,
    innings: preferred.innings ?? fallback.innings,
    isTie:
      preferred.homeScore !== null && preferred.awayScore !== null
        ? preferred.isTie
        : fallback.isTie,
    scheduleSeen: existing.scheduleSeen || candidate.scheduleSeen,
    scoreboardSeen: existing.scoreboardSeen || candidate.scoreboardSeen,
  };
}

function createEmptyAccumulator(): TeamRecordAccumulator {
  return {
    wins: 0,
    losses: 0,
    ties: 0,
    runsScored: 0,
    runsAllowed: 0,
    homeWins: 0,
    homeLosses: 0,
    homeTies: 0,
    awayWins: 0,
    awayLosses: 0,
    awayTies: 0,
    outcomes: [],
  };
}

function createEmptyHeadToHeadRecord(): HeadToHeadRecord {
  return {
    wins: 0,
    losses: 0,
    ties: 0,
    runsScored: 0,
    runsAllowed: 0,
  };
}

function calculateWinPct(wins: number, losses: number) {
  if (wins + losses === 0) {
    return 0;
  }
  return Number((wins / (wins + losses)).toFixed(3));
}

function calculateGamesBack(leader: TeamRecordAccumulator, challenger: TeamRecordAccumulator) {
  return Math.max(
    0,
    Number(
      (((leader.wins - challenger.wins) + (challenger.losses - leader.losses)) / 2).toFixed(1),
    ),
  );
}

function formatLast10(outcomes: string[]) {
  const sample = outcomes.slice(-10);
  const wins = sample.filter((item) => item === "W").length;
  const losses = sample.filter((item) => item === "L").length;
  const ties = sample.filter((item) => item === "T").length;
  return `${wins}-${losses}${ties > 0 ? `-${ties}` : ""}`;
}

function formatStreak(outcomes: string[]) {
  if (outcomes.length === 0) {
    return "-";
  }

  const latest = outcomes.at(-1) ?? "T";
  let count = 0;
  for (let index = outcomes.length - 1; index >= 0; index -= 1) {
    if (outcomes[index] !== latest) {
      break;
    }
    count += 1;
  }

  if (latest === "T") {
    return `무${count}`;
  }

  return `${latest === "W" ? "승" : "패"}${count}`;
}

function buildHeadToHeadTable(finalGames: HistoryTrainingGame[]) {
  const table: Record<string, Record<string, HeadToHeadRecord>> = {};

  for (const game of finalGames) {
    const homeId = game.homeFranchiseId;
    const awayId = game.awayFranchiseId;
    table[homeId] ??= {};
    table[awayId] ??= {};
    table[homeId][awayId] ??= createEmptyHeadToHeadRecord();
    table[awayId][homeId] ??= createEmptyHeadToHeadRecord();

    const homeRecord = table[homeId][awayId];
    const awayRecord = table[awayId][homeId];
    homeRecord.runsScored += game.homeScore ?? 0;
    homeRecord.runsAllowed += game.awayScore ?? 0;
    awayRecord.runsScored += game.awayScore ?? 0;
    awayRecord.runsAllowed += game.homeScore ?? 0;

    if (game.isTie || game.homeScore === game.awayScore) {
      homeRecord.ties += 1;
      awayRecord.ties += 1;
    } else if ((game.homeScore ?? 0) > (game.awayScore ?? 0)) {
      homeRecord.wins += 1;
      awayRecord.losses += 1;
    } else {
      awayRecord.wins += 1;
      homeRecord.losses += 1;
    }
  }

  return table;
}

function compareHeadToHead(
  headToHead: Record<string, Record<string, HeadToHeadRecord>>,
  leftId: string,
  rightId: string,
) {
  const left = headToHead[leftId]?.[rightId];
  const right = headToHead[rightId]?.[leftId];
  if (!left || !right) {
    return 0;
  }

  const leftPct = left.wins / Math.max(1, left.wins + left.losses);
  const rightPct = right.wins / Math.max(1, right.wins + right.losses);
  return rightPct - leftPct;
}

function sortFranchiseIds(args: {
  franchiseIds: string[];
  records: Record<string, TeamRecordAccumulator>;
  headToHead: Record<string, Record<string, HeadToHeadRecord>>;
  teamMetaByFranchise: Record<string, HistoryTrainingTeamMeta>;
}) {
  return [...args.franchiseIds].sort((leftId, rightId) => {
    const left = args.records[leftId];
    const right = args.records[rightId];
    const leftPct = calculateWinPct(left.wins, left.losses);
    const rightPct = calculateWinPct(right.wins, right.losses);

    if (rightPct !== leftPct) {
      return rightPct - leftPct;
    }

    const headToHeadResult = compareHeadToHead(args.headToHead, leftId, rightId);
    if (headToHeadResult !== 0) {
      return headToHeadResult;
    }

    const leftDiff = left.runsScored - left.runsAllowed;
    const rightDiff = right.runsScored - right.runsAllowed;
    if (rightDiff !== leftDiff) {
      return rightDiff - leftDiff;
    }

    if (right.runsScored !== left.runsScored) {
      return right.runsScored - left.runsScored;
    }

    return args.teamMetaByFranchise[leftId].shortCode.localeCompare(
      args.teamMetaByFranchise[rightId].shortCode,
      "ko",
    );
  });
}

function buildSnapshot(args: {
  asOfDate: string;
  teamMetaByFranchise: Record<string, HistoryTrainingTeamMeta>;
  finalRowsByFranchise: Record<string, NormalizedHistoricalTeamRecords["rows"][number]>;
  completedGames: HistoryTrainingGame[];
  allGames: HistoryTrainingGame[];
}) {
  const franchiseIds = Object.keys(args.teamMetaByFranchise);
  const records = Object.fromEntries(franchiseIds.map((franchiseId) => [franchiseId, createEmptyAccumulator()]));

  for (const game of args.completedGames) {
    const home = records[game.homeFranchiseId];
    const away = records[game.awayFranchiseId];

    home.runsScored += game.homeScore ?? 0;
    home.runsAllowed += game.awayScore ?? 0;
    away.runsScored += game.awayScore ?? 0;
    away.runsAllowed += game.homeScore ?? 0;

    if (game.isTie || game.homeScore === game.awayScore) {
      home.ties += 1;
      away.ties += 1;
      home.homeTies += 1;
      away.awayTies += 1;
      home.outcomes.push("T");
      away.outcomes.push("T");
    } else if ((game.homeScore ?? 0) > (game.awayScore ?? 0)) {
      home.wins += 1;
      away.losses += 1;
      home.homeWins += 1;
      away.awayLosses += 1;
      home.outcomes.push("W");
      away.outcomes.push("L");
    } else {
      away.wins += 1;
      home.losses += 1;
      away.awayWins += 1;
      home.homeLosses += 1;
      away.outcomes.push("W");
      home.outcomes.push("L");
    }
  }

  const remainingGames = args.allGames.filter(
    (game) =>
      game.date > args.asOfDate &&
      game.status !== "postponed" &&
      game.status !== "suspended",
  );
  const headToHead = buildHeadToHeadTable(args.completedGames);
  const sortedFranchiseIds = sortFranchiseIds({
    franchiseIds,
    records,
    headToHead,
    teamMetaByFranchise: args.teamMetaByFranchise,
  });
  const leader = records[sortedFranchiseIds[0]];

  const teams = sortedFranchiseIds.map((franchiseId, index) => {
    const teamMeta = args.teamMetaByFranchise[franchiseId];
    const record = records[franchiseId];
    const finalRow = args.finalRowsByFranchise[franchiseId];
    const futureGames = remainingGames
      .filter(
        (game) => game.homeFranchiseId === franchiseId || game.awayFranchiseId === franchiseId,
      )
      .sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt));
    const remainingByOpponent = futureGames.reduce<Record<string, number>>((accumulator, game) => {
      const opponentId =
        game.homeFranchiseId === franchiseId ? game.awayFranchiseId : game.homeFranchiseId;
      accumulator[opponentId] = (accumulator[opponentId] ?? 0) + 1;
      return accumulator;
    }, {});
    const nextGame = futureGames[0] ?? null;
    const nextOpponentId =
      nextGame === null
        ? null
        : nextGame.homeFranchiseId === franchiseId
          ? nextGame.awayFranchiseId
          : nextGame.homeFranchiseId;

    return {
      ...teamMeta,
      rank: index + 1,
      games: record.wins + record.losses + record.ties,
      wins: record.wins,
      losses: record.losses,
      ties: record.ties,
      pct: calculateWinPct(record.wins, record.losses),
      gamesBack: index === 0 ? 0 : calculateGamesBack(leader, record),
      recent10: formatLast10(record.outcomes),
      streak: formatStreak(record.outcomes),
      runsScored: record.runsScored,
      runsAllowed: record.runsAllowed,
      runDifferential: record.runsScored - record.runsAllowed,
      homeWins: record.homeWins,
      homeLosses: record.homeLosses,
      homeTies: record.homeTies,
      awayWins: record.awayWins,
      awayLosses: record.awayLosses,
      awayTies: record.awayTies,
      remainingGames: futureGames.length,
      remainingHomeGames: futureGames.filter((game) => game.homeFranchiseId === franchiseId).length,
      remainingAwayGames: futureGames.filter((game) => game.awayFranchiseId === franchiseId).length,
      remainingByOpponent,
      nextGameDate: nextGame?.date ?? null,
      nextOpponentFranchiseId: nextOpponentId,
      nextOpponentBrandLabel: nextOpponentId ? args.teamMetaByFranchise[nextOpponentId].brandLabel : null,
      finalRank: finalRow.rank,
      finalWins: finalRow.wins,
      finalLosses: finalRow.losses,
      finalTies: finalRow.ties,
      winsRemainingToFinal: finalRow.wins - record.wins,
      lossesRemainingToFinal: finalRow.losses - record.losses,
      tiesRemainingToFinal: finalRow.ties - record.ties,
    };
  });

  const snapshot: HistoryTrainingDailySnapshot = {
    asOfDate: args.asOfDate,
    completedGames: args.completedGames.length,
    remainingGames: remainingGames.length,
    teams,
  };
  return snapshot;
}

export function buildHistoryTrainingSeason({
  year,
  historicalSnapshotKey,
  historicalRows,
  bundle,
  snapshotDates,
  scheduleSnapshots,
  scoreboardSnapshots,
}: BuildHistoryTrainingSeasonArgs): HistoryTrainingSeason {
  const teamMetaByFranchise = buildTeamMetaByFranchise({
    year,
    historicalRows,
    bundle,
  });
  const aliasMap = buildFranchiseAliasMap(bundle, teamMetaByFranchise);
  const finalRows = historicalRows
    .filter((row) => row.year === year)
    .sort((left, right) => left.rank - right.rank);
  const finalRowsByFranchise = Object.fromEntries(finalRows.map((row) => [row.franchiseId, row]));
  const gamesByKey = new Map<string, HistoryTrainingGame>();

  for (const snapshot of scheduleSnapshots) {
    for (const row of snapshot.rows) {
      const homeFranchiseId = resolveFranchiseId(row.homeTeamName, aliasMap);
      const awayFranchiseId = resolveFranchiseId(row.awayTeamName, aliasMap);
      if (!homeFranchiseId || !awayFranchiseId) {
        continue;
      }
      const gameKey = buildCanonicalGameKey({
        date: row.date,
        awayFranchiseId,
        homeFranchiseId,
        scheduledAt: row.scheduledAt,
      });
      const candidate: HistoryTrainingGame = {
        gameKey,
        date: row.date,
        scheduledAt: row.scheduledAt,
        homeFranchiseId,
        awayFranchiseId,
        homeBrandLabel: teamMetaByFranchise[homeFranchiseId].brandLabel,
        awayBrandLabel: teamMetaByFranchise[awayFranchiseId].brandLabel,
        venueName: row.venueName,
        status: row.status,
        homeScore: row.homeScore,
        awayScore: row.awayScore,
        innings: row.innings,
        isTie: row.isTie,
        scheduleSeen: true,
        scoreboardSeen: false,
      };
      gamesByKey.set(gameKey, mergeGameVersions(gamesByKey.get(gameKey), candidate));
    }
  }

  for (const snapshot of scoreboardSnapshots) {
    for (const row of snapshot.rows) {
      const homeFranchiseId = resolveFranchiseId(row.homeTeamName, aliasMap);
      const awayFranchiseId = resolveFranchiseId(row.awayTeamName, aliasMap);
      if (!homeFranchiseId || !awayFranchiseId) {
        continue;
      }
      const gameKey = buildCanonicalGameKey({
        date: row.date,
        awayFranchiseId,
        homeFranchiseId,
        scheduledAt: row.scheduledAt,
      });
      const candidate: HistoryTrainingGame = {
        gameKey,
        date: row.date,
        scheduledAt: row.scheduledAt,
        homeFranchiseId,
        awayFranchiseId,
        homeBrandLabel: teamMetaByFranchise[homeFranchiseId].brandLabel,
        awayBrandLabel: teamMetaByFranchise[awayFranchiseId].brandLabel,
        venueName: row.venueName,
        status: row.status,
        homeScore: row.homeScore,
        awayScore: row.awayScore,
        innings: row.innings,
        isTie: row.isTie,
        scheduleSeen: false,
        scoreboardSeen: true,
      };
      const existing = gamesByKey.get(gameKey);
      if (!existing) {
        continue;
      }
      gamesByKey.set(gameKey, mergeGameVersions(existing, candidate));
    }
  }

  const gameLedger = [...gamesByKey.values()]
    .filter(
      (game) =>
        game.date.startsWith(`${year}-`) &&
        game.scheduleSeen &&
        game.status === "final" &&
        game.homeScore !== null &&
        game.awayScore !== null,
    )
    .sort((left, right) => {
      if (left.date !== right.date) {
        return left.date.localeCompare(right.date);
      }
      if (left.scheduledAt !== right.scheduledAt) {
        return left.scheduledAt.localeCompare(right.scheduledAt);
      }
      return left.gameKey.localeCompare(right.gameKey);
    });

  const effectiveSnapshotDates =
    snapshotDates.length > 0
      ? Array.from(new Set(snapshotDates)).sort()
      : Array.from(new Set(gameLedger.map((game) => game.date))).sort();
  const snapshots = effectiveSnapshotDates.map((asOfDate) =>
    buildSnapshot({
      asOfDate,
      teamMetaByFranchise,
      finalRowsByFranchise,
      completedGames: gameLedger.filter(
        (game) => game.date <= asOfDate && game.status === "final" && game.homeScore !== null && game.awayScore !== null,
      ),
      allGames: gameLedger,
    }),
  );

  return historyTrainingSeasonSchema.parse({
    generatedAt: new Date().toISOString(),
    seasonId: `kbo-${year}`,
    year,
    teamCount: finalRows.length,
    scheduledGameCount: gameLedger.length,
    completedGameCount: gameLedger.filter((game) => game.status === "final").length,
    scheduleSnapshotCount: scheduleSnapshots.length,
    scoreboardSnapshotCount: scoreboardSnapshots.length,
    historicalRecordSnapshotKey: historicalSnapshotKey,
    teams: Object.values(teamMetaByFranchise).sort((left, right) =>
      left.franchiseId.localeCompare(right.franchiseId, "ko"),
    ),
    gameLedger,
    snapshots,
  });
}
