import Link from "next/link";

import { EmptyStateNote } from "@/components/shared/empty-state-note";
import { MetricBadge } from "@/components/shared/metric-badge";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { TeamConditionAutoRefresh } from "@/components/team/team-condition-auto-refresh";
import { TeamConditionRadar } from "@/components/team/team-condition-radar";
import { type getTeamConditionPageData } from "@/lib/team/team-condition-data";
import { formatDateTimeLabel, formatPercent } from "@/lib/utils/format";
import {
  buildPlayerRoute,
  buildScenarioRoute,
  buildSeasonTeamRoute,
} from "@/lib/utils/routes";

type TeamConditionViewProps = {
  year: number;
  teamSlug: string;
  data: NonNullable<Awaited<ReturnType<typeof getTeamConditionPageData>>>;
};

function scoreBadgeClass(percentile: number | undefined, score: number) {
  const basis = percentile ?? score;
  if (basis >= 80) {
    return "bg-emerald-100 text-emerald-700";
  }
  if (basis >= 60) {
    return "bg-sky-100 text-sky-700";
  }
  if (basis >= 40) {
    return "bg-amber-100 text-amber-700";
  }
  return "bg-rose-100 text-rose-700";
}

function toneBadgeClass(tone: "positive" | "neutral" | "negative") {
  if (tone === "positive") {
    return "bg-emerald-100 text-emerald-700";
  }
  if (tone === "negative") {
    return "bg-rose-100 text-rose-700";
  }
  return "bg-amber-100 text-amber-700";
}

function distributionCaption(percentile: number, note?: string | null) {
  return note ?? `현재 10팀 분포 기준 백분위 ${percentile}`;
}

function reasonChips(why: string) {
  return why
    .split("·")
    .map((part) => part.trim())
    .filter(Boolean);
}

function compactGameLineOne(data: TeamConditionViewProps["data"], teamWinProb: number | null) {
  const parts = [
    `${data.opponent.displayNameKo}전`,
    data.focusGame.homeAwayLabel,
    formatDateTimeLabel(data.focusGame.scheduledAt),
    data.focusGame.venueName,
  ];
  if (teamWinProb !== null) {
    parts.push(`승리 기대치 ${formatPercent(teamWinProb)}`);
  }
  return parts.join(" · ");
}

function compactGameLineTwo(data: TeamConditionViewProps["data"]) {
  const weatherLabel = data.focusGame.weather
    ? `${data.focusGame.weather.summary} ${data.focusGame.weather.tempLabel}`
    : "날씨 수집 중";
  const cancellationLabel = data.focusGame.weather
    ? `취소 ${data.focusGame.weather.cancellationRiskLabel}`
    : "취소 계산 대기";

  return [
    `상대전적 ${data.focusGame.headToHeadLabel}`,
    weatherLabel,
    cancellationLabel,
  ].join(" · ");
}

