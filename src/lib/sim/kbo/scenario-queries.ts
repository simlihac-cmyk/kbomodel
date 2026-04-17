import type {
  BucketOdds,
  ExpectedRecord,
  PostseasonOdds,
  ScenarioForcedOutcome,
  ScenarioOverride,
  Series,
  SimulationInput,
  SimulationSnapshot,
  TeamDisplay,
} from "@/lib/domain/kbo/types";
import { serializeScenarioKey } from "@/lib/sim/kbo/scenario";
import {
  simulateQualificationByWins,
  simulateSeason,
  type QualificationByWinsRow,
} from "@/lib/sim/kbo/regular-season";

export type ScenarioTargetKey =
  | "first"
  | "top2"
  | "postseason"
  | "ks"
  | "champion";

export const SCENARIO_TARGET_OPTIONS: Array<{
  key: ScenarioTargetKey;
  label: string;
  shortLabel: string;
}> = [
  { key: "first", label: "1위", shortLabel: "1위" },
  { key: "top2", label: "2위 이내", shortLabel: "2위 이내" },
  { key: "postseason", label: "5강 진출", shortLabel: "5강" },
  { key: "ks", label: "한국시리즈 진출", shortLabel: "KS" },
  { key: "champion", label: "우승", shortLabel: "우승" },
];

export type ScenarioImpactCard = {
  label: string;
  probability: number;
  delta: number;
};

export type ScenarioSeriesImpact = {
  seriesId: string;
  label: string;
  opponentLabel: string;
  startDate: string;
  endDate: string;
  remainingGames: number;
  favorable: ScenarioImpactCard;
  unfavorable: ScenarioImpactCard;
  swing: number;
  note: string;
};

export type ScenarioRivalSeriesImpact = ScenarioSeriesImpact & {
  homeTeamLabel: string;
  awayTeamLabel: string;
  favorableTeamLabel: string;
  unfavorableTeamLabel: string;
};

export type ScenarioQueryAnalysis = {
  selectedTeamId: string;
  target: ScenarioTargetKey;
  targetLabel: string;
  currentProbability: number;
  expectedRecord: ExpectedRecord | null;
  remainingGames: number;
  requiredWins: ScenarioRequiredWinsSummary | null;
  nextSeries: (ScenarioSeriesImpact & {
    favorableSweep: ScenarioImpactCard | null;
    unfavorableSweep: ScenarioImpactCard | null;
  }) | null;
  leverageSeries: ScenarioSeriesImpact[];
  rivalSeries: ScenarioRivalSeriesImpact[];
};

export type ScenarioRequiredWinsThreshold = {
  threshold: number;
  minimumWins: number | null;
  probability: number | null;
};

export type ScenarioRequiredWinsSummary = {
  remainingGames: number;
  currentTargetProbability: number;
  mostLikelyWins: number | null;
  mostLikelyWinsShare: number | null;
  expectedAdditionalWins: number | null;
  thresholds: ScenarioRequiredWinsThreshold[];
};

function mapBySeasonTeamId<T extends { seasonTeamId: string }>(items: T[]) {
  return Object.fromEntries(items.map((item) => [item.seasonTeamId, item])) as Record<string, T>;
}

function countRemainingGamesInSeries(input: SimulationInput, seriesId: string) {
  return input.games.filter((game) => game.seriesId === seriesId && game.status !== "final").length;
}

function upsertSeriesOverride(
  overrides: ScenarioOverride[],
  seriesId: string,
  forcedOutcome: ScenarioForcedOutcome,
): ScenarioOverride[] {
  const filtered = overrides.filter(
    (override) => !(override.targetType === "series" && override.targetId === seriesId),
  );

  if (forcedOutcome === "model") {
    return filtered;
  }

  return [
    ...filtered,
    {
      overrideId: `series:${seriesId}`,
      targetType: "series",
      targetId: seriesId,
      forcedOutcome,
      note: "",
    },
  ];
}

