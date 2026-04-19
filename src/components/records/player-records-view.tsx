"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { RecordsNav } from "@/components/records/records-nav";
import type { SeasonRecordsData } from "@/components/records/records-types";
import { EmptyStateNote } from "@/components/shared/empty-state-note";
import { MetricBadge } from "@/components/shared/metric-badge";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { cn } from "@/lib/utils/cn";
import {
  buildHitterLeaderRows,
  buildPitcherLeaderRows,
  buildPlayerPositionOptions,
  buildPlayerSituationGroupOptions,
  buildPlayerSituationValueOptions,
  buildPlayerSplitLeaderRows,
  buildPlayerTeamOptions,
  PLAYER_RECORD_FILTER_ALL,
  type HitterLeaderMetric,
  type PitcherLeaderMetric,
  type PlayerRecordFilters,
  type PlayerSituationFilterGroup,
} from "@/lib/records/kbo-records";
import { buildPlayerRoute, buildSeasonRecordsRoute } from "@/lib/utils/routes";

type PlayerRecordsViewProps = {
  year: number;
  data: SeasonRecordsData;
  statType: "hitter" | "pitcher";
};

type PlayerRecordCategory = "hitter" | "pitcher" | "fielding" | "baserunning";

const HITTER_METRIC_OPTIONS: Array<{ value: HitterLeaderMetric; label: string }> = [
  { value: "battingAverage", label: "타율" },
  { value: "ops", label: "OPS" },
  { value: "homeRuns", label: "홈런" },
  { value: "rbi", label: "타점" },
  { value: "hits", label: "안타" },
];

const PITCHER_METRIC_OPTIONS: Array<{ value: PitcherLeaderMetric; label: string }> = [
  { value: "era", label: "ERA" },
  { value: "whip", label: "WHIP" },
  { value: "strikeouts", label: "탈삼진" },
  { value: "wins", label: "승수" },
  { value: "saves", label: "세이브" },
  { value: "holds", label: "홀드" },
];

const BASERUNNING_METRIC_OPTIONS: Array<{ value: HitterLeaderMetric; label: string }> = [
  { value: "stolenBases", label: "도루" },
  { value: "runs", label: "득점" },
];

function formatRate(value: number | null | undefined, digits: number) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "-";
  }
  return value.toFixed(digits);
}

function formatRateLabel(value: number | null | undefined, digits: number) {
  const formatted = formatRate(value, digits);
  return formatted.startsWith("0.") ? formatted.replace(/^0(?=\.)/, "") : formatted;
}

function formatInnings(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "-";
  }
  const whole = Math.trunc(value);
  const decimal = Math.round((value - whole) * 10);
  return decimal > 0 ? `${whole}.${decimal}` : `${whole}`;
}

function formatTableValue(value: number | null | undefined) {
  return value === null || value === undefined ? "-" : value.toString();
}

function tableHeaderClass(active: boolean, align: "left" | "right" = "right") {
  return cn(
    "px-4 py-3 text-xs font-semibold tracking-wide whitespace-nowrap",
    align === "left" ? "text-left" : "text-right",
    active ? "bg-orange-50 text-orange-700" : "text-muted",
  );
}

function tableCellClass(active: boolean, align: "left" | "right" = "right") {
  return cn(
    "px-4 py-3 whitespace-nowrap",
    align === "left" ? "text-left" : "text-right",
    active ? "font-semibold text-ink" : "text-muted",
  );
}

function defaultCategory(statType: "hitter" | "pitcher"): PlayerRecordCategory {
  return statType === "hitter" ? "hitter" : "pitcher";
}

function leaderboardTitle(category: PlayerRecordCategory) {
  if (category === "pitcher") {
    return "투수 리더보드";
  }
  if (category === "fielding") {
    return "수비 기록";
  }
  if (category === "baserunning") {
    return "주루 리더보드";
  }
  return "타자 리더보드";
}

function leaderboardSubtitle(category: PlayerRecordCategory, showingSplitLeaderboard: boolean) {
  if (category === "fielding") {
    return "공식 수비 지표 ingest가 붙으면 이 분류 바를 그대로 확장할 수 있도록 먼저 뼈대를 맞춰 둡니다.";
  }
  if (showingSplitLeaderboard) {
    return "선택한 월별/상황별 split 기준으로 공식 선수 기록을 다시 정렬합니다.";
  }
  if (category === "baserunning") {
    return "도루와 득점처럼 주루 흐름을 읽을 수 있는 공식 지표를 먼저 분리해서 봅니다.";
  }
  return "정렬 기준과 팀/포지션/상황 필터를 바꿔 보면서 공식 기록이 연결된 선수들을 바로 찾습니다.";
}

