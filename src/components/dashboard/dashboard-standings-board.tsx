import Link from "next/link";

import type { StandingRow } from "@/lib/domain/kbo/types";
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

function buildMeters(row: StandingRow): ProbabilityMeter[] {
  const postseasonProb = row.bucketOdds ? 1 - row.bucketOdds.missPostseason : null;
  return [
    { label: "1위", value: row.bucketOdds?.first ?? null },
    { label: "5강", value: postseasonProb },
    { label: "우승", value: row.postseasonOdds?.champion ?? null },
  ];
}

export function DashboardStandingsBoard({ year, rows }: DashboardStandingsBoardProps) {
  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const meters = buildMeters(row);
        const inPostseasonCut = row.rank <= 5;

        return (
          <Link
            key={row.seasonTeamId}
            href={buildSeasonTeamRoute(year, row.teamSlug)}
            className="block overflow-hidden rounded-[28px] border border-line/80 bg-white px-5 py-4 shadow-panel transition hover:-translate-y-0.5 hover:border-accent/30"
          >
            <div className="relative">
              <div
                className="absolute inset-y-0 left-[-20px] w-2 rounded-full"
                style={{ backgroundColor: row.primaryColor }}
              />

              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between xl:min-w-[360px] xl:pr-6">
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                      style={{ backgroundColor: row.primaryColor }}
                    >
                      {row.rank}
                    </span>
                    <div>
                      <p className="text-lg font-semibold text-ink">{row.displayNameKo}</p>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs font-medium text-muted">
                        <span className="metric-chip bg-slate-100 text-ink">
                          {formatRecordLabel(row.wins, row.losses, row.ties)}
                        </span>
                        <span className="metric-chip bg-slate-100 text-ink">승률 {formatPct(row.pct)}</span>
                        <span className="metric-chip bg-slate-100 text-ink">
                          {row.gamesBack === 0 ? "선두" : `${formatGamesBack(row.gamesBack)} GB`}
                        </span>
                        <span
                          className={`metric-chip ${inPostseasonCut ? "bg-accent-soft text-accent" : "bg-slate-100 text-muted"}`}
                        >
                          {inPostseasonCut ? "5강권" : "추격권"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs font-medium text-muted sm:justify-end">
                    <span className="metric-chip bg-slate-100 text-ink">최근10 {row.recent10}</span>
                    <span className="metric-chip bg-slate-100 text-ink">{row.streak}</span>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[420px]">
                  {meters.map((meter) => (
                    <div key={`${row.seasonTeamId}-${meter.label}`} className="rounded-2xl bg-slate-50 px-3 py-3">
                      <div className="flex items-center justify-between gap-3 text-xs font-medium text-muted">
                        <span>{meter.label}</span>
                        <span className="text-ink">{meter.value === null ? "-" : formatPercent(meter.value)}</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.max(0, Math.min(100, (meter.value ?? 0) * 100))}%`,
                            backgroundColor: row.primaryColor,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
