import Link from "next/link";

import { EmptyStateNote } from "@/components/shared/empty-state-note";
import { MetricBadge } from "@/components/shared/metric-badge";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import type { getPlayerPageData } from "@/lib/repositories/kbo/view-models";
import { formatDateLabel } from "@/lib/utils/format";
import { buildGameRoute, buildSeasonRecordsRoute } from "@/lib/utils/routes";

type PlayerDetailViewProps = {
  data: NonNullable<Awaited<ReturnType<typeof getPlayerPageData>>>;
};

type PlayerMetricItem = {
  label: string;
  value: string;
  tone?: "neutral" | "positive" | "negative";
};

type PlayerSplitDetailItem = {
  statType?: "hitter" | "pitcher";
  battingAverage?: number | null;
  hits?: number | null;
  homeRuns?: number | null;
  rbi?: number | null;
  era?: number | null;
  inningsPitched?: number | null;
  opponentAvg?: number | null;
  strikeouts?: number | null;
};

type PlayerGameLogDetailItem = {
  statType?: "hitter" | "pitcher";
  battingAverage?: number | null;
  atBats?: number | null;
  hits?: number | null;
  homeRuns?: number | null;
  rbi?: number | null;
  walks?: number | null;
  era?: number | null;
  inningsPitched?: number | null;
  hitsAllowed?: number | null;
  earnedRuns?: number | null;
  runsAllowed?: number | null;
  strikeouts?: number | null;
  result?: string | null;
};

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "-";
  }
  return value.toLocaleString("ko-KR");
}

function formatRate(value: number | null | undefined, digits: number) {
  if (value === null || value === undefined) {
    return "-";
  }
  return value.toFixed(digits);
}

function formatRateLabel(value: number | null | undefined, digits: number) {
  const formatted = formatRate(value, digits);
  return formatted === "-" ? formatted : formatted.replace(/^0(?=\.)/, "");
}

function formatInnings(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "-";
  }
  const whole = Math.trunc(value);
  const thirds = Math.round((value - whole) * 3);
  if (thirds <= 0) {
    return String(whole);
  }
  return `${whole} ${thirds}/3`;
}

function formatTableValue(value: number | null | undefined) {
  return value === null || value === undefined ? "-" : formatNumber(value);
}

function buildProfileItems(data: PlayerDetailViewProps["data"], latestStat: PlayerDetailViewProps["data"]["statsBySeason"][number] | null) {
  return [
    { label: "생년월일", value: data.player.birthDate ?? "-" },
    { label: "투타", value: data.player.batsThrows ?? "-" },
    { label: "체격", value: data.player.heightWeight ?? "-" },
    { label: "주 포지션", value: data.player.primaryPositions.join(", ") || "-" },
    { label: "데뷔연도", value: String(data.player.debutYear) },
    { label: "지명순위", value: data.player.draftInfo ?? "-" },
    { label: "입단년도", value: data.player.joinInfo ?? "-" },
    { label: "프랜차이즈", value: data.franchiseLabels.join(", ") || "-" },
    { label: "최근 시즌 팀", value: latestStat?.teamLabel ?? "-" },
  ];
}

function buildHeroFacts(data: PlayerDetailViewProps["data"], latestStat: PlayerDetailViewProps["data"]["statsBySeason"][number] | null) {
  return [
    { label: "소속", value: latestStat?.teamLabel ?? data.franchiseLabels.at(-1) ?? "-" },
    { label: "체격", value: data.player.heightWeight ?? "-" },
    { label: "투타", value: data.player.batsThrows ?? "-" },
    { label: "입단", value: data.player.joinInfo ?? "-" },
  ];
}

