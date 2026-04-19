"use client";

import { useMemo } from "react";

import { RankHeatmap } from "@/components/shared/heatmap";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { RACE_FILTERS } from "@/lib/domain/kbo/constants";
import type { SimulationInput } from "@/lib/domain/kbo/types";
import type { getSeasonDashboardData } from "@/lib/repositories/kbo/view-models";
import { useSimulationWorker } from "@/hooks/use-simulation-worker";
import { buildEmptyScenario, useScenarioStore } from "@/stores/scenario-store";
import { useUiStore } from "@/stores/ui-store";
import { formatPercent, formatSignedPercentPoint } from "@/lib/utils/format";

type RaceOverviewProps = {
  year: number;
  data: NonNullable<Awaited<ReturnType<typeof getSeasonDashboardData>>>;
};

export function RaceOverview({ year, data }: RaceOverviewProps) {
  const raceFilter = useUiStore((state) => state.raceFilter);
  const setRaceFilter = useUiStore((state) => state.setRaceFilter);
  const storedScenario = useScenarioStore(
    (state) => state.scenariosBySeason[data.season.seasonId],
  );
  const scenario = useMemo(
    () => storedScenario ?? buildEmptyScenario(data.season.seasonId),
    [data.season.seasonId, storedScenario],
  );
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
  const scenarioBucketById = useMemo(
    () => Object.fromEntries(simulationState.snapshot.bucketOdds.map((item) => [item.seasonTeamId, item])),
    [simulationState.snapshot.bucketOdds],
  );

  const filteredRows = useMemo(() => {
    if (raceFilter === "all") {
      return data.standings.rows;
    }

    return data.standings.rows.filter((row) => {
      const bucket = scenarioBucketById[row.seasonTeamId] ?? data.bucketById[row.seasonTeamId];
      if (!bucket) {
        return false;
      }
      if (raceFilter === "first") {
        return bucket.first >= 0.08;
      }
      if (raceFilter === "second") {
        return bucket.second >= 0.08 || bucket.first >= 0.12;
      }
      return bucket.fifth >= 0.08 || bucket.missPostseason >= 0.15;
    });
  }, [data.bucketById, data.standings.rows, raceFilter, scenarioBucketById]);

  const deltaRows = useMemo(
    () =>
      filteredRows.map((row) => {
        const base = data.bucketById[row.seasonTeamId];
        const current = scenarioBucketById[row.seasonTeamId] ?? base;
        return {
          row,
          firstDelta: (current?.first ?? 0) - (base?.first ?? 0),
          fifthDelta: (current?.fifth ?? 0) - (base?.fifth ?? 0),
          psDelta:
            (1 - (current?.missPostseason ?? 1)) - (1 - (base?.missPostseason ?? 1)),
        };
      }),
    [data.bucketById, filteredRows, scenarioBucketById],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`${year} 레이스`}
        title="순위전망 / Race"
        description="최종 순위 분포, 1위~5위 버킷 odds, 잔여 일정 난이도, 타이브레이커 메모를 함께 보여 주는 레이스 전용 화면입니다. 현재 draft 시나리오가 있으면 delta도 같이 반영됩니다."
      />

      <SectionCard
        title="레이스 탭"
        subtitle="1위, 2위, 5위 경쟁선을 기준으로 표시 팀을 빠르게 바꿀 수 있습니다."
        actions={
          <div className="flex flex-wrap gap-2">
            {RACE_FILTERS.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => setRaceFilter(filter.key)}
                className={`rounded-full px-3 py-1.5 text-sm ${raceFilter === filter.key ? "bg-accent text-white" : "border border-line/80 bg-white text-muted"}`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        }
      >
        <RankHeatmap
          rows={filteredRows.map((row) => ({
            label: row.shortNameKo,
            values: simulationState.snapshot.rankDistributions.find((item) => item.seasonTeamId === row.seasonTeamId)?.probabilities ?? data.rankDistById[row.seasonTeamId].probabilities,
            accent: row.primaryColor,
          }))}
        />
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard title="KBO 버킷 확률 카드" subtitle="baseline 또는 현재 시나리오 기준 bucket odds를 팀별로 확인합니다.">
          <div className="space-y-3">
            {filteredRows.map((row) => {
              const bucket = scenarioBucketById[row.seasonTeamId] ?? data.bucketById[row.seasonTeamId];
              return (
                <div key={row.seasonTeamId} className="rounded-2xl border border-line/80 px-4 py-4">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-ink">{row.shortNameKo}</p>
                    <p className="text-sm text-muted">
                      예상 최종 성적 {data.expectedById[row.seasonTeamId].expectedWins}-{data.expectedById[row.seasonTeamId].expectedLosses}-{data.expectedById[row.seasonTeamId].expectedTies}
                    </p>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                    <div className="rounded-xl bg-slate-50 px-3 py-2">1위 {formatPercent(bucket.first)}</div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2">2위 {formatPercent(bucket.second)}</div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2">3위 {formatPercent(bucket.third)}</div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2">4위 {formatPercent(bucket.fourth)}</div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2">5위 {formatPercent(bucket.fifth)}</div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2">탈락 {formatPercent(bucket.missPostseason)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title="결정전 발생 가능성" subtitle="현재 시나리오가 있으면 그것을 기준으로 tie alert를 보여 줍니다.">
            <div className="space-y-3">
              {(simulationState.snapshot.tieAlerts.length > 0
                ? simulationState.snapshot.tieAlerts
                : data.simulation.tieAlerts
              ).map((alert) => (
                <div key={`${alert.positions.join("-")}-${alert.seasonTeamIds.join("-")}`} className="rounded-2xl border border-line/80 px-4 py-4">
                  <p className="font-medium text-ink">{alert.note}</p>
                  <p className="mt-1 text-sm text-muted">
                    {alert.positions.join(", ")}위 선상 · {formatPercent(alert.probability)}
                  </p>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="타이브레이커 우위/열위 요약" subtitle="run differential과 잔여 일정, leverage를 같이 봅니다.">
            <div className="space-y-3">
              {filteredRows.slice(0, 5).map((row) => {
                const strength = data.teamStrengthById[row.seasonTeamId];
                return (
                  <div key={row.seasonTeamId} className="rounded-2xl border border-line/80 px-4 py-4">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-ink">{row.shortNameKo}</p>
                      <span className="text-sm text-muted">leverage {strength.headToHeadLeverage.toFixed(2)}</span>
                    </div>
                    <p className="mt-2 text-sm text-muted">
                      득실차 {row.runsScored - row.runsAllowed > 0 ? "+" : ""}
                      {row.runsScored - row.runsAllowed}, 잔여 일정 난이도 {strength.scheduleDifficulty.toFixed(2)}
                    </p>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard title="Baseline vs Scenario Delta View" subtitle="현재 draft 시나리오 기준 delta입니다.">
            <div className="space-y-2">
              {deltaRows
                .slice()
                .sort((left, right) => Math.abs(right.psDelta) - Math.abs(left.psDelta))
                .map((item) => (
                  <div key={item.row.seasonTeamId} className="rounded-2xl border border-line/80 px-4 py-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-ink">{item.row.shortNameKo}</span>
                      <span className="text-muted">{formatSignedPercentPoint(item.psDelta)}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted">
                      <span>1위 {formatSignedPercentPoint(item.firstDelta)}</span>
                      <span>5위 {formatSignedPercentPoint(item.fifthDelta)}</span>
                    </div>
                  </div>
                ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
