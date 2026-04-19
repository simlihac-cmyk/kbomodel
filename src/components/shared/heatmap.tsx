import { cn } from "@/lib/utils/cn";
import { formatPercent } from "@/lib/utils/format";

type HeatmapProps = {
  rows: {
    label: string;
    values: number[];
    accent?: string;
  }[];
};

export function RankHeatmap({ rows }: HeatmapProps) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-0.5">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-2 py-1">팀</th>
            {Array.from({ length: 10 }, (_, index) => (
              <th key={index} className="px-2 py-1 text-center">
                {index + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td className="whitespace-nowrap px-2 py-1.5 text-sm font-medium text-ink">{row.label}</td>
              {row.values.map((value, index) => (
                <td key={index} className="px-0.5 py-0.5">
                  <div
                    className={cn(
                      "flex min-w-11 items-center justify-center rounded-lg px-1.5 py-1.5 text-[11px] font-medium text-ink",
                    )}
                    style={{
                      backgroundColor: row.accent
                        ? `${row.accent}${Math.max(18, Math.round(value * 100)).toString(16).padStart(2, "0")}`
                        : `rgba(0, 111, 95, ${Math.max(0.1, value * 0.85)})`,
                    }}
                  >
                    {formatPercent(value)}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