function createSimulationRunner(
  baseInput: Omit<SimulationInput, "scenarioOverrides">,
  iterations: number,
) {
  const cache = new Map<string, SimulationSnapshot>();

  return (overrides: ScenarioOverride[]) => {
    const key = serializeScenarioKey(overrides);
    const cached = cache.get(key);
    if (cached) {
      return cached;
    }

    const snapshot = simulateSeason(
      {
        ...baseInput,
        scenarioOverrides: overrides,
      },
      iterations,
    );
    cache.set(key, snapshot);
    return snapshot;
  };
}

function getTargetLabel(target: ScenarioTargetKey) {
  return (
    SCENARIO_TARGET_OPTIONS.find((option) => option.key === target)?.label ??
    target
  );
}

function buildOutcomeNote(delta: number, targetLabel: string) {
  const absolute = Math.abs(delta);
  if (absolute >= 0.12) {
    return `이 시리즈 하나로 ${targetLabel} 구도가 크게 흔들립니다.`;
  }
  if (absolute >= 0.05) {
    return `${targetLabel} 흐름이 눈에 띄게 달라집니다.`;
  }
  return `${targetLabel}에 주는 직접 영향은 작지만 누적 의미는 남습니다.`;
}

function buildRivalOutcomeNote(
  selectedTeamLabel: string,
  favorableTeamLabel: string,
  targetLabel: string,
  swing: number,
) {
  const absolute = Math.abs(swing);
  if (absolute >= 0.12) {
    return `${favorableTeamLabel} 쪽 결과가 ${selectedTeamLabel}의 ${targetLabel} 확률을 크게 도와줍니다.`;
  }
  if (absolute >= 0.05) {
    return `${favorableTeamLabel} 쪽으로 흐르면 ${selectedTeamLabel}의 ${targetLabel} 판세가 제법 편해집니다.`;
  }
  return `${favorableTeamLabel} 결과가 ${selectedTeamLabel}에 조금 더 유리합니다.`;
}

function buildTeamSeriesOutcomeLabels(
  series: Series,
  selectedTeamId: string,
  displayById: Record<string, TeamDisplay>,
) {
  const selectedIsHome = series.homeSeasonTeamId === selectedTeamId;
  const selectedTeamLabel = displayById[selectedTeamId]?.shortNameKo ?? selectedTeamId;
  const opponentSeasonTeamId = selectedIsHome ? series.awaySeasonTeamId : series.homeSeasonTeamId;
  const opponentLabel = displayById[opponentSeasonTeamId]?.shortNameKo ?? opponentSeasonTeamId;

  return {
    opponentLabel,
    favorableOutcome: (selectedIsHome ? "homeSeriesWin" : "awaySeriesWin") as ScenarioForcedOutcome,
    unfavorableOutcome: (selectedIsHome ? "awaySeriesWin" : "homeSeriesWin") as ScenarioForcedOutcome,
    favorableSweepOutcome: (selectedIsHome ? "homeSweep" : "awaySweep") as ScenarioForcedOutcome,
    unfavorableSweepOutcome: (selectedIsHome ? "awaySweep" : "homeSweep") as ScenarioForcedOutcome,
    favorableLabel: `${selectedTeamLabel} 위닝시리즈`,
    unfavorableLabel: `${opponentLabel} 위닝시리즈`,
    favorableSweepLabel: `${selectedTeamLabel} 스윕`,
    unfavorableSweepLabel: `${opponentLabel} 스윕`,
  };
}

export function getScenarioTargetProbability(
  target: ScenarioTargetKey,
  bucketOdds: BucketOdds | null | undefined,
  postseasonOdds: PostseasonOdds | null | undefined,
) {
  if (!bucketOdds && !postseasonOdds) {
    return 0;
  }

  if (target === "first") {
    return bucketOdds?.first ?? 0;
  }

  if (target === "top2") {
    return (bucketOdds?.first ?? 0) + (bucketOdds?.second ?? 0);
  }

  if (target === "postseason") {
    return 1 - (bucketOdds?.missPostseason ?? 1);
  }

  if (target === "ks") {
    return postseasonOdds?.ks ?? 0;
  }

  return postseasonOdds?.champion ?? 0;
}

