import Link from "next/link";

import type { Game, GameProbabilitySnapshot, TeamDisplay } from "@/lib/domain/kbo/types";
import { formatDateTimeLabel, formatPercent } from "@/lib/utils/format";
import { resolveDistinctTeamColors } from "@/lib/utils/team-colors";
import { buildGameRoute } from "@/lib/utils/routes";

type TodayWinProbabilityBoardProps = {
  games: Game[];
  probabilitiesById: Record<string, GameProbabilitySnapshot | undefined>;
  displayById: Record<string, TeamDisplay>;
};

function buildPickLabel(
  probability: GameProbabilitySnapshot | undefined,
  away: TeamDisplay,
  home: TeamDisplay,
) {
  const level = probability?.pickConfidenceLevel ?? "pass";
  if (level === "pass") {
    return "접전";
  }

  const favorite =
    probability?.pickFavoriteSide === "away" ? away.shortNameKo : home.shortNameKo;
  if (level === "strong") {
    return `${favorite} 강우세`;
  }
  if (level === "pick") {
    return `${favorite} 우세`;
  }
  return `${favorite} 약우세`;
}

function pickChipClass(level: GameProbabilitySnapshot["pickConfidenceLevel"] | undefined) {
  if (level === "strong") {
    return "bg-amber-100 text-amber-900";
  }
  if (level === "pick") {
    return "bg-emerald-100 text-emerald-900";
  }
  if (level === "lean") {
    return "bg-sky-100 text-sky-900";
  }
  return "bg-slate-100 text-muted";
}

function normalizeHeadToHeadShares(probability?: GameProbabilitySnapshot) {
  const homeWinProb = probability?.homeWinProb ?? 0.5;
  const awayWinProb = probability?.awayWinProb ?? 0.5;
  const denominator = homeWinProb + awayWinProb;

  if (denominator <= Number.EPSILON) {
    return {
      awayShare: 0.5,
      homeShare: 0.5,
      tieProb: probability?.tieProb ?? 0,
    };
  }

  return {
    awayShare: awayWinProb / denominator,
    homeShare: homeWinProb / denominator,
    tieProb: probability?.tieProb ?? 0,
  };
}

export function TodayWinProbabilityBoard({
  games,
  probabilitiesById,
  displayById,
}: TodayWinProbabilityBoardProps) {
  return (
    <div className="grid gap-3 xl:grid-cols-2">
      {games.map((game) => {
        const away = displayById[game.awaySeasonTeamId];
        const home = displayById[game.homeSeasonTeamId];
        if (!away || !home) {
          return null;
        }

        const probability = probabilitiesById[game.gameId];
        const { awayShare, homeShare, tieProb } = normalizeHeadToHeadShares(probability);
        const pickLabel = buildPickLabel(probability, away, home);
        const { leftColor: awayBarColor, rightColor: homeBarColor } = resolveDistinctTeamColors(away, home);

        return (
          <Link
            key={game.gameId}
            href={buildGameRoute(game.gameId)}
            className="block overflow-hidden rounded-[24px] border border-line/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(241,245,249,0.92))] px-4 py-4 shadow-panel transition hover:-translate-y-0.5 hover:border-accent/35 sm:rounded-[28px]"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="metric-chip bg-slate-100 text-ink">{formatDateTimeLabel(game.scheduledAt)}</span>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <span className={`metric-chip ${pickChipClass(probability?.pickConfidenceLevel)}`}>
                  {pickLabel}
                </span>
                {tieProb > 0.001 ? (
                  <span className="metric-chip bg-white text-muted">무 {formatPercent(tieProb)}</span>
                ) : null}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2.5 sm:gap-3">
              <div className="text-left">
                <p className="text-2xl font-semibold tracking-tight text-ink sm:text-[1.75rem]">{formatPercent(awayShare)}</p>
                <div className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-ink sm:text-base">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: awayBarColor }} />
                  <span>{away.shortNameKo}</span>
                </div>
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted sm:text-xs">VS</span>
              <div className="text-right">
                <p className="text-2xl font-semibold tracking-tight text-ink sm:text-[1.75rem]">{formatPercent(homeShare)}</p>
                <div className="mt-0.5 flex items-center justify-end gap-1.5 text-sm font-semibold text-ink sm:text-base">
                  <span>{home.shortNameKo}</span>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: homeBarColor }} />
                </div>
              </div>
            </div>

            <div className="mt-3 overflow-hidden rounded-full bg-slate-200/80">
              <div className="flex h-3 w-full sm:h-3.5">
                <div
                  className="transition-[width]"
                  style={{
                    width: `${awayShare * 100}%`,
                    backgroundColor: awayBarColor,
                  }}
                />
                <div
                  className="transition-[width]"
                  style={{
                    width: `${homeShare * 100}%`,
                    backgroundColor: homeBarColor,
                  }}
                />
              </div>
            </div>

            <p className="mt-2 text-right text-[11px] font-medium text-muted">
              예측 신뢰도 {formatPercent(probability?.pickConfidenceScore ?? 0)}
            </p>
          </Link>
        );
      })}
    </div>
  );
}
