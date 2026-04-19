import Link from "next/link";

import { RankHeatmap } from "@/components/shared/heatmap";
import { MetricBadge } from "@/components/shared/metric-badge";
import { PageHeader } from "@/components/shared/page-header";
import { RecentFormBadge } from "@/components/shared/recent-form-badge";
import { SectionCard } from "@/components/shared/section-card";
import {
  buildDirectRaceOpponents,
  buildRemainingOpponentCounts,
  buildRemainingSchedule,
  buildTeamSplitSummary,
  findSeasonTeamBySlug,
  findTeamStrength,
} from "@/lib/repositories/kbo/view-models";
import type { getSeasonDashboardData } from "@/lib/repositories/kbo/view-models";
import { describeRecentForm, formatDateOnlyLabel, formatPercent } from "@/lib/utils/format";
import {
  buildPlayerRoute,
  buildScenarioRoute,
  buildSeasonTeamConditionRoute,
  buildTeamArchiveRoute,
} from "@/lib/utils/routes";

type TeamSeasonViewProps = {
  year: number;
  teamSlug: string;
  data: NonNullable<Awaited<ReturnType<typeof getSeasonDashboardData>>>;
};

export function TeamSeasonView({ year, teamSlug, data }: TeamSeasonViewProps) {
  const found = findSeasonTeamBySlug(teamSlug, data.seasonTeams, data.teamDisplays);
  if (!found) {
    return null;
  }

  const row = data.standings.rows.find((item) => item.teamSlug === teamSlug)!;
  const strength = findTeamStrength(data.simulation.teamStrengths, found.seasonTeam.seasonTeamId);
  const expected = data.expectedById[found.seasonTeam.seasonTeamId];
  const postseason = data.simulation.postseasonOdds.find((item) => item.seasonTeamId === found.seasonTeam.seasonTeamId)!;
  const seasonStat = data.teamSeasonStats.find((item) => item.seasonTeamId === found.seasonTeam.seasonTeamId)!;
  const remainingSchedule = buildRemainingSchedule(
    found.seasonTeam.seasonTeamId,
    data.series,
    data.games,
    data.displayById,
  );
  const opponentCounts = buildRemainingOpponentCounts(
    found.seasonTeam.seasonTeamId,
    data.games,
    data.displayById,
    {
      regularSeasonGamesPerTeam: data.ruleset.regularSeasonGamesPerTeam,
      seasonTeamIds: data.seasonTeams.map((item) => item.seasonTeamId),
    },
  );
  const directRaceOpponents = buildDirectRaceOpponents(
    found.seasonTeam.seasonTeamId,
    data.standings.rows,
    opponentCounts,
    data.bucketById,
    data.teamStrengthById,
  );
  const splitSummary = buildTeamSplitSummary(
    found.seasonTeam.seasonTeamId,
    data.teamSplitStats,
  );
  const playerStats = data.playerSeasonStats
    .filter((item) => item.seasonTeamId === found.seasonTeam.seasonTeamId)
    .sort((left, right) => {
      const leftScore =
        left.statType === "hitter"
          ? (left.war ?? 0) * 10 + (left.homeRuns ?? 0) * 4 + (left.ops ?? 0) * 10 + (left.hits ?? 0) * 0.2
          : (left.war ?? 0) * 10 + (left.strikeouts ?? 0) * 0.4 + (left.wins ?? 0) * 2 + (left.saves ?? 0) * 2 - (left.era ?? 9);
      const rightScore =
        right.statType === "hitter"
          ? (right.war ?? 0) * 10 + (right.homeRuns ?? 0) * 4 + (right.ops ?? 0) * 10 + (right.hits ?? 0) * 0.2
          : (right.war ?? 0) * 10 + (right.strikeouts ?? 0) * 0.4 + (right.wins ?? 0) * 2 + (right.saves ?? 0) * 2 - (right.era ?? 9);
      return rightScore - leftScore;
    })
    .slice(0, 4);
  const recentGames = data.games
    .filter(
      (game) =>
        game.status === "final" &&
        (game.homeSeasonTeamId === found.seasonTeam.seasonTeamId ||
          game.awaySeasonTeamId === found.seasonTeam.seasonTeamId),
    )
    .sort((left, right) => right.scheduledAt.localeCompare(left.scheduledAt))
    .slice(0, 5);
  const nextSeries = remainingSchedule[0] ?? null;
  const recentForm = strength ? describeRecentForm(strength.recentFormAdjustment) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`${year} 팀 페이지`}
        title={`${found.display.displayNameKo} 시즌 상세`}
        description={`${found.display.displayNameKo}의 현재 성적, 예상 최종 성적, 남은 일정, 직접 경쟁 팀 레버리지, 전력 해석 카드를 한 페이지에 담았습니다.`}
        actions={
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Link
              href={buildScenarioRoute(year, { mode: "team", teamSlug })}
              className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white"
            >
              경우의 수에서 이 팀 보기
            </Link>
            <Link
              href={buildSeasonTeamConditionRoute(year, teamSlug)}
              className="rounded-full border border-line/80 bg-white px-4 py-2 text-sm font-medium text-ink"
            >
              팀 컨디션
            </Link>
            <Link href={buildTeamArchiveRoute(teamSlug)} className="rounded-full border border-line/80 bg-white px-4 py-2 text-sm font-medium text-ink">
              구단 아카이브
            </Link>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <MetricBadge label="현재 성적" value={`${row.wins}-${row.losses}-${row.ties}`} />
        <MetricBadge label="예상 최종 성적" value={`${expected.expectedWins}-${expected.expectedLosses}-${expected.expectedTies}`} />
        <MetricBadge label="포스트시즌 진출" value={formatPercent(1 - (data.bucketById[row.seasonTeamId]?.missPostseason ?? 1))} tone="positive" />
        <MetricBadge label="한국시리즈 진출" value={formatPercent(postseason.ks)} />
        <MetricBadge label="우승 확률" value={formatPercent(postseason.champion)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard title="팀 전력 해석 카드" subtitle="offense / starter / bullpen / recent form / home-away / confidence를 분리했습니다.">
          {strength ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <MetricBadge label="Offense" value={strength.offenseRating.toFixed(1)} tone="positive" />
              <MetricBadge label="Starter" value={strength.starterRating.toFixed(1)} tone="positive" />
              <MetricBadge label="Bullpen" value={strength.bullpenRating.toFixed(1)} />
              <MetricBadge label="최근 폼" value={recentForm?.label ?? "보통"} tone={recentForm?.tone ?? "neutral"} />
              <MetricBadge label="Home / Away" value={`${row.home} / ${row.away}`} />
              <MetricBadge label="Model Confidence" value={formatPercent(strength.confidenceScore)} />
            </div>
          ) : null}
          {strength ? (
            <div className="mt-4 space-y-2">
              {strength.explanationReasons.map((reason) => (
                <div key={reason.key} className="rounded-2xl border border-line/80 bg-slate-50 px-4 py-3 text-sm text-muted">
                  <span className="font-medium text-ink">{reason.label}</span>
                  <p className="mt-1">{reason.sentence}</p>
                </div>
              ))}
            </div>
          ) : null}
        </SectionCard>

        <SectionCard title="팀 기록 요약" subtitle="공식 순위표와 홈/원정 기록에서 바로 읽을 수 있는 현재 누적 지표입니다.">
          <div className="space-y-3 text-sm text-muted">
            <div className="flex flex-col gap-1 rounded-2xl border border-line/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <span>득점 / 실점</span>
              <span className="font-medium text-ink">{seasonStat.runsScored} / {seasonStat.runsAllowed}</span>
            </div>
            <div className="flex flex-col gap-1 rounded-2xl border border-line/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <span>홈 / 원정</span>
              <span className="font-medium text-ink">{row.home} / {row.away}</span>
            </div>
            <div className="flex flex-col gap-1 rounded-2xl border border-line/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <span>최근 10경기</span>
              <span className="font-medium text-ink">{row.recent10}</span>
            </div>
            <div className="flex flex-col gap-1 rounded-2xl border border-line/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <span>연속</span>
              <span className="font-medium text-ink">{row.streak}</span>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard title="직접 경쟁 팀 맞대결" subtitle="순위 간격과 잔여 맞대결 수를 같이 읽습니다.">
          <div className="space-y-3">
            {directRaceOpponents.map((item) => (
              <div key={item.seasonTeamId} className="rounded-2xl border border-line/80 px-4 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-ink">{item.label}</p>
                    <p className="mt-1 text-sm text-muted">
                      현재 {item.rank}위 · 게임차 {item.gamesBackGap > 0 ? "+" : ""}
                      {item.gamesBackGap.toFixed(1)}
                    </p>
                  </div>
                  <span className="metric-chip bg-slate-100 text-ink">남은 {item.remaining}경기</span>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 px-3 py-3 text-sm text-muted">
                    1위 {formatPercent(item.firstOdds)} / PS {formatPercent(item.psOdds)}
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-3 py-3 text-sm text-muted">
                    {item.leverageNote}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="핵심 선수 카드" subtitle="공식 선수 기록이 들어온 범위에서는 현재 시즌 핵심 선수들을 바로 연결합니다.">
          {playerStats.length > 0 ? (
            <div className="space-y-3">
              {playerStats.map((playerStat) => {
                const player = data.players.find((item) => item.playerId === playerStat.playerId);
                return (
                  <Link
                    key={playerStat.statId}
                    href={buildPlayerRoute(playerStat.playerId)}
                    className="block rounded-2xl border border-line/80 px-4 py-4 hover:border-accent"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium text-ink">{player?.nameKo ?? playerStat.playerId}</p>
                        <p className="mt-1 text-sm text-muted">{playerStat.statType === "hitter" ? "타자" : "투수"}</p>
                      </div>
                      <p className="text-sm text-muted sm:text-right">
                        {playerStat.statType === "hitter"
                          ? `OPS ${playerStat.ops?.toFixed(3) ?? "-"} · HR ${playerStat.homeRuns ?? 0}`
                          : `ERA ${playerStat.era?.toFixed(2) ?? "-"} · SO ${playerStat.strikeouts ?? 0}`}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-line/80 bg-slate-50 px-4 py-4 text-sm text-muted">
              아직 공식 선수 요약 기록이 연결되지 않은 팀은 핵심 선수 카드가 비어 있을 수 있습니다.
            </div>
          )}
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <SectionCard title="최근 경기 / 다음 시리즈" subtitle="최근 5경기와 다음 일정의 연속성을 확인합니다.">
          <div className="space-y-3">
            {nextSeries ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
                <p className="text-xs text-muted">다음 시리즈</p>
                <p className="mt-2 font-medium text-ink">
                  {nextSeries.isHome ? "홈" : "원정"} · {nextSeries.opponent.shortNameKo}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {nextSeries.series.startDate} ~ {nextSeries.series.endDate} · 남은 {nextSeries.remainingGames}경기
                </p>
              </div>
            ) : null}
            {recentGames.map((game) => {
              const opponentId =
                game.homeSeasonTeamId === found.seasonTeam.seasonTeamId
                  ? game.awaySeasonTeamId
                  : game.homeSeasonTeamId;
              const result =
                game.isTie || game.homeScore === game.awayScore
                  ? "무"
                  : (game.homeSeasonTeamId === found.seasonTeam.seasonTeamId
                      ? (game.homeScore ?? 0) > (game.awayScore ?? 0)
                      : (game.awayScore ?? 0) > (game.homeScore ?? 0))
                    ? "승"
                    : "패";
              return (
                <div key={game.gameId} className="rounded-2xl border border-line/80 px-4 py-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="font-medium text-ink">{data.displayById[opponentId].shortNameKo}</p>
                    <p className="text-sm text-muted sm:text-right">
                      {result} · {game.homeScore} : {game.awayScore}
                    </p>
                  </div>
                  <p className="mt-2 text-sm text-muted">{formatDateOnlyLabel(game.scheduledAt)}</p>
                </div>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard title="홈/원정 및 분할 기록" subtitle="기록실보다 팀 맥락에 맞게 핵심 split만 요약합니다.">
          <div className="space-y-2">
            {splitSummary.map((split) => (
              <div key={split.splitId} className="flex flex-col gap-1 rounded-2xl border border-line/80 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span className="font-medium text-ink">{split.metricLabel}</span>
                <span className="text-muted">{split.metricValue}</span>
              </div>
            ))}
            {strength ? (
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-line/80 bg-slate-50 px-4 py-4 text-sm text-muted">
                <RecentFormBadge
                  summary={recentForm ?? { label: "보통", variant: "neutral", tone: "neutral" }}
                />
                <span className="metric-chip bg-white text-ink">
                  맞대결 레버리지 {strength.headToHeadLeverage.toFixed(2)}
                </span>
              </div>
            ) : null}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <SectionCard title="남은 일정 표" subtitle="시리즈 단위로 남은 일정을 봅니다.">
          <div className="space-y-3">
            {remainingSchedule.map((item) => (
              <div key={item.series.seriesId} className="rounded-2xl border border-line/80 px-4 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-ink">
                      {item.isHome ? "홈" : "원정"} · {item.opponent.shortNameKo}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {item.series.startDate} ~ {item.series.endDate}
                    </p>
                    <p className="mt-2 text-xs text-muted">
                      상대 1위 {formatPercent(data.bucketById[item.opponent.seasonTeamId]?.first ?? 0)} ·
                      PS {formatPercent(1 - (data.bucketById[item.opponent.seasonTeamId]?.missPostseason ?? 1))}
                    </p>
                  </div>
                  <span className="metric-chip bg-accent-soft text-accent">남은 {item.remainingGames}경기</span>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="상대별 남은 경기 수" subtitle="직접 경쟁 팀 맞대결을 빠르게 확인할 수 있습니다.">
          <div className="space-y-2">
            {opponentCounts.map((item) => (
              <div key={item.seasonTeamId} className="flex flex-col gap-1 rounded-2xl border border-line/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="font-medium text-ink">{item.label}</span>
                <span className="text-sm text-muted">{item.remaining}경기</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="팀별 최종 순위 분포 카드" subtitle="해당 팀의 전체 rank distribution을 길게 확인합니다.">
        <RankHeatmap
          rows={[
            {
              label: found.display.shortNameKo,
              values: data.rankDistById[found.seasonTeam.seasonTeamId].probabilities,
              accent: found.display.primaryColor,
            },
          ]}
        />
      </SectionCard>
    </div>
  );
}