function probabilityForTeam(
  snapshot: SimulationSnapshot,
  selectedTeamId: string,
  target: ScenarioTargetKey,
) {
  const bucketById = mapBySeasonTeamId(snapshot.bucketOdds);
  const postseasonById = mapBySeasonTeamId(snapshot.postseasonOdds);
  return getScenarioTargetProbability(
    target,
    bucketById[selectedTeamId],
    postseasonById[selectedTeamId],
  );
}

function buildTargetProbabilityMap(
  snapshot: SimulationSnapshot,
  target: ScenarioTargetKey,
) {
  const bucketById = mapBySeasonTeamId(snapshot.bucketOdds);
  const postseasonById = mapBySeasonTeamId(snapshot.postseasonOdds);

  return Object.fromEntries(
    snapshot.bucketOdds.map((bucket) => [
      bucket.seasonTeamId,
      getScenarioTargetProbability(
        target,
        bucketById[bucket.seasonTeamId],
        postseasonById[bucket.seasonTeamId],
      ),
    ]),
  ) as Record<string, number>;
}

function getTargetCountForCurveRow(
  row: QualificationByWinsRow,
  target: ScenarioTargetKey,
) {
  if (target === "first") {
    return row.first;
  }
  if (target === "top2") {
    return row.top2;
  }
  if (target === "postseason") {
    return row.postseason;
  }
  if (target === "ks") {
    return row.ks;
  }
  return row.champion;
}

function buildRequiredWinsSummary(
  curve: QualificationByWinsRow[],
  target: ScenarioTargetKey,
  remainingGames: number,
  currentTargetProbability: number,
): ScenarioRequiredWinsSummary | null {
  if (remainingGames <= 0 || curve.length === 0) {
    return null;
  }

  const totalCount = curve.reduce((sum, row) => sum + row.total, 0);
  if (totalCount === 0) {
    return null;
  }

  const mostLikelyRow =
    curve
      .slice()
      .sort((left, right) => right.total - left.total || left.additionalWins - right.additionalWins)[0] ??
    null;
  const exactByWins = Object.fromEntries(
    curve.map((row) => [row.additionalWins, row]),
  ) as Record<number, QualificationByWinsRow>;
  const probabilityByAtLeast: Array<{ wins: number; probability: number | null }> = [];
  let runningTotal = 0;
  let runningTarget = 0;

  for (let wins = remainingGames; wins >= 0; wins -= 1) {
    const row = exactByWins[wins];
    if (row) {
      runningTotal += row.total;
      runningTarget += getTargetCountForCurveRow(row, target);
    }
    probabilityByAtLeast[wins] = {
      wins,
      probability: runningTotal > 0 ? runningTarget / runningTotal : null,
    };
  }

  return {
    remainingGames,
    currentTargetProbability,
    mostLikelyWins: mostLikelyRow?.additionalWins ?? null,
    mostLikelyWinsShare: mostLikelyRow ? mostLikelyRow.total / totalCount : null,
    expectedAdditionalWins:
      curve.reduce((sum, row) => sum + row.additionalWins * row.total, 0) / totalCount,
    thresholds: [0.5, 0.7, 0.85].map((threshold) => {
      const found =
        probabilityByAtLeast.find(
          (entry) => entry.probability !== null && entry.probability >= threshold,
        ) ?? null;

      return {
        threshold,
        minimumWins: found?.wins ?? null,
        probability: found?.probability ?? null,
      };
    }),
  };
}

