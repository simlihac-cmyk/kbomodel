"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";

import { RecordsNav } from "@/components/records/records-nav";
import type { SeasonRecordsData } from "@/components/records/records-types";
import { EmptyStateNote } from "@/components/shared/empty-state-note";
import { MetricBadge } from "@/components/shared/metric-badge";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import {
  buildSplitExplorerRows,
  buildTeamRecordRows,
} from "@/lib/records/kbo-records";
import { formatDateTimeLabel } from "@/lib/utils/format";
import { buildSeasonTeamRoute } from "@/lib/utils/routes";

type TeamRecordsViewProps = {
  year: number;
  data: SeasonRecordsData;
};

export function TeamRecordsView({ year, data }: TeamRecordsViewProps) {
  const [query, setQuery] = useState("");
  const [teamSort, setTeamSort] = useState<
    "wins" | "runsScored" | "runsAllowed" | "runDiff"
  >("wins");
  const [splitType, setSplitType] = useState<"all" | "home" | "away">("all");
  const deferredQuery = useDeferredValue(query);
  const availableSplitTypes = useMemo(
    () =>
      Array.from(
        new Set(
          data.teamSplitStats
            .map((item) => item.splitType)
            .filter((item): item is "home" | "away" => item === "home" || item === "away"),
        ),
      ),
    [data.teamSplitStats],
  );

  const teamRows = useMemo(
    () =>
      buildTeamRecordRows(
        data.teamSeasonStats,
        data.displayById,
        teamSort,
        deferredQuery,
      ),
    [data.displayById, data.teamSeasonStats, deferredQuery, teamSort],
  );
  const splitRows = useMemo(
    () => {
      return buildSplitExplorerRows(
        data.teamSplitStats,
        data.displayById,
        splitType,
        deferredQuery,
      ).filter((item) => item.splitType === "home" || item.splitType === "away");
    },
    [data.displayById, data.teamSplitStats, deferredQuery, splitType],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`${year} 팀기록`}
        title="팀기록"
        description="기록실에서 순위와 확률 요소를 덜어내고, 구단 시즌 기록과 팀 split만 집중해서 탐색하도록 정리한 공간입니다."
        actions={<RecordsNav year={year} active="teams" />}
      />

      <div className="grid gap-3 md:grid-cols-3">
        <MetricBadge label="기록 대상 구단" value={`${data.teamSeasonStats.length}팀`} />
        <MetricBadge
          label="공식 split 행"
          value={`${splitRows.length || data.teamSplitStats.length}행`}
        />
        <MetricBadge
          label="기준 시각"
          value={formatDateTimeLabel(data.season.updatedAt)}
        />
      </div>

      <SectionCard
        title="구단 시즌 기록"
        subtitle="검색과 정렬로 팀 기록을 훑고, 각 구단 상세로 바로 이동합니다."
      >
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="팀명으로 검색"
            className="w-full rounded-2xl border border-line/80 bg-white px-4 py-2 text-sm text-ink lg:max-w-sm"
          />
          <select
            value={teamSort}
            onChange={(event) => setTeamSort(event.target.value as typeof teamSort)}
            className="w-full rounded-2xl border border-line/80 bg-white px-4 py-2 text-sm text-ink lg:w-auto"
          >
            <option value="wins">승수순</option>
            <option value="runsScored">득점순</option>
            <option value="runsAllowed">실점 적은 순</option>
            <option value="runDiff">득실차순</option>
          </select>
        </div>

        {teamRows.length > 0 ? (
          <div className="space-y-2">
            {teamRows.map((stat) => {
              const runDiff = stat.runsScored - stat.runsAllowed;
              const team = data.displayById[stat.seasonTeamId];
              return (
                <Link
                  key={stat.seasonTeamId}
                  href={buildSeasonTeamRoute(year, team.teamSlug)}
                  className="grid gap-3 rounded-2xl border border-line/80 px-4 py-4 text-sm transition-colors hover:border-accent md:grid-cols-[1.15fr_0.8fr_1fr_0.9fr_0.9fr]"
                >
                  <div>
                    <p className="font-medium text-ink">{team.displayNameKo}</p>
                    <p className="mt-1 text-muted">
                      전적 {stat.wins}-{stat.losses}
                      {stat.ties > 0 ? `-${stat.ties}` : ""}
                    </p>
                  </div>
                  <div className="text-muted">
                    <p>득점 {stat.runsScored}</p>
                    <p>실점 {stat.runsAllowed}</p>
                  </div>
                  <div className="text-muted">
                    <p>득실차 {runDiff > 0 ? "+" : ""}{runDiff}</p>
                    <p>홈 {stat.homeWins}-{stat.homeLosses}</p>
                  </div>
                  <div className="text-muted">
                    <p>공격력 {stat.offensePlus}</p>
                    <p>투수력 {stat.pitchingPlus}</p>
                  </div>
                  <div className="text-muted">
                    <p>원정 {stat.awayWins}-{stat.awayLosses}</p>
                    <p>불펜 ERA {stat.bullpenEra.toFixed(2)}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <EmptyStateNote message="현재 검색 조건에 맞는 팀 기록이 없습니다." />
        )}
      </SectionCard>

      <SectionCard
        title="팀 split 탐색"
        subtitle="현재 publish된 공식 팀 split 범위를 기반으로 홈/원정 기록을 따로 훑습니다."
      >
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-sm text-muted">
            세부 split 축은 이후 공식 ingest 범위에 맞춰 계속 확장합니다.
          </p>
          <select
            value={splitType}
            onChange={(event) => setSplitType(event.target.value as typeof splitType)}
            className="w-full rounded-2xl border border-line/80 bg-white px-4 py-2 text-sm text-ink lg:w-auto"
          >
            <option value="all">전체 split</option>
            {availableSplitTypes.includes("home") ? <option value="home">홈</option> : null}
            {availableSplitTypes.includes("away") ? <option value="away">원정</option> : null}
          </select>
        </div>

        {splitRows.length > 0 ? (
          <div className="space-y-2">
            {splitRows.map((split) => (
              <div
                key={split.splitId}
                className="flex flex-col gap-2 rounded-2xl border border-line/80 px-4 py-4 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-ink">
                    {data.displayById[split.seasonTeamId].displayNameKo} · {split.metricLabel}
                  </p>
                  <p className="mt-1 text-muted">{split.splitType}</p>
                </div>
                <span className="text-muted sm:text-right">{split.metricValue}</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyStateNote message="현재 검색 조건에 맞는 팀 split이 없습니다." />
        )}
      </SectionCard>
    </div>
  );
}
