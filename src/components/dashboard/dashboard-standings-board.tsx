import Link from "next/link";

import type { StandingRow } from "@/lib/domain/kbo/types";
import { cn } from "@/lib/utils/cn";
import { formatGamesBack, formatPct, formatPercent, formatRecordLabel } from "@/lib/utils/format";
import { buildSeasonTeamRoute } from "@/lib/utils/routes";

type DashboardStandingsBoardProps = {
  year: number;
  rows: StandingRow[];
};

type ProbabilityMeter = {
  label: string;
  value: number | null;
};

type SummaryStat = {
  label: string;
  value: string;
  tone?: "neutral" | "accent" | "positive" | "negative";
};

function formatGamesBackLabel(row: StandingRow): string {
  return row.gamesBack === 0 ? "선두" : `${formatGamesBack(row.gamesBack)} GB`;
}

function buildStandingStatus(row: StandingRow): string {
  return row.gamesBack === 0 ? "선두 유지" : `게임차 ${formatGamesBackLabel(row)}`;
}

function buildCompactSummary(row: StandingRow): string {
  return `${formatRecordLabel(row.wins, row.losses, row.ties)} · 승률 ${formatPct(row.pct)} · 최근 ${row.recent10} · ${row.streak}`;
}

function buildMeters(row: StandingRow): ProbabilityMeter[] {
  const postseasonProb = row.bucketOdds ? 1 - row.bucketOdds.missPostseason : null;
  return [
    { label: "1위", value: row.bucketOdds?.first ?? null },
    { label: "5강", value: postseasonProb },
    { label: "우승", value: row.postseasonOdds?.champion ?? null },
  ];
}

function buildSummaryStats(row: StandingRow): SummaryStat[] {
  const streakTone =
    row.streak.startsWith("W") || row.streak.includes("승")
      ? "positive"
      : row.streak.startsWith("L") || row.streak.includes("패")
        ? "negative"
        : "neutral";

  return [
    {
      label: "시즌 성적",
      value: formatRecordLabel(row.wins, row.losses, row.ties),
    },
    {
      label: "승률",
      value: formatPct(row.pct),
      tone: "accent",
    },
    {
      label: "최근 10경기",
      value: row.recent10,
    },
    {
      label: "연속 흐름",
      value: row.streak,
      tone: streakTone,
    },
  ];
}

function summaryStatClassName(tone: SummaryStat["tone"]) {
  switch (tone) {
    case "accent":
      return "border-[color:color-mix(in_srgb,var(--accent)_16%,white)] bg-[color:color-mix(in_srgb,var(--accent)_7%,white)]";
    case "positive":
      return "border-emerald-200 bg-emerald-50";
    case "negative":
      return "border-orange-200 bg-orange-50";
    case "neutral":
    default:
      return "border-line/70 bg-white/80";
  }
}

