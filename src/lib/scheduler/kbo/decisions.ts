import type { Game } from "@/lib/domain/kbo/types";
import type { CurrentManifest } from "@/lib/publish/contracts";
import { detectChangedGames, detectSimulationTriggerEvents, shouldRerunFullSimulationForEvent } from "@/lib/scheduler/kbo/triggers";
import type { KboPhaseDecision } from "@/lib/scheduler/kbo/phase";
import { getKboNow, isAfterNightlyWindow, isWeeklyColdSyncWindow, isWithinHotWindow } from "@/lib/scheduler/kbo/windows";

type DetermineKboPhaseArgs = {
  gamesToday: Game[];
  previousTodayGames?: Game[];
  currentManifest?: CurrentManifest | null;
  now?: Date;
  stalePregameData?: boolean;
  staleColdPath?: boolean;
};

function getFirstScheduledAt(games: Game[]) {
  return [...games].sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt))[0]?.scheduledAt ?? null;
}

export function determineKboPhase({
  gamesToday,
  previousTodayGames = [],
  currentManifest = null,
  now = new Date(),
  stalePregameData = false,
  staleColdPath = false,
}: DetermineKboPhaseArgs): KboPhaseDecision {
  const nowKst = getKboNow(now);
  const hasGamesToday = gamesToday.length > 0;
  const hasLiveGames = gamesToday.some((game) => game.status === "scheduled" && game.homeScore !== null && game.awayScore !== null);
  const hasUnfinalizedGames = gamesToday.some((game) => game.status !== "final" && game.status !== "postponed");
  const firstScheduledAt = getFirstScheduledAt(gamesToday);
  const firstPitchInFuture = firstScheduledAt ? new Date(firstScheduledAt).getTime() > now.getTime() : false;
  const changedGames = detectChangedGames(previousTodayGames, gamesToday);
  const triggerEvents = detectSimulationTriggerEvents(previousTodayGames, gamesToday);
  const shouldRerunSimulation = triggerEvents.some((event) => shouldRerunFullSimulationForEvent(event));

  if (!hasGamesToday && !staleColdPath) {
    return {
      phase: isWeeklyColdSyncWindow(now) ? "WEEKLY_COLD_SYNC" : "QUIET",
      reasonCodes: isWeeklyColdSyncWindow(now) ? ["weekly-cold-sync-needed"] : ["no-games-today"],
      shouldRefreshHotPath: false,
      shouldRefreshColdPath: isWeeklyColdSyncWindow(now),
      shouldPublish: false,
      shouldRerunSimulation: false,
    };
  }

  if (changedGames.length > 0 && shouldRerunSimulation) {
    return {
      phase: "FINALIZATION",
      reasonCodes: ["final-state-transition-detected"],
      shouldRefreshHotPath: true,
      shouldRefreshColdPath: false,
      shouldPublish: true,
      shouldRerunSimulation: true,
    };
  }

  if (hasLiveGames || (hasGamesToday && hasUnfinalizedGames && !firstPitchInFuture && isWithinHotWindow(now))) {
    return {
      phase: "LIVE",
      reasonCodes: ["live-games-detected"],
      shouldRefreshHotPath: true,
      shouldRefreshColdPath: false,
      shouldPublish: changedGames.length > 0,
      shouldRerunSimulation: false,
    };
  }

  if (hasGamesToday && firstPitchInFuture && (stalePregameData || !currentManifest)) {
    return {
      phase: "PREGAME",
      reasonCodes: ["pregame-refresh-needed"],
      shouldRefreshHotPath: true,
      shouldRefreshColdPath: staleColdPath,
      shouldPublish: true,
      shouldRerunSimulation: stalePregameData,
    };
  }

  if (hasGamesToday && !hasUnfinalizedGames && isAfterNightlyWindow(now)) {
    return {
      phase: "NIGHTLY_RECONCILE",
      reasonCodes: ["nightly-reconcile-needed"],
      shouldRefreshHotPath: true,
      shouldRefreshColdPath: true,
      shouldPublish: true,
      shouldRerunSimulation: true,
    };
  }

  return {
    phase: "QUIET",
    reasonCodes: [isWithinHotWindow(now) ? "no-semantic-change" : "before-active-window"],
    shouldRefreshHotPath: false,
    shouldRefreshColdPath: false,
    shouldPublish: false,
    shouldRerunSimulation: false,
  };
}
