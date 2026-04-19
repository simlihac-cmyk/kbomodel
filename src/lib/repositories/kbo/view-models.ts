import { cache } from "react";

import {
  buildArchiveStandingsRows,
  buildArchiveHeadline,
  buildArchiveNarrative,
  getHistoricalRowsForFranchise,
  getHistoricalRowsForYear,
  hasCompleteHistoricalStandings,
  inferHistoricalGameCount,
  summarizeHistoricalCoverage,
} from "@/lib/archive/kbo-archive";
import { buildStandingsTable } from "@/lib/domain/kbo/standings";
import type {
  Award,
  Franchise,
  Game,
  Player,
  PlayerSeasonStat,
  RecordOutcome,
  ScenarioOverride,
  Season,
  SeasonTeam,
  Series,
  StandingRow,
  SimulationInput,
  TeamBrand,
  TeamDisplay,
  TeamSeasonStat,
  TeamSplitStat,
  TeamStrengthSnapshot,
} from "@/lib/domain/kbo/types";
import { kboSourceFeatureFlags, type NormalizedHistoricalTeamRecords } from "@/lib/data-sources/kbo/dataset-types";
import { kboRepository } from "@/lib/repositories/kbo";
import { normalizeTeamSlug } from "@/lib/utils/routes";
import { FileKboManifestRepository } from "@/lib/repositories/kbo/manifest-repository";
import { FileNormalizedKboRepository } from "@/lib/repositories/kbo/normalized-repository";
import { simulateSeason } from "@/lib/sim/kbo";
import type { AutomationStatusViewModel } from "@/components/shared/freshness-badges";
import type { CurrentManifest, SimulationManifest } from "@/lib/publish/contracts";

function teamDisplayMap(teamDisplays: TeamDisplay[]): Record<string, TeamDisplay> {
  return Object.fromEntries(teamDisplays.map((item) => [item.seasonTeamId, item]));
}

function buildSimulationInput(
  seasonContext: NonNullable<Awaited<ReturnType<typeof kboRepository.getSeasonContext>>>,
  previousSeasonStats: TeamSeasonStat[],
  overrides: ScenarioOverride[] = [],
): SimulationInput {
  return {
    season: seasonContext.season,
    ruleset: seasonContext.ruleset,
    seasonTeams: seasonContext.seasonTeams,
    series: seasonContext.series,
    games: seasonContext.games,
    teamSeasonStats: seasonContext.teamSeasonStats,
    players: seasonContext.players,
    rosterEvents: seasonContext.rosterEvents,
    playerSeasonStats: seasonContext.playerSeasonStats,
    playerGameStats: seasonContext.playerGameStats,
    previousSeasonStats,
    scenarioOverrides: overrides,
  };
}

function parseDate(input: string): number {
  return new Date(input).getTime();
}

function buildRecentOutcomeMap(games: Game[]): Record<string, RecordOutcome[]> {
  const outcomesByTeamId: Record<string, RecordOutcome[]> = {};
  const finalGames = games
    .filter((game) => game.status === "final" && game.homeScore !== null && game.awayScore !== null)
    .sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt));

  for (const game of finalGames) {
    const isTieGame = game.isTie || game.homeScore === game.awayScore;
    const homeOutcome: RecordOutcome = isTieGame
      ? "T"
      : (game.homeScore ?? 0) > (game.awayScore ?? 0)
        ? "W"
        : "L";
    const awayOutcome: RecordOutcome = isTieGame
      ? "T"
      : (game.homeScore ?? 0) > (game.awayScore ?? 0)
        ? "L"
        : "W";

    if (!outcomesByTeamId[game.homeSeasonTeamId]) {
      outcomesByTeamId[game.homeSeasonTeamId] = [];
    }
    if (!outcomesByTeamId[game.awaySeasonTeamId]) {
      outcomesByTeamId[game.awaySeasonTeamId] = [];
    }

    outcomesByTeamId[game.homeSeasonTeamId].push(homeOutcome);
    outcomesByTeamId[game.awaySeasonTeamId].push(awayOutcome);
  }

  return Object.fromEntries(
    Object.entries(outcomesByTeamId).map(([seasonTeamId, outcomes]) => [
      seasonTeamId,
      outcomes.slice(-10),
    ]),
  );
}

function formatDashboardStreak(streak: string): string {
  if (streak.startsWith("W")) {
    return `승${streak.slice(1)}`;
  }
  if (streak.startsWith("L")) {
    return `패${streak.slice(1)}`;
  }
  if (streak.startsWith("T")) {
    return `무${streak.slice(1)}`;
  }
  return streak;
}

function monthOrderKey(splitKey: string) {
  const order = ["MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV"];
  const index = order.indexOf(splitKey.toUpperCase());
  return index === -1 ? order.length : index;
}

type PlayerRankingMetric = {
  key: string;
  label: string;
  valueLabel: string;
  leagueRank: number;
  leagueTotal: number;
  teamRank: number;
  teamTotal: number;
};

type PlayerSplitPageStat = {
  playerSplitStatId: string;
  splitKey: string;
  splitLabel: string;
  teamLabel: string;
  summaryLine: string;
  games: number;
  statType?: "hitter" | "pitcher";
  battingAverage?: number | null;
  hits?: number | null;
  homeRuns?: number | null;
  rbi?: number | null;
  era?: number | null;
  inningsPitched?: number | null;
  opponentAvg?: number | null;
  strikeouts?: number | null;
};

type PlayerSituationSplitGroup = {
  key: string;
  title: string;
  splits: PlayerSplitPageStat[];
};

type PlayerSeasonPageStat = {
  statId: string;
  statType: "hitter" | "pitcher";
  seasonLabel: string;
  seasonYear: number;
  teamLabel: string;
  teamCode: string | null;
  games: number;
  battingAverage?: number | null;
  hits?: number | null;
  homeRuns?: number | null;
  rbi?: number | null;
  ops?: number | null;
  era?: number | null;
  inningsPitched?: number | null;
  strikeouts?: number | null;
  wins?: number | null;
  losses?: number | null;
  saves?: number | null;
  holds?: number | null;
  whip?: number | null;
};

type PlayerAwardHistoryItem = {
  awardId: string;
  seasonId: string;
  seasonYear: number;
  seasonLabel: string;
  label: string;
  teamLabel: string;
  note: string;
  directMatch: boolean;
};

function normalizeLookupToken(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  return value
    .toLowerCase()
    .replace(/[\s()_.-]+/g, "")
    .trim();
}

function tokensMatch(left: string, right: string) {
  if (left === right) {
    return true;
  }

  if (left.length < 2 || right.length < 2) {
    return false;
  }

  return left.includes(right) || right.includes(left);
}

function parseSeasonYearFromSeasonId(seasonId: string) {
  const match = seasonId.match(/(19|20)\d{2}/);
  return match ? Number.parseInt(match[0], 10) : 0;
}

function parseAwardNoteParts(note: string) {
  const [playerName = "", teamName = "", position = ""] = note.split(" · ").map((item) => item.trim());
  return {
    playerName,
    teamName,
    position,
  };
}

function collectSeasonTeamTokens(
  seasonTeamId: string | null,
  seasonTeamById: Record<string, SeasonTeam>,
  brandById: Record<string, TeamBrand>,
  franchiseById: Record<string, Franchise>,
) {
  if (!seasonTeamId) {
    return [];
  }

  const seasonTeam = seasonTeamById[seasonTeamId];
  if (!seasonTeam) {
    return [];
  }

  const brand = brandById[seasonTeam.brandId];
  const franchise = franchiseById[seasonTeam.franchiseId];
  return [
    normalizeLookupToken(brand?.displayNameKo),
    normalizeLookupToken(brand?.shortNameKo),
    normalizeLookupToken(brand?.shortCode),
    normalizeLookupToken(franchise?.canonicalNameKo),
    normalizeLookupToken(franchise?.shortNameKo),
    normalizeLookupToken(seasonTeam.franchiseId),
  ].filter((item): item is string => item !== null);
}

