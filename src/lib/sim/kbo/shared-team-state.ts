import { CURRENT_SIGNAL_SHRINKAGE_GAMES, RECENT_FORM_WINDOW } from "@/lib/domain/kbo/constants";
import type { TeamSeasonStat } from "@/lib/domain/kbo/types";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function safeRate(numerator: number, denominator: number, fallback = 0) {
  if (denominator <= 0) {
    return fallback;
  }
  return numerator / denominator;
}

function calculatePct(wins: number, losses: number) {
  if (wins + losses === 0) {
    return 0;
  }
  return wins / (wins + losses);
}

export type ParsedRecentForm = {
  wins: number;
  losses: number;
  ties: number;
  winRate: number;
};

export type ParsedStreak = {
  direction: number;
  length: number;
  value: number;
};

export type TeamStateSnapshot = {
  seasonTeamId: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  ties: number;
  winPct: number;
  runsScoredPerGame: number;
  runsAllowedPerGame: number;
  runDiffPerGame: number;
  homePct: number;
  awayPct: number;
  splitGap: number;
  recent10WinRate: number;
  streakValue: number;
};

export type TeamStateLeagueAverages = {
  runsScoredPerGame: number;
  runsAllowedPerGame: number;
  runDiffPerGame: number;
  winPct: number;
  homePct: number;
  awayPct: number;
  recent10WinRate: number;
};

export type FactBasedOperationalSnapshot = {
  currentWeight: number;
  offenseSignal: number;
  runPreventionSignal: number;
  bullpenSignal: number;
  offenseRating: number;
  starterRating: number;
  bullpenRating: number;
  confidenceScore: number;
  homeFieldAdjustment: number;
  recentFormAdjustment: number;
};

export function parseRecent10(value: string | null | undefined): ParsedRecentForm {
  const match = value?.match(/^(\d+)-(\d+)(?:-(\d+))?$/);
  const wins = Number.parseInt(match?.[1] ?? "0", 10);
  const losses = Number.parseInt(match?.[2] ?? "0", 10);
  const ties = Number.parseInt(match?.[3] ?? "0", 10);
  const hasDecisiveGames = wins + losses > 0;
  return {
    wins,
    losses,
    ties,
    winRate: hasDecisiveGames ? calculatePct(wins, losses) : 0.5,
  };
}

export function parseStreak(value: string | null | undefined): ParsedStreak {
  if (!value || value === "-" || value.trim().length === 0) {
    return { direction: 0, length: 0, value: 0 };
  }

  const normalized = value.trim();
  const win = normalized.match(/^(?:승|W)(\d+)$/i);
  if (win) {
    const length = Number.parseInt(win[1], 10);
    return { direction: 1, length, value: length };
  }

  const loss = normalized.match(/^(?:패|L)(\d+)$/i);
  if (loss) {
    const length = Number.parseInt(loss[1], 10);
    return { direction: -1, length, value: -length };
  }

  const tie = normalized.match(/^(?:무|T)(\d+)$/i);
  if (tie) {
    const length = Number.parseInt(tie[1], 10);
    return { direction: 0, length, value: 0 };
  }

  return { direction: 0, length: 0, value: 0 };
}

export function buildTeamStateSnapshot(stat: TeamSeasonStat): TeamStateSnapshot {
  const gamesPlayed = stat.wins + stat.losses + stat.ties;
  const homePct = calculatePct(stat.homeWins, stat.homeLosses);
  const awayPct = calculatePct(stat.awayWins, stat.awayLosses);
  const recent10 = parseRecent10(stat.last10);
  const streak = parseStreak(stat.streak);

  return {
    seasonTeamId: stat.seasonTeamId,
    gamesPlayed,
    wins: stat.wins,
    losses: stat.losses,
    ties: stat.ties,
    winPct: calculatePct(stat.wins, stat.losses),
    runsScoredPerGame: safeRate(stat.runsScored, Math.max(gamesPlayed, 1)),
    runsAllowedPerGame: safeRate(stat.runsAllowed, Math.max(gamesPlayed, 1)),
    runDiffPerGame: safeRate(stat.runsScored - stat.runsAllowed, Math.max(gamesPlayed, 1)),
    homePct,
    awayPct,
    splitGap: homePct - awayPct,
    recent10WinRate: recent10.winRate,
    streakValue: streak.value,
  };
}

export function buildTeamStateLeagueAverages(states: TeamStateSnapshot[]): TeamStateLeagueAverages {
  if (states.length === 0) {
    return {
      runsScoredPerGame: 4.5,
      runsAllowedPerGame: 4.5,
      runDiffPerGame: 0,
      winPct: 0.5,
      homePct: 0.5,
      awayPct: 0.5,
      recent10WinRate: 0.5,
    };
  }

  const totals = states.reduce(
    (accumulator, state) => ({
      runsScoredPerGame: accumulator.runsScoredPerGame + state.runsScoredPerGame,
      runsAllowedPerGame: accumulator.runsAllowedPerGame + state.runsAllowedPerGame,
      runDiffPerGame: accumulator.runDiffPerGame + state.runDiffPerGame,
      winPct: accumulator.winPct + state.winPct,
      homePct: accumulator.homePct + state.homePct,
      awayPct: accumulator.awayPct + state.awayPct,
      recent10WinRate: accumulator.recent10WinRate + state.recent10WinRate,
    }),
    {
      runsScoredPerGame: 0,
      runsAllowedPerGame: 0,
      runDiffPerGame: 0,
      winPct: 0,
      homePct: 0,
      awayPct: 0,
      recent10WinRate: 0,
    },
  );

  return {
    runsScoredPerGame: totals.runsScoredPerGame / states.length,
    runsAllowedPerGame: totals.runsAllowedPerGame / states.length,
    runDiffPerGame: totals.runDiffPerGame / states.length,
    winPct: totals.winPct / states.length,
    homePct: totals.homePct / states.length,
    awayPct: totals.awayPct / states.length,
    recent10WinRate: totals.recent10WinRate / states.length,
  };
}

