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
  Game,
  Player,
  PlayerSeasonStat,
  ScenarioOverride,
  Season,
  SeasonTeam,
  Series,
  StandingRow,
  SimulationInput,
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
};

type PlayerSituationSplitGroup = {
  key: string;
  title: string;
  splits: PlayerSplitPageStat[];
};

type PlayerSeasonPageStat = PlayerSeasonStat & {
  seasonLabel: string;
  seasonYear: number;
  teamLabel: string;
};

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

function createSeriesLabel(series: Series, displayById: Record<string, TeamDisplay>): string {
  return `${displayById[series.awaySeasonTeamId]?.shortNameKo ?? series.awaySeasonTeamId} @ ${displayById[series.homeSeasonTeamId]?.shortNameKo ?? series.homeSeasonTeamId}`;
}

function summarizeSeriesReason(
  homeSeasonTeamId: string,
  awaySeasonTeamId: string,
  bucketById: Record<string, { first: number; fifth: number; missPostseason: number }>,
  teamStrengthById: Record<string, TeamStrengthSnapshot>,
  displayById: Record<string, TeamDisplay>,
): string {
  const homeBucket = bucketById[homeSeasonTeamId];
  const awayBucket = bucketById[awaySeasonTeamId];
  const homeStrength = teamStrengthById[homeSeasonTeamId];
  const awayStrength = teamStrengthById[awaySeasonTeamId];
  const firstRace =
    (homeBucket?.first ?? 0) + (awayBucket?.first ?? 0) >= 0.18;
  const bubbleRace =
    (homeBucket?.fifth ?? 0) + (awayBucket?.fifth ?? 0) + (homeBucket?.missPostseason ?? 0) + (awayBucket?.missPostseason ?? 0) >=
    0.45;

  if (firstRace) {
    return `${displayById[homeSeasonTeamId].shortNameKo}와 ${displayById[awaySeasonTeamId].shortNameKo} 모두 상위권 압축 구간에 있어 1위 레이스 레버리지가 큽니다.`;
  }

  if (bubbleRace) {
    return `${displayById[homeSeasonTeamId].shortNameKo}와 ${displayById[awaySeasonTeamId].shortNameKo}의 맞대결은 5위선과 탈락선 사이를 직접 흔드는 시리즈입니다.`;
  }

  return `잔여 일정 난이도는 홈 ${homeStrength?.scheduleDifficulty.toFixed(2) ?? "0.00"}, 원정 ${awayStrength?.scheduleDifficulty.toFixed(2) ?? "0.00"}로 시리즈 한 번의 영향이 작지 않습니다.`;
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
  const importantSeries = seasonContext.series
    .filter(
      (series) =>
        series.status !== "final" &&
        parseDate(`${series.startDate}T00:00:00+09:00`) >= currentMoment - 86400000,
    )
    .map((series) => {
      const remainingGames = seasonContext.games.filter(
        (game) => game.seriesId === series.seriesId && game.status !== "final",
      ).length;
      const probabilityFocus =
        (simulation.bucketOdds.find((item) => item.seasonTeamId === series.homeSeasonTeamId)?.first ?? 0) +
        (simulation.bucketOdds.find((item) => item.seasonTeamId === series.awaySeasonTeamId)?.first ?? 0) +
        (simulation.bucketOdds.find((item) => item.seasonTeamId === series.homeSeasonTeamId)?.fifth ?? 0) +
        (simulation.bucketOdds.find((item) => item.seasonTeamId === series.awaySeasonTeamId)?.fifth ?? 0) +
        (teamStrengthById[series.homeSeasonTeamId]?.headToHeadLeverage ?? 0) +
        (teamStrengthById[series.awaySeasonTeamId]?.headToHeadLeverage ?? 0) +
        remainingGames * 0.04;
      return {
        series,
        label: createSeriesLabel(series, displayById),
        probabilityFocus,
        remainingGames,
        reason: summarizeSeriesReason(
          series.homeSeasonTeamId,
          series.awaySeasonTeamId,
          bucketById,
          teamStrengthById,
          displayById,
        ),
      };
    })
    .sort((left, right) => right.probabilityFocus - left.probabilityFocus || left.series.startDate.localeCompare(right.series.startDate))
    .slice(0, 6)
    .map((item) => item);
  const finalGamesYesterday = seasonContext.games
    .filter((game) => game.status === "final")
    .sort((left, right) => right.scheduledAt.localeCompare(left.scheduledAt))
    .slice(0, 5);

  const shakeupTeams = [...simulation.teamStrengths]
    .sort(
      (left, right) =>
        Math.abs(right.recentFormAdjustment) + Math.abs(right.scheduleDifficulty) -
        (Math.abs(left.recentFormAdjustment) + Math.abs(left.scheduleDifficulty)),
    )
    .slice(0, 3);
  const todayChangeCards = simulation.teamStrengths
    .slice()
    .sort(
      (left, right) =>
        Math.abs(right.recentFormAdjustment) +
          Math.abs(right.scheduleDifficulty) +
          Math.abs(right.headToHeadLeverage) -
        (Math.abs(left.recentFormAdjustment) +
          Math.abs(left.scheduleDifficulty) +
          Math.abs(left.headToHeadLeverage)),
    )
    .slice(0, 4)
    .map((item) => ({
      seasonTeamId: item.seasonTeamId,
      summary: item.explanationReasons[0]?.sentence ?? "현재 흐름을 설명하는 데이터가 있습니다.",
    }));

  return {
    ...seasonContext,
    awards: bundle.awards.filter((item) => item.seasonId === seasonContext.season.seasonId),
    standings,
    archiveStandingsRows,
    simulation,
    baselineInput,
    displayById,
    importantSeries,
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
  const careerSummary = playerContext.seasonStats.reduce(
    (accumulator, stat) => {
      accumulator.seasons += 1;
      accumulator.totalWar += stat.war ?? 0;
      accumulator.hitterGames += stat.statType === "hitter" ? stat.games : 0;
      accumulator.pitcherGames += stat.statType === "pitcher" ? stat.games : 0;
      accumulator.homeRuns += stat.homeRuns ?? 0;
      accumulator.strikeouts += stat.strikeouts ?? 0;
      accumulator.wins += stat.wins ?? 0;
      return accumulator;
    },
    {
      seasons: 0,
      totalWar: 0,
      hitterGames: 0,
      pitcherGames: 0,
      homeRuns: 0,
      strikeouts: 0,
      wins: 0,
    },
  );
  const sortedStatsBySeason: PlayerSeasonPageStat[] = playerContext.seasonStats
    .map((stat) => ({
      ...stat,
      seasonLabel: seasonById[stat.seasonId]?.label ?? stat.seasonId,
      seasonYear: seasonById[stat.seasonId]?.year ?? 0,
      teamLabel: brandById[seasonTeamById[stat.seasonTeamId]?.brandId]?.displayNameKo ?? stat.seasonTeamId,
    }))
    .sort((left, right) => right.seasonYear - left.seasonYear);
  const currentSeasonFocus: (PlayerSeasonPageStat & { rankingMetrics: PlayerRankingMetric[] }) | null = sortedStatsBySeason[0]
    ? {
        ...sortedStatsBySeason[0],
        rankingMetrics: buildPlayerSeasonRankingContext(sortedStatsBySeason[0], bundle.playerSeasonStats),
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