export function buildPlayerAwardHistory(args: {
  player: Player;
  awards: Award[];
  seasons: Season[];
  seasonTeams: SeasonTeam[];
  teamBrands: TeamBrand[];
  franchises: Franchise[];
  seasonStats: PlayerSeasonStat[];
  careerStats: { year: number; teamLabel: string }[];
}) {
  const { player, awards, seasons, seasonTeams, teamBrands, franchises, seasonStats, careerStats } = args;
  const seasonById = Object.fromEntries(seasons.map((season) => [season.seasonId, season] as const));
  const seasonTeamById = Object.fromEntries(seasonTeams.map((seasonTeam) => [seasonTeam.seasonTeamId, seasonTeam] as const));
  const brandById = Object.fromEntries(teamBrands.map((brand) => [brand.brandId, brand] as const));
  const franchiseById = Object.fromEntries(franchises.map((franchise) => [franchise.franchiseId, franchise] as const));
  const playerTeamTokensByYear = new Map<number, Set<string>>();

  const addYearToken = (year: number, token: string | null | undefined) => {
    const normalizedToken = normalizeLookupToken(token);
    if (!normalizedToken || year <= 0) {
      return;
    }
    if (!playerTeamTokensByYear.has(year)) {
      playerTeamTokensByYear.set(year, new Set<string>());
    }
    playerTeamTokensByYear.get(year)?.add(normalizedToken);
  };

  for (const stat of seasonStats) {
    const seasonYear = seasonById[stat.seasonId]?.year ?? parseSeasonYearFromSeasonId(stat.seasonId);
    for (const token of collectSeasonTeamTokens(stat.seasonTeamId, seasonTeamById, brandById, franchiseById)) {
      addYearToken(seasonYear, token);
    }
  }

  for (const stat of careerStats) {
    addYearToken(stat.year, stat.teamLabel);
  }

  const matchedAwards = awards
    .filter((award) => {
      if (award.playerId) {
        return award.playerId === player.playerId;
      }

      const noteParts = parseAwardNoteParts(award.note);
      if (noteParts.playerName !== player.nameKo) {
        return false;
      }

      const seasonYear = seasonById[award.seasonId]?.year ?? parseSeasonYearFromSeasonId(award.seasonId);
      const knownTokens = playerTeamTokensByYear.get(seasonYear);
      if (!knownTokens || knownTokens.size === 0) {
        return false;
      }

      const awardTokens = new Set<string>([
        ...collectSeasonTeamTokens(award.seasonTeamId, seasonTeamById, brandById, franchiseById),
        ...(normalizeLookupToken(noteParts.teamName) ? [normalizeLookupToken(noteParts.teamName)!] : []),
      ]);

      return [...awardTokens].some((awardToken) =>
        [...knownTokens].some((playerToken) => tokensMatch(awardToken, playerToken)),
      );
    })
    .map((award) => {
      const noteParts = parseAwardNoteParts(award.note);
      const season = seasonById[award.seasonId];
      const seasonYear = season?.year ?? parseSeasonYearFromSeasonId(award.seasonId);
      const seasonTeam = award.seasonTeamId ? seasonTeamById[award.seasonTeamId] : null;
      const brand = seasonTeam ? brandById[seasonTeam.brandId] : null;

      return {
        awardId: award.awardId,
        seasonId: award.seasonId,
        seasonYear,
        seasonLabel: season ? season.label : `${seasonYear}`,
        label: award.label,
        teamLabel: (brand?.displayNameKo ?? noteParts.teamName) || "-",
        note: award.note,
        directMatch: award.playerId === player.playerId,
      } satisfies PlayerAwardHistoryItem;
    });

  return Array.from(
    new Map(matchedAwards.map((award) => [award.awardId, award] as const)).values(),
  ).sort(
    (left, right) =>
      right.seasonYear - left.seasonYear ||
      left.label.localeCompare(right.label, "ko") ||
      left.teamLabel.localeCompare(right.teamLabel, "ko"),
  );
}

export function buildPlayerSeasonRankingContext(
  stat: PlayerSeasonStat,
  seasonStats: PlayerSeasonStat[],
) {
  const sameSeasonStats = seasonStats.filter(
    (item) => item.seasonId === stat.seasonId && item.statType === stat.statType,
  );
  const sameTeamStats = sameSeasonStats.filter((item) => item.seasonTeamId === stat.seasonTeamId);

  const metricConfigs =
    stat.statType === "hitter"
      ? [
          {
            key: "battingAverage",
            label: "타율",
            valueOf: (item: PlayerSeasonStat) => item.battingAverage ?? -1,
            valueLabel: (item: PlayerSeasonStat) => (item.battingAverage ?? 0).toFixed(3),
            descending: true,
          },
          {
            key: "ops",
            label: "OPS",
            valueOf: (item: PlayerSeasonStat) => item.ops ?? -1,
            valueLabel: (item: PlayerSeasonStat) => (item.ops ?? 0).toFixed(3),
            descending: true,
          },
          {
            key: "homeRuns",
            label: "홈런",
            valueOf: (item: PlayerSeasonStat) => item.homeRuns ?? -1,
            valueLabel: (item: PlayerSeasonStat) => String(item.homeRuns ?? 0),
            descending: true,
          },
          {
            key: "rbi",
            label: "타점",
            valueOf: (item: PlayerSeasonStat) => item.rbi ?? -1,
            valueLabel: (item: PlayerSeasonStat) => String(item.rbi ?? 0),
            descending: true,
          },
          {
            key: "hits",
            label: "안타",
            valueOf: (item: PlayerSeasonStat) => item.hits ?? -1,
            valueLabel: (item: PlayerSeasonStat) => String(item.hits ?? 0),
            descending: true,
          },
        ]
      : [
          {
            key: "era",
            label: "ERA",
            valueOf: (item: PlayerSeasonStat) => item.era ?? Number.POSITIVE_INFINITY,
            valueLabel: (item: PlayerSeasonStat) => (item.era ?? 0).toFixed(2),
            descending: false,
          },
          {
            key: "whip",
            label: "WHIP",
            valueOf: (item: PlayerSeasonStat) => item.whip ?? Number.POSITIVE_INFINITY,
            valueLabel: (item: PlayerSeasonStat) => (item.whip ?? 0).toFixed(2),
            descending: false,
          },
          {
            key: "strikeouts",
            label: "탈삼진",
            valueOf: (item: PlayerSeasonStat) => item.strikeouts ?? -1,
            valueLabel: (item: PlayerSeasonStat) => String(item.strikeouts ?? 0),
            descending: true,
          },
          {
            key: "wins",
            label: "승리",
            valueOf: (item: PlayerSeasonStat) => item.wins ?? -1,
            valueLabel: (item: PlayerSeasonStat) => String(item.wins ?? 0),
            descending: true,
          },
          {
            key: "saves",
            label: "세이브",
            valueOf: (item: PlayerSeasonStat) => item.saves ?? -1,
            valueLabel: (item: PlayerSeasonStat) => String(item.saves ?? 0),
            descending: true,
          },
          {
            key: "holds",
            label: "홀드",
            valueOf: (item: PlayerSeasonStat) => item.holds ?? -1,
            valueLabel: (item: PlayerSeasonStat) => String(item.holds ?? 0),
            descending: true,
          },
        ];

  const rankFor = (
    rows: PlayerSeasonStat[],
    valueOf: (item: PlayerSeasonStat) => number,
    descending: boolean,
  ) => {
    const sorted = [...rows].sort((left, right) => {
      const leftValue = valueOf(left);
      const rightValue = valueOf(right);
      return descending ? rightValue - leftValue : leftValue - rightValue;
    });
    const rank = sorted.findIndex((item) => item.playerId === stat.playerId) + 1;
    return { rank, total: sorted.length };
  };

  return metricConfigs
    .map((config) => {
      const league = rankFor(sameSeasonStats, config.valueOf, config.descending);
      const team = rankFor(sameTeamStats, config.valueOf, config.descending);
      if (!league.rank || !team.rank) {
        return null;
      }
      return {
        key: config.key,
        label: config.label,
        valueLabel: config.valueLabel(stat),
        leagueRank: league.rank,
        leagueTotal: league.total,
        teamRank: team.rank,
        teamTotal: team.total,
      } satisfies PlayerRankingMetric;
    })
    .filter((item): item is PlayerRankingMetric => item !== null);
}