function buildSeasonSummaryMetrics(
  currentSeasonFocus: NonNullable<PlayerDetailViewProps["data"]["currentSeasonFocus"]>,
): PlayerMetricItem[] {
  if (currentSeasonFocus.statType === "hitter") {
    return [
      { label: "경기", value: formatNumber(currentSeasonFocus.games) },
      { label: "타율", value: formatRateLabel(currentSeasonFocus.battingAverage, 3), tone: "positive" },
      { label: "안타", value: formatNumber(currentSeasonFocus.hits) },
      { label: "홈런", value: formatNumber(currentSeasonFocus.homeRuns) },
      { label: "타점", value: formatNumber(currentSeasonFocus.rbi) },
      { label: "OPS", value: formatRate(currentSeasonFocus.ops, 3), tone: "positive" },
    ];
  }

  return [
    { label: "경기", value: formatNumber(currentSeasonFocus.games) },
    { label: "이닝", value: formatInnings(currentSeasonFocus.inningsPitched) },
    { label: "ERA", value: formatRate(currentSeasonFocus.era, 2), tone: "positive" },
    { label: "WHIP", value: formatRate(currentSeasonFocus.whip, 2) },
    { label: "탈삼진", value: formatNumber(currentSeasonFocus.strikeouts) },
    { label: "승리", value: formatNumber(currentSeasonFocus.wins) },
  ];
}

function buildCareerSummaryMetrics(data: PlayerDetailViewProps["data"], statType: "hitter" | "pitcher") {
  if (statType === "hitter") {
    return [
      { label: "기록 시즌", value: String(data.careerSummary.seasons) },
      { label: "통산 경기", value: formatNumber(data.careerSummary.hitterGames) },
      { label: "통산 안타", value: formatNumber(data.careerSummary.hits) },
      { label: "통산 홈런", value: formatNumber(data.careerSummary.homeRuns) },
      { label: "통산 타점", value: formatNumber(data.careerSummary.rbi) },
    ] as PlayerMetricItem[];
  }

  return [
    { label: "기록 시즌", value: String(data.careerSummary.seasons) },
    { label: "통산 경기", value: formatNumber(data.careerSummary.pitcherGames) },
    { label: "통산 승리", value: formatNumber(data.careerSummary.wins) },
    { label: "통산 세이브", value: formatNumber(data.careerSummary.saves) },
    { label: "통산 홀드", value: formatNumber(data.careerSummary.holds) },
    { label: "통산 탈삼진", value: formatNumber(data.careerSummary.strikeouts) },
  ] as PlayerMetricItem[];
}

function buildRecentFormMetrics(
  gameLogs: PlayerDetailViewProps["data"]["gameLogs"],
  statType: "hitter" | "pitcher",
) {
  const recentGames = gameLogs.filter((gameLog) => gameLog.statType === statType).slice(0, 5);
  if (recentGames.length === 0) {
    return [];
  }

  if (statType === "hitter") {
    const totals = recentGames.reduce(
      (accumulator, gameLog) => ({
        atBats: accumulator.atBats + (gameLog.atBats ?? 0),
        hits: accumulator.hits + (gameLog.hits ?? 0),
        homeRuns: accumulator.homeRuns + (gameLog.homeRuns ?? 0),
        rbi: accumulator.rbi + (gameLog.rbi ?? 0),
        walks: accumulator.walks + (gameLog.walks ?? 0),
      }),
      {
        atBats: 0,
        hits: 0,
        homeRuns: 0,
        rbi: 0,
        walks: 0,
      },
    );

    return [
      { label: "최근 경기", value: String(recentGames.length) },
      {
        label: "최근 타율",
        value: totals.atBats > 0 ? formatRateLabel(totals.hits / totals.atBats, 3) : "-",
        tone: "positive",
      },
      { label: "안타", value: formatNumber(totals.hits) },
      { label: "홈런", value: formatNumber(totals.homeRuns) },
      { label: "타점", value: formatNumber(totals.rbi) },
      { label: "볼넷", value: formatNumber(totals.walks) },
    ] as PlayerMetricItem[];
  }

  const totals = recentGames.reduce(
    (accumulator, gameLog) => ({
      inningsPitched: accumulator.inningsPitched + (gameLog.inningsPitched ?? 0),
      hitsAllowed: accumulator.hitsAllowed + (gameLog.hitsAllowed ?? 0),
      earnedRuns: accumulator.earnedRuns + (gameLog.earnedRuns ?? 0),
      strikeouts: accumulator.strikeouts + (gameLog.strikeouts ?? 0),
    }),
    {
      inningsPitched: 0,
      hitsAllowed: 0,
      earnedRuns: 0,
      strikeouts: 0,
    },
  );
  const recentEra =
    totals.inningsPitched > 0 ? (totals.earnedRuns * 9) / totals.inningsPitched : null;

  return [
    { label: "최근 경기", value: String(recentGames.length) },
    { label: "이닝", value: formatInnings(totals.inningsPitched) },
    { label: "ERA", value: formatRate(recentEra, 2), tone: "positive" },
    { label: "피안타", value: formatNumber(totals.hitsAllowed) },
    { label: "자책", value: formatNumber(totals.earnedRuns) },
    { label: "탈삼진", value: formatNumber(totals.strikeouts) },
  ] as PlayerMetricItem[];
}

