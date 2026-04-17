import Link from "next/link";

import { EmptyStateNote } from "@/components/shared/empty-state-note";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import type { getArchiveHubData } from "@/lib/repositories/kbo/view-models";

type ArchiveHubProps = {
  items: Awaited<ReturnType<typeof getArchiveHubData>>;
};

export function ArchiveHub({ items }: ArchiveHubProps) {
  const championTimeline = items
    .filter((item) => item.championLabel)
    .map((item) => ({
      year: item.season.year,
      label: item.championLabel ?? "-",
      headline: item.headline,
    }));
  const regularSeasonTimeline = items
    .filter((item) => item.regularSeasonWinnerLabel)
    .map((item) => ({
      year: item.season.year,
      label: item.regularSeasonWinnerLabel ?? "-",
      narrative: item.narrative[0] ?? "정규시즌 1위 요약 준비 중",
    }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="KBO 아카이브"
        title="시즌 아카이브 허브"
        description="연도별 시즌 타임라인, 우승팀 타임라인, 정규시즌 1위 타임라인으로 들어갈 수 있는 아카이브 허브입니다."
      />

      <SectionCard title="연도별 시즌 타임라인" subtitle="공식 ingest가 확보된 시즌부터 타임라인과 요약을 순차적으로 채웁니다.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <Link
              key={item.season.seasonId}
              href={`/archive/${item.season.year}`}
              className="block rounded-3xl border border-line/80 bg-white px-5 py-5 hover:border-accent"
            >
              <p className="text-xs uppercase tracking-wide text-muted">{item.season.year}</p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-ink">{item.headline}</h2>
              <p className="mt-3 text-sm leading-6 text-muted">
                {item.narrative[0] ?? "공식 아카이브 요약 ingest가 준비되면 이 시즌의 서사를 여기에 붙입니다."}
              </p>
              <p className="mt-3 text-xs text-muted">{item.historicalCoverageLabel}</p>
            </Link>
          ))}
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <SectionCard title="우승팀 타임라인" subtitle="완성 시즌 기준 한국시리즈 우승팀 흐름을 모았습니다.">
          {championTimeline.length ? (
            <div className="space-y-3">
              {championTimeline.map((item) => (
                <div key={`champion-${item.year}`} className="rounded-2xl border border-line/80 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-ink">{item.label}</p>
                    <span className="text-sm text-muted">{item.year}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted">{item.headline}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyStateNote message="우승팀 타임라인은 공식 포스트시즌 기록 ingest가 연결되면 채웁니다." />
          )}
        </SectionCard>

        <SectionCard title="정규시즌 1위 타임라인" subtitle="가을야구 결과와 별개로 정규시즌 1위 흐름을 따로 보여줍니다.">
          {regularSeasonTimeline.length ? (
            <div className="space-y-3">
              {regularSeasonTimeline.map((item) => (
                <div key={`regular-${item.year}`} className="rounded-2xl border border-line/80 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-ink">{item.label}</p>
                    <span className="text-sm text-muted">{item.year}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted">{item.narrative}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyStateNote message="정규시즌 1위 타임라인은 공식 historical record를 확보한 시즌부터 채웁니다." />
          )}
        </SectionCard>
      </div>
    </div>
  );
}