function classifySituationSplitGroup(splitKey: string) {
  const normalized = splitKey.toUpperCase();
  if (normalized.startsWith("VS ")) {
    return { key: "matchup", title: "좌우 유형별", order: 0 };
  }
  if (/^\d-\d$/.test(normalized)) {
    return { key: "count", title: "카운트별", order: 1 };
  }
  if (["NO OUT", "ONE OUT", "TWO OUTS"].includes(normalized)) {
    return { key: "out", title: "아웃카운트별", order: 2 };
  }
  if (/^\d+(?:ST|ND|RD|TH)\s+INNING$/.test(normalized)) {
    return { key: "inning", title: "이닝별", order: 3 };
  }
  if (
    [
      "BASES EMPTY",
      "RUNNERS ON",
      "ONLY 1ST BASE",
      "ONLY 2ND BASE",
      "ONLY 3RD BASE",
      "1ST AND 2ND",
      "1ST AND 3RD",
      "2ND AND 3RD",
      "BASES LOADED",
    ].includes(normalized)
  ) {
    return { key: "runner", title: "주자 상황별", order: 4 };
  }
  if (/^BATTING\s+#/.test(normalized)) {
    return { key: "batting-order", title: "타순별", order: 5 };
  }
  return { key: "other", title: "기타 상황", order: 6 };
}

