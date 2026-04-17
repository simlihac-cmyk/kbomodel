import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { createProjectedBracket } from "@/lib/domain/kbo/postseason";
import type { getSeasonDashboardData } from "@/lib/repositories/kbo/view-models";
import { formatPercent } from "@/lib/utils/format";

type PostseasonViewProps = {
  year: number;
  data: NonNullable<Awaited<ReturnType<typeof getSeasonDashboardData>>>;
};

function matchupLabel(
  left: { shortNameKo: string } | undefined,
  right: { shortNameKo: string } | undefined,
) {
  if (!left || !right) {
    return "미정";
  }
  return `${left.shortNameKo} vs ${right.shortNameKo}`;
}

export function PostseasonView({ year, data }: PostseasonViewProps) {
  const bracket = createProjectedBracket(data.standings.rows);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`${year} 포스트시즌`}
        title="포스트시즌 경로 및 브래킷 확률"
        description="현재 순위 snapshot을 KBO ladder에 연결해, 각 팀이 어느 라운드까지 도달하는지와 가장 가능성 높은 대진을 함께 보여 줍니다."
      />

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <SectionCard title="현재 기준 브래킷 확률 시각화" subtitle="정규시즌 종료 전에는 projected bracket, 종료 후에는 actual bracket으로 자연스럽게 전환할 수 있는 구조입니다.">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-3xl border border-line/80 bg-slate-50 px-4 py-4">
              <p className="text-xs uppercase tracking-wide text-muted">Wildcard</p>
              <p className="mt-3 font-medium text-ink">
                {bracket.wildcard
                  ? matchupLabel(bracket.wildcard[0], bracket.wildcard[1])
                  : "미정"}
              </p>
            </div>
            <div className="rounded-3xl border border-line/80 bg-slate-50 px-4 py-4">
              <p className="text-xs uppercase tracking-wide text-muted">Semi PO</p>
              <p className="mt-3 font-medium text-ink">
                {bracket.semipo
                  ? matchupLabel(bracket.semipo[0], bracket.semipo[1])
                  : "미정"}
              </p>
            </div>
            <div className="rounded-3xl border border-line/80 bg-slate-50 px-4 py-4">
              <p className="text-xs uppercase tracking-wide text-muted">PO</p>
              <p className="mt-3 font-medium text-ink">
                {bracket.po ? matchupLabel(bracket.po[0], bracket.po[1]) : "미정"}
              </p>
            </div>
            <div className="rounded-3xl border border-line/80 bg-slate-50 px-4 py-4">
              <p className="text-xs uppercase tracking-wide text-muted">KS</p>
              <p className="mt-3 font-medium text-ink">
                {bracket.ks ? matchupLabel(bracket.ks[0], bracket.ks[1]) : "미정"}
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="가장 가능성 높은 대진 / 우승 경로" subtitle="현재 baseline snapshot 기준 설명 카드입니다.">
          <div className="space-y-3">
            <div className="rounded-2xl border border-line/80 px-4 py-4">
              <p className="font-medium text-ink">가장 가능성 높은 대진</p>
              <p className="mt-2 text-sm text-muted">
                KS는 {bracket.ks ? matchupLabel(bracket.ks[0], bracket.ks[1]) : "상위 2팀 미정"} 조합이 기본값으로 잡혀 있습니다.
              </p>
            </div>
            <div className="rounded-2xl border border-line/80 px-4 py-4">
              <p className="font-medium text-ink">가장 가능성 높은 우승 경로</p>
              <p className="mt-2 text-sm text-muted">
                현재는 정규시즌 1위 팀이 휴식 이점과 KS 직행 덕분에 가장 짧은 우승 경로를 가져갑니다.
              </p>
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="팀별 라운드 도달 확률" subtitle="Wildcard / Semi PO / PO / KS / Champion 순으로 정리했습니다.">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-line/80 text-xs uppercase tracking-wide text-muted">
              <tr>
                {["팀", "WC", "준PO", "PO", "KS", "우승"].map((label) => (
                  <th key={label} className="px-3 py-3 text-right first:text-left">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.standings.rows.map((row) => {
                const odds = data.simulation.postseasonOdds.find((item) => item.seasonTeamId === row.seasonTeamId)!;
                return (
                  <tr key={row.seasonTeamId} className="border-b border-line/60 last:border-0">
                    <td className="px-3 py-3 text-left font-medium text-ink">{row.shortNameKo}</td>
                    <td className="px-3 py-3 text-right">{formatPercent(odds.wildcard)}</td>
                    <td className="px-3 py-3 text-right">{formatPercent(odds.semipo)}</td>
                    <td className="px-3 py-3 text-right">{formatPercent(odds.po)}</td>
                    <td className="px-3 py-3 text-right">{formatPercent(odds.ks)}</td>
                    <td className="px-3 py-3 text-right">{formatPercent(odds.champion)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
