import Link from "next/link";

import { RecordsNav } from "@/components/records/records-nav";
import type { SeasonRecordsData } from "@/components/records/records-types";
import { MetricBadge } from "@/components/shared/metric-badge";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { buildSeasonRecordsRoute } from "@/lib/utils/routes";

type RecordsViewProps = {
  year: number;
  data: SeasonRecordsData;
};

const RECORD_CATEGORIES: Array<{
  key: "teams" | "pitchers" | "hitters";
  label: string;
  description: string;
  statLabel: string;
  detailLabel: string;
}> = [
  {
    key: "teams",
    label: "팀기록",
    description: "구단 시즌 기록과 팀 split을 따로 모아 보는 전용 공간입니다.",
    statLabel: "구단 기록",
    detailLabel: "팀 시즌 기록, 홈/원정 split",
  },
  {
    key: "pitchers",
    label: "투수기록",
    description: "공식 시즌 투수 기록을 리더보드 중심으로 모아 보고 선수 상세로 이어집니다.",
    statLabel: "시즌 기록 선수",
    detailLabel: "리더보드, 선수 상세 진입",
  },
  {
    key: "hitters",
    label: "타자기록",
    description: "공식 시즌 타자 기록을 리더보드 중심으로 모아 보고 선수 상세로 이어집니다.",
    statLabel: "시즌 기록 선수",
    detailLabel: "리더보드, 선수 상세 진입",
  },
];

export function RecordsView({ year, data }: RecordsViewProps) {
  const hitterCount = new Set(
    data.playerSeasonStats
      .filter((item) => item.statType === "hitter")
      .map((item) => item.playerId),
  ).size;
  const pitcherCount = new Set(
    data.playerSeasonStats
      .filter((item) => item.statType === "pitcher")
      .map((item) => item.playerId),
  ).size;
  const playerCoverage = hitterCount + pitcherCount;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`${year} 기록실`}
        title="시즌 기록실"
        description="기록실은 대시보드와 분리해 팀기록, 투수기록, 타자기록만 깊게 탐색하는 공간으로 다시 정리합니다."
        actions={<RecordsNav year={year} active="overview" />}
      />

      <div className="grid gap-3 md:grid-cols-3">
        <MetricBadge label="팀기록" value={`${data.teamSeasonStats.length}팀`} />
        <MetricBadge label="선수 시즌 기록" value={`${playerCoverage}명`} />
        <MetricBadge label="공식 팀 split" value={`${data.teamSplitStats.length}행`} />
      </div>

      <SectionCard
        title="카테고리"
        subtitle="기록실은 구단과 선수 기록을 저장하고 탐색하는 역할에 맞춰 세 갈래로 나눕니다."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {RECORD_CATEGORIES.map((category) => {
            const statValue =
              category.key === "teams"
                ? `${data.teamSeasonStats.length}팀`
                : category.key === "pitchers"
                  ? `${pitcherCount}명`
                  : `${hitterCount}명`;
            return (
              <Link
                key={category.key}
                href={buildSeasonRecordsRoute(year, category.key)}
                className="rounded-[1.75rem] border border-line/80 bg-white px-5 py-5 transition-colors hover:border-accent"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
                  {category.label}
                </p>
                <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight text-ink">
                  {category.label}
                </h2>
                <p className="mt-3 text-sm leading-6 text-muted">
                  {category.description}
                </p>
                <div className="mt-5 rounded-2xl border border-line/70 bg-slate-50 px-4 py-3 text-sm">
                  <p className="text-muted">{category.statLabel}</p>
                  <p className="mt-2 text-lg font-semibold text-ink">{statValue}</p>
                  <p className="mt-2 text-muted">{category.detailLabel}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard
        title="개편 원칙"
        subtitle="중복되는 대시보드 요소를 빼고, 기록실만의 역할을 분명하게 가져갑니다."
      >
        <div className="space-y-3 text-sm text-muted">
          <p>팀 순위표나 레이스 카드 대신, 기록 탐색과 상세 페이지 진입에 집중합니다.</p>
          <p>세부 지표 조합은 이후 단계에서 확장하고, 지금은 구조와 탐색 흐름을 먼저 정리합니다.</p>
        </div>
      </SectionCard>
    </div>
  );
}