function buildSeriesImpact(
  snapshot: SimulationSnapshot,
  series: Series,
  selectedTeamId: string,
  target: ScenarioTargetKey,
  displayById: Record<string, TeamDisplay>,
  remainingGames: number,
  simulateSnapshot: (overrides: ScenarioOverride[]) => SimulationSnapshot,
  scenarioOverrides: ScenarioOverride[],
): ScenarioSeriesImpact {
  const currentProbability = probabilityForTeam(snapshot, selectedTeamId, target);
  const outcomeLabels = buildTeamSeriesOutcomeLabels(series, selectedTeamId, displayById);

  const favorableSnapshot = simulateSnapshot(
    upsertSeriesOverride(
      scenarioOverrides,
      series.seriesId,
      outcomeLabels.favorableOutcome,
    ),
  );
  const unfavorableSnapshot = simulateSnapshot(
    upsertSeriesOverride(
      scenarioOverrides,
      series.seriesId,
      outcomeLabels.unfavorableOutcome,
    ),
  );

  const favorableProbability = probabilityForTeam(
    favorableSnapshot,
    selectedTeamId,
    target,
  );
  const unfavorableProbability = probabilityForTeam(
    unfavorableSnapshot,
    selectedTeamId,
    target,
  );
  const favorableDelta = favorableProbability - currentProbability;
  const unfavorableDelta = unfavorableProbability - currentProbability;
  const swing = favorableProbability - unfavorableProbability;

  return {
    seriesId: series.seriesId,
    label: `${displayById[series.awaySeasonTeamId]?.shortNameKo ?? series.awaySeasonTeamId} @ ${displayById[series.homeSeasonTeamId]?.shortNameKo ?? series.homeSeasonTeamId}`,
    opponentLabel: outcomeLabels.opponentLabel,
    startDate: series.startDate,
    endDate: series.endDate,
    remainingGames,
    favorable: {
      label: outcomeLabels.favorableLabel,
      probability: favorableProbability,
      delta: favorableDelta,
    },
    unfavorable: {
      label: outcomeLabels.unfavorableLabel,
      probability: unfavorableProbability,
      delta: unfavorableDelta,
    },
    swing,
    note: buildOutcomeNote(swing / 2, getTargetLabel(target)),
  };
}

function buildRivalSeriesImpact(
  snapshot: SimulationSnapshot,
  series: Series,
  selectedTeamId: string,
  target: ScenarioTargetKey,
  displayById: Record<string, TeamDisplay>,
  remainingGames: number,
  simulateSnapshot: (overrides: ScenarioOverride[]) => SimulationSnapshot,
  scenarioOverrides: ScenarioOverride[],
): ScenarioRivalSeriesImpact {
  const currentProbability = probabilityForTeam(snapshot, selectedTeamId, target);
  const homeTeamLabel = displayById[series.homeSeasonTeamId]?.shortNameKo ?? series.homeSeasonTeamId;
  const awayTeamLabel = displayById[series.awaySeasonTeamId]?.shortNameKo ?? series.awaySeasonTeamId;
  const selectedTeamLabel = displayById[selectedTeamId]?.shortNameKo ?? selectedTeamId;

  const homeSnapshot = simulateSnapshot(
    upsertSeriesOverride(
      scenarioOverrides,
      series.seriesId,
      "homeSeriesWin",
    ),
  );
  const awaySnapshot = simulateSnapshot(
    upsertSeriesOverride(
      scenarioOverrides,
      series.seriesId,
      "awaySeriesWin",
    ),
  );
  const homeProbability = probabilityForTeam(homeSnapshot, selectedTeamId, target);
  const awayProbability = probabilityForTeam(awaySnapshot, selectedTeamId, target);
  const homeIsFavorable = homeProbability >= awayProbability;
  const favorableProbability = homeIsFavorable ? homeProbability : awayProbability;
  const unfavorableProbability = homeIsFavorable ? awayProbability : homeProbability;
  const favorableTeamLabel = homeIsFavorable ? homeTeamLabel : awayTeamLabel;
  const unfavorableTeamLabel = homeIsFavorable ? awayTeamLabel : homeTeamLabel;
  const favorableDelta = favorableProbability - currentProbability;
  const unfavorableDelta = unfavorableProbability - currentProbability;
  const swing = favorableProbability - unfavorableProbability;

  return {
    seriesId: series.seriesId,
    label: `${awayTeamLabel} @ ${homeTeamLabel}`,
    opponentLabel: `${awayTeamLabel}, ${homeTeamLabel}`,
    startDate: series.startDate,
    endDate: series.endDate,
    remainingGames,
    homeTeamLabel,
    awayTeamLabel,
    favorableTeamLabel,
    unfavorableTeamLabel,
    favorable: {
      label: `${favorableTeamLabel} 위닝시리즈`,
      probability: favorableProbability,
      delta: favorableDelta,
    },
    unfavorable: {
      label: `${unfavorableTeamLabel} 위닝시리즈`,
      probability: unfavorableProbability,
      delta: unfavorableDelta,
    },
    swing,
    note: buildRivalOutcomeNote(
      selectedTeamLabel,
      favorableTeamLabel,
      getTargetLabel(target),
      swing,
    ),
  };
}