function situationSplitSortKey(splitKey: string) {
  const normalized = splitKey.toUpperCase();
  if (normalized.startsWith("VS ")) {
    const order = ["VS LEFTY", "VS RIGHTY", "VS UNDER"];
    return order.indexOf(normalized);
  }
  if (/^\d-\d$/.test(normalized)) {
    const [balls, strikes] = normalized.split("-").map((value) => Number.parseInt(value, 10));
    return strikes * 10 + balls;
  }
  if (["NO OUT", "ONE OUT", "TWO OUTS"].includes(normalized)) {
    const order = ["NO OUT", "ONE OUT", "TWO OUTS"];
    return order.indexOf(normalized);
  }
  const inningMatch = normalized.match(/^(\d+)(?:ST|ND|RD|TH)\s+INNING$/);
  if (inningMatch?.[1]) {
    return Number.parseInt(inningMatch[1], 10);
  }
  if (
    [
      "BASES EMPTY",
      "RUNNERS ON",
      "ONLY 1ST BASE",
      "ONLY 2ND BASE",
      "ONLY 3RD BASE",
      "1ST AND 2ND",
      "1ST AND 3RD",
      "2ND AND 3RD",
      "BASES LOADED",
    ].includes(normalized)
  ) {
    const order = [
      "BASES EMPTY",
      "RUNNERS ON",
      "ONLY 1ST BASE",
      "ONLY 2ND BASE",
      "ONLY 3RD BASE",
      "1ST AND 2ND",
      "1ST AND 3RD",
      "2ND AND 3RD",
      "BASES LOADED",
    ];
    return order.indexOf(normalized);
  }
  const battingSingleMatch = normalized.match(/^BATTING\s+#(\d+)$/);
  if (battingSingleMatch?.[1]) {
    return Number.parseInt(battingSingleMatch[1], 10);
  }
  const battingRangeMatch = normalized.match(/^BATTING\s+#(\d+)-(\d+)$/);
  if (battingRangeMatch?.[1] && battingRangeMatch[2]) {
    return Number.parseInt(battingRangeMatch[1], 10) * 10 + (Number.parseInt(battingRangeMatch[2], 10) - Number.parseInt(battingRangeMatch[1], 10));
  }
  return Number.MAX_SAFE_INTEGER;
}

export function buildSituationSplitGroups(splits: PlayerSplitPageStat[]): PlayerSituationSplitGroup[] {
  const grouped = new Map<string, PlayerSituationSplitGroup & { order: number }>();

  for (const split of splits) {
    const group = classifySituationSplitGroup(split.splitKey);
    const existing = grouped.get(group.key);
    if (existing) {
      existing.splits.push(split);
      continue;
    }

    grouped.set(group.key, {
      key: group.key,
      title: group.title,
      order: group.order,
      splits: [split],
    });
  }

  return Array.from(grouped.values())
    .sort((left, right) => left.order - right.order)
    .map((group) => ({
      key: group.key,
      title: group.title,
      splits: [...group.splits].sort(
        (left, right) =>
          situationSplitSortKey(left.splitKey) - situationSplitSortKey(right.splitKey) ||
          left.splitLabel.localeCompare(right.splitLabel, "ko"),
      ),
    }));
}

function getCurrentMoment(seasonUpdatedAt: string): number {
  return parseDate(seasonUpdatedAt);
}

function createGameMatchupLabel(game: Game, displayById: Record<string, TeamDisplay>): string {
  return `${displayById[game.awaySeasonTeamId]?.shortNameKo ?? game.awaySeasonTeamId} vs ${displayById[game.homeSeasonTeamId]?.shortNameKo ?? game.homeSeasonTeamId}`;
}

function createMatchupPairKey(homeSeasonTeamId: string, awaySeasonTeamId: string): string {
  return [homeSeasonTeamId, awaySeasonTeamId].sort().join(":");
}

function normalizeHeadToHeadShares(probability: {
  homeWinProb: number;
  awayWinProb: number;
  tieProb: number;
}) {
  const denominator = probability.homeWinProb + probability.awayWinProb;

  if (denominator <= Number.EPSILON) {
    return {
      awayShare: 0.5,
      homeShare: 0.5,
      tieProb: probability.tieProb,
    };
  }

  return {
    awayShare: Number((probability.awayWinProb / denominator).toFixed(4)),
    homeShare: Number((probability.homeWinProb / denominator).toFixed(4)),
    tieProb: probability.tieProb,
  };
}

function filterPreviousSeasonStats(
  allSeasons: Awaited<ReturnType<typeof kboRepository.listSeasons>>,
  currentYear: number,
  allSeasonStats: Awaited<ReturnType<typeof kboRepository.getBundle>>["teamSeasonStats"],
) {
  const previous = [...allSeasons]
    .filter((season) => season.year < currentYear)
    .sort((left, right) => right.year - left.year)[0];

  return previous
    ? allSeasonStats.filter((item) => item.seasonId === previous.seasonId)
    : [];
}

export const getAutomationStatusView = cache(async (): Promise<AutomationStatusViewModel | null> => {
  const repository = new FileKboManifestRepository();
  const [rawCurrentManifest, rawSimulationManifest] = await Promise.all([
    repository.getManifest("current"),
    repository.getManifest("simulation"),
  ]);

  if (
    !rawCurrentManifest ||
    !rawSimulationManifest ||
    rawCurrentManifest.manifestType !== "current" ||
    rawSimulationManifest.manifestType !== "simulation"
  ) {
    return null;
  }

  const currentManifest = rawCurrentManifest as CurrentManifest;
  const simulationManifest = rawSimulationManifest as SimulationManifest;

  return {
    currentPublishedAt: currentManifest.publishedAt,
    simulationPublishedAt: simulationManifest.publishedAt,
    hasLiveGames: currentManifest.hasLiveGames,
    allGamesFinal: currentManifest.allGamesFinal,
    simulationFreshness: currentManifest.simulationFreshness,
    staleDatasets: currentManifest.freshnessByDataset.filter((item) => item.stale).map((item) => item.dataset),
    freshnessByDataset: currentManifest.freshnessByDataset.map((item) => ({
      dataset: item.dataset,
      fetchedAt: item.fetchedAt,
      stale: item.stale,
    })),
  };
});

const getLatestHistoricalTeamRecords = cache(async (): Promise<NormalizedHistoricalTeamRecords | null> => {
  const repository = new FileNormalizedKboRepository();
  const keys = await repository.listDatasetKeys("historical-team-records");
  const latestKey = keys.sort().at(-1);
  if (!latestKey) {
    return null;
  }

  return (await repository.getDatasetOutput("historical-team-records", latestKey)) as NormalizedHistoricalTeamRecords | null;
});

function buildArchiveOnlySeason(year: number, bundle: Awaited<ReturnType<typeof kboRepository.getBundle>>): Season {
  const fallbackRuleset =
    [...bundle.rulesets].sort((left, right) => right.regularSeasonGamesPerTeam - left.regularSeasonGamesPerTeam)[0];
  const timestamp = new Date(`${year}-12-31T23:59:59+09:00`).toISOString();
  return {
    seasonId: `archive-${year}`,
    year,
    label: `${year} KBO 리그 아카이브`,
    status: "completed",
    phase: "completed",
    rulesetId: fallbackRuleset?.rulesetId ?? bundle.rulesets[0]?.rulesetId ?? "kbo-archive",
    openingDay: `${year}-03-01`,
    regularSeasonStart: `${year}-03-01`,
    regularSeasonEnd: `${year}-10-31`,
    postseasonStart: null,
    postseasonEnd: null,
    updatedAt: timestamp,
  };
}

function findBrandForHistoricalRow(
  bundle: Awaited<ReturnType<typeof kboRepository.getBundle>>,
  row: NormalizedHistoricalTeamRecords["rows"][number],
) {
  const matchingBrand = bundle.teamBrands.find(
    (brand) =>
      brand.franchiseId === row.franchiseId &&
      brand.seasonStartYear <= row.year &&
      (brand.seasonEndYear === null || brand.seasonEndYear >= row.year),
  );
  if (matchingBrand) {
    return matchingBrand;
  }

  return bundle.teamBrands.find(
    (brand) => brand.franchiseId === row.franchiseId && brand.displayNameKo === row.brandLabel,
  );
}

function buildArchiveOnlyTeamDisplays(
  year: number,
  rows: NormalizedHistoricalTeamRecords["rows"],
  bundle: Awaited<ReturnType<typeof kboRepository.getBundle>>,
): TeamDisplay[] {
  const franchiseById = Object.fromEntries(bundle.franchises.map((franchise) => [franchise.franchiseId, franchise]));
  const fallbackColor = "#334155";
  const fallbackSecondaryColor = "#cbd5e1";

  return rows
    .map((row) => {
      const brand = findBrandForHistoricalRow(bundle, row);
      const franchise = franchiseById[row.franchiseId];
      const syntheticSlug = normalizeTeamSlug(
        row.brandLabel
          .toLowerCase()
          .replace(/[^a-z0-9가-힣]+/g, "-")
          .replace(/^-+|-+$/g, ""),
      );
      const shortName = brand?.shortNameKo ?? row.brandLabel.split(" ")[0] ?? row.brandLabel;

      return {
        seasonTeamId: `archive-${year}:${row.franchiseId}`,
        brandId: brand?.brandId ?? `archive-brand:${row.franchiseId}`,
        franchiseId: row.franchiseId,
        teamSlug: franchise ? normalizeTeamSlug(franchise.slug) : syntheticSlug,
        displayNameKo: brand?.displayNameKo ?? row.brandLabel,
        shortNameKo: shortName,
        shortCode: brand?.shortCode ?? shortName.slice(0, 3).toUpperCase(),
        primaryColor: brand?.primaryColor ?? fallbackColor,
        secondaryColor: brand?.secondaryColor ?? fallbackSecondaryColor,
      } satisfies TeamDisplay;
    })
    .filter((item, index, collection) => collection.findIndex((candidate) => candidate.seasonTeamId === item.seasonTeamId) === index);
}

export type ArchiveSeasonPageData = {
  season: Season;
  players: Player[];
  playerSeasonStats: PlayerSeasonStat[];
  teamSeasonStats: TeamSeasonStat[];
  games: Game[];
  standingsRows: StandingRow[];
  displayById: Record<string, TeamDisplay>;
  awards: Award[];
  historicalArchiveRows: NormalizedHistoricalTeamRecords["rows"];
  archiveNarrative: string[];
  hasCompleteHistoricalArchiveStandings: boolean;
  hasCompleteArchiveGameCoverage: boolean;
  hasCompleteArchivePlayerCoverage: boolean;
};

export const getSeasonDashboardData = cache(async (year: number) => {
  const [seasonContext, bundle, seasons, automationStatus, historicalTeamRecords] = await Promise.all([
    kboRepository.getSeasonContext(year),
    kboRepository.getBundle(),
    kboRepository.listSeasons(),
    getAutomationStatusView(),
    getLatestHistoricalTeamRecords(),
  ]);
  if (!seasonContext) {
    return null;
  }

  const previousSeasonStats = filterPreviousSeasonStats(seasons, year, bundle.teamSeasonStats);
  const baselineInput = buildSimulationInput(seasonContext, previousSeasonStats);
  const simulation = simulateSeason(baselineInput, 600);
  const standings = buildStandingsTable({
    games: seasonContext.games,
    teamSeasonStats: seasonContext.teamSeasonStats,
    teamDisplays: seasonContext.teamDisplays.map((item) => ({
      ...item,
      rank: 0,
      games: 0,
      wins: 0,
      losses: 0,
      ties: 0,
      pct: 0,
      gamesBack: 0,
      recent10: "-",
      streak: "-",
      home: "-",
      away: "-",
      runsScored: 0,
      runsAllowed: 0,
      offensePlus: 100,
      pitchingPlus: 100,
    })),
    bucketOdds: simulation.bucketOdds,
    postseasonOdds: simulation.postseasonOdds,
    ruleset: seasonContext.ruleset,
  });
  const displayById = teamDisplayMap(seasonContext.teamDisplays);
  const currentMoment = getCurrentMoment(seasonContext.season.updatedAt);
  const bucketById = Object.fromEntries(simulation.bucketOdds.map((item) => [item.seasonTeamId, item]));
  const expectedById = Object.fromEntries(
    simulation.expectedRecords.map((item) => [item.seasonTeamId, item]),
  );
  const teamStrengthById = Object.fromEntries(
    simulation.teamStrengths.map((item) => [item.seasonTeamId, item]),
  );
  const rankDistById = Object.fromEntries(
    simulation.rankDistributions.map((item) => [item.seasonTeamId, item]),
  );
  const historicalArchiveRows = historicalTeamRecords ? getHistoricalRowsForYear(historicalTeamRecords.rows, year) : [];
  const hasCompleteHistoricalArchiveStandings = hasCompleteHistoricalStandings(
    historicalArchiveRows,
    seasonContext.teamDisplays.length,
  );
  const archiveStandingsRows = hasCompleteHistoricalArchiveStandings
    ? buildArchiveStandingsRows(historicalArchiveRows, seasonContext.teamDisplays)
    : null;
  const expectedHistoricalGameCount = inferHistoricalGameCount(historicalArchiveRows);
  const completedGameCount = seasonContext.games.filter((game) => game.status === "final").length;
  const hasCompleteArchiveGameCoverage =
    seasonContext.season.status !== "completed" ||
    (expectedHistoricalGameCount > 0 && completedGameCount >= expectedHistoricalGameCount);
  const hasCompleteArchivePlayerCoverage =
    seasonContext.season.status !== "completed" ||
    seasonContext.playerSeasonStats.length >= seasonContext.teamDisplays.length * 10;
  const closeGameWindowEnd = currentMoment + 14 * 86400000;
  const probabilityByGameId = Object.fromEntries(
    simulation.gameProbabilities.map((item) => [item.gameId, item]),
  );
  const seenMatchupKeys = new Set<string>();
  const closeGames = seasonContext.games
    .filter((game) => {
      const scheduledAt = parseDate(game.scheduledAt);
      return (
        game.status !== "final" &&
        game.status !== "postponed" &&
        scheduledAt >= currentMoment &&
        scheduledAt <= closeGameWindowEnd
      );
    })
    .map((game) => {
      const probability = probabilityByGameId[game.gameId];
      if (!probability) {
        return null;
      }

      const { awayShare, homeShare, tieProb } = normalizeHeadToHeadShares(probability);
      return {
        gameId: game.gameId,
        scheduledAt: game.scheduledAt,
        awaySeasonTeamId: game.awaySeasonTeamId,
        homeSeasonTeamId: game.homeSeasonTeamId,
        label: createGameMatchupLabel(game, displayById),
        awayShare,
        homeShare,
        tieProb,
        probabilityGap: Number(Math.abs(awayShare - homeShare).toFixed(4)),
      };
    })
    .filter((item) => item !== null)
    .sort(
      (left, right) =>
        left.probabilityGap - right.probabilityGap ||
        left.scheduledAt.localeCompare(right.scheduledAt),
    )
    .filter((item) => {
      const matchupKey = createMatchupPairKey(item.homeSeasonTeamId, item.awaySeasonTeamId);
      if (seenMatchupKeys.has(matchupKey)) {
        return false;
      }
      seenMatchupKeys.add(matchupKey);
      return true;
    })
    .slice(0, 3);
  const finalGamesYesterday = seasonContext.games
    .filter((game) => game.status === "final")
    .sort((left, right) => right.scheduledAt.localeCompare(left.scheduledAt))
    .slice(0, 5);
  const standingsById = Object.fromEntries(
    standings.rows.map((row) => [row.seasonTeamId, row]),
  );
  const recentOutcomeMap = buildRecentOutcomeMap(seasonContext.games);
  const shortTermVolatilityById = Object.fromEntries(
    (simulation.shortTermRankVolatility ?? []).map((item) => [item.seasonTeamId, item]),
  );
  const shakeupTeams =
    simulation.shortTermRankVolatility && simulation.shortTermRankVolatility.length > 0
      ? standings.rows
          .map((row) => {
            const volatility = shortTermVolatilityById[row.seasonTeamId];
            if (!volatility) {
              return null;
            }

            return {
              seasonTeamId: row.seasonTeamId,
              currentRank: row.rank,
              averageRank: volatility.averageRank,
              avgAbsMove: volatility.avgAbsMove,
              moveProb: volatility.moveProb,
              bigMoveProb: volatility.bigMoveProb,
              riseProb: volatility.riseProb,
              fallProb: volatility.fallProb,
            };
          })
          .filter((item) => item !== null)
          .sort(
            (left, right) =>
              right.moveProb - left.moveProb ||
              right.bigMoveProb - left.bigMoveProb ||
              right.avgAbsMove - left.avgAbsMove,
          )
          .slice(0, 3)
      : [...simulation.teamStrengths]
          .sort(
            (left, right) =>
              Math.abs(right.recentFormAdjustment) + Math.abs(right.scheduleDifficulty) -
              (Math.abs(left.recentFormAdjustment) + Math.abs(left.scheduleDifficulty)),
          )
          .slice(0, 3)
          .map((item) => ({
            seasonTeamId: item.seasonTeamId,
            currentRank: standingsById[item.seasonTeamId]?.rank ?? 0,
            averageRank: standingsById[item.seasonTeamId]?.rank ?? 0,
            avgAbsMove: 0,
            moveProb: 0,
            bigMoveProb: 0,
            riseProb: 0,
            fallProb: 0,
          }));
  const buildTodayChangeCard = (
    item: TeamStrengthSnapshot,
    trend: "positive" | "negative",
  ) => {
    const standingRow = standingsById[item.seasonTeamId];
    return {
      seasonTeamId: item.seasonTeamId,
      trend,
      recentOutcomes: recentOutcomeMap[item.seasonTeamId] ?? [],
      recent10Label: standingRow?.recent10 ?? "-",
      streakLabel: formatDashboardStreak(standingRow?.streak ?? "-"),
    };
  };
  const todayChangeCards = {
    positive: simulation.teamStrengths
      .slice()
      .sort((left, right) => right.recentFormAdjustment - left.recentFormAdjustment)
      .slice(0, 2)
      .map((item) => buildTodayChangeCard(item, "positive")),
    negative: simulation.teamStrengths
      .slice()
      .sort((left, right) => left.recentFormAdjustment - right.recentFormAdjustment)
      .slice(0, 2)
      .map((item) => buildTodayChangeCard(item, "negative")),
  };

  return {
    ...seasonContext,
    awards: bundle.awards.filter((item) => item.seasonId === seasonContext.season.seasonId),
    standings,
    archiveStandingsRows,
    simulation,
    baselineInput,
    displayById,
    closeGames,
    finalGamesYesterday,
    bucketById,
    expectedById,
    teamStrengthById,
    rankDistById,
    shakeupTeams,
    todayChangeCards,
    automationStatus,
    historicalArchiveRows,
    hasCompleteHistoricalArchiveStandings,
    hasCompleteArchiveGameCoverage,
    hasCompleteArchivePlayerCoverage,
    archiveHeadline: buildArchiveHeadline(year, historicalArchiveRows),
    archiveNarrative: buildArchiveNarrative(year, historicalArchiveRows),
    archiveCoverageLabel: summarizeHistoricalCoverage(historicalArchiveRows),
    hasOfficialPlayerStats: bundle.playerSeasonStats.length > 0,
    hasOfficialAdvancedTeamMetrics: !kboSourceFeatureFlags.officialKboOnly || bundle.playerSeasonStats.length > 0,
  };
});

export const getArchiveSeasonPageData = cache(async (year: number): Promise<ArchiveSeasonPageData | null> => {
  const [seasonDashboardData, bundle, historicalTeamRecords] = await Promise.all([
    getSeasonDashboardData(year),
    kboRepository.getBundle(),
    getLatestHistoricalTeamRecords(),
  ]);

  if (seasonDashboardData?.season.status === "completed") {
    return {
      season: seasonDashboardData.season,
      players: seasonDashboardData.players,
      playerSeasonStats: seasonDashboardData.playerSeasonStats,
      teamSeasonStats: seasonDashboardData.teamSeasonStats,
      games: seasonDashboardData.games,
      standingsRows: seasonDashboardData.archiveStandingsRows ?? seasonDashboardData.standings.rows,
      displayById: seasonDashboardData.displayById,
      awards: seasonDashboardData.awards,
      historicalArchiveRows: seasonDashboardData.historicalArchiveRows,
      archiveNarrative: seasonDashboardData.archiveNarrative,
      hasCompleteHistoricalArchiveStandings: seasonDashboardData.hasCompleteHistoricalArchiveStandings,
      hasCompleteArchiveGameCoverage: seasonDashboardData.hasCompleteArchiveGameCoverage,
      hasCompleteArchivePlayerCoverage: seasonDashboardData.hasCompleteArchivePlayerCoverage,
    };
  }

  const historicalArchiveRows = historicalTeamRecords ? getHistoricalRowsForYear(historicalTeamRecords.rows, year) : [];
  if (!historicalArchiveRows.length) {
    return null;
  }

  const teamDisplays = buildArchiveOnlyTeamDisplays(year, historicalArchiveRows, bundle);
  const displayById = Object.fromEntries(teamDisplays.map((item) => [item.seasonTeamId, item]));

  return {
    season: buildArchiveOnlySeason(year, bundle),
    players: [],
    playerSeasonStats: [],
    teamSeasonStats: [],
    games: [],
    standingsRows: buildArchiveStandingsRows(historicalArchiveRows, teamDisplays),
    displayById,
    awards: [],
    historicalArchiveRows,
    archiveNarrative: buildArchiveNarrative(year, historicalArchiveRows),
    hasCompleteHistoricalArchiveStandings: hasCompleteHistoricalStandings(historicalArchiveRows, teamDisplays.length),
    hasCompleteArchiveGameCoverage: false,
    hasCompleteArchivePlayerCoverage: false,
  };
});

export const getArchiveHubData = cache(async () => {
  const [seasons, bundle, historicalTeamRecords] = await Promise.all([
    kboRepository.listArchiveSeasons(),
    kboRepository.getBundle(),
    getLatestHistoricalTeamRecords(),
  ]);
  const seasonTeamById = Object.fromEntries(bundle.seasonTeams.map((item) => [item.seasonTeamId, item]));
  const brandById = Object.fromEntries(bundle.teamBrands.map((item) => [item.brandId, item]));
  const bundleSeasonByYear = Object.fromEntries(bundle.seasons.map((season) => [season.year, season]));
  const seasonsByYear = new Map<number, Season>(seasons.map((season) => [season.year, season]));
  const archiveYears = new Set(seasons.map((season) => season.year));
  for (const row of historicalTeamRecords?.rows ?? []) {
    if (bundleSeasonByYear[row.year]?.status === "ongoing") {
      continue;
    }
    archiveYears.add(row.year);
  }

  return [...archiveYears]
    .sort((left, right) => right - left)
    .map((year) => seasonsByYear.get(year) ?? buildArchiveOnlySeason(year, bundle))
    .map((season) => ({
    historicalRows: historicalTeamRecords ? getHistoricalRowsForYear(historicalTeamRecords.rows, season.year) : [],
    season,
    summary: bundle.seasonSummaries.find((item) => item.seasonId === season.seasonId) ?? null,
    headline: buildArchiveHeadline(
      season.year,
      historicalTeamRecords ? getHistoricalRowsForYear(historicalTeamRecords.rows, season.year) : [],
    ),
    narrative: buildArchiveNarrative(
      season.year,
      historicalTeamRecords ? getHistoricalRowsForYear(historicalTeamRecords.rows, season.year) : [],
    ),
    championLabel:
      (historicalTeamRecords
        ? getHistoricalRowsForYear(historicalTeamRecords.rows, season.year).find((item) => (item.postseasonResult ?? "").includes("우승"))?.brandLabel
        : null) ??
      brandById[
        seasonTeamById[
          bundle.seasonSummaries.find((item) => item.seasonId === season.seasonId)?.championSeasonTeamId ?? ""
        ]?.brandId ?? ""
      ]?.displayNameKo ??
      null,
    regularSeasonWinnerLabel:
      (historicalTeamRecords
        ? getHistoricalRowsForYear(historicalTeamRecords.rows, season.year)[0]?.brandLabel
        : null) ??
      brandById[
        seasonTeamById[
          bundle.seasonSummaries.find((item) => item.seasonId === season.seasonId)?.regularSeasonWinnerSeasonTeamId ?? ""
        ]?.brandId ?? ""
      ]?.displayNameKo ??
      null,
    historicalCoverageLabel: summarizeHistoricalCoverage(
      historicalTeamRecords ? getHistoricalRowsForYear(historicalTeamRecords.rows, season.year) : [],
    ),
  }));
});

export const getFranchiseArchiveData = cache(async (teamSlug: string) => {
  const [franchiseContext, bundle, historicalTeamRecords] = await Promise.all([
    kboRepository.getFranchiseBySlug(teamSlug),
    kboRepository.getBundle(),
    getLatestHistoricalTeamRecords(),
  ]);
  if (!franchiseContext) {
    return null;
  }

  const brandById = Object.fromEntries(bundle.teamBrands.map((item) => [item.brandId, item]));
  const officialHistoricalRows = historicalTeamRecords
    ? getHistoricalRowsForFranchise(historicalTeamRecords.rows, franchiseContext.franchise.franchiseId)
    : [];
  return {
    ...franchiseContext,
    seasons: franchiseContext.seasons.map((seasonRow) => ({
      ...seasonRow,
      brandLabel: brandById[seasonRow.brandId]?.displayNameKo ?? seasonRow.brandId,
    })),
    officialHistoricalRows,
    historicalCoverageLabel: summarizeHistoricalCoverage(officialHistoricalRows),
  };
});

export const getGamePageData = cache(async (gameId: string) => {
  const [gameContext, bundle] = await Promise.all([
    kboRepository.getGameContext(gameId),
    kboRepository.getBundle(),
  ]);
  if (!gameContext) {
    return null;
  }

  const teamDisplays = bundle.seasonTeams.map((seasonTeam) => {
    const brand = bundle.teamBrands.find((item) => item.brandId === seasonTeam.brandId)!;
    const franchise = bundle.franchises.find((item) => item.franchiseId === seasonTeam.franchiseId)!;
    return {
      seasonTeamId: seasonTeam.seasonTeamId,
      label: brand.displayNameKo,
      teamSlug: normalizeTeamSlug(franchise.slug),
    };
  });
  const displayById = Object.fromEntries(teamDisplays.map((item) => [item.seasonTeamId, item]));
  const season = bundle.seasons.find((item) => item.seasonId === gameContext.game.seasonId) ?? null;
  const playerById = Object.fromEntries(bundle.players.map((item) => [item.playerId, item]));
  const seasonContext =
    season ? await kboRepository.getSeasonContext(season.year) : null;
  const seasonStandings = seasonContext
    ? buildStandingsTable({
        games: seasonContext.games,
        teamSeasonStats: seasonContext.teamSeasonStats,
        teamDisplays: seasonContext.teamDisplays.map((item) => ({
          ...item,
          rank: 0,
          games: 0,
          wins: 0,
          losses: 0,
          ties: 0,
          pct: 0,
          gamesBack: 0,
          recent10: "-",
          streak: "-",
          home: "-",
          away: "-",
          runsScored: 0,
          runsAllowed: 0,
          offensePlus: 100,
          pitchingPlus: 100,
        })),
        bucketOdds: [],
        postseasonOdds: [],
        ruleset: seasonContext.ruleset,
      })
    : null;
  const seriesGames = seasonContext
    ? seasonContext.games
        .filter((item) => item.seriesId === gameContext.game.seriesId)
        .sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt))
    : [gameContext.game];
  const gameMoment = new Date(gameContext.game.scheduledAt).getTime();
  const teamIds = new Set([
    gameContext.game.homeSeasonTeamId,
    gameContext.game.awaySeasonTeamId,
  ]);
  const recentContextGames = seasonContext
    ? seasonContext.games
        .filter(
          (item) =>
            item.gameId !== gameContext.game.gameId &&
            (teamIds.has(item.homeSeasonTeamId) || teamIds.has(item.awaySeasonTeamId)) &&
            new Date(item.scheduledAt).getTime() <= gameMoment,
        )
        .sort((left, right) => right.scheduledAt.localeCompare(left.scheduledAt))
        .slice(0, 6)
    : [];
  const nextContextGames = seasonContext
    ? seasonContext.games
        .filter(
          (item) =>
            item.gameId !== gameContext.game.gameId &&
            (teamIds.has(item.homeSeasonTeamId) || teamIds.has(item.awaySeasonTeamId)) &&
            new Date(item.scheduledAt).getTime() > gameMoment,
        )
        .sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt))
        .slice(0, 4)
    : [];
  return {
    ...gameContext,
    season,
    displayById,
    playerById,
    seasonStandings,
    seriesGames,
    recentContextGames,
    nextContextGames,
  };
});