function renderStrengthSummaryCard(
  snapshot: TeamConditionViewProps["data"]["strengthOverview"]["team"],
  emphasized: boolean,
  opponentScore: number,
) {
  const strongestMetric = [...snapshot.metrics].sort((left, right) => right.score - left.score)[0] ?? null;
  const weakestMetric = [...snapshot.metrics].sort((left, right) => left.score - right.score)[0] ?? null;
  const scoreGap = snapshot.overallScore - opponentScore;
  return (
    <div
      className={
        emphasized
          ? "rounded-[24px] border border-line/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(241,245,249,0.9))] px-3 py-4 shadow-panel sm:rounded-[28px] sm:px-5 sm:py-5"
          : "rounded-[24px] border border-line/80 bg-white px-3 py-4 shadow-panel sm:rounded-[28px] sm:px-5 sm:py-5"
      }
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted sm:text-xs">
        {snapshot.team.shortCode} 오늘 전력
      </p>
      <div className="mt-2 flex flex-col items-start gap-2 sm:mt-4 sm:flex-row sm:items-end sm:gap-3">
        <span className="text-3xl font-semibold tracking-tight text-ink sm:text-5xl">{snapshot.overallScore}</span>
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold sm:px-3 sm:text-xs ${scoreBadgeClass(snapshot.percentile, snapshot.overallScore)}`}>
          {snapshot.statusLabel}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-muted sm:mt-2 sm:text-xs">
        {scoreGap === 0 ? "상대 팀과 같은 총점입니다." : `상대 팀 대비 ${scoreGap > 0 ? "+" : ""}${scoreGap}점`}
      </p>
      <p className="mt-1 hidden text-xs text-muted sm:block">{distributionCaption(snapshot.percentile, snapshot.distributionNote)}</p>
      <p className="mt-3 hidden text-sm text-muted sm:block">{snapshot.summary}</p>
      <div className="mt-3 flex flex-col items-start gap-2 sm:mt-5 sm:flex-row sm:flex-wrap">
        {strongestMetric ? (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-medium text-ink sm:px-3 sm:text-xs">
            강점 {strongestMetric.label} {strongestMetric.score}
          </span>
        ) : null}
        {weakestMetric && weakestMetric.key !== strongestMetric?.key ? (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-medium text-ink sm:px-3 sm:text-xs">
            변수 {weakestMetric.label} {weakestMetric.score}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function renderStarterCard(
  starter: TeamConditionViewProps["data"]["starterMatchup"]["teamStarter"],
  isHomeTeam: boolean,
) {
  if (!starter.announced) {
    return (
      <div className="rounded-[28px] border border-line/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(241,245,249,0.9))] px-5 py-5 shadow-panel">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">
              {isHomeTeam ? "홈 선발" : "원정 선발"}
            </p>
            <p className="mt-1 text-xl font-semibold text-ink">예상 선발 미확정</p>
            <p className="mt-1 text-sm text-muted">선발 발표 전이라 컨디션은 임시 50점으로 반영했습니다.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-muted">
            발표 대기
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-line/80 px-4 py-4">
            <p className="text-xs text-muted">계산 반영 상태</p>
            <p className="mt-2 text-base font-semibold text-ink">임시 중립값 50</p>
          </div>
          <div className="rounded-2xl border border-line/80 px-4 py-4">
            <p className="text-xs text-muted">변동 가능성</p>
            <p className="mt-2 text-base font-semibold text-ink">발표 후 총점이 바뀔 수 있습니다</p>
          </div>
        </div>

        <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-muted">{starter.note}</p>
      </div>
    );
  }

  return (
    <div className="rounded-[28px] border border-line/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(241,245,249,0.9))] px-5 py-5 shadow-panel">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-full text-2xl font-semibold text-white"
            style={{ backgroundColor: starter.team.primaryColor }}
          >
            {starter.playerName.slice(0, 1)}
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">
              {isHomeTeam ? "홈 선발" : "원정 선발"}
            </p>
            <p className="mt-1 text-xl font-semibold text-ink">{starter.playerName}</p>
            <p className="mt-1 text-sm text-muted">
              {starter.handLabel} · {starter.profileLabel}
            </p>
          </div>
        </div>
        {starter.playerId ? (
          <Link
            href={buildPlayerRoute(starter.playerId)}
            className="rounded-full border border-line/80 bg-white px-3 py-1.5 text-xs font-medium text-ink"
          >
            선수 페이지
          </Link>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <MetricBadge label="승-패" value={starter.seasonRecordLabel} />
        <MetricBadge label="ERA" value={starter.eraLabel} />
        <MetricBadge label="이닝" value={starter.inningsLabel} />
      </div>

      <div className="mt-4 space-y-2 text-sm text-muted">
        <div className="flex items-center justify-between rounded-2xl border border-line/80 px-4 py-3">
          <span>상대 전적</span>
          <span className="font-medium text-ink">{starter.versusOpponentLabel}</span>
        </div>
        <div className="flex items-center justify-between rounded-2xl border border-line/80 px-4 py-3">
          <span>최근 3경기 페이스</span>
          <span className="text-right font-medium text-ink">{starter.recentFormLabel}</span>
        </div>
      </div>

      <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-muted">{starter.note}</p>
    </div>
  );
}

function renderBullpenPanel(
  panel: TeamConditionViewProps["data"]["bullpenComparison"]["team"],
) {
  return (
    <div className="rounded-[28px] border border-line/80 bg-white px-5 py-5 shadow-panel">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-ink">{panel.team.displayNameKo}</p>
          <p className="mt-1 text-sm text-muted">오늘 바로 쓸 수 있는 불펜 가용성과 엔트리 변동을 함께 봅니다.</p>
        </div>
        <span
          className="rounded-full px-3 py-1 text-xs font-semibold text-white"
          style={{ backgroundColor: panel.team.primaryColor }}
        >
          {panel.team.shortCode}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <MetricBadge label="불펜 ERA" value={panel.bullpenEraLabel} />
        <MetricBadge label="필승조 가용성" value={panel.anchorAvailabilityLabel} />
        <MetricBadge label="최근 소모" value={panel.recentLoadLabel} />
      </div>

      <div className="mt-4 rounded-2xl border border-line/80 bg-slate-50 px-4 py-3 text-sm text-muted">
        {panel.recentLoadNote}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="text-sm font-semibold text-ink">핵심 계투</p>
          <div className="mt-3 space-y-2">
            {panel.anchors.length > 0 ? (
              panel.anchors.map((anchor) => (
                <div key={anchor.playerId} className="rounded-2xl border border-line/80 px-4 py-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link href={buildPlayerRoute(anchor.playerId)} className="font-medium text-ink hover:text-accent">
                        {anchor.playerName}
                      </Link>
                      <p className="mt-1 text-muted">{anchor.roleLabel}</p>
                    </div>
                    <p className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${toneBadgeClass(anchor.availabilityTone)}`}>
                      {anchor.availabilityLabel}
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-ink">{anchor.eraLabel}</span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-ink">{anchor.leverageLabel}</span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-ink">{anchor.recentAppearanceLabel}</span>
                  </div>
                </div>
              ))
            ) : (
              <EmptyStateNote message="현재 불펜 핵심 카드로 보여줄 공식 데이터가 아직 부족합니다." />
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-ink">이탈 / 부상자</p>
            <div className="mt-3 space-y-2">
              {panel.unavailablePlayers.length > 0 ? (
                panel.unavailablePlayers.map((item) => (
                  <div key={item.playerId} className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm">
                    <p className="font-medium text-ink">
                      {item.playerName} <span className="text-muted">· {item.positionLabel}</span>
                    </p>
                    <p className="mt-1 text-muted">{item.note}</p>
                  </div>
                ))
              ) : (
                <EmptyStateNote message="주요 이탈자 없음" />
              )}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-ink">최근 복귀 / 등록</p>
            <div className="mt-3 space-y-2">
              {panel.returningPlayers.length > 0 ? (
                panel.returningPlayers.map((item) => (
                  <div key={item.playerId} className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
                    <p className="font-medium text-ink">
                      {item.playerName} <span className="text-muted">· {item.positionLabel}</span>
                    </p>
                    <p className="mt-1 text-muted">{item.note}</p>
                  </div>
                ))
              ) : (
                <EmptyStateNote message="최근 복귀 없음" />
              )}
            </div>
          </div>
        </div>
      </div>

      {panel.summaryNote ? (
        <p className="mt-4 rounded-2xl border border-line/80 bg-slate-50 px-4 py-3 text-sm text-muted">
          {panel.summaryNote}
        </p>
      ) : null}
    </div>
  );
}