function buildSweepCard(
  snapshot: SimulationSnapshot,
  series: Series,
  selectedTeamId: string,
  target: ScenarioTargetKey,
  displayById: Record<string, TeamDisplay>,
  remainingGames: number,
  simulateSnapshot: (overrides: ScenarioOverride[]) => SimulationSnapshot,
  scenarioOverrides: ScenarioOverride[],
  direction: "favorable" | "unfavorable",
): ScenarioImpactCard | null {
  if (remainingGames < 3) {
    return null;
  }

  const currentProbability = probabilityForTeam(snapshot, selectedTeamId, target);
  const outcomeLabels = buildTeamSeriesOutcomeLabels(series, selectedTeamId, displayById);
  const forcedOutcome =
    direction === "favorable"
      ? outcomeLabels.favorableSweepOutcome
      : outcomeLabels.unfavorableSweepOutcome;
  const label =
    direction === "favorable"
      ? outcomeLabels.favorableSweepLabel
      : outcomeLabels.unfavorableSweepLabel;

  const nextSnapshot = simulateSnapshot(
    upsertSeriesOverride(
      scenarioOverrides,
      series.seriesId,
      forcedOutcome,
    ),
  );
  const probability = probabilityForTeam(nextSnapshot, selectedTeamId, target);

  return {
    label,
    probability,
    delta: probability - currentProbability,
  };
}