function renderTabClassName(active: boolean) {
  return cn(
    "inline-flex min-w-[72px] items-center justify-center border px-4 py-2 text-sm font-semibold transition-colors",
    active
      ? "border-ink bg-white text-ink shadow-sm"
      : "border-line/80 bg-slate-50 text-muted hover:border-accent hover:bg-white hover:text-ink",
  );
}

function renderHitterTable(rows: ReturnType<typeof buildHitterLeaderRows>, activeMetric: HitterLeaderMetric) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted sm:hidden">표가 길면 좌우로 밀어서 보세요.</p>
      <div className="overflow-x-auto rounded-3xl border border-line/80">
        <table className="min-w-[1180px] text-sm">
          <thead className="border-b border-line/80 bg-slate-50">
            <tr>
              <th className={tableHeaderClass(false, "right")}>순위</th>
              <th className={tableHeaderClass(false, "left")}>선수명</th>
              <th className={tableHeaderClass(false, "left")}>팀명</th>
              <th className={tableHeaderClass(activeMetric === "battingAverage")}>AVG</th>
              <th className={tableHeaderClass(activeMetric === "ops")}>OPS</th>
              <th className={tableHeaderClass(false)}>G</th>
              <th className={tableHeaderClass(false)}>PA</th>
              <th className={tableHeaderClass(false)}>AB</th>
              <th className={tableHeaderClass(activeMetric === "runs")}>R</th>
              <th className={tableHeaderClass(activeMetric === "hits")}>H</th>
              <th className={tableHeaderClass(activeMetric === "homeRuns")}>HR</th>
              <th className={tableHeaderClass(activeMetric === "rbi")}>RBI</th>
              <th className={tableHeaderClass(activeMetric === "stolenBases")}>SB</th>
              <th className={tableHeaderClass(false)}>BB</th>
              <th className={tableHeaderClass(false)}>SO</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.statId} className="border-b border-line/60 last:border-0">
                <td className={tableCellClass(false)}>{index + 1}</td>
                <td className={tableCellClass(false, "left")}>
                  <Link href={buildPlayerRoute(row.playerId)} className="font-medium text-ink hover:text-accent">
                    {row.playerNameKo}
                  </Link>
                </td>
                <td className={tableCellClass(false, "left")}>{row.teamLabel}</td>
                <td className={tableCellClass(activeMetric === "battingAverage")}>
                  {formatRateLabel(row.battingAverage, 3)}
                </td>
                <td className={tableCellClass(activeMetric === "ops")}>{formatRate(row.ops, 3)}</td>
                <td className={tableCellClass(false)}>{formatTableValue(row.games)}</td>
                <td className={tableCellClass(false)}>{formatTableValue(row.plateAppearances)}</td>
                <td className={tableCellClass(false)}>{formatTableValue(row.atBats)}</td>
                <td className={tableCellClass(activeMetric === "runs")}>{formatTableValue(row.runs)}</td>
                <td className={tableCellClass(activeMetric === "hits")}>{formatTableValue(row.hits)}</td>
                <td className={tableCellClass(activeMetric === "homeRuns")}>{formatTableValue(row.homeRuns)}</td>
                <td className={tableCellClass(activeMetric === "rbi")}>{formatTableValue(row.rbi)}</td>
                <td className={tableCellClass(activeMetric === "stolenBases")}>{formatTableValue(row.stolenBases)}</td>
                <td className={tableCellClass(false)}>{formatTableValue(row.walks)}</td>
                <td className={tableCellClass(false)}>{formatTableValue(row.strikeouts)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function renderPitcherTable(rows: ReturnType<typeof buildPitcherLeaderRows>, activeMetric: PitcherLeaderMetric) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted sm:hidden">표가 길면 좌우로 밀어서 보세요.</p>
      <div className="overflow-x-auto rounded-3xl border border-line/80">
        <table className="min-w-[1180px] text-sm">
          <thead className="border-b border-line/80 bg-slate-50">
            <tr>
              <th className={tableHeaderClass(false)}>순위</th>
              <th className={tableHeaderClass(false, "left")}>선수명</th>
              <th className={tableHeaderClass(false, "left")}>팀명</th>
              <th className={tableHeaderClass(activeMetric === "era")}>ERA</th>
              <th className={tableHeaderClass(activeMetric === "whip")}>WHIP</th>
              <th className={tableHeaderClass(false)}>G</th>
              <th className={tableHeaderClass(false)}>IP</th>
              <th className={tableHeaderClass(activeMetric === "wins")}>W</th>
              <th className={tableHeaderClass(false)}>L</th>
              <th className={tableHeaderClass(activeMetric === "saves")}>SV</th>
              <th className={tableHeaderClass(activeMetric === "holds")}>HLD</th>
              <th className={tableHeaderClass(activeMetric === "strikeouts")}>SO</th>
              <th className={tableHeaderClass(false)}>H</th>
              <th className={tableHeaderClass(false)}>HR</th>
              <th className={tableHeaderClass(false)}>BB</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.statId} className="border-b border-line/60 last:border-0">
                <td className={tableCellClass(false)}>{index + 1}</td>
                <td className={tableCellClass(false, "left")}>
                  <Link href={buildPlayerRoute(row.playerId)} className="font-medium text-ink hover:text-accent">
                    {row.playerNameKo}
                  </Link>
                </td>
                <td className={tableCellClass(false, "left")}>{row.teamLabel}</td>
                <td className={tableCellClass(activeMetric === "era")}>{formatRate(row.era, 2)}</td>
                <td className={tableCellClass(activeMetric === "whip")}>{formatRate(row.whip, 2)}</td>
                <td className={tableCellClass(false)}>{formatTableValue(row.games)}</td>
                <td className={tableCellClass(false)}>{formatInnings(row.inningsPitched)}</td>
                <td className={tableCellClass(activeMetric === "wins")}>{formatTableValue(row.wins)}</td>
                <td className={tableCellClass(false)}>{formatTableValue(row.losses)}</td>
                <td className={tableCellClass(activeMetric === "saves")}>{formatTableValue(row.saves)}</td>
                <td className={tableCellClass(activeMetric === "holds")}>{formatTableValue(row.holds)}</td>
                <td className={tableCellClass(activeMetric === "strikeouts")}>{formatTableValue(row.strikeouts)}</td>
                <td className={tableCellClass(false)}>{formatTableValue(row.hitsAllowed)}</td>
                <td className={tableCellClass(false)}>{formatTableValue(row.homeRunsAllowed)}</td>
                <td className={tableCellClass(false)}>{formatTableValue(row.walks)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function PlayerRecordsView({
  year,
  data,
  statType,
}: PlayerRecordsViewProps) {
  const [recordCategory, setRecordCategory] = useState<PlayerRecordCategory>(defaultCategory(statType));
  const [query, setQuery] = useState("");
  const [seasonTeamId, setSeasonTeamId] = useState(PLAYER_RECORD_FILTER_ALL);
  const [position, setPosition] = useState(PLAYER_RECORD_FILTER_ALL);
  const [situationGroup, setSituationGroup] = useState<PlayerSituationFilterGroup>(PLAYER_RECORD_FILTER_ALL);
  const [situationValue, setSituationValue] = useState(PLAYER_RECORD_FILTER_ALL);
  const [hitterMetric, setHitterMetric] = useState<HitterLeaderMetric>("battingAverage");
  const [pitcherMetric, setPitcherMetric] = useState<PitcherLeaderMetric>("era");
  const [baserunningMetric, setBaserunningMetric] = useState<HitterLeaderMetric>("stolenBases");
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    setRecordCategory(defaultCategory(statType));
    setSituationGroup(PLAYER_RECORD_FILTER_ALL);
    setSituationValue(PLAYER_RECORD_FILTER_ALL);
  }, [statType]);

  const effectiveStatType: "hitter" | "pitcher" = useMemo(() => {
    if (recordCategory === "pitcher") {
      return "pitcher";
    }
    if (recordCategory === "fielding") {
      return statType;
    }
    return "hitter";
  }, [recordCategory, statType]);

  const activeMetric = useMemo(() => {
    if (recordCategory === "pitcher") {
      return pitcherMetric;
    }
    if (recordCategory === "baserunning") {
      return baserunningMetric;
    }
    return hitterMetric;
  }, [baserunningMetric, hitterMetric, pitcherMetric, recordCategory]);

  const filters = useMemo<PlayerRecordFilters>(
    () => ({
      query: deferredQuery,
      seasonTeamId,
      position,
    }),
    [deferredQuery, position, seasonTeamId],
  );

  const teamOptions = useMemo(
    () => buildPlayerTeamOptions(data.playerSeasonStats, data.displayById, effectiveStatType),
    [data.displayById, data.playerSeasonStats, effectiveStatType],
  );
  const positionOptions = useMemo(
    () => buildPlayerPositionOptions(data.playerSeasonStats, data.players, effectiveStatType),
    [data.playerSeasonStats, data.players, effectiveStatType],
  );
  const situationGroupOptions = useMemo(
    () =>
      recordCategory === "fielding"
        ? [{ value: PLAYER_RECORD_FILTER_ALL, label: "경기상황별1" }]
        : buildPlayerSituationGroupOptions(data.playerSplitStats, effectiveStatType, activeMetric),
    [activeMetric, data.playerSplitStats, effectiveStatType, recordCategory],
  );
  const situationValueOptions = useMemo(
    () =>
      recordCategory === "fielding"
        ? [{ value: PLAYER_RECORD_FILTER_ALL, label: "경기상황별2" }]
        : buildPlayerSituationValueOptions(
            data.playerSplitStats,
            data.players,
            effectiveStatType,
            activeMetric,
            situationGroup,
            seasonTeamId,
            position,
          ),
    [
      activeMetric,
      data.playerSplitStats,
      data.players,
      effectiveStatType,
      position,
      recordCategory,
      seasonTeamId,
      situationGroup,
    ],
  );

  useEffect(() => {
    if (!teamOptions.some((option) => option.value === seasonTeamId)) {
      setSeasonTeamId(PLAYER_RECORD_FILTER_ALL);
    }
  }, [seasonTeamId, teamOptions]);

  useEffect(() => {
    if (!positionOptions.some((option) => option.value === position)) {
      setPosition(PLAYER_RECORD_FILTER_ALL);
    }
  }, [position, positionOptions]);

  useEffect(() => {
    if (!situationGroupOptions.some((option) => option.value === situationGroup)) {
      setSituationGroup(PLAYER_RECORD_FILTER_ALL);
      setSituationValue(PLAYER_RECORD_FILTER_ALL);
    }
  }, [situationGroup, situationGroupOptions]);

  useEffect(() => {
    if (situationGroup !== PLAYER_RECORD_FILTER_ALL && situationValue === PLAYER_RECORD_FILTER_ALL) {
      const defaultValue = situationValueOptions[1]?.value;
      if (defaultValue) {
        setSituationValue(defaultValue);
      }
    }
  }, [situationGroup, situationValue, situationValueOptions]);

  useEffect(() => {
    if (!situationValueOptions.some((option) => option.value === situationValue)) {
      setSituationValue(situationGroup === PLAYER_RECORD_FILTER_ALL ? PLAYER_RECORD_FILTER_ALL : situationValueOptions[1]?.value ?? PLAYER_RECORD_FILTER_ALL);
    }
  }, [situationGroup, situationValue, situationValueOptions]);

  const showingSplitLeaderboard =
    recordCategory !== "fielding" &&
    situationGroup !== PLAYER_RECORD_FILTER_ALL &&
    situationValue !== PLAYER_RECORD_FILTER_ALL;

  const rows = useMemo(() => {
    if (recordCategory === "fielding") {
      return [];
    }

    if (showingSplitLeaderboard) {
      return buildPlayerSplitLeaderRows(
        data.playerSplitStats,
        data.players,
        data.displayById,
        effectiveStatType,
        activeMetric,
        filters,
        situationGroup,
        situationValue,
      );
    }

    if (recordCategory === "pitcher") {
      return buildPitcherLeaderRows(
        data.playerSeasonStats,
        data.players,
        data.displayById,
        pitcherMetric,
        filters,
      );
    }

    return buildHitterLeaderRows(
      data.playerSeasonStats,
      data.players,
      data.displayById,
      recordCategory === "baserunning" ? baserunningMetric : hitterMetric,
      filters,
    );
  }, [
    activeMetric,
    baserunningMetric,
    data.displayById,
    data.playerSeasonStats,
    data.playerSplitStats,
    data.players,
    effectiveStatType,
    filters,
    hitterMetric,
    pitcherMetric,
    recordCategory,
    showingSplitLeaderboard,
    situationGroup,
    situationValue,
  ]);

  const seasonStatsCount = useMemo(
    () =>
      recordCategory === "fielding"
        ? 0
        : new Set(
            data.playerSeasonStats
              .filter((item) => item.statType === effectiveStatType)
              .map((item) => item.playerId),
          ).size,
    [data.playerSeasonStats, effectiveStatType, recordCategory],
  );
  const gameLogCoverageCount = useMemo(
    () =>
      recordCategory === "fielding"
        ? 0
        : new Set(
            data.playerGameStats
              .filter((item) => item.statType === effectiveStatType)
              .map((item) => item.playerId),
          ).size,
    [data.playerGameStats, effectiveStatType, recordCategory],
  );
  const splitCoverageCount = useMemo(
    () =>
      recordCategory === "fielding"
        ? 0
        : new Set(
            data.playerSplitStats
              .filter((item) => item.statType === effectiveStatType)
              .map((item) => item.playerId),
          ).size,
    [data.playerSplitStats, effectiveStatType, recordCategory],
  );

  const coverageBadges =
    recordCategory === "fielding"
      ? [
          { label: "시즌 기록 연결", value: "준비중" },
          { label: "경기 로그 연결", value: "준비중" },
          { label: "split 연결", value: "준비중" },
        ]
      : [
          { label: "시즌 기록 연결", value: `${seasonStatsCount}명` },
          { label: "경기 로그 연결", value: `${gameLogCoverageCount}명` },
          { label: "split 연결", value: `${splitCoverageCount}명` },
        ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`${year} 선수기록`}
        title="선수기록"
        description="타자, 투수, 수비, 주루 기준으로 선수 기록을 분류하고 팀·포지션·경기 상황별로 다시 좁혀 볼 수 있는 공간입니다."
        actions={<RecordsNav year={year} active={statType === "hitter" ? "hitters" : "pitchers"} />}
      />

      <SectionCard
        title="기록 분류"
        subtitle="KBO 기록실처럼 카테고리와 상황 필터를 먼저 정한 뒤 리더보드를 다시 읽습니다."
        compact
      >
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 border-b border-line/80 pb-4">
            {statType === "hitter" ? (
              <button
                type="button"
                onClick={() => setRecordCategory("hitter")}
                className={renderTabClassName(recordCategory === "hitter")}
              >
                타자
              </button>
            ) : (
              <Link href={buildSeasonRecordsRoute(year, "hitters")} className={renderTabClassName(false)}>
                타자
              </Link>
            )}

            {statType === "pitcher" ? (
              <button
                type="button"
                onClick={() => setRecordCategory("pitcher")}
                className={renderTabClassName(recordCategory === "pitcher")}
              >
                투수
              </button>
            ) : (
              <Link href={buildSeasonRecordsRoute(year, "pitchers")} className={renderTabClassName(false)}>
                투수
              </Link>
            )}

            <button
              type="button"
              onClick={() => setRecordCategory("fielding")}
              className={renderTabClassName(recordCategory === "fielding")}
            >
              수비
            </button>

            <button
              type="button"
              onClick={() => setRecordCategory("baserunning")}
              className={renderTabClassName(recordCategory === "baserunning")}
            >
              주루
            </button>
          </div>

          <div className="grid gap-2 xl:grid-cols-6 md:grid-cols-3">
            <select className="rounded-md border border-line/80 bg-white px-3 py-2 text-sm text-ink" value={year} onChange={() => undefined}>
              <option value={year}>{year}</option>
            </select>
            <select className="rounded-md border border-line/80 bg-white px-3 py-2 text-sm text-ink" value="regular" onChange={() => undefined}>
              <option value="regular">KBO 정규시즌</option>
            </select>
            <select
              value={seasonTeamId}
              onChange={(event) => setSeasonTeamId(event.target.value)}
              className="rounded-md border border-line/80 bg-white px-3 py-2 text-sm text-ink"
            >
              {teamOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={position}
              onChange={(event) => setPosition(event.target.value)}
              className="rounded-md border border-line/80 bg-white px-3 py-2 text-sm text-ink"
            >
              {positionOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={situationGroup}
              onChange={(event) => {
                setSituationGroup(event.target.value as PlayerSituationFilterGroup);
                setSituationValue(PLAYER_RECORD_FILTER_ALL);
              }}
              disabled={recordCategory === "fielding" || situationGroupOptions.length <= 1}
              className="rounded-md border border-line/80 bg-white px-3 py-2 text-sm text-ink disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-muted"
            >
              {situationGroupOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={situationValue}
              onChange={(event) => setSituationValue(event.target.value)}
              disabled={
                recordCategory === "fielding" ||
                situationGroup === PLAYER_RECORD_FILTER_ALL ||
                situationValueOptions.length <= 1
              }
              className="rounded-md border border-line/80 bg-white px-3 py-2 text-sm text-ink disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-muted"
            >
              {situationValueOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <p className="text-xs text-muted">
            공식 split이 연결된 지표만 `경기상황별` 필터가 활성화됩니다. 지원되지 않는 조합은 시즌 누적 기록 기준으로 유지합니다.
          </p>
        </div>
      </SectionCard>

      <div className="grid gap-3 md:grid-cols-3">
        {coverageBadges.map((badge) => (
          <MetricBadge key={badge.label} label={badge.label} value={badge.value} />
        ))}
      </div>

      <SectionCard
        title={leaderboardTitle(recordCategory)}
        subtitle={leaderboardSubtitle(recordCategory, showingSplitLeaderboard)}
      >
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="팀명 또는 선수명 검색"
            className="w-full rounded-2xl border border-line/80 bg-white px-4 py-2 text-sm text-ink lg:max-w-sm"
          />

          {recordCategory === "fielding" ? null : recordCategory === "pitcher" ? (
            <select
              value={pitcherMetric}
              onChange={(event) => setPitcherMetric(event.target.value as PitcherLeaderMetric)}
              className="w-full rounded-2xl border border-line/80 bg-white px-4 py-2 text-sm text-ink lg:w-auto"
            >
              {PITCHER_METRIC_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : recordCategory === "baserunning" ? (
            <select
              value={baserunningMetric}
              onChange={(event) => setBaserunningMetric(event.target.value as HitterLeaderMetric)}
              className="w-full rounded-2xl border border-line/80 bg-white px-4 py-2 text-sm text-ink lg:w-auto"
            >
              {BASERUNNING_METRIC_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : (
            <select
              value={hitterMetric}
              onChange={(event) => setHitterMetric(event.target.value as HitterLeaderMetric)}
              className="w-full rounded-2xl border border-line/80 bg-white px-4 py-2 text-sm text-ink lg:w-auto"
            >
              {HITTER_METRIC_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          )}
        </div>

        {rows.length > 0 ? (
          effectiveStatType === "pitcher"
            ? renderPitcherTable(rows as ReturnType<typeof buildPitcherLeaderRows>, pitcherMetric)
            : renderHitterTable(
                rows as ReturnType<typeof buildHitterLeaderRows>,
                recordCategory === "baserunning" ? baserunningMetric : hitterMetric,
              )
        ) : (
          <EmptyStateNote
            message={
              recordCategory === "fielding"
                ? "공식 수비 기록 ingest가 아직 연결되지 않았습니다. 분류 바와 팀/포지션 흐름은 먼저 맞춰 두었고, 다음 단계에서 수비 지표를 붙일 예정입니다."
                : showingSplitLeaderboard
                  ? "선택한 조건에 맞는 공식 split 기록이 아직 없습니다."
                  : recordCategory === "pitcher"
                    ? "공식 투수 시즌 기록이 아직 연결되지 않았습니다."
                    : recordCategory === "baserunning"
                      ? "주루 기준으로 보여줄 공식 시즌 기록이 아직 충분히 연결되지 않았습니다."
                      : "공식 타자 시즌 기록이 아직 연결되지 않았습니다."
            }
          />
        )}
      </SectionCard>

      <SectionCard
        title="세부 기록 안내"
        subtitle="지금 단계에서는 기록실의 분류 체계를 먼저 만들고, 상세 지표는 선수 페이지와 공식 ingest 범위를 따라 점진적으로 넓혀 갑니다."
      >
        <div className="space-y-3 text-sm text-muted">
          <p>
            현재 분류 바에서 바로 동작하는 것은 `팀`, `포지션`, `월별/상황별 split`, `타자/투수/주루` 기준 리더보드입니다.
          </p>
          <p>
            `수비` 탭은 아직 공식 필드 데이터가 없어서 빈 상태로 두었고, 다음 단계에서 수비 지표 ingest가 붙으면 같은 구조 위에 그대로 확장할 수 있습니다.
          </p>
          <p>
            각 선수 카드를 누르면 시즌 기록, 월별 흐름, 상황별 split, 경기 로그가 연결된 상세 페이지로 이동합니다.
          </p>
        </div>
      </SectionCard>
    </div>
  );
}
