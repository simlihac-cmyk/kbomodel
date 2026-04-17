export const KBO_PHASES = [
  "QUIET",
  "PREGAME",
  "LIVE",
  "FINALIZATION",
  "NIGHTLY_RECONCILE",
  "WEEKLY_COLD_SYNC",
] as const;

export type KboSchedulerPhase = (typeof KBO_PHASES)[number];

export const KBO_REASON_CODES = [
  "no-games-today",
  "before-active-window",
  "pregame-refresh-needed",
  "live-games-detected",
  "final-state-transition-detected",
  "nightly-reconcile-needed",
  "weekly-cold-sync-needed",
  "no-semantic-change",
  "publish-completed",
  "publish-skipped",
] as const;

export type KboSchedulerReasonCode = (typeof KBO_REASON_CODES)[number];

export type KboPhaseDecision = {
  phase: KboSchedulerPhase;
  reasonCodes: KboSchedulerReasonCode[];
  shouldRefreshHotPath: boolean;
  shouldRefreshColdPath: boolean;
  shouldPublish: boolean;
  shouldRerunSimulation: boolean;
};