export const getPlayerPageData = cache(async (playerId: string) => {
  const [playerContext, bundle] = await Promise.all([
    kboRepository.getPlayerContext(playerId),
    kboRepository.getBundle(),
  ]);
  if (!playerContext) {
    return null;
  }

  const seasonById = Object.fromEntries(bundle.seasons.map((item) => [item.seasonId, item]));
  const seasonTeamById = Object.fromEntries(bundle.seasonTeams.map((item) => [item.seasonTeamId, item]));
  const brandById = Object.fromEntries(bundle.teamBrands.map((item) => [item.brandId, item]));
  const franchiseById = Object.fromEntries(bundle.franchises.map((item) => [item.franchiseId, item]));
  const gameById = Object.fromEntries(bundle.games.map((item) => [item.gameId, item]));
  const playerGameLogs = playerContext.gameStats
    .map((gameStat) => {
      const game = gameById[gameStat.gameId];
      if (!game) {
        return null;
      }

      const seasonTeam = seasonTeamById[gameStat.seasonTeamId];
      const isHome = game.homeSeasonTeamId === gameStat.seasonTeamId;
      const opponentId = isHome ? game.awaySeasonTeamId : game.homeSeasonTeamId;
      const opponentLabel = brandById[seasonTeamById[opponentId]?.brandId]?.displayNameKo ?? opponentId;
      return {
        ...gameStat,
        game,
        opponentLabel,
        seasonLabel: seasonById[gameStat.seasonId]?.label ?? gameStat.seasonId,
        teamLabel: brandById[seasonTeam?.brandId]?.displayNameKo ?? gameStat.seasonTeamId,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((left, right) => right.game.scheduledAt.localeCompare(left.game.scheduledAt));
  const careerSummarySource = playerContext.careerStats.length > 0 ? playerContext.careerStats : playerContext.seasonStats;
  const careerSummary = careerSummarySource.reduce(
    (accumulator, stat) => {
      accumulator.seasons += 1;
      accumulator.totalWar += "war" in stat ? stat.war ?? 0 : 0;
      accumulator.hitterGames += stat.statType === "hitter" ? stat.games : 0;
      accumulator.pitcherGames += stat.statType === "pitcher" ? stat.games : 0;
      accumulator.hits += stat.hits ?? 0;
      accumulator.homeRuns += stat.homeRuns ?? 0;
      accumulator.rbi += stat.rbi ?? 0;
      accumulator.strikeouts += stat.strikeouts ?? 0;
      accumulator.wins += stat.wins ?? 0;
      accumulator.saves += stat.saves ?? 0;
      accumulator.holds += stat.holds ?? 0;
      return accumulator;
    },
    {
      seasons: 0,
      totalWar: 0,
      hitterGames: 0,
      pitcherGames: 0,
      hits: 0,
      homeRuns: 0,
      rbi: 0,
      strikeouts: 0,
      wins: 0,
      saves: 0,
      holds: 0,
    },
  );
  const seasonStatRows = playerContext.seasonStats
    .map((stat) => {
      const seasonTeam = seasonTeamById[stat.seasonTeamId];
      const brand = brandById[seasonTeam?.brandId];
      return {
        ...stat,
        seasonLabel: seasonById[stat.seasonId]?.label ?? stat.seasonId,
        seasonYear: seasonById[stat.seasonId]?.year ?? 0,
        teamLabel: brand?.displayNameKo ?? stat.seasonTeamId,
        teamCode: brand?.shortCode ?? null,
      };
    })
    .sort((left, right) => right.seasonYear - left.seasonYear);
  const seasonStatByHistoryKey = new Map(
    seasonStatRows.map((stat) => [`${stat.statType}:${stat.seasonYear}:${stat.teamCode ?? stat.teamLabel}`, stat] as const),
  );
  const historyRowsFromCareer = playerContext.careerStats.map((stat) => {
    const overlay = seasonStatByHistoryKey.get(`${stat.statType}:${stat.year}:${stat.teamLabel}`);
    return {
      statId: stat.playerCareerStatId,
      statType: stat.statType,
      seasonLabel: String(stat.year),
      seasonYear: stat.year,
      teamLabel: overlay?.teamLabel ?? stat.teamLabel,
      teamCode: stat.teamLabel,
      games: overlay?.games ?? stat.games,
      battingAverage: overlay?.battingAverage ?? stat.battingAverage,
      hits: overlay?.hits ?? stat.hits,
      homeRuns: overlay?.homeRuns ?? stat.homeRuns,
      rbi: overlay?.rbi ?? stat.rbi,
      ops: overlay?.ops ?? stat.ops,
      era: overlay?.era ?? stat.era,
      inningsPitched: overlay?.inningsPitched ?? stat.inningsPitched,
      strikeouts: overlay?.strikeouts ?? stat.strikeouts,
      wins: overlay?.wins ?? stat.wins,
      losses: overlay?.losses ?? stat.losses,
      saves: overlay?.saves ?? stat.saves,
      holds: overlay?.holds ?? stat.holds,
      whip: overlay?.whip ?? stat.whip,
    } satisfies PlayerSeasonPageStat;
  });
  const historyRows =
    historyRowsFromCareer.length > 0
      ? historyRowsFromCareer
      : seasonStatRows.map((stat) => ({
          statId: stat.statId,
          statType: stat.statType,
          seasonLabel: stat.seasonLabel,
          seasonYear: stat.seasonYear,
          teamLabel: stat.teamLabel,
          teamCode: stat.teamCode,
          games: stat.games,
          battingAverage: stat.battingAverage,
          hits: stat.hits,
          homeRuns: stat.homeRuns,
          rbi: stat.rbi,
          ops: stat.ops,
          era: stat.era,
          inningsPitched: stat.inningsPitched,
          strikeouts: stat.strikeouts,
          wins: stat.wins,
          losses: stat.losses,
          saves: stat.saves,
          holds: stat.holds,
          whip: stat.whip,
        } satisfies PlayerSeasonPageStat));
  const sortedStatsBySeason: PlayerSeasonPageStat[] = historyRows.sort((left, right) => right.seasonYear - left.seasonYear);
  const currentSeasonFocus: (typeof seasonStatRows[number] & { rankingMetrics: PlayerRankingMetric[] }) | null = seasonStatRows[0]
    ? {
        ...seasonStatRows[0],
        rankingMetrics: buildPlayerSeasonRankingContext(seasonStatRows[0], bundle.playerSeasonStats),
      }
    : null;
  const monthlySplits = playerContext.splitStats
    .filter((item) => item.splitType === "month")
    .filter((item) => (currentSeasonFocus ? item.seasonId === currentSeasonFocus.seasonId : true))
    .sort((left, right) => monthOrderKey(left.splitKey) - monthOrderKey(right.splitKey))
    .map((split) => ({
      ...split,
      teamLabel: brandById[seasonTeamById[split.seasonTeamId]?.brandId]?.displayNameKo ?? split.seasonTeamId,
    }));
  const situationSplits = playerContext.splitStats
    .filter((item) => item.splitType === "situation")
    .filter((item) => (currentSeasonFocus ? item.seasonId === currentSeasonFocus.seasonId : true))
    .map((split) => ({
      ...split,
      teamLabel: brandById[seasonTeamById[split.seasonTeamId]?.brandId]?.displayNameKo ?? split.seasonTeamId,
    }));
  const situationSplitGroups = buildSituationSplitGroups(situationSplits);
  const awardHistory = buildPlayerAwardHistory({
    player: playerContext.player,
    awards: bundle.awards,
    seasons: bundle.seasons,
    seasonTeams: bundle.seasonTeams,
    teamBrands: bundle.teamBrands,
    franchises: bundle.franchises,
    seasonStats: playerContext.seasonStats,
    careerStats: playerContext.careerStats,
  });
  return {
    ...playerContext,
    statsBySeason: sortedStatsBySeason,
    currentSeasonFocus,
    franchiseLabels: playerContext.player.franchiseIds.map(
      (franchiseId) => franchiseById[franchiseId]?.canonicalNameKo ?? franchiseId,
    ),
    careerSummary,
    rosterEvents: bundle.rosterEvents
      .filter((item) => item.playerId === playerId)
      .sort((left, right) => right.date.localeCompare(left.date)),
    gameLogs: playerGameLogs,
    monthlySplits,
    situationSplits,
    situationSplitGroups,
    awardHistory,
  };
});

export function findSeasonTeamBySlug(
  teamSlug: string,
  seasonTeams: SeasonTeam[],
  displays: TeamDisplay[],
): { seasonTeam: SeasonTeam; display: TeamDisplay } | null {
  const display = displays.find((item) => item.teamSlug === teamSlug);
  if (!display) {
    return null;
  }

  const seasonTeam = seasonTeams.find((item) => item.seasonTeamId === display.seasonTeamId);
  if (!seasonTeam) {
    return null;
  }

  return {
    seasonTeam,
    display,
  };
}

export function findTeamStrength(
  teamStrengths: TeamStrengthSnapshot[],
  seasonTeamId: string,
): TeamStrengthSnapshot | null {
  return teamStrengths.find((item) => item.seasonTeamId === seasonTeamId) ?? null;
}

export function buildRemainingSchedule(
  seasonTeamId: string,
  series: Series[],
  games: Game[],
  displayById: Record<string, TeamDisplay>,
) {
  return series
    .filter(
      (item) =>
        item.homeSeasonTeamId === seasonTeamId || item.awaySeasonTeamId === seasonTeamId,
    )
    .map((seriesItem) => {
      const remainingGames = games.filter(
        (game) => game.seriesId === seriesItem.seriesId && game.status !== "final",
      ).length;
      return {
        series: seriesItem,
        opponent:
          seriesItem.homeSeasonTeamId === seasonTeamId
            ? displayById[seriesItem.awaySeasonTeamId]
            : displayById[seriesItem.homeSeasonTeamId],
        isHome: seriesItem.homeSeasonTeamId === seasonTeamId,
        remainingGames,
      };
    })
    .filter((item) => item.remainingGames > 0)
    .sort((left, right) => left.series.startDate.localeCompare(right.series.startDate));
}

export function buildRemainingOpponentCounts(
  seasonTeamId: string,
  games: Game[],
  displayById: Record<string, TeamDisplay>,
  options?: {
    regularSeasonGamesPerTeam?: number;
    seasonTeamIds?: string[];
  },
) {
  const counts: Record<string, { label: string; remaining: number; completed: number; scheduledRemaining: number }> = {};
  for (const game of games) {
    if (game.homeSeasonTeamId !== seasonTeamId && game.awaySeasonTeamId !== seasonTeamId) {
      continue;
    }

    const opponentId =
      game.homeSeasonTeamId === seasonTeamId ? game.awaySeasonTeamId : game.homeSeasonTeamId;
    counts[opponentId] ??= {
      label: displayById[opponentId]?.shortNameKo ?? opponentId,
      remaining: 0,
      completed: 0,
      scheduledRemaining: 0,
    };

    if (game.status === "final") {
      counts[opponentId].completed += 1;
      continue;
    }

    counts[opponentId].scheduledRemaining += 1;
  }

  const seasonTeamIds = [...new Set(options?.seasonTeamIds ?? [])].filter((item) => item !== seasonTeamId);
  for (const opponentId of seasonTeamIds) {
    counts[opponentId] ??= {
      label: displayById[opponentId]?.shortNameKo ?? opponentId,
      remaining: 0,
      completed: 0,
      scheduledRemaining: 0,
    };
  }

  const inferredMatchupGames =
    options?.regularSeasonGamesPerTeam &&
    seasonTeamIds.length > 0 &&
    options.regularSeasonGamesPerTeam % seasonTeamIds.length === 0
      ? options.regularSeasonGamesPerTeam / seasonTeamIds.length
      : null;

  return Object.entries(counts)
    .map(([opponentId, value]) => ({
      seasonTeamId: opponentId,
      label: value.label,
      remaining:
        inferredMatchupGames !== null
          ? Math.max(value.scheduledRemaining, Math.max(0, inferredMatchupGames - value.completed))
          : value.scheduledRemaining,
    }))
    .sort((left, right) => right.remaining - left.remaining || left.label.localeCompare(right.label));
}

export function buildTeamSplitSummary(
  seasonTeamId: string,
  teamSplitStats: TeamSplitStat[],
) {
  const order = ["home", "away", "oneRun", "extraInnings", "vsLeft", "vsRight"] as const;
  return teamSplitStats
    .filter((item) => item.seasonTeamId === seasonTeamId)
    .sort(
      (left, right) =>
        order.indexOf(left.splitType) - order.indexOf(right.splitType) ||
        left.metricLabel.localeCompare(right.metricLabel),
    );
}

function summarizeRaceLeverage(
  targetRow: StandingRow,
  opponentRow: StandingRow,
  remainingGames: number,
  targetBucket: { first: number; fifth: number; missPostseason: number } | undefined,
  opponentBucket: { first: number; fifth: number; missPostseason: number } | undefined,
  targetStrength: TeamStrengthSnapshot | undefined,
  opponentStrength: TeamStrengthSnapshot | undefined,
): string {
  const rankGap = Math.abs(targetRow.rank - opponentRow.rank);
  const gbGap = Math.abs(targetRow.gamesBack - opponentRow.gamesBack);
  const combinedBubble =
    (targetBucket?.fifth ?? 0) +
    (targetBucket?.missPostseason ?? 0) +
    (opponentBucket?.fifth ?? 0) +
    (opponentBucket?.missPostseason ?? 0);
  const combinedTop =
    (targetBucket?.first ?? 0) + (opponentBucket?.first ?? 0);
  const leverageGap = Math.abs(
    (targetStrength?.headToHeadLeverage ?? 0) - (opponentStrength?.headToHeadLeverage ?? 0),
  );

  if (combinedTop >= 0.22 && rankGap <= 2) {
    return "상위권 압축 구간이라 이 맞대결이 1위선 레버리지를 직접 키웁니다.";
  }

  if (combinedBubble >= 0.45 && gbGap <= 2.5) {
    return "5위선과 탈락선 사이가 붙어 있어 이 맞대결이 가을야구 확률을 크게 흔듭니다.";
  }

  if (remainingGames >= 4) {
    return "남은 맞대결 수가 많아서 시나리오 입력 한 번의 파급력이 큽니다.";
  }

  if (leverageGap >= 0.08) {
    return "현재 전력 해석상 head-to-head leverage 차이가 있어 직접 맞대결 체감이 큽니다.";
  }

  return "남은 경기 수는 많지 않지만 순위 간격이 촘촘해 한 시리즈만으로도 분위기가 바뀔 수 있습니다.";
}

export function buildDirectRaceOpponents(
  seasonTeamId: string,
  standingsRows: StandingRow[],
  opponentCounts: { seasonTeamId: string; label: string; remaining: number }[],
  bucketById: Record<string, { first: number; fifth: number; missPostseason: number }>,
  teamStrengthById: Record<string, TeamStrengthSnapshot>,
) {
  const targetRow = standingsRows.find((item) => item.seasonTeamId === seasonTeamId);
  if (!targetRow) {
    return [];
  }

  return opponentCounts
    .map((item) => {
      const opponentRow = standingsRows.find((row) => row.seasonTeamId === item.seasonTeamId);
      if (!opponentRow) {
        return null;
      }

      const psOdds = 1 - (bucketById[item.seasonTeamId]?.missPostseason ?? 1);
      return {
        ...item,
        rank: opponentRow.rank,
        gamesBackGap: opponentRow.gamesBack - targetRow.gamesBack,
        firstOdds: bucketById[item.seasonTeamId]?.first ?? 0,
        psOdds,
        leverageNote: summarizeRaceLeverage(
          targetRow,
          opponentRow,
          item.remaining,
          bucketById[seasonTeamId],
          bucketById[item.seasonTeamId],
          teamStrengthById[seasonTeamId],
          teamStrengthById[item.seasonTeamId],
        ),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((left, right) => {
      const leftRankGap = Math.abs(left.rank - targetRow.rank);
      const rightRankGap = Math.abs(right.rank - targetRow.rank);
      return leftRankGap - rightRankGap || right.remaining - left.remaining;
    })
    .slice(0, 5);
}