export function TeamConditionView({
  year,
  teamSlug,
  data,
}: TeamConditionViewProps) {
  const probability = data.focusGame.probability;
  const isHomeTeam = data.focusGame.homeAwayLabel === "홈";
  const strengthMetrics = data.strengthOverview.team.metrics
    .map((metric) => ({
      teamMetric: metric,
      opponentMetric:
        data.strengthOverview.opponent.metrics.find((item) => item.key === metric.key) ?? metric,
    }))
    .sort(
      (left, right) =>
        Math.abs(right.teamMetric.score - right.opponentMetric.score) -
        Math.abs(left.teamMetric.score - left.opponentMetric.score),
    );
  const teamWinProb =
    probability
      ? isHomeTeam
        ? probability.homeWinProb
        : probability.awayWinProb
      : null;
  const starterPending = !data.starterMatchup.teamStarter.announced || !data.starterMatchup.opponentStarter.announced;
  const weatherPending = !data.focusGame.weather;
  const lineupMetric = data.strengthOverview.team.metrics.find((metric) => metric.key === "lineup");
  const shouldWatchPendingSignals = starterPending || !data.lineupStatus.isConfirmed || weatherPending;

  return (
    <div className="space-y-6">
      <TeamConditionAutoRefresh
        scheduledAt={data.focusGame.scheduledAt}
        watchPendingSignals={shouldWatchPendingSignals}
      />
      <PageHeader
        title={`${year} 팀 컨디션 ${data.team.displayNameKo}`}
        actions={
          <div className="inline-flex rounded-full border border-line/80 bg-white p-1 shadow-sm">
            <Link
              href={buildSeasonTeamRoute(year, teamSlug)}
              className="rounded-full px-4 py-2 text-sm font-medium text-ink"
            >
              팀 상세
            </Link>
            <Link
              href={buildScenarioRoute(year, { mode: "team", teamSlug })}
              className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white"
            >
              경우의 수
            </Link>
          </div>
        }
      />

      <SectionCard
        title="경기 정보"
      >
        <div className="rounded-[28px] border border-line/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(241,245,249,0.9))] px-5 py-4 shadow-panel">
          <p className="text-sm font-semibold text-ink">{compactGameLineOne(data, teamWinProb)}</p>
          <p className="mt-2 text-sm text-muted">{compactGameLineTwo(data)}</p>
        </div>
      </SectionCard>

      <SectionCard
        title="오늘 팀 전력"
        subtitle="양 팀을 같은 기준의 절대 점수로 계산하고, 오각형 레이더 차트로 겹쳐 보여줍니다."
      >
        <div className="grid grid-cols-[minmax(0,0.82fr)_minmax(0,1.06fr)_minmax(0,0.82fr)] gap-2 sm:gap-4">
          {renderStrengthSummaryCard(data.strengthOverview.team, true, data.strengthOverview.opponent.overallScore)}

          <TeamConditionRadar
            teamLabel={data.team.shortNameKo}
            teamColor={data.team.primaryColor}
            teamSecondaryColor={data.team.secondaryColor}
            teamMetrics={data.strengthOverview.team.metrics}
            teamOverallScore={data.strengthOverview.team.overallScore}
            opponentLabel={data.opponent.shortNameKo}
            opponentColor={data.opponent.primaryColor}
            opponentSecondaryColor={data.opponent.secondaryColor}
            opponentMetrics={data.strengthOverview.opponent.metrics}
            opponentOverallScore={data.strengthOverview.opponent.overallScore}
          />

          {renderStrengthSummaryCard(data.strengthOverview.opponent, false, data.strengthOverview.team.overallScore)}
        </div>

        <details className="group mt-4 rounded-[28px] border border-line/80 bg-white shadow-panel">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
            <div>
              <p className="text-base font-semibold text-ink">축별 상세 비교</p>
              <p className="mt-1 text-sm text-muted">
                각 축의 절대 점수와 근거를 펼쳐서 보고, 기준선 50도 함께 확인합니다.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-muted">
                5개 지표
              </span>
              <span className="text-lg text-muted transition-transform group-open:rotate-180">
                ▾
              </span>
            </div>
          </summary>

          <div className="border-t border-line/80 px-5 py-5">
            <div className="grid gap-4 xl:grid-cols-2">
              {strengthMetrics.map(({ teamMetric, opponentMetric }, index) => (
                <div
                  key={teamMetric.key}
                  className={`rounded-[28px] border border-line/80 bg-white px-5 py-5 shadow-panel ${
                    strengthMetrics.length % 2 === 1 && index === strengthMetrics.length - 1 ? "xl:col-span-2" : ""
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-ink">{teamMetric.label}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {reasonChips(teamMetric.why).map((chip) => (
                          <span key={`team-${teamMetric.key}-${chip}`} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-ink">
                            {chip}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-semibold">
                      <span className={`rounded-full px-3 py-1 ${scoreBadgeClass(teamMetric.percentile, teamMetric.score)}`}>
                        {data.team.shortCode} {teamMetric.score}
                      </span>
                      <span className={`rounded-full px-3 py-1 ${scoreBadgeClass(opponentMetric.percentile, opponentMetric.score)}`}>
                        {data.opponent.shortCode} {opponentMetric.score}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div>
                      <div className="flex items-center justify-between text-xs text-muted">
                        <span>{data.team.displayNameKo}</span>
                        <span className="font-semibold text-ink">{teamMetric.score}</span>
                      </div>
                      <div className="relative mt-2 h-2.5 rounded-full bg-slate-100">
                        <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-slate-300" />
                        <div
                          className="relative h-2.5 rounded-full"
                          style={{ width: `${teamMetric.score}%`, backgroundColor: data.team.primaryColor }}
                        />
                      </div>
                      <p className="mt-2 text-xs text-muted">
                        절대 점수 {teamMetric.score} · {distributionCaption(teamMetric.percentile, teamMetric.distributionNote)}
                      </p>
                      {teamMetric.isProvisional ? (
                        <p className="mt-1 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-muted">
                          임시값 반영
                        </p>
                      ) : null}
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-xs text-muted">
                        <span>{data.opponent.displayNameKo}</span>
                        <span className="font-semibold text-ink">{opponentMetric.score}</span>
                      </div>
                      <div className="relative mt-2 h-2.5 rounded-full bg-slate-100">
                        <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-slate-300" />
                        <div
                          className="relative h-2.5 rounded-full"
                          style={{ width: `${opponentMetric.score}%`, backgroundColor: data.opponent.primaryColor }}
                        />
                      </div>
                      <p className="mt-2 text-xs text-muted">
                        절대 점수 {opponentMetric.score} · {distributionCaption(opponentMetric.percentile, opponentMetric.distributionNote)}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {reasonChips(opponentMetric.why).map((chip) => (
                          <span key={`opponent-${opponentMetric.key}-${chip}`} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-ink">
                            {chip}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </details>
      </SectionCard>

      <SectionCard
        title="오늘의 선발 투수"
        subtitle="경기 승패에 가장 큰 영향을 주는 선발 매치업을 좌우 비교로 봅니다."
      >
        <div className="grid gap-4 xl:grid-cols-2">
          {renderStarterCard(
            isHomeTeam ? data.starterMatchup.teamStarter : data.starterMatchup.opponentStarter,
            true,
          )}
          {renderStarterCard(
            isHomeTeam ? data.starterMatchup.opponentStarter : data.starterMatchup.teamStarter,
            false,
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="불펜 및 부상자"
        subtitle="불펜 소모, 핵심 계투, 이탈/복귀 엔트리를 같이 보게 해서 팀 상세와 다른 경기 전 감각을 만듭니다."
      >
        <div className="grid gap-4 xl:grid-cols-2">
          {renderBullpenPanel(data.bullpenComparison.team)}
          {renderBullpenPanel(data.bullpenComparison.opponent)}
        </div>
      </SectionCard>

      <SectionCard
        title="오늘의 타선과 키플레이어"
        subtitle={data.lineupStatus.detail}
      >
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs text-muted">{data.lineupStatus.isConfirmed ? "확정 타선" : "예상 타선"}</p>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  data.lineupStatus.isConfirmed ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-ink"
                }`}
              >
                {data.lineupStatus.badgeLabel}
              </span>
              {lineupMetric ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-ink">
                  {reasonChips(lineupMetric.why)[0]}
                </span>
              ) : null}
            </div>
            {data.expectedLineup.length > 0 ? (
              <div className="overflow-x-auto rounded-3xl border border-line/80">
                <table className="min-w-[820px] text-sm">
                  <thead className="border-b border-line/80 bg-slate-50 text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-4 py-3 text-right">타순</th>
                      <th className="px-4 py-3 text-left">선수</th>
                      <th className="px-4 py-3 text-left">포지션</th>
                      <th className="px-4 py-3 text-right">AVG</th>
                      <th className="px-4 py-3 text-right">OPS</th>
                      <th className="px-4 py-3 text-right">HR</th>
                      <th className="px-4 py-3 text-right">RBI</th>
                      <th className="px-4 py-3 text-left">오늘 메모</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.expectedLineup.map((item) => (
                      <tr key={`${item.playerId ?? item.playerName}-${item.slot}`} className="border-b border-line/60 last:border-0">
                        <td className="px-4 py-3 text-right font-semibold text-ink">{item.slot}</td>
                        <td className="px-4 py-3 text-left">
                          {item.playerId ? (
                            <Link href={buildPlayerRoute(item.playerId)} className="font-medium text-ink hover:text-accent">
                              {item.playerName}
                            </Link>
                          ) : (
                            <span className="font-medium text-ink">{item.playerName}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-left text-muted">{item.positionLabel}</td>
                        <td className="px-4 py-3 text-right text-muted">{item.battingAverageLabel}</td>
                        <td className="px-4 py-3 text-right text-muted">{item.opsLabel}</td>
                        <td className="px-4 py-3 text-right text-muted">{item.homeRunsLabel}</td>
                        <td className="px-4 py-3 text-right text-muted">{item.rbiLabel}</td>
                        <td className="px-4 py-3 text-left text-muted">{item.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyStateNote message="예상 타선을 만들 최근 타순 패턴 데이터가 아직 부족합니다." />
            )}
          </div>

          <div className="space-y-3">
            <p className="text-xs text-muted">오늘의 타선 키플레이어</p>
            {data.keyPlayers.length > 0 ? (
              data.keyPlayers.map((player) => (
                <div key={player.playerId} className="rounded-3xl border border-line/80 bg-white px-4 py-4 shadow-panel">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <Link href={buildPlayerRoute(player.playerId)} className="text-lg font-semibold text-ink hover:text-accent">
                        {player.playerName}
                      </Link>
                      <p className="mt-1 text-sm text-muted">{player.positionLabel}</p>
                    </div>
                    <span
                      className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white"
                      style={{ backgroundColor: data.team.primaryColor }}
                    >
                      {player.playerName.slice(0, 1)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-muted">{player.reason}</p>
                </div>
              ))
            ) : (
              <EmptyStateNote message="키플레이어를 고를 타자 기록이 아직 충분하지 않습니다." />
            )}
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
