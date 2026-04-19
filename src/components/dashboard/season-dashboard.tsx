import Link from "next/link";

import { DashboardStandingsBoard } from "@/components/dashboard/dashboard-standings-board";
import { RecentFormBadge } from "@/components/shared/recent-form-badge";
import { TodayWinProbabilityBoard } from "@/components/dashboard/today-win-probability-board";
import { EmptyStateNote } from "@/components/shared/empty-state-note";
import { RankHeatmap } from "@/components/shared/heatmap";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import type { RecordOutcome } from "@/lib/domain/kbo/types";
import type { getSeasonDashboardData } from "@/lib/repositories/kbo/view-models";
import { cn } from "@/lib/utils/cn";
import {
  describeRecentForm,
  describeScheduleDifficulty,
  formatDateTimeLabel,
  formatPercent,
} from "@/lib/utils/format";
import { resolveDistinctTeamColors } from "@/lib/utils/team-colors";
import { buildGameRoute } from "@/lib/utils/routes";
import { getKboDateKey } from "@/lib/scheduler/kbo/windows";

type SeasonDashboardProps = {
  year: number;
  data: NonNullable<Awaited<ReturnType<typeof getSeasonDashboardData>>>;
};

type TodayChangeCard = SeasonDashboardProps["data"]["todayChangeCards"]["positive"][number];

function formatOutcomeLabel(outcome: RecordOutcome): "승" | "패" | "무" {
  switch (outcome) {
    case "W":
      return "승";
    case "L":
      return "패";
    case "T":
    default:
      return "무";
  }
}

function buildOutcomeSlots(outcomes: RecordOutcome[]): Array<RecordOutcome | null> {
  const recentOutcomes = outcomes.slice(-10);
  const emptySlotCount = Math.max(0, 10 - recentOutcomes.length);
  return [
    ...Array.from({ length: emptySlotCount }, () => null),
    ...recentOutcomes,
  ];
}

function outcomeChipClassName(outcome: RecordOutcome): string {
  switch (outcome) {
    case "W":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "L":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "T":
    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
}

function rankMovementToneClassName(averageRank: number, currentRank: number): string {
  if (averageRank < currentRank - 0.15) {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  if (averageRank > currentRank + 0.15) {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  return "border-slate-200 bg-slate-100 text-slate-700";
}

function rankMovementLabel(averageRank: number, currentRank: number): string {
  if (averageRank < currentRank - 0.15) {
    return "상승 가능성";
  }
  if (averageRank > currentRank + 0.15) {
    return "하락 가능성";
  }
  return "혼전 구간";
}

function scheduleDifficultyCardClassName(tone: "positive" | "neutral" | "negative"): string {
  if (tone === "positive") {
    return "border-emerald-200 bg-emerald-50";
  }
  if (tone === "negative") {
    return "border-orange-200 bg-orange-50";
  }
  return "border-line/80 bg-slate-50";
}

function compactMetricTileClassName(tone: "positive" | "neutral" | "negative"): string {
  if (tone === "positive") {
    return "border-emerald-200 bg-emerald-50";
  }
  if (tone === "negative") {
    return "border-orange-200 bg-orange-50";
  }
  return "border-line/80 bg-slate-50";
}

function scheduleDifficultyStarClassName(tone: "positive" | "neutral" | "negative"): string {
  if (tone === "positive") {
    return "text-emerald-500";
  }
  if (tone === "negative") {
    return "text-orange-500";
  }
  return "text-slate-500";
}

function StarGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
      className={cn("h-3.5 w-3.5 sm:h-4 sm:w-4", className)}
    >
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.176 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81H7.03a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}

function RatingStars({
  score,
  tone,
}: {
  score: number;
  tone: "positive" | "neutral" | "negative";
}) {
  const stars = score / 2;

  return (
    <div className="flex items-center gap-0.5" aria-label={`별점 ${stars.toFixed(1)} / 5`}>
      {Array.from({ length: 5 }, (_, index) => {
        const fill = Math.max(0, Math.min(1, stars - index));
        return (
          <span key={index} className="relative inline-flex h-3.5 w-3.5 sm:h-4 sm:w-4">
            <StarGlyph className="absolute inset-0 text-slate-200" />
            <span
              className="absolute inset-y-0 left-0 overflow-hidden"
              style={{ width: `${fill * 100}%` }}
            >
              <StarGlyph className={scheduleDifficultyStarClassName(tone)} />
            </span>
          </span>
        );
      })}
    </div>
  );
}

function CompactMetricTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "positive" | "neutral" | "negative";
}) {
  return (
    <div className={cn("rounded-[18px] border px-3 py-2.5", compactMetricTileClassName(tone))}>
      <p className="text-[11px] font-medium text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold leading-tight text-ink">{value}</p>
    </div>
  );
}

