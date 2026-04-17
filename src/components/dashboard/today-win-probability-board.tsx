import Link from "next/link";

import type { Game, GameProbabilitySnapshot, TeamDisplay } from "@/lib/domain/kbo/types";
import { formatDateTimeLabel, formatPercent } from "@/lib/utils/format";
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
    <div className="grid gap-4 xl:grid-cols-2">
      {games.map((game) => {
        const away = displayById[game.awaySeasonTeamId];
        const home = displayById[game.homeSeasonTeamId];
        if (!away || !home) {
          return null;
        }

        const probability = probabilitiesById[game.gameId];
        const { awayShare, homeShare, tieProb } = normalizeHeadToHeadShares(probability);
        const pickLabel = buildPickLabel(probability, away, home);

        return (
          <Link
            key={game.gameId}
            href={buildGameRoute(game.gameId)}
            className="block overflow-hidden rounded-[28px] border border-line/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(241,245,249,0.92))] px-5 py-5 shadow-panel transition hover:-translate-y-0.5 hover:border-accent/35"
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

            <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <div className="text-left">
                <p className="text-3xl font-semibold tracking-tight text-ink">{formatPercent(awayShare)}</p>
                <p className="mt-1 text-base font-semibold text-ink">{away.shortNameKo}</p>
              </div>
              <span className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">VS</span>
              <div className="text-right">
                <p className="text-3xl font-semibold tracking-tight text-ink">{formatPercent(homeShare)}</p>
                <p className="mt-1 text-base font-semibold text-ink">{home.shortNameKo}</p>
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-full bg-slate-200/80">
              <div className="flex h-4 w-full">
                <div
                  className="transition-[width]"
                  style={{
                    width: `${awayShare * 100}%`,
                    backgroundColor: away.primaryColor,
                  }}
                />
                <div
                  className="transition-[width]"
                  style={{
                    width: `${homeShare * 100}%`,
                    backgroundColor: home.primaryColor,
                  }}
                />
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs font-medium text-muted">
              <span>{away.displayNameKo}</span>
              <span>
                신뢰도 {formatPercent(probability?.pickConfidenceScore ?? 0)}
              </span>
              <span>{home.displayNameKo}</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
