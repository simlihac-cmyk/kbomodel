import Link from "next/link";

import { DashboardStandingsBoard } from "@/components/dashboard/dashboard-standings-board";
import { TodayWinProbabilityBoard } from "@/components/dashboard/today-win-probability-board";
import { EmptyStateNote } from "@/components/shared/empty-state-note";
import { FreshnessBadges } from "@/components/shared/freshness-badges";
import { RankHeatmap } from "@/components/shared/heatmap";
import { MetricBadge } from "@/components/shared/metric-badge";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import type { getSeasonDashboardData } from "@/lib/repositories/kbo/view-models";
import { formatPercent } from "@/lib/utils/format";
import { getKboDateKey } from "@/lib/scheduler/kbo/windows";

type SeasonDashboardProps = {
  year: number;
  data: NonNullable<Awaited<ReturnType<typeof getSeasonDashboardData>>>;
};

export function SeasonDashboard({ year, data }: SeasonDashboardProps) {
  const easySchedule = [...data.simulation.teamStrengths]
    .sort((left, right) => left.scheduleDifficulty - right.scheduleDifficulty)
    .slice(0, 3);
  const hardSchedule = [...data.simulation.teamStrengths]
    .sort((left, right) => right.scheduleDifficulty - left.scheduleDifficulty)
    .slice(0, 3);
  const todayDateKey = getKboDateKey();
  const todayGames = data.games
    .filter(
      (game) =>
        getKboDateKey(new Date(game.scheduledAt)) === todayDateKey &&
        game.status !== "final" &&
        game.status !== "postponed",
    )
    .sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt));
  const probabilitiesById = Object.fromEntries(
    data.simulation.gameProbabilities.map((item) => [item.gameId, item]),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`${data.season.year} 시즌 헤더`}
        title={data.season.label}
        actions={
          <div className="flex flex-col items-start gap-3">
            <FreshnessBadges status={data.automationStatus} compact />
            <div className="flex flex-wrap gap-2">
              <Link href={`/season/${year}/race`} className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white">
                순위전망 보기
              </Link>
              <Link href={`/season/${year}/scenario`} className="rounded-full border border-line/80 bg-white px-4 py-2 text-sm font-medium text-ink">
                경우의 수 계산
              </Link>
            </div>
          </div>
        }
      />

      <SectionCard title="오늘 경기 승리 예측">
        {todayGames.length > 0 ? (
          <TodayWinProbabilityBoard
            games={todayGames}
            probabilitiesById={probabilitiesById}
            displayById={data.displayById}
          />
        ) : (
          <EmptyStateNote message="오늘 예정된 경기가 없습니다." />
        )}
      </SectionCard>

      <SectionCard title="현재 순위">
        <DashboardStandingsBoard year={year} rows={data.standings.rows} />
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
        <SectionCard title="판세 변화">
          <div className="grid gap-3 lg:grid-cols-2">
            {data.todayChangeCards.map((card) => {
              const display = data.displayById[card.seasonTeamId];
              const strength = data.teamStrengthById[card.seasonTeamId];
              const bucket = data.bucketById[card.seasonTeamId];
              const postseasonProb = bucket ? 1 - bucket.missPostseason : null;
              return (
                <div key={card.seasonTeamId} className="rounded-2xl border border-line/80 bg-slate-50 px-4 py-4">
                  <p className="text-sm font-semibold text-ink">{display.shortNameKo}</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <MetricBadge label="1위" value={bucket ? formatPercent(bucket.first) : "-"} tone="neutral" />
                    <MetricBadge label="5강" value={postseasonProb !== null ? formatPercent(postseasonProb) : "-"} tone="positive" />
                    <MetricBadge label="우승" value={bucket && data.standings.rows.find((row) => row.seasonTeamId === card.seasonTeamId)?.postseasonOdds ? formatPercent(data.standings.rows.find((row) => row.seasonTeamId === card.seasonTeamId)?.postseasonOdds?.champion ?? 0) : "-"} tone="neutral" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium text-muted">
                    <span className="metric-chip bg-white text-ink">
                      최근 폼 {strength.recentFormAdjustment > 0 ? "+" : ""}
                      {strength.recentFormAdjustment.toFixed(2)}
                    </span>
                    <span className="metric-chip bg-white text-ink">신뢰도 {formatPercent(strength.confidenceScore)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard title="중요 시리즈">
          <div className="space-y-3">
            {data.importantSeries.map((item) => (
              <div key={item.series.seriesId} className="rounded-2xl border border-line/80 px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-ink">{item.label}</p>
                    <p className="mt-1 text-sm text-muted">
                      {item.series.startDate} ~ {item.series.endDate} · 남은 {item.remainingGames}경기
                    </p>
                  </div>
                  <span className="metric-chip bg-accent-soft text-accent">
                    중요도 {item.probabilityFocus.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard title="변동성 큰 팀">
          <div className="space-y-3">
            {data.shakeupTeams.map((team) => {
              const display = data.displayById[team.seasonTeamId];
              return (
                <div key={team.seasonTeamId} className="rounded-2xl border border-line/80 px-4 py-4">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-ink">{display.shortNameKo}</p>
                    <span className="text-sm text-muted">
                      신뢰도 {formatPercent(team.confidenceScore)}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium text-muted">
                    <span className="metric-chip bg-slate-100 text-ink">
                      최근 폼 {team.recentFormAdjustment > 0 ? "+" : ""}
                      {team.recentFormAdjustment.toFixed(2)}
                    </span>
                    <span className="metric-chip bg-slate-100 text-ink">
                      일정 난이도 {team.scheduleDifficulty.toFixed(2)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard title="남은 일정 난이도">
          <div className="grid gap-3">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">상대적으로 편한 편</p>
              <div className="space-y-2">
                {easySchedule.map((team) => (
                  <MetricBadge
                    key={team.seasonTeamId}
                    label={data.displayById[team.seasonTeamId].shortNameKo}
                    value={team.scheduleDifficulty.toFixed(2)}
                    tone="positive"
                  />
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">상대적으로 어려운 편</p>
              <div className="space-y-2">
                {hardSchedule.map((team) => (
                  <MetricBadge
                    key={team.seasonTeamId}
                    label={data.displayById[team.seasonTeamId].shortNameKo}
                    value={team.scheduleDifficulty.toFixed(2)}
                    tone="negative"
                  />
                ))}
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="동률/결정전">
          <div className="space-y-3">
            {data.simulation.tieAlerts.length > 0 ? (
              data.simulation.tieAlerts.map((alert) => (
                <div key={`${alert.positions.join("-")}-${alert.seasonTeamIds.join("-")}`} className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-4">
                  <p className="font-medium text-ink">{alert.note}</p>
                  <p className="mt-1 text-sm text-muted">
                    확률 {formatPercent(alert.probability)} ·{" "}
                    {alert.seasonTeamIds
                      .map((teamId) => data.displayById[teamId]?.shortNameKo ?? teamId)
                      .join(", ")}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-line/80 bg-slate-50 px-4 py-4 text-sm text-muted">
                현재 공식 baseline 기준으로는 별도 결정전 경보가 크게 잡히지 않았습니다.
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="팀별 Rank Distribution Preview">
        <RankHeatmap
          rows={data.standings.rows.map((row) => ({
            label: row.shortNameKo,
            values: data.rankDistById[row.seasonTeamId].probabilities,
            accent: row.primaryColor,
          }))}
        />
      </SectionCard>
    </div>
  );
}
