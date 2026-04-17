import Link from "next/link";

import { EmptyStateNote } from "@/components/shared/empty-state-note";
import { MetricBadge } from "@/components/shared/metric-badge";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import type { getPlayerPageData } from "@/lib/repositories/kbo/view-models";
import { formatDateLabel } from "@/lib/utils/format";
import { buildGameRoute } from "@/lib/utils/routes";

type PlayerDetailViewProps = {
  data: NonNullable<Awaited<ReturnType<typeof getPlayerPageData>>>;
};

export function PlayerDetailView({ data }: PlayerDetailViewProps) {
  const latestStat = data.statsBySeason[0] ?? null;
  const currentSeasonFocus = data.currentSeasonFocus;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="선수 상세"
        title={data.player.nameKo}
        description="기본 프로필, 시즌 기록, 월별 흐름, 경기 로그와 로스터 이벤트를 한 화면에 묶어 선수 페이지가 현재 시즌의 맥락을 자연스럽게 설명하도록 구성했습니다."
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <MetricBadge label="주 포지션" value={data.player.primaryPositions.join(", ")} />
        <MetricBadge label="투타" value={data.player.batsThrows ?? "-"} />
        <MetricBadge label="데뷔" value={String(data.player.debutYear)} />
        <MetricBadge label="통산 WAR" value={data.careerSummary.totalWar.toFixed(1)} />
      </div>

      <SectionCard
        title="현재 시즌 포지션"
        subtitle="현재 공식 선수 기록을 기준으로 팀 내/리그 내에서 어느 정도 위치인지 바로 읽을 수 있게 정리했습니다."
      >
        {currentSeasonFocus ? (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <MetricBadge label="최근 시즌" value={`${currentSeasonFocus.seasonLabel} · ${currentSeasonFocus.teamLabel}`} />
              <MetricBadge label="기록 유형" value={currentSeasonFocus.statType === "hitter" ? "타자" : "투수"} />
              <MetricBadge label="경기 수" value={String(currentSeasonFocus.games)} />
            </div>
            <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
              {currentSeasonFocus.rankingMetrics.map((metric) => (
                <div key={metric.key} className="rounded-2xl border border-line/80 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">{metric.label}</p>
                  <p className="mt-2 text-2xl font-semibold text-ink">{metric.valueLabel}</p>
                  <p className="mt-2 text-sm text-muted">리그 {metric.leagueRank}위 / {metric.leagueTotal}명</p>
                  <p className="text-sm text-muted">팀 내 {metric.teamRank}위 / {metric.teamTotal}명</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <EmptyStateNote message="아직 공식 선수 시즌 기록이 연결되지 않아 현재 시즌 포지션을 계산하지 못했습니다." />
        )}
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <SectionCard title="기본 프로필" subtitle="아카이브 확장을 고려한 player identity 영역입니다.">
          <div className="space-y-3 text-sm text-muted">
            <div className="rounded-2xl border border-line/80 px-4 py-3">생년월일: {data.player.birthDate ?? "-"}</div>
            <div className="rounded-2xl border border-line/80 px-4 py-3">프랜차이즈: {data.franchiseLabels.join(", ")}</div>
            <div className="rounded-2xl border border-line/80 px-4 py-3">
              최근 시즌: {latestStat ? `${latestStat.seasonLabel} · ${latestStat.teamLabel}` : "-"}
            </div>
            <div className="rounded-2xl border border-line/80 bg-slate-50 px-4 py-4">{data.player.bio}</div>
          </div>
        </SectionCard>

        <SectionCard title="시즌 기록 / 통산 요약" subtitle="season stat row를 기반으로 통산 합산을 같이 봅니다.">
          {data.statsBySeason.length ? (
            <>
              <div className="grid gap-3 md:grid-cols-3">
                <MetricBadge label="시즌 수" value={String(data.careerSummary.seasons)} />
                <MetricBadge label="통산 홈런" value={String(data.careerSummary.homeRuns)} />
                <MetricBadge label="통산 탈삼진" value={String(data.careerSummary.strikeouts)} />
              </div>
              <div className="mt-4 space-y-3">
                {data.statsBySeason.map((stat) => (
                  <div key={stat.statId} className="rounded-2xl border border-line/80 px-4 py-4">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <p className="font-medium text-ink">{stat.seasonLabel}</p>
                      <p className="text-sm text-muted">{stat.teamLabel}</p>
                    </div>
                    <p className="mt-2 text-sm text-muted">
                      {stat.statType === "hitter"
                        ? `경기 ${stat.games} · OPS ${stat.ops?.toFixed(3)} · HR ${stat.homeRuns} · WAR ${stat.war}`
                        : `경기 ${stat.games} · ERA ${stat.era?.toFixed(2)} · SO ${stat.strikeouts} · WAR ${stat.war}`}
                    </p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyStateNote message="공식 선수 기록 ingest 전까지는 기본 프로필과 엔트리 변동만 보여 줍니다." />
          )}
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <SectionCard title="월별 흐름" subtitle="공식 선수 Splits MONTH 페이지를 기준으로 월별 페이스를 요약합니다.">
          {data.monthlySplits.length ? (
            <div className="space-y-2">
              {data.monthlySplits.map((split) => (
                <div key={split.playerSplitStatId} className="flex flex-col gap-2 rounded-2xl border border-line/80 px-4 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-ink">{split.splitLabel}</p>
                    <p className="mt-1 text-muted">{split.teamLabel} · {split.games}경기</p>
                  </div>
                  <span className="text-muted sm:text-right">{split.summaryLine}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyStateNote message="월별 split은 공식 선수 Splits 페이지 ingest가 연결되면 제공합니다." />
          )}
        </SectionCard>

        <SectionCard title="상황별 매치업" subtitle="공식 Situations 페이지 데이터를 종류별로 묶어서, 상대 유형부터 카운트·주자·이닝 문맥까지 한 번에 읽기 쉽게 정리했습니다.">
          {data.situationSplitGroups.length ? (
            <div className="space-y-4">
              {data.situationSplitGroups.map((group) => (
                <div key={group.key} className="rounded-3xl border border-line/80 bg-white/80 px-4 py-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-semibold text-ink">{group.title}</p>
                    <span className="text-xs text-muted">{group.splits.length}개</span>
                  </div>
                  <div className="space-y-2">
                    {group.splits.map((split) => (
                      <div key={split.playerSplitStatId} className="flex flex-col gap-2 rounded-2xl border border-line/80 px-4 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-medium text-ink">{split.splitLabel}</p>
                          <p className="mt-1 text-muted">{split.teamLabel}</p>
                        </div>
                        <span className="text-muted sm:text-right">{split.summaryLine}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyStateNote message="상황별 split은 공식 Situations 페이지 ingest가 연결되면 제공합니다." />
          )}
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <SectionCard title="경기 로그" subtitle="최근 경기 로그를 경기 상세와 연결했습니다.">
          {data.gameLogs.length ? (
            <div className="space-y-2">
              {data.gameLogs.map((gameStat) => (
                <Link
                  key={gameStat.playerGameStatId}
                  href={buildGameRoute(gameStat.gameId)}
                  className="flex flex-col gap-2 rounded-2xl border border-line/80 px-4 py-3 text-sm hover:border-accent sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <span className="font-medium text-ink">{formatDateLabel(gameStat.game.scheduledAt)}</span>
                    <p className="mt-1 text-muted">{gameStat.teamLabel} · 상대 {gameStat.opponentLabel}</p>
                  </div>
                  <span className="text-muted sm:text-right">{gameStat.summaryLine}</span>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyStateNote message="경기 로그는 공식 선수 경기 기록 ingest가 연결되면 제공합니다." />
          )}
        </SectionCard>

        <SectionCard title="로스터 이벤트 / 시즌 메모" subtitle="부상, 복귀, 엔트리 변동 같은 문맥을 같이 봅니다.">
          <div className="space-y-2">
            {data.rosterEvents.length > 0 ? (
              data.rosterEvents.map((event) => (
                <div key={event.rosterEventId} className="rounded-2xl border border-line/80 px-4 py-4 text-sm">
                  <p className="font-medium text-ink">{event.type}</p>
                  <p className="mt-1 text-muted">{event.date}</p>
                  <p className="mt-2 text-muted">{event.note}</p>
                </div>
              ))
            ) : (
              <EmptyStateNote message="현재 공개된 공식 엔트리 변동 데이터가 없어 로스터 이벤트를 표시하지 않습니다." />
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