export function buildOffenseSignal(state: TeamStateSnapshot, league: TeamStateLeagueAverages) {
  return clamp(
    (state.runsScoredPerGame - league.runsScoredPerGame) * 9.4 +
      (state.runDiffPerGame - league.runDiffPerGame) * 2.6 +
      (state.recent10WinRate - league.recent10WinRate) * 4.2,
    -16,
    16,
  );
}

export function buildRunPreventionSignal(state: TeamStateSnapshot, league: TeamStateLeagueAverages) {
  return clamp(
    (league.runsAllowedPerGame - state.runsAllowedPerGame) * 9.8 +
      (state.runDiffPerGame - league.runDiffPerGame) * 3.1 +
      (state.winPct - league.winPct) * 8.4,
    -16,
    16,
  );
}

export function buildBullpenProxySignal(state: TeamStateSnapshot, league: TeamStateLeagueAverages) {
  return clamp(
    (league.runsAllowedPerGame - state.runsAllowedPerGame) * 6.6 +
      (state.recent10WinRate - league.recent10WinRate) * 5.8 +
      state.streakValue * 0.35,
    -12,
    12,
  );
}

export function buildHomeFieldAdjustmentFromState(state: TeamStateSnapshot, league: TeamStateLeagueAverages, baseAdjustment: number) {
  return clamp(
    baseAdjustment + (state.splitGap - (league.homePct - league.awayPct)) * 0.22,
    0.08,
    0.3,
  );
}

export function buildScheduleStrengthValue(state: TeamStateSnapshot, league: TeamStateLeagueAverages) {
  return (
    (state.winPct - league.winPct) * 10 +
    (state.runDiffPerGame - league.runDiffPerGame) * 3 +
    (state.recent10WinRate - league.recent10WinRate) * 2
  );
}

export function buildCurrentWeight(gamesPlayed: number, regularSeasonGamesPerTeam: number) {
  if (gamesPlayed <= 0 || regularSeasonGamesPerTeam <= 0) {
    return 0.02;
  }

  const seasonProgress = clamp(gamesPlayed / regularSeasonGamesPerTeam, 0, 1);
  const progressSignal = Math.pow(seasonProgress, 1.35);
  const sampleSignal = gamesPlayed / (gamesPlayed + CURRENT_SIGNAL_SHRINKAGE_GAMES * 2.2);

  return clamp(progressSignal * 0.55 + sampleSignal * 0.45, 0.08, 0.84);
}

export function buildRecentFormAdjustment(state: TeamStateSnapshot) {
  return (state.recent10WinRate - 0.5) * 0.8 + (state.streakValue / RECENT_FORM_WINDOW) * 0.08;
}

export function buildConfidenceScore(state: TeamStateSnapshot, currentWeight: number) {
  return clamp(
    0.24 + currentWeight * 0.68 + Math.min(0.08, Math.abs(state.runDiffPerGame) * 0.04),
    0.16,
    0.92,
  );
}

export function buildFactBasedOperationalSnapshot(args: {
  state: TeamStateSnapshot;
  league: TeamStateLeagueAverages;
  regularSeasonGamesPerTeam: number;
  baseHomeFieldAdjustment: number;
}): FactBasedOperationalSnapshot {
  const currentWeight = buildCurrentWeight(args.state.gamesPlayed, args.regularSeasonGamesPerTeam);
  const offenseSignal = buildOffenseSignal(args.state, args.league);
  const runPreventionSignal = buildRunPreventionSignal(args.state, args.league);
  const bullpenSignal = buildBullpenProxySignal(args.state, args.league);

  return {
    currentWeight: Number(currentWeight.toFixed(4)),
    offenseSignal: Number(offenseSignal.toFixed(4)),
    runPreventionSignal: Number(runPreventionSignal.toFixed(4)),
    bullpenSignal: Number(bullpenSignal.toFixed(4)),
    offenseRating: Number((100 + offenseSignal * currentWeight).toFixed(4)),
    starterRating: Number((100 + runPreventionSignal * currentWeight * 0.92).toFixed(4)),
    bullpenRating: Number((100 + bullpenSignal * currentWeight).toFixed(4)),
    confidenceScore: Number(buildConfidenceScore(args.state, currentWeight).toFixed(4)),
    homeFieldAdjustment: Number(
      buildHomeFieldAdjustmentFromState(args.state, args.league, args.baseHomeFieldAdjustment).toFixed(4),
    ),
    recentFormAdjustment: Number(buildRecentFormAdjustment(args.state).toFixed(4)),
  };
}

export function buildRemainingScheduleDifficulty(args: {
  remainingByOpponent: Record<string, number>;
  teamStateById: Record<string, TeamStateSnapshot>;
  league: TeamStateLeagueAverages;
}) {
  const entries = Object.entries(args.remainingByOpponent);
  const totalRemaining = entries.reduce((sum, [, count]) => sum + count, 0);
  if (totalRemaining === 0) {
    return 0;
  }

  let weightedStrength = 0;
  for (const [opponentId, count] of entries) {
    const opponent = args.teamStateById[opponentId];
    if (!opponent) {
      continue;
    }
    weightedStrength += buildScheduleStrengthValue(opponent, args.league) * count;
  }

  return Number(((weightedStrength / totalRemaining) / 12).toFixed(4));
}
