"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";

import { EmptyStateNote } from "@/components/shared/empty-state-note";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StandingsTable } from "@/components/standings/standings-table";
import {
  buildGameLogRows,
  buildHitterLeaderRows,
  buildPitcherLeaderRows,
  buildSplitExplorerRows,
  buildTeamRecordRows,
} from "@/lib/records/kbo-records";
import type { getSeasonDashboardData } from "@/lib/repositories/kbo/view-models";
import { cn } from "@/lib/utils/cn";
import { formatDateTimeLabel } from "@/lib/utils/format";
import { buildGameRoute, buildPlayerRoute, buildSeasonTeamRoute } from "@/lib/utils/routes";

type RecordsViewProps = {
  year: number;
  data: NonNullable<Awaited<ReturnType<typeof getSeasonDashboardData>>>;
};

type RecordsTab = "teams" | "hitters" | "pitchers" | "splits" | "games";

const RECORD_TABS: Array<{ key: RecordsTab; label: string; subtitle: string }> = [
  { key: "teams", label: "팀 기록", subtitle: "팀 성적과 팀 지표를 정렬해서 봅니다." },
  { key: "hitters", label: "타자", subtitle: "공식 선수 기록이 들어온 범위에서 타자 리더보드를 보여 줍니다." },
  { key: "pitchers", label: "투수", subtitle: "공식 선수 기록이 들어온 범위에서 투수 리더보드를 보여 줍니다." },
  { key: "splits", label: "분할 기록", subtitle: "홈/원정, 1점차, 좌우 상대 등 split 탐색입니다." },
  { key: "games", label: "경기 로그", subtitle: "팀명 검색과 종료 경기 필터로 로그를 훑습니다." },
];

