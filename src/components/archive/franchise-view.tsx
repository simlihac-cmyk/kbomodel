import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import type { getFranchiseArchiveData } from "@/lib/repositories/kbo/view-models";

type FranchiseViewProps = {
  data: NonNullable<Awaited<ReturnType<typeof getFranchiseArchiveData>>>;
};

export function FranchiseView({ data }: FranchiseViewProps) {
  const postseasonCount = data.officialHistoricalRows.length
    ? data.officialHistoricalRows.filter((item) => Boolean(item.postseasonResult)).length
    : data.seasons.filter((item) => item.wins >= item.losses).length;
  const representativeSeasons = data.officialHistoricalRows.length
    ? data.officialHistoricalRows.slice(0, 3)
    : data.seasons.slice(0, 3);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="구단 아카이브"
        title={data.franchise.canonicalNameKo}
        description="프랜차이즈 계보를 중심으로 브랜드 변천, 연도별 성적, 가을야구 횟수, 대표 시즌을 함께 정리합니다."
      />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <SectionCard title="구단 연혁 / 브랜드 변천" subtitle="Franchise와 TeamBrand를 분리한 구조가 그대로 드러납니다.">
          <div className="space-y-3">
            <div className="rounded-2xl border border-line/80 bg-slate-50 px-4 py-4 text-sm text-muted">
              {data.franchise.brandHistorySummary}
            </div>
            {data.brands.map((brand) => (
              <div key={brand.brandId} className="flex flex-col gap-1 rounded-2xl border border-line/80 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span className="font-medium text-ink">{brand.displayNameKo}</span>
                <span className="text-muted">
                  {brand.seasonStartYear} - {brand.seasonEndYear ?? "현재"}
                </span>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="연도별 성적 / 가을야구" subtitle="대표 시즌 바로가기를 포함한 구단 요약입니다.">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-line/80 px-4 py-4">
              <p className="text-xs text-muted">우승</p>
              <p className="mt-2 text-2xl font-semibold text-ink">{data.franchise.championships}</p>
            </div>
            <div className="rounded-2xl border border-line/80 px-4 py-4">
              <p className="text-xs text-muted">가을야구 횟수</p>
              <p className="mt-2 text-2xl font-semibold text-ink">{postseasonCount}</p>
            </div>
            <div className="rounded-2xl border border-line/80 px-4 py-4">
              <p className="text-xs text-muted">대표 시즌</p>
              <p className="mt-2 text-2xl font-semibold text-ink">{representativeSeasons[0]?.year ?? "-"}</p>
            </div>
          </div>
          <p className="mt-4 text-xs text-muted">{data.historicalCoverageLabel}</p>
          <div className="mt-4 space-y-2">
            {data.officialHistoricalRows.length
              ? data.officialHistoricalRows.map((season) => (
                  <div key={`${season.year}-${season.franchiseId}`} className="flex flex-col gap-1 rounded-2xl border border-line/80 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-medium text-ink">
                      {season.year} · {season.brandLabel}
                    </span>
                    <span className="text-muted">
                      {season.wins}-{season.losses}-{season.ties}
                    </span>
                  </div>
                ))
              : data.seasons.map((season) => (
                  <div key={season.seasonTeamId} className="flex flex-col gap-1 rounded-2xl border border-line/80 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-medium text-ink">
                      {season.year} · {season.brandLabel}
                    </span>
                    <span className="text-muted">
                      {season.wins}-{season.losses}-{season.ties}
                    </span>
                  </div>
                ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="대표 시즌 바로가기" subtitle="브랜드 변화와 함께 기억되는 시즌으로 바로 이동합니다.">
        <div className="grid gap-3 md:grid-cols-3">
          {representativeSeasons.map((season) => (
            <Link
              key={`rep-${season.year}-${"seasonTeamId" in season ? season.seasonTeamId : season.franchiseId}`}
              href={`/archive/${season.year}`}
              className="rounded-2xl border border-line/80 px-4 py-4 hover:border-accent"
            >
              <p className="text-xs text-muted">{season.brandLabel}</p>
              <p className="mt-2 text-lg font-semibold text-ink">{season.year}</p>
              <p className="mt-2 text-sm text-muted">
                {season.wins}-{season.losses}-{season.ties}
              </p>
            </Link>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
