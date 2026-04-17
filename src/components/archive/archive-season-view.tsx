import Link from "next/link";

import { EmptyStateNote } from "@/components/shared/empty-state-note";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StandingsTable } from "@/components/standings/standings-table";
import type { ArchiveSeasonPageData } from "@/lib/repositories/kbo/view-models";
import { formatDateOnlyLabel } from "@/lib/utils/format";
import { buildGameRoute, buildPlayerRoute } from "@/lib/utils/routes";

type ArchiveSeasonViewProps = {
  year: number;
  data: ArchiveSeasonPageData;
};

export function ArchiveSeasonView({ year, data }: ArchiveSeasonViewProps) {
  const leaders = data.hasCompleteArchivePlayerCoverage
    ? data.playerSeasonStats
        .slice()
        .sort((left, right) => (right.war ?? 0) - (left.war ?? 0))
        .slice(0, 10)
    : [];
  const bestTeams = data.historicalArchiveRows.length
    ? data.historicalArchiveRows.slice(0, 3)
    : [...data.teamSeasonStats]
        .sort((left, right) => right.wins - left.wins || left.losses - right.losses)
        .slice(0, 3);
  const keyGames = data.hasCompleteArchiveGameCoverage
    ? [...data.games]
        .filter((game) => game.status === "final")
        .sort(
          (left, right) =>
            Math.abs((right.homeScore ?? 0) - (right.awayScore ?? 0)) -
              Math.abs((left.homeScore ?? 0) - (left.awayScore ?? 0)) ||
            right.scheduledAt.localeCompare(left.scheduledAt),
        )
        .slice(0, 8)
    : [];
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`${year} 아카이브`}
        title={`${year} 시즌 아카이브`}
        description="최종 순위표와 시즌 결과를 먼저 보여주고, 공식 historical record가 확보된 시즌은 그 결과를 우선 보여주는 KBO 아카이브 상세 페이지입니다."
      />

      <SectionCard
        title="최종 순위표"
        subtitle={
          data.hasCompleteHistoricalArchiveStandings
            ? "공식 historical record 기준 최종 순위를 우선 표시합니다."
            : "완성 시즌 아카이브는 공식 historical record가 확보되는 범위부터 순위를 표시합니다."
        }
      >
        <StandingsTable year={year} rows={data.standingsRows} linkTeams={false} />
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <SectionCard title="시즌 타임라인" subtitle="그 시즌이 어떤 문장으로 기억되는지를 먼저 보여줍니다.">
          {data.archiveNarrative.length ? (
            <div className="space-y-3">
              {data.archiveNarrative.map((line) => (
                <div key={line} className="rounded-2xl border border-line/80 bg-slate-50 px-4 py-4 text-sm text-muted">
                  {line}
                </div>
              ))}
            </div>
          ) : (
            <EmptyStateNote message="이 시즌의 narrative 타임라인은 공식 아카이브 ingest가 준비되면 채웁니다." />
          )}
        </SectionCard>

        <SectionCard title="대표 팀 성적" subtitle="완성 시즌에서 먼저 기억해야 할 상위 팀을 빠르게 묶었습니다.">
          <div className="grid gap-3 md:grid-cols-3">
                {bestTeams.map((team) => (
                  <div key={"seasonTeamId" in team ? team.seasonTeamId : `${team.year}-${team.franchiseId}`} className="rounded-2xl border border-line/80 px-4 py-4">
                    <p className="text-xs text-muted">
                  {"seasonTeamId" in team
                    ? data.displayById[team.seasonTeamId].displayNameKo
                    : `${team.rank}위 · ${team.brandLabel}`}
                </p>
                <p className="mt-2 text-xl font-semibold text-ink">
                  {team.wins}-{team.losses}-{team.ties}
                </p>
                {"seasonTeamId" in team ? (
                  <p className="mt-2 text-sm text-muted">
                    득실차 {team.runsScored - team.runsAllowed > 0 ? "+" : ""}
                    {team.runsScored - team.runsAllowed}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-muted">{team.postseasonResult ?? "가을야구 결과 기록 대기"}</p>
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <SectionCard title="포스트시즌 결과" subtitle="와일드카드부터 한국시리즈까지 라운드별 결과를 요약합니다.">
          {data.historicalArchiveRows.some((row) => row.postseasonResult) ? (
            <div className="space-y-3">
                {data.historicalArchiveRows
                  .filter((row) => row.postseasonResult)
                  .map((row) => (
                    <div key={`${row.year}-${row.franchiseId}`} className="rounded-2xl border border-line/80 px-4 py-4">
                      <p className="font-medium text-ink">{row.brandLabel}</p>
                    <p className="mt-2 text-sm text-muted">{row.postseasonResult}</p>
                  </div>
                ))}
            </div>
          ) : (
            <EmptyStateNote message="포스트시즌 라운드별 결과는 공식 기록 페이지 ingest가 연결되면 채웁니다. 현재는 정규시즌 공식 historical record만 우선 반영했습니다." />
          )}
        </SectionCard>

        <SectionCard title="시즌 리더보드" subtitle="공식 선수 기록 ingest 이전에는 리더보드를 노출하지 않습니다.">
          {leaders.length ? (
            <div className="space-y-2">
              {leaders.map((item) => {
                const player = data.players.find((playerRow) => playerRow.playerId === item.playerId);
                return (
                  <Link
                    key={item.statId}
                    href={buildPlayerRoute(item.playerId)}
                    className="flex flex-col gap-2 rounded-2xl border border-line/80 px-4 py-3 text-sm hover:border-accent sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="font-medium text-ink">{player?.nameKo ?? item.playerId}</span>
                    <span className="text-muted sm:text-right">WAR {item.war ?? 0}</span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <EmptyStateNote message="시즌 리더보드는 공식 선수 기록 ingest가 들어오면 다시 공개합니다." />
          )}
        </SectionCard>
      </div>

      <SectionCard title="수상 / 시즌 메모" subtitle="Awards와 시즌 narrative를 함께 보며 그 해의 결을 잡습니다.">
        {data.awards.length || data.archiveNarrative.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {data.awards.map((award) => (
              <div key={award.awardId} className="rounded-2xl border border-line/80 bg-slate-50 px-4 py-4">
                <p className="font-medium text-ink">{award.label}</p>
                <p className="mt-2 text-sm text-muted">{award.note}</p>
              </div>
            ))}
            {data.archiveNarrative.map((line) => (
              <div key={`memo-${line}`} className="rounded-2xl border border-line/80 bg-slate-50 px-4 py-4 text-sm text-muted">
                {line}
              </div>
            ))}
          </div>
        ) : (
          <EmptyStateNote message="수상과 시즌 메모는 공식 아카이브 ingest 이후에만 표시합니다." />
        )}
      </SectionCard>

      <SectionCard title="전 경기 결과" subtitle="공식 경기 결과 ingest가 확보된 범위부터 경기 리스트 흐름을 보여 줍니다.">
        {data.hasCompleteArchiveGameCoverage ? (
          <div className="space-y-2">
            {data.games.slice(0, 30).map((game) => (
              <Link
                key={game.gameId}
                href={buildGameRoute(game.gameId)}
                className="flex flex-col gap-2 rounded-2xl border border-line/80 px-4 py-3 text-sm hover:border-accent sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="font-medium text-ink">
                  {data.displayById[game.awaySeasonTeamId].shortNameKo} @ {data.displayById[game.homeSeasonTeamId].shortNameKo}
                </span>
                <span className="text-muted sm:text-right">{game.status === "final" ? `${game.awayScore}:${game.homeScore}` : "예정"}</span>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyStateNote message="과거 시즌 경기별 결과는 공식 경기 기록 ingest가 준비되면 공개합니다. 지금은 불완전한 경기 목록을 숨겼습니다." />
        )}
      </SectionCard>

      <SectionCard title="기억해둘 경기" subtitle="점수 차, 시기, 서사성이 큰 경기부터 골랐습니다.">
        {data.hasCompleteArchiveGameCoverage ? (
          <div className="grid gap-3 md:grid-cols-2">
            {keyGames.map((game) => (
              <Link
                key={`key-${game.gameId}`}
                href={buildGameRoute(game.gameId)}
                className="rounded-2xl border border-line/80 px-4 py-4 hover:border-accent"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-medium text-ink">
                    {data.displayById[game.awaySeasonTeamId].shortNameKo} @ {data.displayById[game.homeSeasonTeamId].shortNameKo}
                  </p>
                  <span className="text-sm text-muted sm:text-right">
                    {game.awayScore}:{game.homeScore}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted">
                  {formatDateOnlyLabel(game.scheduledAt)} · {game.note ?? "시즌 흐름을 읽기 좋은 대표 경기"}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyStateNote message="대표 경기 선정은 공식 경기 결과 ingest 이후에 다시 엽니다." />
        )}
      </SectionCard>
    </div>
  );
}