function buildSplitDetailLine(split: PlayerSplitDetailItem) {
  if (split.statType === "hitter") {
    return [
      split.battingAverage !== null && split.battingAverage !== undefined
        ? `타율 ${formatRateLabel(split.battingAverage, 3)}`
        : null,
      split.hits !== null && split.hits !== undefined ? `${formatNumber(split.hits)}안타` : null,
      split.homeRuns !== null && split.homeRuns !== undefined ? `${formatNumber(split.homeRuns)}홈런` : null,
      split.rbi !== null && split.rbi !== undefined ? `${formatNumber(split.rbi)}타점` : null,
    ]
      .filter((value): value is string => value !== null)
      .join(" · ");
  }

  return [
    split.era !== null && split.era !== undefined ? `ERA ${formatRate(split.era, 2)}` : null,
    split.inningsPitched !== null && split.inningsPitched !== undefined
      ? `${formatInnings(split.inningsPitched)}이닝`
      : null,
    split.opponentAvg !== null && split.opponentAvg !== undefined
      ? `피안타율 ${formatRateLabel(split.opponentAvg, 3)}`
      : null,
    split.strikeouts !== null && split.strikeouts !== undefined ? `${formatNumber(split.strikeouts)}K` : null,
  ]
    .filter((value): value is string => value !== null)
    .join(" · ");
}

function buildGameLogDetailLine(gameLog: PlayerGameLogDetailItem) {
  if (gameLog.statType === "hitter") {
    return [
      gameLog.atBats !== null && gameLog.atBats !== undefined ? `${formatNumber(gameLog.atBats)}타수` : null,
      gameLog.hits !== null && gameLog.hits !== undefined ? `${formatNumber(gameLog.hits)}안타` : null,
      gameLog.homeRuns !== null && gameLog.homeRuns !== undefined ? `${formatNumber(gameLog.homeRuns)}홈런` : null,
      gameLog.rbi !== null && gameLog.rbi !== undefined ? `${formatNumber(gameLog.rbi)}타점` : null,
      gameLog.walks !== null && gameLog.walks !== undefined ? `${formatNumber(gameLog.walks)}볼넷` : null,
    ]
      .filter((value): value is string => value !== null)
      .join(" · ");
  }

  return [
    gameLog.result ? gameLog.result : null,
    gameLog.inningsPitched !== null && gameLog.inningsPitched !== undefined
      ? `${formatInnings(gameLog.inningsPitched)}이닝`
      : null,
    gameLog.runsAllowed !== null && gameLog.runsAllowed !== undefined
      ? `${formatNumber(gameLog.runsAllowed)}실점`
      : null,
    gameLog.earnedRuns !== null && gameLog.earnedRuns !== undefined
      ? `${formatNumber(gameLog.earnedRuns)}자책`
      : null,
    gameLog.strikeouts !== null && gameLog.strikeouts !== undefined ? `${formatNumber(gameLog.strikeouts)}K` : null,
  ]
    .filter((value): value is string => value !== null)
    .join(" · ");
}

