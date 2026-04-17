"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { SharedScenarioSpotlight } from "@/components/scenario/shared-scenario-spotlight";
import { FreshnessBadges } from "@/components/shared/freshness-badges";
import { MetricBadge } from "@/components/shared/metric-badge";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { QUICK_SERIES_OUTCOME_LABELS, RACE_FILTERS } from "@/lib/domain/kbo/constants";
import type { ScenarioForcedOutcome, Series, SimulationInput, UserScenario } from "@/lib/domain/kbo/types";
import type { getSeasonDashboardData } from "@/lib/repositories/kbo/view-models";
import {
  buildScenarioQueryAnalysis,
  buildScenarioExportPayload,
  buildScenarioShareToken,
  getScenarioTargetProbability,
  parseScenarioImport,
  SCENARIO_TARGET_OPTIONS,
  type ScenarioTargetKey,
} from "@/lib/sim/kbo";
import { resolveInitialScenarioUiState, type ScenarioPageRaceFilter } from "@/lib/scenario/ui-state";
import { useSimulationWorker } from "@/hooks/use-simulation-worker";
import { buildEmptyScenario, useScenarioStore } from "@/stores/scenario-store";
import { useUiStore } from "@/stores/ui-store";
import {
  formatDateLabel,
  formatDateOnlyLabel,
  formatDateTimeLabel,
  formatPercent,
  formatRecordLabel,
  formatSignedPercentPoint,
} from "@/lib/utils/format";
import { buildScenarioRoute } from "@/lib/utils/routes";

type ScenarioStudioProps = {
  year: number;
  data: NonNullable<Awaited<ReturnType<typeof getSeasonDashboardData>>>;
  initialTeamSlug?: string | null;
  initialMode?: "quick" | "team" | "race" | "advanced" | null;
  initialRaceFilter?: ScenarioPageRaceFilter;
  initialTarget?: ScenarioTargetKey;
  initialSharedScenario?: UserScenario | null;
  initialSharedScenarioError?: string | null;
  initialShareToken?: string | null;
};

function findRelevantSeries(
  series: Series[],
  mode: "quick" | "team" | "race" | "advanced",
  selectedTeamSlug: string | null,
  raceFilter: "first" | "second" | "fifth" | "all",
  standings: NonNullable<Awaited<ReturnType<typeof getSeasonDashboardData>>>["standings"]["rows"],
  displayById: NonNullable<Awaited<ReturnType<typeof getSeasonDashboardData>>>["displayById"],
) {
  const remainingSeries = series.filter((item) => item.status !== "final");
  if (mode === "team" && selectedTeamSlug) {
    return remainingSeries.filter((item) => {
      const homeSlug = displayById[item.homeSeasonTeamId]?.teamSlug;
      const awaySlug = displayById[item.awaySeasonTeamId]?.teamSlug;
      return homeSlug === selectedTeamSlug || awaySlug === selectedTeamSlug;
    });
  }

  if (mode === "race") {
    const relevantTeams =
      raceFilter === "first"
        ? standings.slice(0, 3)
        : raceFilter === "second"
          ? standings.slice(0, 4)
          : raceFilter === "fifth"
            ? standings.slice(3, 7)
            : standings;
    const relevantIds = new Set(relevantTeams.map((item) => item.seasonTeamId));
    return remainingSeries.filter(
      (item) => relevantIds.has(item.homeSeasonTeamId) || relevantIds.has(item.awaySeasonTeamId),
    );
  }

  return remainingSeries;
}

function probabilityTone(value: number): "positive" | "negative" | "neutral" {
  if (value >= 0.6) {
    return "positive";
  }
  if (value <= 0.35) {
    return "negative";
  }
  return "neutral";
}

function deltaTone(value: number): "positive" | "negative" | "neutral" {
  if (value >= 0.005) {
    return "positive";
  }
  if (value <= -0.005) {
    return "negative";
  }
  return "neutral";
}

function scenarioModeLabel(mode: "quick" | "team" | "race" | "advanced") {
  if (mode === "team") {
    return "팀 중심 모드";
  }
  if (mode === "race") {
    return "경쟁선 모드";
  }
  if (mode === "advanced") {
    return "정밀 모드";
  }
  return "빠른 모드";
}