export function buildScenarioQueryAnalysis({
  baseInput,
  currentSnapshot,
  scenarioOverrides,
  selectedTeamId,
  target,
  displayById,
  iterations = 240,
}: {
  baseInput: Omit<SimulationInput, "scenarioOverrides">;
  currentSnapshot: SimulationSnapshot;
  scenarioOverrides: ScenarioOverride[];
  selectedTeamId: string;
  target: ScenarioTargetKey;
  displayById: Record<string, TeamDisplay>;
  iterations?: number;
}): ScenarioQueryAnalysis {
  const input: SimulationInput = {
    ...baseInput,
    scenarioOverrides,
  };
  const bucketById = mapBySeasonTeamId(currentSnapshot.bucketOdds);
  const postseasonById = mapBySeasonTeamId(currentSnapshot.postseasonOdds);
  const expectedById = mapBySeasonTeamId(currentSnapshot.expectedRecords);
  const targetLabel = getTargetLabel(target);
  const simulateSnapshot = createSimulationRunner(baseInput, iterations);
  const targetProbabilityById = buildTargetProbabilityMap(currentSnapshot, target);
  const selectedProbability = targetProbabilityById[selectedTeamId] ?? 0;
  const remainingGames = input.games.filter(
    (game) =>
      game.status !== "final" &&
      (game.homeSeasonTeamId === selectedTeamId ||
        game.awaySeasonTeamId === selectedTeamId),
  ).length;
  const requiredWins = buildRequiredWinsSummary(
    simulateQualificationByWins(input, selectedTeamId, iterations),
    target,
    remainingGames,
    selectedProbability,
  );
  const rivalScoreEntries = Object.entries(targetProbabilityById)
    .filter(([seasonTeamId]) => seasonTeamId !== selectedTeamId)
    .map(([seasonTeamId, probability]) => {
      const probabilityGap = Math.abs(probability - selectedProbability);
      const closenessScore = Math.max(0, 1 - probabilityGap / 0.35);
      const score = closenessScore * 0.8 + probability * 0.2;

      return {
        seasonTeamId,
        probability,
        score,
      };
    })
    .sort((left, right) => right.score - left.score || right.probability - left.probability)
    .slice(0, 4);
  const rivalScoreById = Object.fromEntries(
    rivalScoreEntries.map((entry) => [entry.seasonTeamId, entry.score]),
  ) as Record<string, number>;
  const rivalIds = new Set(rivalScoreEntries.map((entry) => entry.seasonTeamId));

  const selectedSeries = input.series
    .filter(
      (series) =>
        series.status !== "final" &&
        (series.homeSeasonTeamId === selectedTeamId ||
          series.awaySeasonTeamId === selectedTeamId),
    )
    .sort((left, right) => left.startDate.localeCompare(right.startDate))
    .slice(0, 5);

  const leverageSeries = selectedSeries
    .map((series) => {
      const remainingGames = countRemainingGamesInSeries(input, series.seriesId);

      return buildSeriesImpact(
        currentSnapshot,
        series,
        selectedTeamId,
        target,
        displayById,
        remainingGames,
        simulateSnapshot,
        scenarioOverrides,
      );
    })
    .sort((left, right) => right.swing - left.swing);

  const rivalSeries = input.series
    .filter(
      (series) =>
        series.status !== "final" &&
        series.homeSeasonTeamId !== selectedTeamId &&
        series.awaySeasonTeamId !== selectedTeamId &&
        (rivalIds.has(series.homeSeasonTeamId) || rivalIds.has(series.awaySeasonTeamId)),
    )
    .sort((left, right) => {
      const leftScore =
        (rivalScoreById[left.homeSeasonTeamId] ?? 0) +
        (rivalScoreById[left.awaySeasonTeamId] ?? 0);
      const rightScore =
        (rivalScoreById[right.homeSeasonTeamId] ?? 0) +
        (rivalScoreById[right.awaySeasonTeamId] ?? 0);
      return rightScore - leftScore || left.startDate.localeCompare(right.startDate);
    })
    .slice(0, 6)
    .map((series) =>
      buildRivalSeriesImpact(
        currentSnapshot,
        series,
        selectedTeamId,
        target,
        displayById,
        countRemainingGamesInSeries(input, series.seriesId),
        simulateSnapshot,
        scenarioOverrides,
      ),
    )
    .sort((left, right) => right.swing - left.swing)
    .slice(0, 4);

  const nextSeries = selectedSeries[0] ?? null;
  const nextSeriesImpact = nextSeries
    ? leverageSeries.find((item) => item.seriesId === nextSeries.seriesId) ?? null
    : null;

  return {
    selectedTeamId,
    target,
    targetLabel,
    currentProbability: getScenarioTargetProbability(
      target,
      bucketById[selectedTeamId],
      postseasonById[selectedTeamId],
    ),
    expectedRecord: expectedById[selectedTeamId] ?? null,
    remainingGames,
    requiredWins,
    nextSeries: nextSeriesImpact
      ? {
          ...nextSeriesImpact,
          favorableSweep: buildSweepCard(
            currentSnapshot,
            nextSeries,
            selectedTeamId,
            target,
            displayById,
            countRemainingGamesInSeries(input, nextSeries.seriesId),
            simulateSnapshot,
            scenarioOverrides,
            "favorable",
          ),
          unfavorableSweep: buildSweepCard(
            currentSnapshot,
            nextSeries,
            selectedTeamId,
            target,
            displayById,
            countRemainingGamesInSeries(input, nextSeries.seriesId),
            simulateSnapshot,
            scenarioOverrides,
            "unfavorable",
          ),
        }
      : null,
    leverageSeries,
    rivalSeries,
  };
}
