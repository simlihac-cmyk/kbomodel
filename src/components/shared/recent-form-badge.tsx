import type { RecentFormSummary } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

type RecentFormBadgeProps = {
  summary: RecentFormSummary;
  prefix?: string;
  className?: string;
};

const variantClassName: Record<RecentFormSummary["variant"], string> = {
  "very-positive":
    "border-emerald-300 bg-emerald-100 text-emerald-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]",
  positive:
    "border-emerald-200 bg-emerald-50 text-emerald-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]",
  neutral:
    "border-line/80 bg-white text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]",
  negative:
    "border-amber-200 bg-amber-50 text-amber-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]",
  "very-negative":
    "border-rose-300 bg-rose-100 text-rose-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]",
};

export function RecentFormBadge({ summary, prefix = "최근 폼", className }: RecentFormBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold",
        variantClassName[summary.variant],
        className,
      )}
    >
      <span className="text-[11px] font-medium opacity-75">{prefix}</span>
      <span>{summary.label}</span>
    </span>
  );
}