export function ScenarioStudio({
  year,
  data,
  initialTeamSlug = null,
  initialMode = null,
  initialRaceFilter = null,
  initialTarget = "postseason",
  initialSharedScenario = null,
  initialSharedScenarioError = null,
  initialShareToken = null,
}: ScenarioStudioProps) {
  const storedScenario = useScenarioStore(
    (state) => state.scenariosBySeason[data.season.seasonId],
  );
  const storedSavedScenarios = useScenarioStore(
    (state) => state.savedScenariosBySeason[data.season.seasonId],
  );
  const setScenarioName = useScenarioStore((state) => state.setScenarioName);
  const setSeriesOverride = useScenarioStore((state) => state.setSeriesOverride);
  const setGameOverride = useScenarioStore((state) => state.setGameOverride);
  const saveCurrentScenario = useScenarioStore((state) => state.saveCurrentScenario);
  const loadSavedScenario = useScenarioStore((state) => state.loadSavedScenario);
  const renameSavedScenario = useScenarioStore((state) => state.renameSavedScenario);
  const deleteSavedScenario = useScenarioStore((state) => state.deleteSavedScenario);
  const importScenario = useScenarioStore((state) => state.importScenario);
  const resetSeason = useScenarioStore((state) => state.resetSeason);
  const { selectedTeamSlug, setSelectedTeamSlug, scenarioMode, setScenarioMode, raceFilter, setRaceFilter } =
    useUiStore();
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [shareLinkState, setShareLinkState] = useState<"idle" | "copied" | "failed">("idle");
  const [saveState, setSaveState] = useState<"idle" | "saved">("idle");
  const [importState, setImportState] = useState<"idle" | "applied">("idle");
  const [renameState, setRenameState] = useState<string | null>(null);
  const [importValue, setImportValue] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>({});
  const [scenarioTarget, setScenarioTarget] = useState<ScenarioTargetKey>(initialTarget);
  const [sharedLinkNotice, setSharedLinkNotice] = useState<string | null>(
    initialSharedScenarioError,
  );
  const [sharedLinkTone, setSharedLinkTone] = useState<"positive" | "negative">(
    initialSharedScenarioError ? "negative" : "positive",
  );
  const [hasBootstrappedUi, setHasBootstrappedUi] = useState(false);
  const appliedShareTokenRef = useRef<string | null>(null);
  const initialUiState = useMemo(
    () => resolveInitialScenarioUiState(initialMode, initialTeamSlug, initialRaceFilter),
    [initialMode, initialRaceFilter, initialTeamSlug],
  );
  const scenario = useMemo(
    () =>
      initialShareToken &&
      initialSharedScenario &&
      appliedShareTokenRef.current !== initialShareToken
        ? initialSharedScenario
        : storedScenario ?? buildEmptyScenario(data.season.seasonId),
    [data.season.seasonId, initialShareToken, initialSharedScenario, storedScenario],
  );
  const savedScenarios = useMemo(() => storedSavedScenarios ?? [], [storedSavedScenarios]);
  const matchedSavedScenario = useMemo(
    () =>
      savedScenarios.find(
        (saved) => saved.name.trim() === scenario.name.trim() && scenario.name.trim().length > 0,
      ) ?? null,
    [savedScenarios, scenario.name],
  );

  useEffect(() => {
    setSelectedTeamSlug(initialUiState.selectedTeamSlug);
    setScenarioMode(initialUiState.scenarioMode);
    setRaceFilter(initialUiState.raceFilter);
    setScenarioTarget(initialTarget);
    setHasBootstrappedUi(true);
  }, [initialTarget, initialUiState, setRaceFilter, setScenarioMode, setSelectedTeamSlug]);

  useEffect(() => {
    if (!initialShareToken || appliedShareTokenRef.current === initialShareToken) {
      return;
    }

    appliedShareTokenRef.current = initialShareToken;

    if (initialSharedScenario) {
      importScenario(data.season.seasonId, initialSharedScenario);
      setSharedLinkTone("positive");
      setSharedLinkNotice(
        `공유 링크 시나리오${initialSharedScenario.name ? ` "${initialSharedScenario.name}"` : ""}를 불러왔습니다.`,
      );
      return;
    }

    if (initialSharedScenarioError) {
      setSharedLinkTone("negative");
      setSharedLinkNotice(initialSharedScenarioError);
    }
  }, [
    data.season.seasonId,
    importScenario,
    initialShareToken,
    initialSharedScenario,
    initialSharedScenarioError,
  ]);

  useEffect(() => {
    setRenameDrafts(
      Object.fromEntries(savedScenarios.map((saved) => [saved.scenarioId, saved.name])),
    );
  }, [savedScenarios]);

  const shouldUseInitialUi =
    !hasBootstrappedUi ||
    (initialShareToken ? appliedShareTokenRef.current !== initialShareToken : false);
  const activeSelectedTeamSlug = shouldUseInitialUi
    ? initialUiState.selectedTeamSlug
    : selectedTeamSlug;
  const activeScenarioMode = shouldUseInitialUi
    ? initialUiState.scenarioMode
    : scenarioMode;
  const activeRaceFilter = shouldUseInitialUi
    ? initialUiState.raceFilter
    : raceFilter;

  const baseInput = useMemo<Omit<SimulationInput, "scenarioOverrides">>(
    () => ({
      season: data.baselineInput.season,
      ruleset: data.baselineInput.ruleset,
      seasonTeams: data.baselineInput.seasonTeams,
      series: data.baselineInput.series,
      games: data.baselineInput.games,
      teamSeasonStats: data.baselineInput.teamSeasonStats,
      players: data.baselineInput.players,
      rosterEvents: data.baselineInput.rosterEvents,
      playerSeasonStats: data.baselineInput.playerSeasonStats,
      playerGameStats: data.baselineInput.playerGameStats,
      previousSeasonStats: data.baselineInput.previousSeasonStats,
    }),
    [data.baselineInput],
  );

  const simulationState = useSimulationWorker(baseInput, data.simulation, scenario.overrides);
  const analysisTeamSlug = useMemo(() => {
    if (
      activeSelectedTeamSlug &&
      data.standings.rows.some((row) => row.teamSlug === activeSelectedTeamSlug)
    ) {
      return activeSelectedTeamSlug;
    }

    return data.standings.rows[0]?.teamSlug ?? null;
  }, [activeSelectedTeamSlug, data.standings.rows]);
  const analysisTeamRow = useMemo(
    () =>
      analysisTeamSlug
        ? data.standings.rows.find((row) => row.teamSlug === analysisTeamSlug) ?? null
        : null,
    [analysisTeamSlug, data.standings.rows],
  );
  const baselinePostseasonById = useMemo(
    () =>
      Object.fromEntries(
        data.simulation.postseasonOdds.map((item) => [item.seasonTeamId, item]),
      ),
    [data.simulation.postseasonOdds],
  );
  const analysis = useMemo(() => {
    if (!analysisTeamRow || simulationState.loading || simulationState.error) {
      return null;
    }

    return buildScenarioQueryAnalysis({
      baseInput,
      currentSnapshot: simulationState.snapshot,
      scenarioOverrides: scenario.overrides,
      selectedTeamId: analysisTeamRow.seasonTeamId,
      target: scenarioTarget,
      displayById: data.displayById,
      iterations: 220,
    });
  }, [
    analysisTeamRow,
    baseInput,
    data.displayById,
    scenario.overrides,
    scenarioTarget,
    simulationState.error,
    simulationState.loading,
    simulationState.snapshot,
  ]);
  const baselineTargetProbability = useMemo(() => {
    if (!analysisTeamRow) {
      return 0;
    }

    return getScenarioTargetProbability(
      scenarioTarget,
      data.bucketById[analysisTeamRow.seasonTeamId],
      baselinePostseasonById[analysisTeamRow.seasonTeamId],
    );
  }, [
    analysisTeamRow,
    baselinePostseasonById,
    data.bucketById,
    scenarioTarget,
  ]);
  const shareSpotlight = useMemo(() => {
    if (!initialShareToken || !initialSharedScenario || !analysis || !analysisTeamRow) {
      return null;
    }

    const leadSeries = analysis.nextSeries ?? analysis.leverageSeries[0] ?? null;
    const raceLabel =
      activeScenarioMode === "race"
        ? RACE_FILTERS.find((filter) => filter.key === activeRaceFilter)?.label ?? null
        : null;

    return {
      scenarioName: scenario.name,
      teamLabel: analysisTeamRow.shortNameKo,
      targetLabel: analysis.targetLabel,
      currentProbabilityLabel: formatPercent(analysis.currentProbability),
      currentProbabilityTone: probabilityTone(analysis.currentProbability),
      baselineDeltaLabel: formatSignedPercentPoint(
        analysis.currentProbability - baselineTargetProbability,
      ),
      baselineDeltaTone: deltaTone(
        analysis.currentProbability - baselineTargetProbability,
      ),
      expectedOutlookLabel: analysis.expectedRecord
        ? `평균 ${analysis.expectedRecord.averageRank.toFixed(1)}위 · ${formatRecordLabel(
            analysis.expectedRecord.expectedWins,
            analysis.expectedRecord.expectedLosses,
            analysis.expectedRecord.expectedTies,
          )}`
        : "예상 성적 없음",
      leverageLabel: leadSeries
        ? `${leadSeries.label} · ${formatSignedPercentPoint(leadSeries.swing)}`
        : "남은 swing 없음",
      modeLabel: scenarioModeLabel(activeScenarioMode),
      raceFilterLabel: raceLabel,
      overrideCount: scenario.overrides.length,
    };
  }, [
    activeRaceFilter,
    activeScenarioMode,
    analysis,
    analysisTeamRow,
    baselineTargetProbability,
    initialShareToken,
    initialSharedScenario,
    scenario.name,
    scenario.overrides.length,
  ]);
  const visibleSeries = useMemo(
    () =>
      findRelevantSeries(
        data.series,
        activeScenarioMode,
        activeSelectedTeamSlug,
        activeRaceFilter,
        data.standings.rows,
        data.displayById,
      ),
    [
      activeRaceFilter,
      activeScenarioMode,
      activeSelectedTeamSlug,
      data.displayById,
      data.series,
      data.standings.rows,
    ],
  );
  const currentBucketById = useMemo(
    () => Object.fromEntries(simulationState.snapshot.bucketOdds.map((item) => [item.seasonTeamId, item])),
    [simulationState.snapshot.bucketOdds],
  );
  const currentPostseasonById = useMemo(
    () =>
      Object.fromEntries(
        simulationState.snapshot.postseasonOdds.map((item) => [item.seasonTeamId, item]),
      ),
    [simulationState.snapshot.postseasonOdds],
  );
  const seriesOverrideById = useMemo(
    () =>
      Object.fromEntries(
        scenario.overrides
          .filter((override) => override.targetType === "series")
          .map((override) => [override.targetId, override.forcedOutcome]),
      ) as Record<string, ScenarioForcedOutcome>,
    [scenario.overrides],
  );
  const gameOverrideById = useMemo(
    () =>
      Object.fromEntries(
        scenario.overrides
          .filter((override) => override.targetType === "game")
          .map((override) => [override.targetId, override.forcedOutcome]),
      ) as Record<string, ScenarioForcedOutcome>,
    [scenario.overrides],
  );
  const teamDeltaRows = useMemo(
    () =>
      [...data.standings.rows]
        .map((row) => {
          const baseBucket = data.bucketById[row.seasonTeamId];
          const currentBucket = currentBucketById[row.seasonTeamId];
          const basePost = data.simulation.postseasonOdds.find(
            (item) => item.seasonTeamId === row.seasonTeamId,
          );
          const currentPost = currentPostseasonById[row.seasonTeamId];
          const basePs = 1 - (baseBucket?.missPostseason ?? 1);
          const currentPs = 1 - (currentBucket?.missPostseason ?? 1);
          return {
            row,
            psDelta: currentPs - basePs,
            firstDelta: (currentBucket?.first ?? 0) - (baseBucket?.first ?? 0),
            ksDelta: (currentPost?.ks ?? 0) - (basePost?.ks ?? 0),
            championDelta: (currentPost?.champion ?? 0) - (basePost?.champion ?? 0),
          };
        })
        .sort((left, right) => Math.abs(right.psDelta) - Math.abs(left.psDelta)),
    [currentBucketById, currentPostseasonById, data.bucketById, data.simulation.postseasonOdds, data.standings.rows],
  );

  const copyExport = async () => {
    try {
      await navigator.clipboard.writeText(buildScenarioExportPayload(scenario));
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
    window.setTimeout(() => setCopyState("idle"), 1200);
  };

  const copyShareLink = async () => {
    try {
      const shareToken = buildScenarioShareToken(scenario);
      const route = buildScenarioRoute(year, {
        mode: activeScenarioMode,
        raceFilter: activeScenarioMode === "race" ? activeRaceFilter : undefined,
        target: scenarioTarget,
        teamSlug: analysisTeamSlug,
        shareToken,
      });
      const url = new URL(route, window.location.origin).toString();
      await navigator.clipboard.writeText(url);
      setShareLinkState("copied");
    } catch {
      setShareLinkState("failed");
    }
    window.setTimeout(() => setShareLinkState("idle"), 1200);
  };

  const saveScenario = () => {
    saveCurrentScenario(data.season.seasonId);
    setSaveState("saved");
    window.setTimeout(() => setSaveState("idle"), 1200);
  };

  const handleRenameSavedScenario = (scenarioId: string) => {
    renameSavedScenario(
      data.season.seasonId,
      scenarioId,
      renameDrafts[scenarioId] ?? "",
    );
    setRenameState(scenarioId);
    window.setTimeout(() => setRenameState((current) => (current === scenarioId ? null : current)), 1200);
  };

  const handleImport = () => {
    if (!importValue.trim()) {
      setImportError("붙여 넣은 시나리오 JSON이 비어 있습니다.");
      setImportState("idle");
      return;
    }
    try {
      const parsed = parseScenarioImport(importValue, data.season.seasonId);
      importScenario(data.season.seasonId, parsed);
      setImportError(null);
      setImportValue("");
      setImportState("applied");
      window.setTimeout(() => setImportState("idle"), 1200);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "시나리오 import에 실패했습니다.");
      setImportState("idle");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`${year} 경우의 수`}
        title="경우의 수 계산기 / Scenario"
        description="팀과 목표를 먼저 고르면 현재 확률, 다음 시리즈의 유불리, 남은 일정에서 가장 크게 흔드는 카드가 바로 보입니다. 필요할 때만 아래에서 시리즈 단위 가정을 직접 편집하면 됩니다."
        actions={<FreshnessBadges status={data.automationStatus} compact />}
      />

      {sharedLinkNotice && (sharedLinkTone === "negative" || !shareSpotlight) ? (
        <div
          className={`rounded-3xl border px-4 py-4 text-sm ${
            sharedLinkTone === "positive"
              ? "border-emerald-200 bg-emerald-50 text-ink"
              : "border-orange-200 bg-orange-50 text-warning"
          }`}
        >
          {sharedLinkNotice}
        </div>
      ) : null}

      {initialShareToken && initialSharedScenario && !shareSpotlight ? (
        <div className="rounded-[32px] border border-accent/20 bg-[linear-gradient(135deg,rgba(0,111,95,0.1),rgba(255,255,255,0.96)_48%,rgba(238,243,248,0.92))] px-5 py-5 text-sm text-muted shadow-panel">
          공유 링크 기준 결과를 정리하고 있습니다. 시뮬레이션이 끝나면 이 링크에서 가장 중요한 팀과 목표를 먼저 강조해서 보여 줍니다.
        </div>
      ) : null}

      {shareSpotlight ? (
        <SharedScenarioSpotlight
          scenarioName={shareSpotlight.scenarioName}
          teamLabel={shareSpotlight.teamLabel}
          targetLabel={shareSpotlight.targetLabel}
          currentProbabilityLabel={shareSpotlight.currentProbabilityLabel}
          currentProbabilityTone={shareSpotlight.currentProbabilityTone}
          baselineDeltaLabel={shareSpotlight.baselineDeltaLabel}
          baselineDeltaTone={shareSpotlight.baselineDeltaTone}
          expectedOutlookLabel={shareSpotlight.expectedOutlookLabel}
          leverageLabel={shareSpotlight.leverageLabel}
          modeLabel={shareSpotlight.modeLabel}
          raceFilterLabel={shareSpotlight.raceFilterLabel}
          overrideCount={shareSpotlight.overrideCount}
          shareLinkState={shareLinkState}
          onCopyShareLink={copyShareLink}
        />
      ) : null}

      <div id="quick-calculator">
        <SectionCard
          title="빠른 경우의 수 계산"
          subtitle="우리 팀의 1위, 2위 이내, 5강, KS, 우승 확률을 바로 보고 다음 시리즈가 얼마나 크게 흔드는지 먼저 확인합니다."
        >
        <div className="mb-5 grid gap-3 xl:grid-cols-[0.9fr_1.1fr]">
          <label className="flex flex-col gap-2 text-sm text-muted">
            관심 팀
            <select
              value={analysisTeamSlug ?? ""}
              onChange={(event) => setSelectedTeamSlug(event.target.value || null)}
              className="w-full rounded-2xl border border-line/80 bg-white px-4 py-2 text-ink"
            >
              {data.standings.rows.map((row) => (
                <option key={row.seasonTeamId} value={row.teamSlug}>
                  {row.shortNameKo}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-2 text-sm text-muted">
            <span>목표</span>
            <div className="flex flex-wrap gap-2">
              {SCENARIO_TARGET_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setScenarioTarget(option.key)}
                  className={`rounded-full px-3 py-1.5 text-sm ${
                    scenarioTarget === option.key
                      ? "bg-accent text-white"
                      : "border border-line/80 bg-white text-muted"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {simulationState.loading ? (
          <div className="rounded-3xl border border-line/80 bg-slate-50 px-4 py-5 text-sm text-muted">
            현재 override를 반영해 경우의 수를 다시 계산하고 있습니다.
          </div>
        ) : simulationState.error ? (
          <div className="rounded-3xl border border-orange-200 bg-orange-50 px-4 py-5 text-sm text-warning">
            경우의 수 계산 중 오류가 발생했습니다. {simulationState.error}
          </div>
        ) : analysis && analysisTeamRow ? (
          <div className="space-y-6">
            <div className="grid gap-3 lg:grid-cols-4">
              <MetricBadge
                label={`현재 ${analysis.targetLabel} 확률`}
                value={formatPercent(analysis.currentProbability)}
                tone={probabilityTone(analysis.currentProbability)}
              />
              <MetricBadge
                label="예상 최종 성적"
                value={
                  analysis.expectedRecord
                    ? formatRecordLabel(
                        analysis.expectedRecord.expectedWins,
                        analysis.expectedRecord.expectedLosses,
                        analysis.expectedRecord.expectedTies,
                      )
                    : "-"
                }
              />
              <MetricBadge
                label="평균 예상 순위"
                value={
                  analysis.expectedRecord
                    ? `${analysis.expectedRecord.averageRank.toFixed(1)}위`
                    : "-"
                }
                tone={
                  analysis.expectedRecord
                    ? probabilityTone(1 - analysis.expectedRecord.averageRank / data.standings.rows.length)
                    : "neutral"
                }
              />
              <MetricBadge label="남은 경기" value={`${analysis.remainingGames}경기`} />
            </div>

            <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
              <div className="space-y-3">
                <div className="rounded-3xl border border-line/80 bg-slate-50 px-4 py-4">
                  <p className="text-sm font-medium text-ink">
                    {analysisTeamRow.shortNameKo}의 현재 판세
                  </p>
                  <p className="mt-2 text-sm text-muted">
                    지금 기준 {analysis.targetLabel} 확률은{" "}
                    <span className="font-medium text-ink">
                      {formatPercent(analysis.currentProbability)}
                    </span>
                    입니다.
                    {analysis.expectedRecord
                      ? ` 예상 평균 순위는 ${analysis.expectedRecord.averageRank.toFixed(1)}위, 기대 성적은 ${formatRecordLabel(
                          analysis.expectedRecord.expectedWins,
                          analysis.expectedRecord.expectedLosses,
                          analysis.expectedRecord.expectedTies,
                        )}입니다.`
                      : null}
                  </p>
                </div>

                {analysis.requiredWins ? (
                  <div className="rounded-3xl border border-line/80 px-4 py-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-medium text-ink">최소 필요 성적</p>
                        <p className="mt-1 text-sm text-muted">
                          남은 {analysis.requiredWins.remainingGames}경기에서 어느 정도 승수를 쌓아야{" "}
                          {analysis.targetLabel} 확률선이 올라가는지 시뮬레이션 경로 기준으로 정리했습니다.
                        </p>
                      </div>
                      <span className="metric-chip bg-slate-100 text-ink">
                        평균 {analysis.requiredWins.expectedAdditionalWins?.toFixed(1) ?? "-"}승
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      {analysis.requiredWins.thresholds.map((item) => (
                        <div key={item.threshold} className="rounded-2xl border border-line/80 bg-slate-50 px-4 py-4">
                          <p className="text-xs text-muted">{Math.round(item.threshold * 100)}% 기준</p>
                          <p className="mt-2 text-lg font-semibold text-ink">
                            {item.minimumWins === null
                              ? "도달 어려움"
                              : item.minimumWins === 0
                                ? "현재도 충족"
                                : `${item.minimumWins}승 이상`}
                          </p>
                          <p className="mt-2 text-sm text-muted">
                            {item.probability !== null
                              ? `해당 구간 확률 ${formatPercent(item.probability)}`
                              : `현재 경로에서는 ${Math.round(item.threshold * 100)}%선을 넘지 못합니다.`}
                          </p>
                        </div>
                      ))}
                    </div>

                    <p className="mt-4 text-sm text-muted">
                      가장 자주 나온 추가 승수는{" "}
                      <span className="font-medium text-ink">
                        {analysis.requiredWins.mostLikelyWins !== null
                          ? `${analysis.requiredWins.mostLikelyWins}승`
                          : "-"}
                      </span>
                      {analysis.requiredWins.mostLikelyWinsShare !== null
                        ? ` · 전체 경로의 ${formatPercent(analysis.requiredWins.mostLikelyWinsShare)}`
                        : null}
                    </p>
                  </div>
                ) : null}

                {analysis.nextSeries ? (
                  <div className="rounded-3xl border border-line/80 px-4 py-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-medium text-ink">다음 시리즈 바로 보기</p>
                        <p className="mt-1 text-sm text-muted">
                          {analysis.nextSeries.label} · {analysis.nextSeries.startDate} ~{" "}
                          {analysis.nextSeries.endDate} · 남은 {analysis.nextSeries.remainingGames}경기
                        </p>
                      </div>
                      <span className="metric-chip bg-accent-soft text-accent">
                        swing {formatSignedPercentPoint(analysis.nextSeries.swing)}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <MetricBadge
                        label={analysis.nextSeries.favorable.label}
                        value={formatPercent(analysis.nextSeries.favorable.probability)}
                        tone="positive"
                      />
                      <MetricBadge
                        label={analysis.nextSeries.unfavorable.label}
                        value={formatPercent(analysis.nextSeries.unfavorable.probability)}
                        tone="negative"
                      />
                      {analysis.nextSeries.favorableSweep ? (
                        <MetricBadge
                          label={analysis.nextSeries.favorableSweep.label}
                          value={formatPercent(analysis.nextSeries.favorableSweep.probability)}
                          tone="positive"
                        />
                      ) : null}
                      {analysis.nextSeries.unfavorableSweep ? (
                        <MetricBadge
                          label={analysis.nextSeries.unfavorableSweep.label}
                          value={formatPercent(analysis.nextSeries.unfavorableSweep.probability)}
                          tone="negative"
                        />
                      ) : null}
                    </div>

                    <div className="mt-4 grid gap-2 text-sm text-muted md:grid-cols-2">
                      <div className="rounded-2xl bg-emerald-50 px-3 py-3">
                        {analysis.nextSeries.favorable.label} 시{" "}
                        {formatSignedPercentPoint(analysis.nextSeries.favorable.delta)}
                      </div>
                      <div className="rounded-2xl bg-orange-50 px-3 py-3">
                        {analysis.nextSeries.unfavorable.label} 시{" "}
                        {formatSignedPercentPoint(analysis.nextSeries.unfavorable.delta)}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-3xl border border-line/80 bg-slate-50 px-4 py-5 text-sm text-muted">
                    남은 시리즈가 없어서 추가 경우의 수를 계산하지 않았습니다.
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="rounded-3xl border border-line/80 px-4 py-4">
                  <p className="font-medium text-ink">가장 크게 흔드는 남은 시리즈</p>
                  <p className="mt-1 text-sm text-muted">
                    현재 작업 중인 override를 반영한 뒤, {analysisTeamRow.shortNameKo}의{" "}
                    {analysis.targetLabel} 확률을 가장 크게 바꾸는 시리즈부터 보여 줍니다.
                  </p>
                </div>

                {analysis.leverageSeries.length > 0 ? (
                  analysis.leverageSeries.map((item) => (
                    <div key={item.seriesId} className="rounded-3xl border border-line/80 px-4 py-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-medium text-ink">{item.label}</p>
                          <p className="mt-1 text-sm text-muted">
                            {item.startDate} ~ {item.endDate} · 남은 {item.remainingGames}경기
                          </p>
                        </div>
                        <span className="metric-chip bg-slate-100 text-ink">
                          swing {formatSignedPercentPoint(item.swing)}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                        <div className="rounded-2xl bg-emerald-50 px-3 py-3 text-sm text-muted">
                          <span className="font-medium text-ink">{item.favorable.label}</span>
                          <p className="mt-1">
                            {formatPercent(item.favorable.probability)} ·{" "}
                            {formatSignedPercentPoint(item.favorable.delta)}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-orange-50 px-3 py-3 text-sm text-muted">
                          <span className="font-medium text-ink">{item.unfavorable.label}</span>
                          <p className="mt-1">
                            {formatPercent(item.unfavorable.probability)} ·{" "}
                            {formatSignedPercentPoint(item.unfavorable.delta)}
                          </p>
                        </div>
                      </div>
                      <p className="mt-3 text-sm text-muted">{item.note}</p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-3xl border border-line/80 bg-slate-50 px-4 py-5 text-sm text-muted">
                    남은 시리즈가 없어 레버리지 분석 결과가 비어 있습니다.
                  </div>
                )}

                <div className="rounded-3xl border border-line/80 px-4 py-4">
                  <p className="font-medium text-ink">경쟁팀 변수</p>
                  <p className="mt-1 text-sm text-muted">
                    {analysisTeamRow.shortNameKo}의 직접 경기 말고도, 라이벌 팀들이 얽힌 시리즈가{" "}
                    {analysis.targetLabel} 확률을 얼마나 바꾸는지 추려 봤습니다.
                  </p>
                </div>

                {analysis.rivalSeries.length > 0 ? (
                  analysis.rivalSeries.map((item) => (
                    <div key={`rival-${item.seriesId}`} className="rounded-3xl border border-line/80 px-4 py-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-medium text-ink">{item.label}</p>
                          <p className="mt-1 text-sm text-muted">
                            {item.startDate} ~ {item.endDate} · 남은 {item.remainingGames}경기
                          </p>
                        </div>
                        <span className="metric-chip bg-slate-100 text-ink">
                          swing {formatSignedPercentPoint(item.swing)}
                        </span>
                      </div>

                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                        <div className="rounded-2xl bg-emerald-50 px-3 py-3 text-sm text-muted">
                          <span className="font-medium text-ink">{item.favorable.label}</span>
                          <p className="mt-1">
                            {formatPercent(item.favorable.probability)} ·{" "}
                            {formatSignedPercentPoint(item.favorable.delta)}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-orange-50 px-3 py-3 text-sm text-muted">
                          <span className="font-medium text-ink">{item.unfavorable.label}</span>
                          <p className="mt-1">
                            {formatPercent(item.unfavorable.probability)} ·{" "}
                            {formatSignedPercentPoint(item.unfavorable.delta)}
                          </p>
                        </div>
                      </div>

                      <p className="mt-3 text-sm text-muted">{item.note}</p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-3xl border border-line/80 bg-slate-50 px-4 py-5 text-sm text-muted">
                    현재 시점에는 별도로 크게 흔드는 경쟁팀 시리즈가 잡히지 않았습니다.
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-line/80 bg-slate-50 px-4 py-5 text-sm text-muted">
            팀을 고르면 빠른 경우의 수를 바로 계산합니다.
          </div>
        )}
        </SectionCard>
      </div>

      <div id="scenario-editor" className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <SectionCard
          title="상세 가정 편집"
          subtitle="빠른 경우의 수 계산으로 방향을 본 뒤, 여기서 시리즈/경기 단위로 가정을 직접 고정합니다."
          actions={
            <div className="flex flex-wrap gap-2">
              {[
                ["quick", "빠른 모드"],
                ["team", "팀 중심 모드"],
                ["race", "경쟁선 모드"],
                ["advanced", "정밀 모드"],
              ].map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setScenarioMode(mode as "quick" | "team" | "race" | "advanced")}
                  className={`rounded-full px-3 py-1.5 text-sm ${activeScenarioMode === mode ? "bg-accent text-white" : "border border-line/80 bg-white text-muted"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          }
        >
          <div className="mb-4 flex flex-col gap-3 rounded-3xl border border-line/80 bg-slate-50 px-4 py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <label className="flex-1 text-sm text-muted">
                현재 시나리오 이름
                <input
                  value={scenario.name}
                  onChange={(event) => setScenarioName(data.season.seasonId, event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-line/80 bg-white px-4 py-2 text-ink"
                />
              </label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                <button
                  type="button"
                  onClick={saveScenario}
                  className="rounded-full bg-accent px-3 py-1.5 text-sm text-white"
                >
                  {saveState === "saved"
                    ? "저장됨"
                    : matchedSavedScenario
                      ? "같은 이름 덮어쓰기"
                      : "로컬 저장"}
                </button>
                <button
                  type="button"
                  onClick={() => resetSeason(data.season.seasonId)}
                  className="rounded-full border border-line/80 bg-white px-3 py-1.5 text-sm text-muted"
                >
                  Reset to official
                </button>
                <button
                  type="button"
                  onClick={copyShareLink}
                  className="rounded-full border border-line/80 bg-white px-3 py-1.5 text-sm text-muted"
                >
                  {shareLinkState === "copied"
                    ? "링크 복사됨"
                    : shareLinkState === "failed"
                      ? "링크 복사 실패"
                      : "공유 링크"}
                </button>
                <button
                  type="button"
                  onClick={copyExport}
                  className="rounded-full border border-line/80 bg-white px-3 py-1.5 text-sm text-muted"
                >
                  {copyState === "copied" ? "복사됨" : copyState === "failed" ? "복사 실패" : "JSON Export"}
                </button>
              </div>
            </div>

            <div className="grid gap-3 xl:grid-cols-[1fr_1fr]">
              <div className="rounded-2xl border border-line/80 bg-white px-4 py-4">
                <p className="text-sm font-medium text-ink">저장된 시나리오</p>
                <div className="mt-3 space-y-2">
                  {savedScenarios.length > 0 ? (
                    savedScenarios.map((saved) => (
                      <div key={saved.scenarioId} className="rounded-2xl border border-line/80 px-3 py-3">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                              <input
                                value={renameDrafts[saved.scenarioId] ?? saved.name}
                                onChange={(event) =>
                                  setRenameDrafts((current) => ({
                                    ...current,
                                    [saved.scenarioId]: event.target.value,
                                  }))
                                }
                                className="w-full rounded-2xl border border-line/80 bg-white px-3 py-2 text-sm text-ink"
                              />
                              <button
                                type="button"
                                onClick={() => handleRenameSavedScenario(saved.scenarioId)}
                                className="rounded-full border border-line/80 bg-white px-3 py-1 text-xs text-muted sm:shrink-0"
                              >
                                {renameState === saved.scenarioId ? "이름 적용됨" : "이름 변경"}
                              </button>
                            </div>
                            <p className="mt-2 text-xs text-muted">
                              override {saved.overrides.length}개 · {formatDateOnlyLabel(saved.updatedAt)}
                            </p>
                          </div>
                          <div className="grid grid-cols-2 gap-2 sm:flex">
                            <button
                              type="button"
                              onClick={() => loadSavedScenario(data.season.seasonId, saved.scenarioId)}
                              className="rounded-full border border-line/80 bg-white px-3 py-1 text-xs text-muted"
                            >
                              불러오기
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteSavedScenario(data.season.seasonId, saved.scenarioId)}
                              className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs text-warning"
                            >
                              삭제
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted">아직 저장된 시나리오가 없습니다. 지금 편집 중인 초안을 먼저 로컬 저장하면 여기서 다시 불러올 수 있습니다.</p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-line/80 bg-white px-4 py-4">
                <p className="text-sm font-medium text-ink">Import</p>
                <textarea
                  value={importValue}
                  onChange={(event) => {
                    setImportValue(event.target.value);
                    if (importError) {
                      setImportError(null);
                    }
                    if (importState !== "idle") {
                      setImportState("idle");
                    }
                  }}
                  placeholder='{"version":1,"scenario":{...}}'
                  className="mt-3 h-32 w-full rounded-2xl border border-line/80 bg-slate-50 px-4 py-3 text-sm text-ink"
                />
                {importError ? <p className="mt-2 text-xs text-warning">{importError}</p> : null}
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={!importValue.trim()}
                  className="mt-3 rounded-full border border-line/80 bg-white px-3 py-1.5 text-sm text-muted disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {importState === "applied" ? "Import 완료" : "Import 적용"}
                </button>
              </div>
            </div>
          </div>

          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {activeScenarioMode === "team" ? (
              <label className="flex flex-col gap-2 text-sm text-muted">
                특정 팀 필터
                <select
                  value={activeSelectedTeamSlug ?? ""}
                  onChange={(event) => setSelectedTeamSlug(event.target.value || null)}
                  className="w-full rounded-2xl border border-line/80 bg-white px-4 py-2 text-ink lg:w-auto"
                >
                  <option value="">전체 팀</option>
                  {data.standings.rows.map((row) => (
                    <option key={row.teamSlug} value={row.teamSlug}>
                      {row.shortNameKo}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="rounded-full border border-line/80 bg-slate-50 px-3 py-1.5 text-sm text-muted">
                현재 override {scenario.overrides.length}개
              </div>
            )}

            {activeScenarioMode === "race" ? (
              <label className="flex flex-col gap-2 text-sm text-muted">
                경쟁선 필터
                <select
                  value={activeRaceFilter}
                  onChange={(event) => setRaceFilter(event.target.value as "first" | "second" | "fifth" | "all")}
                  className="w-full rounded-2xl border border-line/80 bg-white px-4 py-2 text-ink lg:w-auto"
                >
                  {RACE_FILTERS.map((filter) => (
                    <option key={filter.key} value={filter.key}>
                      {filter.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>

          <div className="space-y-4">
            {visibleSeries.length > 0 ? visibleSeries.map((seriesItem) => {
              const home = data.displayById[seriesItem.homeSeasonTeamId];
              const away = data.displayById[seriesItem.awaySeasonTeamId];
              const remainingGames = data.games.filter(
                (game) => game.seriesId === seriesItem.seriesId && game.status !== "final",
              );
              const currentSeriesSelection = seriesOverrideById[seriesItem.seriesId] ?? "model";

              return (
                <div key={seriesItem.seriesId} className="rounded-3xl border border-line/80 px-4 py-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-ink">
                          {away.shortNameKo} @ {home.shortNameKo}
                        </p>
                        <span className="metric-chip bg-accent-soft text-accent">
                          현재 선택 {QUICK_SERIES_OUTCOME_LABELS[currentSeriesSelection as keyof typeof QUICK_SERIES_OUTCOME_LABELS] ?? "개별 경기 입력"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted">
                        {seriesItem.startDate} ~ {seriesItem.endDate} · 남은 {remainingGames.length}경기
                      </p>
                      {seriesItem.importanceNote ? (
                        <p className="mt-2 text-sm text-muted">{seriesItem.importanceNote}</p>
                      ) : null}
                    </div>

                    {activeScenarioMode !== "advanced" ? (
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(QUICK_SERIES_OUTCOME_LABELS).map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() =>
                              setSeriesOverride(
                                data.season.seasonId,
                                seriesItem.seriesId,
                                value as ScenarioForcedOutcome,
                              )
                            }
                            className={`rounded-full px-3 py-1.5 text-sm ${
                              currentSeriesSelection === value
                                ? "bg-accent text-white"
                                : "border border-line/80 bg-white text-muted"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  {activeScenarioMode === "advanced" ? (
                    <div className="mt-4 space-y-3">
                      {remainingGames.map((game) => {
                        const currentGameSelection = gameOverrideById[game.gameId] ?? "model";
                        return (
                          <div
                            key={game.gameId}
                            className="flex flex-col gap-2 rounded-2xl bg-slate-50 px-4 py-3 lg:flex-row lg:items-center lg:justify-between"
                          >
                            <div>
                              <p className="text-sm text-ink">
                                {formatDateLabel(game.scheduledAt)}
                              </p>
                              <p className="mt-1 text-xs text-muted">현재 선택: {currentGameSelection}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {[
                                ["homeWin", `${home.shortNameKo} 승`],
                                ["tie", "무승부"],
                                ["awayWin", `${away.shortNameKo} 승`],
                                ["model", "모델대로"],
                              ].map(([value, label]) => (
                                <button
                                  key={value}
                                  type="button"
                                  onClick={() =>
                                    setGameOverride(
                                      data.season.seasonId,
                                      game.gameId,
                                      value as ScenarioForcedOutcome,
                                    )
                                  }
                                  className={`rounded-full px-3 py-1 text-sm ${
                                    currentGameSelection === value
                                      ? "bg-accent text-white"
                                      : "border border-line/80 bg-white text-muted"
                                  }`}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            }) : (
              <div className="rounded-3xl border border-line/80 bg-slate-50 px-4 py-5 text-sm text-muted">
                현재 필터에서 편집할 남은 시리즈가 없습니다. 팀 필터나 경쟁선 필터를 바꾸거나, 이미 모든 남은 시리즈가 종료되었는지 확인해 주세요.
              </div>
            )}
          </div>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title="시나리오 패널" subtitle="baseline과 현재 draft 시나리오를 분리해 읽습니다.">
            <div className="space-y-3">
              <div className="rounded-2xl border border-line/80 bg-slate-50 px-4 py-4">
                <p className="text-sm text-muted">현재 시나리오 이름</p>
                <p className="mt-2 font-medium text-ink">{scenario.name}</p>
                <p className="mt-2 text-xs text-muted">
                  작업본 · 마지막 수정 {formatDateTimeLabel(scenario.updatedAt)}
                </p>
              </div>
              <div className="rounded-2xl border border-line/80 bg-slate-50 px-4 py-4">
                <p className="text-sm text-muted">상태</p>
                <p className="mt-2 font-medium text-ink">
                  {simulationState.loading ? "재계산 중" : simulationState.error ? "오류" : "최신"}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-2xl border border-line/80 bg-slate-50 px-4 py-4">
                  <p className="text-xs text-muted">override</p>
                  <p className="mt-2 text-xl font-semibold text-ink">{scenario.overrides.length}</p>
                </div>
                <div className="rounded-2xl border border-line/80 bg-slate-50 px-4 py-4">
                  <p className="text-xs text-muted">저장 슬롯</p>
                  <p className="mt-2 text-xl font-semibold text-ink">{savedScenarios.length}</p>
                </div>
              </div>
              <div className="rounded-2xl border border-line/80 bg-slate-50 px-4 py-4">
                <p className="text-sm text-muted">최근 저장본</p>
                <p className="mt-2 font-medium text-ink">{savedScenarios[0]?.name ?? "없음"}</p>
                <p className="mt-2 text-xs text-muted">
                  {savedScenarios[0]
                    ? `${savedScenarios[0].overrides.length}개 override · ${formatDateTimeLabel(savedScenarios[0].updatedAt)}`
                    : "아직 저장된 시나리오가 없습니다."}
                </p>
                {matchedSavedScenario ? (
                  <p className="mt-2 text-xs text-accent">
                    현재 작업본 이름과 같은 저장본이 있어 저장 시 해당 슬롯을 덮어씁니다.
                  </p>
                ) : null}
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Baseline 대비 변화" subtitle="가장 크게 흔들린 팀부터 보여 줍니다.">
            <div className="space-y-2">
              {teamDeltaRows.slice(0, 8).map((item) => (
                <div key={item.row.seasonTeamId} className="rounded-2xl border border-line/80 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-ink">{item.row.shortNameKo}</p>
                    <span className="text-sm text-muted">{formatSignedPercentPoint(item.psDelta)}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-muted">
                    <span>1위 {formatSignedPercentPoint(item.firstDelta)}</span>
                    <span>KS {formatSignedPercentPoint(item.ksDelta)}</span>
                    <span>우승 {formatSignedPercentPoint(item.championDelta)}</span>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="가장 이득 / 손해 보는 팀" subtitle="PS 진출 확률 delta 기준입니다.">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-muted">상승</p>
                {teamDeltaRows
                  .filter((item) => item.psDelta > 0)
                  .slice(0, 4)
                  .map((item) => (
                    <div key={item.row.seasonTeamId} className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
                      <span className="font-medium text-ink">{item.row.shortNameKo}</span>
                      <span className="text-muted">{formatSignedPercentPoint(item.psDelta)}</span>
                    </div>
                  ))}
              </div>
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-muted">하락</p>
                {teamDeltaRows
                  .filter((item) => item.psDelta < 0)
                  .slice(0, 4)
                  .map((item) => (
                    <div key={item.row.seasonTeamId} className="flex items-center justify-between rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm">
                      <span className="font-medium text-ink">{item.row.shortNameKo}</span>
                      <span className="text-muted">{formatSignedPercentPoint(item.psDelta)}</span>
                    </div>
                  ))}
              </div>
            </div>
          </SectionCard>

          <SectionCard title="현재 확률 결과" subtitle="시나리오 결과 snapshot에서 1위와 PS 진입 확률을 빠르게 읽습니다.">
            <div className="space-y-2">
              {data.standings.rows.map((row) => (
                <div
                  key={row.seasonTeamId}
                  className="flex items-center justify-between rounded-2xl border border-line/80 px-4 py-3 text-sm"
                >
                  <span className="font-medium text-ink">{row.shortNameKo}</span>
                  <span className="text-muted">
                    1위 {formatPercent(currentBucketById[row.seasonTeamId]?.first ?? 0)} / PS{" "}
                    {formatPercent(1 - (currentBucketById[row.seasonTeamId]?.missPostseason ?? 1))}
                  </span>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
