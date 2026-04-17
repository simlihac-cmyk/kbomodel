import Link from "next/link";

import { MetricBadge } from "@/components/shared/metric-badge";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import type { getGamePageData } from "@/lib/repositories/kbo/view-models";
import { formatDateTimeLabel } from "@/lib/utils/format";
import { buildGameRoute, buildPlayerRoute } from "@/lib/utils/routes";

type GameDetailViewProps = {
  data: NonNullable<Awaited<ReturnType<typeof getGamePageData>>>;
};

export function GameDetailView({ data }: GameDetailViewProps) {
  const home = data.displayById[data.game.homeSeasonTeamId];
  const away = data.displayById[data.game.awaySeasonTeamId];
  const homeStanding = data.seasonStandings?.rows.find(
    (row) => row.seasonTeamId === data.game.homeSeasonTeamId,
  );
  const awayStanding = data.seasonStandings?.rows.find(
    (row) => row.seasonTeamId === data.game.awaySeasonTeamId,
  );
  const winningPitcher = data.boxScore?.winningPitcherId
    ? data.playerById[data.boxScore.winningPitcherId]
    : null;
  const losingPitcher = data.boxScore?.losingPitcherId
    ? data.playerById[data.boxScore.losingPitcherId]
    : null;
  const savePitcher = data.boxScore?.savePitcherId
    ? data.playerById[data.boxScore.savePitcherId]
    : null;
  const totalHomeRuns = data.boxScore
    ? data.boxScore.lineScore.reduce((sum, inning) => sum + inning.home, 0)
    : data.game.homeScore ?? 0;
  const totalAwayRuns = data.boxScore
    ? data.boxScore.lineScore.reduce((sum, inning) => sum + inning.away, 0)
    : data.game.awayScore ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="경기 상세"
        title={`${away.label} @ ${home.label}`}
        description="라인스코어, 박스스코어, 승리/패전/세이브, 관중 수, 시즌 내 문맥과 같은 흐름까지 함께 읽는 KBO 경기 상세 페이지입니다."
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <MetricBadge label="경기 일시" value={formatDateTimeLabel(data.game.scheduledAt)} />
        <MetricBadge
          label="상태"
          value={data.game.status === "final" ? "종료" : data.game.status}
        />
        <MetricBadge
          label="스코어"
          value={`${data.game.awayScore ?? "-"} : ${data.game.homeScore ?? "-"}`}
        />
        <MetricBadge
          label="관중"
          value={data.game.attendance ? `${data.game.attendance.toLocaleString("ko-KR")}명` : "-"}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <SectionCard title="라인스코어" subtitle="이 경기의 흐름을 이닝 단위로 읽습니다.">
          {data.boxScore ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-line/80 text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-3 py-3 text-left">팀</th>
                    {data.boxScore.lineScore.map((inning) => (
                      <th key={inning.inning} className="px-3 py-3 text-right">
                        {inning.inning}
                      </th>
                    ))}
                    <th className="px-3 py-3 text-right">R</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-line/60">
                    <td className="px-3 py-3 font-medium text-ink">{away.label}</td>
                    {data.boxScore.lineScore.map((inning) => (
                      <td key={inning.inning} className="px-3 py-3 text-right">
                        {inning.away}
                      </td>
                    ))}
                    <td className="px-3 py-3 text-right font-semibold text-ink">{totalAwayRuns}</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-3 font-medium text-ink">{home.label}</td>
                    {data.boxScore.lineScore.map((inning) => (
                      <td key={inning.inning} className="px-3 py-3 text-right">
                        {inning.home}
                      </td>
                    ))}
                    <td className="px-3 py-3 text-right font-semibold text-ink">{totalHomeRuns}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted">이 경기의 상세 박스스코어는 공식 게임센터 ingest가 연결되면 표시합니다.</p>
          )}
        </SectionCard>

        <SectionCard title="결과 / 핵심 맥락" subtitle="승패와 시즌 내 위치를 함께 봅니다.">
          <div className="space-y-3">
            <div className="rounded-2xl border border-line/80 px-4 py-4 text-sm text-muted">
              <p className="font-medium text-ink">승리/패전/세이브</p>
              <p className="mt-2">
                승리 {winningPitcher?.nameKo ?? "-"} · 패전 {losingPitcher?.nameKo ?? "-"} · 세이브 {savePitcher?.nameKo ?? "-"}
              </p>
            </div>
            <div className="rounded-2xl border border-line/80 px-4 py-4 text-sm text-muted">
              {data.game.note ?? "특이 메모 없음"}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-line/80 bg-slate-50 px-4 py-4 text-sm text-muted">
                <p className="font-medium text-ink">{away.label}</p>
                <p className="mt-2">
                  {awayStanding ? `${awayStanding.rank}위 · ${awayStanding.wins}-${awayStanding.losses}-${awayStanding.ties}` : "당시 순위 정보 없음"}
                </p>
              </div>
              <div className="rounded-2xl border border-line/80 bg-slate-50 px-4 py-4 text-sm text-muted">
                <p className="font-medium text-ink">{home.label}</p>
                <p className="mt-2">
                  {homeStanding ? `${homeStanding.rank}위 · ${homeStanding.wins}-${homeStanding.losses}-${homeStanding.ties}` : "당시 순위 정보 없음"}
                </p>
              </div>
            </div>
            {data.game.externalLinks.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {data.game.externalLinks.map((link) => (
                  <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-line/80 bg-white px-3 py-1.5 text-sm text-muted"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <SectionCard title="시리즈 안에서의 위치" subtitle="같은 시리즈 앞뒤 경기 흐름을 확인합니다.">
          <div className="space-y-2">
            {data.seriesGames.map((game) => (
              <Link
                key={game.gameId}
                href={buildGameRoute(game.gameId)}
                className={`block rounded-2xl border px-4 py-4 text-sm ${game.gameId === data.game.gameId ? "border-accent bg-accent-soft" : "border-line/80 hover:border-accent"}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-ink">{formatDateTimeLabel(game.scheduledAt)}</span>
                  <span className="text-muted">
                    {game.status === "final" ? `${game.awayScore}:${game.homeScore}` : game.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="핵심 선수 / 박스스코어 하이라이트" subtitle="해당 경기에서 눈에 띈 선수들을 바로 이동시킵니다.">
          <div className="space-y-3">
            {data.boxScore?.highlights.map((highlight) => (
              <Link
                key={`${highlight.playerId}-${highlight.label}`}
                href={buildPlayerRoute(highlight.playerId)}
                className="block rounded-2xl border border-line/80 px-4 py-4 hover:border-accent"
              >
                <span className="font-medium text-ink">{highlight.label}</span>
                <p className="mt-1 text-sm text-muted">{highlight.value}</p>
              </Link>
            ))}
            {data.relatedPlayerStats.map((stat) => (
              <div key={stat.playerGameStatId} className="rounded-2xl border border-line/80 bg-slate-50 px-4 py-3 text-sm text-muted">
                {stat.summaryLine}
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <SectionCard title="전후 맥락" subtitle="이 경기 전후로 두 팀이 어떤 일정 구간에 있었는지 보여 줍니다.">
          <div className="space-y-2">
            {data.recentContextGames.map((game) => (
              <Link
                key={`recent-${game.gameId}`}
                href={buildGameRoute(game.gameId)}
                className="block rounded-2xl border border-line/80 px-4 py-3 text-sm hover:border-accent"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-ink">
                    {data.displayById[game.awaySeasonTeamId]?.label} @ {data.displayById[game.homeSeasonTeamId]?.label}
                  </span>
                  <span className="text-muted">{game.status === "final" ? `${game.awayScore}:${game.homeScore}` : game.status}</span>
                </div>
              </Link>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="다음 흐름" subtitle="이 경기 이후 이어지는 일정까지 바로 확인할 수 있습니다.">
          <div className="space-y-2">
            {data.nextContextGames.map((game) => (
              <Link
                key={`next-${game.gameId}`}
                href={buildGameRoute(game.gameId)}
                className="block rounded-2xl border border-line/80 px-4 py-3 text-sm hover:border-accent"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-ink">
                    {data.displayById[game.awaySeasonTeamId]?.label} @ {data.displayById[game.homeSeasonTeamId]?.label}
                  </span>
                  <span className="text-muted">{formatDateTimeLabel(game.scheduledAt)}</span>
                </div>
              </Link>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
