import Link from "next/link";

import type { StandingRow } from "@/lib/domain/kbo/types";
import { formatGamesBack, formatPct, formatPercent } from "@/lib/utils/format";
import { buildSeasonTeamRoute } from "@/lib/utils/routes";

type StandingsTableProps = {
  year: number;
  rows: StandingRow[];
  linkTeams?: boolean;
};

export function StandingsTable({ year, rows, linkTeams = true }: StandingsTableProps) {
  const hasProjectionColumns = rows.some((row) => row.bucketOdds || row.postseasonOdds);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted sm:hidden">
        표가 길면 좌우로 밀어서 보세요. 팀 열은 고정되어 있어 현재 위치를 잃지 않게 했습니다.
      </p>
      <div className="overflow-x-auto rounded-3xl border border-line/80">
      <table className="min-w-[1200px] text-sm">
        <thead className="border-b border-line/80 text-xs uppercase tracking-wide text-muted">
          <tr>
            {["팀", "경기", "승", "패", "무", "승률", "게임차", "최근10", "연속", "홈", "방문", "1위", "2위", "3위", "4위", "5위", "PS", "KS", "우승"].map((label) => (
              <th
                key={label}
                className="bg-white px-3 py-3 text-right first:sticky first:left-0 first:z-10 first:text-left"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const ps = row.bucketOdds ? 1 - row.bucketOdds.missPostseason : 0;
            const projectionText = (value?: number) =>
              hasProjectionColumns && value !== undefined ? formatPercent(value) : "-";
            return (
              <tr key={row.seasonTeamId} className="border-b border-line/60 last:border-0">
                <td className="sticky left-0 z-[1] bg-white px-3 py-3 text-left">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white" style={{ backgroundColor: row.primaryColor }}>
                      {row.rank}
                    </span>
                    <div>
                      {linkTeams ? (
                        <Link href={buildSeasonTeamRoute(year, row.teamSlug)} className="font-medium text-ink hover:text-accent">
                          {row.shortNameKo}
                        </Link>
                      ) : (
                        <span className="font-medium text-ink">{row.shortNameKo}</span>
                      )}
                      <p className="text-xs text-muted">{row.shortCode}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 text-right">{row.games}</td>
                <td className="px-3 py-3 text-right">{row.wins}</td>
                <td className="px-3 py-3 text-right">{row.losses}</td>
                <td className="px-3 py-3 text-right">{row.ties}</td>
                <td className="px-3 py-3 text-right">{formatPct(row.pct)}</td>
                <td className="px-3 py-3 text-right">{formatGamesBack(row.gamesBack)}</td>
                <td className="px-3 py-3 text-right">{row.recent10}</td>
                <td className="px-3 py-3 text-right">{row.streak}</td>
                <td className="px-3 py-3 text-right">{row.home}</td>
                <td className="px-3 py-3 text-right">{row.away}</td>
                <td className="px-3 py-3 text-right">{projectionText(row.bucketOdds?.first)}</td>
                <td className="px-3 py-3 text-right">{projectionText(row.bucketOdds?.second)}</td>
                <td className="px-3 py-3 text-right">{projectionText(row.bucketOdds?.third)}</td>
                <td className="px-3 py-3 text-right">{projectionText(row.bucketOdds?.fourth)}</td>
                <td className="px-3 py-3 text-right">{projectionText(row.bucketOdds?.fifth)}</td>
                <td className="px-3 py-3 text-right">{projectionText(row.bucketOdds ? ps : undefined)}</td>
                <td className="px-3 py-3 text-right">{projectionText(row.postseasonOdds?.ks)}</td>
                <td className="px-3 py-3 text-right">{projectionText(row.postseasonOdds?.champion)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}
