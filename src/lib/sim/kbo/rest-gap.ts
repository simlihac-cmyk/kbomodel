import type { Game } from "@/lib/domain/kbo/types";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function buildRestGapByGame(games: Game[]) {
  const sortedGames = [...games].sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt));
  const lastGameAtByTeam = new Map<string, number>();
  const restGapByGameId: Record<string, number | null> = {};

  for (const game of sortedGames) {
    const scheduledAt = new Date(game.scheduledAt).getTime();
    const homeLast = lastGameAtByTeam.get(game.homeSeasonTeamId);
    const awayLast = lastGameAtByTeam.get(game.awaySeasonTeamId);
    const homeRest =
      homeLast === undefined ? null : clamp(Math.round((scheduledAt - homeLast) / 86_400_000) - 1, 0, 30);
    const awayRest =
      awayLast === undefined ? null : clamp(Math.round((scheduledAt - awayLast) / 86_400_000) - 1, 0, 30);
    restGapByGameId[game.gameId] =
      homeRest === null || awayRest === null ? null : homeRest - awayRest;
    lastGameAtByTeam.set(game.homeSeasonTeamId, scheduledAt);
    lastGameAtByTeam.set(game.awaySeasonTeamId, scheduledAt);
  }

  return restGapByGameId;
}