function ScheduleDifficultyCard({
  teamName,
  label,
  score,
  tone,
}: {
  teamName: string;
  label: string;
  score: number;
  tone: "positive" | "neutral" | "negative";
}) {
  return (
    <div className={cn("rounded-[18px] border px-3 py-2.5", scheduleDifficultyCardClassName(tone))}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-ink">{teamName}</p>
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
            tone === "positive" && "border-emerald-200 bg-white text-emerald-800",
            tone === "negative" && "border-orange-200 bg-white text-orange-800",
            tone === "neutral" && "border-line/80 bg-white text-slate-700",
          )}
        >
          {label}
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <p className="text-lg font-semibold tracking-tight text-ink sm:text-xl">
          {score.toFixed(1)}
          <span className="text-sm font-medium text-muted">/10</span>
        </p>
        <RatingStars score={score} tone={tone} />
      </div>
    </div>
  );
}

function TodayChangeTrendColumn({
  title,
  description,
  tone,
  cards,
  data,
}: {
  title: string;
  description: string;
  tone: "positive" | "negative";
  cards: TodayChangeCard[];
  data: SeasonDashboardProps["data"];
}) {
  return (
    <div
      className={cn(
        "rounded-[26px] border p-3.5 sm:p-4",
        tone === "positive"
          ? "border-emerald-100 bg-emerald-50/60"
          : "border-rose-100 bg-rose-50/60",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink sm:text-base">{title}</p>
          <p
            className={cn(
              "mt-0.5 text-xs sm:text-sm",
              tone === "positive" ? "text-emerald-900/75" : "text-rose-900/75",
            )}
          >
            {description}
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-2.5">
        {cards.map((card) => {
          const display = data.displayById[card.seasonTeamId];
          const strength = data.teamStrengthById[card.seasonTeamId];
          const recentForm = describeRecentForm(strength.recentFormAdjustment);
          const outcomeSlots = buildOutcomeSlots(card.recentOutcomes);

          return (
            <div
              key={card.seasonTeamId}
              className="rounded-[20px] border border-white/80 bg-white/90 px-3.5 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.76)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink">{display.shortNameKo}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs font-medium">
                    <span className="metric-chip bg-slate-100 text-ink">
                      최근 10경기 {card.recent10Label}
                    </span>
                    <span className="metric-chip bg-white text-ink">
                      연속 {card.streakLabel}
                    </span>
                  </div>
                </div>
                <RecentFormBadge summary={recentForm} className="gap-1.5 bg-white/80 px-2.5 py-1" />
              </div>

              <div className="mt-3 rounded-xl border border-line/70 bg-slate-50/90 px-2.5 py-2.5">
                {card.recentOutcomes.length > 0 ? (
                  <div className="grid grid-cols-5 gap-1.5">
                    {outcomeSlots.map((outcome, index) => (
                      <span
                        key={`${card.seasonTeamId}-${card.trend}-${index}`}
                        className={cn(
                          "flex h-7 min-w-0 items-center justify-center rounded-full border px-2 text-[11px] font-semibold",
                          outcome
                            ? outcomeChipClassName(outcome)
                            : "border-dashed border-slate-200/80 bg-white/70 text-transparent",
                        )}
                      >
                        {outcome ? formatOutcomeLabel(outcome) : "·"}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-muted">
                    최근 완료 경기 데이터가 아직 충분하지 않습니다.
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SeasonDashboard({ year, data }: SeasonDashboardProps) {
  const scheduleDifficultyValues = data.simulation.teamStrengths.map(
    (team) => team.scheduleDifficulty,
  );
  const remainingGamesCountByTeam = data.games.reduce<Record<string, number>>(
    (counts, game) => {
      if (game.status === "final") {
        return counts;
      }

      counts[game.homeSeasonTeamId] = (counts[game.homeSeasonTeamId] ?? 0) + 1;
      counts[game.awaySeasonTeamId] = (counts[game.awaySeasonTeamId] ?? 0) + 1;
      return counts;
    },
    {},
  );
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
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title={data.season.label}
        compact
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href={`/season/${year}/race`} className="rounded-full bg-accent px-3.5 py-1.5 text-sm font-medium text-white">
              순위전망
            </Link>
            <Link href={`/season/${year}/scenario`} className="rounded-full border border-line/80 bg-white px-3.5 py-1.5 text-sm font-medium text-ink">
              경우의 수
            </Link>
          </div>
        }
      />

      <SectionCard title="오늘 경기 승리 예측" compact>
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

      <SectionCard title="현재 순위" compact>
        <DashboardStandingsBoard year={year} rows={data.standings.rows} />
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.9fr]">
        <SectionCard
          title="판세 변화"
          subtitle="왼쪽 위에서 오른쪽 아래로 갈수록 더 최근 경기입니다."
          compact
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <TodayChangeTrendColumn
              title="좋은 흐름"
              description="최근 폼이 가장 좋은 2팀"
              tone="positive"
              cards={data.todayChangeCards.positive}
              data={data}
            />
            <TodayChangeTrendColumn
              title="안 좋은 흐름"
              description="최근 폼이 가장 낮은 2팀"
              tone="negative"
              cards={data.todayChangeCards.negative}
              data={data}
            />
          </div>
        </SectionCard>

        <SectionCard
          title="2주 내 초박빙 매치업"
          subtitle="서로 다른 팀 조합 기준으로 향후 2주 안의 박빙 경기 3개입니다."
          compact
        >
          {data.closeGames.length > 0 ? (
            <div className="space-y-2.5">
              {data.closeGames.map((item) => {
                const away = data.displayById[item.awaySeasonTeamId];
                const home = data.displayById[item.homeSeasonTeamId];

                if (!away || !home) {
                  return null;
                }

                const { leftColor: awayBarColor, rightColor: homeBarColor } = resolveDistinctTeamColors(away, home);

                return (
                  <Link
                    key={item.gameId}
                    href={buildGameRoute(item.gameId)}
                    className="block overflow-hidden rounded-[22px] border border-line/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(241,245,249,0.92))] px-3.5 py-3.5 shadow-panel transition hover:-translate-y-0.5 hover:border-accent/35 sm:rounded-[24px]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="metric-chip bg-slate-100 text-ink">
                        {formatDateTimeLabel(item.scheduledAt)}
                      </span>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <span className="metric-chip bg-accent-soft text-accent">
                          승률 차 {(item.probabilityGap * 100).toFixed(1)}%p
                        </span>
                        {item.tieProb > 0.001 ? (
                          <span className="metric-chip bg-white text-muted">
                            무 {formatPercent(item.tieProb)}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <p className="mt-3 text-sm font-semibold text-ink">{item.label}</p>

                    <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2.5 sm:gap-3">
                      <div className="text-left">
                        <p className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
                          {formatPercent(item.awayShare)}
                        </p>
                        <div className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-ink">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: awayBarColor }} />
                          <span>{away.shortNameKo}</span>
                        </div>
                      </div>
                      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                        VS
                      </span>
                      <div className="text-right">
                        <p className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
                          {formatPercent(item.homeShare)}
                        </p>
                        <div className="mt-0.5 flex items-center justify-end gap-1.5 text-sm font-semibold text-ink">
                          <span>{home.shortNameKo}</span>
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: homeBarColor }} />
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 overflow-hidden rounded-full bg-slate-200/80">
                      <div className="flex h-3 w-full">
                        <div
                          className="transition-[width]"
                          style={{
                            width: `${item.awayShare * 100}%`,
                            backgroundColor: awayBarColor,
                          }}
                        />
                        <div
                          className="transition-[width]"
                          style={{
                            width: `${item.homeShare * 100}%`,
                            backgroundColor: homeBarColor,
                          }}
                        />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <EmptyStateNote message="향후 2주 안에 박빙 매치업 후보가 없습니다." />
          )}
        </SectionCard>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <SectionCard
          title="변동성 큰 팀"
          subtitle="향후 2주 안에 현재 순위에서 가장 크게 움직일 가능성이 높은 팀입니다."
          compact
        >
          <div className="space-y-2.5">
            {data.shakeupTeams.map((team) => {
              const display = data.displayById[team.seasonTeamId];
              return (
                <div key={team.seasonTeamId} className="rounded-[18px] border border-line/80 px-3 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2.5">
                    <div>
                      <p className="font-medium text-ink">{display.shortNameKo}</p>
                      <p className="mt-0.5 text-xs text-muted">현재 {team.currentRank}위</p>
                    </div>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
                        rankMovementToneClassName(team.averageRank, team.currentRank),
                      )}
                    >
                      {rankMovementLabel(team.averageRank, team.currentRank)}
                    </span>
                  </div>

                  <div className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
                    <CompactMetricTile
                      label="순위변동 확률"
                      value={formatPercent(team.moveProb)}
                      tone="positive"
                    />
                    <CompactMetricTile
                      label="2계단 이상 변동"
                      value={formatPercent(team.bigMoveProb)}
                      tone="negative"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard title="남은 일정 난이도" compact>
          <div className="grid gap-2.5">
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">상대적으로 편한 편</p>
              <div className="space-y-2">
                {easySchedule.map((team) => {
                  const summary = describeScheduleDifficulty(
                    team.scheduleDifficulty,
                    scheduleDifficultyValues,
                    remainingGamesCountByTeam[team.seasonTeamId] ?? 0,
                  );
                  return (
                    <ScheduleDifficultyCard
                      key={team.seasonTeamId}
                      teamName={data.displayById[team.seasonTeamId].shortNameKo}
                      label={summary.label}
                      score={summary.score}
                      tone={summary.tone}
                    />
                  );
                })}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">상대적으로 어려운 편</p>
              <div className="space-y-2">
                {hardSchedule.map((team) => {
                  const summary = describeScheduleDifficulty(
                    team.scheduleDifficulty,
                    scheduleDifficultyValues,
                    remainingGamesCountByTeam[team.seasonTeamId] ?? 0,
                  );
                  return (
                    <ScheduleDifficultyCard
                      key={team.seasonTeamId}
                      teamName={data.displayById[team.seasonTeamId].shortNameKo}
                      label={summary.label}
                      score={summary.score}
                      tone={summary.tone}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="동률/결정전"
          subtitle="시뮬레이션 기준으로 1위와 5위 선상 동률 가능성을 살펴봅니다."
          compact
        >
          <div className="space-y-2.5">
            {data.simulation.tieAlerts.length > 0 ? (
              data.simulation.tieAlerts.map((alert) => (
                <div key={`${alert.positions.join("-")}-${alert.seasonTeamIds.join("-")}`} className="rounded-[18px] border border-orange-200 bg-orange-50 px-3 py-3">
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
              <div className="rounded-[18px] border border-line/80 bg-slate-50 px-3 py-3 text-sm text-muted">
                아직은 남은 경기가 많아 1위·5위 선상 동률 가능성이 또렷하지 않습니다.
                시즌이 더 진행되면 이 구간이 자연스럽게 보일 수 있습니다.
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="최종 순위 분포" compact>
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
