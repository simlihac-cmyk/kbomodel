import type { Game } from "@/lib/domain/kbo/types";

export type SimulationTriggerEvent =
  | "live-inning-update"
  | "final-result"
  | "postponement"
  | "reschedule"
  | "manual-patch"
  | "roster-availability-change"
  | "standings-correction";

export function shouldRerunFullSimulationForEvent(event: SimulationTriggerEvent) {
  switch (event) {
    case "final-result":
    case "postponement":
    case "reschedule":
    case "manual-patch":
    case "roster-availability-change":
    case "standings-correction":
      return true;
    case "live-inning-update":
    default:
      return false;
  }
}

export function detectChangedGames(previousGames: Game[], nextGames: Game[]) {
  const previousById = new Map(previousGames.map((game) => [game.gameId, game] as const));

  return nextGames
    .filter((game) => {
      const previous = previousById.get(game.gameId);
      if (!previous) {
        return true;
      }
      return (
        previous.status !== game.status ||
        previous.homeScore !== game.homeScore ||
        previous.awayScore !== game.awayScore ||
        previous.scheduledAt !== game.scheduledAt ||
        previous.note !== game.note
      );
    })
    .map((game) => game.gameId);
}

export function detectSimulationTriggerEvents(previousGames: Game[], nextGames: Game[]): SimulationTriggerEvent[] {
  const previousById = new Map(previousGames.map((game) => [game.gameId, game] as const));
  const events = new Set<SimulationTriggerEvent>();

  for (const game of nextGames) {
    const previous = previousById.get(game.gameId);
    if (!previous) {
      continue;
    }

    const scoreChanged = previous.homeScore !== game.homeScore || previous.awayScore !== game.awayScore;
    const statusChanged = previous.status !== game.status;

    if ((game.status === "final" && previous.status !== "final") || (game.status === "final" && scoreChanged)) {
      events.add("final-result");
    } else if (game.status === "postponed" && statusChanged) {
      events.add("postponement");
    } else if (previous.scheduledAt !== game.scheduledAt) {
      events.add("reschedule");
    } else if (scoreChanged) {
      events.add("live-inning-update");
    }
  }

  return [...events];
}
