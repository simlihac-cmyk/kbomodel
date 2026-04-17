import { cn } from "@/lib/utils/cn";

type MetricBadgeProps = {
  label: string;
  value: string;
  tone?: "neutral" | "positive" | "negative";
};

export function MetricBadge({ label, value, tone = "neutral" }: MetricBadgeProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3",
        tone === "positive" && "border-emerald-200 bg-emerald-50",
        tone === "negative" && "border-orange-200 bg-orange-50",
        tone === "neutral" && "border-line/80 bg-slate-50",
      )}
    >
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-2 break-words text-lg font-semibold leading-tight text-ink sm:text-xl">{value}</p>
    </div>
  );
}