export function DashboardStandingsBoard({ year, rows }: DashboardStandingsBoardProps) {
  return (
    <div className="space-y-2 sm:space-y-2.5">
      {rows.map((row) => {
        const meters = buildMeters(row);
        const summaryStats = buildSummaryStats(row);
        const inPostseasonCut = row.rank <= 5;
        const standingStatus = buildStandingStatus(row);
        const compactSummary = buildCompactSummary(row);

        return (
          <Link
            key={row.seasonTeamId}
            href={buildSeasonTeamRoute(year, row.teamSlug)}
            className="group block overflow-hidden rounded-[22px] border border-line/80 bg-white/95 shadow-panel transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 sm:rounded-[28px]"
          >
            <div className="relative overflow-hidden px-3.5 py-3.5 sm:px-4.5 sm:py-4.5 md:px-5">
              <div
                aria-hidden
                className="absolute -right-10 top-0 h-28 w-28 rounded-full blur-3xl sm:h-36 sm:w-36"
                style={{ backgroundColor: row.secondaryColor, opacity: 0.12 }}
              />
              <div
                aria-hidden
                className="absolute left-20 top-6 h-20 w-20 rounded-full blur-3xl sm:left-24 sm:top-8 sm:h-24 sm:w-24"
                style={{ backgroundColor: row.primaryColor, opacity: 0.1 }}
              />
              <div
                className="absolute inset-y-3.5 left-0 w-1 rounded-r-full sm:inset-y-5 sm:w-1.5"
                style={{ backgroundColor: row.primaryColor }}
              />

              <div className="relative sm:hidden">
                <div className="flex items-start gap-3">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-bold text-white shadow-sm ring-4 ring-white/80"
                    style={{
                      backgroundImage: `linear-gradient(135deg, ${row.primaryColor}, ${row.secondaryColor})`,
                    }}
                  >
                    {row.rank}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold tracking-tight text-ink">{row.displayNameKo}</p>
                        <p className="mt-0.5 text-[11px] text-muted">{standingStatus}</p>
                      </div>

                      <span
                        className={cn(
                          "inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold",
                          inPostseasonCut
                            ? "border-[color:color-mix(in_srgb,var(--accent)_18%,white)] bg-[color:color-mix(in_srgb,var(--accent)_8%,white)] text-accent"
                            : "border-slate-200 bg-slate-100 text-muted",
                        )}
                      >
                        {inPostseasonCut ? "5강권" : "추격권"}
                      </span>
                    </div>

                    <p className="mt-1 text-[11px] leading-5 text-muted">{compactSummary}</p>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {meters.map((meter) => (
                        <span
                          key={`${row.seasonTeamId}-${meter.label}-compact`}
                          className="inline-flex items-center rounded-full border border-line/70 bg-slate-50/90 px-2 py-1 text-[11px] font-medium text-ink"
                        >
                          {meter.label} {meter.value === null ? "-" : formatPercent(meter.value)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative hidden gap-4 sm:grid xl:grid-cols-[minmax(0,1.3fr)_minmax(340px,0.95fr)] xl:items-center">
                <div className="min-w-0 space-y-3 xl:pr-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-center gap-4">
                      <span
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-bold text-white shadow-sm ring-4 ring-white/80"
                        style={{
                          backgroundImage: `linear-gradient(135deg, ${row.primaryColor}, ${row.secondaryColor})`,
                        }}
                      >
                        {row.rank}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-lg font-semibold tracking-tight text-ink">{row.displayNameKo}</p>
                        <p className="mt-0.5 text-xs text-muted sm:text-sm">{standingStatus}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 sm:justify-end">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                          inPostseasonCut
                            ? "border-[color:color-mix(in_srgb,var(--accent)_18%,white)] bg-[color:color-mix(in_srgb,var(--accent)_8%,white)] text-accent"
                            : "border-slate-200 bg-slate-100 text-muted",
                        )}
                      >
                        {inPostseasonCut ? "5강권" : "추격권"}
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
                    {summaryStats.map((stat) => (
                      <div
                        key={`${row.seasonTeamId}-${stat.label}`}
                        className={cn(
                          "rounded-[18px] border px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur",
                          summaryStatClassName(stat.tone),
                        )}
                      >
                        <p className="text-[11px] font-medium tracking-[0.04em] text-muted">{stat.label}</p>
                        <p className="mt-1.5 text-sm font-semibold leading-none text-ink">{stat.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(241,245,249,0.94))] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className="rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-[0.16em] text-muted"
                    >
                      확률 요약
                    </span>
                    <p className="text-xs font-medium text-ink sm:text-sm">시뮬레이션 확률</p>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    {meters.map((meter) => (
                      <div
                        key={`${row.seasonTeamId}-${meter.label}`}
                        className="rounded-[18px] border border-white/80 bg-white/72 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.86)]"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-medium text-muted">{meter.label}</span>
                          <span className="text-xs font-semibold text-ink sm:text-sm">
                            {meter.value === null ? "-" : formatPercent(meter.value)}
                          </span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200/90">
                          <div
                            className="h-full rounded-full transition-all duration-300 group-hover:brightness-105"
                            style={{
                              width: `${Math.max(0, Math.min(100, (meter.value ?? 0) * 100))}%`,
                              backgroundImage: `linear-gradient(90deg, ${row.primaryColor}, ${row.secondaryColor})`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