export function PlayerDetailView({ data }: PlayerDetailViewProps) {
  const latestStat = data.statsBySeason[0] ?? null;
  const currentSeasonFocus = data.currentSeasonFocus;
  const statType =
    currentSeasonFocus?.statType ??
    latestStat?.statType ??
    (data.player.primaryPositions.some((position) => position.includes("P")) ? "pitcher" : "hitter");
  const statTypeLabel = statType === "hitter" ? "타자" : "투수";
  const seasonSummaryMetrics = currentSeasonFocus ? buildSeasonSummaryMetrics(currentSeasonFocus) : [];
  const careerSummaryMetrics = buildCareerSummaryMetrics(data, statType);
  const recordCategory = statType === "hitter" ? "hitters" : "pitchers";
  const recentGameLogs = data.gameLogs.slice(0, 10);
  const recentFormMetrics = buildRecentFormMetrics(data.gameLogs, statType);
  const profileItems = buildProfileItems(data, latestStat);
  const heroFacts = buildHeroFacts(data, latestStat);
  const latestTeamLabel = latestStat?.teamLabel ?? data.franchiseLabels.at(-1) ?? "-";
  const latestSeasonLabel = latestStat?.seasonLabel ?? "기록 대기";
  const awardCountLabel = `${data.awardHistory.length}건`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`${statTypeLabel} 기록`}
        title={data.player.nameKo}
        description={`공식 시즌 기록, 월별 흐름, 상황별 split, 최근 경기 로그를 묶어 ${statTypeLabel} 기록을 한 페이지에서 읽기 쉽게 정리했습니다.`}
        actions={
          latestStat ? (
            <Link
              href={buildSeasonRecordsRoute(latestStat.seasonYear, recordCategory)}
              className="inline-flex rounded-full border border-line/80 bg-white px-3 py-1.5 text-sm text-muted transition-colors hover:border-accent hover:text-accent"
            >
              {latestStat.seasonYear} {statTypeLabel}기록으로 이동
            </Link>
          ) : null
        }
      />

      <section className="overflow-hidden rounded-[2rem] border border-line/80 bg-white shadow-panel">
        <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-5 bg-[linear-gradient(135deg,rgba(15,23,42,0.03),rgba(14,165,233,0.1))] px-5 py-6 sm:px-6 sm:py-7">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-accent">
                {latestSeasonLabel}
              </span>
              <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white">
                {statTypeLabel}
              </span>
              <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-muted">
                {data.player.primaryPositions.join(", ") || "-"}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-muted">{latestTeamLabel}</p>
                <h2 className="mt-2 text-3xl font-display font-semibold tracking-tight text-ink sm:text-4xl">
                  {data.player.nameKo}
                </h2>
                <p className="mt-2 text-sm text-muted sm:text-base">
                  {data.player.birthDate ?? "-"} · {data.player.heightWeight ?? "-"} · {data.player.batsThrows ?? "-"}
                </p>
              </div>

              <p className="max-w-3xl text-sm leading-6 text-muted sm:text-base">
                {data.player.bio}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {heroFacts.map((fact) => (
                <div key={fact.label} className="rounded-2xl border border-white/70 bg-white/90 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                    {fact.label}
                  </p>
                  <p className="mt-2 text-sm font-medium text-ink">{fact.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 border-t border-line/70 bg-slate-50/90 px-5 py-6 sm:px-6 sm:py-7 lg:border-l lg:border-t-0">
            <MetricBadge label="데뷔연도" value={String(data.player.debutYear)} />
            <MetricBadge label="공식 수상" value={awardCountLabel} tone={data.awardHistory.length > 0 ? "positive" : "neutral"} />
            <MetricBadge label="기록 시즌" value={String(data.careerSummary.seasons)} />
            <MetricBadge label="지명순위" value={data.player.draftInfo ?? "-"} />
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-4">
        <MetricBadge
          label="최근 시즌"
          value={latestStat ? `${latestStat.seasonLabel} · ${latestStat.teamLabel}` : "-"}
        />
        <MetricBadge label="기록 유형" value={statTypeLabel} />
        <MetricBadge label="주 포지션" value={data.player.primaryPositions.join(", ")} />
        <MetricBadge label="투타" value={data.player.batsThrows ?? "-"} />
      </div>

      <SectionCard
        title="현재 시즌 요약"
        subtitle="공식 시즌 기록이 연결된 범위에서 현재 시즌 핵심 기록과 팀 내/리그 내 위치를 먼저 확인합니다."
      >
        {currentSeasonFocus ? (
          <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
              {seasonSummaryMetrics.map((metric) => (
                <MetricBadge
                  key={metric.label}
                  label={metric.label}
                  value={metric.value}
                  tone={metric.tone}
                />
              ))}
            </div>

            <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
              {currentSeasonFocus.rankingMetrics.map((metric) => (
                <div
                  key={metric.key}
                  className="rounded-2xl border border-line/80 bg-white px-4 py-4"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                    {metric.label}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-ink">{metric.valueLabel}</p>
                  <p className="mt-2 text-sm text-muted">
                    리그 {metric.leagueRank}위 / {metric.leagueTotal}명
                  </p>
                  <p className="text-sm text-muted">
                    팀 내 {metric.teamRank}위 / {metric.teamTotal}명
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <EmptyStateNote message="아직 공식 선수 시즌 기록이 연결되지 않아 현재 시즌 요약을 계산하지 못했습니다." />
        )}
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <SectionCard title="기본 프로필" subtitle="선수의 기본 신상과 소속 이력을 기록실 관점으로 정리했습니다.">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {profileItems.map((item) => (
                <div key={item.label} className="rounded-2xl border border-line/80 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                    {item.label}
                  </p>
                  <p className="mt-2 text-sm text-ink">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-line/80 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">경력</p>
              <p className="mt-2 text-sm text-ink">{data.player.careerHistory ?? "-"}</p>
            </div>

            <div className="rounded-2xl border border-line/80 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">프로필 요약</p>
              <p className="mt-2 text-sm text-ink">{data.player.bio}</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="통산 요약"
          subtitle="현재 확보된 연도별 공식 기록을 기준으로 통산 범위를 한 번에 읽습니다."
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {careerSummaryMetrics.map((metric) => (
              <MetricBadge
                key={metric.label}
                label={metric.label}
                value={metric.value}
                tone={metric.tone}
              />
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="공식 수상 이력"
        subtitle={
          data.awardHistory.length > 0
            ? `공식 수상 ${data.awardHistory.length}건을 시즌순으로 정리했습니다.`
            : "공식 수상 데이터가 연결되면 시즌별 수상 이력을 함께 제공합니다."
        }
      >
        {data.awardHistory.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {data.awardHistory.map((award) => (
              <div
                key={award.awardId}
                className="rounded-3xl border border-line/80 bg-white px-4 py-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                      {award.seasonYear}
                    </p>
                    <p className="mt-2 text-lg font-semibold text-ink">{award.label}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-muted">
                    {award.teamLabel}
                  </span>
                </div>
                <p className="mt-3 text-sm text-muted">{award.note}</p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyStateNote message="아직 이 선수와 연결된 공식 수상 이력이 없습니다." />
        )}
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <SectionCard
          title="월별 흐름"
          subtitle={
            data.monthlySplits.length > 0
              ? `최근 월 ${data.monthlySplits[data.monthlySplits.length - 1]?.splitLabel} · ${data.monthlySplits[data.monthlySplits.length - 1]?.summaryLine}`
              : "월별 split이 연결되면 시즌 흐름을 월 단위로 살펴볼 수 있습니다."
          }
        >
          {data.monthlySplits.length ? (
            <div className="overflow-x-auto rounded-3xl border border-line/80">
              <table className="min-w-full text-sm">
                <thead className="border-b border-line/80 bg-slate-50 text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-3 text-left">월</th>
                    <th className="px-4 py-3 text-right">경기</th>
                    {statType === "hitter" ? (
                      <>
                        <th className="px-4 py-3 text-right">타율</th>
                        <th className="px-4 py-3 text-right">안타</th>
                        <th className="px-4 py-3 text-right">홈런</th>
                        <th className="px-4 py-3 text-right">타점</th>
                        <th className="px-4 py-3 text-right">볼넷</th>
                        <th className="px-4 py-3 text-right">삼진</th>
                      </>
                    ) : (
                      <>
                        <th className="px-4 py-3 text-right">이닝</th>
                        <th className="px-4 py-3 text-right">ERA</th>
                        <th className="px-4 py-3 text-right">피안타율</th>
                        <th className="px-4 py-3 text-right">피안타</th>
                        <th className="px-4 py-3 text-right">볼넷</th>
                        <th className="px-4 py-3 text-right">탈삼진</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {data.monthlySplits.map((split) => (
                    <tr key={split.playerSplitStatId} className="border-b border-line/60 last:border-0">
                      <td className="px-4 py-3 text-left font-medium text-ink">{split.splitLabel}</td>
                      <td className="px-4 py-3 text-right text-muted">{formatTableValue(split.games)}</td>
                      {statType === "hitter" ? (
                        <>
                          <td className="px-4 py-3 text-right text-muted">
                            {formatRateLabel(split.battingAverage, 3)}
                          </td>
                          <td className="px-4 py-3 text-right text-muted">{formatTableValue(split.hits)}</td>
                          <td className="px-4 py-3 text-right text-muted">{formatTableValue(split.homeRuns)}</td>
                          <td className="px-4 py-3 text-right text-muted">{formatTableValue(split.rbi)}</td>
                          <td className="px-4 py-3 text-right text-muted">{formatTableValue(split.walks)}</td>
                          <td className="px-4 py-3 text-right text-muted">{formatTableValue(split.strikeouts)}</td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3 text-right text-muted">
                            {formatInnings(split.inningsPitched)}
                          </td>
                          <td className="px-4 py-3 text-right text-muted">{formatRate(split.era, 2)}</td>
                          <td className="px-4 py-3 text-right text-muted">
                            {formatRateLabel(split.opponentAvg, 3)}
                          </td>
                          <td className="px-4 py-3 text-right text-muted">{formatTableValue(split.hitsAllowed)}</td>
                          <td className="px-4 py-3 text-right text-muted">{formatTableValue(split.walks)}</td>
                          <td className="px-4 py-3 text-right text-muted">{formatTableValue(split.strikeouts)}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyStateNote message="월별 split은 공식 선수 Splits 페이지 ingest가 연결되면 제공합니다." />
          )}
        </SectionCard>

        <SectionCard
          title="상황별 기록"
          subtitle="상대 유형, 카운트, 주자 상황, 이닝, 타순 문맥을 그룹별로 묶어서 보여줍니다."
        >
          {data.situationSplitGroups.length ? (
            <div className="space-y-4">
              {data.situationSplitGroups.map((group) => (
                <div
                  key={group.key}
                  className="rounded-3xl border border-line/80 bg-white/80 px-4 py-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-semibold text-ink">{group.title}</p>
                    <span className="text-xs text-muted">{group.splits.length}개</span>
                  </div>
                  <div className="space-y-2">
                    {group.splits.map((split) => (
                      <div
                        key={split.playerSplitStatId}
                        className="flex flex-col gap-2 rounded-2xl border border-line/80 px-4 py-4 text-sm sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="font-medium text-ink">{split.splitLabel}</p>
                          <p className="mt-1 text-muted">{split.teamLabel}</p>
                        </div>
                        <span className="text-muted sm:text-right">
                          {buildSplitDetailLine(split) || split.summaryLine}
                        </span>
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

      <SectionCard
        title="최근 경기 로그"
        subtitle={
          recentGameLogs.length > 0
            ? `가장 최근 ${recentGameLogs.length}경기 기록을 경기 상세와 연결했습니다.`
            : "공식 경기 로그가 연결되면 최근 경기 기록을 날짜순으로 확인할 수 있습니다."
        }
      >
        {recentGameLogs.length ? (
          <div className="space-y-4">
            {recentFormMetrics.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                {recentFormMetrics.map((metric) => (
                  <MetricBadge
                    key={metric.label}
                    label={metric.label}
                    value={metric.value}
                    tone={metric.tone}
                  />
                ))}
              </div>
            ) : null}

            <div className="overflow-x-auto rounded-3xl border border-line/80">
              <table className="min-w-full text-sm">
                <thead className="border-b border-line/80 bg-slate-50 text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-3 text-left">날짜</th>
                    <th className="px-4 py-3 text-left">상대</th>
                    {statType === "hitter" ? (
                      <>
                        <th className="px-4 py-3 text-right">타율</th>
                        <th className="px-4 py-3 text-right">타수</th>
                        <th className="px-4 py-3 text-right">안타</th>
                        <th className="px-4 py-3 text-right">홈런</th>
                        <th className="px-4 py-3 text-right">타점</th>
                        <th className="px-4 py-3 text-right">볼넷</th>
                        <th className="px-4 py-3 text-right">삼진</th>
                      </>
                    ) : (
                      <>
                        <th className="px-4 py-3 text-right">결과</th>
                        <th className="px-4 py-3 text-right">이닝</th>
                        <th className="px-4 py-3 text-right">ERA</th>
                        <th className="px-4 py-3 text-right">피안타</th>
                        <th className="px-4 py-3 text-right">실점</th>
                        <th className="px-4 py-3 text-right">자책</th>
                        <th className="px-4 py-3 text-right">볼넷</th>
                        <th className="px-4 py-3 text-right">탈삼진</th>
                      </>
                    )}
                    <th className="px-4 py-3 text-right">경기</th>
                  </tr>
                </thead>
                <tbody>
                  {recentGameLogs.map((gameStat) => (
                    <tr key={gameStat.playerGameStatId} className="border-b border-line/60 last:border-0">
                      <td className="px-4 py-3 text-left font-medium text-ink">
                        {formatDateLabel(gameStat.game.scheduledAt)}
                      </td>
                      <td className="px-4 py-3 text-left text-muted">{gameStat.opponentLabel}</td>
                      {statType === "hitter" ? (
                        <>
                          <td className="px-4 py-3 text-right text-muted">
                            {formatRateLabel(gameStat.battingAverage, 3)}
                          </td>
                          <td className="px-4 py-3 text-right text-muted">{formatTableValue(gameStat.atBats)}</td>
                          <td className="px-4 py-3 text-right text-muted">{formatTableValue(gameStat.hits)}</td>
                          <td className="px-4 py-3 text-right text-muted">{formatTableValue(gameStat.homeRuns)}</td>
                          <td className="px-4 py-3 text-right text-muted">{formatTableValue(gameStat.rbi)}</td>
                          <td className="px-4 py-3 text-right text-muted">{formatTableValue(gameStat.walks)}</td>
                          <td className="px-4 py-3 text-right text-muted">{formatTableValue(gameStat.strikeouts)}</td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3 text-right text-muted">{gameStat.result ?? "-"}</td>
                          <td className="px-4 py-3 text-right text-muted">
                            {formatInnings(gameStat.inningsPitched)}
                          </td>
                          <td className="px-4 py-3 text-right text-muted">{formatRate(gameStat.era, 2)}</td>
                          <td className="px-4 py-3 text-right text-muted">{formatTableValue(gameStat.hitsAllowed)}</td>
                          <td className="px-4 py-3 text-right text-muted">{formatTableValue(gameStat.runsAllowed)}</td>
                          <td className="px-4 py-3 text-right text-muted">{formatTableValue(gameStat.earnedRuns)}</td>
                          <td className="px-4 py-3 text-right text-muted">{formatTableValue(gameStat.walks)}</td>
                          <td className="px-4 py-3 text-right text-muted">{formatTableValue(gameStat.strikeouts)}</td>
                        </>
                      )}
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={buildGameRoute(gameStat.gameId)}
                          className="text-sm font-medium text-accent transition-colors hover:text-accent-strong"
                        >
                          보기
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <EmptyStateNote message="경기 로그는 공식 선수 경기 기록 ingest가 연결되면 제공합니다." />
        )}
      </SectionCard>

      <SectionCard
        title="연도별 기록"
        subtitle="기록실 관점에서 시즌별 기록을 한 표로 정리해 변화 추이를 빠르게 읽습니다."
      >
        {data.statsBySeason.length ? (
          <div className="overflow-x-auto rounded-3xl border border-line/80">
            <table className="min-w-full text-sm">
              <thead className="border-b border-line/80 bg-slate-50 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 text-left">시즌</th>
                  <th className="px-4 py-3 text-left">팀</th>
                  <th className="px-4 py-3 text-right">경기</th>
                  {statType === "hitter" ? (
                    <>
                      <th className="px-4 py-3 text-right">타율</th>
                      <th className="px-4 py-3 text-right">안타</th>
                      <th className="px-4 py-3 text-right">홈런</th>
                      <th className="px-4 py-3 text-right">타점</th>
                      <th className="px-4 py-3 text-right">OPS</th>
                    </>
                  ) : (
                    <>
                      <th className="px-4 py-3 text-right">이닝</th>
                      <th className="px-4 py-3 text-right">승</th>
                      <th className="px-4 py-3 text-right">패</th>
                      <th className="px-4 py-3 text-right">세이브</th>
                      <th className="px-4 py-3 text-right">홀드</th>
                      <th className="px-4 py-3 text-right">탈삼진</th>
                      <th className="px-4 py-3 text-right">ERA</th>
                      <th className="px-4 py-3 text-right">WHIP</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {data.statsBySeason.map((stat) => (
                  <tr key={stat.statId} className="border-b border-line/60 last:border-0">
                    <td className="px-4 py-3 text-left font-medium text-ink">{stat.seasonLabel}</td>
                    <td className="px-4 py-3 text-left text-muted">{stat.teamLabel}</td>
                    <td className="px-4 py-3 text-right text-muted">{formatNumber(stat.games)}</td>
                    {statType === "hitter" ? (
                      <>
                        <td className="px-4 py-3 text-right text-muted">
                          {formatRateLabel(stat.battingAverage, 3)}
                        </td>
                        <td className="px-4 py-3 text-right text-muted">
                          {formatNumber(stat.hits)}
                        </td>
                        <td className="px-4 py-3 text-right text-muted">
                          {formatNumber(stat.homeRuns)}
                        </td>
                        <td className="px-4 py-3 text-right text-muted">
                          {formatNumber(stat.rbi)}
                        </td>
                        <td className="px-4 py-3 text-right text-muted">
                          {formatRate(stat.ops, 3)}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-right text-muted">
                          {formatInnings(stat.inningsPitched)}
                        </td>
                        <td className="px-4 py-3 text-right text-muted">
                          {formatNumber(stat.wins)}
                        </td>
                        <td className="px-4 py-3 text-right text-muted">
                          {formatNumber(stat.losses)}
                        </td>
                        <td className="px-4 py-3 text-right text-muted">
                          {formatNumber(stat.saves)}
                        </td>
                        <td className="px-4 py-3 text-right text-muted">
                          {formatNumber(stat.holds)}
                        </td>
                        <td className="px-4 py-3 text-right text-muted">
                          {formatNumber(stat.strikeouts)}
                        </td>
                        <td className="px-4 py-3 text-right text-muted">
                          {formatRate(stat.era, 2)}
                        </td>
                        <td className="px-4 py-3 text-right text-muted">
                          {formatRate(stat.whip, 2)}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyStateNote message="공식 선수 기록 ingest 전까지는 연도별 기록 표를 표시하지 않습니다." />
        )}
      </SectionCard>

      <SectionCard
        title="로스터 이벤트 / 시즌 메모"
        subtitle="공식 엔트리 변동 데이터가 연결된 경우 선수 문맥을 함께 봅니다."
      >
        {data.rosterEvents.length > 0 ? (
          <div className="space-y-2">
            {data.rosterEvents.map((event) => (
              <div
                key={event.rosterEventId}
                className="rounded-2xl border border-line/80 px-4 py-4 text-sm"
              >
                <p className="font-medium text-ink">{event.type}</p>
                <p className="mt-1 text-muted">{event.date}</p>
                <p className="mt-2 text-muted">{event.note}</p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyStateNote message="현재 공개된 공식 엔트리 변동 데이터가 없어 로스터 이벤트를 표시하지 않습니다." />
        )}
      </SectionCard>
    </div>
  );
}