export function RecordsView({ year, data }: RecordsViewProps) {
  const [activeTab, setActiveTab] = useState<RecordsTab>("teams");
  const [query, setQuery] = useState("");
  const [teamSort, setTeamSort] = useState<"wins" | "runsScored" | "runsAllowed" | "runDiff">("wins");
  const [hitterMetric, setHitterMetric] = useState<"ops" | "homeRuns" | "war" | "hits">("ops");
  const [pitcherMetric, setPitcherMetric] = useState<"era" | "strikeouts" | "wins" | "war">("era");
  const availableSplitTypes = useMemo(
    () => Array.from(new Set(data.teamSplitStats.map((item) => item.splitType))),
    [data.teamSplitStats],
  );
  const [splitType, setSplitType] = useState<"all" | "home" | "away" | "oneRun" | "extraInnings" | "vsLeft" | "vsRight">("all");
  const [finalOnly, setFinalOnly] = useState(true);
  const deferredQuery = useDeferredValue(query);

  const mostRunsTeam = [...data.teamSeasonStats].sort((left, right) => right.runsScored - left.runsScored)[0];
  const fewestRunsAllowedTeam = [...data.teamSeasonStats].sort((left, right) => left.runsAllowed - right.runsAllowed)[0];
  const bestRunDiffTeam = [...data.teamSeasonStats].sort(
    (left, right) => right.runsScored - right.runsAllowed - (left.runsScored - left.runsAllowed),
  )[0];
  const bestHomeTeam = [...data.teamSplitStats]
    .filter((item) => item.splitType === "home")
    .sort((left, right) => right.wins - right.losses - (left.wins - left.losses))[0];

  const teamRows = useMemo(
    () => buildTeamRecordRows(data.teamSeasonStats, data.displayById, teamSort, deferredQuery),
    [data.displayById, data.teamSeasonStats, deferredQuery, teamSort],
  );
  const hitterRows = useMemo(
    () => buildHitterLeaderRows(data.playerSeasonStats, data.players, data.displayById, hitterMetric, deferredQuery),
    [data.displayById, data.playerSeasonStats, data.players, deferredQuery, hitterMetric],
  );
  const pitcherRows = useMemo(
    () => buildPitcherLeaderRows(data.playerSeasonStats, data.players, data.displayById, pitcherMetric, deferredQuery),
    [data.displayById, data.playerSeasonStats, data.players, deferredQuery, pitcherMetric],
  );
  const splitRows = useMemo(
    () => buildSplitExplorerRows(data.teamSplitStats, data.displayById, splitType, deferredQuery),
    [data.displayById, data.teamSplitStats, deferredQuery, splitType],
  );
  const gameRows = useMemo(
    () => buildGameLogRows(data.games, data.displayById, deferredQuery, finalOnly).slice(0, 24),
    [data.displayById, data.games, deferredQuery, finalOnly],
  );

  const activeTabMeta = RECORD_TABS.find((item) => item.key === activeTab)!;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`${year} 기록실`}
        title="시즌 기록실"
        description="팀 순위와 요약 카드 위에, 팀 기록·타자·투수·분할 기록·경기 로그를 탭과 검색으로 계속 파고들 수 있게 만든 KBO 중심 기록실입니다."
      />

      <SectionCard title="팀 순위" subtitle="현재 시즌 공식 순위와 확률 지표를 함께 봅니다.">
        <StandingsTable year={year} rows={data.standings.rows} />
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-4">
        <div className="rounded-3xl border border-line/80 bg-white px-5 py-5">
          <p className="text-xs text-muted">최다 득점</p>
          <p className="mt-2 text-lg font-semibold text-ink">{data.displayById[mostRunsTeam.seasonTeamId].shortNameKo}</p>
          <p className="mt-2 text-sm text-muted">득점 {mostRunsTeam.runsScored}</p>
        </div>
        <div className="rounded-3xl border border-line/80 bg-white px-5 py-5">
          <p className="text-xs text-muted">최소 실점</p>
          <p className="mt-2 text-lg font-semibold text-ink">{data.displayById[fewestRunsAllowedTeam.seasonTeamId].shortNameKo}</p>
          <p className="mt-2 text-sm text-muted">실점 {fewestRunsAllowedTeam.runsAllowed}</p>
        </div>
        <div className="rounded-3xl border border-line/80 bg-white px-5 py-5">
          <p className="text-xs text-muted">득실차 선두</p>
          <p className="mt-2 text-lg font-semibold text-ink">{data.displayById[bestRunDiffTeam.seasonTeamId].shortNameKo}</p>
          <p className="mt-2 text-sm text-muted">득실차 {bestRunDiffTeam.runsScored - bestRunDiffTeam.runsAllowed > 0 ? "+" : ""}{bestRunDiffTeam.runsScored - bestRunDiffTeam.runsAllowed}</p>
        </div>
        <div className="rounded-3xl border border-line/80 bg-white px-5 py-5">
          <p className="text-xs text-muted">홈 성적 선두</p>
          <p className="mt-2 text-lg font-semibold text-ink">
            {bestHomeTeam ? data.displayById[bestHomeTeam.seasonTeamId].shortNameKo : "공식 split 대기"}
          </p>
          <p className="mt-2 text-sm text-muted">
            {bestHomeTeam ? bestHomeTeam.metricValue : "홈/원정 split은 공식 standings에서 바로 반영합니다."}
          </p>
        </div>
      </div>

      <SectionCard
        title={`탐색 탭 · ${activeTabMeta.label}`}
        subtitle={activeTabMeta.subtitle}
        actions={
          <div className="flex flex-wrap gap-2">
            {RECORD_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm",
                  activeTab === tab.key
                    ? "bg-accent text-white"
                    : "border border-line/80 bg-white text-muted",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        }
      >
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={
              activeTab === "games"
                ? "팀명으로 경기 로그 검색"
                : activeTab === "splits"
                  ? "팀명 또는 split 이름 검색"
                  : "팀명 또는 선수명 검색"
            }
            className="w-full rounded-2xl border border-line/80 bg-white px-4 py-2 text-sm text-ink lg:max-w-sm"
          />

          {activeTab === "teams" ? (
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
          ) : null}

          {activeTab === "hitters" ? (
            <select
              value={hitterMetric}
              onChange={(event) => setHitterMetric(event.target.value as typeof hitterMetric)}
              className="w-full rounded-2xl border border-line/80 bg-white px-4 py-2 text-sm text-ink lg:w-auto"
            >
              <option value="ops">OPS</option>
              <option value="homeRuns">홈런</option>
              <option value="war">WAR</option>
              <option value="hits">안타</option>
            </select>
          ) : null}

          {activeTab === "pitchers" ? (
            <select
              value={pitcherMetric}
              onChange={(event) => setPitcherMetric(event.target.value as typeof pitcherMetric)}
              className="w-full rounded-2xl border border-line/80 bg-white px-4 py-2 text-sm text-ink lg:w-auto"
            >
              <option value="era">ERA</option>
              <option value="strikeouts">탈삼진</option>
              <option value="wins">승수</option>
              <option value="war">WAR</option>
            </select>
          ) : null}

          {activeTab === "splits" ? (
            <select
              value={splitType}
              onChange={(event) => setSplitType(event.target.value as typeof splitType)}
              className="w-full rounded-2xl border border-line/80 bg-white px-4 py-2 text-sm text-ink lg:w-auto"
            >
              <option value="all">전체 split</option>
              {availableSplitTypes.includes("home") ? <option value="home">홈</option> : null}
              {availableSplitTypes.includes("away") ? <option value="away">원정</option> : null}
              {availableSplitTypes.includes("oneRun") ? <option value="oneRun">1점차 경기</option> : null}
              {availableSplitTypes.includes("extraInnings") ? <option value="extraInnings">연장전</option> : null}
              {availableSplitTypes.includes("vsLeft") ? <option value="vsLeft">좌완 상대</option> : null}
              {availableSplitTypes.includes("vsRight") ? <option value="vsRight">우완 상대</option> : null}
            </select>
          ) : null}

          {activeTab === "games" ? (
            <button
              type="button"
              onClick={() => setFinalOnly((current) => !current)}
              className={cn(
                "w-full rounded-full px-3 py-1.5 text-sm lg:w-auto",
                finalOnly
                  ? "bg-accent text-white"
                  : "border border-line/80 bg-white text-muted",
              )}
            >
              {finalOnly ? "종료 경기만" : "전체 경기"}
            </button>
          ) : null}
        </div>

        {activeTab === "teams" ? (
          <div className="space-y-2">
            {teamRows.map((stat) => (
              <Link
                key={stat.seasonTeamId}
                href={buildSeasonTeamRoute(year, data.displayById[stat.seasonTeamId].teamSlug)}
                className="grid gap-3 rounded-2xl border border-line/80 px-4 py-4 text-sm hover:border-accent md:grid-cols-[1.2fr_1fr_1fr_1fr]"
              >
                <span className="font-medium text-ink">{data.displayById[stat.seasonTeamId].displayNameKo}</span>
                <span className="text-muted">{stat.wins}-{stat.losses}-{stat.ties}</span>
                <span className="text-muted">득점 {stat.runsScored} / 실점 {stat.runsAllowed}</span>
                <span className="text-muted">득실차 {stat.runsScored - stat.runsAllowed > 0 ? "+" : ""}{stat.runsScored - stat.runsAllowed}</span>
              </Link>
            ))}
          </div>
        ) : null}

        {activeTab === "hitters" ? (
          hitterRows.length > 0 ? (
            <div className="space-y-2">
              {hitterRows.map((row, index) => (
                <Link
                  key={row.statId}
                  href={buildPlayerRoute(row.playerId)}
                  className="flex items-center justify-between rounded-2xl border border-line/80 px-4 py-4 text-sm hover:border-accent"
                >
                  <div className="flex items-center gap-4">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-ink">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-medium text-ink">{row.playerNameKo}</p>
                      <p className="mt-1 text-muted">{row.secondaryLabel}</p>
                    </div>
                  </div>
                  <span className="text-muted">{row.primaryLabel}</span>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyStateNote message="아직 공식 선수 요약 기록이 없는 날짜에는 타자 리더보드가 비어 있을 수 있습니다." />
          )
        ) : null}

        {activeTab === "pitchers" ? (
          pitcherRows.length > 0 ? (
            <div className="space-y-2">
              {pitcherRows.map((row, index) => (
                <Link
                  key={row.statId}
                  href={buildPlayerRoute(row.playerId)}
                  className="flex items-center justify-between rounded-2xl border border-line/80 px-4 py-4 text-sm hover:border-accent"
                >
                  <div className="flex items-center gap-4">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-ink">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-medium text-ink">{row.playerNameKo}</p>
                      <p className="mt-1 text-muted">{row.secondaryLabel}</p>
                    </div>
                  </div>
                  <span className="text-muted">{row.primaryLabel}</span>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyStateNote message="아직 공식 선수 요약 기록이 없는 날짜에는 투수 리더보드가 비어 있을 수 있습니다." />
          )
        ) : null}

        {activeTab === "splits" ? (
          splitRows.length > 0 ? (
            <div className="space-y-2">
              {splitRows.map((split) => (
                <div key={split.splitId} className="flex items-center justify-between rounded-2xl border border-line/80 px-4 py-4 text-sm">
                  <div>
                    <p className="font-medium text-ink">
                      {data.displayById[split.seasonTeamId].shortNameKo} · {split.metricLabel}
                    </p>
                    <p className="mt-1 text-muted">{split.splitType}</p>
                  </div>
                  <span className="text-muted">{split.metricValue}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyStateNote message="현재는 공식 홈/원정 split만 publish하고 있습니다. 세부 split은 공식 팀 기록 ingest 이후에 확장합니다." />
          )
        ) : null}

        {activeTab === "games" ? (
          gameRows.length > 0 ? (
            <div className="space-y-2">
              {gameRows.map((game) => (
                <Link
                  key={game.gameId}
                  href={buildGameRoute(game.gameId)}
                  className="block rounded-2xl border border-line/80 px-4 py-4 hover:border-accent"
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-ink">
                      {data.displayById[game.awaySeasonTeamId].shortNameKo} @ {data.displayById[game.homeSeasonTeamId].shortNameKo}
                    </span>
                    <span className="text-muted">
                      {game.status === "final" ? `${game.awayScore}:${game.homeScore}` : game.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted">{formatDateTimeLabel(game.scheduledAt)}</p>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyStateNote message="현재 검색 조건에 맞는 경기 로그가 없습니다. 팀명을 지우거나 `종료 경기만` 필터를 꺼서 다시 확인해 주세요." />
          )
        ) : null}
      </SectionCard>

      <SectionCard title="주요 기록 요약" subtitle="공식 summary / awards ingest가 들어오기 전에는 이 영역을 비워 둡니다.">
        {data.summary?.narrative?.length || data.awards.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {data.summary?.narrative.map((line) => (
              <div key={line} className="rounded-2xl border border-line/80 bg-slate-50 px-4 py-4 text-sm text-muted">
                {line}
              </div>
            ))}
            {data.awards.map((award) => (
              <div key={award.awardId} className="rounded-2xl border border-line/80 bg-slate-50 px-4 py-4 text-sm text-muted">
                <span className="font-medium text-ink">{award.label}</span>
                <p className="mt-1">{award.note}</p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyStateNote message="현재는 공식 일정·경기·순위 데이터를 우선 반영하고 있으며, 시즌 narrative와 수상 정보는 공식 아카이브 ingest가 붙으면 공개합니다." />
        )}
      </SectionCard>
    </div>
  );
}
