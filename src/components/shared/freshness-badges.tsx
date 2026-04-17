import { formatDateTimeLabel } from "@/lib/utils/format";

export type AutomationStatusViewModel = {
  currentPublishedAt: string | null;
  simulationPublishedAt: string | null;
  hasLiveGames: boolean;
  allGamesFinal: boolean;
  simulationFreshness: "fresh" | "waiting-for-final" | "stale";
  staleDatasets: string[];
  freshnessByDataset: Array<{
    dataset: string;
    fetchedAt: string | null;
    stale: boolean;
  }>;
};

type FreshnessBadgesProps = {
  status: AutomationStatusViewModel | null;
  compact?: boolean;
};

function chipClassName(tone: "neutral" | "positive" | "warning" | "danger") {
  switch (tone) {
    case "positive":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "danger":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "neutral":
    default:
      return "border-line/80 bg-white text-muted";
  }
}

export function FreshnessBadges({ status, compact = false }: FreshnessBadgesProps) {
  if (!status) {
    return null;
  }

  const wrapperClass = compact
    ? "flex flex-wrap gap-2"
    : "flex flex-wrap gap-2 rounded-[1.5rem] border border-line/70 bg-white/85 px-4 py-4";
  const chipBase = "rounded-full border px-3 py-1.5 text-xs font-medium";

  return (
    <div className={wrapperClass}>
      <span className={`${chipBase} ${chipClassName(status.hasLiveGames ? "warning" : "positive")}`}>
        {status.hasLiveGames ? "라이브 경기 진행 중" : status.allGamesFinal ? "오늘 경기 종료" : "프리게임 기준"}
      </span>
      <span
        className={`${chipBase} ${chipClassName(
          status.simulationFreshness === "fresh"
            ? "positive"
            : status.simulationFreshness === "waiting-for-final"
              ? "warning"
              : "danger",
        )}`}
      >
        {status.simulationFreshness === "fresh"
          ? "시뮬레이션 최신"
          : status.simulationFreshness === "waiting-for-final"
            ? "최종 종료 대기"
            : "시뮬레이션 stale"}
      </span>
      <span className={`${chipBase} ${chipClassName(status.staleDatasets.length > 0 ? "danger" : "neutral")}`}>
        {status.staleDatasets.length > 0 ? `지연 데이터: ${status.staleDatasets.join(", ")}` : "핫패스 데이터 최신"}
      </span>
      {status.currentPublishedAt ? (
        <span className={`${chipBase} ${chipClassName("neutral")}`}>
          현재 상태 {formatDateTimeLabel(status.currentPublishedAt)}
        </span>
      ) : null}
      {status.simulationPublishedAt ? (
        <span className={`${chipBase} ${chipClassName("neutral")}`}>
          시뮬레이션 {formatDateTimeLabel(status.simulationPublishedAt)}
        </span>
      ) : null}
    </div>
  );
}

type FreshnessModuleGridProps = {
  status: AutomationStatusViewModel | null;
};

export function FreshnessModuleGrid({ status }: FreshnessModuleGridProps) {
  if (!status) {
    return null;
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {status.freshnessByDataset.map((entry) => (
        <div
          key={entry.dataset}
          className={`rounded-2xl border px-4 py-4 text-sm ${chipClassName(entry.stale ? "danger" : "neutral")}`}
        >
          <p className="font-medium">{entry.dataset}</p>
          <p className="mt-2">
            {entry.fetchedAt ? formatDateTimeLabel(entry.fetchedAt) : "아직 publish 없음"}
          </p>
        </div>
      ))}
    </div>
  );
}
